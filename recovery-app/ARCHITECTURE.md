# TRACE Recovery App - Architecture (v4.0.0)

## Cloud-First Architecture

All case data lives in Firebase Firestore. No local SQLite. AsyncStorage is used only as a read cache for settings. A user must be logged in to access any data.

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

## Data Model (Firestore)

```
Firestore Root
|
+-- cases/{caseId}                    # Case document
|   |-- userId: string                # Owner (Firebase Auth UID)
|   |-- name: string                  # Subject name
|   |-- purpose: "fta_recovery"
|   |-- createdAt, updatedAt: string
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
|   +-- chat/history                  # Single doc: chat messages
|   |   |-- messages: Message[]
|   |
|   +-- photo/target                  # Single doc: subject photo
|       |-- dataUrl: string           # Base64 photo
|
+-- users/{uid}
|   +-- data/settings                 # User settings (API keys, prefs)
|   |   |-- openaiApiKey, anthropicApiKey
|   |   |-- googleMapsApiKey, googleVoiceNumber
|   |   |-- storageMode, maskFieldsByDefault
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
| `src/lib/database.ts` | All CRUD: cases, reports, audit log (Firestore direct) |
| `src/lib/storage.ts` | Settings (Firestore + AsyncStorage cache), PDF file ops |
| `src/lib/sync.ts` | Chat/photo sync, real-time subscriptions (onSnapshot) |

### Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useCases.ts` | Cases list with real-time subscription |
| `src/hooks/useCase.ts` | Single case + reports loading |
| `src/hooks/useSettings.ts` | Settings read/write |

### Auth
| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Auth state, login/logout, settings cache |

## Data Flow

### Case Creation
```
User enters name -> dbCreateCase()
  -> Writes to Firestore: cases/{id} with userId
  -> Real-time subscription fires -> UI updates
```

### Document Upload & Analysis
```
User uploads PDF/DOCX/TXT
  -> Text extracted (OCR if needed via backend)
  -> AI analyzes (Claude or GPT-4o)
  -> createReport() writes to Firestore: cases/{id}/reports/{rid}
  -> Report displayed in case detail
```

### Cases List Loading
```
useCases hook mounts
  -> getAllCases(): Firestore query where userId == currentUser
  -> subscribeToAllCases(): onSnapshot for real-time updates
  -> Cases list renders immediately from query results
  -> Real-time subscription keeps list updated
```

### Settings
```
Read: AsyncStorage cache first (instant) -> Firestore background sync
Write: Firestore first -> AsyncStorage cache update
```

## Performance Optimizations (v4.0)

1. **No blocking Firestore reads on login** - Settings from local cache, everything else background
2. **No N+1 queries on cases list** - Cases list uses case doc data only, no per-case report/photo fetches
3. **Parallel AsyncStorage reads** - Case detail loads all local data via Promise.all
4. **Debounced chat saves** - Chat syncs 1 second after last message, not on every message
5. **Real-time subscriptions** - onSnapshot handles live updates without polling
6. **Graceful offline handling** - All reads return empty/null on offline errors instead of crashing

## Environment

| Service | URL |
|---------|-----|
| Frontend | https://eliterecoverysystem.com (Vercel) |
| Backend | https://elite-recovery-osint.fly.dev (Fly.io) |
| Database | Firebase Firestore (fugitive-database) |
| Auth | Firebase Auth |

## Build & Deploy

```bash
npx expo export --platform web    # Build
npx vercel --prod                 # Deploy
```

## Security

- Firebase Auth required for all data access
- Firestore security rules enforce userId-based access
- API keys stored in Firestore (not in code), cached locally
- Passcode-related settings never synced to cloud
- Audit log tracks all case operations
- Settings preserved across sign-out (API keys only)
- All other local data cleared on sign-out
