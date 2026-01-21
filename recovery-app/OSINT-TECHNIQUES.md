# OSINT Techniques Encyclopedia

> Comprehensive guide to Open Source Intelligence techniques for fugitive recovery.
> Each technique is rated by effectiveness and documented with real examples.
> **Last Updated:** 2026-01-20

---

## Table of Contents
1. [Social Media Intelligence](#1-social-media-intelligence)
2. [Photo Intelligence](#2-photo-intelligence)
3. [People Search Techniques](#3-people-search-techniques)
4. [Digital Footprint Analysis](#4-digital-footprint-analysis)
5. [Location Intelligence](#5-location-intelligence)
6. [Vehicle Intelligence](#6-vehicle-intelligence)
7. [Network Analysis](#7-network-analysis)
8. [Advanced Techniques](#8-advanced-techniques)

---

## 1. Social Media Intelligence

### 1.1 Username Enumeration

**Effectiveness:** ⭐⭐⭐⭐⭐ (5/5)

**Tools:**
- Sherlock (400+ sites)
- Maigret (comprehensive)
- WhatsMyName.app (web-based)
- Namechk.com (availability check)

**Username Generation Algorithms:**
```
From "John Michael Smith" (DOB: 1985-03-15):

HIGH PROBABILITY:
- johnsmith
- john.smith
- john_smith
- jsmith
- johnmsmith
- jmsmith

MEDIUM PROBABILITY:
- johnsmith85
- johnsmith1985
- jsmith85
- john.m.smith
- smithjohn

LOW PROBABILITY (but check):
- thereaIjohnsmith
- johnsmithofficial
- officialjohnsmith
- johnny_smith
- johnnysmith
```

**Platform Priority Order:**
1. **Facebook** - Most people have accounts, often use real names
2. **Instagram** - Active users post locations
3. **Twitter/X** - Check for complaints, location mentions
4. **TikTok** - Younger demographics, location in videos
5. **LinkedIn** - Employment history, current location
6. **Snapchat** - Snap Map shows locations
7. **Reddit** - Anonymous but reveals interests/location
8. **Gaming** (Steam, Xbox, PSN) - Often overlooked

### 1.2 Email Intelligence

**Effectiveness:** ⭐⭐⭐⭐ (4/5)

**Tools:**
- Holehe (checks 100+ services)
- Hunter.io (corporate emails)
- EmailRep.io (reputation)

**Email Generation Patterns:**
```
For "John Smith" at known domain gmail.com:
- johnsmith@gmail.com
- john.smith@gmail.com
- jsmith@gmail.com
- smithjohn@gmail.com
- johnsmith85@gmail.com (with birth year)
```

**What Email Registration Reveals:**
| Service | Intelligence Value |
|---------|-------------------|
| Spotify | Music taste, location from playlists |
| Adobe | Possibly creative professional |
| GitHub | Developer, might have public repos |
| Amazon | Shopping patterns |
| PayPal | Financial activity |
| Dating apps | Relationship status, location |

### 1.3 Phone Number Intelligence

**Effectiveness:** ⭐⭐⭐ (3/5)

**Techniques:**
- Area code analysis (reveals original location)
- Carrier lookup
- Social media reverse lookup
- Truecaller database

**Area Code Intelligence:**
```javascript
// Common area codes and locations
const areaCodes = {
  "504": "New Orleans, LA",
  "225": "Baton Rouge, LA",
  "985": "Southeast LA",
  "318": "North LA",
  // ... extend as needed
};
```

---

## 2. Photo Intelligence

### 2.1 EXIF Metadata Extraction

**Effectiveness:** ⭐⭐⭐⭐⭐ (5/5) when present

**Critical Fields:**
```
GPS Coordinates: EXACT LOCATION (highest priority)
DateTime Original: When photo was taken
Make/Model: Device used (helps identify owner)
Software: Photo editing apps used
```

**Platforms that STRIP EXIF:**
- Facebook
- Instagram
- Twitter
- WhatsApp
- iMessage

**Platforms that PRESERVE EXIF:**
- Email attachments
- Cloud storage (Dropbox, Google Drive)
- Direct file transfers
- Original camera exports

### 2.2 Visual Analysis Checklist

**Address Indicators:**
- [ ] House/building numbers on doors
- [ ] Mailbox numbers
- [ ] Street signs in background
- [ ] Business addresses on storefronts
- [ ] Apartment/unit numbers
- [ ] Parking lot numbers

**Vehicle Indicators:**
- [ ] License plates (even partial)
- [ ] Vehicle make/model/color
- [ ] Distinctive features (damage, stickers)
- [ ] Parking permits/decals

**Geographic Indicators:**
- [ ] Vegetation type (palm = warm, pine = north)
- [ ] Architecture style
- [ ] Road signs/markings
- [ ] Utility poles/infrastructure
- [ ] Weather indicators
- [ ] Sun position/shadows

**Business/Landmark Indicators:**
- [ ] Store names/logos
- [ ] Restaurant signs
- [ ] Church/school names
- [ ] Recognizable chains
- [ ] Unique architectural features

### 2.3 Reverse Image Search

**Effectiveness:** ⭐⭐⭐⭐ (4/5)

**Search Order:**
1. **Yandex** - Best for faces (less privacy filtering)
2. **Google Lens** - Good for landmarks/businesses
3. **TinEye** - Finds exact matches across web
4. **PimEyes** - Paid, best face recognition
5. **FaceCheck.ID** - Alternative face search

**Technique: Crop and Search**
- Crop to just the face
- Search the full image
- Search background elements separately
- Search distinctive clothing/items

---

## 3. People Search Techniques

### 3.1 Free People Search Sites

**Tier 1 (Most Effective):**
| Site | Strengths | Limitations |
|------|-----------|-------------|
| TruePeopleSearch | Current addresses, relatives | Limited history |
| FastPeopleSearch | Phone numbers, emails | Some outdated |
| ThatsThem | IP address history | Requires account |

**Tier 2 (Supplementary):**
| Site | Strengths | Limitations |
|------|-----------|-------------|
| Whitepages | Established, comprehensive | Paywalled details |
| Spokeo | Social media links | Subscription needed |
| BeenVerified | Background info | Paid |

### 3.2 Address Verification

**Cross-Reference Strategy:**
1. Search subject name → Get addresses
2. Search each address → Find other residents
3. Search relatives names → Find their addresses
4. Check if subject appears at relative addresses

**Property Record Sources:**
- County assessor websites
- Zillow (owner info sometimes visible)
- Realtor.com
- County clerk records

### 3.3 Relative/Associate Analysis

**Network Mapping:**
```
Subject: John Smith
    │
    ├── Parents
    │   ├── Robert Smith (Father) → 123 Oak St
    │   └── Mary Smith (Mother) → 123 Oak St
    │
    ├── Siblings
    │   └── Jane Smith → 456 Pine Ave
    │
    ├── Ex-Spouse
    │   └── Sarah Johnson → 789 Elm Rd
    │
    └── Associates (from social media)
        ├── Mike Jones (tagged in photos)
        └── Chris Davis (frequent commenter)
```

**High-Value Contacts:**
1. **Mother/Grandmother** - Subjects often hide with maternal family
2. **Girlfriend/Boyfriend** - Current romantic interest
3. **Childhood friends** - May provide shelter
4. **Bail co-signer** - Has financial stake, may cooperate

---

## 4. Digital Footprint Analysis

### 4.1 Google Dorking

**Effective Queries:**
```
"John Smith" site:facebook.com
"John Smith" "New Orleans"
"John Smith" + phone number
"John Smith" filetype:pdf
inurl:profile "John Smith"
```

### 4.2 Wayback Machine

**Use Cases:**
- Find deleted social media profiles
- Recover old addresses from archived pages
- Find previous employment

**URL Pattern:**
```
https://web.archive.org/web/*/[target-url]
```

### 4.3 Data Breach Searches

**Legal Sources:**
- HaveIBeenPwned (breach check)
- DeHashed (requires account)
- IntelX (paid, comprehensive)

**What Breaches Reveal:**
- Email addresses
- Passwords (may be reused)
- IP addresses (location history)
- Phone numbers
- Physical addresses

---

## 5. Location Intelligence

### 5.1 Pattern Analysis

**Daily Patterns:**
| Time | Likely Location |
|------|-----------------|
| 6-8 AM | Home |
| 8-9 AM | Commute route |
| 9-5 PM | Workplace |
| 5-6 PM | Commute route |
| 6-10 PM | Home, gym, social |
| 10 PM-6 AM | Home |

**Weekly Patterns:**
- Monday-Friday: Work routine
- Saturday: Errands, social
- Sunday: Family, church

### 5.2 Social Media Geotagging

**Instagram:**
- Location tags on posts
- Story location stickers
- Tagged photos at locations

**Facebook:**
- Check-ins
- Events attended
- Tagged posts with locations

**Snapchat:**
- Snap Map (if public)
- Geofilters reveal location

### 5.3 Address Probability Scoring

**Algorithm:**
```
Score each address based on:
+30 points: Current residence (from records)
+25 points: Relative's address (close relation)
+20 points: Frequent social media location
+15 points: Employment address
+10 points: Historical address (last 2 years)
+5 points: Associate's address
-10 points: Address over 5 years old
-20 points: Address in different state
```

---

## 6. Vehicle Intelligence

### 6.1 License Plate Analysis

**What Plates Reveal:**
- State of registration
- County (some states)
- Registration status
- Owner (through proper channels)

**Partial Plate Techniques:**
- Pattern matching with known info
- State DMV wildcard searches (LEO only)
- ALPR database checks (authorized users)

### 6.2 Vehicle Identification

**Visual ID Checklist:**
- [ ] Make (brand logo)
- [ ] Model (body style)
- [ ] Year range (design generation)
- [ ] Color (primary and accent)
- [ ] Distinctive features
  - [ ] Damage/dents
  - [ ] Aftermarket parts
  - [ ] Stickers/decals
  - [ ] Wheel type

### 6.3 VIN Intelligence

**What VIN Reveals:**
- Exact make/model/year
- Manufacturing location
- Original equipment
- Recall history
- Title history (Carfax, etc.)

---

## 7. Network Analysis

### 7.1 Social Graph Mapping

**Build the network:**
1. Subject's friends list
2. Tagged photos (people present)
3. Commenters/likers on posts
4. Mutual friends patterns

**Identify key nodes:**
- Who appears most frequently?
- Who does subject interact with most?
- Who tags subject at locations?

### 7.2 Communication Pattern Analysis

**Indicators:**
- Time of posts (reveals timezone/schedule)
- Language/slang (reveals background)
- Emoji usage (reveals personality)
- Posting frequency (reveals lifestyle)

### 7.3 Interest-Based Location

**What interests reveal:**
- Sports teams → Likely in team's region
- Local news shares → Current location
- Restaurant check-ins → Neighborhood
- Event attendance → Social circles

---

## 8. Advanced Techniques

### 8.1 Dark Web Monitoring

**What to look for:**
- Stolen identity sales
- Forum posts under usernames
- Marketplace activity

**Tools:**
- Tor Browser
- Ahmia.fi (search engine)
- IntelX dark web module

### 8.2 Cryptocurrency Tracing

**If subject uses crypto:**
- Blockchain analysis
- Exchange KYC (subpoena)
- Transaction pattern analysis

### 8.3 AI-Powered Analysis

**Current Capabilities:**
- Photo analysis (GPT-4o Vision)
- Document extraction (GPT-4o)
- Pattern recognition
- Natural language queries

**Future Capabilities:**
- Predictive location modeling
- Behavioral analysis
- Real-time social monitoring
- Cross-platform correlation

---

## Technique Effectiveness Matrix

| Technique | Time | Cost | Success Rate | Best For |
|-----------|------|------|--------------|----------|
| Username search | 5 min | Free | 60% | Active social users |
| EXIF extraction | 1 min | Free | 30%* | Original photos |
| People search | 10 min | Free | 80% | Address finding |
| Reverse image | 5 min | Free | 40% | Face identification |
| Relative mapping | 30 min | Free | 70% | Hidden subjects |
| Vehicle lookup | 5 min | $ | 50% | Mobile subjects |
| Phone lookup | 5 min | Free | 40% | Contact finding |

*Success rate for EXIF is 30% because most shared photos have metadata stripped

---

## Quick Reference Card

### First 5 Minutes
1. People search (TruePeopleSearch, FastPeopleSearch)
2. Username search (Sherlock with firstname+lastname)
3. Google search with quotes
4. Any photos → Check EXIF first

### First 30 Minutes
1. All the above
2. Relative network mapping
3. Social media deep dive
4. Reverse image searches
5. Address verification

### Deep Investigation
1. All the above
2. Historical address analysis
3. Employment verification
4. Vehicle registration check
5. Associate interviews
6. Pattern analysis

---

*This document represents accumulated OSINT knowledge. Update it as new techniques are discovered or existing ones become obsolete.*
