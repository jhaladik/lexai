# LexAI - Local Manual Deployment

Quick guide for deploying directly from your machine using Wrangler.

## One-Time Setup

Already done! ✅
- D1 database created
- R2 bucket created
- KV namespace created
- Migrations applied
- wrangler.toml configured

## Deploy Commands

### Deploy API (Workers)
```bash
cd apps/api
wrangler deploy
```

### Deploy Frontend (Pages)
```bash
cd apps/web
pnpm build
wrangler pages deploy dist --project-name=lexai
```

### Both at Once
```bash
# From project root
cd apps/api && wrangler deploy && cd ../web && pnpm build && wrangler pages deploy dist --project-name=lexai && cd ../..
```

## Quick Deploy Script

Create a script for faster deploys:

**deploy.sh** (or deploy.bat for Windows):
```bash
#!/bin/bash
echo "Deploying LexAI..."
cd apps/api
echo "Deploying API..."
wrangler deploy
cd ../web
echo "Building frontend..."
pnpm build
echo "Deploying frontend..."
wrangler pages deploy dist --project-name=lexai
echo "✅ Deployment complete!"
```

Make executable: `chmod +x deploy.sh`

Run: `./deploy.sh`

## After Deploy

**Check API:**
```bash
curl https://lexai-api.<your-subdomain>.workers.dev/health
```

**Check Frontend:**
Visit: `https://lexai.pages.dev`

## Set Secrets (When Needed)

```bash
cd apps/api
wrangler secret put SMTP2GO_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put JWT_SECRET
```

## View Logs

```bash
wrangler tail
```

## Rollback

```bash
wrangler deployments list
wrangler rollback --message "Rollback reason"
```

## Tips

- **Deploy often** - It's fast (10-20 seconds)
- **Test locally first** - Run `wrangler dev` and `pnpm dev`
- **Check logs** - Use `wrangler tail` to see errors
- **No git push needed** - Deploy whenever you want

---

**GitHub Actions disabled** - You control when to deploy!

To re-enable CI/CD later: Rename `.github/workflows/deploy.yml.disabled` back to `.github/workflows/deploy.yml`
