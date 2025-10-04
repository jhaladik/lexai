# Receivables Collection Platform - Technical Specification
## Version 1.0 - Czech Republic & Slovakia Markets

---

## 1. EXECUTIVE SUMMARY

### 1.1 Product Overview
A white-label SaaS platform for law firms to offer automated receivables collection services for debts under 100,000 CZK. The platform automates the collection workflow from initial client onboarding through attorney demand letters, payment negotiation, and final resolution.

### 1.2 Target Markets
**Primary:** Van/Equipment Rental, Construction Materials Wholesale, Industrial Supplies  
**Secondary:** E-commerce, Food Distribution, Print Services  
**Geographic:** Czech Republic, Slovakia (with cross-border support for AT, DE, PL)

### 1.3 Core Value Proposition
- Automated multi-stage collection process
- AI-powered payment negotiation with human escalation
- Two-layer fraud prevention system
- White-label branding for law firms
- Multi-language support (CS, SK, EN, DE)

---

## 2. TECHNICAL STACK

### 2.1 Frontend
- **Framework:** React 18+ with TypeScript
- **UI Library:** Tailwind CSS + shadcn/ui components
- **State Management:** React Query + Zustand
- **Forms:** React Hook Form + Zod validation
- **i18n:** react-i18next

### 2.2 Backend
- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **File Storage:** Cloudflare R2
- **Cache:** Cloudflare KV
- **API:** RESTful + tRPC

### 2.3 Third-Party Services
- **Payment Processing:** Stripe (primary), GoPay (Czech market)
- **SMS/Email:** Twilio SendGrid
- **PDF Generation:** @react-pdf/renderer or Puppeteer
- **AI Mediation:** OpenAI API (GPT-4)
- **ARES Integration:** Czech Business Registry API
- **Authentication:** Clerk or Cloudflare Access

### 2.4 Deployment
- **Hosting:** Cloudflare Pages (frontend) + Workers (backend)
- **CDN:** Cloudflare Global CDN
- **DNS:** Cloudflare DNS with white-label subdomain support
- **SSL:** Automated SSL certificates via Cloudflare

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                       │
├─────────────────────────────────────────────────────────┤
│  Pages (Frontend)  │  Workers (API)  │  KV Cache        │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────┐      ┌──────▼──────┐    ┌──────▼──────┐
    │ D1 DB  │      │ R2 Storage  │    │  External   │
    │        │      │ (Documents) │    │   APIs      │
    └────────┘      └─────────────┘    └─────────────┘
                                        - Stripe
                                        - Twilio
                                        - OpenAI
                                        - ARES
```

### 3.2 Multi-Tenancy Architecture
- Each law firm = separate tenant with subdomain (e.g., `lawfirm.collectio.app`)
- Tenant ID in all database tables for data isolation
- White-label branding stored per tenant (logo, colors, domain)
- Row-level security enforced at database and API layer

---

## 4. DATABASE SCHEMA

### 4.1 Core Tables

```sql
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
  monthly_debt_limit INTEGER DEFAULT 10, -- Number of debts allowed per month initially
  total_debt_limit INTEGER, -- Total value limit
  verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected', 'flagged')),
  verification_date INTEGER,
  verified_by TEXT REFERENCES users(id),
  credibility_score INTEGER DEFAULT 50, -- 0-100
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
  total_debts_value INTEGER DEFAULT 0, -- in smallest currency unit (haléře)
  created_at INTEGER NOT NULL
);

-- Debts
CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  debtor_id TEXT NOT NULL REFERENCES debtors(id),
  
  -- Debt details
  reference_number TEXT, -- Client's invoice/contract number
  debt_type TEXT NOT NULL CHECK(debt_type IN ('invoice', 'lease', 'rental', 'service', 'damage', 'other')),
  original_amount INTEGER NOT NULL, -- in haléře
  current_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'CZK',
  
  -- Dates
  invoice_date INTEGER NOT NULL,
  due_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending_verification', 'verified', 'initial_letter_sent', 'attorney_review', 'attorney_letter_sent', 'in_mediation', 'payment_plan_active', 'payment_plan_defaulted', 'resolved_paid', 'resolved_partial', 'written_off', 'litigation', 'disputed')),
  substatus TEXT, -- More granular status
  
  -- Supporting documents
  has_contract BOOLEAN DEFAULT FALSE,
  has_invoice BOOLEAN DEFAULT FALSE,
  has_delivery_proof BOOLEAN DEFAULT FALSE,
  has_communication_log BOOLEAN DEFAULT FALSE,
  
  -- Verification
  verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'approved', 'rejected', 'flagged')),
  verification_date INTEGER,
  verified_by TEXT REFERENCES users(id),
  verification_notes TEXT,
  fraud_score INTEGER DEFAULT 0, -- 0-100, higher = more suspicious
  
  -- Assignment
  assigned_attorney TEXT REFERENCES users(id),
  assigned_mediator TEXT REFERENCES users(id),
  
  -- Payment tracking
  total_paid INTEGER DEFAULT 0,
  last_payment_date INTEGER,
  
  -- Metadata
  notes TEXT,
  tags TEXT -- JSON array
);

-- Documents
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT REFERENCES debts(id),
  client_id TEXT REFERENCES clients(id),
  
  type TEXT NOT NULL CHECK(type IN ('contract', 'invoice', 'delivery_proof', 'communication', 'demand_letter', 'attorney_letter', 'payment_agreement', 'settlement', 'other')),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL, -- R2 URL
  file_size INTEGER,
  mime_type TEXT,
  
  uploaded_by TEXT REFERENCES users(id),
  uploaded_at INTEGER NOT NULL,
  
  -- For generated documents
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
  
  -- Sender/Recipient
  from_user_id TEXT REFERENCES users(id),
  to_email TEXT,
  to_phone TEXT,
  
  -- Tracking
  sent_at INTEGER,
  delivered_at INTEGER,
  read_at INTEGER,
  replied_at INTEGER,
  
  -- Letter specifics
  letter_type TEXT CHECK(letter_type IN ('initial', 'reminder', 'attorney', 'final')),
  signed_by TEXT REFERENCES users(id), -- For attorney letters
  tracking_number TEXT, -- For certified mail
  
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  
  metadata TEXT, -- JSON for provider-specific data
  created_at INTEGER NOT NULL
);

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
  
  -- Agreement
  agreed_by_client BOOLEAN DEFAULT FALSE,
  agreed_by_debtor BOOLEAN DEFAULT FALSE,
  agreement_date INTEGER,
  agreement_document_id TEXT REFERENCES documents(id),
  
  -- Acceleration clause
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
  payment_id TEXT, -- Reference to payment processor
  
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
  
  -- Payment processor data
  processor TEXT, -- 'stripe', 'gopay', 'manual'
  processor_payment_id TEXT,
  processor_status TEXT,
  
  -- Distribution
  client_amount INTEGER, -- Amount going to client
  platform_fee INTEGER, -- Platform fee
  attorney_fee INTEGER, -- Attorney fee
  
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  
  metadata TEXT -- JSON
);

