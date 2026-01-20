/**
 * Photo Intelligence Service
 * Analyzes photos for investigative leads:
 * - Address numbers on buildings
 * - Business names/signage
 * - License plates
 * - Landmarks and geographic indicators
 * - Background details that reveal location
 */

import { getSettings } from './storage';

export interface PhotoIntelligence {
  imageId: string;
  analyzedAt: string;

  // Location indicators
  addresses: {
    text: string;
    confidence: 'high' | 'medium' | 'low';
    type: 'house_number' | 'street_sign' | 'business_address' | 'mailbox' | 'other';
    context: string;
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
  }[];

  // Businesses/landmarks
  businesses: {
    name: string;
    type: string;
    searchQuery: string;
    confidence: 'high' | 'medium' | 'low';
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
{
  "addresses": [
    {"text": "1234", "confidence": "high", "type": "house_number", "context": "Visible on brick wall behind subject"}
  ],
  "vehicles": [
    {"type": "SUV", "color": "Black", "make": "Ford", "model": "Explorer", "licensePlate": "ABC-1234", "plateState": "TX", "confidence": "medium", "context": "Parked in driveway"}
  ],
  "businesses": [
    {"name": "Joe's Pizza", "type": "Restaurant", "searchQuery": "Joe's Pizza location", "confidence": "high"}
  ],
  "geography": [
    {"indicator": "Palm trees visible", "type": "vegetation", "possibleRegion": "Southern US, Florida, California, or Texas"}
  ],
  "people": [
    {"description": "Male, 30s", "clothing": "Dallas Cowboys jersey", "distinguishingFeatures": ["Neck tattoo - eagle"], "possibleRelation": "Friend or family member"}
  ],
  "metadata": {
    "estimatedTimeOfDay": "Afternoon based on shadows",
    "estimatedSeason": "Summer - light clothing, green trees",
    "indoorOutdoor": "outdoor",
    "settingType": "Residential backyard"
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

Be thorough - even small details matter. A partial license plate or distant store sign could be the lead that locates the fugitive.`;

export class PhotoIntelligenceService {
  private apiKey: string | null = null;

  async initialize(): Promise<boolean> {
    const settings = await getSettings();
    this.apiKey = settings.openaiApiKey || null;
    return !!this.apiKey;
  }

  /**
   * Analyze a photo for investigative intelligence
   */
  async analyzePhoto(imageBase64: string): Promise<PhotoIntelligence | null> {
    if (!this.apiKey) {
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('No OpenAI API key configured');
        return null;
      }
    }

    try {
      // Clean base64 if needed
      const base64Data = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: PHOTO_INTEL_PROMPT,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Data}`,
                    detail: 'high',
                  },
                },
                {
                  type: 'text',
                  text: 'Analyze this image thoroughly for all investigative leads. Focus especially on addresses, license plates, business names, and any geographic indicators.',
                },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.1,
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
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Enhance leads with proper search links
      const enhancedLeads = (parsed.leads || []).map((lead: any) => ({
        ...lead,
        searchLinks: this.generateSearchLinks(lead),
      }));

      return {
        imageId: Date.now().toString(),
        analyzedAt: new Date().toISOString(),
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
      };

    } catch (error) {
      console.error('Photo analysis error:', error);
      return null;
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
