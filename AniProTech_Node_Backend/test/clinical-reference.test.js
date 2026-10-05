import test from "node:test";
import assert from "node:assert/strict";
import { searchNorthernIrelandHospitals, searchOdsHospitals, searchScottishHospitals, suggestHistoryTerms } from "../src/services/clinical-catalog.js";
import { searchDmdMedicines } from "../src/services/nhs-terminology.js";

test("hospital search finds coded NHS sites even when their names omit hospital", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const request = new URL(url);
    assert.equal(request.searchParams.get("Roles"), "RO198,RO149,RO176,RO150");
    return { ok: true, json: async () => ({ Organisations: [{ Name: "Queen Victoria", OrgId: "ABC01", PostCode: "AB1 2CD" }] }) };
  };
  try {
    assert.deepEqual(await searchOdsHospitals("Queen"), [{ name: "Queen Victoria", source: "NHS ODS site", code: "ABC01", postcode: "AB1 2CD" }]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Scottish hospital search ignores matches from unrelated fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: true, result: { records: [
    { HospitalName: "Queen Elizabeth University Hospital", HospitalCode: "G405H", Postcode: "G51 4TF" },
    { HospitalName: "Another Hospital", AddressLine1: "Queen Street" },
  ] } }) });
  try {
    assert.deepEqual(await searchScottishHospitals("Queen"), [{ name: "Queen Elizabeth University Hospital", source: "NHS Scotland", code: "G405H", postcode: "G51 4TF" }]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Northern Ireland hospital names remain available when remote directories fail", () => {
  assert.deepEqual(searchNorthernIrelandHospitals("Altnagelvin"), [
    { name: "Altnagelvin Hospital", source: "HSCNI directory", postcode: "BT47 6SB" },
  ]);
});

test("condition suggestions include standard terms and tolerate simple spelling errors", () => {
  assert.ok(suggestHistoryTerms("Learning Disability").includes("Learning disability"));
  assert.ok(suggestHistoryTerms("Lerning disabilty").includes("Learning disability"));
  assert.ok(suggestHistoryTerms("autism").includes("Autism spectrum condition"));
});

test("dm+d search uses server-side OAuth and returns coded medicine names", async () => {
  const originalFetch = globalThis.fetch;
  const originalId = process.env.NHS_TERMINOLOGY_CLIENT_ID;
  const originalSecret = process.env.NHS_TERMINOLOGY_CLIENT_SECRET;
  process.env.NHS_TERMINOLOGY_CLIENT_ID = "test-client";
  process.env.NHS_TERMINOLOGY_CLIENT_SECRET = "test-secret";
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (calls === 1) {
      assert.match(url, /openid-connect\/token$/);
      assert.equal(options.body.get("grant_type"), "client_credentials");
      return { ok: true, json: async () => ({ access_token: "test-token", expires_in: 300 }) };
    }
    assert.match(url, /ValueSet\/\$expand$/);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    const body = JSON.parse(options.body);
    assert.equal(body.parameter.find(parameter => parameter.name === "filter").valueString, "paracetamol");
    return { ok: true, json: async () => ({ expansion: { contains: [{ display: "Paracetamol 500mg tablets", code: "123456" }] } }) };
  };
  try {
    assert.deepEqual(await searchDmdMedicines("paracetamol"), [{ name: "Paracetamol 500mg tablets", source: "NHS dm+d", code: "123456" }]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalId === undefined) delete process.env.NHS_TERMINOLOGY_CLIENT_ID; else process.env.NHS_TERMINOLOGY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.NHS_TERMINOLOGY_CLIENT_SECRET; else process.env.NHS_TERMINOLOGY_CLIENT_SECRET = originalSecret;
  }
});

test("clinical search reports missing NHS credentials instead of implying an empty NHS result", async () => {
  const { registerClinicalCatalog } = await import("../src/services/clinical-catalog.js");
  const previous = process.env.NHS_TERMINOLOGY_CLIENT_ID;
  delete process.env.NHS_TERMINOLOGY_CLIENT_ID;
  let handler, payload;
  registerClinicalCatalog({ db: { query: async () => ({ rows: [] }) }, auth: {} }, (method, path, fn) => { if (method === "GET") handler = fn; });
  const res = { status() { return this; }, json(value) { payload = value.results.data; } };
  try {
    await handler({ user: { agencyId: "test" }, query: { kind: "medicine", q: "para" } }, res);
    assert.match(payload.warnings[0], /not configured/);
  } finally { if (previous === undefined) delete process.env.NHS_TERMINOLOGY_CLIENT_ID; else process.env.NHS_TERMINOLOGY_CLIENT_ID = previous; }
});
