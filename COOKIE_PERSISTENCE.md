# Cookie Persistence for GitHub Actions (OTP Bypass)

## Problem Solved

When running in GitHub Actions, Naukri blocks login with OTP verification. This makes headless automation impossible with credentials alone.

**Solution**: Save authenticated cookies locally after successful login, then reuse them in CI/CD pipelines to skip the login & OTP entirely.

---

## How It Works

### Local Run (First Time)
1. Test runs with your credentials
2. After successful login → cookies are automatically saved to `.cache/naukri-auth.json`
3. This file contains your session data (expires in 24-48 hours)

### GitHub Actions Run (Subsequent Times)
1. Test loads saved cookies before attempting login
2. Verifies the session is still valid
3. **If valid** → skips login entirely and proceeds directly to resume upload
4. **If expired** → falls back to normal login (requires OTP bypass solution)

### Speed Improvement
- **With login**: ~28-30 seconds
- **With saved cookies**: ~13 seconds (50%+ faster ⚡)

---

## Setup for GitHub Actions

### Step 1: Generate Cookies Locally
```bash
npm run update-resume:headless
```

This creates `.cache/naukri-auth.json` with your session.

### Step 2: Commit Cookies to Repository
```bash
git add .cache/naukri-auth.json
git commit -m "chore: save naukri session cookies"
git push
```

### Step 3: GitHub Actions Will Automatically Use Them
The workflow will:
- Clone your repo (including `.cache/naukri-auth.json`)
- Load saved cookies
- Skip login if session is still valid
- Upload resume

---

## Important Limitations ⚠️

### Cookies Expire After 24-48 Hours
When cookies expire:
- Test will attempt normal login
- **GitHub Actions will still be blocked by OTP**
- You need to manually refresh by running locally again

### Refresh Procedure
When cookies expire (every ~24-48 hours):
```bash
# Run locally to refresh cookies
npm run update-resume:headless

# Commit the refreshed cookies
git add .cache/naukri-auth.json
git commit -m "chore: refresh naukri session cookies"
git push
```

### IP-Based Rejection (Possible)
Naukri may tie sessions to:
- Original IP address (unlikely if you're in India)
- Browser fingerprint (mitigated with stealth plugin)
- Device ID

If GitHub Actions still gets blocked despite valid cookies, this means Naukri is rejecting the IP/fingerprint.

---

## Handling Cookie Expiration

### Option A: Manual Refresh (Current)
Refresh cookies weekly/bi-weekly with manual run.

### Option B: Automate Refresh (Advanced)
Add a GitHub Actions workflow that runs locally via self-hosted runner:
```yaml
name: Refresh Session Cookies
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run update-resume:headless
      - run: |
          git config user.name "Bot"
          git config user.email "bot@example.com"
          git add .cache/naukri-auth.json
          git commit -m "chore: auto-refresh session cookies" || true
          git push
```

### Option C: Better Alternative - Automate OTP
Instead of relying on cookies, implement OTP automation:
- If using Gmail: Use App Passwords
- If using SMS: Use Twilio or similar to receive OTP programmatically
- Configure in `.env` for GitHub Actions

---

## File Structure

```
.cache/
└── naukri-auth.json          ← Saved cookies (IMPORTANT: keep secret)
    ├── savedAt               ← When cookies were created
    └── cookies[]             ← Session cookies from Naukri
.gitignore                     ← Updated to include .cache/
```

---

## Security Notes

⚠️ **The `.cache/naukri-auth.json` file contains your session cookies.**

- It's marked in `.gitignore` to prevent accidental commit
- If someone gains access to this file, they can access your Naukri account
- Keep your repository **PRIVATE**
- Consider GitHub Secrets as an alternative (below)

### Using GitHub Secrets Instead (Optional)
Instead of committing cookies, you can store them as GitHub Secrets:

1. Encode cookies to base64:
```bash
cat .cache/naukri-auth.json | base64 > cookies.b64
```

2. Add to GitHub Secrets as `NAUKRI_COOKIES`

3. Modify test to load from secret:
```typescript
if (process.env.NAUKRI_COOKIES) {
  const cookies = JSON.parse(
    Buffer.from(process.env.NAUKRI_COOKIES, 'base64').toString()
  );
  await context.addCookies(cookies);
}
```

---

## Troubleshooting

### "No saved cookies found"
- First run? This is normal. Login will proceed.
- After first run, cookies should be saved.
- Check `.cache/naukri-auth.json` exists.

### "Saved session not valid"
- Cookies expired (> 24 hours old)
- Refresh locally: `npm run update-resume:headless`
- Commit updated cookies to repo

### "Still blocked by OTP in GitHub Actions"
- Even with valid cookies, Naukri rejects the GitHub Actions IP
- Solution: Implement OTP automation or use a self-hosted runner

---

## Key Files Modified

- **helpers.ts** → Added `saveCookies()`, `loadCookies()`, `isAuthenticated()`
- **update-resume.spec.ts** → Integrated cookie persistence into test flow
- **.gitignore** → Added `.cache/` to prevent accidental commits

---

## Testing Cookie Persistence

```bash
# First run - saves cookies
npm run update-resume:headless

# Verify cookies were saved
cat .cache/naukri-auth.json | jq .

# Second run - should use saved cookies and skip login
npm run update-resume:headless
# Look for: "✅ Using saved session! Skipping login."
```

---

## Next Steps

1. ✅ Run locally to generate cookies
2. ✅ Commit `.cache/naukri-auth.json` to repo
3. ✅ Push to GitHub
4. ✅ GitHub Actions will now use saved cookies
5. ✅ Monitor for cookie expiration (set reminder for 3-4 days)
6. ✅ Refresh when needed: local run → commit → push

---

## Questions?

If cookies still don't work in GitHub Actions, consider:
1. GitHub self-hosted runner (eliminates IP issues)
2. Naukri API integration (if available)
3. OTP automation (most reliable long-term)
