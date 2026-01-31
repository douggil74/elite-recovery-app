# TRACE Recovery App - Architecture (v4.1.0)

## Cloud-First Architecture

All case data lives in Firebase Firestore. No local SQLite. AsyncStorage is used only as a read cache for settings. A user must be logged in to access any data.

### Firestore Connectivity

The Firestore JavaScript SDK uses WebSocket connections that can be unreliable in some environments. To work around this, the app implements a **REST API fallback** for all critical writes and reads:

1. **Writes**: Try WebSocket (5s timeout) -> Fall back to Firestore REST API
2. **Reads**: Try cache -> Try WebSocket (15s timeout) -> Fall back to REST API query
3. **Connection test**: Uses REST API directly (most reliable)

The REST API uses the authenticated user's Firebase ID token for authorization.

## Login Sequence (runs every login)

```
1. Firebase Auth (signInWithEmailAndPassword)     ~1-2s network
2. setCurrentUserId(uid)                          instant
3. Read settings from AsyncStorage cache          instant (local)
4. Set loading=false -> app renders               immediate
5. [Background] Sync settings from Firestore      non-blocking
6. [Background] Migrate old local data            non-blocking
7. [Background] Load organization info            non-blocking
8. [Background] Real-time subscription starts     non-blocking
```

Settings (API keys) are preserved in AsyncStorage across sign-outs so they survive device restarts. Firestore sync happens in background on every login to keep the cache fresh.

## API Keys & Backend Architecture

### Vercel Serverless Functions (v4.1.0)

API keys are stored as **Vercel environment variables** (server-side, never exposed to client):

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | GPT-4o for AI chat and document analysis |
| `ANTHROPIC_API_KEY` | Claude for bail document analysis |
| `GOOGLE_MAPS_API_KEY` | Maps and geocoding |
| `IPQUALITYSCORE_API_KEY` | Phone/email reputation scoring |

**Vercel API Routes** (serverless functions in `/api/`):

| Route | Purpose |
|-------|---------|
| `POST /api/ai/chat` | Proxies chat requests to OpenAI using server-side key |

The frontend calls `/api/ai/chat` (relative URL) which hits the Vercel serverless function. No API keys are sent from or stored on the client.

### Fly.io Backend (Python OSINT)

The Python backend at `elite-recovery-osint.fly.dev` handles OSINT-specific tools that require Python libraries:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/sherlock` | Username search across 400+ sites |
| `POST /api/holehe` | Email registration check |
| `POST /api/osint/search` | Combined OSINT search |
| `GET /health` | Backend health check |

## Data Model (Firestore)

```
Firestore Root
|
+-- cases/{caseId}                    # Case document
|   |-- userId: string                # Owner (Firebase Auth UID)
|   |-- name: string                  # Subject name
|   |-- purpose: "fta_recovery"
|   |-- createdAt, updatedAt: string
|   |-- primaryTarget: object         # Locked subject identity
|   |-- ftaScore, ftaRiskLevel        # Optional FTA data
|   |-- mugshotUrl, bookingNumber     # Optional jail data
|   |-- charges[], bondAmount         # Optional charges
|   |-- rosterData                    # Optional raw jail roster
|   |-- syncedAt: serverTimestamp
|   |
|   +-- reports/{reportId}            # Subcollection: parsed reports
|   |   |-- parsedData: ParsedReport  # AI analysis results
|   |   |-- pdfPath: string           # Optional file ref
|   |   |-- createdAt: string
|   |
|   +-- documents/{docId}             # Subcollection: uploaded doc text
|   |   |-- name, text, date          # Raw document content
|   |
|   +-- chat/history                  # Single doc: chat messages
|   |   |-- messages: Message[]
|   |
|   +-- photo/target                  # Single doc: subject photo
|       |-- dataUrl: string           # Base64 photo
|
+-- users/{uid}
|   +-- data/settings                 # User settings (prefs only now)
|   |   |-- storageMode, maskFieldsByDefault
|   |   |-- googleVoiceNumber
|   |
|   +-- audit/{entryId}              # Audit log entries
|       |-- action, caseId, details, timestamp
|
+-- organizations/{orgId}            # Organization (optional)
    |-- name, plan, memberCount
```

## Key Files

### Core Data Layer
| File | Purpose |
|------|---------|
| `src/lib/auth-state.ts` | Module-level userId holder (no circular deps) |
| `src/lib/firebase.ts` | Firebase init, Auth functions, Firestore re-exports |
| `src/lib/database.ts` | All CRUD: cases, reports, audit log (Firestore + REST API fallback) |
| `src/lib/storage.ts` | Settings (Firestore + AsyncStorage cache), PDF file ops |
| `src/lib/sync.ts` | Chat/photo sync, real-time subscriptions (onSnapshot) |
| `src/lib/case-intel.ts` | Case intelligence store (addresses, contacts, vehicles, notes) |
| `src/prompts/index.ts` | TRACE AI system prompt and context builder |

### Serverless API
| File | Purpose |
|------|---------|
| `api/ai/chat.js` | Vercel serverless function - OpenAI chat proxy |

### Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useCases.ts` | Cases list with real-time subscription |
| `src/hooks/useCase.ts` | Single case + reports loading + document analysis |
| `src/hooks/useSettings.ts` | Settings read/write |

### Auth
| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Auth state, login/logout, settings cache |

## Data Flow

