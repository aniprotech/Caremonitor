export async function initializeSharedOptions(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_shared_catalog_options (
    id uuid PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('ethnicity','religion','sexual_orientation','gender','history','medicine','hospital','relationship','professional_role')),
    name text NOT NULL,
    source_agency_id uuid NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS node_shared_catalog_options_name
    ON node_shared_catalog_options(kind,lower(name))`);
  // PostgreSQL cannot extend the original CHECK in place, so newer option
  // kinds are accepted by replacing only that named constraint when present.
  await db.query(`ALTER TABLE node_shared_catalog_options DROP CONSTRAINT IF EXISTS node_shared_catalog_options_kind_check`);
  await db.query(`ALTER TABLE node_shared_catalog_options ADD CONSTRAINT node_shared_catalog_options_kind_check
    CHECK (kind IN ('ethnicity','religion','sexual_orientation','gender','history','medicine','hospital','relationship','professional_role'))`);
}
