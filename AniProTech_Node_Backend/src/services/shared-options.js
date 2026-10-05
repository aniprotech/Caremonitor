import { randomUUID } from "node:crypto";
import { fail, reply } from "../http.js";

export const sharedOptionKinds = new Set(["ethnicity", "religion", "sexual_orientation", "gender", "history", "medicine", "hospital"]);

export function normaliseSharedOption(input) {
  const name = String(input ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120 || /[<>@\r\n\t]/.test(name) || /(?:https?:\/\/|www\.)/i.test(name) || /^\+?\d[\d ()-]{7,}$/.test(name))
    fail(400, "Enter an option name of 2–120 characters without contact details or a URL");
  return name;
}

export async function addSharedOption(db, req, kind, input) {
  const name = normaliseSharedOption(input);
  const inserted = (await db.query(`INSERT INTO node_shared_catalog_options
    (id,kind,name,source_agency_id,created_by) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT DO NOTHING RETURNING name`,
  [randomUUID(), kind, name, req.user.agencyId, req.user.id])).rows[0];
  const existing = inserted || (await db.query(`SELECT name FROM node_shared_catalog_options
    WHERE kind=$1 AND lower(name)=lower($2)`, [kind, name])).rows[0];
  return { name: existing?.name || name, added: !!inserted };
}

export function registerSharedOptions({ db, auth }, route) {
  route("GET", "/api/onboarding-options", async (req, res) => {
    if (!req.user.agencyId) fail(403, "Organisation required");
    const kind = String(req.query.kind || "");
    if (!sharedOptionKinds.has(kind)) fail(400, "Unknown option list");
    const rows = (await db.query(`SELECT name FROM node_shared_catalog_options
      WHERE kind=$1 ORDER BY name LIMIT 500`, [kind])).rows;
    return reply(res, { options: rows.map(row => row.name) });
  });
  route("POST", "/api/onboarding-options", async (req, res) => {
    auth.admin(req);
    if (!req.user.agencyId) fail(403, "Organisation required");
    const kind = String(req.body?.kind || "");
    if (!sharedOptionKinds.has(kind)) fail(400, "Unknown option list");
    const result = await addSharedOption(db, req, kind, req.body?.name);
    return reply(res, { name: result.name }, result.added ? "Shared option added" : "Option already available", result.added ? 201 : 200);
  });
}
