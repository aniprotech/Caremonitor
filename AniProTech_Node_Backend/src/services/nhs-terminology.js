const tokenEndpoint = "https://ontology.nhs.uk/authorisation/auth/realms/nhs-digital-terminology/protocol/openid-connect/token";
const productionBases = new Set(["https://ontology.nhs.uk/production1/fhir", "https://ontology.nhs.uk/production2/fhir"]);

let cachedToken;
let tokenExpiresAt = 0;

async function accessToken() {
  const clientId = process.env.NHS_TERMINOLOGY_CLIENT_ID;
  const clientSecret = process.env.NHS_TERMINOLOGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  const response = await fetch(tokenEndpoint, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error("NHS terminology authentication unavailable");
  const payload = await response.json();
  if (!payload.access_token) throw new Error("NHS terminology authentication unavailable");
  cachedToken = payload.access_token;
  tokenExpiresAt = Date.now() + Math.max(0, Number(payload.expires_in || 60) - 30) * 1000;
  return cachedToken;
}

export async function searchDmdMedicines(query) {
  if (query.length < 2 || !process.env.NHS_TERMINOLOGY_CLIENT_ID || !process.env.NHS_TERMINOLOGY_CLIENT_SECRET) return [];
  const base = process.env.NHS_TERMINOLOGY_FHIR_BASE_URL || "https://ontology.nhs.uk/production2/fhir";
  if (!productionBases.has(base)) throw new Error("Unsupported NHS terminology endpoint");
  const token = await accessToken();
  const parent = type => ({ system: "https://dmd.nhs.uk", filter: [
    { property: "parent", op: "=", value: type },
    { property: "INVALID", op: "exists", value: "false" },
  ] });
  const body = { resourceType: "Parameters", parameter: [
    { name: "valueSet", resource: { resourceType: "ValueSet", compose: { include: [parent("VMP"), parent("AMP")] } } },
    { name: "filter", valueString: query },
    { name: "count", valueInteger: 30 },
  ] };
  const response = await fetch(`${base}/ValueSet/$expand`, {
    method: "POST", headers: { Accept: "application/fhir+json", "Content-Type": "application/fhir+json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5500),
  });
  if (!response.ok) throw new Error("NHS medicine search unavailable");
  const payload = await response.json();
  return (payload.expansion?.contains || []).filter(item => item.display && item.code).map(item => ({
    name: item.display, source: "NHS dm+d", code: item.code,
  }));
}
