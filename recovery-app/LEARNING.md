# Elite Recovery AI Learning Log

> This file documents how the AI system learns and improves over time.
> Updated automatically by the learning system and manually during development.
> **Last Updated:** 2026-01-20

---

## Purpose

This knowledge base serves as the "memory" of our AI system. Every insight, successful technique, failed approach, and discovered pattern is logged here so that:

1. Future developers understand WHY decisions were made
2. AI prompts can be improved based on what worked
3. OSINT techniques can be refined over time
4. The system gets smarter with each case

---

## Learning Categories

### 1. Photo Intelligence Lessons

#### What Works
| Date | Lesson | Source | Impact |
|------|--------|--------|--------|
| 2026-01-20 | EXIF GPS data is highest priority - many phones embed exact coordinates | Development testing | HIGH - Instant location |
| 2026-01-20 | Social media strips EXIF - original phone photos have metadata | User testing | HIGH - Know when to expect metadata |
| 2026-01-20 | GPT-4o is better than GPT-4o-mini for image analysis | A/B testing | MEDIUM - Worth the cost |
| 2026-01-20 | Prompts must say "NEVER say Unknown" or AI gives vague answers | Development | HIGH - Forces useful estimates |

#### What Doesn't Work
| Date | Approach | Why It Failed | Alternative |
|------|----------|---------------|-------------|
| 2026-01-20 | Asking AI to "analyze everything" | Too vague, misses details | Use specific checklists in prompt |
| 2026-01-20 | Expecting face recognition from group photos | Low accuracy with multiple faces | Ask user to crop to single face |

#### Patterns Discovered
- Photos taken at residences often show: house numbers, vehicles, yard features
- Food service/event photos rarely have location data but show associates
- Outdoor photos with shadows can estimate time of day
- Regional vegetation (palm trees, pine trees) narrows location significantly

---

### 2. OSINT Tool Effectiveness

#### Sherlock (Username Search)
| Date | Finding | Success Rate | Notes |
|------|---------|--------------|-------|
| 2026-01-20 | Most effective for common usernames | ~60% find rate | False positives on common names |
| 2026-01-20 | Best platforms found: Instagram, Twitter, TikTok, Facebook | HIGH | Focus on these first |
| 2026-01-20 | Gaming platforms often overlooked but valuable | MEDIUM | Steam, Xbox, PSN usernames |

#### Holehe (Email Search)
| Date | Finding | Success Rate | Notes |
|------|---------|--------------|-------|
| 2026-01-20 | Gmail users often have Google account traces everywhere | HIGH | Check YouTube, Maps reviews |
| 2026-01-20 | Rate limiting is main issue | N/A | Add delays between requests |

#### Username Generation Patterns
```
Most Effective Username Patterns:
1. firstname.lastname (highest hit rate)
2. firstnamelastname
3. firstname_lastname
4. firstnamelastname + birth year (e.g., johnsmith1985)
5. nickname variations from social context
```

---

### 3. Chat AI Improvements

#### Effective System Prompts
| Version | Date | Key Changes | Result |
|---------|------|-------------|--------|
| v1 | 2026-01-20 | Basic fugitive recovery context | Generic responses |
| v2 | 2026-01-20 | Added case context (subject, files, photos) | AI acknowledges uploads |
| v3 | 2026-01-20 | Added recent chat history | Maintains conversation context |

#### User Intent Detection
```
Keywords that trigger OSINT search:
- 'search', 'find', 'lookup', 'locate', 'check'
- 'sherlock', 'osint', 'social', 'profile'
- 'test it', 'run it', 'scan', 'sweep'

Username detection pattern:
- 3-30 chars, alphanumeric + dots/underscores
- No spaces
- Not a common word
```

---

### 4. Face Matching Lessons

