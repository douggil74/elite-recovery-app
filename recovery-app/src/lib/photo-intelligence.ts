/**
 * Photo Intelligence Service
 * Analyzes photos for investigative leads:
 * - Address numbers on buildings
 * - Business names/signage
 * - License plates
 * - Landmarks and geographic indicators
 * - Background details that reveal location
 * - EXIF metadata (GPS, timestamps, device info)
 */

import learningSystem from './learning-system';

// EXIF metadata extracted from image
export interface ExifMetadata {
  // GPS data - CRITICAL for investigations
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    googleMapsUrl: string;
  };
  // Timestamp info
  dateTime?: {
    original?: string;  // When photo was taken
    digitized?: string; // When digitized
    modified?: string;  // Last modified
  };
  // Device info - can help identify the photographer
  device?: {
    make?: string;      // e.g., "Apple"
    model?: string;     // e.g., "iPhone 14 Pro"
    software?: string;  // e.g., "iOS 17.1"
  };
  // Image details
  image?: {
    width?: number;
    height?: number;
    orientation?: number;
  };
  // Raw EXIF for anything else interesting
  raw?: Record<string, any>;
}

// Bounding box for visual annotation
export interface BoundingBox {
  x: number;      // percentage from left (0-100)
  y: number;      // percentage from top (0-100)
  width: number;  // percentage of image width
  height: number; // percentage of image height
}

export interface PhotoIntelligence {
  imageId: string;
  analyzedAt: string;
  sourceFileName?: string;  // Track which file this intel came from
  thumbnailBase64?: string; // Store thumbnail for report display

  // Location indicators
  addresses: {
    text: string;
    confidence: 'high' | 'medium' | 'low';
    type: 'house_number' | 'street_sign' | 'business_address' | 'mailbox' | 'other';
    context: string;
    boundingBox?: BoundingBox;  // Where in the image
  }[];

  // Vehicles
  vehicles: {
    type: string;
    color: string;
    make?: string;
    model?: string;
    licensePlate?: string;
    plateState?: string;
    confidence: 'high' | 'medium' | 'low';
    context: string;
    boundingBox?: BoundingBox;
  }[];

  // Businesses/landmarks
  businesses: {
    name: string;
    type: string;
    searchQuery: string;
    confidence: 'high' | 'medium' | 'low';
    boundingBox?: BoundingBox;
  }[];

  // Geographic indicators
  geography: {
    indicator: string;
    type: 'terrain' | 'vegetation' | 'architecture' | 'weather' | 'signage' | 'infrastructure';
    possibleRegion?: string;
  }[];

  // People in photo
  people: {
    description: string;
    clothing: string;
    distinguishingFeatures: string[];
    possibleRelation: string;
  }[];

  // Metadata hints
  metadata: {
    estimatedTimeOfDay: string;
    estimatedSeason: string;
    indoorOutdoor: 'indoor' | 'outdoor' | 'unknown';
    settingType: string;
  };

  // Actionable leads
  leads: {
    priority: 'high' | 'medium' | 'low';
    type: string;
    description: string;
    actionItem: string;
    searchLinks: { name: string; url: string }[];
  }[];

  // Raw analysis
  rawAnalysis: string;

  // EXIF metadata from file
  exifData?: ExifMetadata;
}

