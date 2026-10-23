import { randomUUID } from "node:crypto";
import { reply, fail, uuid } from "../http.js";
import { quote } from "../db.js";
import { occursOn } from "./roster.js";
import { visitEvent } from "../client-feed-schema.js";
const add = (d, n) =>
  new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const minute = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
function week(d) {
  if (
    typeof d !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
    isNaN(Date.parse(d)) ||
    add(d, 0) !== d
  )
    fail(400, "Choose a valid week");
  return d;
}
export function registerPlanning(ctx, route) {
  const { db, repo, auth, push, check, lock, get, select, input } = ctx;
  async function ownedRecords(name, ids) {
    const model = repo.model(name),
      user = model.fields.find((f) => f.name === "user");
    const raw = (
      await db.query(
        `SELECT * FROM ${quote(model.table)} WHERE ${quote(user.column)}=ANY($1::uuid[])`,
        [ids],
      )
    ).rows;
    const records = raw.map((row) =>
      Object.fromEntries(
        model.fields
          .filter((f) => !f.inverse && !f.collection)
          .map((f) => [f.name, repo.decode(f, row[f.column])]),
      ),
    );
    for (const f of model.fields.filter((f) => f.collection)) {
      const c = f.collection,
        values = (
          await db.query(
            `SELECT * FROM ${quote(c.table)} WHERE ${quote(c.owner)}=ANY($1::uuid[])`,
            [records.map((r) => r.id)],
          )
        ).rows;
      for (const r of records)
        r[f.name] = values
          .filter((v) => v[c.owner] === r.id)
          .map((v) => repo.decode(f, v[c.value]));
    }
    return records;
  }
  async function visits(req, from) {
    return (
      await db.query(
        select +
          " WHERE v.agency_id=$1 AND v.visit_date BETWEEN $2 AND $3 ORDER BY v.visit_date,v.start_time,v.id",
        [req.user.agencyId, from, add(from, 6)],
      )
    ).rows;
  }
  async function asset(req, id) {
    uuid(id);
    const a = (
      await db.query(
        "SELECT * FROM node_roster_assets WHERE id=$1 AND agency_id=$2",
        [id, req.user.agencyId],
      )
    ).rows[0];
    if (!a) fail(404, "Saved plan not found");
    return a;
  }
  route("GET", "/api/roster/board", async (req, res) => {
    const from = week(req.query.from),
      people = (
        await repo.find(
          "UserEntity",
          { agencyId: req.user.agencyId },
          { collections: false },
        )
      ).filter(
        (x) =>
          x.role !== "USER" &&
          x.isActive &&
          !x.deletedAt &&
          (req.user.role !== "CAREGIVER" || x.id === req.user.id),
      );
    const staff = [];
    const availabilityRows = await ownedRecords(
        "TeamAvailabilityEntity",
        people.map((p) => p.id),
      ),
      absenceRows = await ownedRecords(
        "TeamAbsenceEntity",
        people.map((p) => p.id),
      ),
      groupRows = (
        await db.query(
          "SELECT user_id,groups FROM node_team_groups WHERE user_id=ANY($1::uuid[])",
          [people.map((p) => p.id)],
        )
      ).rows;
    for (const p of people) {
      const availability = availabilityRows.filter(
          (x) => x.user === p.id && !x.deletedAt,
        ),
        absences = absenceRows.filter((x) => x.user === p.id && !x.deletedAt);
      const groups = groupRows.find((x) => x.user_id === p.id)?.groups || [];
      staff.push({
        id: p.id,
        name: [p.firstName, p.lastName].join(" "),
        groups,
        availabilityRecorded: availability.length > 0,
        days: Array.from({ length: 7 }, (_, i) => {
          const date = add(from, i);
          return {
            date,
            available: availability
              .filter((x) => occursOn(x, date))
              .map((x) => ({
                start: x.startTime.slice(0, 5),
                end: x.endTime.slice(0, 5),
              })),
            absent: absences
              .filter(
                (x) =>
                  x.startDate <= date && (x.endDate || x.startDate) >= date,
              )
              .map((x) => ({
                start:
                  x.startDate === date
                    ? (x.startTime || "00:00").slice(0, 5)
                    : "00:00",
                end:
                  (x.endDate || x.startDate) === date
                    ? (x.endTime || "24:00").slice(0, 5)
                    : "24:00",
              })),
          };
        }),
      });
    }
    const assets =
      req.user.role === "CAREGIVER"
        ? []
        : (
            await db.query(
              "SELECT id,kind,name,payload FROM node_roster_assets WHERE agency_id=$1 ORDER BY name",
              [req.user.agencyId],
            )
          ).rows;
    return reply(res, { staff, assets });
  });
  route("POST", "/api/roster/assets", async (req, res) => {
    auth.admin(req);
    const { name, kind } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !["TEMPLATE", "RUN"].includes(kind)
    )
      fail(400, "Enter a name and plan type");
    const rows = (await visits(req, week(req.body.from))).filter(
      (x) => x.status !== "CANCELLED",
    );
    let payload;
    if (kind === "TEMPLATE") {
      if (!rows.length || rows.length > 250)
        fail(400, "Save a week containing 1–250 visits");
      payload = rows.map((v) => ({
        clientId: v.clientId,
        staffId: v.staffId,
        offset: Math.round(
          (Date.parse(v.date) - Date.parse(req.body.from)) / 86400000,
        ),
        startTime: v.startTime,
        endTime: v.endTime,
        title: v.title,
        notes: v.notes,
      }));
    } else {
      const ids = req.body.visitIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 250 ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !rows.some((v) => v.id === id))
      )
        fail(400, "Select visits from the current week");
      payload = { visitIds: ids };
    }
    const id = randomUUID();
    await db.query(
      "INSERT INTO node_roster_assets(id,agency_id,kind,name,payload,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        req.user.agencyId,
        kind,
        name.trim(),
        JSON.stringify(payload),
        req.user.id,
      ],
    );
    return reply(res, { id }, "Saved", 201);
  });
  route("DELETE", "/api/roster/assets/:id", async (req, res) => {
    auth.admin(req);
    await asset(req, req.params.id);
    await db.query("DELETE FROM node_roster_assets WHERE id=$1", [
      req.params.id,
    ]);
    return reply(res, {}, "Saved plan removed; visits retained");
  });
  route("POST", "/api/roster/bulk-assign", async (req, res) => {
    auth.admin(req);
    const { visitIds, staffId } = req.body || {};
    if (!Array.isArray(visitIds) || !visitIds.length || visitIds.length > 100 || new Set(visitIds).size !== visitIds.length)
      fail(400, "Select between 1 and 100 visits");
    visitIds.forEach(uuid);
    uuid(staffId);
    await lock(req);
    const selected = (await db.query(
      select + " WHERE v.agency_id=$1 AND v.id=ANY($2::uuid[]) ORDER BY v.visit_date,v.start_time,v.id",
      [req.user.agencyId, visitIds],
    )).rows;
    if (selected.length !== visitIds.length) fail(404, "One or more selected visits were not found");
    if (selected.some((v) => v.staffId || !["DRAFT", "SCHEDULED"].includes(v.status)))
      fail(409, "Only unallocated draft or scheduled visits can be bulk assigned");

    // Validate everything before writing so a rejected bulk action cannot leave a
    // partially allocated rota behind.
    const proposed = selected.map((v) => ({ ...v, staffId, status: "SCHEDULED", repeatWeeks: 1 }));
    for (let i = 0; i < proposed.length; i += 1) {
      const v = proposed[i];
      for (let j = 0; j < i; j += 1) {
        const prior = proposed[j];
        if (prior.date === v.date && minute(prior.startTime) < minute(v.endTime) && minute(prior.endTime) > minute(v.startTime))
          fail(409, "Selected visits overlap each other; split the selection or choose another caregiver");
      }
      await check(req, v, v.id);
    }
    for (const v of proposed) {
      await db.query(
        "UPDATE node_roster_visits SET staff_id=$2,status='SCHEDULED',open_shift=false,revision=revision+1,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [v.id, staffId, req.user.id],
      );
      await visitEvent(db, v.id, req.user.id, "Bulk roster assignment applied");
    }
    const staff = await repo.one("UserEntity", { id: staffId });
    req.afterCommit.push(() => push?.sendToUsers?.(req.user.agencyId, [staffId], `You have ${proposed.length} newly assigned visit${proposed.length === 1 ? "" : "s"}. Open Caremonitor to view your rota.`));
    return reply(res, { count: proposed.length, staffName: staff ? [staff.firstName, staff.lastName].filter(Boolean).join(" ") : "Caregiver" }, "Bulk roster assignment applied");
  });
  route("POST", "/api/roster/planning/preview", async (req, res) => {
    auth.admin(req);
    const from = week(req.body.from),
      mode = req.body.mode,
      buffer = Number(req.body.buffer || 0);
    if (
      !["AUTO", "TEMPLATE"].includes(mode) ||
      !Number.isInteger(buffer) ||
      buffer < 0 ||
      buffer > 120
    )
      fail(400, "Choose a plan and travel buffer of 0–120 minutes");
    await lock(req);
    const existing = await visits(req, from),
      proposed = [],
      skipped = [];
    let targets;
    if (mode === "AUTO")
      targets = existing.filter((v) => !v.staffId && v.status === "DRAFT");
    else {
      const a = await asset(req, req.body.assetId);
      if (a.kind !== "TEMPLATE") fail(400, "Choose a template");
      targets = a.payload.map((x) => ({
        ...x,
        date: add(from, x.offset),
        status: "DRAFT",
        repeatWeeks: 1,
      }));
    }
    if (targets.length > 250) fail(400, "Plan up to 250 visits at a time");
    const people = (
      await repo.find(
        "UserEntity",
        { agencyId: req.user.agencyId },
        { collections: false },
      )
    ).filter((x) => x.role === "CAREGIVER" && x.isActive && !x.deletedAt);
    const links = (await repo.find("ClientCareTeamEntity")).filter(
      (x) =>
        !x.deletedAt &&
        !x.declineCarer &&
        !x.revokeViewaccess &&
        x.allowedToVisit,
    );
    const history = (
      await db.query(
        `SELECT client_id,staff_id,count(*)::int count FROM node_roster_visits WHERE agency_id=$1 AND status='COMPLETED' AND visit_date>=$2::date-90 AND visit_date<$2 GROUP BY client_id,staff_id`,
        [req.user.agencyId, from],
      )
    ).rows;
    const safeGap = (v, rows) =>
      !rows.some(
        (x) =>
          (!v.id || x.id !== v.id) &&
          x.status !== "CANCELLED" &&
          x.date === v.date &&
          ((x.clientId === v.clientId &&
            minute(x.startTime) < minute(v.endTime) &&
            minute(x.endTime) > minute(v.startTime)) ||
            (v.staffId &&
              x.staffId === v.staffId &&
              minute(x.startTime) <
                minute(v.endTime) + (x.clientId === v.clientId ? 0 : buffer) &&
              minute(x.endTime) >
                minute(v.startTime) -
                  (x.clientId === v.clientId ? 0 : buffer))),
      );
    for (const target of targets) {
      const candidates =
        mode === "TEMPLATE"
          ? target.staffId
            ? [{ id: target.staffId }]
            : []
          : people
              .filter((p) =>
                links.some(
                  (l) => l.client === target.clientId && l.carer === p.id,
                ),
              )
              .sort((a, b) => {
                const score = (p) =>
                  history.find(
                    (h) =>
                      h.client_id === target.clientId && h.staff_id === p.id,
                  )?.count || 0;
                const load = (p) =>
                  [...existing, ...proposed]
                    .filter((v) => v.staffId === p.id)
                    .reduce(
                      (n, v) => n + minute(v.endTime) - minute(v.startTime),
                      0,
                    );
                return (
                  score(b) - score(a) ||
                  load(a) - load(b) ||
                  a.id.localeCompare(b.id)
                );
              });
      let chosen = null;
      for (const p of candidates) {
        const v = {
          ...target,
          staffId: p.id,
          status: mode === "AUTO" ? "SCHEDULED" : "DRAFT",
          repeatWeeks: 1,
        };
        try {
          await check(req, v, target.id || null);
          if (safeGap(v, [...existing, ...proposed])) {
            chosen = {
              ...v,
              reason:
                mode === "AUTO"
                  ? "Eligible care-team member; continuity, then planned workload"
                  : "Template assignment available",
            };
            break;
          }
        } catch (e) {
          if (![400, 404, 409].includes(e.status || e.statusCode)) throw e;
        }
      }
      if (!chosen && mode === "TEMPLATE") {
        const v = { ...target, staffId: null, status: "DRAFT", repeatWeeks: 1 };
        try {
          await check(req, v);
          if (safeGap(v, [...existing, ...proposed]))
            chosen = {
              ...v,
              reason: "Created unallocated; template carer unavailable",
            };
        } catch (e) {
          if (![400, 404, 409].includes(e.status || e.statusCode)) throw e;
        }
      }
      if (chosen) proposed.push(chosen);
      else
        skipped.push({
          title: target.title,
          date: target.date,
          reason:
            mode === "AUTO"
              ? "No eligible carer meets care-team, availability, absence, overlap and travel-buffer checks"
              : "Client unavailable or overlapping visit",
        });
    }
    const id = randomUUID();
    await db.query(
      `INSERT INTO node_roster_previews(id,agency_id,actor_id,payload,expires_at) VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP+interval '10 minutes')`,
      [
        id,
        req.user.agencyId,
        req.user.id,
        JSON.stringify({ mode, buffer, proposed }),
      ],
    );
    const users = await repo.find(
      "UserEntity",
      { agencyId: req.user.agencyId },
      { collections: false },
    );
    const name = (id) => {
      const p = users.find((x) => x.id === id);
      return p ? [p.firstName, p.lastName].join(" ") : "Unallocated";
    };
    return reply(res, {
      id,
      proposed: proposed.map((x) => ({
        ...x,
        clientName: name(x.clientId),
        staffName: name(x.staffId),
      })),
      skipped,
      expiresInMinutes: 10,
    });
  });
  route("POST", "/api/roster/planning/apply", async (req, res) => {
    auth.admin(req);
    uuid(req.body.previewId);
    await lock(req);
    const preview = (
      await db.query(
        `SELECT * FROM node_roster_previews WHERE id=$1 AND agency_id=$2 AND actor_id=$3 AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP FOR UPDATE`,
        [req.body.previewId, req.user.agencyId, req.user.id],
      )
    ).rows[0];
    if (!preview)
      fail(409, "Preview expired or already applied. Preview again");
    const { proposed, mode, buffer } = preview.payload;
    if (!proposed.length) fail(400, "No changes to apply");
    for (const row of proposed) {
      const parsed = input.safeParse(row);
      if (!parsed.success) fail(400, "Invalid planned visit");
      const v = parsed.data;
      if (mode === "AUTO") {
        const old = await get(req, row.id);
        if (
          old.revision !== row.revision ||
          old.staffId ||
          old.status !== "DRAFT"
        )
          fail(409, "Visits changed; preview again");
        const link = await repo.one("ClientCareTeamEntity", {
          client: v.clientId,
          carer: v.staffId,
        });
        if (
          !link ||
          link.deletedAt ||
          link.declineCarer ||
          link.revokeViewaccess ||
          !link.allowedToVisit
        )
          fail(409, "Care-team eligibility changed; preview again");
      }
      await check(req, v, mode === "AUTO" ? row.id : null);
      if (v.staffId && buffer) {
        const adjacent = (
          await db.query(
            "SELECT id FROM node_roster_visits WHERE agency_id=$1 AND staff_id=$2 AND visit_date=$3 AND status<>'CANCELLED' AND client_id<>$4 AND ($5::uuid IS NULL OR id<>$5) AND visit_date + start_time < $3::date + $6::time + make_interval(mins=>$8::int) AND visit_date + end_time > $3::date + $7::time - make_interval(mins=>$8::int)",
            [
              req.user.agencyId,
              v.staffId,
              v.date,
              v.clientId,
              mode === "AUTO" ? row.id : null,
              v.endTime,
              v.startTime,
              buffer,
            ],
          )
        ).rows;
        if (adjacent.length)
          fail(409, "Travel buffer no longer fits; preview again");
      }
      const id = mode === "AUTO" ? row.id : randomUUID();
      if (mode === "AUTO")
        await db.query(
          `UPDATE node_roster_visits SET staff_id=$2,status='SCHEDULED',revision=revision+1,updated_by=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [id, v.staffId, req.user.id],
        );
      else
        await db.query(
          `INSERT INTO node_roster_visits(id,agency_id,client_id,staff_id,visit_date,start_time,end_time,title,notes,status,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT',$10,$10)`,
          [
            id,
            req.user.agencyId,
            v.clientId,
            v.staffId,
            v.date,
            v.startTime,
            v.endTime,
            v.title,
            v.notes,
            req.user.id,
          ],
        );
      await visitEvent(
        db,
        id,
        req.user.id,
        mode === "AUTO"
          ? "Assigned after reviewed roster suggestion"
          : "Draft created from reviewed rota template",
      );
    }
    await db.query(
      "UPDATE node_roster_previews SET used_at=CURRENT_TIMESTAMP WHERE id=$1",
      [preview.id],
    );
    return reply(res, { count: proposed.length }, "Plan applied");
  });
}
