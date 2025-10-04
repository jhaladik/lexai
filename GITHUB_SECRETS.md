# GitHub Secrets Configuration

You need to add these secrets to enable CI/CD deployment.

## How to Add Secrets

1. Go to: https://github.com/jhaladik/lexai/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret below

## Required Secrets

### CLOUDFLARE_ACCOUNT_ID
```
1978b4e1224bd0d5eddd038889ea86fc
```

**How to get:**
- Already found via `wrangler whoami`
- Or: https://dash.cloudflare.com (right sidebar)

### CLOUDFLARE_API_TOKEN

**How to get:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. **Required permissions:**
   - Account - Cloudflare Pages: Edit
   - Account - D1: Edit
   - Account - Workers Scripts: Edit
   - Zone - Workers Routes: Edit
   - Account - Workers KV Storage: Edit

5. Click "Continue to summary"
6. Click "Create Token"
7. **Copy the token** (you won't see it again!)
8. Add to GitHub secrets as `CLOUDFLARE_API_TOKEN`

## After Adding Secrets

Once both secrets are added, GitHub Actions will automatically deploy on every push to `main`:

1. Type check
2. Build frontend
3. Run database migrations
4. Deploy API to Workers
5. Deploy frontend to Pages

## Verify Deployment

After pushing code:

1. Watch deployment: https://github.com/jhaladik/lexai/actions
2. Check your Workers: https://dash.cloudflare.com/workers
3. Check your Pages: https://dash.cloudflare.com/pages

## Test Deployment

```bash
# Get your Worker URL
wrangler deployments list

# Or test directly
curl https://lexai-api.jhaladik.workers.dev/health
```

Should return:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "..."
}
```

---

## Resources Created ✅

- **D1 Database:** `lexai-db` (ID: 7200c202-7c2d-4d3c-a5c6-69eda9366dc5)
- **R2 Bucket:** `lexai-documents`
- **KV Namespace:** `CACHE` (ID: c25b28c0a82547edb80b56169aba04b6)
- **Migrations:** All 5 applied successfully ✅

## What's Left

After GitHub secrets are set:

1. Push to main to trigger first deployment
2. Create your tenant (law firm) in database
3. Set Worker secrets for external services
4. Start building features!

See `STATUS.md` for next development steps.