-- Mediation Sessions
CREATE TABLE mediation_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  debt_id TEXT NOT NULL REFERENCES debts(id),
  
  initiated_by TEXT CHECK(initiated_by IN ('client', 'debtor', 'system')),
  mediator_id TEXT REFERENCES users(id),
  
  type TEXT DEFAULT 'ai' CHECK(type IN ('ai', 'human')),
  
  -- AI mediation data
  ai_conversation TEXT, -- JSON of full conversation
  ai_proposal TEXT, -- JSON of proposed payment plan
  
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'ai_completed', 'escalated_to_human', 'agreement_reached', 'failed', 'cancelled')),
  
  outcome TEXT CHECK(outcome IN ('payment_plan_agreed', 'full_payment_agreed', 'no_agreement', 'dispute_raised')),
  outcome_details TEXT, -- JSON
  
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
  
  metadata TEXT, -- JSON
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
  supporting_documents TEXT, -- JSON array of document IDs
  
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution TEXT,
  resolved_by TEXT REFERENCES users(id),
  resolved_at INTEGER,
  
  created_at INTEGER NOT NULL
);

-- Audit Log
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  entity_type TEXT NOT NULL, -- 'debt', 'client', 'payment', etc.
  entity_id TEXT NOT NULL,
  
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed'
  
  user_id TEXT REFERENCES users(id),
  user_role TEXT,
  
  old_value TEXT, -- JSON
  new_value TEXT, -- JSON
  
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
  value TEXT NOT NULL, -- JSON value
  UNIQUE(tenant_id, category, key)
);

-- Fraud Detection Rules
CREATE TABLE fraud_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('debtor_duplicate', 'amount_threshold', 'velocity', 'missing_documents', 'suspicious_pattern', 'blacklist_match')),
  
  conditions TEXT NOT NULL, -- JSON
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
  
  link TEXT, -- Deep link to relevant page
  
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
  
  variables TEXT, -- JSON array of available variables
  
  default_template BOOLEAN DEFAULT FALSE,
  
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Webhooks
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array of event types to subscribe to
  
  secret TEXT NOT NULL, -- For signature verification
  
  active BOOLEAN DEFAULT TRUE,
  
  created_at INTEGER NOT NULL
);

-- Webhook Logs
CREATE TABLE webhook_logs (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id),
  
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  
  response_code INTEGER,
  response_body TEXT,
  
  success BOOLEAN,
  retry_count INTEGER DEFAULT 0,
  
  created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_debts_client ON debts(client_id);
