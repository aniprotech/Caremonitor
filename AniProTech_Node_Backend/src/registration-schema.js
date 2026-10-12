export async function initializeRegistration(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_agencies (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    legal_name text,
    business_type text NOT NULL,
    registration_number text,
    phone text NOT NULL,
    website text,
    address_line1 text NOT NULL,
    address_line2 text,
    state text,
    city text NOT NULL,
    postcode text NOT NULL,
    country text NOT NULL,
    timezone text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('PENDING','ACTIVE','SUSPENDED','REJECTED')),
    terms_accepted_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS node_agencies_name ON node_agencies(lower(name))");
  await db.query(`ALTER TABLE node_agencies
    ADD COLUMN IF NOT EXISTS state text,
    ADD COLUMN IF NOT EXISTS logo_path text,
    ADD COLUMN IF NOT EXISTS support_email text,
    ADD COLUMN IF NOT EXISTS support_phone text,
    ADD COLUMN IF NOT EXISTS carer_app_message text,
    ADD COLUMN IF NOT EXISTS carer_app_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_by uuid,
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid,
    ADD COLUMN IF NOT EXISTS review_notes text`);
  await db.query(`ALTER TABLE node_agencies DROP CONSTRAINT IF EXISTS node_agencies_status_check`);
  await db.query(`ALTER TABLE node_agencies ADD CONSTRAINT node_agencies_status_check
    CHECK(status IN ('PENDING','ACTIVE','SUSPENDED','REJECTED'))`);
  await db.query(`ALTER TABLE node_agencies
    ADD COLUMN IF NOT EXISTS nhs_ods_code text,
    ADD COLUMN IF NOT EXISTS nhs_ods_name text,
    ADD COLUMN IF NOT EXISTS nhs_ods_publication_status text NOT NULL DEFAULT 'NOT_CONFIGURED',
    ADD COLUMN IF NOT EXISTS nhs_ods_published_at date`);
  await db.query(`ALTER TABLE node_agencies DROP CONSTRAINT IF EXISTS node_agencies_nhs_ods_publication_status_check`);
  await db.query(`ALTER TABLE node_agencies ADD CONSTRAINT node_agencies_nhs_ods_publication_status_check
    CHECK(nhs_ods_publication_status IN ('NOT_CONFIGURED','ACTIVE_PENDING_PUBLICATION','PUBLISHED','UNVERIFIED'))`);
  // ODS allocated this identity to the Caremonitor operating organisation on
  // 12 October 2026. Preserve any value an administrator has already set.
  await db.query(`UPDATE node_agencies SET nhs_ods_code='W4L8U',nhs_ods_name='ANIKA IT SOLUTIONS LIMITED',
      nhs_ods_publication_status='ACTIVE_PENDING_PUBLICATION',updated_at=CURRENT_TIMESTAMP
    WHERE lower(coalesce(legal_name,''))='anika it solutions limited' AND nhs_ods_code IS NULL`);
}
