# LexAI - Deployment Guide

This project deploys **directly to production** on every push to `main` branch via GitHub Actions.

## Prerequisites

1. GitHub repository: https://github.com/jhaladik/lexai
2. Cloudflare account with API token
3. All Cloudflare resources created (D1, R2, KV)

## Initial Setup (One-time)

### 1. Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create lexai-db
# Copy the database_id to apps/api/wrangler.toml

# Create R2 bucket
wrangler r2 bucket create lexai-documents

# Create KV namespace
wrangler kv:namespace create "CACHE"
# Copy the namespace id to apps/api/wrangler.toml
```

### 2. Update wrangler.toml

Edit `apps/api/wrangler.toml` with your IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lexai-db"
database_id = "your-actual-database-id"  # ← UPDATE THIS

[[kv_namespaces]]
binding = "CACHE"
id = "your-actual-kv-id"  # ← UPDATE THIS
```

### 3. Set GitHub Secrets

Go to: https://github.com/jhaladik/lexai/settings/secrets/actions

Add these secrets:

**CLOUDFLARE_API_TOKEN**
- Go to: https://dash.cloudflare.com/profile/api-tokens
- Create Token → "Edit Cloudflare Workers" template
- Permissions:
  - Account - Cloudflare Pages: Edit
  - Account - D1: Edit
  - Zone - Workers Routes: Edit
  - Account - Workers Scripts: Edit
- Copy token and add to GitHub secrets

**CLOUDFLARE_ACCOUNT_ID**
- Find at: https://dash.cloudflare.com/ (right sidebar)
- Copy and add to GitHub secrets

### 4. Set Cloudflare Secrets (for Workers)

```bash
cd apps/api

# Set all secrets
wrangler secret put SMTP2GO_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put GOPAY_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put SIGNING_CERTIFICATE
wrangler secret put SIGNING_CERTIFICATE_PASSWORD
```

### 5. Run Initial Migration

```bash
# From project root
wrangler d1 migrations apply lexai-db --remote
```

### 6. Create Initial Tenant

```bash
# Get timestamp
TIMESTAMP=$(date +%s)000

# Create your law firm tenant
wrangler d1 execute lexai-db --remote --command="
INSERT INTO tenants (id, name, subdomain, created_at, status)
VALUES ('tenant_yourfirm', 'Your Law Firm Name', 'yourlawfirm', $TIMESTAMP, 'active');
"

# Create your admin user
wrangler d1 execute lexai-db --remote --command="
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, created_at, status)
VALUES ('user_admin', 'tenant_yourfirm', 'you@yourlawfirm.cz', 'Your', 'Name', 'attorney', $TIMESTAMP, 'active');
"
```

## Deployment Workflow

### Automatic Deployment (Recommended)

Every push to `main` automatically:
1. Runs type checks
2. Builds frontend
3. Runs database migrations
4. Deploys API to Workers
5. Deploys frontend to Pages

**To deploy:**
```bash
git add .
git commit -m "Your changes"
git push origin main
```

Monitor deployment: https://github.com/jhaladik/lexai/actions

### Manual Deployment

If you need to deploy manually:

**Deploy API:**
```bash
cd apps/api
wrangler deploy
```

**Deploy Frontend:**
```bash
cd apps/web
pnpm build
wrangler pages deploy dist --project-name=lexai
```

**Run Migrations:**
```bash
wrangler d1 migrations apply lexai-db --remote
```

## Accessing Your Deployment

### API
- Production URL: `https://lexai-api.<your-subdomain>.workers.dev`
- Or custom domain if configured

### Frontend
- Production URL: `https://lexai.pages.dev`
- Or custom domain if configured

### Health Check
```bash
curl https://lexai-api.<your-subdomain>.workers.dev/health
```

