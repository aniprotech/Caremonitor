import { initializeReferenceData } from "./reference-data.js";
import { initializeInboxAlerts } from './inbox-alert-schema.js';
import { AsyncLocalStorage } from "node:async_hooks";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFileSync } from "node:fs";
import { initializeTaskLibrary } from "./task-library-schema.js";
import { initializeSharing } from "./share-schema.js";
import { initializeTimeOff } from "./time-off-schema.js";
import { initializePlanning } from "./planning-schema.js";
import { initializeClientFeed } from "./client-feed-schema.js";
import { initializeRoster } from "./roster-schema.js";
import { initializeOperations } from "./operations-schema.js";
import { initializeAccounting } from "./accounting-schema.js";
import { initializeMobileCare } from "./mobile-care-schema.js";
import { initializeRegistration } from "./registration-schema.js";
import { initializeSecurity } from "./security-schema.js";
import { initializeGovernance } from "./governance-schema.js";
import { initializeSharedOptions } from "./shared-options-schema.js";
export const { entities, enums } = JSON.parse(
  readFileSync(new URL("./models/schema.json", import.meta.url)),
);
entities.UserEntity.fields.push({name:"middleName",javaName:"middleName",column:"middle_name",type:"String"});
for (const [name,column,type] of [['latitude','latitude','Double'],['longitude','longitude','Double'],['checkinRadius','checkin_radius','Integer']]) entities.UserPrimaryAddressEntity.fields.push({name,javaName:name,column,type});
for (const field of entities.UserEntity.fields) if(['primaryPhone','secondaryPhone'].includes(field.name)) field.type='String';
// Gender identity includes non-binary and locally defined terms; the stored
// column is text, while sex assigned at birth remains a separate coded field.
const genderField = entities.ClientInformationEntity.fields.find(field => field.name === "gender");
genderField.type = "String";
genderField.enumName = null;
for(const [entity,fields] of Object.entries({
  ClientTaskCategoryEntity:[['agencyId','agency_id','UUID'],['createdBy','created_by','UUID']],
  ClientTaskEntity:[['agencyId','agency_id','UUID'],['createdBy','created_by','UUID'],['archived','archived','Boolean'],['revision','revision','Integer']],
  ClientTaskPlanEntity:[['taskNameSnapshot','task_name_snapshot','String'],['categoryNameSnapshot','category_name_snapshot','String'],['timesPerDay','times_per_day','Integer'],['revision','revision','Integer']]
})) for(const [name,column,type] of fields) entities[entity].fields.push({name,javaName:name,column,type});
for (const [name,column,type] of [
  ['isControlledDrug','is_controlled_drug','Boolean'],
  ['requiresWitness','requires_witness','Boolean'],
  ['stockTrackingEnabled','stock_tracking_enabled','Boolean'],
  ['stockQuantity','stock_quantity','BigDecimal'],
  ['stockUnit','stock_unit','String'],
  ['lowStockThreshold','low_stock_threshold','BigDecimal'],
]) entities.ClientMedicationSchedulingEntity.fields.push({name,javaName:name,column,type});
for (const [name,column,type] of [
  ['healthWelfareLpaReference','health_welfare_lpa_reference','String'],
  ['healthWelfareLpaDate','health_welfare_lpa_date','LocalDate'],
  ['healthWelfareLpaExpiry','health_welfare_lpa_expiry','LocalDate'],
  ['propertyFinancialLpaReference','property_financial_lpa_reference','String'],
  ['propertyFinancialLpaDate','property_financial_lpa_date','LocalDate'],
  ['propertyFinancialLpaExpiry','property_financial_lpa_expiry','LocalDate'],
]) entities.ClientInformationEntity.fields.push({name,javaName:name,column,type});
const emergencyRelationship = entities.ClientEmergencyContactsEntity.fields.find(field => field.name === 'relationShip');
if (emergencyRelationship) { emergencyRelationship.type = 'String'; emergencyRelationship.enumName = null; }
export const quote = (s) => '"' + s.replaceAll('"', '""') + '"';

