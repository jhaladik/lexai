# LexAI - Quick Start Guide

Get LexAI running in 5 minutes for local development.

## Prerequisites

- Node.js 18+ installed
- pnpm installed: `npm install -g pnpm`
- Cloudflare account (free tier works)
- Wrangler CLI: `npm install -g wrangler`

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Login to Cloudflare

```bash
wrangler login
```

## 3. Create D1 Database

```bash
wrangler d1 create lexai-db
```

**Copy the output** and update `apps/api/wrangler.toml`:
```toml
database_id = "paste-your-database-id-here"
```

## 4. Run Migrations

```bash
pnpm db:migrate:local
```

## 5. Create Test Tenant

```bash
# Get current timestamp in milliseconds
TIMESTAMP=$(date +%s)000

# Create tenant
wrangler d1 execute lexai-db --local --command="
INSERT INTO tenants (id, name, subdomain, created_at, status)
VALUES ('tenant_test', 'Your Law Firm', 'yourlawfirm', $TIMESTAMP, 'active');
"

# Create admin user
wrangler d1 execute lexai-db --local --command="
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, created_at, status)
VALUES ('user_admin', 'tenant_test', 'you@yourlawfirm.cz', 'Your', 'Name', 'admin', $TIMESTAMP, 'active');
"
```

## 6. Start Development

```bash
pnpm dev
```

This starts:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:8787

## 7. Test the API

```bash
# Health check
curl http://localhost:8787/health

# Should return:
# {"status":"healthy","version":"1.0.0","timestamp":"..."}
```

## 8. Open the App

Visit http://localhost:5173 in your browser.

You should see the LexAI login page!

## Next Steps

1. **Set up Cloudflare Access** - See `SETUP.md` for authentication
2. **Configure external services** - SMTP2GO, OpenAI, Stripe
3. **Implement features** - Start with client onboarding
4. **Deploy to production** - When ready, deploy to Cloudflare

## Troubleshooting

### "Module not found" errors
```bash
pnpm install
```

### Database errors
```bash
# Delete local database and recreate
rm -rf .wrangler/state/d1/
pnpm db:migrate:local
```

### Port already in use
- Frontend: Change port in `apps/web/vite.config.ts`
- API: Add `--port 8788` to wrangler dev command

### Can't reach API from frontend
- Check `apps/web/vite.config.ts` proxy settings
- Ensure API is running on port 8787

## Development Workflow

1. Make changes to code
2. Hot reload will update automatically
3. View logs in terminal
4. Test in browser

## Useful Commands

```bash
# View all debts in database
wrangler d1 execute lexai-db --local --command="SELECT * FROM debts"

# View all users
wrangler d1 execute lexai-db --local --command="SELECT * FROM users"

# Check API logs
# (logs appear in terminal where you ran pnpm dev)

# Build for production
pnpm build

# Type check
pnpm type-check
```

## What's Included

✅ Full monorepo structure
✅ Cloudflare Workers API (Hono framework)
✅ React frontend (Vite + TypeScript)
✅ D1 SQLite database (complete schema)
✅ Multi-language support (CS, SK, EN)
✅ Tailwind CSS + shadcn/ui ready
✅ TypeScript types for all entities
✅ Database migrations system
✅ Development environment

## What's Next to Build

- [ ] Cloudflare Access authentication
- [ ] Client onboarding flow
- [ ] Debt ingestion (single + CSV)
- [ ] ARES integration (Czech business registry)
- [ ] Attorney review dashboard
- [ ] AI mediation (GPT-4)
- [ ] Payment processing (Stripe)
- [ ] Document upload (R2)
- [ ] Email/SMS notifications
- [ ] PDF generation & signing

See `LexAI_specification.md` for complete feature list.

---

**Ready to build!** 🚀

For detailed setup including production deployment, see `SETUP.md`.
