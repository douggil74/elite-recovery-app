# CLAUDE.md - Elite Recovery LA Project Briefing

> **For new Claude instances:** This is a comprehensive briefing on what this project is, what we've built, and where we're going. Read this first.

---

## What This Is

**Elite Recovery LA** is a **fugitive recovery (bail enforcement) mobile app** for licensed bail recovery agents. It helps agents locate and apprehend individuals who have skipped bail using AI-powered intelligence tools.

**Business context:** Doug operates a bail bonds business in Louisiana. When defendants skip court, licensed recovery agents need to find them. This app gives agents professional-grade investigation tools on their phones.

**This is NOT malware** - it's a legitimate law enforcement tool for licensed bail recovery professionals operating under legal authority.

---

## Tech Stack

- **Frontend:** Expo/React Native (TypeScript) - works on iOS, Android, web
- **Backend:** Python FastAPI on Render (`https://elite-recovery-osint.onrender.com`)
- **AI:** GPT-4o via backend proxy (no local API keys needed)
- **Storage:** AsyncStorage for local data, SQLite for cases
- **Auth:** Passcode + biometric with AES-256 encryption
- **Routing:** Expo Router (file-based)

---

## CURRENT PRIORITY: Jail Roster Scraper (January 2026)

### What We Built This Session

The **jail roster scraper** is the main feature we've been building. It automatically extracts inmate data from parish jail websites (specifically Revize-powered sites like St. Tammany Parish).

### How It Works

1. **Single Booking Scrape:**
   - User pastes a jail booking URL (e.g., `https://inmates.stpso.revize.com/bookings/270105`)
   - Backend uses `allorigins.win` proxy to bypass Cloudflare/anti-bot protection
   - Parses HTML to extract: name, age, race, sex, charges, bond amounts, mugshot URL

2. **Bulk Import:**
   - User enters the base jail URL and latest booking number
   - Selects time period: 24h (~15 bookings), 48h (~30), 72h (~45), 1 week (~50)
   - Backend scrapes booking numbers in parallel (batches of 5)
   - Returns list of all inmates with their data

### Key Technical Details

**Backend (`osint-backend/main.py`):**
- Uses `allorigins.win` free CORS proxy to bypass 403 blocks
- Falls back to cloudscraper, httpx, aiohttp if proxy fails
- Parses Revize HTML format: `<label>First Name</label><input value="RANDY">`
- Extracts bond info from charge table headers: `Desc.`, `Bond Type`, `Bond Amt.`

**Frontend (`app/import-roster.tsx`):**
- Toggle between "Single Booking" and "Bulk Import" modes
- Displays extracted data with mugshot, charges, bonds
- Each inmate has "FTA Risk" and "Create Case" buttons
- Passes data to FTA Risk page via URL params (`prefillName`, `prefillAge`, `prefillBond`, `prefillCharges`)

**FTA Risk page (`app/(tabs)/risk.tsx`):**
- Reads URL params with `useLocalSearchParams`
- Auto-fills form when navigating from import-roster
- Shows "Data imported from jail roster" notice when prefilled

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jail-roster` | POST | Scrape single booking URL |
| `/api/jail-roster/bulk` | POST | Scrape range of booking numbers |
| `/health` | GET | Health check |

**Single scrape request:**
```json
{
  "url": "https://inmates.stpso.revize.com/bookings/270105"
}
```

**Bulk scrape request:**
```json
{
  "base_url": "https://inmates.stpso.revize.com",
  "start_booking": 270105,
  "count": 15
}
```

### What's Working

- ✅ Single booking scrape with name, age, race, sex, charges, mugshot
- ✅ Bond type extraction ("TO BE SET BY JUDGE", "CASH PROPERTY SURETY", etc.)
- ✅ Bond amount extraction when available (e.g., "$2,500")
- ✅ Bulk import with time period selection
- ✅ Data flows to FTA Risk page (prefills form)
- ✅ Create Case from scraped data

### Known Issues / Limitations

- Cloudflare blocks main list page (can't auto-discover latest booking number)
- User must manually get latest booking # from jail site
- Some booking numbers don't exist (gaps in sequence) - handled gracefully
- `allorigins.win` proxy occasionally times out - backend has fallbacks

---

## OSINT Tools (Paused but Available)

We paused OSINT development to focus on jail scraper, but these tools are still installed:

| Tool | Status | Endpoint |
|------|--------|----------|
| **Sherlock** | Installed | `POST /api/sherlock` |
| **Holehe** | Installed | `POST /api/holehe` |
| **Socialscan** | Installed | `POST /api/osint/search` |

**Not installed** (to save memory on Render Pro tier - $85/mo, 4GB RAM):
- Maigret, h8mail, theHarvester, social-analyzer, ignorant, blackbird, instaloader, toutatis, ghunt, phoneinfoga

---

## Deployment

### Frontend (Vercel)
- Auto-deploys from GitHub OR manual: `npx vercel --prod`
- Main URL: `https://recovery-app-blond.vercel.app`

