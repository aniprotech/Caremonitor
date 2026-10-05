import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

export function configuration(overrides = {}) {
  const production = process.env.NODE_ENV === "production";
  const config = {
    production,
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 8080),
    driver: process.env.DB_DRIVER || "pglite",
    databaseUrl: process.env.DATABASE_URL,
    dataDir: path.resolve(process.env.PGLITE_DATA_DIR || "./data/postgres"),
    frontendUrl:
      process.env.FRONTEND_URL ||
      (production
        ? "https://caremonitor.aniprotech.com"
        : "http://localhost:5173"),
    corsOrigins: (
      process.env.CORS_ORIGINS ||
      (production
        ? "https://caremonitor.aniprotech.com"
        : "http://localhost:5173,http://127.0.0.1:5173")
    ).split(","),
    uploadDir: path.resolve(process.env.UPLOAD_DIR || "./uploads"),
    storageMode: process.env.STORAGE_MODE || (production ? "database" : "filesystem"),
    outboxDir: path.resolve(process.env.OUTBOX_DIR || "./outbox"),
    mailMode: process.env.MAIL_MODE || "outbox",
    platformAdminEmails: (process.env.PLATFORM_ADMIN_EMAILS || "info@aniprotech.com")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    mobileLatestPublishedVersion: process.env.MOBILE_LATEST_PUBLISHED_VERSION || "",
    inboxNotificationsEnabled: process.env.INBOX_NOTIFICATIONS_ENABLED !== 'false',
    trustProxy: process.env.TRUST_PROXY === "true",
    jwtSecret: process.env.JWT_SECRET,
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
    microsoftTenantId: process.env.MICROSOFT_TENANT_ID,
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
    microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    microsoftRedirectUri:
      process.env.MICROSOFT_REDIRECT_URI ||
      "https://backend.aniprotech.com/api/auth/microsoft/callback",
    saltEdgeAppId: process.env.SALT_EDGE_APP_ID,
    saltEdgeSecret: process.env.SALT_EDGE_SECRET,
    saltEdgeCallbackUri: process.env.SALT_EDGE_CALLBACK_URI ||
      "https://backend.aniprotech.com/api/accounting/banking/salt-edge/callback",
    shareAccessUrl:
      process.env.SHARE_ACCESS_URL ||
      (production
        ? "https://caremonitor.aniprotech.com/shared-access"
        : undefined),
    ...overrides,
  };
  if (
    config.production &&
    (!config.jwtSecret ||
      config.jwtSecret.length < 32 ||
      config.driver !== "postgres")
  ) {
    throw new Error(
      "Production requires PostgreSQL and a JWT_SECRET of at least 32 characters.",
    );
  }
  if (config.production && !config.frontendUrl.startsWith("https://"))
    throw new Error("Production requires an HTTPS FRONTEND_URL.");
  if (!config.jwtSecret) {
    fs.mkdirSync(path.dirname(config.dataDir), { recursive: true });
    const keyFile = path.join(path.dirname(config.dataDir), "local-jwt-secret");
    if (!fs.existsSync(keyFile))
      fs.writeFileSync(keyFile, randomBytes(48).toString("hex"), {
        mode: 0o600,
        flag: "wx",
      });
    config.jwtSecret = fs.readFileSync(keyFile, "utf8");
  }
  config.mfaEncryptionKey ||= config.jwtSecret;
  return config;
}
