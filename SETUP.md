# LexAI - Setup Guide

## Step 1: Install Dependencies

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install project dependencies
pnpm install
```

## Step 2: Cloudflare Setup

### 2.1 Create D1 Database

```bash
wrangler d1 create lexai-db
```

Copy the database ID and update `apps/api/wrangler.toml`:
```toml
database_id = "your-database-id-here"
```

### 2.2 Create R2 Bucket

```bash
wrangler r2 bucket create lexai-documents
```

### 2.3 Create KV Namespace

```bash
wrangler kv:namespace create "CACHE"
```

Copy the namespace ID and update `apps/api/wrangler.toml`:
```toml
id = "your-kv-namespace-id-here"
```

## Step 3: Run Database Migrations

```bash
# Local development (uses SQLite file)
pnpm db:migrate:local

# Production (uses Cloudflare D1)
pnpm db:migrate
```

## Step 4: Configure Secrets

Set up your API keys as Cloudflare secrets:

```bash
# Navigate to API directory
cd apps/api

# Set each secret
wrangler secret put SMTP2GO_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put GOPAY_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put SIGNING_CERTIFICATE
wrangler secret put SIGNING_CERTIFICATE_PASSWORD
```

## Step 5: Cloudflare Access Setup

### 5.1 Enable Cloudflare Access

1. Go to Cloudflare Dashboard → Zero Trust
2. Navigate to Access → Applications
3. Click "Add an application"
4. Select "Self-hosted"

### 5.2 Configure Application

- **Application name**: LexAI
- **Session duration**: 24 hours
- **Application domain**: `your-subdomain.pages.dev` or custom domain

### 5.3 Create Access Policy

1. Name: "LexAI Users"
2. Action: Allow
3. Session duration: 24 hours
4. Include rules:
   - Emails ending in: `@yourlawfirm.cz` (or specific emails)

### 5.4 Get JWT Public Key

```bash
# Access provides JWT public keys at:
https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/certs
```

Add this to your Worker to validate JWTs.

## Step 6: External Services Setup

### 6.1 SMTP2GO

1. Sign up at https://www.smtp2go.com
2. Create API key
3. Set as secret: `wrangler secret put SMTP2GO_API_KEY`

### 6.2 OpenAI

1. Get API key from https://platform.openai.com
2. Set as secret: `wrangler secret put OPENAI_API_KEY`

### 6.3 Stripe

1. Get test API key from https://dashboard.stripe.com/test/apikeys
2. Set as secret: `wrangler secret put STRIPE_SECRET_KEY`
3. Configure webhook endpoint: `https://your-api.workers.dev/api/v1/webhooks/stripe`

### 6.4 GoPay (Optional - for Czech market)

1. Register at https://www.gopay.com
2. Get client credentials
3. Set as secret: `wrangler secret put GOPAY_CLIENT_SECRET`

## Step 7: E-Signature Certificate

For signing PDFs with node-signpdf:

```bash
# Generate self-signed certificate for testing
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Create PKCS#12 file
openssl pkcs12 -export -out certificate.p12 -inkey key.pem -in cert.pem

# Convert to base64
base64 certificate.p12 > certificate.base64

# Set as secret
wrangler secret put SIGNING_CERTIFICATE < certificate.base64
wrangler secret put SIGNING_CERTIFICATE_PASSWORD
```

**Production**: Use qualified certificate from Postsignum or eIdentity for eIDAS compliance.

## Step 8: Seed Test Data

Create your first tenant (law firm):

```bash
# Connect to local D1
wrangler d1 execute lexai-db --local --command="
INSERT INTO tenants (id, name, subdomain, created_at, status)
VALUES ('tenant_test123', 'Test Law Firm', 'test', $(date +%s)000, 'active')
"

# Create admin user
wrangler d1 execute lexai-db --local --command="
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, created_at, status)
VALUES ('user_admin123', 'tenant_test123', 'admin@testlawfirm.cz', 'Admin', 'User', 'admin', $(date +%s)000, 'active')
"
```

## Step 9: Start Development

```bash
# Start both frontend and API
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8787

## Step 10: Deploy to Production

### 10.1 Deploy API (Workers)

```bash
cd apps/api
pnpm deploy
```

### 10.2 Deploy Frontend (Pages)

```bash
cd apps/web
pnpm build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=lexai
```

Or connect to GitHub for automatic deployments.

## Step 11: Configure Custom Domain (Optional)

### For API (Worker):
1. Cloudflare Dashboard → Workers
2. Select your Worker
3. Triggers → Add Custom Domain
4. Enter: `api.yourdomain.com`

### For Frontend (Pages):
1. Cloudflare Dashboard → Pages
2. Select your project
3. Custom domains → Add
4. Enter: `app.yourdomain.com` or `yourdomain.com`

## Troubleshooting

### Database migration fails
```bash
# Reset local database
rm -rf .wrangler/state/d1/
pnpm db:migrate:local
```

### Worker deployment fails
- Check wrangler.toml has correct bindings
- Verify secrets are set: `wrangler secret list`
- Check account ID: `wrangler whoami`

### Frontend can't reach API
- Verify proxy in vite.config.ts
- Check CORS settings in API
- Ensure Worker is running: `wrangler dev`

## Next Steps

1. Configure Cloudflare Access policies for your team
2. Set up production certificates for e-signatures
3. Configure ARES API integration
4. Set up Czech Post API for certified mail
5. Create email templates in SMTP2GO
6. Configure Stripe webhook endpoints
7. Set up monitoring and alerts
8. Create backup strategy for D1 database

## Useful Commands

```bash
# View logs
wrangler tail

# Access D1 console
wrangler d1 execute lexai-db --local --command="SELECT * FROM tenants"

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete SECRET_NAME

# Test Worker locally
curl http://localhost:8787/health
```
