# LexAI - Next Development Steps

## ✅ Completed (Foundation)

- [x] Project structure (monorepo with Turborepo + pnpm)
- [x] Database schema (23 tables, 5 migrations)
- [x] Cloudflare D1 database created & migrated
- [x] Cloudflare R2 bucket for documents
- [x] Cloudflare KV namespace for caching
- [x] API deployed (Workers): https://lexai-api.jhaladik.workers.dev
- [x] Frontend deployed (Pages): https://lexai.pages.dev
- [x] First tenant created (JHaladik Law Firm)
- [x] Admin user created (jhaladik@gmail.com)
- [x] Local deployment workflow (deploy.bat)

**Status:** Foundation 100% complete, ready to build features

---

## 🎯 Development Priorities

### Phase 1: Authentication & API Connection (Week 1)

**Priority: HIGH** - Can't do anything without auth!

1. **Cloudflare Access Setup**
   - [ ] Configure Zero Trust application
   - [ ] Set up access policy for jhaladik@gmail.com
   - [ ] Get JWT validation working in Workers

2. **API Authentication Middleware**
   - [ ] Implement JWT validation
   - [ ] Extract user ID and tenant ID from token
   - [ ] Protect all API routes except /health

3. **Frontend Authentication**
   - [ ] Create auth context/store (Zustand)
   - [ ] Implement login redirect to Cloudflare Access
   - [ ] Store and use auth token
   - [ ] Handle logout

4. **Connect Dashboard to API**
   - [ ] Create API client (fetch wrapper)
   - [ ] Implement /api/v1/dashboard endpoint
   - [ ] Fetch stats (total debts, active, collected)
   - [ ] Display real data instead of zeros

**Estimated time:** 2-3 days
**Outcome:** You can log in and see your empty dashboard

---

### Phase 2: Client Onboarding (Week 1-2)

**Priority: HIGH** - Need clients before debts

1. **Client Registration Form**
   - [ ] Create /clients/new page
   - [ ] Form: company name, IČO, email, address
   - [ ] Client-side validation with Zod

2. **ARES Integration**
   - [ ] Implement IČO lookup API endpoint
   - [ ] Auto-fill company details from ARES
   - [ ] Show validation errors

3. **Client Verification (Layer 1 Fraud)**
   - [ ] Check if IČO is valid and active
   - [ ] Check insolvency status
   - [ ] Calculate credibility score
   - [ ] Create client record in DB

4. **Client List & Detail Pages**
   - [ ] /clients list with table
   - [ ] /clients/:id detail view
   - [ ] Show verification status
   - [ ] Approve/reject actions for attorney

**Estimated time:** 3-4 days
**Outcome:** You can add and verify clients

---

### Phase 3: Debt Ingestion (Week 2-3)

**Priority: HIGH** - Core feature

1. **Single Debt Upload**
   - [ ] Create /debts/new page
   - [ ] Select client from dropdown
   - [ ] Enter debtor info (or lookup if business)
   - [ ] Debt details form (amount, dates, type)
   - [ ] Document upload to R2

2. **Fraud Detection Layer 2**
   - [ ] Implement fraud score calculation
   - [ ] Check for duplicate debtors
   - [ ] Validate amounts vs. industry average
   - [ ] Flag suspicious debts for attorney review

3. **Debt List & Detail**
   - [ ] /debts list with filters
   - [ ] /debts/:id detail view
   - [ ] Status badges
   - [ ] Timeline of actions

4. **Document Viewer**
   - [ ] View uploaded documents from R2
   - [ ] PDF preview
   - [ ] Download with presigned URLs

**Estimated time:** 4-5 days
**Outcome:** You can upload debts and review them

---

### Phase 4: Attorney Review Workflow (Week 3-4)

**Priority: MEDIUM** - Needed before going live

1. **Review Queue**
   - [ ] /attorney/review page
   - [ ] List debts pending review
   - [ ] Sort by fraud score
   - [ ] Bulk actions

2. **Review Decision**
   - [ ] Approve/reject debt
   - [ ] Add notes
   - [ ] Request more info from client
   - [ ] Update debt status

3. **Email Notifications**
   - [ ] SMTP2GO integration
   - [ ] Email templates (Czech)
   - [ ] Send on status changes
   - [ ] Track delivery

**Estimated time:** 2-3 days
**Outcome:** Attorney workflow functional

---

### Phase 5: Debtor Communication (Week 4-5)

**Priority: MEDIUM** - Start collection process

1. **Initial Debt Notice**
   - [ ] Generate unique portal link for debtor
   - [ ] Email template with debt details
   - [ ] SMS notification
   - [ ] Track opens/clicks

2. **Debtor Portal**
   - [ ] Token-based access (no login)
   - [ ] View debt details
   - [ ] View documents
   - [ ] Three action buttons (Pay, Plan, Dispute)

3. **Payment Processing**
   - [ ] Stripe integration
   - [ ] Payment intent creation
   - [ ] Handle success/failure
   - [ ] Update debt status
   - [ ] Send receipt

**Estimated time:** 4-5 days
**Outcome:** Debtors can view and pay debts

---

### Phase 6: Payment Plans (Week 5-6)

**Priority: MEDIUM**

1. **Manual Payment Plan Creation**
   - [ ] Create plan form
   - [ ] Calculate installments
   - [ ] Generate agreement document
   - [ ] E-signature workflow

2. **Payment Plan Automation**
   - [ ] Cron job for reminders
   - [ ] Auto-charge on due date
   - [ ] Track overdue payments
   - [ ] Acceleration on default

**Estimated time:** 3-4 days

---

### Phase 7: AI Mediation (Week 6-8)

**Priority: LOW** - Can wait, manual negotiation works initially

1. **OpenAI Integration**
   - [ ] Set up GPT-4 API
   - [ ] Create mediation prompt
   - [ ] Conversation interface

2. **AI Mediation Flow**
   - [ ] Initiate from debtor portal
   - [ ] Chat with AI
   - [ ] Propose payment plans
   - [ ] Escalate to human if needed

**Estimated time:** 5-6 days

---

### Phase 8: Bulk Upload & Advanced Features (Week 8+)

**Priority: LOW** - Once core features work

- [ ] CSV bulk upload
- [ ] Attorney letter generation
- [ ] Czech Post certified mail
- [ ] Dispute handling
- [ ] Advanced analytics
- [ ] White-label customization

---

## 📝 Recommended Order

**Start with this sequence:**

1. **Authentication** (can't do anything without it)
2. **Connect dashboard to API** (see it working)
3. **Client onboarding** (need clients)
4. **Single debt upload** (core feature)
5. **Debtor portal + payment** (start collecting)
6. **Everything else** (iterate based on feedback)

---

## 🚀 Quick Start for Next Session

```bash
# Start local development
pnpm dev

# Frontend: http://localhost:5173
# API: http://localhost:8787

# When ready to deploy
deploy.bat
```

---

## 📊 Current State

**Database:**
- 23 tables created
- 1 tenant (JHaladik Law Firm)
- 1 user (jhaladik@gmail.com)
- 0 clients
- 0 debts

**URLs:**
- API: https://lexai-api.jhaladik.workers.dev
- Frontend: https://lexai.pages.dev
- GitHub: https://github.com/jhaladik/lexai

**Next:** Implement authentication so you can actually use the app!

---

Ready to start building features! 🎉
