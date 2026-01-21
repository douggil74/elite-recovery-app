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
- **Backend:** Python Flask on Render (`https://elite-recovery-osint.onrender.com`)
- **AI:** GPT-4o via backend proxy (no local API keys needed)
- **Storage:** AsyncStorage for local data, SQLite for cases
- **Auth:** Passcode + biometric with AES-256 encryption
- **Routing:** Expo Router (file-based)

---

## Core Features (All Working)

### 1. Photo Intelligence (`src/lib/photo-intelligence.ts`)
Upload any photo → AI extracts actionable intel:
- Addresses (house numbers, street signs, mailboxes)
- License plates (even partial)
- Businesses/landmarks (for geo-location)
- Geographic indicators (vegetation, architecture style)
- People descriptions (clothing, tattoos, associates)
- EXIF GPS coordinates (automatic extraction)

### 2. Face Matching (`src/lib/face-match.ts`)
Upload target photo → Compare against found photos:
- Extracts 30+ facial biometrics (bone structure focus)
- Ignores pose, lighting, expression, age differences
- Compares faces with match scores (0-100)
- Verdicts: LIKELY_MATCH, POSSIBLE_MATCH, UNLIKELY_MATCH, NO_MATCH

### 3. OSINT Tools (`src/lib/osint-service.ts`)
Social media and web searches:
- **Sherlock**: Username search across 400+ platforms
- **Maigret**: Enhanced username intelligence
- **Holehe**: Email account discovery
- Reverse image search capabilities
- Phone/email lookups

### 4. Case Management
- Create cases with subject info
- Upload documents (skip trace reports, court papers)
- Track addresses, vehicles, associates
- AI chat assistant per case
- Generate tactical recovery briefs

---

## Self-Learning AI System (Recently Built)

We built a system that **logs what works and what doesn't** for future reference. This creates institutional knowledge that persists across sessions.

### Knowledge Base Files (project root):
| File | Purpose |
|------|---------|
| `LEARNING.md` | Lessons learned, what works, what failed |
| `AI-PROMPTS.md` | Tested prompts with version history |
| `OSINT-TECHNIQUES.md` | OSINT methods encyclopedia |

### Code:
| File | Purpose |
|------|---------|
| `src/lib/learning-system.ts` | Core tracking module (AsyncStorage persistence) |
| `src/hooks/useLearningSystem.ts` | React hook for component integration |

### What Gets Automatically Tracked:
- Photo analysis successes (GPS found, addresses extracted, plates read)
- Face match results (high-confidence matches, comparison failures)
- OSINT tool effectiveness (which tools find results)
- Prompt performance (quality scores, failure patterns)

### How to Use It:
```typescript
import learningSystem from './lib/learning-system';

// Log a success
await learningSystem.logSuccess('photo_intelligence', 'GPS found in EXIF', 'Photo contained coordinates: 30.45, -90.12', 'HIGH');

// Log a failure
await learningSystem.logFailure('face_matching', 'Comparison failed', 'Backend timeout after 30s');

// Track prompt effectiveness
await learningSystem.trackPromptUse('photo_analysis_v3', '3.0', true, 85);
```

---

## Key Architecture Decisions

1. **Backend proxy for AI** - No API keys on device, all GPT calls go through Render backend
2. **Local-first storage** - Cases stored locally with encryption, no cloud dependency
3. **Non-blocking learning** - Learning calls use `.catch(() => {})` so failures don't break main features
4. **JSON output from AI** - All prompts require structured JSON output for reliable parsing
5. **Bone structure focus for faces** - Ignore lighting/pose/expression for accurate matching

---

## Important Files

