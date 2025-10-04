-- Audit Log
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),

  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,

  action TEXT NOT NULL,

  user_id TEXT REFERENCES users(id),
  user_role TEXT,

  old_value TEXT,
  new_value TEXT,

  ip_address TEXT,
  user_agent TEXT,

  created_at INTEGER NOT NULL
);

-- Settings
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE(tenant_id, category, key)
);

-- Fraud Detection Rules
CREATE TABLE fraud_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),

  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('debtor_duplicate', 'amount_threshold', 'velocity', 'missing_documents', 'suspicious_pattern', 'blacklist_match')),

  conditions TEXT NOT NULL,
  threshold INTEGER,
  severity TEXT DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),

  action TEXT DEFAULT 'flag' CHECK(action IN ('flag', 'block', 'review')),

  enabled BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL
);

-- Notifications Queue
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),

  type TEXT NOT NULL CHECK(type IN ('debt_created', 'payment_received', 'letter_sent', 'deadline_approaching', 'dispute_raised', 'system_alert')),

  title TEXT NOT NULL,
  message TEXT NOT NULL,

  link TEXT,

  read BOOLEAN DEFAULT FALSE,
  read_at INTEGER,

  created_at INTEGER NOT NULL
);

-- Templates
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),

  type TEXT NOT NULL CHECK(type IN ('email', 'sms', 'letter', 'document')),
  name TEXT NOT NULL,

  subject TEXT,
  content TEXT NOT NULL,

  language TEXT DEFAULT 'cs',

  variables TEXT,

  default_template BOOLEAN DEFAULT FALSE,

  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Webhooks
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),

  url TEXT NOT NULL,
  events TEXT NOT NULL,

  secret TEXT NOT NULL,

  active BOOLEAN DEFAULT TRUE,

  created_at INTEGER NOT NULL
);

-- Webhook Logs
CREATE TABLE webhook_logs (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id),

  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,

  response_code INTEGER,
  response_body TEXT,

  success BOOLEAN,
  retry_count INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_settings_tenant ON settings(tenant_id);
CREATE INDEX idx_fraud_rules_tenant ON fraud_rules(tenant_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_templates_tenant ON templates(tenant_id);
CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id);