CREATE INDEX idx_debts_debtor ON debts(debtor_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_tenant ON debts(tenant_id);
CREATE INDEX idx_communications_debt ON communications(debt_id);
CREATE INDEX idx_payments_debt ON payments(debt_id);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
```

---

## 5. USER ROLES & PERMISSIONS

### 5.1 Role Definitions

**ADMIN (Platform Owner)**
- Manage tenants
- View all data across tenants
- Configure global settings
- Access to all features

**ATTORNEY**
- Review flagged debts
- Approve/sign attorney letters
- Assign cases to attorney employees
- View all client data within tenant
- Manage mediators
- Configure fees and pricing

**ATTORNEY_EMPLOYEE (Paralegal)**
- Draft letters
- Review debts assigned to them
- Update case notes
- Cannot sign attorney letters
- Can escalate to attorney

**CLIENT (Business Owner)**
- Upload debts (individual/bulk)
- View own portfolio
- Approve actions
- View reports
- Manage employees
- Configure payment details

**CLIENT_EMPLOYEE**
- Upload debts (within limits)
- View debts they created
- Limited reporting
- Cannot configure settings

**MEDIATOR**
- View assigned mediation cases
- Facilitate negotiations
- Propose payment plans
- Mark mediation outcomes
- Cannot access unrelated debts

**DEBTOR**
- View debts against them
- Make payments
- Initiate mediation
- Upload dispute evidence
- Accept payment plans
- View communication history

**DEBTOR_REPRESENTATIVE**
- All debtor permissions
- Act on debtor's behalf
- Must be authorized by debtor

### 5.2 Permission Matrix

```
Feature                          | Admin | Attorney | Atty_Emp | Client | Client_Emp | Mediator | Debtor
---------------------------------|-------|----------|----------|--------|------------|----------|--------
Create Debt                      |   ✓   |    ✓     |    ✓     |   ✓    |     ✓      |    ✗     |   ✗
View All Debts                   |   ✓   |    ✓     |    ✗     |   ✗    |     ✗      |    ✗     |   ✗
View Own Debts                   |   ✓   |    ✓     |    ✓     |   ✓    |     ✓      |    ✗     |   ✓
Approve Debt                     |   ✓   |    ✓     |    ✗     |   ✗    |     ✗      |    ✗     |   ✗
Sign Attorney Letter             |   ✓   |    ✓     |    ✗     |   ✗    |     ✗      |    ✗     |   ✗
Send Letter                      |   ✓   |    ✓     |    ✓     |   ✓    |     ✓      |    ✗     |   ✗
View Payment Details             |   ✓   |    ✓     |    ✓     |   ✓    |     ✗      |    ✗     |   ✓
Process Payment                  |   ✓   |    ✓     |    ✓     |   ✗    |     ✗      |    ✗     |   ✓
Create Payment Plan              |   ✓   |    ✓     |    ✓     |   ✓    |     ✗      |    ✓     |   ✗
Accept Payment Plan              |   ✓   |    ✓     |    ✗     |   ✓    |     ✗      |    ✗     |   ✓
Initiate Mediation               |   ✓   |    ✓     |    ✓     |   ✓    |     ✗      |    ✗     |   ✓
Conduct Mediation                |   ✓   |    ✓     |    ✗     |   ✗    |     ✗      |    ✓     |   ✗
Raise Dispute                    |   ✓   |    ✗     |    ✗     |   ✗    |     ✗      |    ✗     |   ✓
Resolve Dispute                  |   ✓   |    ✓     |    ✗     |   ✗    |     ✗      |    ✗     |   ✗
Manage Users                     |   ✓   |    ✓     |    ✗     |   ✓*   |     ✗      |    ✗     |   ✗
Configure Settings               |   ✓   |    ✓     |    ✗     |   ✓*   |     ✗      |    ✗     |   ✗
View Reports                     |   ✓   |    ✓     |    ✓     |   ✓    |     ✓**    |    ✗     |   ✗
Export Data                      |   ✓   |    ✓     |    ✓     |   ✓    |     ✗      |    ✗     |   ✗

* Limited to own employees/settings
** Limited reports only
```

---

## 6. DETAILED FEATURE SPECIFICATIONS

### 6.1 Client Onboarding & Verification

**Feature ID:** F001  
**Priority:** P0 (Critical)

**User Story:**
As a new client, I want to register my business so I can start using the collection platform.

**Flow:**
1. Client fills registration form:
   - Company name
   - IČO (Registration number)
   - DIČ (VAT number) - optional
   - Contact person details
   - Address
   - Industry sector
   - Email & phone

2. System validates:
   - Email uniqueness
   - IČO format (8 digits)
   - Fetches company data from ARES API

3. System runs Fraud Check Layer 1:
   - Check if IČO is valid and active
   - Check if company is in insolvency
   - Check blacklist database
   - Assign credibility score (0-100)

4. If passes automated checks:
   - Status: `pending_verification`
   - Send email to attorney for manual review
   - Notify client of pending status

5. Attorney reviews:
   - Company documents
   - Background check results
   - Industry risk profile
   - Approves/rejects with notes

6. If approved:
   - Status: `verified`
   - Assign initial debt limits (10 debts/month, 100k CZK total)
   - Send welcome email with login credentials
   - Grant access to platform

**Acceptance Criteria:**
- [ ] ARES integration fetches correct company data
- [ ] Invalid IČO shows error before submission
- [ ] Attorney receives notification within 1 minute
- [ ] Client receives status update emails at each step
- [ ] Credibility score calculated based on public data
- [ ] Form supports both CZ and SK registration numbers

**API Endpoints:**
```
POST /api/clients/register
GET  /api/clients/:id/verification-status
PUT  /api/clients/:id/verify
GET  /api/integrations/ares/:ico
```

---

### 6.2 Debt Ingestion (Individual)

**Feature ID:** F002  
**Priority:** P0 (Critical)

**User Story:**
As a client, I want to submit a single debt for collection so the system can start the recovery process.

**Flow:**
1. Client navigates to "New Debt" form
2. Selects or creates debtor:
   - If business: IČO lookup via ARES
   - If individual: Manual entry
   - System checks if debtor already exists

3. Enters debt details:
   - Debt type (invoice, lease, rental, service, damage)
   - Reference number
   - Amount (in CZK)
   - Invoice date
   - Due date
   - Description/notes

4. Uploads supporting documents (minimum 1 required):
   - Contract/lease agreement
   - Invoice
   - Delivery proof
   - Communication log

5. System validates:
   - Required fields present
   - Amount within client's limits
   - Due date in past
   - At least one document uploaded

6. Fraud Check Layer 2 runs:
   - Debtor duplicate check (same debtor from multiple clients)
   - Amount reasonableness (vs. industry average)
   - Missing critical documents
   - Suspicious pattern detection
   - Calculate fraud_score (0-100)

7. If fraud_score > 70:
   - Status: `pending_verification` with flag
   - Assign to attorney for review
   - Notify client of review delay

8. If fraud_score < 70:
   - Status: `verified`
   - Schedule initial letter for next business day
   - Decrement client's debt limit counter

9. Send confirmation to client

**Acceptance Criteria:**
- [ ] Form validates all required fields
- [ ] File upload supports PDF, JPG, PNG (max 10MB each)
- [ ] ARES lookup auto-fills debtor business details
- [ ] Amount input formatted with currency
- [ ] Date pickers prevent future due dates
- [ ] Duplicate debtor warning shown
- [ ] Fraud score visible to attorney (not client)
- [ ] Documents stored in R2 with unique URLs
- [ ] Audit log created for debt creation

**API Endpoints:**
```
POST /api/debts
POST /api/debts/:id/documents
GET  /api/debtors/search?q=...
POST /api/debtors
GET  /api/debts/:id/fraud-check
```

---

### 6.3 Debt Ingestion (Bulk Upload)

**Feature ID:** F003  
**Priority:** P1 (High)

**User Story:**
As a client, I want to upload multiple debts via CSV so I can efficiently process large volumes.

**Flow:**
1. Client downloads CSV template with required columns:
   - debtor_type (individual/business)
   - debtor_ico (for business) OR debtor_first_name, debtor_last_name (for individual)
   - debtor_email
   - debtor_phone
   - debtor_address
   - debtor_city
   - debtor_postal_code
   - debt_type
   - reference_number
   - amount
   - invoice_date (YYYY-MM-DD)
   - due_date (YYYY-MM-DD)
   - description

2. Client fills CSV and uploads file

3. System validates CSV:
   - Column headers match template
   - Required fields present in all rows
   - Date formats correct
   - Amount is numeric
   - Maximum 500 rows per upload

4. For each row:
   - Look up or create debtor
   - Create debt record
   - Run fraud check
   - Track results

5. After processing:
   - Generate report showing:
     - Total rows processed
     - Successfully created debts
     - Flagged for review
     - Errors (with row numbers)

6. Send email to client with results summary and link to detailed report

7. Flagged debts go to attorney review queue

**Acceptance Criteria:**
- [ ] CSV template downloadable with example data
- [ ] CSV validation shows specific error messages
- [ ] Progress indicator during upload
- [ ] Partial success supported (some debts created, some failed)
- [ ] Detailed error report exportable
- [ ] Bulk uploads don't exceed client's monthly limit
- [ ] Processing happens asynchronously (no timeout)
- [ ] Email notification includes statistics

**API Endpoints:**
```
GET  /api/debts/bulk-template
POST /api/debts/bulk-upload
GET  /api/debts/bulk-upload/:id/status
GET  /api/debts/bulk-upload/:id/report
```

---

### 6.4 Initial Debt Notification (to Debtor)

**Feature ID:** F004  
**Priority:** P0 (Critical)

**User Story:**
As a debtor, I want to receive notification of the debt against me so I can respond appropriately.

**Flow:**
1. System triggers notification when debt status = `verified`
2. Sends multi-channel notification:
   - Email (primary)
   - SMS (if phone provided)

3. Email/SMS contains:
   - Creditor name (client company)
   - Debt amount and reference
   - Due date
   - Brief description
   - **Unique access link** to debtor portal (no login required initially)

4. Debtor clicks link → lands on debt detail page showing:
   - Full debt details
   - Uploaded documents (viewable)
   - Payment amount due
   - Three action buttons:
     a) **Pay Now** → Payment gateway
     b) **Request Payment Plan** → Mediation flow
     c) **Dispute This Debt** → Dispute form

5. System tracks:
   - Email sent_at
   - Email delivered_at
   - Email read_at (via tracking pixel)
   - Link clicked_at
   - Action taken

6. If no response within 10 days:
   - Status → `attorney_review`
   - Assign to attorney queue

**Acceptance Criteria:**
- [ ] Email sent within 1 hour of debt verification
- [ ] Email template branded with tenant logo/colors
- [ ] SMS includes shortened link
- [ ] Unique portal link valid for 90 days
- [ ] No login required for initial view
- [ ] Portal supports CS, SK, EN languages
- [ ] Payment button shows amount in local currency
- [ ] Documents viewable but not downloadable (watermarked)
- [ ] Tracking pixel records open time
- [ ] Email retry logic if delivery fails

**API Endpoints:**
```
POST /api/debts/:id/notify-debtor
GET  /api/portal/:token
GET  /api/communications/:debtId/tracking
```

**Templates Required:**
- Email template (CS, SK, EN, DE)
- SMS template (CS, SK, EN, DE)

---

### 6.5 Attorney Letter Generation & Sending

**Feature ID:** F005  
**Priority:** P0 (Critical)

**User Story:**
As an attorney, I want to review and sign demand letters so they carry legal weight.

**Flow:**
1. When debt reaches `attorney_review` status, it appears in attorney's queue

2. Attorney reviews:
   - Debt details
   - Supporting documents
   - Communication history
   - Fraud check results

3. Attorney decides:
   - **Approve** → Generate attorney letter
   - **Reject** → Close case with reason
   - **Request More Info** → Send back to client

4. If approved, system generates attorney letter:
   - Pre-populated template with debt details
   - Attorney can edit text
   - Must include legal disclaimers
   - Auto-fills attorney name and credentials
   - Generates PDF with law firm letterhead

5. Attorney reviews PDF and signs electronically:
   - E-signature captured
   - Timestamp recorded
   - PDF locked (no further edits)

6. Delivery method selection:
   - Email (standard)
   - Certified mail (Czech Post/Slovak Post integration)
   - Both

7. Letter sent:
   - Email with PDF attachment
   - Track delivery status
   - 15-day response deadline set

8. Communication record created with:
   - Letter type: 'attorney'
   - Signed by: attorney_id
   - Sent date
   - Tracking number (if mail)

9. Debt status → `attorney_letter_sent`

10. Start 15-day countdown timer

**Acceptance Criteria:**
- [ ] Queue shows oldest debts first
- [ ] Attorney can bulk-approve similar cases
- [ ] Letter template supports custom clauses
- [ ] PDF generation includes law firm branding
- [ ] E-signature legally valid (eIDAS compliant)
- [ ] Email tracking confirms delivery
- [ ] Certified mail integration with Czech Post API
- [ ] Letter automatically translated to debtor's language
- [ ] Copy sent to client for transparency
- [ ] Deadline reminder at day 10 and day 14

**API Endpoints:**
```
GET  /api/attorney/review-queue
PUT  /api/debts/:id/attorney-decision
POST /api/debts/:id/attorney-letter
POST /api/attorney-letters/:id/sign
POST /api/attorney-letters/:id/send
```

**Required Integrations:**
- Czech Post API for certified mail
- Slovak Post API
- PDF generation library
- E-signature service (qualified electronic signature)

---

### 6.6 AI-Powered Mediation

**Feature ID:** F006  
**Priority:** P1 (High)

**User Story:**
As a debtor, I want to negotiate a payment plan through an AI chatbot so I can resolve the debt affordably.

**Flow:**
1. Debtor clicks "Request Payment Plan" from portal

2. AI Mediation Bot initiates conversation:
   - Greeting in debtor's language
   - Explains the process
   - Confirms debt amount

3. Bot asks discovery questions:
   - "What is your current financial situation?"
   - "What amount can you afford to pay monthly?"
   - "Do you have any other debts or obligations?"
   - "When could you make a down payment?"

4. Based on responses, bot proposes payment plan options:
   - Option 1: Down payment + 6 monthly installments
   - Option 2: No down payment + 12 monthly installments
   - Option 3: Custom plan

5. Debtor selects option or proposes custom terms

6. Bot evaluates proposal against business rules:
   - Minimum down payment required
   - Maximum installment period
   - Total amount must cover debt + fees
   - Acceptable payment dates

7. If acceptable:
   - Generate draft payment agreement
   - Send to client for approval
   - If client approves → Send to debtor for signature

8. If not acceptable:
   - Bot makes counter-offer
   - Up to 3 rounds of negotiation

9. If agreement reached:
   - Create payment_plan record
   - Generate agreement PDF
   - E-signature workflow for both parties
   - Status → `payment_plan_active`

10. If no agreement after 3 rounds OR debtor requests:
    - Escalate to human mediator
    - Session type → `escalated_to_human`
    - Mediator receives notification

**Acceptance Criteria:**
- [ ] Bot conversation feels natural (uses GPT-4)
- [ ] Supports CS, SK, EN, DE languages
- [ ] Bot responses within 3 seconds
- [ ] Conversation history saved
- [ ] Bot cannot agree to unreasonable terms
- [ ] Client notification required for final approval
- [ ] Agreement includes acceleration clause
- [ ] Payment schedule clearly displayed
- [ ] Debtor can save draft and return later
- [ ] Conversation transcript exportable

**AI Prompts:**
```
System Prompt:
You are a professional mediator helping debtors create payment plans.
Be empathetic but firm. Your goal is to find a mutually acceptable solution.

Debt Amount: {amount} CZK
Client: {client_name}
Debtor: {debtor_name}

Business Rules:
- Minimum down payment: {min_down_payment}% of debt
- Maximum installments: {max_installments} months
- Minimum monthly payment: {min_monthly} CZK
- Late fee per missed payment: {late_fee} CZK

Ask about the debtor's financial situation and propose fair payment plans.
If debtor proposes unacceptable terms, explain why and counter-offer.
Do not agree to terms outside the business rules.
```

**API Endpoints:**
```
POST /api/mediation/start
POST /api/mediation/:sessionId/message
GET  /api/mediation/:sessionId/history
POST /api/mediation/:sessionId/proposal
PUT  /api/mediation/:sessionId/escalate
```

---

### 6.7 Payment Plan Management & Automation

**Feature ID:** F007  
**Priority:** P0 (Critical)

**User Story:**
As a system, I want to automatically charge installments and handle defaults so payments are collected reliably.

**Flow:**
1. When payment plan status = `active`:
   - Generate installment records based on schedule
   - Create calendar reminders

2. **3 days before due date:**
   - Send reminder email to debtor
   - Include payment link
   - Show outstanding amount

3. **On due date:**
   - Attempt automatic charge (if card on file)
   - If successful:
     - Mark installment as `paid`
     - Update debt total_paid
     - Send receipt
   - If failed:
     - Retry after 2 hours
     - Send payment failed email

4. **2 days after due date (if still unpaid):**
   - Mark installment as `overdue`
   - Send urgent payment notice
   - Grace period starts

5. **5 days after due date (grace period ends):**
   - **ACCELERATION TRIGGERED**
   - Entire remaining balance becomes due immediately
   - Payment plan status → `defaulted`
   - Debt status → `payment_plan_defaulted`
   - Add default fee to total
   - Send acceleration notice to debtor
   - Re-assign to attorney queue
   - Attorney letter process restarts

6. Throughout process:
   - Client receives updates on payment status
   - Dashboard shows upcoming installments
   - Reports track collection rate

**Acceptance Criteria:**
- [ ] Automatic charges attempt at 9 AM tenant timezone
- [ ] Retry logic handles temporary card failures
- [ ] Grace period configurable per tenant
- [ ] Acceleration clause clearly stated in agreement
- [ ] Default fee added to remaining balance
- [ ] Partial payments accepted (manual)
- [ ] Debtor can make early payment without penalty
- [ ] Email reminders sent reliably
- [ ] Failed payment retries logged
- [ ] Client can waive default manually

**API Endpoints:**
```
GET  /api/payment-plans/:id/installments
POST /api/installments/:id/charge
POST /api/installments/:id/record-payment
PUT  /api/payment-plans/:id/accelerate
GET  /api/payment-plans/:id/status
```

**Scheduled Jobs (Cloudflare Cron):**
```
# Run daily at 6 AM UTC
0 6 * * * - Send reminder emails (3 days before due)
0 7 * * * - Process automatic charges (on due date)
0 8 * * * - Check overdue installments
0 9 * * * - Trigger acceleration (5 days past due)
```

---

### 6.8 Dispute Handling

**Feature ID:** F008  
**Priority:** P1 (High)

**User Story:**
As a debtor, I want to dispute a debt with evidence so incorrect debts are not pursued.

**Flow:**
1. Debtor clicks "Dispute This Debt" from portal

2. Dispute form shows:
   - Debt details (read-only)
   - Dispute type dropdown:
     - Amount is incorrect
     - Never received goods/services
     - Quality issue with delivery
     - Already paid
     - Contract dispute
     - Fraud/scam claim
     - Other
   - Description (required, min 50 characters)
   - File upload (supporting evidence)

3. Debtor submits dispute

4. System actions:
   - Debt status → `disputed`
   - PAUSE all collection activities:
     - No letters sent
     - No payment plan charges
     - Timeline frozen
   - Create dispute record
   - Notify attorney immediately
   - Notify client of dispute

5. Attorney reviews dispute:
   - Reviews evidence from both sides
   - Can request additional info from client or debtor
   - Makes decision:
     - **Uphold dispute** → Close/adjust debt
     - **Reject dispute** → Resume collection
     - **Partial resolution** → Adjust amount

6. If upheld:
   - Debt amount adjusted or closed
   - Resolution email sent to both parties
   - Refund process if payment was made

7. If rejected:
   - Detailed reason provided to debtor
   - Collection process resumes
   - Debt status returns to previous state
   - Add dispute handling fee (optional)

8. All actions logged in audit trail

**Acceptance Criteria:**
- [ ] Dispute immediately pauses collection
- [ ] File upload supports multiple documents
- [ ] Attorney receives email within 5 minutes
- [ ] Client can view dispute details
- [ ] Both parties can upload additional evidence
- [ ] Attorney decision requires written explanation
- [ ] Debtor receives decision within 48 hours
- [ ] If debt adjusted, client notified of impact
- [ ] Dispute resolution document generated
- [ ] Cannot dispute already resolved debts

**API Endpoints:**
```
POST /api/debts/:id/dispute
GET  /api/disputes/:id
POST /api/disputes/:id/evidence
PUT  /api/disputes/:id/resolve
GET  /api/attorney/disputes
```

---

### 6.9 Payment Processing

**Feature ID:** F009  
**Priority:** P0 (Critical)

**User Story:**
As a debtor, I want to pay my debt securely online so I can resolve it quickly.

**Flow:**
1. Debtor clicks "Pay Now" from portal

2. Payment page shows:
   - Debt details
   - Amount due
   - Payment methods:
     - Credit/Debit Card (via Stripe)
     - Bank Transfer (GoPay for CZ/SK)
     - Full or partial payment option

3. Debtor enters payment details:
   - Card number (if card payment)
   - Or selects bank (if bank transfer)
   - Amount (if partial payment allowed)

4. Payment processing:
   - 3D Secure authentication for cards
   - Redirect to bank for bank transfers
   - Process payment via Stripe/GoPay API

5. If successful:
   - Create payment record
   - Update debt current_amount
   - If fully paid:
     - Debt status → `resolved_paid`
     - Generate satisfaction letter
     - Send to both parties
   - If partially paid:
     - Update amount
     - Send receipt

6. Fee distribution:
   - Total payment = X CZK
   - Platform fee = Y% (configurable)
   - Attorney fee = Z% (configurable)
   - Client receives = X - Y - Z
   - All recorded in payments table

7. Payout to client:
   - Batched daily (for multiple payments)
   - Transfer to client's bank account
   - Statement sent

8. Receipt generation:
   - PDF receipt auto-generated
   - Emailed to debtor
   - Includes tax details

**Acceptance Criteria:**
- [ ] PCI DSS compliant (handled by Stripe)
- [ ] Supports CZK, EUR currencies
- [ ] GoPay integration for local banks
- [ ] Partial payments tracked correctly
- [ ] Failed payments retry gracefully
- [ ] Fee breakdown transparent
- [ ] Client receives payout within 1 business day
- [ ] Receipt includes all tax info (DPH)
- [ ] Payment confirmation email instant
- [ ] Refunds supported (manual approval)

**API Endpoints:**
```
POST /api/payments/intent
POST /api/payments/process
GET  /api/payments/:id/status
POST /api/payments/:id/refund
GET  /api/clients/:id/payouts
```

**Integrations:**
- Stripe Payment Intents API
- GoPay REST API
- PDF receipt generator

---

### 6.10 White Label Configuration

**Feature ID:** F010  
**Priority:** P1 (High)

**User Story:**
As a law firm (tenant), I want to customize the platform with my branding so it appears as my own service.

**Settings Available:**

1. **Branding:**
   - Company name
   - Logo upload (header, favicon)
   - Primary color (hex)
   - Secondary color (hex)
   - Custom CSS (advanced)

2. **Domain:**
   - Subdomain (e.g., `lawfirm.collectio.app`)
   - Custom domain (e.g., `collections.lawfirm.cz`)
   - SSL certificate auto-provisioned

3. **Contact Information:**
   - Support email
   - Phone number
   - Physical address
   - Business hours

4. **Legal Details:**
   - Attorney name and credentials
   - Bar association number
   - Jurisdiction
   - Legal disclaimers

5. **Email Templates:**
   - Email footer
   - Signature
   - Unsubscribe preferences

6. **Notifications:**
   - Email notification preferences
   - SMS gateway settings
   - Webhook URLs

7. **Fees & Pricing:**
   - Platform fee %
   - Attorney fee %
   - Late payment fee
   - Dispute handling fee
   - Payment processing markup

**Acceptance Criteria:**
- [ ] Logo shows in header, emails, PDFs
- [ ] Colors applied throughout UI
- [ ] Custom domain requires DNS verification
- [ ] SSL auto-renews via Cloudflare
- [ ] Preview mode before applying changes
- [ ] Revert to previous settings option
- [ ] Email templates support variables
- [ ] Changes reflected immediately
- [ ] No cross-tenant data leakage

**API Endpoints:**
```
GET  /api/tenants/:id/settings
PUT  /api/tenants/:id/settings/branding
PUT  /api/tenants/:id/settings/domain
PUT  /api/tenants/:id/settings/fees
POST /api/tenants/:id/settings/logo
```

---

## 7. INTEGRATIONS

### 7.1 ARES (Czech Business Registry)

**Purpose:** Validate and auto-fill company information

**Endpoint:** `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`

**Flow:**
1. User enters IČO (8 digits)
2. System calls ARES API
3. Parse response and extract:
   - Company name (obchodniJmeno)
   - Address (sidlo)
   - Legal form (pravniForma)
   - Status (stavZdroje)
4. Auto-fill form fields
5. Show warning if company in insolvency

**Error Handling:**
- IČO not found → Allow manual entry
- API timeout → Retry once, then allow manual
- Invalid response → Log error, allow manual

**Caching:**
- Cache company data in KV for 24 hours
- Reduce API calls for repeat lookups

---

### 7.2 Czech Post / Slovak Post Integration

**Purpose:** Send certified mail letters

**Czech Post API:**
- Endpoint: Czech Post Poštovní služby API
- Authentication: API key
- Service: Doporučená zásilka (Registered mail)

**Features:**
- Generate shipping label
- Track delivery status
- Proof of delivery

**Implementation:**
- Generate PDF letter
- Call API to create shipment
- Receive tracking number
- Poll for delivery status updates
- Store proof of delivery

---

### 7.3 Payment Gateways

**Stripe:**
- Payment Intents API for card payments
- 3D Secure 2.0 support
- Webhooks for payment status
- Connect for split payments (platform fee)

**GoPay:**
- Czech/Slovak bank transfers
- E-wallet support
- Real-time bank connection
- Lower fees than cards

**Implementation:**
- Dual gateway support
- Let debtor choose payment method
- Unified payment record in database
- Webhook handling for async updates

---

### 7.4 OpenAI API (AI Mediation)

**Model:** GPT-4 Turbo
**Use Case:** Mediation chatbot

**Implementation:**
```javascript
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage }
  ],
  temperature: 0.7,
  max_tokens: 500
});
```

**Cost Management:**
- Cache system prompts
- Limit conversation to 10 turns
- Summarize long conversations
- Monitor token usage per tenant

---

## 8. USER INTERFACE SPECIFICATIONS

### 8.1 Design System

**Colors:**
- Primary: Configurable per tenant (default: #3b82f6)
- Secondary: Configurable (default: #1e40af)
- Success: #10b981
- Warning: #f59e0b
- Error: #ef4444
- Neutral: Tailwind gray scale

**Typography:**
- Font Family: Inter (web-safe fallback to Arial)
- Headings: Bold, sizes from text-xl to text-4xl
- Body: text-base (16px)
- Small: text-sm (14px)

**Components:**
- Use shadcn/ui component library
- Consistent spacing (Tailwind scale)
- Rounded corners (rounded-lg default)
- Shadows for depth (shadow-md, shadow-lg)

### 8.2 Key Screens

**Dashboard (Client View):**
```
┌─────────────────────────────────────────────┐
│  [Logo]  Collection Platform      [Profile] │
├─────────────────────────────────────────────┤
│                                              │
│  Total Debts: 127    │  Active: 89          │
│  Total Value: 2.4M CZK │ Collected: 1.8M   │
│                                              │
│  ┌──────────────┐ ┌──────────────┐          │
│  │ Recent Debts │ │ Status Chart │          │
│  │              │ │              │          │
│  │ [Table]      │ │ [Pie Chart]  │          │
│  └──────────────┘ └──────────────┘          │
│                                              │
│  Quick Actions:                              │
│  [+ New Debt] [Upload CSV] [View Reports]   │
└─────────────────────────────────────────────┘
```

**Debt List View:**
- Filterable by status, date range, amount
- Sortable columns
- Bulk actions (send reminder, export)
- Search by reference number or debtor name
- Status badges with colors

**Debt Detail View:**
- Left panel: Debt information
- Center: Timeline of actions
- Right panel: Quick actions
- Tabs: Documents, Communications, Payments, Notes

**Attorney Review Queue:**
- Kanban board view or list view toggle
- Columns: Pending, In Review, Approved, Rejected
- Drag-and-drop to change status
- Bulk approve similar cases
- Fraud score indicator

**Debtor Portal:**
- Clean, minimal interface
- No authentication required (token-based)
- Large action buttons
- Mobile-responsive
- Available in CS, SK, EN, DE

### 8.3 Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Mobile Considerations:**
- Stack components vertically
- Hamburger menu for navigation
- Bottom navigation bar
- Touch-friendly button sizes (min 44px)
- Simplified tables (card view)

---

## 9. SECURITY REQUIREMENTS

### 9.1 Authentication & Authorization

**Authentication:**
- Email + password (bcrypt hashed, 12 rounds)
- Multi-factor authentication (TOTP) for attorneys
- Session management via JWT tokens
- Token expiry: 24 hours (refresh tokens 30 days)

**Authorization:**
- Role-based access control (RBAC)
- Row-level security (tenant_id filter)
- API endpoint protection
- Deny by default principle

### 9.2 Data Protection

**Encryption:**
- At rest: D1 database encrypted by default
- In transit: TLS 1.3 minimum
- Sensitive fields: Additional AES-256 encryption
  - Card details (not stored, tokens only)
  - Bank account numbers
  - IČO/Personal ID numbers

**Personal Data Handling (GDPR):**
- Data retention policy enforced
- Right to deletion supported
- Data export functionality
- Consent tracking
- Privacy policy acceptance required

### 9.3 Input Validation

- All inputs sanitized
- SQL injection prevention (parameterized queries)
- XSS prevention (content security policy)
- File upload restrictions:
  - Type whitelist: PDF, JPG, PNG
  - Size limit: 10MB per file
  - Virus scanning (ClamAV or similar)
  - Filename sanitization

### 9.4 Rate Limiting

- API: 100 requests/minute per user
- Login: 5 attempts per 15 minutes
- Password reset: 3 attempts per hour
- File upload: 10 files per hour

### 9.5 Audit Logging

- All sensitive actions logged
- IP address and user agent captured
- Log retention: 2 years minimum
- Tamper-proof (append-only)
- Regular export to external storage

---

## 10. PERFORMANCE REQUIREMENTS

### 10.1 Response Times

- Page load: < 2 seconds (p95)
- API response: < 500ms (p95)
- Database query: < 100ms (p95)
- File upload: < 5 seconds for 10MB

### 10.2 Scalability

- Support 100 tenants initially
- 10,000 debts per tenant
- 1,000 concurrent users
- Horizontal scaling via Cloudflare Workers

### 10.3 Availability

- Uptime: 99.9% SLA
- Planned maintenance windows: < 4 hours/month
- Automated failover
- Daily backups with point-in-time recovery

---

## 11. LOCALIZATION

### 11.1 Supported Languages

- Czech (cs) - Primary
- Slovak (sk)
- English (en)
- German (de) - For cross-border

### 11.2 Translation Keys

**Structure:**
```json
{
  "common": {
    "submit": "Submit",
    "cancel": "Cancel",
    "save": "Save"
  },
  "debts": {
    "title": "Debts",
    "new_debt": "New Debt",
    "status": {
      "draft": "Draft",
      "verified": "Verified"
    }
  }
}
```

### 11.3 Currency & Date Formatting

- CZK: 1 234,56 Kč (Czech format)
- EUR: €1,234.56
- Dates: DD.MM.YYYY (Czech/Slovak)
- Dates: MM/DD/YYYY (English)
- Times: 24-hour format

### 11.4 Legal Text Localization

- Terms of service per country
- Privacy policy (GDPR compliant)
- Collection notices (jurisdiction-specific)
- Email templates per language

---

## 12. NOTIFICATIONS & ALERTS

### 12.1 Email Notifications

**Trigger Events:**
1. Client registered (welcome email)
2. Debt created (confirmation to client)
3. Debt notification sent (to debtor)
4. Payment received (receipt to debtor, update to client)
5. Attorney letter sent (copy to client)
6. Dispute raised (alert to attorney & client)
7. Payment plan agreed (agreement to both parties)
8. Installment due (reminder to debtor)
9. Payment plan defaulted (notice to debtor, alert to client)
10. Debt resolved (satisfaction letter to both)

**Email Infrastructure:**
- SendGrid API
- Templating engine (Handlebars)
- Branded templates per tenant
- Unsubscribe link (required)
- Open/click tracking

### 12.2 SMS Notifications

**Trigger Events:**
1. Debt notification (initial contact)
2. Payment reminder (3 days before due)
3. Overdue payment (2 days after due)
4. Payment received (confirmation)
5. Dispute resolution (outcome)

**SMS Gateway:**
- Twilio API
- Character limit: 160 per SMS
- Shortened URLs for links
- Opt-out support

### 12.3 In-App Notifications

**Bell icon with badge:**
- Unread count
- Notification panel dropdown
- Mark as read
- Link to relevant page

**Real-time Updates:**
- Server-Sent Events (SSE) or WebSockets
- Update on payment received
- Update on attorney action

---

## 13. REPORTING & ANALYTICS

### 13.1 Client Reports

**Dashboard Metrics:**
- Total debts submitted
- Total value submitted
- Collection rate %
- Average days to collection
- Payment plan success rate
- Dispute rate

**Exportable Reports:**
1. **Debt Summary Report**
   - All debts with status
   - Filterable by date range
   - Export to CSV/PDF

2. **Collection Performance**
   - Monthly collection trends
   - Success rate by debt type
   - Attorney performance metrics

3. **Financial Report**
   - Total collected
   - Fees paid
   - Outstanding balance
   - Payment distribution

### 13.2 Attorney Analytics

- Debts reviewed per day
- Average review time
- Approval vs rejection rate
- Collection success rate per attorney
- Workload distribution

### 13.3 Platform Analytics (Admin)

- Tenant growth
- Total debts processed
- Revenue (platform fees)
- System health metrics
- API usage by tenant

---

## 14. WORKFLOW AUTOMATION

### 14.1 Scheduled Jobs (Cron Triggers)

**Cloudflare Workers Cron:**

```javascript
// Runs every day at 6 AM UTC
export default {
  async scheduled(event, env, ctx) {
    switch (event.cron) {
      case '0 6 * * *':
        await sendPaymentReminders(env);
        break;
      case '0 7 * * *':
        await processAutoCharges(env);
        break;
      case '0 8 * * *':
        await checkOverdueInstallments(env);
        break;
      case '0 9 * * *':
        await triggerAccelerations(env);
        break;
      case '0 10 * * *':
        await checkDeadlines(env);
        break;
    }
  }
}
```

### 14.2 Event-Driven Triggers

**Database Triggers:**
- On debt status change → Notify relevant parties
- On payment received → Update totals, check if fully paid
- On dispute raised → Pause collection
- On attorney letter sent → Start deadline timer

**Webhook Triggers:**
- Payment success → Update debt, send receipt
- Payment failed → Retry logic, notify client
- Email bounced → Mark email invalid, try SMS

---

## 15. API SPECIFICATION

### 15.1 API Design Principles

- RESTful conventions
- JSON request/response
- Versioning: `/api/v1/...`
- Consistent error format
- Pagination for lists
- Rate limiting headers

### 15.2 Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0"
      }
    ]
  }
}
```

