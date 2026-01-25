# Elite Recovery - Deployment & Secrets Reference

> **Last Updated:** January 24, 2026

---

## Fly.io Backend

**App Name:** `elite-recovery-osint`
**URL:** https://elite-recovery-osint.fly.dev

### Required Secrets

| Secret | Purpose | How to Set |
|--------|---------|------------|
| `ANTHROPIC_API_KEY` | Claude AI (primary for chat/docs) | `fly secrets set ANTHROPIC_API_KEY="sk-ant-..."` |
| `OPENAI_API_KEY` | GPT-4o Vision (photo analysis, OCR fallback) | `fly secrets set OPENAI_API_KEY="sk-proj-..."` |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `TylertechUserName` | Tyler Tech court records login |
| `TylertechPass` | Tyler Tech court records password |
| `SCRAPINGBEE_API_KEY` | JavaScript rendering for protected sites |
| `LA_COURT_USERNAME` | re:SearchLA login |
| `LA_COURT_PASSWORD` | re:SearchLA password |

### Check Current Secrets

```bash
fly secrets list
```

### Verify Backend Health

```bash
curl https://elite-recovery-osint.fly.dev/health
```

Expected output should show:
- `claude_api: configured (primary)`
- `openai_api: configured (vision)`

---

## Vercel Frontend

**Project:** `recovery-app`
**URL:** https://recovery-app-blond.vercel.app

### Deploy Commands

```bash
# Manual deploy (always works)
npx vercel --prod

# Or push to GitHub (auto-deploys if configured)
git push origin main
```

### Build Settings

- **Build Command:** `expo export -p web`
- **Output Directory:** `dist`
- **Framework:** Other

---

## Firebase (Auto-configured)

Firebase is bundled in the app - no manual setup needed.

- **Project:** Built into app code
- **Services Used:** Firestore (case sync), Auth (user accounts)

---

## API Keys in App Settings

Users can also set API keys in the app's Settings screen. These are stored locally and synced to their account:

- **Claude API Key (Anthropic)** - For local AI if backend unavailable
- **OpenAI API Key** - For local OCR if backend unavailable

The backend keys take priority. App settings keys are fallback for offline use.

---

## Quick Reference Commands

```bash
# Set Anthropic key
fly secrets set ANTHROPIC_API_KEY="sk-ant-api03-..."

# Set OpenAI key
fly secrets set OPENAI_API_KEY="sk-proj-..."

# Check all secrets
fly secrets list

# Check backend health
curl https://elite-recovery-osint.fly.dev/health

# Deploy frontend
npx vercel --prod

# View Fly.io logs
fly logs
```

---

## Troubleshooting

### "Claude not configured"
```bash
fly secrets set ANTHROPIC_API_KEY="your-key"
```

### "OpenAI not configured"
```bash
fly secrets set OPENAI_API_KEY="your-key"
```

### Backend not responding
```bash
fly status
fly logs --app elite-recovery-osint
```

### Vercel build failing
```bash
# Force manual deploy
npx vercel --prod --yes
```

---

## Current Keys (Masked)

| Service | Key Prefix | Status |
|---------|------------|--------|
| Anthropic | `sk-ant-api03-HnIa...` | Active |
| OpenAI | Set on Fly.io | Active |

---

*Keep this file updated when keys change or new services are added.*