```
/recovery-app
├── src/
│   ├── lib/
│   │   ├── photo-intelligence.ts   # Photo analysis with GPT-4o
│   │   ├── face-match.ts           # Face comparison system
│   │   ├── osint-service.ts        # OSINT tool integrations
│   │   ├── learning-system.ts      # AI learning tracker
│   │   ├── chat-context.ts         # Chat AI context builder
│   │   └── database.ts             # SQLite operations
│   ├── hooks/
│   │   ├── useLearningSystem.ts    # React hook for learning
│   │   ├── useCases.ts             # Case list hook
│   │   └── useCase.ts              # Single case hook
│   ├── components/
│   │   ├── PhotoIntelligence.tsx   # Photo upload/analysis UI
│   │   ├── FaceMatch.tsx           # Face comparison UI
│   │   └── OsintTools.tsx          # OSINT search UI
│   └── app/
│       ├── (tabs)/                 # Tab navigation screens
│       ├── case/[id].tsx           # Individual case view
│       └── auth/                   # Login screens
├── LEARNING.md                     # Knowledge base
├── AI-PROMPTS.md                   # Prompt library
├── OSINT-TECHNIQUES.md             # OSINT techniques
└── ARCHITECTURE.md                 # Technical architecture
```

---

## Backend Endpoints

**Base URL:** `https://elite-recovery-osint.onrender.com`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/ai/analyze` | POST | Image analysis with GPT-4o vision |
| `/api/ai/chat` | POST | Text chat completions |
| `/api/osint/search` | POST | OSINT searches |
| `/api/sherlock` | POST | Username search |
| `/api/maigret` | POST | Enhanced username intel |
| `/api/holehe` | POST | Email account discovery |
| `/api/investigate` | POST | Intelligent multi-tool investigation |

---

## Development Commands

```bash
cd recovery-app
npm install
npm start          # Start Expo dev server
npm run web        # Run in browser
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

---

## Prompt Engineering Lessons Learned

These are critical - follow them for all AI prompts:

1. **Never say "Unknown"** - Force AI to always estimate based on available evidence
2. **Require JSON output** - Always specify exact JSON structure in prompt
3. **List what to ignore** - Tell AI to ignore lighting, pose, expression for face matching
4. **Provide examples** - Show expected output format with sample data
5. **Set temperature appropriately**:
   - 0.1-0.2 for factual extraction
   - 0.3-0.5 for balanced analysis
   - 0.6-0.8 for creative suggestions
6. **Include context** - Pass case details, previous analysis results, etc.

See `AI-PROMPTS.md` for all tested prompts with version history.

---

## Current State (January 2026)

**All core features working:**
- ✅ Photo intelligence (extracts addresses, plates, GPS, businesses)
- ✅ Face matching (compares faces with bone structure focus)
- ✅ OSINT tools (Sherlock, Maigret, Holehe)
- ✅ Case management with AI chat
- ✅ Document analysis and extraction
- ✅ Learning system tracking successes/failures
- ✅ Knowledge base documentation

---

## Where We're Going

### Near-term priorities:
- [ ] UI to view/export learning reports
- [ ] Better EXIF extraction (more metadata fields)
- [ ] Batch photo processing
- [ ] Offline mode improvements
- [ ] Push notifications for social media activity

### Future roadmap:
- Real-time alerts when subject posts on social media
- Integration with bail bonds management systems
- Team collaboration features (shared cases)
- Court document auto-extraction
- Vehicle tracking integrations
- Geo-fencing alerts

---

## How to Continue Development

1. **Read first:** `LEARNING.md` for lessons learned
2. **Check prompts:** `AI-PROMPTS.md` for current working prompts
3. **Log successes:** Use `learningSystem.logSuccess()` when something works
4. **Log failures:** Use `learningSystem.logFailure()` when something fails
5. **Update docs:** Add new learnings to knowledge base files
6. **Version prompts:** Never delete old prompts, document changes

---

## Important Notes

- **Navigation:** Back buttons use explicit routes (not `router.back()`) for web reliability
- **Auth:** SignIn skips Firestore profile fetch to avoid offline errors
- **Branding:** App is called "Elite Recovery" throughout UI
- **Legal:** All features are for licensed bail recovery professionals only

---

## Deployment

- **Frontend:** Vercel (auto-deploys from GitHub)
- **Backend:** Render (manual deploy when needed)
- **GitHub:** Repository for version control

---

*This project helps licensed bail recovery agents do their job more effectively and safely. All features are designed for lawful fugitive recovery operations under proper legal authority.*
