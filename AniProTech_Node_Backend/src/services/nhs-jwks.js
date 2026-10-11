import { createPrivateKey, createPublicKey } from "node:crypto";

export function publicNhsJwks(config) {
  if (!config.nhsPrivateJwk || !config.nhsJwksKeyId) return null;
  const privateJwk = JSON.parse(config.nhsPrivateJwk);
  const publicJwk = createPublicKey(createPrivateKey({ key: privateJwk, format: "jwk" })).export({ format: "jwk" });
  return { keys: [{ ...publicJwk, kid: config.nhsJwksKeyId, use: "sig", alg: "RS512" }] };
}
