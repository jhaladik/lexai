-- Payment Plans
CREATE TABLE payment_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),

  total_amount INTEGER NOT NULL,
  down_payment INTEGER DEFAULT 0,
  installment_amount INTEGER NOT NULL,
  installment_count INTEGER NOT NULL,
  installment_frequency TEXT DEFAULT 'monthly' CHECK(installment_frequency IN ('weekly', 'biweekly', 'monthly')),

  start_date INTEGER NOT NULL,

  agreed_by_client BOOLEAN DEFAULT FALSE,
  agreed_by_debtor BOOLEAN DEFAULT FALSE,
  agreement_date INTEGER,
  agreement_document_id TEXT REFERENCES documents(id),

  acceleration_enabled BOOLEAN DEFAULT TRUE,
  grace_period_days INTEGER DEFAULT 5,

  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'proposed', 'active', 'completed', 'defaulted', 'cancelled')),
  default_date INTEGER,

  created_at INTEGER NOT NULL
);

-- Installments
CREATE TABLE installments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  payment_plan_id TEXT NOT NULL REFERENCES payment_plans(id),

  installment_number INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  due_date INTEGER NOT NULL,

  paid BOOLEAN DEFAULT FALSE,
  paid_amount INTEGER DEFAULT 0,
  paid_date INTEGER,
  payment_id TEXT,

  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'partial', 'overdue', 'waived'))
);

-- Payments
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),
  installment_id TEXT REFERENCES installments(id),

  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'CZK',

  payment_method TEXT CHECK(payment_method IN ('card', 'bank_transfer', 'cash', 'gopay', 'other')),

  processor TEXT,
  processor_payment_id TEXT,
  processor_status TEXT,

  client_amount INTEGER,
  platform_fee INTEGER,
  attorney_fee INTEGER,

  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),

  paid_at INTEGER,
  created_at INTEGER NOT NULL,

  metadata TEXT
);

-- Create indexes
CREATE INDEX idx_payment_plans_debt ON payment_plans(debt_id);
CREATE INDEX idx_payment_plans_tenant ON payment_plans(tenant_id);
CREATE INDEX idx_installments_plan ON installments(payment_plan_id);
CREATE INDEX idx_installments_tenant ON installments(tenant_id);
CREATE INDEX idx_payments_debt ON payments(debt_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