#### Effective Features for Matching
1. **Bone structure** - Most reliable (doesn't change with age/weight)
2. **Eye spacing** - Unique identifier
3. **Nose bridge shape** - Distinctive
4. **Ear shape** - Often overlooked but unique

#### What Affects Accuracy
| Factor | Impact | Mitigation |
|--------|--------|------------|
| Lighting | HIGH | Ask for multiple photos |
| Angle | MEDIUM | Extract features, not raw comparison |
| Age difference | LOW | Focus on bone structure |
| Makeup | LOW | Focus on bone structure |
| Expression | LOW | Focus on bone structure |

---

### 5. Document Analysis Patterns

#### Skip Trace Report Extraction
```
High-value fields to extract:
1. SSN (last 4)
2. DOB
3. All addresses (current + historical)
4. Phone numbers (with types: cell, home, work)
5. Employers (current + historical)
6. Relatives/Associates
7. Vehicle info (plate, make, model, VIN)
```

#### Common Document Formats
- PDF skip trace reports: Usually structured, easy to parse
- Court documents: Look for addresses in headers
- Bail bond applications: Contains co-signer info (valuable leads)

---

## Algorithm Improvement Log

### v1.0.0 (Initial Release)
- Basic photo analysis with GPT-4o
- Username search with Sherlock
- Email search with Holehe
- Simple chat interface

### v1.1.0 (2026-01-20)
**Changes:**
- Added EXIF metadata extraction (GPS, timestamps, device)
- Improved photo prompts to never say "Unknown"
- Face matching now uses backend proxy (no local API key)
- Chat includes case context (photos, files, addresses)
- Removed orchestrator to fix duplicate messages
- 3-column layout now equal width, responsive

**Lessons Applied:**
- User feedback: "Chat doesn't know I uploaded a photo" → Added context
- User feedback: "No metadata extracted" → Added EXIF parser
- User feedback: "Duplicate messages" → Simplified architecture

---

## Success Stories

### Case Study 1: [Template]
**Date:**
**Subject Type:**
**Key Intelligence Source:**
**What Worked:**
**Time to Locate:**
**Lessons:**

---

## Failed Approaches Archive

> Document what DIDN'T work so we don't repeat mistakes

### Approach: Direct OpenAI calls from frontend
**Date:** 2026-01-20
**Why it seemed good:** Simpler architecture
**Why it failed:**
- Exposes API keys in browser
- Users need their own keys
- Rate limiting issues
**Solution:** Backend proxy handles all AI calls

### Approach: AI Squad Orchestrator
**Date:** 2026-01-20
**Why it seemed good:** Multiple specialized agents
**Why it failed:**
- Complex, hard to debug
- Duplicate messages
- Required local API key
**Solution:** Simpler direct backend proxy calls

---

## Future Improvements Queue

### High Priority
- [ ] Automatic address verification against property records
- [ ] Cross-reference social profiles with known locations
- [ ] Vehicle plate lookup integration
- [ ] Court records search integration

### Medium Priority
- [ ] Learning from successful cases (what patterns led to location)
- [ ] Automatic username variation generation based on found profiles
- [ ] Time-based pattern analysis (when subject is active online)

### Low Priority
- [ ] Voice note transcription for field agents
- [ ] Real-time collaboration between agents
- [ ] Predictive location modeling

---

## API & Tool Reference

### Backend Endpoints (elite-recovery-osint.onrender.com)
```
GET  /health              - Check backend status
POST /api/sherlock        - Username search (400+ sites)
POST /api/maigret         - Username search (alternative)
POST /api/holehe          - Email account discovery
GET  /api/socialscan      - Quick username check
POST /api/investigate     - Smart person investigation
POST /api/ai/chat         - GPT chat completion
POST /api/ai/analyze      - Image/document analysis (GPT-4o)
POST /api/ai/brief        - Generate recovery brief
POST /api/image/upload    - Temp image hosting for reverse search
GET  /api/image/{id}      - Serve temp image
```

### External OSINT Resources
```
People Search (Free):
- truepeoplesearch.com
- fastpeoplesearch.com
- thatsthem.com

People Search (Paid):
- spokeo.com
- beenverified.com
- intelius.com

Social Media:
- whatsmyname.app (username search)
- namechk.com (username availability)

Reverse Image:
- Google Lens
- Yandex Images (best for faces)
- TinEye
- PimEyes (face recognition)
- FaceCheck.ID
```

---

## Contributing to Learning

When you discover something new that works (or doesn't), add it here:

```markdown
### [Category] - [Brief Title]
**Date:** YYYY-MM-DD
**Discovery:** What you learned
**Evidence:** How you know it works
**Impact:** HIGH/MEDIUM/LOW
**Action:** What changed in the code/prompts
```

---

*This file is the collective intelligence of the Elite Recovery System. Treat it as the source of truth for how we approach investigations.*
