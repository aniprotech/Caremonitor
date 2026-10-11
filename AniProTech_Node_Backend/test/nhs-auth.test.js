import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { clearNhsTokenCache, createNhsClientAssertion, nhsApplicationToken } from "../src/services/nhs-auth.js";

const decode = value => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

function config() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    nhsClientId: "caremonitor-sandbox-client",
    nhsPrivateJwk: JSON.stringify(privateKey.export({ format: "jwk" })),
    nhsJwksKeyId: "caremonitor-test-1",
    nhsTokenUrl: "https://sandbox.example/oauth2/token",
    publicKey,
  };
}

test("NHS private-key assertion has the required RS512 claims and signature", () => {
  const c = config();
  const token = createNhsClientAssertion(c, 1_700_000_000_000);
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(decode(header), { alg: "RS512", typ: "JWT", kid: "caremonitor-test-1" });
  const claims = decode(payload);
  assert.equal(claims.iss, c.nhsClientId);
  assert.equal(claims.sub, c.nhsClientId);
  assert.equal(claims.aud, c.nhsTokenUrl);
  assert.equal(claims.iat, 1_700_000_000);
  assert.equal(claims.exp, 1_700_000_300);
  assert.match(claims.jti, /^[0-9a-f-]{36}$/);
  assert.equal(verify("RSA-SHA512", Buffer.from(`${header}.${payload}`), c.publicKey, Buffer.from(signature, "base64url")), true);
});

test("NHS access tokens are requested server-side then reused until shortly before expiry", async () => {
  clearNhsTokenCache();
  const c = config();
  const oldFetch = global.fetch;
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, c.nhsTokenUrl);
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("grant_type"), "client_credentials");
    assert.equal(options.body.get("client_assertion_type"), "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    assert.ok(options.body.get("client_assertion"));
    return Response.json({ access_token: "sandbox-access-token", expires_in: 300 });
  };
  try {
    assert.equal(await nhsApplicationToken(c), "sandbox-access-token");
    assert.equal(await nhsApplicationToken(c), "sandbox-access-token");
    assert.equal(calls, 1);
  } finally {
    global.fetch = oldFetch;
    clearNhsTokenCache();
  }
});
