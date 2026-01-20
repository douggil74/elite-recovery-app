/**
 * AI-Powered Photo Geolocation
 * Analyzes images to extract location clues and identify where photos were taken
 */

import OpenAI from 'openai';

export interface GeolocationClue {
  type: 'sign' | 'landmark' | 'building' | 'vehicle' | 'vegetation' | 'weather' | 'reflection' | 'shadow' | 'text' | 'other';
  description: string;
  confidence: number; // 0-100
  locationHint?: string;
}

export interface GeolocationResult {
  success: boolean;
  clues: GeolocationClue[];
  possibleLocations: PossibleLocation[];
  analysis: string;
  searchQueries: string[]; // Suggested Google searches
  error?: string;
}

export interface PossibleLocation {
  description: string;
  confidence: number;
  reasoning: string;
  coordinates?: { lat: number; lng: number };
  address?: string;
  searchQuery?: string; // Google Maps search query
}

const GEOLOCATION_PROMPT = `You are an expert OSINT analyst specializing in photo geolocation. Your job is to analyze images and identify WHERE they were taken.

ANALYZE EVERY DETAIL:

1. **TEXT & SIGNS**
   - Street signs, store signs, billboards
   - License plates (state/country)
   - Business names, phone numbers with area codes
   - Languages visible

2. **ARCHITECTURE & BUILDINGS**
   - Building styles (colonial, modern, industrial)
   - Roof types, window styles
   - Construction materials typical of regions
   - Power line styles, utility poles

3. **LANDSCAPE & VEGETATION**
   - Tree types (palm = tropical, pine = temperate)
   - Grass types, garden styles
   - Terrain (flat, hilly, coastal)

4. **INFRASTRUCTURE**
   - Road markings, lane styles
   - Traffic light styles
   - Sidewalk types
   - Fire hydrant colors (varies by region)

5. **VEHICLES**
   - License plate formats
   - Car brands common to regions
   - Driving side (left/right)

6. **WEATHER & LIGHTING**
   - Sun angle (estimate latitude/time)
   - Shadow direction
   - Weather patterns

7. **REFLECTIONS & BACKGROUNDS**
   - Window reflections showing surroundings
   - Mirrors, glass surfaces
   - Background through windows

8. **INDOOR CLUES** (if interior shot)
   - Outlet types (US vs EU vs UK)
   - Light switch styles
   - Window views
   - Decor styles

OUTPUT FORMAT:
Return JSON with:
{
  "clues": [
    {
      "type": "sign|landmark|building|vehicle|vegetation|weather|reflection|shadow|text|other",
      "description": "what you see",
      "confidence": 0-100,
      "locationHint": "what this suggests about location"
    }
  ],
  "possibleLocations": [
    {
      "description": "City, State or Region",
      "confidence": 0-100,
      "reasoning": "why this location based on clues",
      "searchQuery": "Google Maps search to verify"
    }
  ],
  "analysis": "Overall analysis summary",
  "searchQueries": ["suggested Google searches to pinpoint location"]
}

Be SPECIFIC. Don't just say "residential area" - say "appears to be suburban Louisiana based on architectural style, vegetation, and visible area code 985 on sign"`;

/**
 * Analyze an image for geolocation clues
 */
export async function analyzeImageForLocation(
  imageBase64: string,
  apiKey: string,
  context?: string
): Promise<GeolocationResult> {
  try {
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    // Use GPT-4o (vision capable)
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: GEOLOCATION_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: context
                ? `Analyze this image for geolocation. Context: ${context}\n\nFind every clue that could help identify where this photo was taken.`
                : 'Analyze this image for geolocation. Find every clue that could help identify where this photo was taken.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        clues: [],
        possibleLocations: [],
        analysis: content,
        searchQueries: [],
        error: 'Could not parse analysis results',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      clues: parsed.clues || [],
      possibleLocations: parsed.possibleLocations || [],
      analysis: parsed.analysis || '',
      searchQueries: parsed.searchQueries || [],
    };

  } catch (error: any) {
    console.error('Geolocation analysis error:', error);
    return {
      success: false,
      clues: [],
      possibleLocations: [],
      analysis: '',
      searchQueries: [],
      error: error?.message || 'Analysis failed',
    };
  }
}

/**
 * Cross-reference image with known addresses
 */
export async function crossReferenceWithAddresses(
  imageAnalysis: GeolocationResult,
  knownAddresses: string[],
  apiKey: string
): Promise<{
  matches: Array<{
    address: string;
    matchScore: number;
    reasoning: string;
  }>;
}> {
  try {
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are comparing photo analysis clues against known addresses to find matches.

Rate each address 0-100 based on how well the photo clues match that location.
Consider: region, climate, architecture style, vegetation, visible text/signs.`,
        },
        {
          role: 'user',
          content: `PHOTO ANALYSIS CLUES:
${imageAnalysis.clues.map(c => `- ${c.type}: ${c.description} (${c.locationHint || 'no hint'})`).join('\n')}

POSSIBLE LOCATIONS FROM ANALYSIS:
${imageAnalysis.possibleLocations.map(l => `- ${l.description} (${l.confidence}% confidence)`).join('\n')}

KNOWN ADDRESSES TO CHECK:
${knownAddresses.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Return JSON:
{
  "matches": [
    {
      "address": "full address",
      "matchScore": 0-100,
      "reasoning": "why this matches or doesn't match the photo"
    }
  ]
}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      matches: (parsed.matches || []).sort((a: any, b: any) => b.matchScore - a.matchScore),
    };

  } catch (error) {
    console.error('Cross-reference error:', error);
    return { matches: [] };
  }
}

/**
 * Generate Google Maps search URL for a location
 */
export function generateMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Generate Google Street View URL for coordinates
 */
export function generateStreetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192`;
}

/**
 * Generate reverse image search URL
 */
export function generateReverseImageSearchUrl(imageUrl: string): string {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}
