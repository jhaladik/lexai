# LexAI - Receivables Collection Platform

White-label SaaS platform for law firms to offer automated receivables collection services.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Cloudflare Workers, Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Cache**: Cloudflare KV
- **Auth**: Cloudflare Access
- **Monorepo**: Turborepo + pnpm

## Project Structure

```
lexai/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Cloudflare Workers API
├── packages/
│   ├── database/     # D1 schema & migrations
│   ├── shared/       # Shared types & utilities
│   └── ui/           # Shared UI components (future)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Cloudflare account
- Wrangler CLI

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Create Cloudflare D1 database:
```bash
wrangler d1 create lexai-db
```

4. Update `wrangler.toml` with your database ID

5. Run migrations:
```bash
pnpm db:migrate:local
```

6. Start development servers:
```bash
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8787

## Database Migrations

Create new migration:
```bash
cd packages/database
pnpm migrate:create <migration_name>
```

Apply migrations (local):
```bash
pnpm db:migrate:local
```

Apply migrations (production):
```bash
pnpm db:migrate
```

## Deployment

### Frontend (Cloudflare Pages)
```bash
cd apps/web
pnpm build
wrangler pages deploy dist
```

### API (Cloudflare Workers)
```bash
cd apps/api
pnpm deploy
```

## Features

- Multi-tenant architecture
- Client onboarding with ARES integration
- Debt ingestion (single & bulk CSV)
- AI-powered mediation (GPT-4)
- Attorney review workflow
- Payment processing (Stripe, GoPay)
- Automated payment plans
- Dispute handling
- Document management (R2)
- Email/SMS notifications (SMTP2GO)
- PDF generation & e-signatures
- White-label customization
- Multi-language support (CS, SK, EN, DE)

## Environment Variables

See `.env.example` for all required environment variables.

### Secrets Management

Set secrets for Workers:
```bash
wrangler secret put SMTP2GO_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put JWT_SECRET
```

## Development Workflow

1. Create feature branch
2. Make changes
3. Test locally
4. Commit to GitHub
5. CI/CD will deploy to preview
6. Merge to main for production deploy

## License

Proprietary - All rights reserved
