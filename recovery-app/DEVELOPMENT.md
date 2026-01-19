# Recovery App - Development Notes & Learnings

## Overview
Bail recovery mobile app using Expo/React Native with AI-powered skip trace analysis.

---

## Key Learnings

### File Upload on Web (Expo)

**Problem**: File inputs don't render visibly on web with React Native styles.

**Solution**: Use a hidden HTML `<input type="file">` and trigger it via button click:
```tsx
{isWeb && (
  <input
    ref={fileInputRef}
    type="file"
    accept=".pdf,.txt,image/*"
    multiple
    onChange={handleFileChange}
    style={{ display: 'none' }}
  />
)}

<TouchableOpacity onPress={() => fileInputRef.current?.click()}>
  <Text>Upload</Text>
</TouchableOpacity>
```

**Key**: Use `Platform.OS === 'web'` to conditionally render web-only elements.

---

### PDF Text Extraction

**Problem**: Can't bundle pdfjs-dist with Metro (Expo's bundler) - dynamic import errors.

**Solution**: Load pdf.js from CDN at runtime instead of bundling:
```tsx
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
script.onload = () => {
  pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'CDN_URL/pdf.worker.min.mjs';
};
document.head.appendChild(script);
```

**File**: `src/lib/pdf-extract.ts`

---

### Large Report Chunking

**Problem**: Skip trace reports can be 80+ pages, exceeding AI token limits.

**Solution**: Intelligent chunking strategy:
1. Split on section boundaries (ADDRESSES, PHONES, RELATIVES, etc.)
2. Process chunks in parallel (3 at a time)
3. Merge and deduplicate results
4. Final analysis pass to rank locations

**Config**:
- `CHUNK_SIZE = 80000` chars (~20k tokens)
- `CHUNK_OVERLAP = 2000` chars (prevents cutting context)

**File**: `src/lib/analyzer.ts`

---

### Image Uploads = Target Photos

**Decision**: When user uploads an image (png, jpg, etc.), treat it as a target photo of the subject, NOT a document to OCR.

```tsx
const isImage = fileType.startsWith('image/') ||
  fileName.endsWith('.png') || fileName.endsWith('.jpg');

if (isImage) {
  // Save as subject photo
  setSubjectPhoto(dataUrl);
  await AsyncStorage.setItem(`case_photo_${id}`, dataUrl);
} else {
  // Process as skip trace report
  const result = await processUploadedFile(file);
}
```

---

### Case Status Tracking

**Status Types**:
- `new` - No reports uploaded yet
- `has_data` - Has analyzed report with addresses/phones
- `active` - Currently being worked (future)
- `located` - Subject found (future)

**Implementation**: Calculate status from report data in `useCases` hook:
```tsx
const reports = await getReportsForCase(caseId);
const addressCount = reports[0]?.parsedData?.addresses?.length || 0;
const status = addressCount > 0 ? 'has_data' : 'new';
```

---

### CSS in Web Components

**Problem**: React Native StyleSheet syntax doesn't work in HTML `<div>` elements.

**Wrong**:
```tsx
const dropZoneStyle = {
  borderWidth: 2,        // RN syntax
  borderStyle: 'dashed', // RN syntax
};
```

**Correct**:
```tsx
const dropZoneStyle: React.CSSProperties = {
  border: '2px dashed #30363d', // Web CSS syntax
};
```

---

## Architecture Decisions

### Single Purpose: Recovery Only
- Removed `verification` case type
- All cases are `fta_recovery` by default
- Simplifies UI and code paths

### Chat-Style Interface
- Case detail page uses conversational UI
- Paste text or upload files via paperclip
- AI responds with analysis and recommendations

### Dark Theme
- Primary: `#58a6ff` (blue)
- Success: `#3fb950` (green)
- Warning: `#d29922` (orange)
- Danger: `#f85149` (red)
- Background: `#0f1419`
- Surface: `#1c2128`

---

## File Structure

