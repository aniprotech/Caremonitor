export async function initializeAccounting(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_accounting_contacts (
    id uuid PRIMARY KEY,
    agency_id uuid NOT NULL,
    display_name text NOT NULL,
    legal_name text NOT NULL DEFAULT '',
    contact_person text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    billing_address text NOT NULL DEFAULT '',
    company_number text NOT NULL DEFAULT '',
    vat_number text NOT NULL DEFAULT '',
    role text NOT NULL CHECK (role IN ('CUSTOMER','SUPPLIER','BOTH')),
    payer_type text NOT NULL DEFAULT 'OTHER' CHECK (payer_type IN ('INDIVIDUAL','FAMILY','INSURER','LOCAL_AUTHORITY','ORGANISATION','OTHER')),
    payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
    archived_at timestamptz,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (agency_id,id)
  )`);
  await db.query(`ALTER TABLE node_accounting_contacts
    ADD COLUMN IF NOT EXISTS payer_type text NOT NULL DEFAULT 'OTHER'
      CHECK (payer_type IN ('INDIVIDUAL','FAMILY','INSURER','LOCAL_AUTHORITY','ORGANISATION','OTHER'))`);
  await db.query(`CREATE INDEX IF NOT EXISTS node_accounting_contacts_agency_name
    ON node_accounting_contacts(agency_id,lower(display_name))`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS node_accounting_contacts_active_name
    ON node_accounting_contacts(agency_id,lower(display_name)) WHERE archived_at IS NULL`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_client_billing_defaults (
    agency_id uuid NOT NULL,
    client_id uuid NOT NULL REFERENCES users(id),
    payer_contact_id uuid,
    updated_by uuid NOT NULL REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agency_id,client_id),
    FOREIGN KEY (agency_id,payer_contact_id) REFERENCES node_accounting_contacts(agency_id,id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_accounting_items (
    id uuid PRIMARY KEY,
    agency_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    unit text NOT NULL DEFAULT 'each',
    unit_price_pence integer NOT NULL CHECK (unit_price_pence BETWEEN 0 AND 100000000),
    archived_at timestamptz,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (agency_id,id)
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS node_accounting_items_agency_name
    ON node_accounting_items(agency_id,lower(name))`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_accounting_tax_settings (
    agency_id uuid PRIMARY KEY,
    vat_number text NOT NULL CHECK (vat_number ~ '^[0-9]{9}$'),
    vat_effective_date date NOT NULL,
    verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED','VERIFIED')),
    updated_by uuid NOT NULL REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_salt_edge_customers (
    agency_id uuid PRIMARY KEY,
    customer_id text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_salt_edge_connection_attempts (
    state_hash text PRIMARY KEY,
    agency_id uuid NOT NULL,
    customer_id text NOT NULL,
    started_by uuid NOT NULL REFERENCES users(id),
    expires_at timestamptz NOT NULL,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_bank_transactions (
    agency_id uuid NOT NULL,provider_transaction_id text NOT NULL,
    provider_account_id text NOT NULL,booked_on date,
    description text NOT NULL DEFAULT '',amount_pence bigint NOT NULL,
    is_sandbox boolean NOT NULL DEFAULT true,
    currency text NOT NULL DEFAULT 'GBP',imported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(agency_id,provider_transaction_id)
  )`);
  await db.query(`ALTER TABLE node_bank_transactions ADD COLUMN IF NOT EXISTS
    is_sandbox boolean NOT NULL DEFAULT true`);
  await db.query(`CREATE INDEX IF NOT EXISTS node_bank_transactions_agency_date
    ON node_bank_transactions(agency_id,booked_on DESC)`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_invoice_payments (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,
    invoice_id uuid NOT NULL REFERENCES node_finance_documents(id),
    provider_transaction_id text NOT NULL,
    amount_pence bigint NOT NULL CHECK(amount_pence>0),
    paid_on date,reference text NOT NULL DEFAULT '',
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reversed_at timestamptz,reversed_by uuid REFERENCES users(id),
    reversal_reason text,
    FOREIGN KEY(agency_id,provider_transaction_id)
      REFERENCES node_bank_transactions(agency_id,provider_transaction_id)
  )`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS node_invoice_payments_active_transaction
    ON node_invoice_payments(agency_id,provider_transaction_id) WHERE reversed_at IS NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS node_invoice_payments_invoice
    ON node_invoice_payments(agency_id,invoice_id,created_at DESC)`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_manual_invoice_payments (
    id uuid PRIMARY KEY,agency_id uuid NOT NULL,
    invoice_id uuid NOT NULL REFERENCES node_finance_documents(id),
    amount_pence bigint NOT NULL CHECK(amount_pence>0),
    received_on date NOT NULL,
    method text NOT NULL CHECK(method IN ('BANK_TRANSFER','CASH','CHEQUE','OTHER')),
    reference text NOT NULL DEFAULT '',note text NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reversed_at timestamptz,reversed_by uuid REFERENCES users(id),
    reversal_reason text
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS node_manual_invoice_payments_invoice
    ON node_manual_invoice_payments(agency_id,invoice_id,created_at DESC)`);
}