**Error Codes:**
- 400: Bad Request (validation error)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (not authorized)
- 404: Not Found
- 409: Conflict (duplicate resource)
- 422: Unprocessable Entity
- 429: Too Many Requests (rate limit)
- 500: Internal Server Error

### 15.3 Sample API Endpoints

```
# Authentication
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/reset-password

# Clients
GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/clients/:id
PUT    /api/v1/clients/:id
DELETE /api/v1/clients/:id
PUT    /api/v1/clients/:id/verify

# Debts
GET    /api/v1/debts?status=active&page=1&limit=50
POST   /api/v1/debts
GET    /api/v1/debts/:id
PUT    /api/v1/debts/:id
DELETE /api/v1/debts/:id
POST   /api/v1/debts/bulk-upload
GET    /api/v1/debts/:id/timeline

# Documents
POST   /api/v1/debts/:debtId/documents
GET    /api/v1/documents/:id
DELETE /api/v1/documents/:id

# Communications
GET    /api/v1/debts/:debtId/communications
POST   /api/v1/communications

# Payments
POST   /api/v1/payments/intent
POST   /api/v1/payments
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/refund

# Payment Plans
POST   /api/v1/payment-plans
GET    /api/v1/payment-plans/:id
PUT    /api/v1/payment-plans/:id
POST   /api/v1/payment-plans/:id/accept

# Mediation
POST   /api/v1/mediation/sessions
POST   /api/v1/mediation/sessions/:id/messages
GET    /api/v1/mediation/sessions/:id

# Disputes
POST   /api/v1/disputes
GET    /api/v1/disputes/:id
PUT    /api/v1/disputes/:id/resolve

# Reports
GET    /api/v1/reports/debt-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
GET    /api/v1/reports/collection-performance
GET    /api/v1/reports/financial

# Settings
GET    /api/v1/settings
PUT    /api/v1/settings/branding
PUT    /api/v1/settings/fees

# Users
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
```

