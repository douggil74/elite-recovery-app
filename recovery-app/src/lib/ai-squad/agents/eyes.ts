/**
 * EYES Agent
 * Analyzes images for geolocation, faces, and visual intelligence
 * Model: GPT-4o (vision capable)
 */

import OpenAI from 'openai';
import type { VisualAnalysis, VisualClue, PossibleLocation, AddressMatch } from '../types';

const EYES_PROMPT = `You are EYES, an expert visual intelligence AI for fugitive recovery.

YOUR CAPABILITIES:
1. **GEOLOCATION** - Identify where photos were taken from visual clues
2. **FACE ANALYSIS** - Describe people in photos for identification
3. **SCENE ANALYSIS** - Extract tactical information from surveillance photos
4. **PATTERN MATCHING** - Compare photos against known locations

GEOLOCATION ANALYSIS - Look for:
- Street signs, business signs, billboards (text = location gold)
- License plates (state identification)
- Architecture style (regional indicators)
- Vegetation (palm trees = warm climate, pine = temperate)
- Road markings, infrastructure (varies by region)
- Sun angle and shadows (latitude/time indicators)
- Reflections in windows/mirrors (hidden details)
- Background details through windows (indoor shots)

FACE/PERSON ANALYSIS:
- Physical description (height estimate, build, hair, distinguishing features)
- Clothing (work uniform = employer clue)
- Accessories, tattoos, jewelry
- Companions (who are they with?)

SCENE ANALYSIS:
- Vehicle details (plate, make, model, condition)
- Property details (house style, yard, vehicles in driveway)
- Time indicators (lighting, shadows, seasonal clues)
- Activity indicators (what's happening in the scene?)

OUTPUT JSON:
{
  "sceneType": "outdoor|indoor|vehicle|portrait|surveillance|social_media",
  "clues": [
    {
      "type": "sign|landmark|building|vehicle|vegetation|weather|text|person|other",
      "description": "detailed description",
      "confidence": 0-100,
      "locationHint": "what this suggests about location"
    }
  ],
  "possibleLocations": [
    {
      "description": "City, State or specific area",
      "confidence": 0-100,
      "reasoning": "based on what clues",
      "searchQuery": "Google Maps search to verify"
    }
  ],
  "people": [
    {
      "description": "physical description",
      "isLikelyTarget": true/false,
      "confidence": 0-100,
      "notes": "any identifying features"
    }
  ],
  "vehicles": [
    {
      "description": "full description",
      "plate": "if visible",
      "plateState": "if identifiable",
      "confidence": 0-100
    }
  ],
  "tacticalNotes": "any observations useful for recovery operations",
  "suggestedSearches": ["Google searches to find more info"],
  "analysis": "overall summary"
}`;

const ADDRESS_MATCH_PROMPT = `Compare photo analysis clues against known addresses.

For each address, score 0-100 based on:
- Region match (state, climate zone)
- Architecture compatibility
- Vegetation match
- Any visible text/signs matching area codes, cities
- Overall likelihood the photo was taken at or near this address

Return JSON:
{
  "matches": [
    {
      "address": "the full address",
      "matchScore": 0-100,
      "reasoning": "why this score"
    }
  ]
}`;

export class EyesAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Analyze an image for all visual intelligence
   */
  async analyzeImage(
    imageBase64: string,
    imageName: string,
    context?: string
  ): Promise<{
    success: boolean;
    analysis?: VisualAnalysis;
    error?: string;
  }> {
    try {
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EYES_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: context
                  ? `Analyze this image. Context: ${context}\n\nExtract ALL visual intelligence - location clues, people, vehicles, anything useful for finding someone.`
                  : 'Analyze this image for fugitive recovery. Extract ALL visual intelligence - location clues, people, vehicles, tactical information.',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 2500,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          success: true,
          analysis: {
            imageId: Date.now().toString(),
            imageName,
            clues: [],
            possibleLocations: [],
            matchedAddresses: [],
            analysis: content,
          },
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        analysis: {
          imageId: Date.now().toString(),
          imageName,
          clues: parsed.clues || [],
          possibleLocations: parsed.possibleLocations || [],
          matchedAddresses: [],
          analysis: parsed.analysis || content,
        },
      };

    } catch (error: any) {
      console.error('EYES analysis error:', error);
      return { success: false, error: error?.message || 'Image analysis failed' };
    }
  }

  /**
   * Compare image analysis against known addresses
   */
  async matchAgainstAddresses(
    analysis: VisualAnalysis,
    addresses: string[]
  ): Promise<AddressMatch[]> {
    if (!analysis.clues.length || !addresses.length) {
      return [];
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ADDRESS_MATCH_PROMPT },
          {
            role: 'user',
            content: `VISUAL CLUES FROM PHOTO:
${analysis.clues.map(c => `- ${c.type}: ${c.description} → ${c.locationHint || 'no hint'}`).join('\n')}

POSSIBLE LOCATIONS IDENTIFIED:
${analysis.possibleLocations.map(l => `- ${l.description} (${l.confidence}%): ${l.reasoning}`).join('\n')}

KNOWN ADDRESSES TO CHECK:
${addresses.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Score each address on likelihood the photo was taken there.`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return (parsed.matches || [])
        .sort((a: AddressMatch, b: AddressMatch) => b.matchScore - a.matchScore);

    } catch (error) {
      console.error('Address matching error:', error);
      return [];
    }
  }

  /**
   * Check if image contains a face that could be the target
   */
  async detectFace(
    imageBase64: string,
    targetDescription?: string
  ): Promise<{
    hasFace: boolean;
    couldBeTarget: boolean;
    description?: string;
    confidence: number;
  }> {
    try {
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Analyze if this image contains a human face. If yes, describe the person.
${targetDescription ? `TARGET DESCRIPTION: ${targetDescription}` : ''}

Return JSON:
{
  "hasFace": true/false,
  "couldBeTarget": true/false (if target description provided),
  "description": "physical description if face present",
  "confidence": 0-100
}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Does this image contain a face? Describe if yes.' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { hasFace: false, couldBeTarget: false, confidence: 0 };

    } catch (error) {
      console.error('Face detection error:', error);
      return { hasFace: false, couldBeTarget: false, confidence: 0 };
    }
  }
}
