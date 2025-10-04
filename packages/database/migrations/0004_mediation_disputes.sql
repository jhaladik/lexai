-- Mediation Sessions
CREATE TABLE mediation_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),

  initiated_by TEXT CHECK(initiated_by IN ('client', 'debtor', 'system')),
  mediator_id TEXT REFERENCES users(id),

  type TEXT DEFAULT 'ai' CHECK(type IN ('ai', 'human')),

  ai_conversation TEXT,
  ai_proposal TEXT,

  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'ai_completed', 'escalated_to_human', 'agreement_reached', 'failed', 'cancelled')),

  outcome TEXT CHECK(outcome IN ('payment_plan_agreed', 'full_payment_agreed', 'no_agreement', 'dispute_raised')),
  outcome_details TEXT,

  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Mediation Messages
CREATE TABLE mediation_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES mediation_sessions(id),

  sender_type TEXT NOT NULL CHECK(sender_type IN ('ai', 'mediator', 'debtor', 'client')),
  sender_id TEXT REFERENCES users(id),

  message TEXT NOT NULL,
  message_type TEXT CHECK(message_type IN ('text', 'proposal', 'question', 'agreement')),

  metadata TEXT,
  created_at INTEGER NOT NULL
);

-- Disputes
CREATE TABLE disputes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),

  raised_by TEXT NOT NULL CHECK(raised_by IN ('debtor', 'debtor_representative')),
  raised_by_user_id TEXT REFERENCES users(id),

  dispute_type TEXT NOT NULL CHECK(dispute_type IN ('amount_incorrect', 'never_received', 'quality_issue', 'already_paid', 'contract_dispute', 'fraud_claim', 'other')),

  description TEXT NOT NULL,
  supporting_documents TEXT,

  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at INTEGER,

  created_at INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX idx_mediation_sessions_debt ON mediation_sessions(debt_id);
CREATE INDEX idx_mediation_sessions_tenant ON mediation_sessions(tenant_id);
CREATE INDEX idx_mediation_messages_session ON mediation_messages(session_id);
CREATE INDEX idx_disputes_debt ON disputes(debt_id);
CREATE INDEX idx_disputes_tenant ON disputes(tenant_id);
