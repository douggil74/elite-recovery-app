/**
 * TRACE Geo Analysis - AI-Powered Photo Geolocation
 *
 * Analyzes photos to predict WHERE they were taken using visual clues:
 * - Architecture and building styles
 * - Vegetation, terrain, climate indicators
 * - Signs, text, language
 * - Road markings and infrastructure
 * - Business names and landmarks
 * - Cultural and regional indicators
 *
 * Enhanced with:
 * - Area code to location mapping
 * - Business name location lookup (OpenStreetMap)
 * - Regional chain store databases
 */

const BACKEND_URL = 'https://elite-recovery-osint.fly.dev';

// US Area Code to State/City mapping (major codes)
const AREA_CODE_MAP: Record<string, { state: string; cities: string[] }> = {
  // Louisiana
  '225': { state: 'Louisiana', cities: ['Baton Rouge'] },
  '318': { state: 'Louisiana', cities: ['Shreveport', 'Monroe'] },
  '337': { state: 'Louisiana', cities: ['Lafayette', 'Lake Charles'] },
  '504': { state: 'Louisiana', cities: ['New Orleans'] },
  '985': { state: 'Louisiana', cities: ['Houma', 'Slidell', 'Hammond'] },
  // Texas
  '210': { state: 'Texas', cities: ['San Antonio'] },
  '214': { state: 'Texas', cities: ['Dallas'] },
  '281': { state: 'Texas', cities: ['Houston'] },
  '346': { state: 'Texas', cities: ['Houston'] },
  '409': { state: 'Texas', cities: ['Beaumont', 'Galveston'] },
  '512': { state: 'Texas', cities: ['Austin'] },
  '713': { state: 'Texas', cities: ['Houston'] },
  '817': { state: 'Texas', cities: ['Fort Worth'] },
  '832': { state: 'Texas', cities: ['Houston'] },
  '936': { state: 'Texas', cities: ['Conroe', 'Huntsville'] },
  '972': { state: 'Texas', cities: ['Dallas'] },
  // Mississippi
  '228': { state: 'Mississippi', cities: ['Biloxi', 'Gulfport'] },
  '601': { state: 'Mississippi', cities: ['Jackson'] },
  '662': { state: 'Mississippi', cities: ['Tupelo', 'Oxford'] },
  '769': { state: 'Mississippi', cities: ['Jackson'] },
  // Alabama
  '205': { state: 'Alabama', cities: ['Birmingham'] },
  '251': { state: 'Alabama', cities: ['Mobile'] },
  '256': { state: 'Alabama', cities: ['Huntsville'] },
  '334': { state: 'Alabama', cities: ['Montgomery'] },
  // Florida
  '305': { state: 'Florida', cities: ['Miami'] },
  '352': { state: 'Florida', cities: ['Gainesville', 'Ocala'] },
  '386': { state: 'Florida', cities: ['Daytona Beach'] },
  '407': { state: 'Florida', cities: ['Orlando'] },
  '561': { state: 'Florida', cities: ['West Palm Beach'] },
  '727': { state: 'Florida', cities: ['St. Petersburg'] },
  '786': { state: 'Florida', cities: ['Miami'] },
  '813': { state: 'Florida', cities: ['Tampa'] },
  '850': { state: 'Florida', cities: ['Tallahassee', 'Pensacola'] },
  '904': { state: 'Florida', cities: ['Jacksonville'] },
  '941': { state: 'Florida', cities: ['Sarasota'] },
  '954': { state: 'Florida', cities: ['Fort Lauderdale'] },
  // Georgia
  '229': { state: 'Georgia', cities: ['Albany'] },
  '404': { state: 'Georgia', cities: ['Atlanta'] },
  '470': { state: 'Georgia', cities: ['Atlanta'] },
  '478': { state: 'Georgia', cities: ['Macon'] },
  '678': { state: 'Georgia', cities: ['Atlanta'] },
  '706': { state: 'Georgia', cities: ['Augusta', 'Columbus'] },
  '770': { state: 'Georgia', cities: ['Atlanta suburbs'] },
  '912': { state: 'Georgia', cities: ['Savannah'] },
  // Arkansas
  '479': { state: 'Arkansas', cities: ['Fort Smith', 'Fayetteville'] },
  '501': { state: 'Arkansas', cities: ['Little Rock'] },
  '870': { state: 'Arkansas', cities: ['Jonesboro', 'Pine Bluff'] },
  // Tennessee
  '423': { state: 'Tennessee', cities: ['Chattanooga'] },
  '615': { state: 'Tennessee', cities: ['Nashville'] },
  '629': { state: 'Tennessee', cities: ['Nashville'] },
  '731': { state: 'Tennessee', cities: ['Jackson'] },
  '865': { state: 'Tennessee', cities: ['Knoxville'] },
  '901': { state: 'Tennessee', cities: ['Memphis'] },
  // California
  '213': { state: 'California', cities: ['Los Angeles'] },
  '310': { state: 'California', cities: ['Los Angeles'] },
  '323': { state: 'California', cities: ['Los Angeles'] },
  '408': { state: 'California', cities: ['San Jose'] },
  '415': { state: 'California', cities: ['San Francisco'] },
  '510': { state: 'California', cities: ['Oakland'] },
  '619': { state: 'California', cities: ['San Diego'] },
  '626': { state: 'California', cities: ['Pasadena'] },
  '714': { state: 'California', cities: ['Orange County'] },
  '818': { state: 'California', cities: ['San Fernando Valley'] },
  '858': { state: 'California', cities: ['San Diego'] },
  '916': { state: 'California', cities: ['Sacramento'] },
  '949': { state: 'California', cities: ['Irvine'] },
};

