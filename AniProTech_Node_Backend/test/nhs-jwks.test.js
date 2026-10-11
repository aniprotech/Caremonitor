import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { publicNhsJwks } from "../src/services/nhs-jwks.js";

test("NHS JWKS returns only the public signing key", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwks = publicNhsJwks({ nhsPrivateJwk: JSON.stringify(privateKey.export({ format: "jwk" })), nhsJwksKeyId: "caremonitor-nhs-1" });
  assert.equal(jwks.keys[0].kid, "caremonitor-nhs-1");
  assert.equal(jwks.keys[0].use, "sig");
  assert.equal(jwks.keys[0].d, undefined);
  assert.ok(jwks.keys[0].n);
});

test("NHS JWKS stays unavailable until a key is configured", () => {
  assert.equal(publicNhsJwks({}), null);
});
