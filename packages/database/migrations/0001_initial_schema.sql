-- LexAI Database Schema - Initial Migration
-- Version 1.0

-- Tenants (Law Firms)
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  language TEXT DEFAULT 'cs',
  timezone TEXT DEFAULT 'Europe/Prague',
  country TEXT DEFAULT 'CZ',
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'trial'))
);

-- Users (All user types)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'attorney', 'attorney_employee', 'client', 'client_employee', 'mediator', 'debtor', 'debtor_representative')),
  password_hash TEXT,
  language TEXT DEFAULT 'cs',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending')),
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  UNIQUE(tenant_id, email)
);

-- Clients (Businesses using the platform)
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  company_name TEXT NOT NULL,
  registration_number TEXT, -- IČO
  vat_number TEXT, -- DIČ
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'CZ',
  industry TEXT,
  monthly_debt_limit INTEGER DEFAULT 10,
  total_debt_limit INTEGER,
  verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected', 'flagged')),
  verification_date INTEGER,
  verified_by TEXT REFERENCES users(id),
  credibility_score INTEGER DEFAULT 50,
  created_at INTEGER NOT NULL
);

-- Debtors
CREATE TABLE debtors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL CHECK(type IN ('individual', 'business')),
  -- Individual fields
  first_name TEXT,
  last_name TEXT,
  birth_date INTEGER,
  -- Business fields
  company_name TEXT,
  registration_number TEXT,
  vat_number TEXT,
  -- Common fields
  email TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'CZ',
  language TEXT DEFAULT 'cs',
  -- Tracking
  blacklist_status TEXT DEFAULT 'none' CHECK(blacklist_status IN ('none', 'flagged', 'blacklisted')),
  blacklist_reason TEXT,
  total_debts_count INTEGER DEFAULT 0,
  total_debts_value INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Debts
CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  debtor_id TEXT NOT NULL REFERENCES debtors(id),

  reference_number TEXT,
  debt_type TEXT NOT NULL CHECK(debt_type IN ('invoice', 'lease', 'rental', 'service', 'damage', 'other')),
  original_amount INTEGER NOT NULL,
  current_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'CZK',

  invoice_date INTEGER NOT NULL,
  due_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,

  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_verification', 'verified', 'initial_letter_sent', 'attorney_review', 'attorney_letter_sent', 'in_mediation', 'payment_plan_active', 'payment_plan_defaulted', 'resolved_paid', 'resolved_partial', 'written_off', 'litigation', 'disputed')),
  substatus TEXT,

  has_contract BOOLEAN DEFAULT FALSE,
  has_invoice BOOLEAN DEFAULT FALSE,
  has_delivery_proof BOOLEAN DEFAULT FALSE,
  has_communication_log BOOLEAN DEFAULT FALSE,

  verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'approved', 'rejected', 'flagged')),
  verification_date INTEGER,
  verified_by TEXT REFERENCES users(id),
  verification_notes TEXT,
  fraud_score INTEGER DEFAULT 0,

  assigned_attorney TEXT REFERENCES users(id),
  assigned_mediator TEXT REFERENCES users(id),

  total_paid INTEGER DEFAULT 0,
  last_payment_date INTEGER,

  notes TEXT,
  tags TEXT
);

-- Create indexes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_debtors_tenant ON debtors(tenant_id);
CREATE INDEX idx_debts_client ON debts(client_id);
CREATE INDEX idx_debts_debtor ON debts(debtor_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_tenant ON debts(tenant_id);