export async function openDatabase(config) {
  const local = new AsyncLocalStorage();
  let engine;
  if (config.driver === "postgres") {
    if (!config.databaseUrl)
      throw new Error("DATABASE_URL is required for PostgreSQL.");
    engine = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 10,
      // Java LocalDate/LocalDateTime values are wall times, not host-local instants.
      types: {
        getTypeParser: (oid, format) =>
          [1082, 1114].includes(oid)
            ? (value) => value
            : pg.types.getTypeParser(oid, format),
      },
    });
  } else if (config.driver === "pglite") {
    engine = new PGlite(
      config.dataDir === ":memory:" ? undefined : config.dataDir,
    );
    await engine.waitReady;
  } else throw new Error("Unknown DB_DRIVER");
  const db = {
    query: (sql, params = []) =>
      (local.getStore() || engine).query(sql, params),
    async transaction(work) {
      if (local.getStore()) return work();
      if (config.driver === "pglite")
        return engine.transaction((tx) => local.run(tx, work));
      const client = await engine.connect();
      try {
        await client.query("BEGIN");
        const result = await local.run(client, work);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => (config.driver === "pglite" ? engine.close() : engine.end()),
  };
  await db.query("SELECT 1");
  return db;
}

export function sqlType(field) {
  if (field.target || field.type === "UUID") return "uuid";
  if (field.json) return "jsonb";
  if (field.enumName) return field.ordinal ? "smallint" : "text";
  const type = field.collection
    ? field.type
        .replace(/^(List|Map)</, "")
        .replace(/>$/, "")
        .split(",")
        .at(-1)
        .trim()
    : field.type;
  return (
    {
      Boolean: "boolean",
      boolean: "boolean",
      Long: "bigint",
      long: "bigint",
      Integer: "integer",
      int: "integer",
      Double: "double precision",
      double: "double precision",
      BigDecimal: "numeric",
      LocalDate: "date",
      LocalTime: "time",
      LocalDateTime: "timestamp",
    }[type] || "text"
  );
}

export async function initializeSchema(db) {
  await db.transaction(async () => {
    for (const model of Object.values(entities)) {
      const columns = model.fields
        .filter((f) => !f.inverse && !f.collection)
        .map(
          (f) =>
            `${quote(f.column)} ${sqlType(f)}${f.name === "id" ? " PRIMARY KEY" : ""}${f.unique ? " UNIQUE" : ""}${f.required ? " NOT NULL" : ""}`,
        );
      await db.query(
        `CREATE TABLE IF NOT EXISTS ${quote(model.table)} (${columns.join(", ")})`,
      );
    }
    for (const model of Object.values(entities))
      for (const f of model.fields.filter((f) => f.collection)) {
        const c = f.collection;
        await db.query(
          `CREATE TABLE IF NOT EXISTS ${quote(c.table)} (${quote(c.owner)} uuid NOT NULL REFERENCES ${quote(model.table)}(id) ON DELETE CASCADE, ${c.key ? quote(c.key) + " text NOT NULL, " : ""}${quote(c.value)} ${sqlType(f)})`,
        );
        await db.query(
          `CREATE INDEX IF NOT EXISTS ${quote((c.table + "_owner_idx").slice(0, 63))} ON ${quote(c.table)} (${quote(c.owner)})`,
        );
      }
    for (const column of ["nhs_number", "gp_phone_number", "pharmacy_phone_number"]) {
      const current = (await db.query("SELECT data_type FROM information_schema.columns WHERE table_name='client_information' AND column_name=$1", [column])).rows[0]?.data_type;
      if (current !== "text") await db.query(`ALTER TABLE client_information ALTER COLUMN ${quote(column)} TYPE text USING ${quote(column)}::text`);
    }
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS hospital_name text");
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS health_welfare_lpa_reference text");
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS health_welfare_lpa_date date");
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS health_welfare_lpa_expiry date");
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS property_financial_lpa_reference text");
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS property_financial_lpa_date date");
    await db.query("ALTER TABLE client_information ADD COLUMN IF NOT EXISTS property_financial_lpa_expiry date");
    await db.query("CREATE TABLE IF NOT EXISTS node_clinical_terms (id uuid PRIMARY KEY, agency_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('history','medicine','hospital')), name text NOT NULL, created_by uuid NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    await db.query("CREATE UNIQUE INDEX IF NOT EXISTS node_clinical_terms_unique ON node_clinical_terms (agency_id,kind,lower(name))");
    await db.query(
      "CREATE TABLE IF NOT EXISTS node_login_links (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, secret_hash text NOT NULL, expires_at timestamp NOT NULL, used_at timestamp)",
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS node_sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamp NOT NULL, revoked_at timestamp)",
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS node_audit_log (id uuid PRIMARY KEY, actor_id uuid, agency_id uuid, method text NOT NULL, path text NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    await db.query("CREATE TABLE IF NOT EXISTS node_private_files (resource text PRIMARY KEY, original_name text NOT NULL, mime_type text NOT NULL, content bytea NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    await db.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS node_users_email_lower ON users (lower(email))",
    );
    await db.query(
      "CREATE INDEX IF NOT EXISTS node_users_agency ON users (agency_id)",
    );
    await initializeRoster(db);
    await initializeOperations(db);
    await initializeAccounting(db);
    await initializeClientFeed(db);
      await initializeTaskLibrary(db);
      await initializeSharing(db);
      await initializeTimeOff(db);
      await initializePlanning(db); await initializeInboxAlerts(db);
      await initializeMobileCare(db);
      await initializeRegistration(db);
      await initializeSecurity(db);
      await initializeGovernance(db);
      await initializeSharedOptions(db);
      await initializeReferenceData(db);
  });
}
