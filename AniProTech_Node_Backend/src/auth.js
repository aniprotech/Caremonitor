import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { fail, requireValue, uuid, reply } from "./http.js";
import { decryptSecret, verifyTotp } from "./mfa.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
export function createAuth({ db, repo, config, mail }) {
  const isPlatformAdmin = (user) =>
    !!user && (config.platformAdminEmails || []).includes(String(user.email || "").toLowerCase());
  const publicUser = (user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    primaryPhone: user.primaryPhone,
    role: user.role,
    isActive: user.isActive,
    isPlatformAdmin: isPlatformAdmin(user),
  });
  async function createLoginLink(email, { mobile = false } = {}) {
    if (!z.email().safeParse(email).success)
      fail(400, "A valid email address is required");
    email = email.toLowerCase().trim();
    const row = (
      await db.query("SELECT id FROM users WHERE lower(email)=$1", [email])
    ).rows[0];
    const user = row ? await repo.get("UserEntity", row.id) : null;
    // Identical response for unknown and inactive users prevents account enumeration.
    if (
      !user ||
      !user.isActive ||
      !["ADMIN", "SUPERADMIN", "CAREGIVER"].includes(user.role)
    )
      return null;
    if (user.agencyId && !isPlatformAdmin(user)) {
      const agency = (await db.query("SELECT status FROM node_agencies WHERE id=$1", [user.agencyId])).rows[0];
      if (agency && agency.status !== "ACTIVE") return null;
    }
    const secret = randomBytes(32).toString("hex"),
      id = randomUUID();
    await db.query(
      "INSERT INTO node_login_links(id,user_id,secret_hash,expires_at) VALUES($1,$2,$3,$4)",
      [
        id,
        user.id,
        hash(secret),
        new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ],
    );
    const token = Buffer.from(`${email}:${secret}`).toString("base64url");
    const link = mobile ? new URL("aniprotech://login") : new URL("/login", config.frontendUrl);
    link.searchParams.set("token", token);
    return { link, user };
  }
  async function requestLink(email, { mobile = false } = {}) {
    const login = await createLoginLink(email, { mobile });
    if (!login) return;
    // Email clients commonly refuse custom-scheme anchors. Send a regular
    // HTTPS page that requires a user tap before handing the link to the app.
    // The fragment is not transmitted to the web server on page load.
    const emailLink = mobile
      ? new URL("/mobile-sign-in.html", config.frontendUrl)
      : login.link;
    if (mobile) emailLink.hash = new URLSearchParams({ token: login.link.searchParams.get("token") }).toString();
    await mail.send({
      to: login.user.email,
      subject: "Your secure sign-in link",
      text: `Use this one-time link within 15 minutes. For your security, the link can only be used once.\n${mobile ? "Open the page and tap Open Caremonitor to continue in the mobile app.\n" : ""}${emailLink}`,
      actionUrl: emailLink.toString(),
      actionLabel: "Sign in to Caremonitor",
    });
  }
  async function issueSession(user, device = {}, mfaVerified = false) {
    // Device sessions are intentionally long lived. Every request still checks the
    // database record so manual sign-out, device revocation, disabled users and
    // suspended organisations take effect immediately.
    const session = randomUUID(), expiresAt = new Date(Date.now() + 10 * 365 * 86400000).toISOString();
    await db.query(
      `INSERT INTO node_sessions(id,user_id,expires_at,device_name,ip_address,user_agent,mfa_verified_at)
       VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7 THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      [session,user.id,expiresAt,String(device.name||"Unknown device").slice(0,120),String(device.ip||"").slice(0,100)||null,String(device.userAgent||"").slice(0,500)||null,mfaVerified],
    );
    const accessToken = jwt.sign({ email:user.email,role:user.role },config.jwtSecret,{subject:user.id,jwtid:session,expiresIn:"3650d",issuer:"aniprotech",audience:"aniprotech-app",algorithm:"HS256"});
    return { user:publicUser(user),accessToken };
  }
  async function renewSession(user, sessionId) {
    const expiresAt = new Date(Date.now() + 10 * 365 * 86400000).toISOString();
    await db.query("UPDATE node_sessions SET expires_at=$2,last_seen_at=CURRENT_TIMESTAMP WHERE id=$1 AND revoked_at IS NULL", [sessionId, expiresAt]);
    return jwt.sign({ email:user.email,role:user.role },config.jwtSecret,{subject:user.id,jwtid:sessionId,expiresIn:"3650d",issuer:"aniprotech",audience:"aniprotech-app",algorithm:"HS256"});
  }
  async function exchange(email, password, device = {}) {
    if (
      !z.email().safeParse(email).success ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 512
    )
      fail(400, "Email and login token are required");
    const normalizedEmail = email.toLowerCase().trim();
    // Google Play reviewers cannot use an email inbox, OTP, or second device.
    // This is deliberately limited to one environment-configured review account;
    // ordinary Caremonitor users continue using one-time email links.
    const configuredReviewEmail = config.playReviewEmail || "";
    const configuredReviewPassword = config.playReviewPassword || "";
    const suppliedPassword = Buffer.from(password);
    const configuredPassword = Buffer.from(configuredReviewPassword);
    const reviewPasswordMatches = configuredPassword.length > 0 &&
      suppliedPassword.length === configuredPassword.length &&
      timingSafeEqual(suppliedPassword, configuredPassword);
    if (configuredReviewEmail && normalizedEmail === configuredReviewEmail && reviewPasswordMatches) {
      const row = (await db.query("SELECT id FROM users WHERE lower(email)=$1", [configuredReviewEmail])).rows[0];
      const user = row ? await repo.get("UserEntity", row.id) : null;
      if (!user || !user.isActive || !["ADMIN", "SUPERADMIN", "CAREGIVER"].includes(user.role))
        fail(401, "Review account is not available");
      if (user.agencyId && !isPlatformAdmin(user)) {
        const agency = (await db.query("SELECT status FROM node_agencies WHERE id=$1", [user.agencyId])).rows[0];
        if (agency && agency.status !== "ACTIVE") fail(403, "Review organisation is not active");
      }
      return issueSession(user, device, true);
    }
    return db.transaction(async () => {
      const { rows } = await db.query(
        "SELECT l.*,u.id AS uid FROM node_login_links l JOIN users u ON u.id=l.user_id WHERE lower(u.email)=$1 AND l.secret_hash=$2 AND l.used_at IS NULL AND l.expires_at>CURRENT_TIMESTAMP FOR UPDATE",
        [normalizedEmail, hash(password)],
      );
      if (!rows[0]) fail(401, "Invalid, expired or already used login link");
      const user = await repo.get("UserEntity", rows[0].uid);
      if (
        !user.isActive ||
        !["ADMIN", "SUPERADMIN", "CAREGIVER"].includes(user.role)
      )
        fail(401, "Account cannot sign in");
      if (user.agencyId && !isPlatformAdmin(user)) {
        const agency = (await db.query("SELECT status FROM node_agencies WHERE id=$1", [user.agencyId])).rows[0];
        if (agency && agency.status !== "ACTIVE") fail(403, "Organisation approval is required before sign in");
      }
      await db.query(
        "UPDATE node_login_links SET used_at=CURRENT_TIMESTAMP WHERE id=$1",
        [rows[0].id],
      );
      const mfa=(await db.query("SELECT enabled FROM node_mfa_settings WHERE user_id=$1",[user.id])).rows[0];
      if(mfa?.enabled){const challengeToken=jwt.sign({purpose:"mfa-login",device},config.jwtSecret,{subject:user.id,expiresIn:"5m",issuer:"aniprotech",audience:"aniprotech-mfa",algorithm:"HS256"});return {mfaRequired:true,challengeToken};}
      return issueSession(user,device,false);
    });
  }
  async function completeMfa(challengeToken,code,device={}){
    let claims;try{claims=jwt.verify(challengeToken,config.jwtSecret,{algorithms:["HS256"],issuer:"aniprotech",audience:"aniprotech-mfa"});}catch{fail(401,"MFA challenge expired. Request a new sign-in link");}
    if(claims.purpose!=="mfa-login")fail(401,"Invalid MFA challenge");
    const row=(await db.query("SELECT secret_cipher,enabled FROM node_mfa_settings WHERE user_id=$1",[claims.sub])).rows[0];
    if(!row?.enabled||!verifyTotp(decryptSecret(row.secret_cipher,config.mfaEncryptionKey||config.jwtSecret),code))fail(401,"Invalid authentication code");
    const user=await repo.get("UserEntity",claims.sub);if(!user?.isActive)fail(401,"Account cannot sign in");
    return issueSession(user,{...(claims.device||{}),...device},true);
  }
  async function authenticate(req, res, next) {
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) fail(401, "Authorization token is required");
      let claims;
      try {
        claims = jwt.verify(token, config.jwtSecret, {
          algorithms: ["HS256"],
          issuer: "aniprotech",
          audience: "aniprotech-app",
        });
      } catch {
        fail(401, "Invalid or expired token");
      }
      const session = (
        await db.query(
          "SELECT id FROM node_sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP",
          [claims.jti, claims.sub],
        )
      ).rows[0];
      if (!session) fail(401, "Session expired or revoked");
      const user = await repo.get("UserEntity", claims.sub);
      if (!user?.isActive) fail(401, "Account is inactive");
      if (!["ADMIN", "SUPERADMIN", "CAREGIVER"].includes(user.role))
        fail(403, "Access denied");
      if (user.agencyId && !isPlatformAdmin(user)) {
        const agency = (await db.query("SELECT status FROM node_agencies WHERE id=$1", [user.agencyId])).rows[0];
        if (agency && agency.status !== "ACTIVE") fail(403, "Organisation access is not active");
      }
      req.user = user;
      req.sessionId = claims.jti;
      req.accessToken = token;
      await db.query("UPDATE node_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=$1",[claims.jti]);
      next();
    } catch (error) {
      next(error);
    }
  }
  async function userAccess(req, id, { staff = false, write = false } = {}) {
    uuid(id);
    const user = requireValue(
      await repo.get("UserEntity", id),
      "User not found",
    );
    if (!req.user.agencyId || req.user.agencyId !== user.agencyId)
      fail(404, "User not found");
    if (staff && user.role === "USER") fail(404, "Team member not found");
    if (write && req.user.role === "CAREGIVER")
      fail(403, "Administrator access required");
    if (req.user.role === "CAREGIVER" && user.id !== req.user.id) {
      if (user.role !== "USER") fail(403, "Access denied");
      const assignment = await repo.one("ClientCareTeamEntity", {
        carer: req.user.id,
        client: id,
      });
      const careTeamAccess = assignment && !assignment.deletedAt && assignment.viewAccess &&
        !assignment.revokeViewaccess && !assignment.declineCarer;
      const explicitlyRevoked = assignment && !assignment.deletedAt &&
        (!assignment.viewAccess || assignment.revokeViewaccess || assignment.declineCarer);
      const rosterAccess = !careTeamAccess && !explicitlyRevoked && (await db.query(
        `SELECT id FROM node_roster_visits WHERE agency_id=$1 AND client_id=$2 AND staff_id=$3
         AND status IN ('SCHEDULED','IN_PROGRESS','COMPLETED')
         AND visit_date BETWEEN ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date-30)
           AND ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date+6) LIMIT 1`,
        [req.user.agencyId, id, req.user.id],
      )).rows.length > 0;
      if (!careTeamAccess && !rosterAccess) fail(403, "Client is not assigned to this carer");
    }
    return user;
  }
  function admin(req) {
    if (!["ADMIN", "SUPERADMIN"].includes(req.user.role))
      fail(403, "Administrator access required");
  }
  function platformAdmin(req) {
    if (!isPlatformAdmin(req.user)) fail(403, "Caremonitor platform administrator access required");
  }
  async function requireRecent(req){const row=(await db.query("SELECT id FROM node_sessions WHERE id=$1 AND COALESCE(mfa_verified_at,created_at)>=CURRENT_TIMESTAMP-interval '10 minutes'",[req.sessionId])).rows[0];if(!row)fail(403,"Confirm your identity again before this sensitive action");}
  async function reset(id) {
    await db.transaction(async () => {
      await db.query(
        "UPDATE node_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=$1",
        [id],
      );
      await db.query(
        "UPDATE node_login_links SET used_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND used_at IS NULL",
        [id],
      );
    });
  }
  return {
    requestLink,
    createLoginLink,
    exchange,
    completeMfa,
    issueSession,
    renewSession,
    authenticate,
    userAccess,
    admin,
    platformAdmin,
    isPlatformAdmin,
    reset,
    requireRecent,
    publicUser,
  };
}
