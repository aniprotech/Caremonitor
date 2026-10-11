export async function initializeGovernance(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_quality_cases (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, client_id uuid REFERENCES users(id),
    kind text NOT NULL CHECK(kind IN ('INCIDENT','SAFEGUARDING','COMPLAINT','AUDIT_FINDING')),
    severity text NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    title text NOT NULL, description text NOT NULL,
    status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','INVESTIGATING','ACTION_REQUIRED','CLOSED')),
    owner_id uuid REFERENCES users(id), due_at timestamptz, revision integer NOT NULL DEFAULT 1,
    created_by uuid NOT NULL REFERENCES users(id), closed_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamptz
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_quality_actions (
    id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES node_quality_cases(id) ON DELETE CASCADE,
    title text NOT NULL, owner_id uuid REFERENCES users(id), due_at timestamptz,
    status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE','VOID')),
    evidence text, created_by uuid NOT NULL REFERENCES users(id), completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_policy_register (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, title text NOT NULL, version text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
    effective_at date, review_at date, document_url text, approved_by uuid REFERENCES users(id),
    approved_at timestamptz, created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_policy_acknowledgements (
    policy_id uuid NOT NULL REFERENCES node_policy_register(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id), acknowledged_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(policy_id,user_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_staff_credentials (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, staff_id uuid NOT NULL REFERENCES users(id),
    kind text NOT NULL, reference text, issued_at date, expires_at date,
    status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN ('PENDING_REVIEW','VALID','SUSPENDED','REVOKED')),
    evidence_url text, revision integer NOT NULL DEFAULT 1, created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Requirements are owned by the organisation so managers can change the
  // competency matrix without overwriting a caregiver's certificate history.
  await db.query(`CREATE TABLE IF NOT EXISTS node_training_requirements (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, kind text NOT NULL,
    mandatory boolean NOT NULL DEFAULT true, blocks_roster boolean NOT NULL DEFAULT false,
    renewal_months integer, created_by uuid REFERENCES users(id), updated_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id,kind)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_staff_recruitment (
    staff_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, agency_id uuid NOT NULL,
    stage text NOT NULL CHECK(stage IN ('INVITED','APPLIED','REFERENCES_CHECK','DOCUMENT_REVIEW','APPROVED','DECLINED')),
    notes text, decided_by uuid REFERENCES users(id), decided_at timestamptz,
    updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_credential_decisions (
    id uuid PRIMARY KEY, credential_id uuid NOT NULL REFERENCES node_staff_credentials(id) ON DELETE CASCADE,
    decision text NOT NULL CHECK(decision IN ('APPROVED','REJECTED')), reason text NOT NULL,
    decided_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Upgrade deployments created before pending manager review was introduced.
  await db.query("ALTER TABLE node_staff_credentials DROP CONSTRAINT IF EXISTS node_staff_credentials_status_check");
  await db.query("ALTER TABLE node_staff_credentials ADD CONSTRAINT node_staff_credentials_status_check CHECK(status IN ('PENDING_REVIEW','VALID','SUSPENDED','REVOKED'))");
  await db.query(`CREATE TABLE IF NOT EXISTS node_ai_reviews (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES users(id),
    kind text NOT NULL CHECK(kind IN ('NOTE_SUMMARY','RISK_SIGNAL')),
    suggestion text NOT NULL, evidence jsonb NOT NULL, model_info jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
    created_by uuid NOT NULL REFERENCES users(id), reviewed_by uuid REFERENCES users(id),
    decision_reason text, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at timestamptz
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_metric_definitions (
    agency_id uuid NOT NULL, metric_key text NOT NULL, label text NOT NULL, definition text NOT NULL,
    owner text NOT NULL, active boolean NOT NULL DEFAULT true, updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(agency_id,metric_key)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_data_quality_runs (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, status text NOT NULL,
    findings jsonb NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_portal_messages (
    id uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES node_share_grants(id) ON DELETE CASCADE,
    agency_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES users(id), sender_type text NOT NULL,
    sender_name text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_portal_feedback (
    id uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES node_share_grants(id) ON DELETE CASCADE,
    agency_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES users(id), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment text, consented_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("ALTER TABLE node_portal_feedback ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'QUALITY_FEEDBACK'");
  await db.query(`CREATE TABLE IF NOT EXISTS node_governance_settings (
    agency_id uuid PRIMARY KEY, critical_escalation_minutes integer NOT NULL DEFAULT 30,
    high_escalation_minutes integer NOT NULL DEFAULT 240, family_response_hours integer NOT NULL DEFAULT 24,
    regulator_template text NOT NULL DEFAULT 'CQC', updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_governance_escalations (
    id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES node_quality_cases(id) ON DELETE CASCADE,
    level text NOT NULL CHECK(level IN ('MANAGER','SAFEGUARDING_LEAD','DIRECTOR','REGULATOR')),
    reason text NOT NULL, escalated_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_governance_evidence (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, entity_type text NOT NULL CHECK(entity_type IN ('CASE','ACTION','POLICY','CREDENTIAL')),
    entity_id uuid NOT NULL, file_name text NOT NULL, file_url text NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_governance_reminders (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, reminder_key text NOT NULL, recipient_id uuid NOT NULL REFERENCES users(id),
    subject text NOT NULL, status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','SENT','FAILED')),
    due_at timestamptz NOT NULL, sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id,reminder_key,recipient_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_portal_preferences (
    grant_id uuid PRIMARY KEY REFERENCES node_share_grants(id) ON DELETE CASCADE,
    message_email boolean NOT NULL DEFAULT true, feedback_email boolean NOT NULL DEFAULT false,
    response_target_hours integer NOT NULL DEFAULT 24, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_ai_models (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, model_key text NOT NULL, version text NOT NULL,
    purpose text NOT NULL, limitations text NOT NULL, risk_level text NOT NULL CHECK(risk_level IN ('LOW','MEDIUM','HIGH')),
    status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','RETIRED')),
    approved_by uuid REFERENCES users(id), approved_at timestamptz, created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(agency_id,model_key,version)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_ai_evaluations (
    id uuid PRIMARY KEY, model_id uuid NOT NULL REFERENCES node_ai_models(id) ON DELETE CASCADE,
    dataset_name text NOT NULL, sample_size integer NOT NULL, precision numeric NOT NULL, recall numeric NOT NULL,
    false_positive_rate numeric NOT NULL, subgroup_results jsonb NOT NULL, notes text NOT NULL,
    outcome text NOT NULL CHECK(outcome IN ('PASS','FAIL','CONDITIONAL')),
    reviewed_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_report_schedules (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, name text NOT NULL, report_kind text NOT NULL,
    cadence text NOT NULL CHECK(cadence IN ('WEEKLY','MONTHLY','QUARTERLY')), recipient_emails jsonb NOT NULL,
    active boolean NOT NULL DEFAULT true, last_run_at timestamptz, next_run_at timestamptz NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_release_signoffs (
    id uuid PRIMARY KEY, agency_id uuid NOT NULL, persona text NOT NULL CHECK(persona IN ('CARE_MANAGER','CAREGIVER','CLIENT','FAMILY')),
    scenario text NOT NULL, result text NOT NULL CHECK(result IN ('PASS','FAIL','BLOCKED')),
    evidence text NOT NULL, signed_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  for (const sql of [
    "CREATE INDEX IF NOT EXISTS node_quality_cases_agency ON node_quality_cases(agency_id,status,due_at)",
    "CREATE INDEX IF NOT EXISTS node_credentials_agency ON node_staff_credentials(agency_id,expires_at)",
    "CREATE INDEX IF NOT EXISTS node_training_requirements_agency ON node_training_requirements(agency_id,mandatory)",
    "CREATE INDEX IF NOT EXISTS node_staff_recruitment_agency ON node_staff_recruitment(agency_id,stage)",
    "CREATE INDEX IF NOT EXISTS node_ai_reviews_agency ON node_ai_reviews(agency_id,status,created_at)",
    "CREATE INDEX IF NOT EXISTS node_portal_messages_grant ON node_portal_messages(grant_id,created_at)"
    ,"CREATE INDEX IF NOT EXISTS node_governance_evidence_entity ON node_governance_evidence(agency_id,entity_type,entity_id)"
    ,"CREATE INDEX IF NOT EXISTS node_governance_reminders_due ON node_governance_reminders(agency_id,status,due_at)"
    ,"CREATE INDEX IF NOT EXISTS node_ai_models_agency ON node_ai_models(agency_id,status)"
  ]) await db.query(sql);
}
