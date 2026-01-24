/**
 * TRACE Subject Analysis - World-Class Fugitive Identification
 *
 * Analyzes subject photos for ACTIONABLE identification intel:
 * - Tattoos (text, imagery, gang affiliations, location on body)
 * - Scars, birthmarks, dental anomalies
 * - Physical description for BOLOs
 * - Clothing/accessories that reveal affiliations or employers
 * - Reverse image search across all major platforms
 */

import { ExifMetadata } from './photo-intelligence';

const BACKEND_URL = 'https://elite-recovery-osint.fly.dev';

// EXIF extraction (copied from photo-intelligence for self-contained module)
const EXIF_TAGS: Record<number, string> = {
  0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
  0x0131: 'Software', 0x0132: 'DateTime', 0x8769: 'ExifIFD',
  0x8825: 'GPSIFD', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0xA002: 'ExifImageWidth', 0xA003: 'ExifImageHeight',
};

const GPS_TAGS: Record<number, string> = {
  0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef', 0x0006: 'GPSAltitude',
};

function parseExifFromBase64(imageBase64: string): ExifMetadata | null {
  try {
    const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
    const binaryStr = atob(base64Data);
    const data = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) data[i] = binaryStr.charCodeAt(i);

    if (data[0] !== 0xFF || data[1] !== 0xD8) return null;

    let offset = 2;
    const result: Record<string, any> = {};

    while (offset < data.length - 1) {
      if (data[offset] !== 0xFF) { offset++; continue; }
      const marker = data[offset + 1];
      if (marker === 0xE1) {
        const exifStart = offset + 4;
        if (data[exifStart] === 0x45 && data[exifStart + 1] === 0x78 &&
            data[exifStart + 2] === 0x69 && data[exifStart + 3] === 0x66) {
          const tiffStart = exifStart + 6;
          const littleEndian = data[tiffStart] === 0x49;

          const getUint16 = (o: number) => littleEndian ? data[o] | (data[o+1]<<8) : (data[o]<<8) | data[o+1];
          const getUint32 = (o: number) => littleEndian ?
            data[o] | (data[o+1]<<8) | (data[o+2]<<16) | (data[o+3]<<24) :
            (data[o]<<24) | (data[o+1]<<16) | (data[o+2]<<8) | data[o+3];
          const getRational = (o: number) => { const n = getUint32(o), d = getUint32(o+4); return d ? n/d : 0; };
          const getString = (o: number, len: number) => {
            let s = ''; for (let i = 0; i < len-1 && data[o+i]; i++) s += String.fromCharCode(data[o+i]);
            return s.trim();
          };

          const parseIFD = (ifdOff: number, tags: Record<number, string>, isGps = false) => {
            if (ifdOff >= data.length) return;
            const numEntries = getUint16(ifdOff);
            let entryOff = ifdOff + 2;
            for (let i = 0; i < numEntries && entryOff + 12 <= data.length; i++) {
              const tag = getUint16(entryOff), type = getUint16(entryOff+2), count = getUint32(entryOff+4);
              let valOff = entryOff + 8;
              const valSize = [0,1,1,2,4,8,1,1,2,4,8,4,8][type] || 1;
              if (count * valSize > 4) valOff = tiffStart + getUint32(entryOff + 8);
              const tagName = tags[tag];
              if (tagName === 'ExifIFD') parseIFD(tiffStart + getUint32(entryOff+8), EXIF_TAGS);
              else if (tagName === 'GPSIFD') parseIFD(tiffStart + getUint32(entryOff+8), GPS_TAGS, true);
              else if (tagName) {
                if (type === 2) result[tagName] = getString(valOff, count);
                else if (type === 3) result[tagName] = getUint16(valOff);
                else if (type === 4) result[tagName] = getUint32(valOff);
                else if (type === 5) {
                  if (count === 3 && isGps) {
                    const d = getRational(valOff), m = getRational(valOff+8), s = getRational(valOff+16);
                    result[tagName] = d + m/60 + s/3600;
                  } else result[tagName] = getRational(valOff);
                }
              }
              entryOff += 12;
            }
          };

          parseIFD(tiffStart + getUint32(tiffStart + 4), EXIF_TAGS);
        }
        break;
      }
      if (marker >= 0xE0 && marker <= 0xEF) {
        offset += 2 + ((data[offset+2]<<8) | data[offset+3]);
      } else if (marker === 0xD9 || marker === 0xDA) break;
      else offset++;
    }

    if (!Object.keys(result).length) return null;

    const metadata: ExifMetadata = {};
    if (result.GPSLatitude !== undefined && result.GPSLongitude !== undefined) {
      let lat = result.GPSLatitude, lon = result.GPSLongitude;
      if (result.GPSLatitudeRef === 'S') lat = -lat;
      if (result.GPSLongitudeRef === 'W') lon = -lon;
      metadata.gps = { latitude: lat, longitude: lon, altitude: result.GPSAltitude,
        googleMapsUrl: `https://www.google.com/maps?q=${lat},${lon}` };
    }
    if (result.DateTimeOriginal || result.DateTime) {
      metadata.dateTime = { original: result.DateTimeOriginal, modified: result.DateTime };
    }
    if (result.Make || result.Model) {
      metadata.device = { make: result.Make, model: result.Model, software: result.Software };
    }
    return Object.keys(metadata).length ? metadata : null;
  } catch { return null; }
}