Should return:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "..."
}
```

## Custom Domains

### Frontend (Pages)
1. Go to: https://dash.cloudflare.com → Pages → lexai
2. Custom domains → Set up a domain
3. Add: `app.yourdomain.com` or `yourdomain.com`
4. DNS will auto-configure

### API (Workers)
1. Go to: https://dash.cloudflare.com → Workers → lexai-api
2. Triggers → Custom Domains
3. Add: `api.yourdomain.com`
4. Update frontend `.env` with new API URL

## Environment-Specific Configuration

Currently deploying to **production only** for simplicity.

If you want staging later:

1. Create staging D1 database
2. Add staging secrets
3. Update GitHub Actions to deploy on `staging` branch
4. Update wrangler.toml with environments

## Monitoring & Logs

### View Logs
```bash
# Tail Worker logs
wrangler tail

# Pages logs
# Available in Cloudflare Dashboard → Pages → lexai → View logs
```

### Analytics
- Workers: https://dash.cloudflare.com → Workers → lexai-api → Metrics
- Pages: https://dash.cloudflare.com → Pages → lexai → Analytics

## Rollback

If deployment breaks:

### Rollback Workers
```bash
# List deployments
wrangler deployments list

# Rollback to specific version
wrangler rollback --message "Rollback to working version"
```

### Rollback Pages
1. Go to: https://dash.cloudflare.com → Pages → lexai
2. Deployments → Find working deployment
3. Click "..." → Rollback to this deployment

## Database Operations

### View Data
```bash
# Connect to production DB
wrangler d1 execute lexai-db --remote --command="SELECT * FROM tenants"

# List all debts
wrangler d1 execute lexai-db --remote --command="SELECT id, status, original_amount FROM debts LIMIT 10"
```

### Backup Database
```bash
# Export to SQL
wrangler d1 export lexai-db --remote --output=backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
# Import from SQL
wrangler d1 execute lexai-db --remote --file=backup-20250104.sql
```

## Troubleshooting

### Deployment Fails
- Check GitHub Actions logs: https://github.com/jhaladik/lexai/actions
- Verify secrets are set correctly
- Check wrangler.toml IDs match Cloudflare resources

### API Returns 500
```bash
# Check Worker logs
wrangler tail

# Test locally first
cd apps/api
wrangler dev
```

### Database Migration Fails
```bash
# Check migration status
wrangler d1 migrations list lexai-db --remote

# Force apply specific migration
wrangler d1 execute lexai-db --remote --file=packages/database/migrations/0001_initial_schema.sql
```

### Frontend Shows Blank Page
- Check browser console for errors
- Verify API URL is correct
- Check CORS settings in Worker
- Clear browser cache

## Production Checklist

Before going live:

- [ ] All Cloudflare resources created (D1, R2, KV)
- [ ] GitHub secrets configured
- [ ] Cloudflare secrets configured
- [ ] Database migrations run successfully
- [ ] Test tenant created
- [ ] Health check passes
- [ ] Custom domains configured (optional)
- [ ] Cloudflare Access configured
- [ ] SMTP2GO verified sender email
- [ ] Stripe webhooks configured
- [ ] OpenAI API key with credits
- [ ] E-signature certificate (production cert for eIDAS)
- [ ] Monitoring/alerts set up

## Continuous Deployment

**Current workflow:**
1. Develop locally
2. Test on `localhost`
3. Push to `main`
4. Auto-deploy to production
5. Test on production

**Why no staging?**
- Faster iteration
- You're the only user initially
- Cloudflare Workers rollback is instant
- D1 migrations can be tested locally first

**When to add staging:**
- Multiple developers
- External users
- More complex migrations
- Need pre-production testing

## Cost Monitoring

Check costs: https://dash.cloudflare.com/billing

**Free tier includes:**
- 100,000 Worker requests/day
- 10GB D1 storage
- 10GB R2 storage
- Unlimited Pages builds

You'll stay free tier for initial testing phase.

## Support

**Issues:**
- GitHub: https://github.com/jhaladik/lexai/issues
- Cloudflare Community: https://community.cloudflare.com/

**Documentation:**
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/

---

**Ready to deploy!** Push to `main` and watch it go live 🚀
