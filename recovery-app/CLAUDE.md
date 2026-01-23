# Elite Recovery LA - Help Manual & System Reference

> **Last Updated:** January 23, 2026
> **Version:** 3.1.0

---

## What This App Does

Elite Recovery LA is a **bail recovery agent tool** for locating individuals who have skipped bail. It provides:

1. **Jail Roster Import** - Scrape inmate data from parish jail websites
2. **FTA Risk Scoring** - Calculate failure-to-appear probability (0-100)
3. **OSINT Tools** - Username and email searches across hundreds of sites
4. **AI Analysis** - GPT-4o powered risk assessments and investigation advice

---

## Features (What Actually Works)

### Jail Roster Import (`/import-roster`)
- **Single Booking Scrape**: Paste a jail booking URL to extract:
  - Inmate name, age, race, sex
  - Mugshot photo
  - All charges with descriptions
  - Bond amounts and types
- **Supported Sites**: Revize-powered jails (St. Tammany Parish, etc.)
- **Bulk Import**: Import multiple inmates by time period (24h, 48h, 72h, 1 week)

### FTA Risk Scoring (`/risk`)
- **Score Range**: 0-100 (higher = more likely to skip)
- **Risk Levels**:
  - 0-39: LOW RISK (green)
  - 40-69: MODERATE RISK (yellow)
  - 70-84: HIGH RISK (orange)
  - 85-100: VERY HIGH RISK (red)
- **Factors Analyzed**:
  - Prior FTA/warrant charges (+25 points)
  - Felony charges (+15)
  - Violent charges (+10)
  - High bond amount (+10)
  - Multiple charges (+5)
  - Young age under 25 (+5)
  - Prior bookings at same jail (+15)
  - No prior bookings (-10)
  - Local address (-15)
- **AI Assessment**: GPT-4o generates 2-3 sentence risk narrative

### OSINT Tools (Backend)
| Tool | Status | Description |
|------|--------|-------------|
| Sherlock | Working | Username search across 400+ sites |
| Holehe | Working | Email registration check on 120+ services |
| Socialscan | Working | Quick username availability check |
| CourtListener | Limited | Federal court records (no API key = limited) |

### Social Media Links
Direct search links generated for:
- Facebook (with name variations)
- Instagram
- TikTok
- Twitter/X
- LinkedIn
- Snapchat

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Expo/React Native + TypeScript |
| Backend | Python FastAPI on Render |
| AI | OpenAI GPT-4o-mini |
| Storage | AsyncStorage (local) |
| Routing | Expo Router (file-based) |

---

## URLs

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://recovery-app-blond.vercel.app |
| Backend (Render) | https://elite-recovery-osint.onrender.com |
| GitHub (Frontend) | github.com/douggil74/elite-recovery-app |
| GitHub (Backend) | github.com/douggil74/elite-recovery-osint |

---

## API Endpoints

### Jail Roster
```
POST /api/jail-roster
Body: { "url": "https://inmates.stpso.revize.com/bookings/270105" }

POST /api/jail-roster/bulk
Body: { "base_url": "https://inmates.stpso.revize.com", "start_booking": 270105, "count": 15 }
```

### FTA Risk Score
```
POST /api/fta-score
Body: {
  "name": "John Doe",
  "age": "32",
  "charges": [{"charge": "THEFT", "bond_amount": "$5,000"}],
  "bond_amount": 5000,
  "booking_number": 270105
}
```

### OSINT
```
POST /api/sherlock - Username search
POST /api/holehe - Email account check
POST /api/osint/search - Combined search
```

### Health Check
```
GET /health - Returns tool status and version
```

---

## Environment Variables (Render)

| Variable | Purpose |
|----------|---------|
| OPENAI_API_KEY | GPT-4o AI analysis |
| SCRAPINGBEE_API_KEY | JavaScript rendering (LA courts) |
| LA_COURT_USERNAME | re:SearchLA login |
| LA_COURT_PASSWORD | re:SearchLA password |

---

## Known Limitations

1. **LA Court Search**: Disabled in FTA calculation (too slow). Manual search link provided.
2. **Jail Roster**: Only works with Revize-powered sites. Cloudflare blocks list pages.
3. **OSINT Tools**: Many tools not installed (Maigret, h8mail, etc.) to save memory.
4. **ScrapingBee**: Rate limited - JavaScript rendering uses credits quickly.

---

## File Structure

```
/recovery-app
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx      # Cases list (home)
│   │   ├── risk.tsx       # FTA Risk calculator
│   │   ├── osint.tsx      # OSINT search
│   │   ├── audit.tsx      # Audit log
│   │   └── settings.tsx   # Settings
│   ├── case/[id]/
│   │   └── index.tsx      # Case detail page
│   ├── import-roster.tsx  # Jail roster import
│   ├── about.tsx          # About/features page
│   └── _layout.tsx        # Root layout
├── osint-backend/
│   ├── main.py            # FastAPI backend (all endpoints)
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile         # Container config
└── CLAUDE.md              # This file
```

---

## Deployment Commands

```bash
# Frontend (from /recovery-app)
npx vercel --prod

# Backend (auto-deploys from GitHub to Render)
cd osint-backend && git push origin main

# Local dev
npm start                    # Frontend
python3 -m uvicorn main:app --reload  # Backend
```

---

## Recent Changes (January 2026)

- Added FTA score legend to import-roster page
- Added mugshot photo to FTA result display
- Fixed duplicate back button on import-roster
- Left-aligned headers for consistency
- Disabled slow LA court search in FTA calculation
- Updated About page to show only working features
- Reduced prior bookings search for speed (50→10)

---

## User Preferences (Doug)

- Wants automated solutions, not manual data entry
- Cost-conscious (using free tiers where possible)
- Primary jail: St. Tammany Parish (inmates.stpso.revize.com)
- Needs case numbers and dates for FTA warrants (legal documentation)
- Prefers dark theme with red accents

---

*This app is for licensed bail recovery professionals operating under legal authority.*
