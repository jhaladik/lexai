# LexAI - Project Overview

## What is LexAI?

LexAI is a white-label SaaS platform for law firms to offer automated receivables collection services for debts between 10,000 - 350,000 CZK in the Czech Republic and Slovakia markets.

## Core Value Proposition

1. **Automated Collection Workflow** - From debt ingestion to payment
2. **AI-Powered Mediation** - GPT-4 negotiates payment plans with debtors
3. **Two-Layer Fraud Prevention** - Protects law firms from fraudulent debts
4. **White-Label for Law Firms** - Each firm gets their own branded platform
5. **Multi-Language Support** - Czech, Slovak, English, German

## Technical Architecture

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **i18n**: react-i18next (CS, SK, EN, DE)
- **Hosting**: Cloudflare Pages

### Backend
- **Runtime**: Cloudflare Workers (serverless)
- **Framework**: Hono (fast, lightweight)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (documents)
- **Cache**: Cloudflare KV

### Third-Party Services
- **Email**: SMTP2GO
- **AI**: OpenAI GPT-4
- **Payments**: Stripe + GoPay (Czech market)
- **E-Signature**: node-signpdf (custom implementation)
- **Business Registry**: ARES API (Czech)

## Project Structure

```
lexai/
├── apps/
│   ├── web/              # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── i18n/
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── api/              # Cloudflare Workers
│       ├── src/
│       │   ├── routes/   # API endpoints
│       │   └── index.ts
│       └── wrangler.toml
│
├── packages/
│   ├── database/         # D1 migrations
│   │   └── migrations/
│   │       ├── 0001_initial_schema.sql
│   │       ├── 0002_documents_communications.sql
│   │       ├── 0003_payments_plans.sql
│   │       ├── 0004_mediation_disputes.sql
│   │       └── 0005_settings_audit.sql
│   │
│   └── shared/           # Shared types & utils
│       └── src/
│           ├── types/
│           ├── constants/
│           └── utils/
│
├── .github/
│   └── workflows/        # CI/CD
│
├── LexAI_specification.md   # Complete feature spec
├── SETUP.md                 # Detailed setup guide
├── QUICKSTART.md            # 5-minute quick start
└── README.md
```

## Database Schema (23 Tables)

### Core Entities
1. **tenants** - Law firms (multi-tenancy)
2. **users** - All user types (admin, attorney, client, debtor, etc.)
3. **clients** - Businesses with receivables
4. **debtors** - Individuals/businesses owing money
5. **debts** - Main debt records

### Supporting Tables
6. **documents** - Uploaded files (contracts, invoices, etc.)
7. **communications** - Email, SMS, letters
8. **payment_plans** - Installment agreements
9. **installments** - Individual payments in plan
10. **payments** - All payment transactions
11. **mediation_sessions** - AI/human mediation
12. **mediation_messages** - Conversation history
13. **disputes** - Debtor disputes
14. **audit_logs** - All actions logged
15. **settings** - Tenant configurations
16. **fraud_rules** - Fraud detection rules
17. **notifications** - In-app notifications
18. **templates** - Email/SMS/document templates
19. **webhooks** - External integrations
20. **webhook_logs** - Webhook delivery logs

## Key Features (from Specification)

### Phase 1 - Core Collection Flow
- ✅ Multi-tenant architecture
- ✅ Client onboarding with ARES validation
- ✅ Debt ingestion (single + bulk CSV)
- ✅ Two-layer fraud detection
- ✅ Attorney review queue
- ✅ Email/SMS notifications
- ✅ Debtor portal (token-based)
- ✅ Basic payment processing

### Phase 2 - Automation
- ⏳ AI-powered mediation (GPT-4)
- ⏳ Automated payment plans
- ⏳ Attorney letter generation
- ⏳ E-signature integration
- ⏳ Dispute handling
- ⏳ Czech Post certified mail

### Phase 3 - Scale & Polish
- ⏳ White-label customization
- ⏳ Advanced analytics
- ⏳ Mobile responsive
- ⏳ GoPay integration
- ⏳ Multi-language expansion

## User Roles & Permissions