export interface TattooAnalysis {
  location: string;           // "left forearm", "neck right side", "chest"
  description: string;        // "Eagle with spread wings holding banner"
  text?: string;              // Any readable text in tattoo
  style: string;              // "Traditional American", "Tribal", "Portrait", "Script"
  colors: string[];           // ["black", "red", "blue"]
  size: 'small' | 'medium' | 'large' | 'sleeve' | 'full-back';
  estimatedAge: 'fresh' | 'recent' | 'aged' | 'old';
  possibleMeaning?: string;   // Gang affiliation, memorial, military, etc.
  searchTerms: string[];      // Terms to search for similar tattoos
  visibilityWhenClothed: 'always visible' | 'sometimes visible' | 'hidden';
}

export interface ScarAnalysis {
  location: string;
  type: 'surgical' | 'injury' | 'burn' | 'self-inflicted' | 'unknown';
  description: string;
  size: string;
  distinctiveness: 'highly distinctive' | 'somewhat distinctive' | 'common';
}

export interface DentalAnalysis {
  anomalies: string[];        // "missing upper right molar", "gold front tooth", "gap between front teeth"
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  distinctiveFeatures: string[];
}

export interface PhysicalDescription {
  // Estimates useful for BOLOs
  estimatedHeight: string;    // "5'8\" - 5'10\""
  estimatedWeight: string;    // "180-200 lbs"
  build: 'thin' | 'average' | 'athletic' | 'heavy' | 'muscular';

  // Facial features
  faceShape: string;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
  eyeColor?: string;

  // Distinctive features
  distinctiveFeatures: string[];  // "lazy eye", "cauliflower ear", "facial scar"

  // Age assessment
  estimatedAge: string;       // "late 20s to early 30s"
  agingIndicators: string[];  // "receding hairline", "graying temples"
}

export interface ClothingAnalysis {
  items: {
    type: string;             // "t-shirt", "cap", "jacket"
    brand?: string;           // If visible
    text?: string;            // Any text on clothing
    colors: string[];
    significance?: string;    // "Dallas Cowboys - possible Texas connection"
  }[];

  // Affiliations revealed
  possibleEmployer?: string;  // Work uniform, company logo
  sportsTeam?: string;        // Jersey, cap
  possibleRegion?: string;    // Regional sports team, local business
  lifestyle?: string;         // "outdoor/hunting", "hip-hop culture", "biker"
}

