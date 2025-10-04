# Cloudflare Access Setup Guide

## Step-by-Step Setup

### 1. Go to Cloudflare Zero Trust Dashboard

Visit: **https://one.dash.cloudflare.com/**

### 2. Create Access Application

1. Navigate to: **Access → Applications**
2. Click: **"Add an application"**
3. Select: **"Self-hosted"**

### 3. Configure Application

**Application Configuration:**
- **Application name:** `LexAI`
- **Session Duration:** `24 hours`
- **Application domain:**
  - Add: `lexai.pages.dev`
  - Add: `*.lexai.pages.dev` (for preview deployments)

**Application Appearance (optional):**
- **App Launcher visibility:** Visible
- **Logo:** Upload your logo if you have one

Click **Next**

### 4. Create Access Policy

**Policy Configuration:**
- **Policy name:** `LexAI Attorneys`
- **Action:** `Allow`
- **Session duration:** `24 hours`

**Configure Rules - Include:**
- **Selector:** `Emails`
- **Value:** `jhaladik@gmail.com`

OR for multiple users:
- **Selector:** `Emails ending in`
- **Value:** `@yourlawfirm.cz`

Click **Next** → **Add application**

### 5. Get Your Team Domain

After creating the application, note your **Team Domain**:
- Format: `your-team-name.cloudflareaccess.com`
- You'll see this in the Access dashboard

### 6. Test Access

1. Visit: **https://lexai.pages.dev**
2. You should be redirected to Cloudflare Access login
3. Enter your email: `jhaladik@gmail.com`
4. Check your email for the one-time code
5. Enter the code
6. You should be redirected back to LexAI dashboard

### 7. Verify Authentication

Once logged in, open browser DevTools (F12):

**Check for JWT token:**
```javascript
// In Console, check cookies
document.cookie
// Should see: CF_Authorization=...
```

**Test API call:**
```javascript
fetch('https://lexai-api.jhaladik.workers.dev/api/v1/dashboard', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

Should return dashboard data!

---

## How It Works

1. **User visits** https://lexai.pages.dev
2. **Cloudflare Access** intercepts the request
3. **Authentication required** → Redirects to login
4. **User enters email** → Receives one-time code
5. **Code verified** → JWT token issued in cookie
6. **User accesses app** → Frontend works normally
7. **API calls** → Browser sends JWT in `CF-Access-JWT-Assertion` header
8. **Workers validates** → JWT using our auth middleware
9. **Database lookup** → Get user info by email
10. **Request authorized** → Returns data

---

## Troubleshooting

### "Access Denied" Error
- Check that your email is in the access policy
- Try incognito mode (clear cookies)
- Check policy is set to "Allow"

### API Returns 401 Unauthorized
- Check CORS settings in Worker
- Verify `credentials: 'include'` in fetch requests
- Check JWT token exists: `document.cookie`

### JWT Validation Fails
- Check user exists in database with your email
- Check user status is 'active'
- Verify tenant_id matches

### No Email Received
- Check spam folder
- Try different email address
- Use social login instead (Google, GitHub)

---

## Alternative: Social Login

For easier login, you can add social identity providers:

1. **Access → Authentication**
2. **Add** → Choose provider (Google, GitHub, etc.)
3. **Configure** OAuth credentials
4. **Save**

Then users can login with "Sign in with Google" instead of email codes.

---

## Production Checklist

- [ ] Application created in Cloudflare Access
- [ ] Policy added for jhaladik@gmail.com
- [ ] Tested login flow works
- [ ] JWT token visible in cookies
- [ ] API calls succeed with authentication
- [ ] Dashboard loads real data

---

## Next Steps After Setup

Once authentication works:
1. ✅ You can log in to LexAI
2. ✅ Dashboard shows "0" for all stats (no data yet)
3. ➡️ Ready to build Client Onboarding
4. ➡️ Then Debt Ingestion
5. ➡️ Then Payment Processing

**Everything is ready - just need to set up Access!** 🚀
