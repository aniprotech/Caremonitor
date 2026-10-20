export async function initializeClientFeed(db) {
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name text");
  await db.query(
    "ALTER TABLE users ALTER COLUMN primary_phone TYPE text USING primary_phone::text, ALTER COLUMN secondary_phone TYPE text USING secondary_phone::text",
  );
  await db.query(`CREATE TABLE IF NOT EXISTS node_client_care_plan_summaries (
    client_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    agency_id uuid NOT NULL,
    summary text NOT NULL DEFAULT '',
    updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const { entities, quote } = await import("./db.js");
  await db.query(
    `ALTER TABLE ${quote(entities.UserPrimaryAddressEntity.table)} ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision, ADD COLUMN IF NOT EXISTS checkin_radius integer`,
  );
  await db.query(`CREATE TABLE IF NOT EXISTS node_client_entries (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES users(id),
    visit_id uuid REFERENCES node_roster_visits(id), kind text NOT NULL CHECK(kind IN ('NOTE','ALERT','ACTION','ACTIVITY','OBSERVATION')),
    title text NOT NULL, body text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'OPEN', revision integer NOT NULL DEFAULT 1,
    created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(
    "CREATE INDEX IF NOT EXISTS node_client_entries_client ON node_client_entries(agency_id,client_id,created_at)",
  );
  await db.query(`CREATE TABLE IF NOT EXISTS node_client_entry_history (
    id uuid PRIMARY KEY, entry_id uuid NOT NULL REFERENCES node_client_entries(id),
    revision integer NOT NULL, snapshot jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(entry_id,revision)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_visit_events (
    id uuid PRIMARY KEY, visit_id uuid NOT NULL REFERENCES node_roster_visits(id),
    actor_id uuid NOT NULL REFERENCES users(id), description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(
    "CREATE INDEX IF NOT EXISTS node_visit_events_visit ON node_visit_events(visit_id,created_at)",
  );
  await db.query(
    "ALTER TABLE node_roster_visits ADD COLUMN IF NOT EXISTS actual_start timestamptz",
  );
  await db.query(
    "ALTER TABLE node_roster_visits ADD COLUMN IF NOT EXISTS actual_end timestamptz",
  );
}

export async function visitEvent(db, visitId, actorId, description) {
  const { randomUUID } = await import("node:crypto");
  await db.query(
    "INSERT INTO node_visit_events(id,visit_id,actor_id,description) VALUES($1,$2,$3,$4)",
    [randomUUID(), visitId, actorId, description],
  );
}