export interface SubjectAnalysis {
  analyzedAt: string;
  photoQuality: 'excellent' | 'good' | 'fair' | 'poor';

  // EXIF metadata from photo
  exifData?: ExifMetadata;

  // Core identification
  tattoos: TattooAnalysis[];
  scars: ScarAnalysis[];
  dental: DentalAnalysis;
  physical: PhysicalDescription;
  clothing: ClothingAnalysis;

  // Jewelry/Accessories
  jewelry: {
    type: string;
    description: string;
    possibleSignificance?: string;  // "wedding ring", "gang-related", "religious"
  }[];

  // Other identifying marks
  piercings: string[];
  birthmarks: string[];

  // Actionable intelligence
  boloDescription: string;    // Ready-to-use BOLO description
  identificationPriority: {   // Ranked by how useful for ID
    feature: string;
    reason: string;
  }[];

  // Social media search suggestions
  usernameHints: string[];    // Based on tattoo text, interests shown

  // Reverse image search links
  reverseImageLinks: {
    service: string;
    url: string;
    description: string;
  }[];

  // Raw AI analysis
  rawAnalysis: string;
}

const SUBJECT_ANALYSIS_PROMPT = `You are an elite fugitive identification specialist. Your job is to extract EVERY identifying detail from this photo that could help locate or positively identify this person.

CRITICAL: This is for lawful bail recovery. Every detail you find could be the one that helps agents identify and safely apprehend this subject.

ANALYZE THE FOLLOWING IN EXTREME DETAIL:

## 1. TATTOOS (HIGHEST PRIORITY)
For EACH tattoo visible:
- EXACT location on body (be specific: "left forearm inner side", "right side of neck below ear")
- Detailed description of imagery (shapes, figures, symbols)
- ANY TEXT - transcribe exactly, note font style
- Colors used
- Size estimate
- Style (traditional, tribal, portrait, script, Japanese, prison-style, etc.)
- Age of tattoo (fresh/bright vs faded/aged)
- Possible meaning (memorial, gang, military, cultural, personal)
- Would it be visible when wearing: t-shirt? long sleeves? collared shirt?

## 2. SCARS & MARKS
- Location and size
- Type (surgical = straight/clean, injury = irregular, burn = textured)
- How distinctive is it?

## 3. DENTAL
- Missing teeth (which ones)
- Gold/silver teeth
- Gaps, crooked teeth
- Overall condition
- Anything distinctive when they smile

## 4. PHYSICAL DESCRIPTION (for BOLO)
- Height estimate (use objects in photo for reference if possible)
- Weight/build estimate
- Face shape (round, oval, square, long)
- Hair: style, color, length, hairline
- Facial hair: beard, mustache, goatee, stubble, clean-shaven
- Eye color if visible
- Estimated age range
- Any distinctive features (lazy eye, large nose, prominent ears, etc.)

## 5. CLOTHING & ACCESSORIES
- Every item of clothing visible
- ANY text, logos, or brands
- Sports teams (IMPORTANT - indicates regional affiliation)
- Work uniforms or employer logos
- Style that suggests lifestyle/culture

## 6. JEWELRY
- Rings (wedding ring = married, specific hand/finger)
- Chains, necklaces (religious symbols, gang-related)
- Earrings
- Watches (brand if visible)
- Anything distinctive

## 7. OTHER
- Piercings (location, type)
- Birthmarks
- Anything else that could identify this person

RESPOND IN THIS EXACT JSON FORMAT:

{
  "photoQuality": "good",
  "tattoos": [
    {
      "location": "left forearm, inner side",
      "description": "Portrait of woman's face with roses, appears to be memorial piece",
      "text": "Maria 1985-2019",
      "style": "Portrait/Realistic",
      "colors": ["black", "gray", "red"],
      "size": "large",
      "estimatedAge": "recent",
      "possibleMeaning": "Memorial tattoo, possibly mother or wife named Maria",
      "searchTerms": ["Maria memorial tattoo", "portrait tattoo forearm"],
      "visibilityWhenClothed": "sometimes visible"
    }
  ],
  "scars": [
    {
      "location": "right eyebrow",
      "type": "injury",
      "description": "Small vertical scar through eyebrow causing hair gap",
      "size": "1 inch",
      "distinctiveness": "somewhat distinctive"
    }
  ],
  "dental": {
    "anomalies": ["gold cap on upper left canine", "slight gap between front teeth"],
    "condition": "fair",
    "distinctiveFeatures": ["gold tooth visible when smiling"]
  },
  "physical": {
    "estimatedHeight": "5'9\" - 5'11\"",
    "estimatedWeight": "190-210 lbs",
    "build": "heavy",
    "faceShape": "round",
    "hairStyle": "short fade, longer on top",
    "hairColor": "black",
    "facialHair": "goatee, thin mustache",
    "eyeColor": "brown",
    "distinctiveFeatures": ["slightly crooked nose, possibly broken previously"],
    "estimatedAge": "early 30s",
    "agingIndicators": ["no significant aging signs"]
  },
  "clothing": {
    "items": [
      {
        "type": "t-shirt",
        "brand": "Nike",
        "text": null,
        "colors": ["black"],
        "significance": null
      },
      {
        "type": "baseball cap",
        "brand": null,
        "text": "Houston Astros",
        "colors": ["orange", "navy"],
        "significance": "Houston Astros - possible Texas/Houston connection"
      }
    ],
    "possibleEmployer": null,
    "sportsTeam": "Houston Astros",
    "possibleRegion": "Houston, Texas area",
    "lifestyle": "sports fan, casual style"
  },
  "jewelry": [
    {
      "type": "chain necklace",
      "description": "gold rope chain, medium thickness",
      "possibleSignificance": null
    },
    {
      "type": "ring",
      "description": "gold band on right ring finger",
      "possibleSignificance": "not wedding ring position, possibly class ring or family ring"
    }
  ],
  "piercings": ["left ear, single stud"],
  "birthmarks": [],
  "boloDescription": "Hispanic male, early 30s, 5'9\"-5'11\", 190-210 lbs, heavy build. Short black hair with fade. Goatee and thin mustache. Gold tooth upper left. Portrait tattoo left inner forearm with text 'Maria 1985-2019'. Small scar through right eyebrow. May wear Houston Astros gear.",
  "identificationPriority": [
    {"feature": "Gold tooth", "reason": "Immediately visible when speaking/smiling"},
    {"feature": "Memorial tattoo 'Maria 1985-2019'", "reason": "Unique text, visible in short sleeves"},
    {"feature": "Eyebrow scar", "reason": "Visible facial feature"},
    {"feature": "Houston Astros affiliation", "reason": "Suggests Texas connection"}
  ],
  "usernameHints": ["maria_memorial", "houston_astros", "HTX", "goldtooth"],
  "rawAnalysis": "Detailed narrative of complete analysis..."
}

CRITICAL RULES:
1. Be EXTREMELY thorough - assume every detail matters
2. For tattoos, describe as if explaining to a sketch artist
3. Transcribe ANY visible text exactly
4. Note things that would help identify them in person (gold tooth, distinctive walk, etc.)
5. The BOLO description should be ready to broadcast
6. If you can't see something clearly, say "partially visible" and describe what you CAN see`;