1. **Admin** - Platform owner (you)
2. **Attorney** - Law firm owner, signs letters
3. **Attorney Employee** - Paralegal, drafts letters
4. **Client** - Business with receivables
5. **Client Employee** - Limited client access
6. **Mediator** - Facilitates negotiations
7. **Debtor** - Owes money
8. **Debtor Representative** - Acts on behalf of debtor

## Workflow Example

1. **Client uploads debt** → System validates and checks fraud score
2. **If suspicious** → Attorney reviews and approves/rejects
3. **If approved** → Initial letter sent to debtor via email/SMS
4. **Debtor responds:**
   - **Pay now** → Payment processed, case closed
   - **Request payment plan** → AI mediation starts
   - **Dispute debt** → Attorney reviews dispute
5. **AI mediation** → Negotiates payment plan (3 rounds max)
6. **If agreement** → Plan activated, auto-charges installments
7. **If default** → Acceleration triggered, attorney escalation
8. **Attorney sends legal letter** → Certified mail + e-signature
9. **Resolution:**
   - Paid → Case closed
   - No payment → Litigation (external)

## Revenue Model (for Law Firms)

**Client pays:**
- Monthly subscription: 2,000-5,000 CZK
- Per-debt fee: 500-1,000 CZK
- Success fee: 15-25% of collected amount

**Platform takes:**
- Platform fee: 5% of collected
- SaaS fee: Fixed monthly per tenant

## Development Roadmap

### Week 1-2: Foundation ✅
- [x] Project structure
- [x] Database schema
- [x] Basic authentication
- [x] Multi-tenancy setup

### Week 3-4: Core Features
- [ ] Client onboarding flow
- [ ] ARES integration
- [ ] Debt ingestion (single)
- [ ] Fraud detection Layer 1

### Week 5-6: Attorney Workflow
- [ ] Attorney dashboard
- [ ] Review queue
- [ ] Debt approval/rejection
- [ ] Email notifications

### Week 7-8: Debtor Experience
- [ ] Debtor portal
- [ ] Payment processing (Stripe)
- [ ] Basic payment plans
- [ ] Dispute submission

### Week 9-12: Automation
- [ ] AI mediation (GPT-4)
- [ ] Automated installments
- [ ] Letter generation
- [ ] Bulk CSV upload

### Week 13-16: Production Ready
- [ ] E-signatures
- [ ] White-label customization
- [ ] Advanced analytics
- [ ] Security audit
- [ ] Performance optimization

## Success Metrics (Year 1 Goals)

- **Tenants**: 20 law firms
- **Debts Processed**: 50,000
- **Collection Rate**: 70%+
- **Average Days to Collection**: < 30
- **Dispute Rate**: < 5%
- **Platform Uptime**: 99.9%

## Why This Tech Stack?

1. **Cloudflare Edge** - Global, fast, cost-effective
2. **D1 SQLite** - Simple, sufficient for volume, free tier generous
3. **Workers** - Serverless, scales automatically, no cold starts
4. **React + TypeScript** - Modern, type-safe, great DX
5. **Hono** - Fastest Workers framework, Express-like API
6. **pnpm + Turborepo** - Fast installs, efficient monorepo

## Cost Estimate (Monthly)

**Development:**
- Free tier covers everything initially
- Cloudflare Pages: Free
- Cloudflare Workers: Free (1M requests)
- D1: Free (5GB storage)
- R2: Free (10GB storage)

**Production (10 tenants, 1000 debts/month):**
- Cloudflare: $5-10 (after free tier)
- SMTP2GO: $10 (1000 emails)
- OpenAI: $20-50 (AI mediation)
- Stripe: 1.4% + 2 CZK per transaction
- **Total: ~$50-100/month**

## Next Steps

1. **Set up Cloudflare** - Create D1, R2, KV
2. **Configure secrets** - API keys for services
3. **Run migrations** - Set up database
4. **Implement features** - Start with client onboarding
5. **Test locally** - Validate workflow
6. **Deploy** - Push to production
7. **Onboard first tenant** - You as the test attorney!

## Files to Read

- **QUICKSTART.md** - Get running in 5 minutes
- **SETUP.md** - Complete setup instructions
- **LexAI_specification.md** - Full feature specification
- **README.md** - Project documentation

---

**Status**: ✅ Foundation complete, ready to build features!