const PHOTO_INTEL_PROMPT = `You are an expert investigative analyst specializing in photo intelligence for fugitive recovery.

Analyze this image meticulously for ANY information that could help locate the subject or identify their associates/locations.

CRITICAL FOCUS AREAS:

1. **ADDRESS IDENTIFICATION**
   - House/building numbers (on doors, mailboxes, walls)
   - Street signs visible in background
   - Business addresses on storefronts
   - Apartment/unit numbers
   - Any visible numbers that could be addresses

2. **VEHICLE INTELLIGENCE**
   - License plates (even partial - note what you can see)
   - Vehicle make, model, color, year range
   - Distinctive features (damage, stickers, modifications)
   - Parking locations that suggest residence

3. **BUSINESS/LANDMARK IDENTIFICATION**
   - Store names, logos, signage
   - Restaurant/bar names
   - Unique architectural features
   - Recognizable chains (helps narrow region)
   - Church names, school names

4. **GEOGRAPHIC INDICATORS**
   - Terrain (mountains, flat, coastal)
   - Vegetation type (palm trees = warm climate, pine = northern)
   - Architecture style (Spanish colonial, Victorian, etc.)
   - Road types, infrastructure
   - Weather indicators

5. **PEOPLE ANALYSIS**
   - Clothing brands, sports teams (regional indicators)
   - Tattoos, distinguishing marks
   - Relationships suggested by body language
   - Age estimates of associates

6. **BACKGROUND DETAILS**
   - Reflections in windows/mirrors showing locations
   - Mail, packages, documents visible
   - Calendars, clocks showing time
   - Posters, artwork suggesting interests
   - Pet items, toys suggesting household composition

For EACH finding, provide:
- What you see
- Confidence level (high/medium/low)
- Why it matters for the investigation
- Specific action the agent should take

RESPOND IN THIS EXACT JSON FORMAT:

IMPORTANT: For each item detected, include a "boundingBox" with approximate location as percentage of image dimensions:
- x: percentage from left edge (0-100)
- y: percentage from top edge (0-100)
- width: percentage of image width (0-100)
- height: percentage of image height (0-100)

{
  "addresses": [
    {"text": "1234", "confidence": "high", "type": "house_number", "context": "Visible on brick wall behind subject", "boundingBox": {"x": 15, "y": 40, "width": 10, "height": 8}}
  ],
  "vehicles": [
    {"type": "SUV", "color": "Black", "make": "Ford", "model": "Explorer", "licensePlate": "ABC-1234", "plateState": "TX", "confidence": "medium", "context": "Parked in driveway", "boundingBox": {"x": 50, "y": 60, "width": 30, "height": 25}}
  ],
  "businesses": [
    {"name": "Joe's Pizza", "type": "Restaurant", "searchQuery": "Joe's Pizza location", "confidence": "high", "boundingBox": {"x": 70, "y": 10, "width": 20, "height": 15}}
  ],
  "geography": [
    {"indicator": "Palm trees visible", "type": "vegetation", "possibleRegion": "Southern US, Florida, California, or Texas"}
  ],
  "people": [
    {"description": "Male, 30s", "clothing": "Dallas Cowboys jersey", "distinguishingFeatures": ["Neck tattoo - eagle"], "possibleRelation": "Friend or family member"}
  ],
  "metadata": {
    "estimatedTimeOfDay": "Afternoon based on shadows (NEVER say Unknown - always estimate based on lighting, shadows, or context)",
    "estimatedSeason": "Summer - light clothing, green trees (NEVER say Unknown - always estimate based on clothing, foliage, or weather)",
    "indoorOutdoor": "outdoor",
    "settingType": "Residential backyard (ALWAYS provide a specific setting description)"
  },
  "leads": [
    {
      "priority": "high",
      "type": "Address Lead",
      "description": "House number 1234 visible on brick wall",
      "actionItem": "Search property records for 1234 addresses in target area",
      "searchLinks": [
        {"name": "Search Address", "url": "https://www.truepeoplesearch.com/results?streetaddress=1234"}
      ]
    }
  ],
  "rawAnalysis": "Detailed narrative of everything observed..."
}

CRITICAL RULES:
1. NEVER say "Unknown" or "Indeterminate" - always make your best estimate based on visual cues
2. Even if minimal information, describe WHAT YOU CAN SEE (clothing, setting, lighting, etc.)
3. For metadata, ALWAYS provide estimates: time of day from lighting, season from clothing/environment
4. Be thorough - even small details matter. A partial license plate or distant store sign could be the lead that locates the fugitive.
5. If you see a person, ALWAYS describe them (gender, approximate age, clothing, distinguishing features)
6. If the image quality is poor, still describe what's visible and note the quality limitation`;

const BACKEND_URL = 'https://elite-recovery-osint.fly.dev';

