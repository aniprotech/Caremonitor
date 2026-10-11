import test from "node:test";
import assert from "node:assert/strict";
import { searchNorthernIrelandHospitals, searchOdsHospitals, searchOdsOrganisations, searchOdsTerminologyHospitals, searchOdsTerminologyOrganisations, searchScottishHospitals, suggestHistoryTerms } from "../src/services/clinical-catalog.js";
import { searchDmdMedicines } from "../src/services/nhs-terminology.js";

test("hospital search finds coded NHS sites even when their names omit hospital", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const request = new URL(url);
    assert.equal(request.searchParams.get("Roles"), "RO198,RO149,RO176,RO150");
    return { ok: true, json: async () => ({ Organisations: [{ Name: "Queen Victoria", OrgId: "ABC01", PostCode: "AB1 2CD" }] }) };
  };
  try {
    assert.deepEqual(await searchOdsHospitals("Queen"), [{ name: "Queen Victoria", source: "NHS ODS", code: "ABC01", postcode: "AB1 2CD" }]);
  } finally { globalThis.fetch = originalFetch; }
});

test("ODS GP and pharmacy searches use their specific organisation roles", async () => {
  const originalFetch = globalThis.fetch;
  const roles = [];
  globalThis.fetch = async url => {
    const request = new URL(url);
    roles.push(request.searchParams.get("Roles"));
    return { ok: true, json: async () => ({ Organisations: [{ Name: "Example organisation", OrgId: "A1234", PostCode: "CV5 8NY", Address1: "40 Madeira Croft", TelephoneNumber: "024 0000 0000" }] }) };
  };
  try {
    assert.equal((await searchOdsOrganisations("Example", "gp_practice"))[0].code, "A1234");
    assert.equal((await searchOdsOrganisations("Example", "pharmacy"))[0].address, "40 Madeira Croft, CV5 8NY");
    assert.deepEqual(roles, ["RO177,RO76,RO315", "RO182,RO280"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("ODS Terminology search uses the FHIR endpoint when an API key is configured", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.NHS_ODS_API_KEY;
  const originalBaseUrl = process.env.NHS_ODS_FHIR_BASE_URL;
  process.env.NHS_ODS_API_KEY = "test-api-key";
  process.env.NHS_ODS_FHIR_BASE_URL = "https://sandbox.example/fhir";
  globalThis.fetch = async (url, options) => {
    const request = new URL(url);
    assert.equal(request.pathname, "/fhir/Organization");
    assert.equal(request.searchParams.get("name:contains"), "Queen");
    assert.equal(request.searchParams.get("activeRoleCode"), "RO198,RO149,RO176,RO150");
    assert.equal(options.headers.apikey, "test-api-key");
    return { ok: true, json: async () => ({ entry: [{ resource: {
      resourceType: "Organization", id: "ABC01", name: "Queen Victoria", address: [{ postalCode: "AB1 2CD" }],
    } }] }) };
  };
  try {
    assert.deepEqual(await searchOdsTerminologyHospitals("Queen"), [{ name: "Queen Victoria", source: "NHS ODS Terminology", code: "ABC01", postcode: "AB1 2CD" }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NHS_ODS_API_KEY; else process.env.NHS_ODS_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.NHS_ODS_FHIR_BASE_URL; else process.env.NHS_ODS_FHIR_BASE_URL = originalBaseUrl;
  }
});

test("ODS Terminology GP searches retain coded contact details", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.NHS_ODS_API_KEY;
  const originalBaseUrl = process.env.NHS_ODS_FHIR_BASE_URL;
  process.env.NHS_ODS_API_KEY = "test-api-key";
  process.env.NHS_ODS_FHIR_BASE_URL = "https://sandbox.example/fhir";
  globalThis.fetch = async url => {
    const request = new URL(url);
    assert.equal(request.searchParams.get("activeRoleCode"), "RO177,RO76,RO315");
    return { ok: true, json: async () => ({ entry: [{ resource: { resourceType: "Organization", id: "A1234", name: "Example GP", address: [{ line: ["1 High Street"], city: "Coventry", postalCode: "CV5 8NY" }], telecom: [{ system: "phone", value: "024 0000 0000" }] } }] }) };
  };
  try {
    assert.deepEqual(await searchOdsTerminologyOrganisations("Example", "gp_practice"), [{ name: "Example GP", source: "NHS ODS Terminology", code: "A1234", postcode: "CV5 8NY", address: "1 High Street, Coventry, CV5 8NY", phone: "024 0000 0000" }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NHS_ODS_API_KEY; else process.env.NHS_ODS_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.NHS_ODS_FHIR_BASE_URL; else process.env.NHS_ODS_FHIR_BASE_URL = originalBaseUrl;
  }
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
