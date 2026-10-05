export async function initializeSharedOptions(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_shared_catalog_options (
    id uuid PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('ethnicity','religion','sexual_orientation','gender','history','medicine','hospital')),
    name text NOT NULL,
    source_agency_id uuid NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS node_shared_catalog_options_name
    ON node_shared_catalog_options(kind,lower(name))`);
}
