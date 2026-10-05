import { initializeReferenceData, importBundledReferences } from "./reference-data.js";
import { configuration } from "./config.js";
import { openDatabase } from "./db.js";
import { initializeRegistration } from "./registration-schema.js";
import { initializeMobileCare } from "./mobile-care-schema.js";
import { initializeAccounting } from "./accounting-schema.js";
import { initializeTimeOff } from "./time-off-schema.js";
import { initializeSharedOptions } from "./shared-options-schema.js";
import { createApp } from "./app.js";
import { startGovernanceJobs } from "./governance-jobs.js";
const config = configuration(),
  db = await openDatabase(config);
// Schema changes are explicit: run npm run db:init before the first start.
await db.query("SELECT id FROM node_sessions LIMIT 1");
// Keep newly introduced client profile fields available when Railway skips its
// pre-deploy migration hook during a rolling deployment.
await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS hospital_name text");
await initializeSharedOptions(db);
await initializeReferenceData(db);
await importBundledReferences(db);
// Registration must be available during rolling deploys even if the platform's
// pre-deploy migration hook is skipped. This initializer is idempotent.
await initializeRegistration(db);
// Mobile visit tables are required by the first request after a rolling deploy.
// Keep this idempotent safeguard even when Railway's pre-deploy migration runs.
await db.transaction(async()=>initializeMobileCare(db));
// Keep Accounting schema current when a rolling deploy skips the pre-deploy hook.
await db.transaction(async()=>initializeAccounting(db));
// Availability and leave requests must exist even when Railway skips pre-deploy migration.
await db.transaction(async()=>initializeTimeOff(db));
const app = createApp({ db, config });
const stopNotifications=app.locals.ctx.notifications.start();
const stopGovernanceJobs=startGovernanceJobs(app.locals.ctx);
const server = app.listen(config.port, config.host, () =>
  console.log(
    `AniProTech Express listening at http://${config.host}:${config.port}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await stopNotifications();
      await stopGovernanceJobs();
      await db.close();
      process.exit(0);
    }),
  );