// Regional chain restaurants/stores - helps narrow down location
const REGIONAL_CHAINS: Record<string, { region: string; states: string[] }> = {
  // Fast Food
  'whataburger': { region: 'Southwest/Gulf', states: ['TX', 'OK', 'NM', 'AZ', 'LA', 'MS', 'AL', 'FL', 'GA'] },
  'in-n-out': { region: 'West Coast', states: ['CA', 'NV', 'AZ', 'UT', 'OR', 'CO', 'TX'] },
  'waffle house': { region: 'Southeast', states: ['GA', 'FL', 'AL', 'MS', 'LA', 'TX', 'TN', 'NC', 'SC', 'VA'] },
  'culvers': { region: 'Midwest', states: ['WI', 'MN', 'IL', 'IA', 'MI', 'IN', 'OH'] },
  'cookout': { region: 'Southeast', states: ['NC', 'SC', 'VA', 'GA', 'TN', 'KY', 'WV', 'MD'] },
  'steak n shake': { region: 'Midwest/South', states: ['IN', 'IL', 'MO', 'OH', 'FL', 'TX'] },
  'bojangles': { region: 'Southeast', states: ['NC', 'SC', 'VA', 'GA', 'TN', 'AL', 'FL', 'MD'] },
  'rallys': { region: 'Midwest/South', states: ['IN', 'MI', 'OH', 'KY', 'TN', 'FL'] },
  'checkers': { region: 'Southeast', states: ['FL', 'GA', 'AL', 'NY', 'NJ', 'PA'] },
  'zaxbys': { region: 'Southeast', states: ['GA', 'FL', 'AL', 'TN', 'NC', 'SC', 'TX', 'LA'] },
  'raising canes': { region: 'South/Southwest', states: ['LA', 'TX', 'OK', 'MS', 'AL', 'GA', 'TN'] },
  "raising cane's": { region: 'South/Southwest', states: ['LA', 'TX', 'OK', 'MS', 'AL', 'GA', 'TN'] },
  'popeyes': { region: 'Louisiana origin', states: ['LA', 'TX', 'FL', 'GA', 'MS', 'AL'] },
  "church's chicken": { region: 'Texas origin', states: ['TX', 'LA', 'GA', 'FL', 'CA'] },
  'krystal': { region: 'Southeast', states: ['GA', 'TN', 'AL', 'FL', 'MS', 'LA'] },
  'portillos': { region: 'Chicago area', states: ['IL', 'IN', 'WI', 'AZ', 'CA'] },
  'del taco': { region: 'West Coast', states: ['CA', 'NV', 'AZ', 'UT', 'CO'] },
  "carl's jr": { region: 'West Coast', states: ['CA', 'AZ', 'NV', 'TX', 'OK'] },
  'hardees': { region: 'Midwest/South', states: ['NC', 'SC', 'VA', 'TN', 'KY', 'WV', 'OH', 'IN', 'IL'] },
  'sonic': { region: 'South/Midwest', states: ['TX', 'OK', 'AR', 'LA', 'KS', 'MO', 'TN'] },
  'braums': { region: 'Oklahoma/Texas', states: ['OK', 'TX', 'KS', 'AR', 'MO'] },
  'jack in the box': { region: 'West/South', states: ['CA', 'TX', 'AZ', 'WA', 'OR', 'NV'] },

  // Grocery/Convenience
  'publix': { region: 'Southeast', states: ['FL', 'GA', 'AL', 'SC', 'NC', 'TN', 'VA'] },
  'heb': { region: 'Texas', states: ['TX'] },
  'h-e-b': { region: 'Texas', states: ['TX'] },
  'wawa': { region: 'Mid-Atlantic', states: ['PA', 'NJ', 'DE', 'MD', 'VA', 'FL'] },
  'sheetz': { region: 'Mid-Atlantic', states: ['PA', 'WV', 'VA', 'MD', 'OH', 'NC'] },
  'bucees': { region: 'Texas/Southeast', states: ['TX', 'AL', 'FL', 'GA', 'KY', 'SC', 'TN'] },
  "buc-ee's": { region: 'Texas/Southeast', states: ['TX', 'AL', 'FL', 'GA', 'KY', 'SC', 'TN'] },
  'wegmans': { region: 'Northeast', states: ['NY', 'PA', 'NJ', 'MA', 'MD', 'VA', 'NC'] },
  'piggly wiggly': { region: 'Southeast', states: ['AL', 'GA', 'SC', 'NC', 'WI', 'LA', 'MS'] },
  'winn-dixie': { region: 'Southeast', states: ['FL', 'GA', 'AL', 'LA', 'MS'] },
  'ingles': { region: 'Southeast mountains', states: ['NC', 'SC', 'GA', 'TN', 'VA'] },
  'bi-lo': { region: 'Southeast', states: ['SC', 'NC', 'GA', 'TN'] },
  'harris teeter': { region: 'Southeast', states: ['NC', 'SC', 'VA', 'MD', 'DE', 'GA'] },
  'food lion': { region: 'Southeast/Mid-Atlantic', states: ['NC', 'SC', 'VA', 'MD', 'PA', 'WV', 'TN', 'GA'] },
  'meijer': { region: 'Midwest', states: ['MI', 'OH', 'IN', 'IL', 'WI', 'KY'] },
  'hy-vee': { region: 'Midwest', states: ['IA', 'IL', 'KS', 'MN', 'MO', 'NE', 'SD', 'WI'] },
  'giant eagle': { region: 'Ohio/Pennsylvania', states: ['OH', 'PA', 'WV', 'MD', 'IN'] },
  'jewel-osco': { region: 'Chicago area', states: ['IL', 'IN', 'IA'] },
  'rouses': { region: 'Gulf Coast', states: ['LA', 'MS', 'AL'] },
  'brookshires': { region: 'Texas/Louisiana', states: ['TX', 'LA', 'AR'] },
  'quiktrip': { region: 'South/Midwest', states: ['OK', 'TX', 'AZ', 'GA', 'SC', 'NC', 'MO', 'KS', 'IA'] },
  'racetrac': { region: 'Southeast', states: ['GA', 'FL', 'TX', 'LA', 'MS', 'TN'] },

  // Regional Pharmacies
  'navarro': { region: 'South Florida', states: ['FL'] },
  'sedanos': { region: 'South Florida', states: ['FL'] },

  // Gas Stations
  'kum & go': { region: 'Midwest', states: ['IA', 'AR', 'CO', 'MO', 'MT', 'NE', 'OK', 'SD', 'WY'] },
  'casey\'s': { region: 'Midwest', states: ['IA', 'IL', 'MO', 'NE', 'KS', 'MN', 'SD', 'ND', 'WI', 'IN', 'OH'] },
  'loves': { region: 'Nationwide but HQ Oklahoma', states: ['OK', 'TX', 'NM', 'AZ'] },
  'flying j': { region: 'Truck stops nationwide', states: ['UT', 'ID', 'WY', 'NV'] },

  // Louisiana specific
  'raisin canes': { region: 'Louisiana origin', states: ['LA', 'TX', 'OK', 'MS', 'AL', 'GA', 'TN'] },
  'smoothie king': { region: 'Louisiana origin', states: ['LA', 'TX', 'FL', 'GA'] },
  'cc\'s coffee': { region: 'Louisiana', states: ['LA'] },
  'community coffee': { region: 'Louisiana', states: ['LA', 'TX'] },
  'blue runner': { region: 'Louisiana', states: ['LA'] },
};

