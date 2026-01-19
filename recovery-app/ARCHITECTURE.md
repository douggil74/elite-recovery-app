# Bail Recovery App - Architecture Plan

## Overview
A secure mobile app for licensed bail recovery professionals to analyze person reports for:
1. Identity verification (client release from jail)
2. Location-lead organization (FTA recovery)

## Safety & Compliance Features
- **Case Purpose Attestation**: Required before any analysis
- **Anti-Stalking Warning**: Must accept before use
- **Audit Logging**: All actions logged (upload, parse, view, export, delete)
- **Data Minimization**: Local-first processing, encrypted storage
- **Delete Case**: Complete data wipe capability
- **No Real-Time Tracking**: Maps deep links only, no embedded tracking

## Folder Structure
```
recovery-app/
├── app/                          # Expo Router screens
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Cases list
│   │   ├── audit.tsx            # Audit log viewer
│   │   └── settings.tsx         # Settings screen
│   ├── case/
│   │   ├── new.tsx              # Create new case
│   │   ├── [id]/
│   │   │   ├── index.tsx        # Case detail
│   │   │   ├── upload.tsx       # Upload PDF
│   │   │   ├── brief.tsx        # Recovery Brief
│   │   │   ├── journey.tsx      # Journey Plan
│   │   │   └── export.tsx       # Export PDF
│   ├── _layout.tsx              # Root layout
│   ├── index.tsx                # Entry -> auth check
│   ├── lock.tsx                 # Passcode/biometric lock
│   └── purpose.tsx              # Case purpose attestation
├── src/
│   ├── components/
│   │   ├── MaskedField.tsx      # Tap-to-reveal with confirmation
│   │   ├── CaseCard.tsx
│   │   ├── AddressCard.tsx
│   │   ├── PhoneCard.tsx
│   │   ├── RelativeCard.tsx
│   │   ├── VehicleCard.tsx
│   │   ├── ChecklistItem.tsx
│   │   ├── WarningBanner.tsx
│   │   └── ui/                  # Base UI components
│   ├── lib/
│   │   ├── database.ts          # SQLite operations
│   │   ├── audit.ts             # Audit logging
│   │   ├── encryption.ts        # AES encryption helpers
│   │   ├── storage.ts           # File storage
│   │   ├── auth.ts              # Passcode/biometrics
│   │   ├── parser/
│   │   │   ├── index.ts         # Main parser entry
│   │   │   ├── patterns.ts      # Regex patterns
│   │   │   ├── ranker.ts        # Address/phone ranking
│   │   │   └── schema.ts        # Output schema
│   │   └── analyzer.ts          # Analysis engine
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCase.ts
│   │   ├── useCases.ts
│   │   └── useSettings.ts
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   └── constants/
│       └── index.ts
├── __tests__/
│   ├── parser.test.ts
│   └── ranker.test.ts
├── fixtures/
│   └── sample-report.txt        # Fake PDF text for testing
├── backend/                     # Optional Node backend
│   ├── src/
│   │   ├── index.ts
│   │   └── routes/
│   │       ├── extract.ts
│   │       └── analyze.ts
│   ├── package.json
│   └── tsconfig.json
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
└── README.md
```

## Data Flow
```
[PDF Upload] → [Text Extraction] → [Deterministic Parser]
                                          ↓
                              [Pattern Match?]
                              ↓ Yes        ↓ No
                    [Structured Data]  [LLM Fallback]
                              ↓              ↓
                         [Ranking Engine]
                              ↓
                    [Recovery Brief / Journey Plan]
```

## Database Schema (SQLite)
```sql
-- Cases table
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  internal_case_id TEXT,
  purpose TEXT NOT NULL, -- 'verification' | 'fta_recovery'
  notes TEXT,
  attestation_accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  auto_delete_at TEXT
);

-- Parsed reports
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  pdf_path TEXT, -- encrypted file path
  raw_text_hash TEXT, -- for dedup
  parsed_data TEXT NOT NULL, -- encrypted JSON
  created_at TEXT NOT NULL
);

-- Audit log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## Security Measures
1. **Storage Encryption**: All sensitive data encrypted with AES-256-GCM
2. **App Lock**: Passcode + biometric authentication
3. **Masked Fields**: SSN, full addresses masked by default
4. **Audit Trail**: Every action logged with timestamp
5. **Auto-Delete**: Configurable retention period
6. **No Cloud by Default**: Local-only storage option

## Analysis Engine
### Deterministic Parser Patterns
- Address sections: "ADDRESS SUMMARY", "CURRENT ADDRESS", "PREVIOUS ADDRESSES"
- Phone sections: "PHONE SUMMARY", "PHONE NUMBERS"
- Relative sections: "RELATIVES", "ASSOCIATES", "POSSIBLE RELATIVES"
- Vehicle sections: "VEHICLES", "REGISTERED VEHICLES", "CURRENT VEHICLES"
- Employment sections: "EMPLOYMENT", "POSSIBLE EMPLOYMENT"
- Flags: "DECEASED", "HIGH RISK", "FRAUD ALERT"

### Ranking Algorithm
- **Recency**: Dates within last year score highest
- **Corroboration**: Address tied to multiple signals (phone, vehicle, employment) scores higher
- **Source Quality**: Direct records > inferred data
- **Confidence Score**: 0.0 - 1.0 based on above factors

## API Endpoints (Backend - Optional)
```
POST /api/extract-text
  Body: { pdf: base64 }
  Response: { text: string }

POST /api/analyze
  Body: { text: string, useAI: boolean }
  Response: { parsed: ParsedReport }
```

## Tech Decisions
- **Expo SDK 52+**: Latest stable with Expo Router
- **expo-sqlite**: Local encrypted database
- **expo-document-picker**: PDF file selection
- **expo-local-authentication**: Biometrics
- **expo-file-system**: Encrypted file storage
- **expo-secure-store**: Encryption keys
- **pdf-parse (backend)**: PDF text extraction
