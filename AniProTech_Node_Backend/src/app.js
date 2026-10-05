import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Repository } from "./repository.js";
import { createAuth } from "./auth.js";
import { createMail } from "./mail.js";
import { createFiles } from "./files.js";
import { reply, fail, uuid } from "./http.js";
import { registerClientFeed } from "./services/client-feed.js";
import { registerUsers } from "./services/users.js";
import { registerClinicalCatalog } from "./services/clinical-catalog.js";
import { registerSharedOptions } from "./services/shared-options.js";
import { registerCarePlans } from "./services/care-plans.js";
import { registerTaskLibrary } from "./services/task-library.js";
import { registerTasks } from "./services/tasks.js";
import { registerMedication } from "./services/medication.js";
import { registerTeam } from "./services/team.js";
import { registerAssignments } from "./services/assignments.js";
import { registerSettings } from "./services/settings.js";
import { registerAccount } from "./services/account.js";
import { registerShareAccess, createPortal } from "./services/share-access.js";
import { registerDocuments } from "./services/documents.js";
import { registerRoster } from "./services/roster.js";
import { registerVisitSchedule } from "./services/visit-schedule.js";
import { registerTeamFeed } from "./services/team-feed.js";
import { registerTeamActivity } from "./services/team-activity.js";
import { registerTimeOff } from "./services/time-off.js";
import { registerInbox } from "./services/inbox.js";
import { registerCareLog } from './services/care-log.js';
import { registerActivity } from "./services/activity.js";
import { registerFinanceReview } from './services/finance-review.js';
import { registerFinance } from "./services/finance.js";
import { registerAccounting } from "./services/accounting.js";
import { registerInvoiceReconciliation } from "./services/invoice-reconciliation.js";
import { registerSaltEdgeBanking, saltEdgeCallback } from "./services/salt-edge-banking.js";
import { registerReporting } from "./services/reporting.js";
import {createInboxNotifications} from './inbox-notifications.js';
import {registerNotificationDelivery} from './services/notification-delivery.js';
import { registerMobileCare } from "./services/mobile-care.js";
import { createMobilePush, registerMobilePush } from "./services/mobile-push.js";
import { registerPlatformAdmin } from "./services/platform-admin.js";
import { registerPrivacy, registerSecurity } from "./services/security.js";
import { postcodeValid } from "./location.js";
import { registerGovernance } from "./services/governance.js";

