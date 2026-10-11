import { createPrivateKey, randomUUID, sign } from "node:crypto";

const assertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const cachedTokens = new Map();

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

// NHS application-restricted APIs use a private-key JWT client assertion. The
// assertion and the bearer token never leave the backend; browsers receive only
// the resulting clinical search data.
export function createNhsClientAssertion(config, now = Date.now()) {
  const clientId = required(config.nhsClientId, "NHS client ID is not configured");
  const privateJwk = JSON.parse(required(config.nhsPrivateJwk, "NHS private key is not configured"));
  const kid = required(config.nhsJwksKeyId, "NHS key identifier is not configured");
  const audience = required(config.nhsTokenUrl, "NHS token URL is not configured");
  const issuedAt = Math.floor(now / 1000);
  const header = encode({ alg: "RS512", typ: "JWT", kid });
  const payload = encode({
    iss: clientId,
    sub: clientId,
    aud: audience,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + 300,
  });
  const signed = `${header}.${payload}`;
  const signature = sign("RSA-SHA512", Buffer.from(signed), createPrivateKey({ key: privateJwk, format: "jwk" })).toString("base64url");
  return `${signed}.${signature}`;
}

export async function nhsApplicationToken(config) {
  const clientId = required(config.nhsClientId, "NHS client ID is not configured");
  const tokenUrl = required(config.nhsTokenUrl, "NHS token URL is not configured");
  const cacheKey = `${tokenUrl}:${clientId}:${config.nhsJwksKeyId || ""}`;
  const cached = cachedTokens.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: assertionType,
    client_assertion: createNhsClientAssertion(config),
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("NHS token request failed");
  const result = await response.json();
  if (typeof result.access_token !== "string" || !result.access_token) throw new Error("NHS token response is invalid");
  const seconds = Number(result.expires_in);
  const expiresAt = Date.now() + Math.max(60, Number.isFinite(seconds) ? seconds : 300) * 1000;
  cachedTokens.set(cacheKey, { token: result.access_token, expiresAt });
  return result.access_token;
}

export function clearNhsTokenCache() {
  cachedTokens.clear();
}