// EXIF Tag IDs
const EXIF_TAGS: Record<number, string> = {
  0x010F: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011A: 'XResolution',
  0x011B: 'YResolution',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x8769: 'ExifIFD',
  0x8825: 'GPSIFD',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0xA002: 'ExifImageWidth',
  0xA003: 'ExifImageHeight',
};

const GPS_TAGS: Record<number, string> = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
};

/**
 * Simple EXIF parser - works in browser without external dependencies
 */
function parseExif(data: Uint8Array): Record<string, any> | null {
  const result: Record<string, any> = {};

  // Check for JPEG marker
  if (data[0] !== 0xFF || data[1] !== 0xD8) {
    return null; // Not a JPEG
  }

  let offset = 2;

  // Find APP1 marker (EXIF)
  while (offset < data.length - 1) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];

    // APP1 marker (0xE1) contains EXIF
    if (marker === 0xE1) {
      const length = (data[offset + 2] << 8) | data[offset + 3];
      const exifStart = offset + 4;

      // Check for "Exif\0\0" header
      if (
        data[exifStart] === 0x45 &&     // E
        data[exifStart + 1] === 0x78 && // x
        data[exifStart + 2] === 0x69 && // i
        data[exifStart + 3] === 0x66 && // f
        data[exifStart + 4] === 0x00 &&
        data[exifStart + 5] === 0x00
      ) {
        const tiffStart = exifStart + 6;
        parseTiff(data, tiffStart, result);
      }
      break;
    }

    // Skip to next marker
    if (marker >= 0xE0 && marker <= 0xEF) {
      const length = (data[offset + 2] << 8) | data[offset + 3];
      offset += 2 + length;
    } else if (marker === 0xD9 || marker === 0xDA) {
      break; // End of metadata
    } else {
      offset++;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseTiff(data: Uint8Array, start: number, result: Record<string, any>): void {
  // Byte order
  const littleEndian = data[start] === 0x49 && data[start + 1] === 0x49;

  const getUint16 = (offset: number): number => {
    if (littleEndian) {
      return data[offset] | (data[offset + 1] << 8);
    }
    return (data[offset] << 8) | data[offset + 1];
  };

  const getUint32 = (offset: number): number => {
    if (littleEndian) {
      return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
    }
    return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
  };

  const getRational = (offset: number): number => {
    const num = getUint32(offset);
    const den = getUint32(offset + 4);
    return den !== 0 ? num / den : 0;
  };

  const getString = (offset: number, length: number): string => {
    let str = '';
    for (let i = 0; i < length - 1 && data[offset + i] !== 0; i++) {
      str += String.fromCharCode(data[offset + i]);
    }
    return str.trim();
  };

  // IFD0 offset
  const ifd0Offset = start + getUint32(start + 4);

  // Parse IFD
  const parseIFD = (ifdOffset: number, tags: Record<number, string>, isGps = false): void => {
    if (ifdOffset >= data.length) return;

    const numEntries = getUint16(ifdOffset);
    let entryOffset = ifdOffset + 2;

    for (let i = 0; i < numEntries && entryOffset + 12 <= data.length; i++) {
      const tag = getUint16(entryOffset);
      const type = getUint16(entryOffset + 2);
      const count = getUint32(entryOffset + 4);
      let valueOffset = entryOffset + 8;

      // If value doesn't fit in 4 bytes, it's an offset
      const valueSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] || 1;
      if (count * valueSize > 4) {
        valueOffset = start + getUint32(entryOffset + 8);
      }

      const tagName = tags[tag];

      if (tagName === 'ExifIFD') {
        const exifOffset = start + getUint32(entryOffset + 8);
        parseIFD(exifOffset, EXIF_TAGS);
      } else if (tagName === 'GPSIFD') {
        const gpsOffset = start + getUint32(entryOffset + 8);
        parseIFD(gpsOffset, GPS_TAGS, true);
      } else if (tagName) {
        // Read value based on type
        if (type === 2) { // ASCII string
          result[tagName] = getString(valueOffset, count);
        } else if (type === 3) { // Unsigned short
          result[tagName] = getUint16(valueOffset);
        } else if (type === 4) { // Unsigned long
          result[tagName] = getUint32(valueOffset);
        } else if (type === 5) { // Unsigned rational
          if (count === 3 && isGps) {
            // GPS coordinates (degrees, minutes, seconds)
            const d = getRational(valueOffset);
            const m = getRational(valueOffset + 8);
            const s = getRational(valueOffset + 16);
            result[tagName] = d + m / 60 + s / 3600;
          } else {
            result[tagName] = getRational(valueOffset);
          }
        }
      }

      entryOffset += 12;
    }
  };

  parseIFD(ifd0Offset, EXIF_TAGS);
}

