import { randomUUID } from "node:crypto";
import { reply, fail } from "../http.js";
import { searchDmdMedicines } from "./nhs-terminology.js";
import { addSharedOption } from "./shared-options.js";

const kinds = new Set(["history", "medicine", "hospital"]);
const builtInHistory = ["Spinal cord injury", "Cervical spinal cord injury", "Thoracic spinal cord injury", "Lumbar spinal cord injury", "Paraplegia", "Tetraplegia", "Stroke", "Dementia", "Diabetes", "Epilepsy", "Parkinson's disease", "Chronic obstructive pulmonary disease", "Heart failure", "Falls risk", "Pressure injury"];

const scottishHospitalsResource = "c698f450-eeed-41a0-88f7-c1e40a568acc";
const hospitalSiteRoles = "RO198,RO149,RO176,RO150";
// Public hospital entries from the HSCNI Service Finder; update when its directory changes.
const northernIrelandHospitals = [
  ["Altnagelvin Hospital", "BT47 6SB"], ["South West Acute Hospital", "BT74 6DN"],
  ["Lakeview Hospital", "BT47 6WJ"], ["Grangewood", "BT47 1TF"],
  ["Waterside Hospital", "BT47 6WH"], ["Tyrone and Fermanagh Hospital", "BT79 0NS"],
  ["Craigavon Area Hospital", "BT63 5QQ"], ["Daisy Hill Hospital", "BT35 8DR"],
  ["Royal Victoria Hospital", "BT12 6BA"], ["Royal Jubilee Maternity Service", "BT12 6BA"],
  ["Royal Belfast Hospital for Sick Children", "BT12 6BA"], ["Belfast City Hospital", "BT9 7AB"],
  ["Mater Hospital", "BT14 6AB"], ["Musgrave Park Hospital", "BT9 7JB"],
  ["Knockbracken Healthcare Park", "BT8 8BH"], ["Muckamore Abbey Hospital", "BT41 4SH"],
  ["Antrim Area Hospital", "BT41 2RL"], ["Braid Valley Hospital", "BT43 6HL"],
  ["Causeway Hospital", "BT52 1HS"], ["Dalriada Hospital", "BT54 6EY"],
  ["Holywell Hospital", "BT41 2RJ"], ["Mid Ulster Hospital", "BT45 5EX"],
  ["Moyle Hospital", "BT40 1RP"], ["Robinson Hospital", "BT53 6HB"],
  ["Whiteabbey Hospital", "BT37 9RH"], ["Ulster Hospital", "BT16 1RH"],
  ["Lagan Valley Hospital", "BT28 1JP"], ["Downe Hospital", "BT30 6RL"],
  ["Ards Community Hospital", "BT23 4AS"], ["Downshire Hospital", "BT30 6RL"],
  ["Bangor Community Hospital", "BT20 4TA"], ["South Tyrone Hospital", "BT71 4AU"],
];

export function searchNorthernIrelandHospitals(query) {
  return northernIrelandHospitals.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
    .map(([name, postcode]) => ({ name, source: "HSCNI directory", postcode }));
}

export async function searchOdsHospitals(query) {
  const url = new URL("https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations");
  url.searchParams.set("Name", query);
  url.searchParams.set("Status", "Active");
  url.searchParams.set("Roles", hospitalSiteRoles);
  url.searchParams.set("Limit", "100");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error("ODS search unavailable");
  const payload = await response.json();
  return (payload.Organisations || []).filter(record => record.Name && record.OrgId).map(record => ({
    name: record.Name, source: "NHS ODS site", code: record.OrgId, postcode: record.PostCode,
  }));
}

export async function searchScottishHospitals(query) {
  const url = new URL("https://www.opendata.nhs.scot/api/3/action/datastore_search");
  url.searchParams.set("resource_id", scottishHospitalsResource);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error("Scottish hospital search unavailable");
  const payload = await response.json();
  if (payload.success !== true) throw new Error("Scottish hospital search unavailable");
  return (payload.result?.records || [])
    .filter(record => record.HospitalName?.toLowerCase().includes(query.toLowerCase()))
    .map(record => ({ name: record.HospitalName, source: "NHS Scotland", code: record.HospitalCode, postcode: record.Postcode }));
}

