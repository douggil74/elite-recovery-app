# Bail Recovery App - Learnings & Improvements

## Purpose
AI-powered skip-trace analysis tool for bail recovery agents. Takes 86-page reports and outputs ranked locations with probabilities.

---

## Key Learnings

### 1. Address Classification Matters
**Problem:** AI assumed multiple addresses = "evasion" behavior
**Reality:** People have:
- Current residential address
- Work/business addresses (daytime only)
- Historical addresses (moved away)
- Family addresses (parents, siblings)

**Fix:** Updated AI prompt to classify addresses by type and not assume criminal behavior from normal address history.

### 2. Probability Must Be Data-Driven
Don't guess. Base rankings on:
- **Recency** - Most recent address wins
- **Utility records** - Active utilities = likely living there
- **Vehicle registration** - Where is their car registered?
- **Mail delivery** - USPS forwarding data
- **Employment** - Current job = daytime location

### 3. Time-of-Day Recommendations
- **Home addresses:** Check 7am or 9pm (before/after work)
- **Work addresses:** Business hours only
- **Family homes:** Evenings/weekends

---

## Data Sources

### Currently Using
- Skip-trace reports (TLO, IRB, Standard Comprehensive Report formats)
- Manual paste or file upload

### Potential Public Data Integrations
- [ ] Property records (county assessor)
- [ ] Court records (case.net, pacer)
- [ ] Business registrations (Secretary of State)
- [ ] Voter registration
- [ ] Vehicle registration (DMV - restricted)
- [ ] Utility records (typically not public)

---

## AI Prompt Guidelines

The AI should:
1. **Read the actual data** - Don't hallucinate addresses
2. **Classify address types** - HOME/WORK/FAMILY/HISTORICAL
3. **Base probability on evidence** - Cite specific data points
4. **Be actionable** - Specific addresses, specific times
5. **Not assume the worst** - Multiple addresses ≠ evasion

The AI should NOT:
- Assume criminal behavior without evidence
- Make up addresses not in the data
- Give generic advice without specifics
- Ignore date stamps on records

---

## Technical Notes

### Stack
- Expo/React Native (iOS, Android, Web)
- OpenAI GPT-4o-mini for analysis
- AsyncStorage for local data
- No cloud sync (security)

### Key Files
- `src/lib/analyzer.ts` - AI analysis logic
- `src/lib/parser/` - Fallback regex parsing
- `app/case/[id]/brief.tsx` - Results display

---

## Multi-Report Cross-Reference Analysis

### The Power Feature
Upload reports for subject + family/associates → AI cross-references ALL data to find hiding spots.

### How It Works
1. User uploads subject report
2. AI extracts relatives mentioned (mother, father, spouse, etc.)
3. App suggests: "Add reports for these people"
4. User uploads family reports
5. AI cross-references everything:
   - Addresses appearing on multiple reports = HIGH PROBABILITY
   - Family's current address + subject's history there = LIKELY HIDING SPOT
   - Shared phone numbers = Active connection
   - Vehicles registered to family = Subject might be using

### Key Insight
Fugitives often hide with family or friends. By analyzing the NETWORK, not just the individual, we find patterns a single report misses.

---

## Vehicle Sightings Feature (Planned)

Track vehicle sightings across addresses:
- Input: Known vehicles from reports (plate, make/model/color)
- User logs sightings at locations with timestamp
- App correlates: "Vehicle seen at mom's house 3x this week"
- Builds pattern of where subject actually IS vs. where reports say

---

## Future Improvements

1. **Property records lookup** - Auto-check if they still own historical addresses
2. **Vehicle sighting tracker** - Log and correlate vehicle sightings
3. **Pattern detection** - Time patterns from sighting data
4. **Map integration** - Show all addresses on map with routes
5. **Confidence intervals** - Show uncertainty, not false precision
6. **Learning from outcomes** - Track which predictions were correct

---

## Version History

- **v1.0** - Basic regex parsing (garbage)
- **v1.1** - OpenAI integration, smart analysis
- **v1.2** - Address type classification, better prompts
- **v1.3** - Multi-file upload with PDF support and intelligent chunking

---

## v1.3 Technical Details

### PDF Text Extraction
- Uses pdf.js (pdfjs-dist) for web-based PDF text extraction
- Automatically extracts text from all pages
- Falls back to "paste text" prompt on mobile until native PDF support is added

### Large Report Chunking
For reports exceeding 80,000 characters (~86 pages):
1. **Intelligent splitting** - Breaks on section boundaries (ADDRESSES, PHONES, RELATIVES, etc.)
2. **Parallel extraction** - Processes 3 chunks at a time with extraction-only prompt
3. **Deduplication** - Merges results, removing duplicate addresses/phones/names
4. **Final analysis** - Sends consolidated data to AI for ranking and action plan

### Multi-File Upload
- Drag-and-drop support (web)
- Document picker integration (mobile)
- Batch processing with progress tracking
- Relationship tagging (Subject/Family) for cross-reference mode

### Files Added
- `src/lib/pdf-extract.ts` - PDF text extraction
- `src/components/MultiFileUpload.tsx` - Batch upload component
- Updated `src/lib/analyzer.ts` with chunking strategy