### Backend (Render)
- Auto-deploys from GitHub when connected
- Service: `elite-recovery-osint` on Render Pro tier
- URL: `https://elite-recovery-osint.onrender.com`
- Root directory: `recovery-app/osint-backend`

### GitHub
- Repo: `douggil74/elite-recovery-app`
- Main branch: `main`

---

## Important Files for Jail Scraper

```
/recovery-app
├── osint-backend/
│   ├── main.py                    # FastAPI backend with scraper
│   ├── requirements.txt           # Python dependencies
│   └── Dockerfile                 # Container config
├── app/
│   ├── import-roster.tsx          # Jail roster import UI (single + bulk)
│   └── (tabs)/
│       └── risk.tsx               # FTA Risk calculator (reads prefill params)
```

---

## Code Patterns

### Revize HTML Parsing (main.py ~line 3182)
```python
# Pattern 4: Revize jail system - labels followed by input fields
for label in soup.find_all('label'):
    label_text = label.get_text(strip=True).lower()
    next_input = label.find_next('input')  # NOT find_next_sibling!
    if next_input and next_input.get('value'):
        value = next_input.get('value', '').strip()
        if 'first name' in label_text:
            first_name = value
        # ... etc
```

### Passing data to FTA Risk (import-roster.tsx ~line 262)
```typescript
const goToFTARisk = () => {
  const params = new URLSearchParams();
  params.append('prefillName', extractedData.inmate.name);
  params.append('prefillAge', extractedData.inmate.age);
  params.append('prefillCharges', chargeTexts);
  router.push(`/(tabs)/risk?${params.toString()}`);
};
```

### Reading prefill params (risk.tsx ~line 43)
```typescript
const params = useLocalSearchParams<{
  prefillName?: string;
  prefillAge?: string;
  prefillBond?: string;
  prefillCharges?: string;
}>();

useEffect(() => {
  if (params.prefillName) setName(params.prefillName);
  // ... etc
}, [params]);
```

---

## What To Work On Next

1. **Bond extraction improvement** - Some Revize sites have different table structures
2. **Support other jail systems** - JailTracker, county sheriff sites
3. **Auto-discover latest booking** - Find a way around Cloudflare on list pages
4. **OSINT integration** - Run Sherlock on extracted names automatically
5. **Photo intelligence on mugshots** - Analyze mugshots for identifying features

---

## Commands

```bash
# Frontend
cd /Users/doug/elite-recovery-la/recovery-app
npm start              # Dev server
npx vercel --prod      # Deploy to Vercel

# Backend (local testing)
cd /Users/doug/elite-recovery-la/recovery-app/osint-backend
python3 -m uvicorn main:app --reload

# Test jail scraper
curl -X POST "https://elite-recovery-osint.onrender.com/api/jail-roster" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://inmates.stpso.revize.com/bookings/270105"}'

# Test bulk scrape
curl -X POST "https://elite-recovery-osint.onrender.com/api/jail-roster/bulk" \
  -H "Content-Type: application/json" \
  -d '{"base_url":"https://inmates.stpso.revize.com","start_booking":270105,"count":5}'
```

---

## User Preferences (Doug)

- Wants **automated** solutions, not manual data entry
- Cost-conscious - rejected ScraperAPI, using free allorigins.win proxy
- Upgraded Render to Pro tier ($85/mo) for reliability
- Primary jail site: St. Tammany Parish (`inmates.stpso.revize.com`)
- Wants bulk import to be time-based (24h, 72h, etc.)

---

## Session History (Jan 22-23, 2026)

1. Fixed Render deployment issues (indentation errors, memory)
2. Solved 403 anti-bot blocking with allorigins.win proxy
3. Built Revize HTML parser for label+input format
4. Added bond type and amount extraction
5. Created bulk scraping endpoint with parallel fetching
6. Built bulk import UI with time period selector
7. Added data flow from import-roster to FTA Risk page

---

*This project helps licensed bail recovery agents do their job more effectively and safely. All features are designed for lawful fugitive recovery operations under proper legal authority.*
