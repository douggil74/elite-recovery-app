# Security Documentation

## Overview

This document describes the security measures implemented in the Bail Recovery App.

## Data Protection

### Encryption at Rest

**Database Encryption**
- All sensitive report data is encrypted using AES-256-GCM before storage
- Encryption key is generated on first launch and stored in device secure enclave
- Key management uses `expo-secure-store` (iOS Keychain / Android Keystore)

**File Storage**
- PDF files stored in app sandbox (not accessible to other apps)
- Files can be optionally encrypted before storage
- Automatic cleanup on case deletion

### Encryption in Transit

- HTTPS required for all network requests
- Certificate pinning recommended for production
- API keys transmitted securely via request headers

## Authentication

### Local App Lock

**Passcode**
- 4-8 digit numeric passcode
- SHA-256 hashed before storage
- No plain text passcode storage
- Brute force protection (5 attempts, then lockout)

**Biometrics**
- Face ID / Touch ID (iOS)
- Fingerprint / Face unlock (Android)
- Uses `expo-local-authentication`
- Falls back to passcode if biometrics fail

### Session Management

- Authentication timeout: 5 minutes of inactivity
- Manual "Lock Now" option in settings
- Session cleared on app backgrounding (configurable)

## Audit Logging

### What's Logged

| Action | Data Logged |
|--------|-------------|
| Case Created | Case ID, name, purpose, timestamp |
| Case Updated | Case ID, fields changed, timestamp |
| Case Deleted | Case ID, name, timestamp |
| PDF Uploaded | Case ID, filename, timestamp |
| Report Analyzed | Case ID, parse method, timestamp |
| Field Revealed | Case ID, field name, timestamp |
| Brief Generated | Case ID, timestamp |
| Brief Exported | Case ID, format (masked/full), timestamp |
| Journey Created | Case ID, stop count, timestamp |

### Log Storage

- Logs stored in SQLite database
- No sensitive data in logs (case IDs only)
- Logs retained until manual deletion
- Can be exported for compliance review

### What's NOT Logged

- Actual report content
- Addresses, phone numbers, names
- User location data
- Passwords or API keys

## Data Minimization

### Local-First Architecture

- All processing done on-device when possible
- No data sent to cloud by default
- Backend (if used) is stateless - no data persistence

### Minimal Data Retention

- Auto-delete feature for cases (7/30/90 days)
- Complete deletion removes all traces
- No hidden backups or caches

### Data Not Collected

- User location (only entered manually for journey planning)
- Device identifiers
- Usage analytics
- Crash reports with sensitive data

## Access Control

### Case-Level Access

- Cases isolated per device
- No multi-user support (single device = single user)
- No sharing between devices without explicit export

### Field-Level Protection

- Sensitive fields masked by default
- Tap-to-reveal requires confirmation
- Reveal action logged in audit trail

## Anti-Stalking Safeguards

### No Real-Time Tracking

- Journey planning uses Maps deep links only
- No embedded tracking or monitoring
- No location sharing or broadcasting

### Mandatory Attestations

- Lawful use attestation required before analysis
- Purpose selection required for each case
- Clear warnings about misuse consequences

### Audit Trail

- All actions logged with timestamps
- Cannot be disabled or deleted by user
- Provides accountability trail

## Secure Development

### Dependencies

- Regular security audits of npm packages
- Minimal dependency footprint
- No unnecessary third-party services

### Code Security

- TypeScript for type safety
- No eval() or dynamic code execution
- Input validation on all user inputs
- Output encoding for display

## Incident Response

### Data Breach

1. Immediately revoke all API keys
2. Force app lock on all sessions
3. Review audit logs
4. Notify affected parties per applicable regulations

### Lost/Stolen Device

1. Device should auto-lock after timeout
2. Passcode/biometrics protect data access
3. Data encrypted at rest
4. Remote wipe via device management (iOS/Android)

## Compliance

### GLBA/DPPA

- App designed for permissible purpose use only
- Attestation flow captures user acknowledgment
- Audit logs provide compliance documentation

### Data Retention

- Configurable retention periods
- Complete deletion capability
- No hidden data persistence

## Recommendations

### For Deployment

1. Enable passcode + biometrics
2. Set appropriate auto-delete period
3. Regularly review audit logs
4. Train users on lawful use requirements

### For Production

1. Implement certificate pinning
2. Add device attestation
3. Consider MDM integration
4. Regular security assessments

## Contact

For security concerns, contact your system administrator or the designated security officer.