### Case Creation
```
User enters name -> dbCreateCase()
  -> Try WebSocket write (5s timeout)
  -> If timeout: Fall back to REST API write
  -> Real-time subscription fires -> UI updates
```

### Document Upload & Analysis
```
User uploads PDF/DOCX/TXT
  -> Text extracted (OCR if needed via Fly.io backend)
  -> Text stored in Firestore: cases/{id}/documents/{did}
  -> AI analyzes via /api/ai/chat (Vercel serverless -> OpenAI)
  -> AI returns ACTION blocks -> parsed by case-intel.ts
  -> Contacts, addresses, vehicles added to case intel
  -> createReport() writes to Firestore: cases/{id}/reports/{rid}
```

### Reanalyze Flow (v4.1.0)
```
User clicks "Reanalyze" button (or types /reanalyze)
  -> Clear all existing case intel (addresses, contacts, vehicles)
  -> Load document text from memory / AsyncStorage / Firestore
  -> Send all documents to AI via /api/ai/chat
  -> AI extracts fresh intel using ACTION blocks
  -> Contact names validated (reject data headers, column names)
  -> Addresses deduplicated before adding
  -> Case intel updated with clean data
```

### Cases List Loading
```
useCases hook mounts
  -> getAllCases(): Try cache -> Try WebSocket -> Try REST API
  -> subscribeToAllCases(): onSnapshot for real-time updates
  -> Cases list renders immediately from query results
  -> Real-time subscription keeps list updated
```

### Settings
```
Read: AsyncStorage cache first (instant) -> Firestore background sync
Write: AsyncStorage first -> Firestore (WebSocket or REST API fallback)
```

## Cloud Sync Status Indicator (v4.1.0)

The cases list shows a sync status bar below the TRACE header:
- **Green "Cloud sync active (XXXms)"**: REST API connectivity verified
- **Red "Cloud sync failed"**: Cannot reach Firestore (tap to retry)
- **Tapping the bar**: Forces sync of all cached cases to cloud via REST API

## Contact Name Validation (v4.1.0)

When AI adds contacts via ACTION blocks, names are validated to prevent junk data:
- Rejects known data headers (e.g., "Reference Code", "Carrier Location")
- Rejects single-word non-names, all-uppercase headers
- Requires minimum 3 characters
- Must contain vowels (basic name check)
- Defined in `case-intel.ts` INVALID_CONTACT_NAMES set

## Address Deduplication (v4.1.0)

Addresses are normalized before adding:
- Lowercased, whitespace collapsed
- Punctuation standardized
- Compared against existing addresses using substring matching
- Prevents the same address from appearing multiple times

## Performance Optimizations

1. **No blocking Firestore reads on login** - Settings from local cache, everything else background
2. **No N+1 queries on cases list** - Cases list uses case doc data only, no per-case report/photo fetches
3. **Parallel AsyncStorage reads** - Case detail loads all local data via Promise.all
4. **Debounced chat saves** - Chat syncs 1 second after last message, not on every message
5. **Real-time subscriptions** - onSnapshot handles live updates without polling
6. **Graceful offline handling** - All reads return empty/null on offline errors instead of crashing
7. **REST API fallback** - Critical writes guaranteed via REST when WebSocket fails
8. **Server-side API keys** - No client-side key management needed

## Environment

| Service | URL |
|---------|-----|
| Frontend + API | https://recovery-app-blond.vercel.app (Vercel) |
| Python OSINT Backend | https://elite-recovery-osint.fly.dev (Fly.io) |
| Database | Firebase Firestore (fugitive-database, nam5) |
| Auth | Firebase Auth |

## Build & Deploy

```bash
npx expo export --platform web    # Build
npx vercel --prod                 # Deploy (includes serverless functions)
```

### Vercel Environment Variables

```bash
npx vercel env ls                 # List all env vars
npx vercel env add VAR_NAME       # Add new env var
npx vercel env rm VAR_NAME        # Remove env var
```

## Security

- Firebase Auth required for all data access
- Firestore security rules enforce userId-based access (`request.auth != null`)
- API keys stored as Vercel environment variables (never client-side)
- Vercel serverless functions proxy all AI calls (keys never leave server)
- Passcode-related settings never synced to cloud
- Audit log tracks all case operations
- Settings preserved across sign-out (preferences only)
- All other local data cleared on sign-out
- Contact name validation prevents data injection from parsed documents

## Recent Changes (January 28, 2026)

### v4.1.0 - Cloud Sync & Architecture
- **Vercel Serverless API**: AI chat proxied through `/api/ai/chat` with server-side OpenAI key
- **API keys moved to Vercel env vars**: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, IPQUALITYSCORE_API_KEY
- **Firestore REST API fallback**: All writes/reads fall back to REST API when WebSocket fails
- **Cloud sync status indicator**: Shows connection status on cases list, tap to force sync
- **Force sync function**: Pushes all locally cached cases to cloud via REST API
- **Reanalyze button**: Clears old intel and re-processes all documents fresh via AI chat
- **Contact name validation**: Rejects Delvepoint column headers and data labels as contacts
- **Address deduplication**: Normalizes and deduplicates addresses before adding
- **Updated AI prompt**: Instructs AI to ignore skip trace column headers
- **Dashboard removed**: App redirects directly to cases list on login
- **sendMessage accepts override text**: Enables programmatic chat commands (reanalyze button)

### v4.0.0 - Cloud-First (January 25, 2026)
- Migrated all data to Firebase Firestore
- Removed local SQLite dependency
- Added real-time subscriptions
- Added organization support