---

## 16. DEPLOYMENT ARCHITECTURE

### 16.1 Cloudflare Setup

**Frontend (Cloudflare Pages):**
- React build deployed to Pages
- Automatic builds on git push
- Preview deployments for branches
- Custom domain per tenant (wildcard DNS)

**Backend (Cloudflare Workers):**
- API routes as Workers
- Edge deployment (global)
- D1 database binding
- R2 storage binding
- KV namespace binding

**Database (Cloudflare D1):**
- SQLite-based
- Automatic backups
- Point-in-time recovery
- Read replicas for scaling

**Storage (Cloudflare R2):**
- S3-compatible object storage
- Store uploaded documents
- Generated PDFs
- Tenant logos
- Public bucket (with presigned URLs)

### 16.2 Environment Variables

```
# Cloudflare Workers
DATABASE_URL=d1://production-db
R2_BUCKET_NAME=collectio-documents
KV_NAMESPACE=collectio-cache

# External Services
STRIPE_SECRET_KEY=sk_live_...
GOPAY_CLIENT_ID=...
GOPAY_CLIENT_SECRET=...
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG....
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# App Config
JWT_SECRET=random-secret-key
PLATFORM_FEE_PERCENT=5
ATTORNEY_FEE_PERCENT=20
```

### 16.3 CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
```

**Stages:**
1. Lint & test
2. Build frontend
3. Deploy to Cloudflare Pages
4. Deploy Workers
5. Run database migrations
6. Smoke tests

---

## 17. TESTING REQUIREMENTS

### 17.1 Unit Tests

- All business logic functions
- Fraud detection algorithms
- Payment calculations
- Fee distribution logic
- Coverage target: 80%

### 17.2 Integration Tests

- API endpoints
- Database queries
- External API integrations
- Authentication flows
- Payment processing

### 17.3 E2E Tests

- Critical user flows:
  1. Client onboarding
  2. Debt submission
  3. Attorney review
  4. Debtor payment
  5. Payment plan creation
  6. Dispute handling

**Tools:**
- Playwright or Cypress
- Run on every PR
- Screenshot on failure

### 17.4 Load Testing

- Simulate 1,000 concurrent users
- Test bulk upload of 500 debts
- Test payment processing under load
- Identify bottlenecks

---

## 18. MONITORING & OBSERVABILITY

### 18.1 Logging

**Log Levels:**
- ERROR: System failures, exceptions
- WARN: Unexpected but handled events
- INFO: Important business events
- DEBUG: Detailed diagnostic info

**Logged Events:**
- All API requests
- Authentication attempts
- Payment transactions
- External API calls
- Fraud detections
- Email/SMS delivery

**Log Aggregation:**
- Cloudflare Workers Analytics
- Export to external service (Datadog, New Relic)
- Structured logging (JSON format)

### 18.2 Metrics

**Application Metrics:**
- Request count
- Response time (p50, p95, p99)
- Error rate
- Database query time
- External API latency

**Business Metrics:**
- Debts created per day
- Collection rate
- Payment plan success rate
- Dispute rate
- Revenue (fees collected)

### 18.3 Alerting

**Alert Conditions:**
1. Error rate > 5% for 5 minutes → Page on-call
2. API response time > 2s (p95) → Warn
3. Database connection failures → Page immediately
4. Payment processing failures > 10% → Page
5. Disk space > 80% → Warn

**Alert Channels:**
- Email
- Slack webhook
- PagerDuty (critical)

### 18.4 Health Checks

**Endpoints:**
```
GET /health
Response: {
  "status": "healthy",
  "version": "1.0.0",
  "database": "ok",
  "r2": "ok",
  "kv": "ok"
}
```

Run every 60 seconds from multiple regions.

---

## 19. DATA MIGRATION & IMPORT

### 19.1 Initial Data Import

Support importing existing debt data from:
- CSV files
- Excel spreadsheets
- Other collection systems (API)

**Import Wizard:**
1. Upload file
2. Map columns to fields
3. Preview data
4. Validate
5. Import with progress tracking
6. Error report

### 19.2 Tenant Onboarding Script

Automate creation of new tenant:
- Create tenant record
- Create admin user
- Set default settings
- Generate subdomain
- Send welcome email
- Create sample data (optional)

---

## 20. COMPLIANCE & LEGAL

### 20.1 GDPR Compliance

**Required Features:**
- Cookie consent banner
- Privacy policy acceptance
- Data export (all user data as JSON)
- Right to deletion (pseudonymize, not delete for legal retention)
- Data processing agreements (DPA) with clients
- Consent tracking
- Data breach notification workflow

### 20.2 Czech Collection Laws

- 30-day payment terms for food/agriculture (enforced)
- Certified mail for attorney letters
- Consumer protection laws (B2C)
- Interest on late payment (legal rate)
- Statute of limitations tracking (3 years general)

### 20.3 Data Retention

**Retention Periods:**
- Active debts: Indefinite
- Resolved debts: 5 years after resolution
- Payment records: 10 years (tax law)
- Communications: 5 years
- Audit logs: 7 years
- User accounts: Until deletion request + retention period

**Automatic Deletion:**
- Cron job runs monthly
- Identifies records past retention
- Archives to cold storage
- Deletes from production database
- Logs all deletions

---

## 21. FUTURE ENHANCEMENTS (Phase 2+)

### 21.1 Advanced Features

- **Mobile Apps:** iOS and Android native apps
- **Credit Bureau Integration:** Report debts to credit agencies
- **Litigation Management:** Track court cases, deadlines
- **Advanced Analytics:** ML-based collection prediction
- **Multi-currency:** Support EUR, USD
- **Recurring Debts:** Subscription/rent auto-processing
- **API for Clients:** Let clients integrate programmatically
- **White-label Mobile:** Custom branded apps per tenant

### 21.2 Geographic Expansion

- Poland integration
- Germany integration
- Austria integration
- EU-wide collection network

---

## 22. SUCCESS METRICS (KPIs)

### 22.1 Product Metrics

- Monthly Active Users (MAU)
- Debts processed per month
- Collection rate (% of debts fully paid)
- Average days to collection
- Payment plan completion rate
- Dispute resolution rate
- Platform uptime %

### 22.2 Business Metrics

- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV)
- Churn rate
- Net Promoter Score (NPS)

### 22.3 Target Benchmarks (Year 1)

- 20 tenants onboarded
- 50,000 debts processed
- 70% collection rate
- 30 days average to collection
- < 5% dispute rate
- 99.9% uptime

---

## 23. GLOSSARY

- **Tenant:** A law firm using the platform (white-label customer)
- **Client:** A business using the platform to collect debts (customer of the tenant)
- **Debtor:** Individual or business owing money
- **IČO:** Identifikační číslo osoby (Czech business registration number)
- **DIČ:** Daňové identifikační číslo (Tax ID number)
- **ARES:** Czech business registry API
- **Acceleration:** Making entire debt due after payment plan default
- **DSO:** Days Sales Outstanding
- **Grace Period:** Time after missed payment before acceleration
- **Fraud Score:** 0-100 score indicating likelihood of fraudulent debt
- **Credibility Score:** 0-100 score indicating client trustworthiness

---

## 24. APPENDICES

### A. Sample Data Structures

**Sample Debt JSON:**
```json
{
  "id": "debt_abc123",
  "tenant_id": "tenant_xyz",
  "client_id": "client_123",
  "debtor_id": "debtor_456",
  "reference_number": "INV-2025-001",
  "debt_type": "invoice",
  "original_amount": 5000000, // 50,000.00 CZK in haléře
  "current_amount": 5000000,
  "currency": "CZK",
  "invoice_date": 1704067200, // Unix timestamp
  "due_date": 1706745600,
  "created_at": 1709424000,
  "status": "attorney_letter_sent",
  "verification_status": "approved",
  "fraud_score": 15,
  "has_contract": true,
  "has_invoice": true,
  "assigned_attorney": "user_atty1"
}
```

### B. Email Template Examples

**Debt Notification (Czech):**
```
Předmět: Upomínka o nezaplacené pohledávce č. {reference_number}

