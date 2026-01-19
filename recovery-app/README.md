# Bail Recovery App

A secure mobile app for licensed bail bond professionals to analyze person reports for lawful purposes: identity verification and FTA recovery location planning.

## Important Notices

**This app is for authorized, lawful use only.**

- Only for licensed bail recovery / bail bond professionals
- Requires permissible purpose under GLBA/DPPA
- All actions are logged for compliance
- Misuse for harassment or stalking is strictly prohibited

## Features

### Core Functionality
- **Case Management**: Create and manage recovery cases
- **PDF Report Analysis**: Extract and structure person data
- **Recovery Brief**: AI-ranked locations and contact leads
- **Journey Planning**: Route planning with safety checklist
- **PDF Export**: Generate masked or full case briefs

### Security & Compliance
- Passcode and biometric authentication
- Data encryption at rest
- Audit logging of all actions
- Sensitive data masking (tap-to-reveal)
- Auto-delete cases after N days
- Complete case deletion capability

### Analysis Engine
- Deterministic parser for common report formats
- Claude AI fallback for complex reports
- Address ranking by recency and corroboration
- Phone ranking by type and activity status
- Risk flag detection (deceased, high-risk, fraud)

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Studio (for emulator)
- Expo Go app (for physical device testing)

### Mobile App Setup

```bash
# Navigate to the recovery-app directory
cd recovery-app

# Install dependencies
npm install

# Start the Expo development server
npm start
```

This will open the Expo Dev Tools. From there:
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app for physical device

### Backend Setup (Optional)

The backend provides PDF text extraction. The mobile app works without it (manual text paste).

```bash
# Navigate to backend directory
cd recovery-app/backend

# Install dependencies
npm install

# Start development server
npm run dev
```

The backend runs on `http://localhost:3001` by default.

## Environment Variables

### Mobile App

Create a `.env` file or configure in Settings:

```
# Claude API Key (optional - for AI analysis)
# Set via Settings screen in app
CLAUDE_API_KEY=sk-ant-...
```

### Backend

```bash
# Optional: Set port (default 3001)
PORT=3001
```

## Usage

### Creating a Case

1. Open the app and tap "New Case"
2. Enter subject name and internal case ID
3. Select purpose: "Client Verification" or "FTA Recovery"
4. Complete the required lawful use attestation
5. Add notes if needed

### Analyzing a Report

1. Open a case and tap "Add Report"
2. Paste the full report text (copy from PDF viewer)
3. Tap "Analyze Report"
4. View the Recovery Brief for ranked results

### Journey Planning

1. Open a case with analyzed report
2. Tap "Journey Plan"
3. Enter your starting location
4. Complete the pre-trip safety checklist
5. Select destination addresses from the ranked list
6. Tap "Open in Google Maps" or "Open in Apple Maps"

### Exporting

1. Open a case with analyzed report
2. Tap "Export Brief"
3. Choose "Masked" (recommended) or "Full"
4. Share or save the generated PDF

## Running Tests

```bash
cd recovery-app
npm test
```

## Project Structure

```
recovery-app/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   ├── case/              # Case-related screens
│   └── ...
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/             # React hooks
│   ├── lib/               # Core logic
│   │   ├── parser/        # Report parsing
│   │   ├── database.ts    # SQLite operations
│   │   ├── audit.ts       # Audit logging
│   │   └── analyzer.ts    # Analysis engine
│   ├── types/             # TypeScript types
│   └── constants/         # App constants
├── backend/               # Optional backend service
├── __tests__/             # Unit tests
└── fixtures/              # Test fixtures
```

## Security Notes

### What's Encrypted
- All report data stored in SQLite is encrypted with AES-256
- Encryption key stored in device secure enclave (Expo SecureStore)
- PDFs stored in app sandbox with encryption

### What's Logged
- Case creation, updates, deletion
- PDF uploads
- Report analysis
- Sensitive field reveals (tap-to-reveal)
- Brief generation and export
- Journey plan creation

### How to Delete Data
- **Single Case**: Case Detail → "Delete Case" button
- **All Data**: Settings → "Clear All Data"
- **Auto-Delete**: Settings → Set auto-delete period (7/30/90 days)

### Data Storage
- Local-only by default (no cloud sync)
- All data stays on device
- Backend (if used) does not persist data

## API Reference (Backend)

### Extract Text from PDF

```
POST /api/extract-text
Content-Type: multipart/form-data

Body: pdf (file)

Response: {
  "success": true,
  "text": "...",
  "pages": 5
}
```

### Extract Text from Base64 PDF

```
POST /api/extract-text-base64
Content-Type: application/json

Body: { "pdf": "base64-encoded-pdf" }

Response: {
  "success": true,
  "text": "..."
}
```

### Analyze Text with AI

```
POST /api/analyze
Content-Type: application/json

Body: {
  "text": "report text...",
  "apiKey": "sk-ant-..."
}

Response: {
  "success": true,
  "data": { ... parsed report ... }
}
```

## Troubleshooting

### App won't start
- Ensure Node.js 18+ is installed
- Clear cache: `expo start -c`
- Delete node_modules and reinstall

### Biometrics not working
- Ensure device has biometrics enrolled
- Check iOS Info.plist / Android permissions
- Test on physical device (simulators may not support)

### Analysis fails
- Ensure report text is complete (not truncated)
- Check Claude API key in Settings (if using AI)
- Review the sample fixture format

### PDF export blank
- Ensure report has been analyzed first
- Check device storage permissions

## Legal Disclaimer

This software is provided for lawful bail recovery purposes only. Users must:

1. Hold valid bail bond/recovery licenses
2. Have permissible purpose under GLBA/DPPA
3. Comply with all applicable federal, state, and local laws
4. Never use for harassment, stalking, or illegal surveillance

The developers assume no liability for misuse of this software.

## License

Proprietary - For authorized use only.

## Support

For technical issues, contact your system administrator.
