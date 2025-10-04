-- Migration: Add debtor-client relationship tracking for hybrid verification
-- Version: 0008

-- Track verified relationships between debtors and clients
-- Once a debtor-client relationship is verified, future debts can be fast-tracked
CREATE TABLE debtor_client_relationships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debtor_id TEXT NOT NULL REFERENCES debtors(id),
  client_id TEXT NOT NULL REFERENCES clients(id),

  -- Verification info
  verified BOOLEAN DEFAULT FALSE,
  verified_at INTEGER,
  verified_by TEXT REFERENCES users(id),

  -- Relationship details
  relationship_type TEXT CHECK(relationship_type IN ('contract', 'ongoing_service', 'one_time', 'lease', 'other')),
  contract_reference TEXT, -- Contract number or reference
  contract_start_date INTEGER,
  contract_end_date INTEGER,

  -- Trust level based on history
  trust_level TEXT DEFAULT 'new' CHECK(trust_level IN ('new', 'trusted', 'verified', 'flagged')),
  total_debts_count INTEGER DEFAULT 0,
  total_paid_amount INTEGER DEFAULT 0,
  total_disputed_count INTEGER DEFAULT 0,

  -- Notes from attorney
  verification_notes TEXT,

  -- Timestamps
  first_debt_date INTEGER,
  last_debt_date INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,

  UNIQUE(tenant_id, debtor_id, client_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_debtor_client_rel_debtor ON debtor_client_relationships(debtor_id);
CREATE INDEX idx_debtor_client_rel_client ON debtor_client_relationships(client_id);
CREATE INDEX idx_debtor_client_rel_verified ON debtor_client_relationships(verified);
CREATE INDEX idx_debtor_client_rel_trust ON debtor_client_relationships(trust_level);