/**
 * Extract area codes from text and map to locations
 */
function extractAreaCodes(text: string): { code: string; location: { state: string; cities: string[] } }[] {
  const results: { code: string; location: { state: string; cities: string[] } }[] = [];

  // Match phone number patterns
  const phonePatterns = [
    /\((\d{3})\)\s*\d{3}[-.\s]?\d{4}/g,  // (504) 555-1234
    /(\d{3})[-.\s]\d{3}[-.\s]\d{4}/g,      // 504-555-1234
    /\b(\d{3})\d{7}\b/g,                   // 5045551234
  ];

  for (const pattern of phonePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const areaCode = match[1];
      if (AREA_CODE_MAP[areaCode]) {
        results.push({
          code: areaCode,
          location: AREA_CODE_MAP[areaCode],
        });
      }
    }
  }

  return results;
}

/**
 * Check for regional chain businesses in text
 */
function detectRegionalChains(businessNames: string[]): { name: string; region: string; states: string[] }[] {
  const results: { name: string; region: string; states: string[] }[] = [];

  for (const business of businessNames) {
    const normalized = business.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ');

    for (const [chainName, info] of Object.entries(REGIONAL_CHAINS)) {
      if (normalized.includes(chainName) || chainName.includes(normalized)) {
        results.push({
          name: business,
          region: info.region,
          states: info.states,
        });
        break;
      }
    }
  }

  return results;
}

