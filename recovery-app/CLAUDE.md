# CLAUDE.md - Elite Recovery System

This file provides context for Claude Code sessions working on this project.

## Project Overview

**Elite Recovery System** is a professional mobile/web application for licensed bail recovery (fugitive recovery) professionals. It helps agents locate and apprehend defendants who have failed to appear for court.

## Tech Stack

- **Frontend**: Expo/React Native (works on web, iOS, Android)
- **Routing**: Expo Router (file-based)
- **Auth**: Firebase Authentication (email/password)
- **Database**: Firebase Firestore + local SQLite
- **Styling**: React Native StyleSheet with dark theme
- **OSINT Backend**: Python FastAPI on Render

## Key Features

1. **Case Management**: Create and track recovery cases with subject info
2. **AI Chat Assistant**: Natural language interface for case operations
3. **OSINT Integration**: Social media profile discovery using Python tools
4. **Document Analysis**: Upload skip trace reports for AI extraction
5. **Face Matching**: Compare photos against subject
6. **Audit Logging**: Track all investigative actions for compliance

## Architecture

```
/app                    # Expo Router pages
  /(tabs)               # Main tab navigation (Cases, Audit, Settings)
  /auth                 # Login, Signup, Forgot Password
  /case/[id]            # Individual case view with chat
  /about.tsx            # About page
  /index.tsx            # Home screen

/src
  /components           # Reusable UI components
  /contexts             # React contexts (Auth)
  /hooks                # Custom hooks (useCases, useCase)
  /lib                  # Utilities
    /firebase.ts        # Firebase auth & Firestore
    /python-osint.ts    # Python backend client
    /database.ts        # Local SQLite operations

/osint-backend          # Python OSINT backend (deployed on Render)
  /main.py              # FastAPI server with OSINT tools
```

## OSINT Backend

Deployed at: `https://elite-recovery-osint.onrender.com`

**Tools installed:**
- **Sherlock**: Username search across 400+ social networks
- **Maigret**: Enhanced username enumeration
- **Holehe**: Email account discovery
- **Socialscan**: Username availability check

**Endpoints:**
- `GET /health` - Health check
- `POST /api/investigate` - Intelligent person investigation
- `POST /api/sherlock` - Username search
- `POST /api/maigret` - Username search
- `POST /api/holehe` - Email search

## Development Commands

```bash
# Start Expo dev server
npm start

# Run on web
npm run web

# Deploy to Vercel
npx vercel --prod --yes
```

## Firebase Setup

Firebase project: `fugitive-database`
- Auth: Email/Password enabled
- Firestore: For user profiles and organizations (optional)
- Config is hardcoded in `/src/lib/firebase.ts`

## Important Notes

1. **Navigation**: Back buttons use explicit routes (not router.back()) for reliability on web
2. **Auth**: SignIn skips Firestore profile fetch to avoid offline errors
3. **Logo**: Clicking logo navigates to home page
4. **Branding**: App is called "Elite Recovery System" throughout

## AI Services Status

**All working - NO API KEYS NEEDED by user**

| Service | Status | What It Does |
|---------|--------|--------------|
| Sherlock | WORKING | Username search (400+ sites) |
| Maigret | WORKING | Username intelligence |
| Holehe | WORKING | Email account discovery |
| Socialscan | WORKING | Username availability |
| GPT-4o-mini Chat | WORKING | AI chat responses |
| GPT-4o-mini Analysis | WORKING | Document analysis |
| Recovery Brief | WORKING | Tactical brief generation |

OpenAI API key is configured on the Render backend - users don't need their own keys.

## Admin Page

Go to Settings → Admin/Diagnostics to test all backend services.

Tests available:
- Backend health check
- AI chat test
- AI brief generation
- Sherlock username search
- Holehe email discovery

## Recent Changes (Jan 2026)

- Added Admin/Diagnostics page for backend testing
- Fixed document analysis to use backend (no local API key needed)
- Smart chat detection for OSINT commands
- Simplified right panel UI
- Fixed login issues (Firestore offline errors)
- Made login page compact card-style
- Added clickable logo navigation
- Fixed all back button navigation
- Renamed from "Fugitive Recovery System" to "Elite Recovery System"
- Deployed Python OSINT backend with intelligent investigation flow

## Testing

1. Login: Use Firebase email/password auth
2. Create case: Add subject name and info
3. OSINT: Type "do social search" in chat to trigger tools
4. Upload: Add skip trace PDFs for AI extraction

## Deployment

- **Frontend**: Vercel (auto-deploys from GitHub)
- **OSINT Backend**: Render (manual deploy)
- **GitHub**: https://github.com/douggil74/elite-recovery-app
