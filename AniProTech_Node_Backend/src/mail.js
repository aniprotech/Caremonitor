import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

const encodeHeader = (value) =>
  /[^\x20-\x7e]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`
    : value;

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const linkify = (text) => escapeHtml(text).replace(
  /(https:\/\/[^\s<]+)/g,
  '<a href="$1" style="color:#00bfea;font-weight:600">Open Caremonitor</a>',
).replaceAll("\n", "<br>");

export function brandedEmail({ title, preheader, text, actionUrl, actionLabel = "Open Caremonitor" }) {
  const body = linkify(text);
  const action = actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#08bde8;color:#06223f;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px">${escapeHtml(actionLabel)}</a></p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f3f7fa;font-family:Arial,sans-serif;color:#17324d"><span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader || title)}</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(6,34,63,.10)"><tr><td style="background:#061b34;padding:24px 30px;color:#fff"><div style="font-size:26px;font-weight:800;letter-spacing:.2px"><span style="color:#08c8ef">C</span>aremonitor</div><div style="font-size:12px;color:#b8d4e8;margin-top:4px">by AniProTech</div></td></tr><tr><td style="padding:34px 30px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 18px;color:#061b34">${escapeHtml(title)}</h1><div style="font-size:16px;line-height:1.65;color:#40566b">${body}</div>${action}<p style="font-size:13px;line-height:1.5;color:#718395;margin:30px 0 0;border-top:1px solid #e5edf3;padding-top:20px">This automated message was sent securely by Caremonitor. If you were not expecting it, contact your care provider or Caremonitor administrator.</p></td></tr><tr><td style="background:#eef7fb;padding:18px 30px;font-size:12px;color:#60788c">Caremonitor by AniProTech · Secure care operations</td></tr></table></td></tr></table></body></html>`;
}

const gmailError = (message, status, providerStage) => {
  const error = new Error(message);
  error.code = "EMAIL_DELIVERY_FAILED";
  error.status = status;
  error.providerStage = providerStage;
  error.retryable = status === 429 || status >= 500;
  return error;
};

function gmailMessage({ from, to, subject, text, html, messageId, attachments = [] }) {
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  const mixedBoundary = `caremonitor-mixed-${randomUUID()}`;
  const alternativeBoundary = `caremonitor-alternative-${randomUUID()}`;
  const headers = [
    `From: ${from}`,
    `To: ${recipients}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];
  if (messageId) headers.push(`Message-ID: ${messageId}`);
  const content = [
    headers.join("\r\n"), "",
    `--${mixedBoundary}`, `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, "",
    `--${alternativeBoundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(text).toString("base64"),
    `--${alternativeBoundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(html).toString("base64"),
    `--${alternativeBoundary}--`,
    ...attachments.flatMap((attachment) => [
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${attachment.filename || "attachment"}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename || "attachment"}"`, "",
      Buffer.from(attachment.content).toString("base64"),
    ]),
    `--${mixedBoundary}--`, "",
  ].join("\r\n");
  return Buffer.from(content).toString("base64url");
}

export function createMail(config) {
  const gmail = {
    clientId: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    sender: process.env.GMAIL_SENDER,
  };
  const usesGmail = config.mailMode === "gmail";
  const usesSmtp = config.mailMode === "smtp";
  if (!["gmail", "smtp", "outbox"].includes(config.mailMode))
    throw new Error(`Unsupported MAIL_MODE: ${config.mailMode}`);
  const configured = Object.values(gmail).every(Boolean);
  if (config.production && !(usesGmail && configured))
    throw new Error("Production requires Gmail API email configuration.");
  const smtp = usesSmtp ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  }) : null;
  if (usesSmtp && ![process.env.SMTP_HOST, process.env.SMTP_USER, process.env.SMTP_PASSWORD, process.env.SMTP_FROM].every(Boolean))
    throw new Error("SMTP mail mode requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM.");

  async function accessToken() {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: gmail.clientId,
        client_secret: gmail.clientSecret,
        refresh_token: gmail.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok)
      throw gmailError("Gmail authorization failed", response.status, "gmail_oauth");
    const result = await response.json();
    if (!result.access_token)
      throw gmailError(
        "Gmail authorization returned no access token",
        502,
        "gmail_oauth",
      );
    return result.access_token;
  }

  return {
    verify: async () => usesSmtp ? smtp.verify() : !usesGmail || configured,
    async send(message) {
      const branded = {
        ...message,
        subject: message.subject.startsWith("Caremonitor") ? message.subject : `Caremonitor | ${message.subject}`,
        html: message.html || brandedEmail({ title: message.subject, text: message.text, actionUrl: message.actionUrl, actionLabel: message.actionLabel }),
      };
      if (usesGmail) {
        const token = await accessToken();
        const response = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              raw: gmailMessage({ from: gmail.sender, ...branded }),
            }),
          },
        );
        if (!response.ok)
          throw gmailError(
            "Gmail API rejected the email",
            response.status,
            "gmail_send",
          );
        const result = await response.json();
        return {
          id: result.id,
          messageId: result.id,
          accepted: Array.isArray(branded.to) ? branded.to : [branded.to],
          rejected: [],
        };
      }
      if (usesSmtp) {
        try {
          return await smtp.sendMail({
            from: process.env.SMTP_FROM,
            to: branded.to,
            subject: branded.subject,
            text: branded.text,
            html: branded.html,
            attachments: (branded.attachments || []).map((attachment) => ({ filename:attachment.filename, content:attachment.content, contentType:attachment.contentType })),
          });
        } catch {
          throw gmailError("SMTP delivery failed", 503, "smtp_send");
        }
      }
      await fs.mkdir(config.outboxDir, { recursive: true, mode: 0o700 });
      await fs.writeFile(
        path.join(config.outboxDir, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify({...branded,attachments:(branded.attachments || []).map((attachment)=>({...attachment,content:Buffer.from(attachment.content).toString("base64"),encoding:"base64"}))}, null, 2),
        { mode: 0o600 },
      );
    },
  };
}