export function registerClinicalCatalog({ db, auth }, route) {
  route("GET", "/api/clinical-catalog", async (req, res) => {
    const kind = req.query.kind;
    if (!kinds.has(kind)) fail(400, "Unknown clinical list");
    if (!req.user.agencyId) fail(403, "Organisation required");
    const query = String(req.query.q || "").trim();
    if (query.length > 100) fail(400, "Search is too long");
    const localLimit = kind === "history" ? 40 : 10;
    const rows = (await db.query(
      "SELECT name FROM node_clinical_terms WHERE agency_id=$1 AND kind=$2 AND ($3='' OR name ILIKE '%' || $3 || '%') ORDER BY name LIMIT $4",
      [req.user.agencyId, kind, query, localLimit],
    )).rows;
    const shared = (await db.query(`SELECT name FROM node_shared_catalog_options
      WHERE kind=$1 AND ($2='' OR name ILIKE '%' || $2 || '%') ORDER BY name LIMIT 40`, [kind, query])).rows;
    const reference = query.length >= 2 ? (await db.query(`SELECT name,code,source,country,postcode,concept_type AS "conceptType",release FROM node_reference_terms WHERE kind=$1 AND name ILIKE '%' || $2 || '%' ORDER BY name LIMIT 30`,[kind,query])).rows : [];
    const warnings = [];
    const choices = [...reference, ...shared.map(row => ({ name: row.name, source: "Shared option" }))];
    for (const row of rows) if (!choices.some(choice => choice.name.toLowerCase() === row.name.toLowerCase()))
      choices.push({ name: row.name, source: "Organisation" });
    if (kind === "history") for (const name of builtInHistory) if ((name.toLowerCase().includes(query.toLowerCase()) || (/spinal\s+injury/i.test(query) && /spinal cord injury/i.test(name))) && !choices.some(c => c.name.toLowerCase() === name.toLowerCase())) choices.push({ name, source: "Common term" });
    if (kind === "hospital" && query.length >= 3) {
      const results = await Promise.allSettled([searchOdsHospitals(query), searchScottishHospitals(query)]);
      for (const record of searchNorthernIrelandHospitals(query).slice(0, 9)) {
        if (!choices.some(choice => choice.name.toLowerCase() === record.name.toLowerCase() && choice.postcode === record.postcode)) choices.push(record);
      }
      for (const [index, result] of results.entries()) {
        if (result.status !== "fulfilled") {
          warnings.push(`${index === 0 ? "NHS ODS" : "NHS Scotland"} search is unavailable. Results are incomplete.`);
          continue;
        }
        const records = index === 0 ? result.value.sort((a, b) => Number(/hospital|infirmary|medical centre|clinic/i.test(b.name)) - Number(/hospital|infirmary|medical centre|clinic/i.test(a.name))).slice(0, 12) : result.value.slice(0, 9);
        for (const record of records) {
          if (choices.some(choice => choice.name.toLowerCase() === record.name.toLowerCase() && choice.postcode === record.postcode)) continue;
          choices.push(record);
        }
      }
    }
    if (kind === "medicine" && query.length >= 2) {
      if (!process.env.NHS_TERMINOLOGY_CLIENT_ID || !process.env.NHS_TERMINOLOGY_CLIENT_SECRET)
        warnings.push("NHS medicine search is not configured. Only locally entered options are shown.");
      try {
        for (const term of await searchDmdMedicines(query)) {
          if (!choices.some(choice => choice.name.toLowerCase() === term.name.toLowerCase())) choices.push(term);
        }
      } catch { warnings.push("NHS medicine search is unavailable. Only locally entered options are shown."); }
    }
    return reply(res, { terms: choices.slice(0, 40), warnings,
      coverageNote: kind === "hospital" ? "Search results are limited and are not a complete UK hospital directory. Northern Ireland entries are maintained locally." : null });
  });
  route("POST", "/api/clinical-catalog", async (req, res) => {
    const kind = req.body?.kind;
    if (!kinds.has(kind)) fail(400, "Unknown clinical list");
    if (!req.user.agencyId) fail(403, "Organisation required");
    const name = String(req.body?.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 120 || /[<>]/.test(name)) fail(400, "Enter a name of 2–120 characters");
    if (["ADMIN", "SUPERADMIN"].includes(req.user.role)) {
      auth.admin(req);
      const result = await addSharedOption(db, req, kind, name);
      return reply(res, { name: result.name, source: "Shared option" }, result.added ? "Shared term added" : "Term already available", result.added ? 201 : 200);
    }
    const row = (await db.query(
      "INSERT INTO node_clinical_terms(id,agency_id,kind,name,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING name",
      [randomUUID(), req.user.agencyId, kind, name, req.user.id],
    )).rows[0];
    return reply(res, { name: row?.name || name, source: "Organisation" }, row ? "Term added" : "Term already available", row ? 201 : 200);
  });
}
