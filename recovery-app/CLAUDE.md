# Elite Recovery LA - Help Manual & System Reference

> **Last Updated:** January 25, 2026
> **Version:** 3.2.0

---

## TRACE AI - Core Mission

**TRACE (Tactical Recovery Analysis & Case Engine)** is an AI-powered intelligence analyst for bail recovery agents.

### The Problem TRACE Solves

Recovery agents receive massive amounts of documents from bail bondsmen:
- Bondsman notes about the defendant
- Check-in records and contact history with the fugitive
- Delvepoint/TLO skip trace data sheets
- Social media screenshots and photos
- Court documents and warrant information

**Humans get overwhelmed.** Details get missed. Patterns go unnoticed.

### How TRACE Works

1. **Agent uploads everything** - Documents, skip trace data, social media pics, bondsman notes
2. **Claude AI analyzes ALL data** - Cross-references everything, spots patterns humans miss
3. **AI generates actionable intelligence:**
   - Prioritize addresses by most likely current location
   - Map all known addresses with visual pins
   - Cross-reference associates (check their social media, warrants, etc.)
   - Phone intelligence (active numbers, carrier type, linked accounts)
   - Generate surveillance plan (best times/locations to check)
   - Employment leads (work schedules, employer addresses)
   - Vehicle tracking tips (where to look based on address history)
   - Link associates across multiple cases
   - Spot inconsistencies and lies in check-in records
   - Identify patterns in social media (regular locations, friends, habits)

### Why AI is Critical

Claude AI can:
- Process hundreds of pages of documents in seconds
- Remember every detail and cross-reference instantly
- Spot patterns that humans miss when tired or distracted
- Never forget a name, address, or connection
- Generate fresh investigative angles

**The human decides. The AI finds what the human might miss.**

### Predictive Analysis

When check-in records show patterns, AI should create predictions:

**Example: Truck Driver Case**
- Fugitive checks in weekly from mom's house in Harvey, LA
- He's a truck driver (gone for days, returns periodically)
- AI analyzes: What day does he typically check in? How long between check-ins?
- AI predicts: "Based on 8 weekly check-ins all on Thursdays, subject likely returns home Wednesday night or Thursday morning. Best surveillance window: Thursday 6AM-10AM at mother's address."

**Prediction factors to consider:**
- Employment type (truck driver, shift worker, 9-5, gig worker)
- Check-in day/time patterns
- Distance between check-in location and known addresses
- Gaps in check-in history (was he in jail? traveling?)
- Seasonal patterns (holidays, hunting season, etc.)
- Known routines from bondsman notes

**Output format:**
1. Pattern summary (what the data shows)
2. Prediction (when/where subject likely to appear)
3. Confidence level (based on data consistency)
4. Recommended surveillance window
5. Backup locations if primary fails

---

## What This App Does

Elite Recovery LA is a **bail recovery agent tool** for locating individuals who have skipped bail. It provides:

1. **Jail Roster Import** - Scrape inmate data from parish jail websites
2. **FTA Risk Scoring** - Calculate failure-to-appear probability (0-100)
3. **OSINT Tools** - Username and email searches across hundreds of sites
4. **Photo Analysis** - Extract GPS, identify tattoos/scars, reverse image search
5. **AI Case Analysis** - Claude-powered pattern recognition and lead generation

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
| Backend (Fly.io) | https://elite-recovery-osint.fly.dev |
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

- Added TRACE AI core mission documentation
- Added reverse image search (TinEye, Yandex, Google)
- Added face recognition search (PimEyes, FaceCheck.ID)
- Added EXIF GPS extraction from photos
- Migrated backend from Render to Fly.io (faster, always-on)
- Removed emojis and markdown from chat/reports
- Fixed target name auto-replacement (human sets name only)
- Added World Conflict font for TRACE branding
- Fixed Firebase sync undefined field errors
- Added FTA score legend to import-roster page
- Added mugshot photo to FTA result display

---

## User Preferences (Doug)

- Wants automated solutions, not manual data entry
- Cost-conscious (using free tiers where possible)
- Primary jail: St. Tammany Parish (inmates.stpso.revize.com)
- Needs case numbers and dates for FTA warrants (legal documentation)
- Prefers dark theme with red accents
- Uses Delvepoint for skip tracing (manual lookup, paste data into app)

---

## AI Chat Guidelines

When analyzing case data, the AI must:

1. **NO emojis** - Professional output only
2. **NO markdown formatting** - No asterisks, hashtags, or bullet symbols in chat
3. **Plain text output** - Clean, readable reports
4. **Focus on actionable intelligence** - Not fluff, not disclaimers
5. **THE TARGET NAME IS SET BY THE HUMAN ONLY** - Never auto-change the case name from parsed documents
6. **Cross-reference everything** - Look for connections between uploaded documents
7. **Prioritize leads** - Rank addresses/phones by likelihood of finding the subject
8. **Spot patterns** - Identify habits, routines, frequent locations from data
9. **Flag inconsistencies** - Note when check-in info contradicts skip trace data
10. **Generate surveillance recommendations** - Where and when to look

---

## Data Analysis Priorities

When skip trace data is uploaded, analyze in this order:

1. **Current address** - Most likely place to find them NOW
2. **Phone numbers** - Active cells, who they're calling
3. **Relatives/associates** - Who's hiding them, who knows where they are
4. **Vehicles** - What to look for, where it might be parked
5. **Employment** - Work address, likely schedule
6. **Social media** - Recent activity, tagged locations

---

## TRACE Report Format

When analyzing case documents, generate a report in this EXACT format:

```
TRACE ANALYSIS - [SUBJECT NAME]

---

SUBJECT PROFILE

Name: [Full name with aliases]
DOB: [Date] (Age [X])
Phone: [Primary phone]
Email: [Email if known]
SSN: [Last 4 or full if in docs]
DL: [License number and state]

Charges: [List charges with bond amounts]
Total Bond: $[Amount]
Bond Forfeiture: [Date if applicable]
FTA Date: [Date if applicable]
Status: [ACTIVE FUGITIVE / COMPLIANT / etc.]

---

EMPLOYMENT ANALYSIS

Occupation: [Job title]
Employer: [Company name]
Work Location: [Address]
Schedule: [If known - shifts, days, etc.]
Notes: [Relevant employment intel]

---

CHECK-IN PATTERN ANALYSIS

Total check-ins analyzed: [Number]

[Create table showing pattern]:
| Region | Locations | Frequency |
|--------|-----------|-----------|
| [Area] | [Cities/addresses] | [How often] |

---

ANCHOR POINTS - CRITICAL

[Identify repeated addresses with frequency]:
| Address | Occurrences | Notes |
|---------|-------------|-------|
| [Address] | [X] times | [Who lives there, relationship] |

[Identify PRIMARY anchor point in bold]

---

CHECK-IN TIMING PATTERN

[Analyze days and times]:
| Day Pattern | Time Pattern |
|-------------|--------------|
| [Days] | [Times and what they indicate] |

[Calculate interval between returns to anchor points]

---

PREDICTION MODEL

Last known check-in: [Date, location, time]
Previous: [Date, location]
Previous: [Date, location]

PATTERN DETECTED:
[Describe the pattern in plain language]

PREDICTION:
[When and where subject likely to appear next]
[Confidence level and reasoning]

---

SURVEILLANCE RECOMMENDATIONS

PRIMARY TARGET: [Address]
- [Why this location]
- Best surveillance window: [Days/times]
- Watch for: [Vehicle, behavior patterns]

SECONDARY TARGETS:
1. [Address with notes]
2. [Address with notes]
3. [Address with notes]

---

KNOWN ASSOCIATES

| Name | Relation | Phone | Address |
|------|----------|-------|---------|
| [Name] | [Relationship] | [Phone] | [Address] |

[Include co-signers, references, anyone mentioned in docs]

---

PHONE INTELLIGENCE

| Number | Status | Notes |
|--------|--------|-------|
| [Number] | [Active/Disconnected/Unknown] | [Context] |

---

RED FLAGS FROM BONDSMAN NOTES

[Number each red flag with date and quote from notes]:
1. [Date]: [Direct quote or summary of concerning info]
2. [Date]: [Direct quote or summary]

---

CRITICAL OBSERVATIONS

[Numbered list of key intel that affects apprehension strategy]:
1. [Observation with supporting evidence]
2. [Observation with supporting evidence]

---

RECOMMENDED APPREHENSION STRATEGY

[Numbered action items]:
1. [Specific action with location/timing]
2. [Specific action]
3. [Specific action]

CONFIDENCE LEVEL: [HIGH/MEDIUM/LOW] - [Reasoning]
```

---

## Report Generation Rules

1. Extract EVERY address from check-in logs and count occurrences
2. Identify the PRIMARY anchor point (most frequent non-work location)
3. Calculate average interval between returns to anchor point
4. Pull ALL phone numbers from all documents and note status
5. Extract ALL names mentioned (references, co-signers, associates)
6. Quote bondsman notes directly when they contain actionable intel
7. Look for contradictions (e.g., says he works in Alaska but checks in from Ohio)
8. Note when phone numbers go dead - this often indicates awareness of warrant
9. If subject is a truck driver, identify the trucking route pattern
10. Always end with specific, actionable surveillance recommendations, friend connections

---

*This app is for licensed bail recovery professionals operating under legal authority.*