Vážená paní/pane,

obracíme se na Vás jménem naší klientky {client_name} ve věci nezaplacené pohledávky ve výši {amount} Kč.

Číslo pohledávky: {reference_number}
Datum splatnosti: {due_date}
Dlužná částka: {amount} Kč

Pro zobrazení detailů a úhradu pohledávky klikněte zde:
{portal_link}

V portálu máte následující možnosti:
- Zaplatit celou částku
- Navrhnout splátkový kalendář
- Podat námitku s důkazy

S pozdravem,
{law_firm_name}
```

### C. Fraud Detection Algorithm

**Fraud Score Calculation:**
```javascript
function calculateFraudScore(debt, debtor, client) {
  let score = 0;
  
  // Check 1: Same debtor from multiple clients (10-30 points)
  if (debtor.total_debts_count > 3) {
    score += Math.min(30, debtor.total_debts_count * 5);
  }
  
  // Check 2: Amount significantly above average (10 points)
  const avgDebt = getAverageDebtForIndustry(client.industry);
  if (debt.original_amount > avgDebt * 3) {
    score += 10;
  }
  
  // Check 3: Missing critical documents (20 points)
  if (!debt.has_contract || !debt.has_invoice) {
    score += 20;
  }
  
  // Check 4: New client with low credibility (15 points)
  if (client.credibility_score < 30) {
    score += 15;
  }
  
  // Check 5: Debtor on blacklist (50 points - critical)
  if (debtor.blacklist_status === 'blacklisted') {
    score += 50;
  }
  
  // Check 6: Suspicious velocity (15 points)
  const recentDebts = getClientDebtsLast7Days(client.id);
  if (recentDebts.length > 20) {
    score += 15;
  }
  
  return Math.min(100, score);
}
```

---

**END OF SPECIFICATION**

---

This specification should provide Claude Code with all the necessary details to implement the platform. The document covers:
- Complete database schema
- All user roles and permissions
- Detailed feature specifications with flows
- Integration requirements
- UI/UX guidelines
- Security requirements
- API specifications
- Deployment architecture
- And much more

Next steps: Hand this to Claude Code along with any specific questions or clarifications needed for implementation.claude