/**
 * Search OpenStreetMap/Nominatim for a business name (free API)
 */
async function searchBusinessLocation(businessName: string, region?: string): Promise<{
  found: boolean;
  locations: { name: string; city: string; state: string; lat: number; lon: number }[];
} | null> {
  try {
    const query = region ? `${businessName} ${region}` : businessName;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TRACE-Recovery-App/1.0',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data || data.length === 0) return { found: false, locations: [] };

    const locations = data.map((item: any) => ({
      name: item.display_name?.split(',')[0] || businessName,
      city: item.address?.city || item.address?.town || item.address?.village || '',
      state: item.address?.state || '',
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));

    return { found: true, locations };
  } catch (e) {
    console.error('[GeoAnalysis] OSM search error:', e);
    return null;
  }
}

/**
 * Generate Google Maps search links for businesses
 */
function generateBusinessSearchLinks(businesses: string[], region?: string): { business: string; searchUrl: string }[] {
  return businesses.map(business => ({
    business,
    searchUrl: `https://www.google.com/maps/search/${encodeURIComponent(business + (region ? ' ' + region : ''))}`,
  }));
}

export interface GeoLocationPrediction {
  country: string;
  region: string;          // State/province
  city?: string;
  neighborhood?: string;
  confidence: 'high' | 'medium' | 'low' | 'very low';
  coordinates?: {
    lat: number;
    lng: number;
    radius: string;        // "within 5 miles", "within city limits"
  };
}

export interface VisualClue {
  type: 'architecture' | 'vegetation' | 'signage' | 'infrastructure' | 'business' | 'cultural' | 'terrain' | 'weather' | 'vehicle';
  description: string;
  locationIndicator: string;  // What this suggests about location
  confidence: 'strong' | 'moderate' | 'weak';
}

export interface GeoAnalysisResult {
  analyzedAt: string;

  // Primary prediction
  primaryLocation: GeoLocationPrediction;

  // Alternative possibilities
  alternativeLocations: GeoLocationPrediction[];

  // Visual evidence
  visualClues: VisualClue[];

  // Searchable indicators
  businessNames: string[];      // Any visible business names
  signText: string[];           // Text on signs
  landmarks: string[];          // Identifiable landmarks

  // Enhanced analysis
  areaCodesFound: { code: string; state: string; cities: string[] }[];
  regionalChains: { name: string; region: string; states: string[] }[];
  businessSearchLinks: { business: string; searchUrl: string }[];

  // Analysis summary
  summary: string;              // Human-readable analysis
  searchSuggestions: string[];  // "Search for [business] near [city]"

  // Map links
  mapSearchLinks: {
    googleMaps: string;
    googleStreetView?: string;
  };

  // Raw analysis
  rawAnalysis: string;
}

const GEO_ANALYSIS_PROMPT = `You are an expert geolocation analyst. Your job is to analyze this photo and determine WHERE it was taken using ONLY visual clues in the image.

IMPORTANT: This is for lawful bail recovery. Accurately predicting location helps agents locate individuals who have skipped bail.

ANALYZE THESE VISUAL ELEMENTS:

## 1. ARCHITECTURE
- Building style (modern, colonial, Victorian, industrial, etc.)
- Construction materials (brick, stucco, wood siding, concrete)
- Roof styles (flat, pitched, tile, metal)
- Window styles
- Regional architectural characteristics

## 2. VEGETATION
- Tree types (palm, pine, oak, deciduous, tropical)
- Landscaping style
- Climate indicators (desert, tropical, temperate)
- Season indicators

## 3. SIGNAGE & TEXT
- ANY visible text (store names, street signs, billboards)
- Language used
- Phone number formats (area codes!)
- Business names (chains vs local)
- Address formats

## 4. INFRASTRUCTURE
- Road markings and style (US vs European vs other)
- Power lines and poles
- Street lights
- Sidewalk style
- Traffic signs and signals

## 5. VEHICLES
- License plate style/color (if visible)
- Vehicle types common to region
- Driving side (left/right)

## 6. CULTURAL INDICATORS
- Clothing styles
- Business types
- Food/restaurant types
- Advertising style

## 7. TERRAIN & WEATHER
- Flat vs hilly vs mountainous
- Coastal vs inland
- Weather conditions
- Sun position/shadows (can indicate latitude)

## 8. LANDMARKS
- Any identifiable buildings, monuments, or features
- Chain businesses with location info
- Unique architectural features

RESPOND IN THIS EXACT JSON FORMAT:

{
  "primaryLocation": {
    "country": "United States",
    "region": "Texas",
    "city": "Houston",
    "neighborhood": "Galleria area",
    "confidence": "medium",
    "coordinates": {
      "lat": 29.7604,
      "lng": -95.3698,
      "radius": "within 10 miles"
    }
  },
  "alternativeLocations": [
    {
      "country": "United States",
      "region": "Louisiana",
      "city": "New Orleans",
      "confidence": "low"
    }
  ],
  "visualClues": [
    {
      "type": "architecture",
      "description": "Strip mall with stucco exterior and tile roof",
      "locationIndicator": "Common in Sun Belt states (TX, FL, AZ, CA)",
      "confidence": "moderate"
    },
    {
      "type": "signage",
      "description": "Whataburger sign visible",
      "locationIndicator": "Whataburger primarily in Texas and surrounding states",
      "confidence": "strong"
    },
    {
      "type": "vegetation",
      "description": "Palm trees and St. Augustine grass",
      "locationIndicator": "Gulf Coast region - TX, LA, FL",
      "confidence": "moderate"
    }
  ],
  "businessNames": ["Whataburger", "Mattress Firm"],
  "signText": ["EXIT 42", "FM 1960"],
  "landmarks": ["Water tower with 'Spring' written on it"],
  "summary": "Based on the Whataburger restaurant (Texas-based chain), palm trees, stucco strip mall architecture, and flat terrain, this photo was most likely taken in the Houston, Texas metropolitan area. The 'FM 1960' road sign and Spring water tower narrow it to the Spring/Cypress area north of Houston.",
  "searchSuggestions": [
    "Search 'Whataburger FM 1960 Spring TX' on Google Maps",
    "Look for strip malls near Spring, TX with Mattress Firm",
    "Check Google Street View along FM 1960 corridor"
  ],
  "rawAnalysis": "Detailed narrative of complete analysis..."
}

CRITICAL RULES:
1. Be SPECIFIC - don't just say "somewhere in the US" if you can narrow it down
2. Use business names as STRONG indicators - many chains are regional
3. Note ANY visible text - even partial text can be searched
4. If confidence is low, explain why and give alternatives
5. Phone area codes are GOLD - always note them
6. Consider sun angle/shadows for hemisphere and rough latitude
7. If you truly cannot determine location, say so but still note all clues`;

/**
 * Extract GPS from EXIF metadata first (fast, accurate if available)
 */
async function extractExifGPS(imageBase64: string): Promise<{
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  timestamp?: string;
  cameraMake?: string;
  cameraModel?: string;
} | null> {
  try {
    const base64Data = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    console.log('[GeoAnalysis] Extracting EXIF GPS data...');

    const response = await fetch(`${BACKEND_URL}/api/photo-gps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64Data }),
    });

    if (!response.ok) {
      console.error('[GeoAnalysis] EXIF extraction failed:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[GeoAnalysis] EXIF result:', data.has_gps ? 'GPS found' : 'No GPS');

    return {
      hasGps: data.has_gps,
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      timestamp: data.timestamp,
      cameraMake: data.camera_make,
      cameraModel: data.camera_model,
    };
  } catch (error) {
    console.error('[GeoAnalysis] EXIF extraction error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to get address
 */
async function reverseGeocode(lat: number, lng: number): Promise<{
  city?: string;
  state?: string;
  country?: string;
  address?: string;
} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TRACE-Recovery-App/1.0' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      city: data.address?.city || data.address?.town || data.address?.village,
      state: data.address?.state,
      country: data.address?.country,
      address: data.display_name,
    };
  } catch (error) {
    console.error('[GeoAnalysis] Reverse geocode error:', error);
    return null;
  }
}

/**
 * Analyze a photo to predict its geographic location
 */
export async function analyzePhotoLocation(imageBase64: string): Promise<GeoAnalysisResult | null> {
  try {
    const base64Data = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    console.log('[GeoAnalysis] Starting analysis...');

    // STEP 1: Try to extract GPS from EXIF metadata (fast, accurate)
    const exifData = await extractExifGPS(imageBase64);

    if (exifData?.hasGps && exifData.latitude && exifData.longitude) {
      console.log('[GeoAnalysis] Found GPS in EXIF!', exifData.latitude, exifData.longitude);

      // Reverse geocode to get address
      const location = await reverseGeocode(exifData.latitude, exifData.longitude);

      const googleMapsUrl = `https://www.google.com/maps/@${exifData.latitude},${exifData.longitude},17z`;
      const streetViewUrl = `https://www.google.com/maps/@${exifData.latitude},${exifData.longitude},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192`;

      return {
        analyzedAt: new Date().toISOString(),
        primaryLocation: {
          country: location?.country || 'United States',
          region: location?.state || 'Unknown',
          city: location?.city,
          confidence: 'high',
          coordinates: {
            lat: exifData.latitude,
            lng: exifData.longitude,
            radius: 'exact GPS location',
          },
        },
        alternativeLocations: [],
        visualClues: [{
          type: 'infrastructure',
          description: 'GPS coordinates extracted from photo metadata',
          locationIndicator: `EXIF GPS: ${exifData.latitude}, ${exifData.longitude}`,
          confidence: 'strong',
        }],
        businessNames: [],
        signText: [],
        landmarks: [],
        areaCodesFound: [],
        regionalChains: [],
        businessSearchLinks: [],
        summary: `**EXACT GPS LOCATION FOUND** - Photo taken at coordinates ${exifData.latitude}, ${exifData.longitude}${location?.address ? ` (${location.address})` : ''}. ${exifData.timestamp ? `Photo timestamp: ${exifData.timestamp}.` : ''} ${exifData.cameraMake ? `Camera: ${exifData.cameraMake} ${exifData.cameraModel || ''}` : ''}`,
        searchSuggestions: [
          'GPS coordinates extracted from EXIF metadata - exact location!',
          `View on Google Maps: ${googleMapsUrl}`,
          location?.address ? `Address: ${location.address}` : 'Use coordinates to find exact address',
        ],
        mapSearchLinks: {
          googleMaps: googleMapsUrl,
          googleStreetView: streetViewUrl,
        },
        rawAnalysis: `GPS extracted from photo EXIF metadata.\nLatitude: ${exifData.latitude}\nLongitude: ${exifData.longitude}${exifData.altitude ? `\nAltitude: ${exifData.altitude}m` : ''}${exifData.timestamp ? `\nTimestamp: ${exifData.timestamp}` : ''}${exifData.cameraMake ? `\nCamera: ${exifData.cameraMake} ${exifData.cameraModel || ''}` : ''}`,
      };
    }

    // STEP 2: No GPS in EXIF, fall back to AI visual analysis
    console.log('[GeoAnalysis] No EXIF GPS, using AI visual analysis...');

    const response = await fetch(`${BACKEND_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64Data,
        prompt: GEO_ANALYSIS_PROMPT,
        model: 'gpt-4o',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GeoAnalysis] API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[GeoAnalysis] Got response');

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[GeoAnalysis] No content in response');
      throw new Error('No response from AI');
    }

    // Parse JSON from response - try multiple patterns
    let parsed: any = null;

    // Try to find JSON block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[GeoAnalysis] JSON parse failed, trying cleanup');
        // Try to clean up the JSON
        const cleaned = jsonMatch[0]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        try {
          parsed = JSON.parse(cleaned);
        } catch (e2) {
          console.error('[GeoAnalysis] Cleaned JSON also failed');
        }
      }
    }

    // If JSON parsing failed, create a basic result from the text
    if (!parsed) {
      console.log('[GeoAnalysis] Creating basic result from text response');
      return {
        analyzedAt: new Date().toISOString(),
        primaryLocation: {
          country: 'United States',
          region: 'Unknown',
          confidence: 'very low',
        },
        alternativeLocations: [],
        visualClues: [],
        businessNames: [],
        signText: [],
        landmarks: [],
        areaCodesFound: [],
        regionalChains: [],
        businessSearchLinks: [],
        summary: content.slice(0, 500),
        searchSuggestions: ['Review the raw analysis below for any location clues'],
        mapSearchLinks: { googleMaps: 'https://www.google.com/maps' },
        rawAnalysis: content,
      };
    }

    // Generate map search links
    const mapSearchLinks = generateMapLinks(parsed.primaryLocation || {});

    // Enhanced analysis: Extract area codes from sign text
    const allText = [...(parsed.signText || []), ...(parsed.businessNames || [])].join(' ');
    const areaCodesFound = extractAreaCodes(allText).map(ac => ({
      code: ac.code,
      state: ac.location.state,
      cities: ac.location.cities,
    }));

    // Detect regional chains from business names
    const regionalChains = detectRegionalChains(parsed.businessNames || []);

    // Generate business search links for all detected businesses
    const regionHint = parsed.primaryLocation?.region ||
                       (areaCodesFound.length > 0 ? areaCodesFound[0].state : undefined);
    const businessSearchLinks = generateBusinessSearchLinks(parsed.businessNames || [], regionHint);

    // If we found area codes or regional chains, add them to search suggestions
    const enhancedSuggestions = [...(parsed.searchSuggestions || [])];

    if (areaCodesFound.length > 0) {
      const acInfo = areaCodesFound[0];
      enhancedSuggestions.unshift(`Area code ${acInfo.code} found → ${acInfo.state} (${acInfo.cities.join(', ')})`);
    }

    if (regionalChains.length > 0) {
      const chain = regionalChains[0];
      enhancedSuggestions.unshift(`${chain.name} is a regional chain → Found mainly in: ${chain.states.join(', ')}`);
    }

    return {
      analyzedAt: new Date().toISOString(),
      primaryLocation: parsed.primaryLocation || { country: 'Unknown', region: 'Unknown', confidence: 'very low' },
      alternativeLocations: parsed.alternativeLocations || [],
      visualClues: parsed.visualClues || [],
      businessNames: parsed.businessNames || [],
      signText: parsed.signText || [],
      landmarks: parsed.landmarks || [],
      areaCodesFound,
      regionalChains,
      businessSearchLinks,
      summary: parsed.summary || 'Analysis completed - see details below.',
      searchSuggestions: enhancedSuggestions,
      mapSearchLinks,
      rawAnalysis: parsed.rawAnalysis || content,
    };

  } catch (error: any) {
    console.error('[GeoAnalysis] Error:', error?.message || error);

    // Return a minimal result with the error info instead of null
    return {
      analyzedAt: new Date().toISOString(),
      primaryLocation: {
        country: 'Analysis Failed',
        region: error?.message || 'Unknown error',
        confidence: 'very low',
      },
      alternativeLocations: [],
      visualClues: [],
      businessNames: [],
      signText: [],
      landmarks: [],
      areaCodesFound: [],
      regionalChains: [],
      businessSearchLinks: [],
      summary: `Analysis error: ${error?.message || 'Unknown error'}. The backend may be unavailable or the image couldn't be processed.`,
      searchSuggestions: ['Try a different image with more background context', 'Check if the backend service is running'],
      mapSearchLinks: { googleMaps: 'https://www.google.com/maps' },
      rawAnalysis: '',
    };
  }
}

/**
 * Generate Google Maps search links based on prediction
 */
function generateMapLinks(location: GeoLocationPrediction): GeoAnalysisResult['mapSearchLinks'] {
  const searchQuery = [location.city, location.region, location.country]
    .filter(Boolean)
    .join(', ');

  const links: GeoAnalysisResult['mapSearchLinks'] = {
    googleMaps: `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
  };

  if (location.coordinates) {
    links.googleMaps = `https://www.google.com/maps/@${location.coordinates.lat},${location.coordinates.lng},15z`;
    links.googleStreetView = `https://www.google.com/maps/@${location.coordinates.lat},${location.coordinates.lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192`;
  }

  return links;
}

/**
 * Format geo analysis for chat display
 */
/**
 * Do additional OpenStreetMap lookups for businesses found in analysis
 * Call this after initial analysis to get more precise locations
 */
export async function enhanceWithBusinessLookups(
  analysis: GeoAnalysisResult
): Promise<{
  businessLocations: {
    name: string;
    matches: { city: string; state: string; lat: number; lon: number }[];
  }[];
  narrowedRegion?: string;
}> {
  const results: {
    name: string;
    matches: { city: string; state: string; lat: number; lon: number }[];
  }[] = [];

  const regionHint = analysis.primaryLocation?.region ||
                     (analysis.areaCodesFound?.length > 0 ? analysis.areaCodesFound[0].state : undefined);

  // Limit to first 3 businesses to avoid rate limiting
  const businessesToSearch = analysis.businessNames.slice(0, 3);

  for (const business of businessesToSearch) {
    try {
      const result = await searchBusinessLocation(business, regionHint);
      if (result?.found && result.locations.length > 0) {
        results.push({
          name: business,
          matches: result.locations.map(loc => ({
            city: loc.city,
            state: loc.state,
            lat: loc.lat,
            lon: loc.lon,
          })),
        });
      }
      // Small delay to be nice to OSM API
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error(`[GeoAnalysis] OSM lookup failed for ${business}:`, e);
    }
  }

  // Try to narrow down region based on where businesses overlap
  let narrowedRegion: string | undefined;
  if (results.length >= 2) {
    const stateCounts: Record<string, number> = {};
    results.forEach(r => {
      r.matches.forEach(m => {
        if (m.state) {
          stateCounts[m.state] = (stateCounts[m.state] || 0) + 1;
        }
      });
    });

    // Find state that appears most often
    const topState = Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])[0];
    if (topState && topState[1] >= 2) {
      narrowedRegion = topState[0];
    }
  }

  return { businessLocations: results, narrowedRegion };
}