export function createApp({ db, config, mail = createMail(config), pushTransport }) {
  const app = express(),
    repo = new Repository(db),
    files = createFiles(config, db);
  const ctx = { db, config, repo, mail, files };
  ctx.push=createMobilePush({db,transport:pushTransport});
  ctx.notifications=createInboxNotifications(ctx);
  ctx.auth = createAuth(ctx);
  const auth = ctx.auth;
  if (config.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin))
          callback(null, true);
        else
          callback(
            Object.assign(new Error("Origin is not allowed"), { status: 403 }),
          );
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use((req, res, next) => {
    req.body ??= {};
    res.set("Cache-Control", "no-store");
    next();
  });
  const health = async (req, res) => {
    await db.query("SELECT 1");
    return res.json({ status: "UP", service: "aniprotech-express" });
  };
  app.get("/api/health", health);
  app.get("/api/mobile/version", (req,res) => reply(res, {latestPublishedVersion:/^\d+\.\d+\.\d+$/.test(config.mobileLatestPublishedVersion||"")?config.mobileLatestPublishedVersion:""}));
  app.get("/health", health);
  app.get("/actuator/health", health);
  app.get("/api/ready", async (req, res, next) => {
    try {
      await db.query("SELECT 1");
      if (typeof mail.verify === "function" && !(await mail.verify()))
        return res.status(503).json({ status: "DOWN", service: "caremonitor-api", checks: { database: "UP", email: "DOWN" } });
      return res.json({ status: "UP", service: "caremonitor-api", checks: { database: "UP", email: "UP", storage: config.storageMode || "filesystem" } });
    } catch (error) { next(error); }
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res
        .status(429)
        .json({
          message: "Too many login attempts. Try again later.",
          error: true,
          code: 429,
          results: { data: {} },
        }),
  });
  app.post("/api/auth/request-link", authLimit, async (req, res) => {
    if(req.body.client !== undefined && !['web','mobile'].includes(req.body.client)) fail(400,'Invalid login client');
    await auth.requestLink(req.body.email, { mobile: req.body.client === 'mobile' });
    return reply(
      res,
      {},
      "If the account is eligible, a login link has been queued",
    );
  });
  app.post("/api/auth/get-token", authLimit, async (req, res) =>
    reply(
      res,
       await auth.exchange(req.body.email, req.body.password, {name:req.body.deviceName,ip:req.ip,userAgent:req.get("user-agent")}),
      "Login successful",
    ),
  );
  app.post("/api/auth/mfa/verify",authLimit,async(req,res)=>reply(res,await auth.completeMfa(req.body.challengeToken,req.body.code,{name:req.body.deviceName,ip:req.ip,userAgent:req.get("user-agent")}),"Login successful"));
  app.get("/api/auth/microsoft", (req, res) => {
    if (!config.microsoftTenantId || !config.microsoftClientId || !config.microsoftClientSecret)
      return res.redirect(`${config.frontendUrl}/login?authError=microsoft_not_configured`);
    const state = randomUUID();
    const authorize = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.microsoftTenantId)}/oauth2/v2.0/authorize`);
    authorize.searchParams.set("client_id", config.microsoftClientId);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("redirect_uri", config.microsoftRedirectUri);
    authorize.searchParams.set("response_mode", "query");
    authorize.searchParams.set("scope", "openid profile email User.Read");
    authorize.searchParams.set("state", state);
    res.cookie("microsoft_oauth_state", state, { httpOnly: true, secure: config.production, sameSite: "lax", maxAge: 600000 });
    return res.redirect(authorize.toString());
  });
  app.post("/api/auth/register-business", authLimit, async (req, res) => {
    const schema = z.object({
      firstName: z.string().trim().min(2).max(80),
      lastName: z.string().trim().min(2).max(80),
      email: z.email(),
      phone: z.string().trim().min(7).max(30),
      businessName: z.string().trim().min(2).max(160),
      legalName: z.string().trim().max(160).optional(),
      businessType: z.enum(["HOME_CARE", "LIVE_IN_CARE", "SUPPORTED_LIVING", "CARE_HOME", "OTHER"]),
      registrationNumber: z.string().trim().max(80).optional(),
      website: z.union([z.url(), z.literal("")]).optional(),
      addressLine1: z.string().trim().min(3).max(200),
      addressLine2: z.string().trim().max(200).optional(),
      state: z.string().trim().min(2).max(100),
      city: z.string().trim().min(2).max(100),
      postcode: z.string().trim().min(2).max(20),
      country: z.string().trim().min(2).max(80),
      timezone: z.string().trim().min(3).max(80),
      acceptTerms: z.literal(true),
    }).superRefine((value, issue) => {
      if (!postcodeValid(value.country, value.postcode)) issue.addIssue({ code:"custom", path:["postcode"], message:"Postcode format does not match the selected country" });
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message || "Registration details are invalid");
    const data = parsed.data, email = data.email.toLowerCase().trim();
    const created = await db.transaction(async () => {
      if ((await db.query("SELECT 1 FROM users WHERE lower(email)=$1", [email])).rows[0]) fail(409, "An account with this email already exists");
      const agencyId = randomUUID(), userId = randomUUID();
      await db.query(`INSERT INTO node_agencies(id,name,legal_name,business_type,registration_number,phone,website,address_line1,address_line2,state,city,postcode,country,timezone,status,terms_accepted_at,submitted_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [agencyId,data.businessName,data.legalName||null,data.businessType,data.registrationNumber||null,data.phone,data.website||null,data.addressLine1,data.addressLine2||null,data.state,data.city,data.postcode,data.country,data.timezone]);
      await repo.save("UserEntity", { id:userId, agencyId, firstName:data.firstName, lastName:data.lastName, email, primaryPhone:data.phone, role:"SUPERADMIN", isActive:false, createdBy:userId, updatedBy:userId });
      return { email, businessName:data.businessName };
    });
    await Promise.allSettled([
      mail.send({ to:email, subject:"Business application received", text:`Hello ${data.firstName},\n\nWe received the application for ${data.businessName}. A Caremonitor platform administrator will review it. We will email you when the organisation is approved and ready to access.` }),
      ...(config.platformAdminEmails || []).map((to) => mail.send({ to, subject:"New business awaiting approval", text:`${data.businessName} was submitted by ${data.firstName} ${data.lastName} (${email}). Review the application in the Caremonitor platform administration dashboard.`, actionUrl:`${config.frontendUrl}/admin/platform`, actionLabel:"Review business application" })),
    ]);
    return reply(res, created, "Business application submitted for approval.", 201);
  });
  app.get("/api/auth/microsoft/callback", async (req, res, next) => {
    try {
      const cookieState = req.headers.cookie?.match(/(?:^|; )microsoft_oauth_state=([^;]+)/)?.[1];
      if (!req.query.code || !req.query.state || req.query.state !== cookieState)
        return res.redirect(`${config.frontendUrl}/login?authError=microsoft_state`);
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.microsoftTenantId)}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: config.microsoftClientId, client_secret: config.microsoftClientSecret, code: String(req.query.code), redirect_uri: config.microsoftRedirectUri, grant_type: "authorization_code" }),
      });
      if (!tokenResponse.ok) throw new Error("Microsoft token exchange failed");
      const tokens = await tokenResponse.json();
      const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (!profileResponse.ok) throw new Error("Microsoft profile lookup failed");
      const profile = await profileResponse.json();
      const email = profile.mail || profile.userPrincipalName;
      const login = await auth.createLoginLink(email);
      if (!login) return res.redirect(`${config.frontendUrl}/login?authError=account_not_allowed`);
      return res.redirect(login.link.toString());
    } catch (error) {
      console.error("Microsoft sign-in failed", error);
      return res.redirect(`${config.frontendUrl}/login?authError=microsoft_failed`);
    }
  });
  app.get("/api/accounting/banking/salt-edge/callback", authLimit, saltEdgeCallback(ctx));
  app.get("/uploads/{*file}", files.download);
  app.use("/api/portal", createPortal(ctx));
  app.use("/api", auth.authenticate);
  app.post("/api/auth/validate-token", async (req, res) =>
    reply(
      res,
      {
        id: req.sessionId,
        user: auth.publicUser(req.user),
        token: await auth.renewSession(req.user, req.sessionId),
        isUsed: true,
      },
      "Token is valid",
    ),
  );
  app.post("/api/auth/logout", async (req, res) => {
    await db.query(
      "UPDATE node_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=$1",
      [req.sessionId],
    );
    return reply(res, {}, "Logged out");
  });
  app.use("/api", (req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json(files.signTree(body, req));
    next();
  });
  const routes = [];
  const route = (method, path, handler, options = {}) =>
    routes.push({ method, path, handler, options });
  for (const register of [
    registerAccount,
    registerSecurity,
    registerPrivacy,
    registerPlatformAdmin,
    registerUsers,
    registerClinicalCatalog,
    registerSharedOptions,
    registerClientFeed,
    registerCarePlans,
    registerTasks,
    registerTaskLibrary,
    registerMedication,
    registerTeam,
    registerAssignments,
    registerSettings,
    registerShareAccess,
    registerDocuments,
    registerRoster,
    registerVisitSchedule,
    registerTeamFeed,
    registerTeamActivity,
    registerTimeOff,
    registerInbox,
    registerActivity,
    registerCareLog,
    registerFinance,
    registerAccounting,
    registerInvoiceReconciliation,
    registerSaltEdgeBanking,
    registerFinanceReview,
    registerReporting,
    registerNotificationDelivery,
    registerMobileCare,
    registerMobilePush,
    registerGovernance,
  ])
    register(ctx, route);
  routes.sort(
    (a, b) =>
      a.path.split(":").length - b.path.split(":").length ||
      b.path.length - a.path.length,
  );
  const keys = new Set();
  for (const r of routes) {
    const key = r.method + " " + r.path;
    if (keys.has(key)) throw new Error("Duplicate route " + key);
    keys.add(key);
    const middleware = [];
    if (r.options.multipart) middleware.push(files.upload);
    middleware.push(async (req, res) => {
      for (const value of Object.values(req.params)) uuid(value);
      if (
        !["GET", "HEAD"].includes(req.method) &&
        !Array.isArray(req.body) &&
        (typeof req.body !== "object" || req.body === null)
      )
        fail(400, "An object request body is required");
      if (["GET", "HEAD"].includes(req.method)) return r.handler(req, res);
      // Publish success only after data changes and the audit entry commit together.
      const sendJson = res.json.bind(res);
      let pendingBody;
      res.json = (body) => {
        pendingBody = body;
        return res;
      };
      try {
        req.afterCommit = [];
        await db.transaction(async () => {
          await r.handler(req, res);
          await db.query(
            "INSERT INTO node_audit_log(id,actor_id,agency_id,method,path) VALUES($1,$2,$3,$4,$5)",
            [
              randomUUID(),
              req.user.id,
              req.user.agencyId,
              req.method,
              req.path,
            ],
          );
        });
        for (const work of req.afterCommit) await work().catch(() => console.error("Post-commit notification failed"));
      } finally {
        res.json = sendJson;
      }
      return res.json(pendingBody);
    });
    app[r.method.toLowerCase()](r.path, ...middleware);
  }
  app.use((req, res) =>
    res
      .status(404)
      .json({
        message: "Route not found",
        error: true,
        code: 404,
        results: { data: {} },
      }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500,
      message = error.status ? error.message : "Request could not be completed";
    if (error.code === "23505") {
      status = 409;
      message = "A record with this unique value already exists";
    } else if (error.code === "23503") {
      status = 400;
      message = "A referenced record does not exist";
    } else if (
      error.code === "22P02" ||
      error.code === "22007" ||
      error.code === "22008"
    ) {
      status = 400;
      message = "Invalid data format";
    } else if (error.code === "LIMIT_FILE_SIZE") {
      status = 413;
      message = "Each file must be 12 MB or smaller";
    } else if (error.code === "EMAIL_DELIVERY_FAILED") {
      status = 503;
      message = "Email delivery is temporarily unavailable";
    } else if (!error.status && error.code) {
      status = 500;
      message = "Database or file operation failed";
    }
    if (status >= 500)
      console.error(
        "Request failed:",
        error.code || error.name,
        error.providerStage || "",
        error.code === "EMAIL_DELIVERY_FAILED" ? error.status || "" : "",
        config.production ? "" : error.message,
      );
    return res
      .status(status)
      .json({ message, error: true, code: status, results: { data: {} } });
  });
  app.locals.routeInventory = [
    { method: "POST", path: "/api/auth/request-link" },
    { method: "POST", path: "/api/auth/get-token" },
    { method: "POST", path: "/api/auth/validate-token" },
    ...routes.map(({ method, path }) => ({ method, path })),
  ];
  app.locals.ctx = ctx;
  return app;
}