/**
 * Extract EXIF metadata from base64 image
 * This can reveal GPS coordinates, timestamps, device info
 */
async function extractExifMetadata(imageBase64: string): Promise<ExifMetadata | null> {
  try {
    // Convert base64 to binary buffer
    const base64Data = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    // Decode base64 to Uint8Array
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Parse EXIF
    const exif = parseExif(bytes);

    if (!exif) {
      return null;
    }

    const metadata: ExifMetadata = {};

    // Extract GPS data - CRITICAL for investigations
    if (exif.GPSLatitude !== undefined && exif.GPSLongitude !== undefined) {
      let latitude = exif.GPSLatitude;
      let longitude = exif.GPSLongitude;

      // Apply reference direction
      if (exif.GPSLatitudeRef === 'S') latitude = -latitude;
      if (exif.GPSLongitudeRef === 'W') longitude = -longitude;

      metadata.gps = {
        latitude,
        longitude,
        altitude: exif.GPSAltitude,
        googleMapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
      };
    }

    // Extract timestamps
    if (exif.DateTimeOriginal || exif.DateTimeDigitized || exif.DateTime) {
      metadata.dateTime = {};
      if (exif.DateTimeOriginal) {
        metadata.dateTime.original = exif.DateTimeOriginal;
      }
      if (exif.DateTimeDigitized) {
        metadata.dateTime.digitized = exif.DateTimeDigitized;
      }
      if (exif.DateTime) {
        metadata.dateTime.modified = exif.DateTime;
      }
    }

    // Extract device info
    if (exif.Make || exif.Model || exif.Software) {
      metadata.device = {
        make: exif.Make,
        model: exif.Model,
        software: exif.Software,
      };
    }

    // Extract image dimensions
    if (exif.ExifImageWidth || exif.ExifImageHeight || exif.Orientation) {
      metadata.image = {
        width: exif.ExifImageWidth,
        height: exif.ExifImageHeight,
        orientation: exif.Orientation,
      };
    }

    return Object.keys(metadata).length > 0 ? metadata : null;

  } catch (error) {
    console.error('EXIF extraction error:', error);
    return null;
  }
}

/**
 * Format EXIF data for AI prompt
 */
function formatExifForPrompt(exif: ExifMetadata): string {
  const parts: string[] = ['EXIF METADATA FOUND IN IMAGE:'];

  if (exif.gps) {
    parts.push(`📍 GPS COORDINATES: ${exif.gps.latitude.toFixed(6)}, ${exif.gps.longitude.toFixed(6)}`);
    parts.push(`   Google Maps: ${exif.gps.googleMapsUrl}`);
    if (exif.gps.altitude) {
      parts.push(`   Altitude: ${exif.gps.altitude}m`);
    }
  }

  if (exif.dateTime?.original) {
    parts.push(`📅 PHOTO TAKEN: ${exif.dateTime.original}`);
  }

  if (exif.device) {
    const deviceStr = [exif.device.make, exif.device.model].filter(Boolean).join(' ');
    if (deviceStr) {
      parts.push(`📱 DEVICE: ${deviceStr}`);
    }
    if (exif.device.software) {
      parts.push(`   Software: ${exif.device.software}`);
    }
  }

  if (exif.raw) {
    for (const [key, value] of Object.entries(exif.raw)) {
      parts.push(`📝 ${key}: ${value}`);
    }
  }

  return parts.join('\n');
}