export function formatGeoAnalysisForChat(analysis: GeoAnalysisResult): string {
  const sections: string[] = [];

  sections.push('## 🌍 PHOTO GEOLOCATION ANALYSIS\n');

  // Primary prediction
  const loc = analysis.primaryLocation;
  const locationStr = [loc.neighborhood, loc.city, loc.region, loc.country].filter(Boolean).join(', ');

  sections.push('### 📍 PREDICTED LOCATION');
  sections.push(`**${locationStr}**`);
  sections.push(`Confidence: **${loc.confidence.toUpperCase()}**`);
  if (loc.coordinates) {
    sections.push(`Approximate area: ${loc.coordinates.radius}`);
    sections.push(`[📍 View on Google Maps](${analysis.mapSearchLinks.googleMaps})`);
  }
  sections.push('');

  // Summary
  if (analysis.summary) {
    sections.push('### 🔍 ANALYSIS');
    sections.push(analysis.summary);
    sections.push('');
  }

  // Key visual clues
  if (analysis.visualClues.length > 0) {
    sections.push('### 🔎 VISUAL EVIDENCE');
    const strongClues = analysis.visualClues.filter(c => c.confidence === 'strong');
    const otherClues = analysis.visualClues.filter(c => c.confidence !== 'strong');

    if (strongClues.length > 0) {
      sections.push('**Strong indicators:**');
      strongClues.forEach(clue => {
        sections.push(`- ${clue.description} → *${clue.locationIndicator}*`);
      });
    }

    if (otherClues.length > 0) {
      sections.push('**Supporting evidence:**');
      otherClues.slice(0, 5).forEach(clue => {
        sections.push(`- ${clue.description}`);
      });
    }
    sections.push('');
  }

  // Area codes found
  if (analysis.areaCodesFound && analysis.areaCodesFound.length > 0) {
    sections.push('### 📞 AREA CODES DETECTED');
    analysis.areaCodesFound.forEach(ac => {
      sections.push(`- **${ac.code}** → ${ac.state} (${ac.cities.join(', ')})`);
    });
    sections.push('');
  }

  // Regional chains found
  if (analysis.regionalChains && analysis.regionalChains.length > 0) {
    sections.push('### 🏪 REGIONAL CHAINS IDENTIFIED');
    analysis.regionalChains.forEach(chain => {
      sections.push(`- **${chain.name}** → ${chain.region}`);
      sections.push(`  Found in: ${chain.states.join(', ')}`);
    });
    sections.push('');
  }

  // Searchable text
  if (analysis.businessNames.length > 0 || analysis.signText.length > 0) {
    sections.push('### 📝 SEARCHABLE TEXT');
    if (analysis.businessNames.length > 0) {
      sections.push(`**Businesses:** ${analysis.businessNames.join(', ')}`);
    }
    if (analysis.signText.length > 0) {
      sections.push(`**Signs/Text:** ${analysis.signText.join(', ')}`);
    }
    if (analysis.landmarks.length > 0) {
      sections.push(`**Landmarks:** ${analysis.landmarks.join(', ')}`);
    }
    sections.push('');
  }

  // Business search links
  if (analysis.businessSearchLinks && analysis.businessSearchLinks.length > 0) {
    sections.push('### 🗺️ BUSINESS LOCATION SEARCH');
    analysis.businessSearchLinks.slice(0, 5).forEach(link => {
      sections.push(`- [Search "${link.business}" on Google Maps](${link.searchUrl})`);
    });
    sections.push('');
  }

  // Search suggestions
  if (analysis.searchSuggestions.length > 0) {
    sections.push('### 💡 SEARCH SUGGESTIONS');
    analysis.searchSuggestions.forEach(suggestion => {
      sections.push(`- ${suggestion}`);
    });
    sections.push('');
  }

  // Alternative locations
  if (analysis.alternativeLocations.length > 0) {
    sections.push('### 🔄 ALTERNATIVE POSSIBILITIES');
    analysis.alternativeLocations.slice(0, 3).forEach(alt => {
      const altStr = [alt.city, alt.region, alt.country].filter(Boolean).join(', ');
      sections.push(`- ${altStr} (${alt.confidence} confidence)`);
    });
  }

  return sections.join('\n');
}
