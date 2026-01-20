# Elite Recovery - Configuration Reference

## OpenAI API Key

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Add to `.env.local` in the project root or paste into app Settings.

---

## Firebase Configuration

```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_PROJECT.appspot.com",
  "messagingSenderId": "000000000000",
  "appId": "1:000000000000:web:xxxxxxxxxxxxxx"
}
```

Paste this JSON into the Recovery App Settings > Cloud Sync section.

---

## How to Get These Values

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and save it (only shown once)

### Firebase
1. Go to https://console.firebase.google.com
2. Select your project (or create new)
3. Click gear icon > Project settings
4. Scroll to "Your apps" > Web app
5. Copy the `firebaseConfig` object

---

## Current Project IDs

- **Vercel Project (Main Site):** elite-recovery-la
- **Vercel Project (Recovery App):** recovery-app
- **Domain:** eliterecoveryla.com
- **Email:** doug@eliterecoveryla.com
