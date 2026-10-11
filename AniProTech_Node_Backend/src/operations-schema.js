export async function initializeOperations(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_rates (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES users(id),
    kind text NOT NULL CHECK(kind IN ('BILLING','PAY')),effective_from date NOT NULL,
    hourly_pence integer NOT NULL CHECK(hourly_pence>=0 AND hourly_pence<=1000000),
    rate_unit text NOT NULL DEFAULT 'HOURLY',rate_pence integer,
    UNIQUE(user_id,kind,effective_from)
  )`);
  await db.query(`ALTER TABLE node_rates
    ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT 'HOURLY',
    ADD COLUMN IF NOT EXISTS rate_pence integer`);
  await db.query("UPDATE node_rates SET rate_pence=hourly_pence WHERE rate_pence IS NULL");
  await db.query(`CREATE TABLE IF NOT EXISTS node_finance_documents (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('INVOICE','PAYRUN')),
    number integer NOT NULL,recipient_id uuid NOT NULL REFERENCES users(id),recipient_name text NOT NULL,
    from_date date NOT NULL,to_date date NOT NULL,total_pence integer NOT NULL CHECK(total_pence>=0),
    status text NOT NULL DEFAULT 'DRAFT',created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id,kind,number),CHECK(status IN ('DRAFT','ISSUED','APPROVED','PAID','VOID'))
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_finance_lines (
    id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES node_finance_documents(id),
    visit_id uuid NOT NULL REFERENCES node_roster_visits(id),kind text NOT NULL,
    visit_date date NOT NULL,title text NOT NULL,minutes integer NOT NULL,hourly_pence integer NOT NULL,
    amount_pence integer NOT NULL,released boolean NOT NULL DEFAULT false
  )`);
  await db.query(`ALTER TABLE node_finance_lines
    ADD COLUMN IF NOT EXISTS component text NOT NULL DEFAULT 'CARE',
    ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT 'HOURLY',
    ADD COLUMN IF NOT EXISTS visit_revision integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS review_revision integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS travel_revision integer`);
  await db.query("DROP INDEX IF EXISTS node_finance_visit_once");
  await db.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS node_finance_visit_once ON node_finance_lines(kind,visit_id,component) WHERE released=false",
  );
  await db.query(`CREATE TABLE IF NOT EXISTS node_finance_reviews (
    visit_id uuid NOT NULL REFERENCES node_roster_visits(id), kind text NOT NULL CHECK(kind IN ('PAY','BILLING')),
    state text NOT NULL CHECK(state IN ('CONFIRMED','DISCARDED')),basis text NOT NULL CHECK(basis IN ('PLANNED','ACTUAL')),
    minutes integer NOT NULL CHECK(minutes>=0),visit_revision integer NOT NULL,revision integer NOT NULL DEFAULT 1,
    PRIMARY KEY(visit_id,kind))`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_finance_history (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,actor_id uuid NOT NULL,subject_id uuid NOT NULL,
    action text NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_travel_rates (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES users(id),effective_from date NOT NULL,
    mileage_pence integer NOT NULL CHECK(mileage_pence BETWEEN 0 AND 100000),hourly_pence integer NOT NULL CHECK(hourly_pence BETWEEN 0 AND 1000000),
    UNIQUE(user_id,effective_from))`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_client_service_hours (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES users(id),effective_from date NOT NULL,
    weekly_minutes integer NOT NULL CHECK(weekly_minutes BETWEEN 0 AND 10080),funding_source text NOT NULL DEFAULT '',reference text NOT NULL DEFAULT '',
    UNIQUE(user_id,effective_from))`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_visit_travel (
    visit_id uuid PRIMARY KEY REFERENCES node_roster_visits(id),agency_id uuid NOT NULL,
    staff_id uuid NOT NULL REFERENCES users(id),miles numeric NOT NULL CHECK(miles BETWEEN 0 AND 10000),
    minutes integer NOT NULL CHECK(minutes BETWEEN 0 AND 1440),source text NOT NULL DEFAULT 'ACTUAL',
    revision integer NOT NULL DEFAULT 1,recorded_by uuid NOT NULL REFERENCES users(id),
    recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_credit_notes (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,invoice_id uuid NOT NULL REFERENCES node_finance_documents(id),
    number integer NOT NULL,reason text NOT NULL,total_pence integer NOT NULL CHECK(total_pence>0),
    status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','APPLIED','VOID')),
    created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(agency_id,number)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_credit_note_lines (
    id uuid PRIMARY KEY,credit_note_id uuid NOT NULL REFERENCES node_credit_notes(id),
    finance_line_id uuid NOT NULL REFERENCES node_finance_lines(id),description text NOT NULL,
    amount_pence integer NOT NULL CHECK(amount_pence>0),UNIQUE(credit_note_id,finance_line_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_threads (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,subject text NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_messages (
    seq bigserial PRIMARY KEY,id uuid NOT NULL UNIQUE,thread_id uuid NOT NULL REFERENCES node_threads(id),
    sender_id uuid NOT NULL REFERENCES users(id),body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_thread_members (
    thread_id uuid NOT NULL REFERENCES node_threads(id),user_id uuid NOT NULL REFERENCES users(id),
    last_read bigint NOT NULL DEFAULT 0,archived boolean NOT NULL DEFAULT false,
    PRIMARY KEY(thread_id,user_id)
  )`);
  await db.query(
    "CREATE INDEX IF NOT EXISTS node_messages_thread_seq ON node_messages(thread_id,seq)",
  );
}
