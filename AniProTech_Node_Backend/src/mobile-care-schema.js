export async function initializeMobileCare(db) {
  await db.query(`ALTER TABLE client_medications_scheduling
    ADD COLUMN IF NOT EXISTS is_controlled_drug boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS requires_witness boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stock_tracking_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stock_quantity numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stock_unit text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS low_stock_threshold numeric NOT NULL DEFAULT 0`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_visit_attendance (
    id uuid PRIMARY KEY, visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES users(id), event text NOT NULL CHECK(event IN ('CHECK_IN','CHECK_OUT')),
    latitude double precision, longitude double precision, accuracy double precision,
    source text NOT NULL DEFAULT 'MOBILE', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_visit_attendance_visit ON node_visit_attendance(visit_id,created_at)");
  await db.query("ALTER TABLE node_visit_attendance ADD COLUMN IF NOT EXISTS distance_metres integer, ADD COLUMN IF NOT EXISTS within_radius boolean, ADD COLUMN IF NOT EXISTS client_event_id uuid");
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS node_visit_attendance_event ON node_visit_attendance(client_event_id) WHERE client_event_id IS NOT NULL");
  await db.query(`CREATE TABLE IF NOT EXISTS node_visit_locations (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES users(id), client_event_id uuid NOT NULL,
    latitude double precision NOT NULL, longitude double precision NOT NULL, accuracy double precision,
    distance_metres integer, within_radius boolean, recorded_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id,client_event_id)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_visit_locations_visit ON node_visit_locations(visit_id,recorded_at,id)");
  await db.query("ALTER TABLE node_client_entries ADD COLUMN IF NOT EXISTS client_event_id uuid");
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS node_client_entries_event ON node_client_entries(agency_id,client_event_id) WHERE client_event_id IS NOT NULL");
  await db.query(`CREATE TABLE IF NOT EXISTS node_clinical_observations (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES users(id),
    visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    entry_id uuid NOT NULL UNIQUE REFERENCES node_client_entries(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES users(id), measurement_type text NOT NULL,
    reading jsonb NOT NULL, unit text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_clinical_observations_client ON node_clinical_observations(agency_id,client_id,created_at DESC)");
  await db.query(`CREATE TABLE IF NOT EXISTS node_travel_claims (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, visit_id uuid NOT NULL UNIQUE REFERENCES node_roster_visits(id),
    staff_id uuid NOT NULL REFERENCES users(id), miles numeric NOT NULL CHECK(miles BETWEEN 0 AND 10000),
    minutes integer NOT NULL CHECK(minutes BETWEEN 0 AND 1440), note text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','DECLINED')),
    submitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by uuid REFERENCES users(id),
    reviewed_at timestamptz, decision_note text NOT NULL DEFAULT ''
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_travel_claims_agency ON node_travel_claims(agency_id,status,submitted_at DESC)");
  await db.query(`CREATE TABLE IF NOT EXISTS node_visit_time_change_requests (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    caregiver_id uuid NOT NULL REFERENCES users(id), requested_start time NOT NULL, requested_end time NOT NULL,
    reason text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','DECLINED','CANCELLED')),
    reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, decision_note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(requested_end > requested_start)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_visit_time_change_requests_queue ON node_visit_time_change_requests(agency_id,status,created_at DESC)");
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS node_visit_time_change_open ON node_visit_time_change_requests(visit_id) WHERE status='PENDING'");
  await db.query(`CREATE TABLE IF NOT EXISTS node_travel_legs (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, caregiver_id uuid NOT NULL REFERENCES users(id),
    from_visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    to_visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    visit_date date NOT NULL, suggested_miles numeric NOT NULL DEFAULT 0 CHECK(suggested_miles BETWEEN 0 AND 10000),
    suggested_minutes integer NOT NULL DEFAULT 0 CHECK(suggested_minutes BETWEEN 0 AND 1440),
    approved_miles numeric, approved_minutes integer,
    status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','DECLINED')),
    source text NOT NULL DEFAULT 'ATTENDANCE_ESTIMATE', reason text NOT NULL DEFAULT '',
    reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_visit_id,to_visit_id), CHECK(from_visit_id <> to_visit_id),
    CHECK(approved_miles IS NULL OR approved_miles BETWEEN 0 AND 10000),
    CHECK(approved_minutes IS NULL OR approved_minutes BETWEEN 0 AND 1440)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_travel_legs_queue ON node_travel_legs(agency_id,caregiver_id,visit_date,status)");
  await db.query(`CREATE TABLE IF NOT EXISTS node_mobile_push_tokens (
    token text PRIMARY KEY, agency_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
    session_id uuid NOT NULL REFERENCES node_sessions(id) ON DELETE CASCADE,
    platform text NOT NULL CHECK(platform IN ('ios','android')),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_mobile_push_tokens_user ON node_mobile_push_tokens(agency_id,user_id)");
  await db.query(`CREATE TABLE IF NOT EXISTS node_visit_attachments (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES users(id), file_url text NOT NULL, file_name text NOT NULL, mime_type text NOT NULL,
    caption text NOT NULL DEFAULT '', created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_visit_attachments_visit ON node_visit_attachments(visit_id,created_at)");
  await db.query("ALTER TABLE node_visit_attachments ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision, ADD COLUMN IF NOT EXISTS accuracy double precision, ADD COLUMN IF NOT EXISTS captured_at timestamptz");
  await db.query("ALTER TABLE node_visit_attachments ADD COLUMN IF NOT EXISTS client_event_id uuid");
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS node_visit_attachments_event ON node_visit_attachments(agency_id,client_event_id) WHERE client_event_id IS NOT NULL");
  await db.query(`CREATE TABLE IF NOT EXISTS node_medication_administrations (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, client_event_id uuid NOT NULL,
    visit_id uuid NOT NULL REFERENCES node_roster_visits(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES users(id), medication_id uuid NOT NULL REFERENCES client_medications_scheduling(id),
    actor_id uuid NOT NULL REFERENCES users(id), outcome text NOT NULL CHECK(outcome IN ('ADMINISTERED','PRN_ADMINISTERED','REFUSED','NOT_AVAILABLE','OMITTED')),
    slot text NOT NULL, dose_given text NOT NULL DEFAULT '', reason text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
    prn_effect text NOT NULL DEFAULT '', witnessed_by uuid REFERENCES users(id), quantity_given numeric,
    allergy_acknowledged boolean NOT NULL DEFAULT false,
    body_map_acknowledged boolean NOT NULL DEFAULT false,
    stock_before numeric, stock_after numeric, occurred_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id,client_event_id), UNIQUE(visit_id,medication_id,slot)
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_medication_administrations_visit ON node_medication_administrations(visit_id,occurred_at,id)");
  await db.query("CREATE INDEX IF NOT EXISTS node_medication_administrations_client ON node_medication_administrations(client_id,occurred_at,id)");
  await db.query("ALTER TABLE node_medication_administrations ADD COLUMN IF NOT EXISTS quantity_given numeric, ADD COLUMN IF NOT EXISTS stock_before numeric, ADD COLUMN IF NOT EXISTS stock_after numeric, ADD COLUMN IF NOT EXISTS allergy_acknowledged boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS body_map_acknowledged boolean NOT NULL DEFAULT false");
  await db.query(`CREATE TABLE IF NOT EXISTS node_medication_administration_corrections (
    id uuid PRIMARY KEY, administration_id uuid NOT NULL REFERENCES node_medication_administrations(id),
    agency_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), reason text NOT NULL,
    replacement jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_medication_corrections_administration ON node_medication_administration_corrections(administration_id,created_at,id)");
}