export class PhotoIntelligenceService {
  /**
   * Create a smaller thumbnail for storage
   */
  private async createThumbnail(imageBase64: string, maxSize: number): Promise<string> {
    // For web, use canvas to resize
    if (typeof document !== 'undefined') {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(imageBase64); // fallback to original
        img.src = imageBase64.includes('base64,') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      });
    }
    // For native, return as-is (would need expo-image-manipulator for resize)
    return imageBase64;
  }

  /**
   * Analyze a photo for investigative intelligence
   * Uses backend proxy - no local API key needed
   * @param imageBase64 - The base64 encoded image
   * @param fileName - Optional source filename for tracking
   */
  async analyzePhoto(imageBase64: string, fileName?: string): Promise<PhotoIntelligence | null> {
    try {
      // Clean base64 if needed
      const base64Data = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

      // Extract EXIF metadata FIRST - this can contain GPS, timestamps, device info
      const exifData = await extractExifMetadata(imageBase64);

      // Build prompt with EXIF data if available
      let fullPrompt = PHOTO_INTEL_PROMPT;
      if (exifData) {
        fullPrompt += `\n\n${formatExifForPrompt(exifData)}`;
        fullPrompt += '\n\nIMPORTANT: The above EXIF metadata was extracted from the image file. If GPS coordinates are present, this is the EXACT location where the photo was taken - this is HIGH PRIORITY intelligence. Include this in your leads.';
      }
      fullPrompt += '\n\nAnalyze this image thoroughly for all investigative leads. Focus especially on addresses, license plates, business names, and any geographic indicators.';

      // Use our backend proxy (has OpenAI key configured)
      const response = await fetch(`${BACKEND_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: base64Data,
          prompt: fullPrompt,
          model: 'gpt-4o',
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          imageId: Date.now().toString(),
          analyzedAt: new Date().toISOString(),
          addresses: [],
          vehicles: [],
          businesses: [],
          geography: [],
          people: [],
          metadata: {
            estimatedTimeOfDay: 'Unknown',
            estimatedSeason: 'Unknown',
            indoorOutdoor: 'unknown',
            settingType: 'Unknown',
          },
          leads: [],
          rawAnalysis: content,
          exifData: exifData || undefined,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Enhance leads with proper search links
      const enhancedLeads = (parsed.leads || []).map((lead: any) => ({
        ...lead,
        searchLinks: this.generateSearchLinks(lead),
      }));

      // Add GPS lead if EXIF has coordinates
      if (exifData?.gps) {
        enhancedLeads.unshift({
          priority: 'high',
          type: 'GPS Location',
          description: `Photo was taken at GPS coordinates: ${exifData.gps.latitude.toFixed(6)}, ${exifData.gps.longitude.toFixed(6)}`,
          actionItem: 'EXIF GPS data reveals exact photo location. Check this address immediately.',
          searchLinks: [
            { name: 'Google Maps', url: exifData.gps.googleMapsUrl },
            { name: 'Google Street View', url: `https://www.google.com/maps?q=${exifData.gps.latitude},${exifData.gps.longitude}&layer=c` },
          ],
        });
      }

      // Create smaller thumbnail for storage (max 300px)
      const thumbnail = await this.createThumbnail(imageBase64, 300);

      const result: PhotoIntelligence = {
        imageId: Date.now().toString(),
        analyzedAt: new Date().toISOString(),
        sourceFileName: fileName,
        thumbnailBase64: thumbnail,
        addresses: parsed.addresses || [],
        vehicles: parsed.vehicles || [],
        businesses: parsed.businesses || [],
        geography: parsed.geography || [],
        people: parsed.people || [],
        metadata: parsed.metadata || {
          estimatedTimeOfDay: 'Unknown',
          estimatedSeason: 'Unknown',
          indoorOutdoor: 'unknown',
          settingType: 'Unknown',
        },
        leads: enhancedLeads,
        rawAnalysis: parsed.rawAnalysis || content,
        exifData: exifData || undefined,
      };

      // Track learnings from this analysis
      this.trackPhotoLearnings(result);

      return result;

    } catch (error) {
      console.error('Photo analysis error:', error);
      // Log failure for learning
      learningSystem.logFailure(
        'photo_intelligence',
        'Photo analysis failed',
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      ).catch(() => {}); // Don't block on learning
      return null;
    }
  }

  /**
   * Track learnings from photo analysis results
   */
  private async trackPhotoLearnings(intel: PhotoIntelligence): Promise<void> {
    try {
      // Track EXIF GPS finds - very high value
      if (intel.exifData?.gps) {
        await learningSystem.logSuccess(
          'photo_intelligence',
          'EXIF GPS coordinates found',
          `Photo contained GPS: ${intel.exifData.gps.latitude.toFixed(4)}, ${intel.exifData.gps.longitude.toFixed(4)}`,
          'HIGH'
        );
      }

      // Track address finds
      if (intel.addresses.length > 0) {
        const highConf = intel.addresses.filter(a => a.confidence === 'high');
        if (highConf.length > 0) {
          await learningSystem.logSuccess(
            'photo_intelligence',
            `Found ${highConf.length} high-confidence address(es)`,
            `Types: ${highConf.map(a => a.type).join(', ')}`,
            'HIGH'
          );
        }
      }

      // Track vehicle/license plate finds
      const platesFound = intel.vehicles.filter(v => v.licensePlate);
      if (platesFound.length > 0) {
        await learningSystem.logSuccess(
          'photo_intelligence',
          `License plate(s) identified`,
          `Found ${platesFound.length} plate(s): ${platesFound.map(v => v.licensePlate).join(', ')}`,
          'HIGH'
        );
      }

      // Track business identification
      if (intel.businesses.length > 0) {
        await learningSystem.logSuccess(
          'photo_intelligence',
          `Identified ${intel.businesses.length} business(es)`,
          `Businesses: ${intel.businesses.map(b => b.name).join(', ')}`,
          'MEDIUM'
        );
      }

      // Track prompt effectiveness
      const leadCount = intel.leads.length;
      const quality = Math.min(100, leadCount * 15 + (intel.exifData?.gps ? 30 : 0));
      await learningSystem.trackPromptUse(
        'photo_intel_v3',
        '3.0',
        leadCount > 0,
        quality
      );

    } catch (error) {
      // Don't let learning errors break the main flow
      console.error('[PhotoIntel] Learning tracking error:', error);
    }
  }

  /**
   * Generate search links for a lead
   */
  private generateSearchLinks(lead: any): { name: string; url: string }[] {
    const links: { name: string; url: string }[] = [];

    if (lead.type?.includes('Address') && lead.description) {
      const addressMatch = lead.description.match(/\d+/);
      if (addressMatch) {
        const addr = addressMatch[0];
        links.push(
          { name: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/results?streetaddress=${addr}` },
          { name: 'Whitepages', url: `https://www.whitepages.com/address/${addr}` },
          { name: 'Google Maps', url: `https://www.google.com/maps/search/${addr}` },
        );
      }
    }

    if (lead.type?.includes('Vehicle') || lead.type?.includes('License')) {
      links.push(
        { name: 'License Plate Lookup', url: 'https://www.faxvin.com/license-plate-lookup' },
        { name: 'VinCheck', url: 'https://www.vincheck.info/check/license-plate-search.php' },
      );
    }

    if (lead.type?.includes('Business')) {
      const query = encodeURIComponent(lead.description || '');
      links.push(
        { name: 'Google Search', url: `https://www.google.com/search?q=${query}` },
        { name: 'Google Maps', url: `https://www.google.com/maps/search/${query}` },
        { name: 'Yelp', url: `https://www.yelp.com/search?find_desc=${query}` },
      );
    }

    return links;
  }

  /**
   * Generate tactical advice based on photo analysis
   */
  generateTacticalAdvice(intel: PhotoIntelligence): string[] {
    const advice: string[] = [];

    // EXIF GPS data - HIGHEST PRIORITY
    if (intel.exifData?.gps) {
      advice.push(`🎯 CRITICAL: GPS COORDINATES FOUND IN PHOTO METADATA!`);
      advice.push(`📍 Location: ${intel.exifData.gps.latitude.toFixed(6)}, ${intel.exifData.gps.longitude.toFixed(6)}`);
      advice.push(`🗺️ ${intel.exifData.gps.googleMapsUrl}`);
      advice.push(`⚡ This is the EXACT location where the photo was taken. Investigate this address immediately!`);
    }

    // EXIF timestamp
    if (intel.exifData?.dateTime?.original) {
      advice.push(`📅 Photo taken: ${intel.exifData.dateTime.original} - Check if subject was at this location around this time.`);
    }

    // EXIF device info
    if (intel.exifData?.device?.model) {
      advice.push(`📱 Photo taken with: ${intel.exifData.device.make || ''} ${intel.exifData.device.model} - May help identify who took the photo.`);
    }

    // Address-based advice
    if (intel.addresses.length > 0) {
      const highConfAddr = intel.addresses.filter(a => a.confidence === 'high');
      if (highConfAddr.length > 0) {
        advice.push(`🏠 HIGH PRIORITY: ${highConfAddr.length} address(es) identified. Cross-reference with known addresses and property records.`);
      }
      advice.push(`📍 Check all ${intel.addresses.length} visible address numbers against target's known locations and family addresses.`);
    }

    // Vehicle advice
    if (intel.vehicles.length > 0) {
      const withPlates = intel.vehicles.filter(v => v.licensePlate);
      if (withPlates.length > 0) {
        advice.push(`🚗 LICENSE PLATE DETECTED: Run plate "${withPlates[0].licensePlate}" through DMV and law enforcement databases.`);
      }
      intel.vehicles.forEach(v => {
        advice.push(`🚙 Look for ${v.color} ${v.make || ''} ${v.model || ''} ${v.type} at known locations.`);
      });
    }

    // Business/landmark advice
    if (intel.businesses.length > 0) {
      advice.push(`🏪 ${intel.businesses.length} business(es) identified. Search for locations and check if subject frequents these places.`);
      intel.businesses.forEach(b => {
        advice.push(`📍 Search "${b.name}" to identify possible neighborhood - subject may live or work nearby.`);
      });
    }

    // Geographic advice
    if (intel.geography.length > 0) {
      const regions = intel.geography.filter(g => g.possibleRegion).map(g => g.possibleRegion);
      if (regions.length > 0) {
        advice.push(`🌍 Geographic indicators suggest: ${[...new Set(regions)].join(', ')}`);
      }
    }

    // People advice
    if (intel.people.length > 0) {
      advice.push(`👥 ${intel.people.length} associate(s) visible. Identify and investigate their addresses - subject may be staying with them.`);
      intel.people.forEach(p => {
        if (p.distinguishingFeatures?.length > 0) {
          advice.push(`🔍 Associate has distinguishing features: ${p.distinguishingFeatures.join(', ')} - may help with identification.`);
        }
        if (p.clothing?.includes('jersey') || p.clothing?.includes('team')) {
          advice.push(`⚽ Sports apparel may indicate regional affiliation or interests that could help locate subject.`);
        }
      });
    }

    // High priority leads
    const highPriorityLeads = intel.leads.filter(l => l.priority === 'high');
    if (highPriorityLeads.length > 0) {
      advice.push(`⚠️ ${highPriorityLeads.length} HIGH PRIORITY LEAD(S) - Act on these immediately.`);
    }

    // General advice based on setting
    if (intel.metadata.indoorOutdoor === 'outdoor' && intel.metadata.settingType?.includes('Residential')) {
      advice.push(`🏡 Photo appears to be at a residence. This could be subject's home, family member's home, or friend's location.`);
    }

    if (advice.length === 0) {
      advice.push(`📷 No immediate leads from this photo. Consider reverse image search to find where else it appears online.`);
    }

    return advice;
  }
}

// Singleton instance
export const photoIntelligence = new PhotoIntelligenceService();
