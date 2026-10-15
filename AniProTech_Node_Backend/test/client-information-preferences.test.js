import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase, initializeSchema } from "../src/db.js";
import { Repository } from "../src/repository.js";

test("client communication needs and multiple contact methods persist", async (t) => {
  const db = await openDatabase({ driver: "pglite", dataDir: ":memory:" });
  await initializeSchema(db);
  const repo = new Repository(db);
  const client = await repo.save("UserEntity", {
    agencyId: randomUUID(), firstName: "Test", lastName: "Client",
    email: "client-preferences@example.test", role: "USER", isActive: true,
  });
  const info = await repo.save("ClientInformationEntity", {
    user: client.id,
    communicationOrInformationNeeds: ["NO_REQUIREMENTS"],
    preferredContactMethod: ["PHONE", "EMAIL", "WHATSAPP"],
  });
  assert.deepEqual(info.communicationOrInformationNeeds, ["NO_REQUIREMENTS"]);
  assert.deepEqual([...info.preferredContactMethod].sort(), ["EMAIL", "PHONE", "WHATSAPP"]);

  const legacyClient = await repo.save("UserEntity", {
    agencyId: randomUUID(), firstName: "Legacy", lastName: "Client",
    email: "legacy-preferences@example.test", role: "USER", isActive: true,
  });
  const legacyInfo = await repo.save("ClientInformationEntity", { user: legacyClient.id });
  await db.query("UPDATE client_information SET preferred_contact_method='TEXT' WHERE id=$1", [legacyInfo.id]);
  await initializeSchema(db);
  const migrated = await repo.get("ClientInformationEntity", legacyInfo.id);
  assert.deepEqual(migrated.preferredContactMethod, ["TEXT"]);
  await db.close();
});