```
src/
├── components/
│   ├── CaseCard.tsx      # Case list item with status
│   ├── MultiFileUpload.tsx # Batch upload component
│   └── ...
├── hooks/
│   ├── useCase.ts        # Single case data + actions
│   └── useCases.ts       # All cases list with stats
├── lib/
│   ├── analyzer.ts       # AI analysis + chunking
│   ├── parser/           # Deterministic fallback parser
│   ├── pdf-extract.ts    # PDF text extraction
│   ├── database.ts       # SQLite operations
│   └── storage.ts        # File system operations
└── types/
    └── index.ts          # TypeScript types

app/
├── (tabs)/
│   └── index.tsx         # Cases list
├── case/
│   ├── new.tsx           # Create case
│   └── [id]/
│       ├── index.tsx     # Case detail (chat UI)
│       ├── upload.tsx    # Batch upload page
│       └── brief.tsx     # Recovery brief
└── ...
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| File picker grayed out | Check `accept` attribute includes needed types |
| PDF won't parse | Using CDN-loaded pdf.js, not bundled |
| Large report fails | Chunking enabled for >80k char reports |
| Images not working | Images become target photos, not docs |
| Status not showing | useCases fetches report stats for each case |

---

---

### PDF.js CDN Loading

**Problem**: ES Module version of pdf.js (v4.x) doesn't reliably expose `window.pdfjsLib`.

**Solution**: Use legacy UMD build (v3.x) which properly exposes the global:
```tsx
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
// Not the .mjs module version
```

**Tip**: Add small delay after script load to ensure initialization:
```tsx
script.onload = () => {
  setTimeout(() => {
    pdfjsLib = (window as any).pdfjsLib;
    // Now safe to use
  }, 100);
};
```

**File**: `src/lib/pdf-extract.ts`

---

### Inline Maps Per Location

**Pattern**: Instead of one large overview map, show individual map embeds per location:
```tsx
{Platform.OS === 'web' ? (
  <View style={styles.inlineMapContainer}>
    <iframe
      src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`}
      style={{ border: 0, width: '100%', height: '100%' }}
      loading="lazy"
    />
  </View>
) : (
  <TouchableOpacity onPress={() => openInMaps(address)}>
    <Text>View on Map</Text>
  </TouchableOpacity>
)}
```

**Benefits**: Better UX, each location has context, no need to correlate pins to legend.

**File**: `app/case/[id]/journey.tsx`

---

### Chat History Persistence

**Problem**: Component state resets when navigating away and back.

**Solution**: Persist chat messages to AsyncStorage:
```tsx
const [chatLoaded, setChatLoaded] = useState(false);

// Load on mount
useEffect(() => {
  AsyncStorage.getItem(`case_chat_${id}`).then((stored) => {
    if (stored) {
      const messages = JSON.parse(stored).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp), // Restore Date objects
      }));
      setChatMessages(messages);
    }
    setChatLoaded(true);
  });
}, [id]);

// Save on change
useEffect(() => {
  if (chatLoaded && chatMessages.length > 0) {
    AsyncStorage.setItem(`case_chat_${id}`, JSON.stringify(chatMessages));
  }
}, [chatMessages, chatLoaded]);
```

**Key**: Wait for `chatLoaded` before initializing greeting to avoid overwriting stored history.

**Cleanup**: Remove chat/photo when case is deleted:
```tsx
await AsyncStorage.removeItem(`case_chat_${id}`);
await AsyncStorage.removeItem(`case_photo_${id}`);
```

**File**: `app/case/[id]/index.tsx`, `src/hooks/useCases.ts`

---

### Firebase Cloud Sync

**Setup**:
1. Create Firebase project at console.firebase.google.com
2. Enable Firestore Database
3. Get config from Project Settings > Web App
4. Paste config JSON in Settings > Cloud Sync

**Config JSON format**:
```json
{
  "apiKey": "AIza...",
  "authDomain": "yourproject.firebaseapp.com",
  "projectId": "yourproject",
  "storageBucket": "yourproject.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc123"
}
```

**User ID**: Use same email/ID on all devices for shared access.

**What syncs**:
- Cases (metadata)
- Chat history
- Target photos
- Reports (coming soon)

**Architecture**:
- `src/lib/firebase.ts` - Firebase initialization
- `src/lib/sync.ts` - Sync service (syncCase, syncChat, etc.)
- Local-first: always save locally, then sync to cloud
- Cloud merge: on load, check if cloud has newer data

**Firestore Rules** (set in Firebase Console):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cases/{caseId} {
      allow read, write: if request.auth != null ||
        resource.data.userId == request.resource.data.userId;
      match /{subcollection}/{docId} {
        allow read, write: if true;
      }
    }
  }
}
```

---

### Cross-Platform Confirm Dialog

**Problem**: `Alert.alert` doesn't work on web.

**Solution**: Create utility that uses `window.confirm` on web:
```tsx
// src/lib/confirm.ts
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: 'Cancel', onPress: () => resolve(false) },
      { text: options.confirmText, onPress: () => resolve(true) },
    ]);
  });
}
```

**File**: `src/lib/confirm.ts`

---

## TODO / Future

- [ ] OCR for image-based reports (currently shows paste prompt)
- [ ] Mobile PDF extraction (currently web-only)
- [ ] "Located" status when case resolved
- [ ] Export case data