/**
 * Analyze a subject photo for identification features
 */
export async function analyzeSubject(imageBase64: string): Promise<SubjectAnalysis | null> {
  try {
    const base64Data = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    // Extract EXIF metadata (GPS, timestamp, device) before sending to AI
    const exifData = parseExifFromBase64(imageBase64);

    const response = await fetch(`${BACKEND_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64Data,
        prompt: SUBJECT_ANALYSIS_PROMPT,
        model: 'gpt-4o',
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Generate reverse image search links
    const reverseImageLinks = generateReverseImageLinks(imageBase64);

    return {
      analyzedAt: new Date().toISOString(),
      photoQuality: parsed.photoQuality || 'fair',
      exifData: exifData || undefined,
      tattoos: parsed.tattoos || [],
      scars: parsed.scars || [],
      dental: parsed.dental || { anomalies: [], condition: 'unknown', distinctiveFeatures: [] },
      physical: parsed.physical || {},
      clothing: parsed.clothing || { items: [] },
      jewelry: parsed.jewelry || [],
      piercings: parsed.piercings || [],
      birthmarks: parsed.birthmarks || [],
      boloDescription: parsed.boloDescription || '',
      identificationPriority: parsed.identificationPriority || [],
      usernameHints: parsed.usernameHints || [],
      reverseImageLinks,
      rawAnalysis: parsed.rawAnalysis || content,
    };

  } catch (error) {
    console.error('Subject analysis error:', error);
    return null;
  }
}

/**
 * Generate reverse image search links for all major services
 */
function generateReverseImageLinks(imageBase64: string): SubjectAnalysis['reverseImageLinks'] {
  // Note: Most services require uploading the image manually
  // We provide direct links to the search pages
  return [
    {
      service: 'PimEyes',
      url: 'https://pimeyes.com/en',
      description: 'BEST for finding faces across the web. Finds social media, news, forums. Paid but very effective.'
    },
    {
      service: 'Google Lens',
      url: 'https://lens.google.com/',
      description: 'Good for general image matching. May find social media profiles.'
    },
    {
      service: 'Yandex Images',
      url: 'https://yandex.com/images/',
      description: 'Excellent face recognition. Often finds results Google misses. Free.'
    },
    {
      service: 'TinEye',
      url: 'https://tineye.com/',
      description: 'Finds exact image matches. Good for finding where photo was originally posted.'
    },
    {
      service: 'Social Catfish',
      url: 'https://socialcatfish.com/',
      description: 'Specializes in finding people. Good for social media discovery.'
    },
    {
      service: 'FaceCheck.ID',
      url: 'https://facecheck.id/',
      description: 'Face search across social media and mugshot databases.'
    },
  ];
}

/**
 * Format analysis for display in chat
 */
export function formatSubjectAnalysisForChat(analysis: SubjectAnalysis): string {
  const sections: string[] = [];

  sections.push('## 🎯 SUBJECT IDENTIFICATION ANALYSIS\n');

  // EXIF GPS Data - HIGHEST VALUE if present
  if (analysis.exifData?.gps) {
    const gps = analysis.exifData.gps;
    sections.push('### 📍 PHOTO LOCATION (GPS EXTRACTED)');
    sections.push(`**Coordinates:** ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`);
    if (gps.altitude) sections.push(`**Altitude:** ${Math.round(gps.altitude)}m`);
    sections.push(`**[📍 View on Google Maps](${gps.googleMapsUrl})**`);
    sections.push('');
    sections.push('> ⚠️ This is where the PHOTO was taken - may indicate subject\'s location, residence, or hangout spot.\n');
  }

  // EXIF Timestamp
  if (analysis.exifData?.dateTime) {
    const dt = analysis.exifData.dateTime;
    sections.push('### 📅 PHOTO TIMESTAMP');
    if (dt.original) sections.push(`**Taken:** ${dt.original}`);
    if (dt.modified && dt.modified !== dt.original) sections.push(`**Modified:** ${dt.modified}`);
    sections.push('');
  }

  // Device info (less critical but useful)
  if (analysis.exifData?.device) {
    const dev = analysis.exifData.device;
    if (dev.make || dev.model) {
      sections.push('### 📱 DEVICE INFO');
      sections.push(`**Camera:** ${[dev.make, dev.model].filter(Boolean).join(' ')}`);
      if (dev.software) sections.push(`**Software:** ${dev.software}`);
      sections.push('');
    }
  }

  // BOLO Description - most actionable after GPS
  if (analysis.boloDescription) {
    sections.push('### 📢 BOLO DESCRIPTION');
    sections.push(`> ${analysis.boloDescription}\n`);
  }

  // Identification Priority
  if (analysis.identificationPriority.length > 0) {
    sections.push('### 🔑 KEY IDENTIFIERS (ranked)');
    analysis.identificationPriority.forEach((item, i) => {
      sections.push(`${i + 1}. **${item.feature}** - ${item.reason}`);
    });
    sections.push('');
  }

  // Tattoos
  if (analysis.tattoos.length > 0) {
    sections.push('### 🎨 TATTOOS');
    analysis.tattoos.forEach((tattoo, i) => {
      sections.push(`**${i + 1}. ${tattoo.location.toUpperCase()}**`);
      sections.push(`- Design: ${tattoo.description}`);
      if (tattoo.text) sections.push(`- Text: "${tattoo.text}"`);
      sections.push(`- Style: ${tattoo.style}, Size: ${tattoo.size}`);
      sections.push(`- Colors: ${tattoo.colors.join(', ')}`);
      sections.push(`- Visibility: ${tattoo.visibilityWhenClothed}`);
      if (tattoo.possibleMeaning) sections.push(`- Possible meaning: ${tattoo.possibleMeaning}`);
      sections.push('');
    });
  }

  // Scars
  if (analysis.scars.length > 0) {
    sections.push('### 🩹 SCARS');
    analysis.scars.forEach(scar => {
      sections.push(`- **${scar.location}**: ${scar.description} (${scar.type}, ${scar.distinctiveness})`);
    });
    sections.push('');
  }

  // Dental
  if (analysis.dental.anomalies.length > 0 || analysis.dental.distinctiveFeatures.length > 0) {
    sections.push('### 🦷 DENTAL');
    analysis.dental.anomalies.forEach(a => sections.push(`- ${a}`));
    analysis.dental.distinctiveFeatures.forEach(f => sections.push(`- ${f}`));
    sections.push('');
  }

  // Physical Description
  if (analysis.physical.estimatedHeight) {
    sections.push('### 📏 PHYSICAL DESCRIPTION');
    const p = analysis.physical;
    sections.push(`- Height: ${p.estimatedHeight}`);
    sections.push(`- Weight: ${p.estimatedWeight}`);
    sections.push(`- Build: ${p.build}`);
    sections.push(`- Hair: ${p.hairColor} ${p.hairStyle}`);
    sections.push(`- Facial hair: ${p.facialHair}`);
    sections.push(`- Age: ${p.estimatedAge}`);
    if (p.distinctiveFeatures.length > 0) {
      sections.push(`- Distinctive: ${p.distinctiveFeatures.join(', ')}`);
    }
    sections.push('');
  }

  // Clothing/Regional hints
  if (analysis.clothing.possibleRegion || analysis.clothing.sportsTeam) {
    sections.push('### 🗺️ REGIONAL INDICATORS');
    if (analysis.clothing.sportsTeam) sections.push(`- Sports team: ${analysis.clothing.sportsTeam}`);
    if (analysis.clothing.possibleRegion) sections.push(`- Possible region: ${analysis.clothing.possibleRegion}`);
    if (analysis.clothing.possibleEmployer) sections.push(`- Possible employer: ${analysis.clothing.possibleEmployer}`);
    sections.push('');
  }

  // Reverse Image Search
  sections.push('### 🔍 REVERSE IMAGE SEARCH');
  sections.push('Upload mugshot to these services to find social media profiles:');
  analysis.reverseImageLinks.slice(0, 4).forEach(link => {
    sections.push(`- **${link.service}**: ${link.description}`);
  });
  sections.push('');

  // Username hints
  if (analysis.usernameHints.length > 0) {
    sections.push('### 💡 POSSIBLE USERNAMES TO SEARCH');
    sections.push(`Try: ${analysis.usernameHints.join(', ')}`);
  }

  return sections.join('\n');
}
