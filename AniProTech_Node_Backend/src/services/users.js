import { z } from "zod";
import { reply, fail, requireValue, pagination, dates } from "../http.js";
import { parseJson, replaceChildren, singleton } from "./common.js";
import { normaliseNhsNumber } from "../nhs-number.js";

export function registerUsers(ctx, route) {
  const { repo, db, auth, files } = ctx;
  async function inviteCaregiver(user, subject = "Your caregiver account is ready") {
    if (!user.isActive || user.role !== "CAREGIVER") return;
    const login = await auth.createLoginLink(user.email);
    if (!login) return;
    const webUrl = login.link.toString();
    const mobileUrl = new URL("/mobile-sign-in.html", ctx.config.frontendUrl);
    mobileUrl.hash = new URLSearchParams({ token: login.link.searchParams.get("token") }).toString();
    await ctx.mail.send({
      to: user.email,
      subject,
      text: `Hello ${user.firstName},\n\nYour organisation has invited you to Caremonitor. Use one of these secure, one-time links within 15 minutes.\n\nOn your phone, open ${mobileUrl}\nOn a computer, open ${webUrl}\n\nAfter the link expires, request a new sign-in link in the app or on the login page. Client records appear only after your organisation grants access.`,
      actionUrl: mobileUrl.toString(),
      actionLabel: "Open Caremonitor on your phone",
    });
  }
  async function detail(req, id) {
    const user = await auth.userAccess(req, id);
    const result = await repo.serialize("UserEntity", user, { children: true });
    if (user.role !== "USER") {
      const row = (
        await db.query("SELECT groups FROM node_team_groups WHERE user_id=$1", [
          id,
        ])
      ).rows[0];
      result.groups = (row?.groups || []).join(", ");
    }
    return result;
  }
  async function list(req, client) {
    const { size, offset } = pagination(req.body);
    let users = await repo.find("UserEntity", { agencyId: req.user.agencyId });
    users = users.filter(
      (u) => !u.deletedAt && (client ? u.role === "USER" : u.role !== "USER"),
    );
    if (req.user.role === "CAREGIVER") {
      const links = await repo.find("ClientCareTeamEntity", {
        carer: req.user.id,
      });
      const ids = new Set(
        links
          .filter(
            (l) =>
              l.viewAccess &&
              !l.revokeViewaccess &&
              !l.declineCarer &&
              !l.deletedAt,
          )
          .map((l) => l.client),
      );
      if (client) {
        const revoked = new Set(links.filter((l) => !l.deletedAt &&
          (!l.viewAccess || l.revokeViewaccess || l.declineCarer)).map((l) => l.client));
        const assigned = (await db.query(
          `SELECT DISTINCT client_id FROM node_roster_visits WHERE agency_id=$1 AND staff_id=$2
           AND status IN ('SCHEDULED','IN_PROGRESS','COMPLETED')
           AND visit_date BETWEEN ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date-30)
             AND ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::date+6)`,
          [req.user.agencyId, req.user.id],
        )).rows;
        for (const row of assigned) if (!revoked.has(row.client_id)) ids.add(row.client_id);
      }
      users = users.filter((u) =>
        client ? ids.has(u.id) : u.id === req.user.id,
      );
    }
    const search = String(req.body.search || "")
      .trim()
      .toLowerCase();
    users = users.filter((u) =>
      [u.firstName, u.lastName, u.email].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(search),
      ),
    );
    const result = [];
    for (const user of users) {
      const info = client
        ? await repo.one("ClientInformationEntity", { user: user.id })
        : null;
      const now = new Date().toISOString().slice(0, 19);
      const inactive = client
        ? (await repo.find("ClientInactivityEntity", { user: user.id })).find(
            (i) =>
              !i.deletedAt &&
              i.startDate &&
              `${i.startDate}T${i.startTime || "00:00:00"}` <= now &&
              (i.type === "PERMANENT" ||
                !i.endDate ||
                `${i.endDate}T${i.endTime || "23:59:59"}` >= now),
          )
        : null;
      const isActive = !!user.isActive && !inactive;
      if (
        typeof req.body.isActive === "boolean" &&
        isActive !== req.body.isActive
      )
        continue;
      if (client && req.body.status === "Active" && !isActive) continue;
      if (
        client &&
        req.body.status === "Temporary_Inactive" &&
        inactive?.type !== "TEMPORARY"
      )
        continue;
      if (
        client &&
        req.body.status === "Permanent_Inactive" &&
        inactive?.type !== "PERMANENT"
      )
        continue;
      result.push({
        ...auth.publicUser(user),
        isActive,
        ...(client
          ? {
              overallRiskLevel: info?.overallRiskLevel ?? null,
              reason: inactive?.reason ?? null,
            }
          : {}),
      });
    }
    return {
      totalCount: result.length,
      users: result.slice(offset, offset + size),
    };
  }
  async function saveUser(req, client, id) {
    auth.admin(req);
    const body = req.body,
      old = id ? await auth.userAccess(req, id, { write: true }) : null;
    if (old?.role === "SUPERADMIN" && req.user.role !== "SUPERADMIN")
      fail(403, "Cannot change a super administrator");
    const email = body.email?.trim().toLowerCase() || old?.email;
    if (!z.email().safeParse(email).success)
      fail(400, "A valid email is required");
    if (
      !String(body.firstName ?? old?.firstName ?? "").trim() ||
      !String(body.lastName ?? old?.lastName ?? "").trim()
    )
      fail(400, "First name and last name are required");
    const role = client ? "USER" : body.role || old?.role || "CAREGIVER";
    if (
      !["USER", "CAREGIVER", "ADMIN", "SUPERADMIN"].includes(role) ||
      (!client && role === "USER")
    )
      fail(400, "Invalid role");
    if (role === "SUPERADMIN" && req.user.role !== "SUPERADMIN")
      fail(403, "Cannot grant super administrator access");
    if (
      old?.id === req.user.id &&
      (body.isActive === false || role !== old.role)
    )
      fail(
        400,
        "You cannot deactivate your own account or change your own role",
      );
    if(body.dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) || isNaN(Date.parse(body.dateOfBirth)) || new Date(body.dateOfBirth).toISOString().slice(0,10)!==body.dateOfBirth || body.dateOfBirth>new Date().toISOString().slice(0,10))) fail(400,"Enter a valid date of birth in the past");
    for(const name of ['primaryPhone','secondaryPhone']) if(body[name] && !/^[+\d ()-]{5,25}$/.test(body[name])) fail(400,"Enter a valid phone number");
    const addresses = parseJson(body.addresses, undefined);
    if(addresses !== undefined) {
      if(!Array.isArray(addresses)||addresses.length>20) fail(400,"Provide up to 20 addresses");
      for(const a of addresses){
        if(a.latitude!=null && a.latitude!=='' && (!Number.isFinite(Number(a.latitude))||Number(a.latitude)<-90||Number(a.latitude)>90))fail(400,"Latitude must be between -90 and 90");
        if(a.longitude!=null && a.longitude!=='' && (!Number.isFinite(Number(a.longitude))||Number(a.longitude)<-180||Number(a.longitude)>180))fail(400,"Longitude must be between -180 and 180");
        if(a.checkinRadius!=null && a.checkinRadius!=='' && (!Number.isInteger(Number(a.checkinRadius))||Number(a.checkinRadius)<10||Number(a.checkinRadius)>5000))fail(400,"Check-in radius must be 10 to 5,000 metres");
      }
    }
    dates(body);
    return db.transaction(async () => {
      const data = {
        ...repo.input("UserEntity", body),
        id: old?.id,
        role,
        email,
        agencyId: req.user.agencyId,
        isActive: body.isActive ?? old?.isActive ?? true,
        createdBy: old?.createdBy || req.user.id,
        updatedBy: req.user.id,
      };
      const photo = req.files?.find((f) => f.fieldname === "profileImage");
      if (photo) data.profileImagePath = (await files.save(photo)).url;
      if (parseJson(body.filesToRemove, []).includes("profileImage"))
        data.profileImagePath = null;
      const user = await repo.save("UserEntity", data);
      await replaceChildren(
        repo,
        "UserPrimaryAddressEntity",
        "user",
        user.id,
        parseJson(body.addresses, undefined),
        req,
      );
      await replaceChildren(
        repo,
        "UserKeyContactEntity",
        "user",
        user.id,
        parseJson(body.keyContacts, undefined),
        req,
      );
      if (body.termination !== undefined) {
        const oldTermination = await repo.one("UserTerminationEntity", {
          user: user.id,
        });
        if (body.termination === null) {
          if (oldTermination)
            await repo.remove("UserTerminationEntity", oldTermination.id);
        } else
          await repo.save("UserTerminationEntity", {
            ...repo.input("UserTerminationEntity", body.termination),
            id: oldTermination?.id,
            user: user.id,
            createdBy: req.user.id,
            updatedBy: req.user.id,
          });
      }
      if (old && (!user.isActive || old.role !== user.role))
        await auth.reset(user.id);
      if (!client && user.role === "CAREGIVER" && user.isActive && (!old || !old.isActive || old.role !== "CAREGIVER" || old.email !== user.email))
        req.afterCommit.push(() => inviteCaregiver(user));
      return detail(req, user.id);
    });
  }
  route("POST", "/api/team/get-all-users", async (req, res) =>
    reply(res, await list(req, false)),
  );
  route("GET", "/api/team/get-user/:id", async (req, res) =>
    reply(res, await detail(req, req.params.id)),
  );
  route("POST", "/api/team/create-user", async (req, res) =>
    reply(res, await saveUser(req, false), "User created successfully", 201),
  );
  route("PUT", "/api/team/update-user/:userId", async (req, res) =>
    reply(
      res,
      await saveUser(req, false, req.params.userId),
      "User updated successfully",
    ),
  );
  route("POST", "/api/client/get-all-clients", async (req, res) =>
    reply(res, await list(req, true)),
  );
  route("GET", "/api/client/get-client/:id", async (req, res) =>
    reply(res, await detail(req, req.params.id)),
  );
  route(
    "POST",
    "/api/client/create",
    async (req, res) =>
      reply(
        res,
        await saveUser(req, true, req.body.id || undefined),
        "Client saved successfully",
      ),
    { multipart: true },
  );
  route("POST", "/api/team/reset/:userId", async (req, res) => {
    auth.admin(req);
    await auth.userAccess(req, req.params.userId);
    await auth.reset(req.params.userId);
    return reply(res, {}, "Tokens reset");
  });
  route("POST", "/api/team/invite/:userId", async (req, res) => {
    auth.admin(req);
    const user = await auth.userAccess(req, req.params.userId);
    if (user.role !== "CAREGIVER" || !user.isActive) fail(400, "An active caregiver is required");
    await inviteCaregiver(user, "Your Caremonitor invitation");
    return reply(res, {}, "Invitation sent");
  });
  route("GET", "/api/client-information/:userId", async (req, res) => {
    const row = await singleton(
      ctx,
      req,
      "ClientInformationEntity",
      req.params.userId,
    );
    return reply(
      res,
      row
        ? await repo.serialize("ClientInformationEntity", row, {
            children: true,
          })
        : {},
    );
  });
  route("POST", "/api/client-information/update/:userId", async (req, res) =>
    db.transaction(async () => {
      if (req.body?.nhsNumber !== undefined && req.body.nhsNumber !== null && String(req.body.nhsNumber).trim() !== "") {
        const valid = normaliseNhsNumber(req.body.nhsNumber);
        if (!valid) fail(400, "Enter a valid 10-digit NHS number with a correct check digit");
        req.body.nhsNumber = valid;
      }
      const row = await singleton(
        ctx,
        req,
        "ClientInformationEntity",
        req.params.userId,
        req.body,
      );
      for (const [field, name] of Object.entries({
        clientEmergencyContacts: "ClientEmergencyContactsEntity",
        clientProfessionals: "ClientProfessionalsEntity",
        clientInactivity: "ClientInactivityEntity",
      }))
        await replaceChildren(
          repo,
          name,
          "clientInformation",
          row.id,
          req.body[field],
          req,
          { user: req.params.userId },
        );
      return reply(
        res,
        await repo.serialize("ClientInformationEntity", row, {
          children: true,
        }),
      );
    }),
  );
}
