# Fugitive Recovery App - Development Roadmap

## Mission
AI-powered investigative assistant for licensed fugitive recovery professionals. Analyzes data, finds patterns humans miss, and outputs actionable intelligence to locate targets.

---

## Phase 1: Foundation (COMPLETED)
- [x] Case management system
- [x] PDF upload and text extraction
- [x] Basic AI analysis with OpenAI
- [x] Dark red theme (Elite Recovery branding)
- [x] Passcode/biometric security
- [x] Firebase cloud sync
- [x] Audit logging
- [x] Export to PDF

---

## Phase 2: Enhanced Investigation Engine (CURRENT)

### 2.1 Chat-Driven Onboarding
- [ ] Welcome message: "What can I help you investigate today?"
- [ ] Guided case creation through conversation
- [ ] Context-aware prompts based on uploaded data
- [ ] Remember conversation history per case

### 2.2 Multi-Format File Support
Expand beyond PDFs to accept:
- [ ] **PDFs** - Skip-trace reports, court documents
- [ ] **Images** (JPG, PNG) - Surveillance photos, profile pics
- [ ] **Text files** - Notes, raw data
- [ ] **DOC/DOCX** - Word documents
- [ ] Support up to **20 files per case**
- [ ] File preview before analysis

### 2.3 Cross-Reference Analysis Engine
AI analyzes ALL uploaded files together to find:
- [ ] **Address patterns** - Which addresses appear across multiple sources?
- [ ] **Timeline analysis** - Current vs historical data
- [ ] **Relationship mapping** - Who knows who? Who lives with who?
- [ ] **Vehicle tracking** - Current vehicles, license plates, registration info
- [ ] **Phone number analysis** - Active vs disconnected, carrier info
- [ ] **Employment patterns** - Current/past employers, work schedules
- [ ] **Social connections** - Relatives, associates, co-defendants

### 2.4 Smart Outputs
- [ ] **Top 4 Addresses** - Ranked by probability percentage
  - Include reasoning (e.g., "Mother's address - 78% - recent utility bill")
- [ ] **Current Vehicles** - With plates, color, make/model
- [ ] **Hot Leads** - Time-sensitive information
- [ ] **Stale Data Warnings** - Flag info older than 6 months

### 2.5 Face Detection & Profile Management
- [ ] When image uploaded, detect if it contains a face
- [ ] Ask: "Is this your target?"
- [ ] If yes, set as case profile picture
- [ ] Store multiple images of target for reference
- [ ] Flag associate photos separately

### 2.6 Interactive Q&A Flow
AI asks clarifying questions:
- [ ] "I found 3 relatives. Do you have data files on any of them?"
- [ ] "This address shows 2 people. Should I cross-reference the other resident?"
- [ ] "License plate ABC-123 appears. Want me to flag this vehicle?"
- [ ] "I notice a pattern - subject uses mother's maiden name. Want me to search aliases?"

Detective can respond and guide the analysis:
- [ ] "Focus on the Hammond area addresses"
- [ ] "The girlfriend is the key - analyze her data first"
- [ ] "Ignore anything older than 2023"

---

## Phase 3: Social Media Intelligence (FUTURE)

### 3.1 Social Media Discovery
- [ ] Search for target across platforms:
  - Facebook
  - Instagram
  - TikTok
  - Twitter/X
  - LinkedIn
  - Snapchat (public stories)
- [ ] Search by name, aliases, phone, email
- [ ] Search associates' social media for target mentions

### 3.2 Photo Scraping
- [ ] Download public profile pictures
- [ ] Scan tagged photos for target
- [ ] Extract location data from photos (EXIF)
- [ ] Identify frequent locations from posts

### 3.3 Activity Analysis
- [ ] Recent check-ins and locations
- [ ] Friend/follower connections
- [ ] Post timing patterns (when are they active?)
- [ ] Relationship status changes
- [ ] Job/employment updates

### 3.4 Alert System
- [ ] Monitor for new posts mentioning target
- [ ] Alert on location check-ins
- [ ] Notify when associates post about target

---

## Phase 4: Advanced Intelligence (FUTURE)

### 4.1 Predictive Analysis
- [ ] Predict likely locations based on patterns
- [ ] Day/time probability (where might they be on Tuesday at 2pm?)
- [ ] Holiday/event predictions (likely at mom's for Christmas)

### 4.2 Route Planning
- [ ] Optimal route to check multiple addresses
- [ ] Best times to visit each location
- [ ] Nearby points of interest (jobs, hangouts)

### 4.3 Team Collaboration
- [ ] Share cases with team members
- [ ] Real-time updates
- [ ] Assignment tracking
- [ ] Field notes from multiple agents

### 4.4 Integration APIs
- [ ] Court record lookups
- [ ] DMV data (where legal)
- [ ] Jail/booking records
- [ ] Warrant verification

---

## Technical Architecture

### AI Analysis Pipeline
```
[File Upload] → [Text Extraction] → [Entity Recognition] → [Cross-Reference] → [Pattern Analysis] → [Ranked Output]
```

### Entity Types Extracted
- Names (target, relatives, associates)
- Addresses (with dates, current flag)
- Phone numbers (with carrier, status)
- Vehicles (make, model, plate, color)
- Employers (name, address, dates)
- Social Security (partial, for verification)
- Dates of Birth
- Aliases

### Confidence Scoring
Each piece of information gets a confidence score:
- **High (80-100%)**: Multiple sources confirm, recent data
- **Medium (50-79%)**: Single source, moderately recent
- **Low (0-49%)**: Old data, unverified, conflicting info

### Privacy & Compliance
- All data encrypted at rest (AES-256)
- Audit logging for GLBA/DPPA compliance
- User must attest to lawful purpose
- Auto-delete options (7/30/90 days)
- No data stored on external servers (local + Firebase only)

---

## Commands for Development

```bash
# Start development
cd /Users/doug/elite-recovery-la/recovery-app
npm start

# Build for web
npx expo export --platform web

# Deploy to Vercel
npx vercel --prod --yes

# Production URL
https://recovery-app-blond.vercel.app
```

---

## Contact
- **Business**: Elite Recovery of Louisiana
- **Email**: douglas@eliterecoveryla.com
- **Phone**: 985-264-9519
- **Domain**: eliterecoveryla.com

---

*Last Updated: January 2026*
