-- Documents
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT REFERENCES debts(id),
  client_id TEXT REFERENCES clients(id),

  type TEXT NOT NULL CHECK(type IN ('contract', 'invoice', 'delivery_proof', 'communication', 'demand_letter', 'attorney_letter', 'payment_agreement', 'settlement', 'other')),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  uploaded_by TEXT REFERENCES users(id),
  uploaded_at INTEGER NOT NULL,

  template_id TEXT,
  generated BOOLEAN DEFAULT FALSE
);

-- Communications (Email, SMS, Letters)
CREATE TABLE communications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT REFERENCES debts(id),

  type TEXT NOT NULL CHECK(type IN ('email', 'sms', 'letter', 'portal_message', 'phone_call')),
  direction TEXT NOT NULL CHECK(direction IN ('outbound', 'inbound')),

  subject TEXT,
  content TEXT NOT NULL,

  from_user_id TEXT REFERENCES users(id),
  to_email TEXT,
  to_phone TEXT,

  sent_at INTEGER,
  delivered_at INTEGER,
  read_at INTEGER,
  replied_at INTEGER,

  letter_type TEXT CHECK(letter_type IN ('initial', 'reminder', 'attorney', 'final')),
  signed_by TEXT REFERENCES users(id),
  tracking_number TEXT,

  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'read')),

  metadata TEXT,
  created_at INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX idx_documents_debt ON documents(debt_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_communications_debt ON communications(debt_id);
CREATE INDEX idx_communications_tenant ON communications(tenant_id);
