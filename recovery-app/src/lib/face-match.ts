/**
 * Advanced Face Matching System
 * Uses GPT-4 Vision to extract detailed facial biometrics and compare faces
 * Better than Yandex - focuses on actual facial structure, not pose/skin
 */

import OpenAI from 'openai';

export interface FacialFeatures {
  // Bone structure
  faceShape: string; // oval, round, square, heart, oblong
  jawline: string; // sharp, soft, squared, pointed
  cheekbones: string; // high, low, prominent, flat
  foreheadSize: string; // small, medium, large
  foreheadShape: string; // flat, rounded, sloped

  // Eyes
  eyeShape: string; // almond, round, hooded, monolid, downturned, upturned
  eyeSize: string; // small, medium, large
  eyeSpacing: string; // close-set, average, wide-set
  eyeColor: string;
  eyebrowShape: string; // arched, straight, curved, s-shaped
  eyebrowThickness: string;

  // Nose
  noseShape: string; // straight, hooked, upturned, roman, button, wide
  noseWidth: string; // narrow, average, wide
  nostrilShape: string;
  noseBridge: string; // high, low, flat

  // Mouth/Lips
  lipShape: string; // full, thin, heart, wide
  lipThickness: string; // thin, medium, full
  mouthWidth: string; // narrow, average, wide
  cupidsBow: string; // defined, subtle, flat

  // Ears
  earSize: string;
  earShape: string;

  // Skin
  skinTone: string; // light, medium, olive, tan, dark
  skinTexture: string;

  // Distinguishing features
  distinctiveFeatures: string[]; // scars, moles, birthmarks, dimples, cleft chin
  facialHair?: string;
  hairline?: string;
  wrinklePatterns?: string;

  // Proportions (ratios for matching)
  proportions: {
    eyeToFaceRatio: string;
    noseToFaceRatio: string;
    mouthToJawRatio: string;
    foreheadToFaceRatio: string;
  };

  // Unique identifiers
  uniqueSignature: string; // AI-generated unique description for matching
}

export interface FaceMatchResult {
  matchScore: number; // 0-100
  confidence: number; // 0-100
  matchingFeatures: string[];
  differingFeatures: string[];
  verdict: 'LIKELY_MATCH' | 'POSSIBLE_MATCH' | 'UNLIKELY_MATCH' | 'NO_MATCH';
  explanation: string;
}

const FACE_EXTRACTION_PROMPT = `You are an expert forensic facial analyst. Extract DETAILED facial biometrics from this image.

CRITICAL: Focus on PERMANENT BONE STRUCTURE AND FEATURES, not:
- Pose or angle
- Lighting
- Expression
- Makeup
- Hair styling
- Age-related changes

EXTRACT THESE EXACT MEASUREMENTS:

1. BONE STRUCTURE
- Face shape (oval/round/square/heart/oblong/diamond)
- Jawline (sharp/soft/squared/pointed/rounded)
- Cheekbone position and prominence
- Forehead size and shape
- Chin shape

2. EYES (Most distinctive feature)
- Shape (almond/round/hooded/monolid/downturned/upturned/deep-set)
- Size relative to face
- Distance between eyes (close-set/average/wide-set)
- Color
- Eyebrow shape and position
- Eye socket depth

3. NOSE (Second most distinctive)
- Overall shape (straight/hooked/upturned/roman/button/aquiline)
- Width relative to face
- Bridge height
- Nostril shape and size
- Tip shape

4. MOUTH
- Lip fullness and shape
- Width relative to nose
- Cupid's bow definition
- Position relative to nose

5. EARS (if visible)
- Size, shape, attachment

6. DISTINCTIVE MARKS
- Scars, moles, birthmarks (EXACT locations)
- Dimples
- Cleft chin
- Asymmetries

7. PROPORTIONS (for mathematical matching)
- Eye width to face width ratio
- Nose length to face length ratio
- Distance between features

OUTPUT JSON:
{
  "faceDetected": true/false,
  "quality": "high/medium/low",
  "features": {
    "faceShape": "",
    "jawline": "",
    "cheekbones": "",
    "foreheadSize": "",
    "foreheadShape": "",
    "eyeShape": "",
    "eyeSize": "",
    "eyeSpacing": "",
    "eyeColor": "",
    "eyebrowShape": "",
    "eyebrowThickness": "",
    "noseShape": "",
    "noseWidth": "",
    "nostrilShape": "",
    "noseBridge": "",
    "lipShape": "",
    "lipThickness": "",
    "mouthWidth": "",
    "cupidsBow": "",
    "earSize": "",
    "earShape": "",
    "skinTone": "",
    "skinTexture": "",
    "distinctiveFeatures": [],
    "facialHair": "",
    "hairline": "",
    "wrinklePatterns": "",
    "proportions": {
      "eyeToFaceRatio": "",
      "noseToFaceRatio": "",
      "mouthToJawRatio": "",
      "foreheadToFaceRatio": ""
    },
    "uniqueSignature": "A unique descriptive sentence combining all distinctive features"
  }
}`;

const FACE_COMPARISON_PROMPT = `You are an expert forensic facial analyst comparing two faces.

CRITICAL: Ignore these factors:
- Age differences (bone structure doesn't change)
- Lighting/shadows
- Expression/pose
- Makeup/styling
- Photo quality
- Weight changes (bone structure remains)

FOCUS ON:
1. Bone structure match (jaw, cheekbones, skull shape)
2. Eye shape and spacing
3. Nose structure
4. Permanent distinctive marks
5. Proportional ratios

FACE 1 (KNOWN TARGET):
{face1}

FACE 2 (UNKNOWN - to compare):
{face2}

Compare these faces and determine if they are the SAME PERSON.

OUTPUT JSON:
{
  "matchScore": 0-100,
  "confidence": 0-100,
  "matchingFeatures": ["list of features that match"],
  "differingFeatures": ["list of features that differ"],
  "verdict": "LIKELY_MATCH|POSSIBLE_MATCH|UNLIKELY_MATCH|NO_MATCH",
  "explanation": "detailed reasoning focusing on bone structure"
}

SCORING GUIDE:
- 85-100: Almost certainly same person (multiple bone structure matches)
- 70-84: Likely same person (key features match)
- 50-69: Possible match (some features match, need more data)
- 30-49: Unlikely match (significant differences)
- 0-29: Different person (bone structure clearly different)`;

export class FaceMatchingService {
  private client: OpenAI;
  private targetFeatures: FacialFeatures | null = null;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Extract facial features from an image
   */
  async extractFeatures(imageBase64: string): Promise<{
    success: boolean;
    features?: FacialFeatures;
    quality?: string;
    error?: string;
  }> {
    try {
      const imageUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: FACE_EXTRACTION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all facial biometrics from this face.' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return { success: false, error: 'Could not parse response' };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.faceDetected) {
        return { success: false, error: 'No face detected in image' };
      }

      return {
        success: true,
        features: parsed.features,
        quality: parsed.quality,
      };

    } catch (error: any) {
      console.error('Feature extraction error:', error);
      return { success: false, error: error?.message || 'Extraction failed' };
    }
  }

  /**
   * Set the target face to match against
   */
  async setTargetFace(imageBase64: string): Promise<{
    success: boolean;
    features?: FacialFeatures;
    error?: string;
  }> {
    const result = await this.extractFeatures(imageBase64);

    if (result.success && result.features) {
      this.targetFeatures = result.features;
    }

    return result;
  }

  /**
   * Compare a face against the target
   */
  async compareFaces(
    unknownImageBase64: string,
    targetFeatures?: FacialFeatures
  ): Promise<FaceMatchResult> {
    const features = targetFeatures || this.targetFeatures;

    if (!features) {
      return {
        matchScore: 0,
        confidence: 0,
        matchingFeatures: [],
        differingFeatures: [],
        verdict: 'NO_MATCH',
        explanation: 'No target face set. Upload a target photo first.',
      };
    }

    try {
      const imageUrl = unknownImageBase64.startsWith('data:')
        ? unknownImageBase64
        : `data:image/jpeg;base64,${unknownImageBase64}`;

      // First extract features from unknown image
      const unknownResult = await this.extractFeatures(unknownImageBase64);

      if (!unknownResult.success || !unknownResult.features) {
        return {
          matchScore: 0,
          confidence: 0,
          matchingFeatures: [],
          differingFeatures: [],
          verdict: 'NO_MATCH',
          explanation: unknownResult.error || 'Could not extract features from comparison image',
        };
      }

      // Now compare the two feature sets
      const prompt = FACE_COMPARISON_PROMPT
        .replace('{face1}', JSON.stringify(features, null, 2))
        .replace('{face2}', JSON.stringify(unknownResult.features, null, 2));

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: 'Compare these two facial profiles and determine if they are the same person.',
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        matchScore: parsed.matchScore || 0,
        confidence: parsed.confidence || 0,
        matchingFeatures: parsed.matchingFeatures || [],
        differingFeatures: parsed.differingFeatures || [],
        verdict: parsed.verdict || 'NO_MATCH',
        explanation: parsed.explanation || 'Comparison complete',
      };

    } catch (error: any) {
      console.error('Face comparison error:', error);
      return {
        matchScore: 0,
        confidence: 0,
        matchingFeatures: [],
        differingFeatures: [],
        verdict: 'NO_MATCH',
        explanation: `Comparison failed: ${error?.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Compare two images directly
   */
  async compareImages(
    image1Base64: string,
    image2Base64: string
  ): Promise<FaceMatchResult> {
    try {
      const url1 = image1Base64.startsWith('data:')
        ? image1Base64
        : `data:image/jpeg;base64,${image1Base64}`;

      const url2 = image2Base64.startsWith('data:')
        ? image2Base64
        : `data:image/jpeg;base64,${image2Base64}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a forensic facial analyst. Compare these two faces and determine if they are the SAME PERSON.

Focus ONLY on bone structure and permanent features:
- Skull shape, jaw structure, cheekbones
- Eye shape, spacing, and socket depth
- Nose bone structure
- Ear shape (if visible)
- Permanent marks (scars, moles)

IGNORE:
- Age, weight, expression, lighting, pose, makeup, hair

Return JSON:
{
  "matchScore": 0-100,
  "confidence": 0-100,
  "matchingFeatures": [],
  "differingFeatures": [],
  "verdict": "LIKELY_MATCH|POSSIBLE_MATCH|UNLIKELY_MATCH|NO_MATCH",
  "explanation": "reasoning"
}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Compare these two faces. Are they the same person?' },
              { type: 'image_url', image_url: { url: url1, detail: 'high' } },
              { type: 'image_url', image_url: { url: url2, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        matchScore: parsed.matchScore || 0,
        confidence: parsed.confidence || 0,
        matchingFeatures: parsed.matchingFeatures || [],
        differingFeatures: parsed.differingFeatures || [],
        verdict: parsed.verdict || 'NO_MATCH',
        explanation: parsed.explanation || '',
      };

    } catch (error: any) {
      console.error('Image comparison error:', error);
      return {
        matchScore: 0,
        confidence: 0,
        matchingFeatures: [],
        differingFeatures: [],
        verdict: 'NO_MATCH',
        explanation: `Comparison failed: ${error?.message}`,
      };
    }
  }

  /**
   * Search for target face in multiple images
   */
  async searchInImages(
    targetImageBase64: string,
    imagesToSearch: { id: string; base64: string; name: string }[]
  ): Promise<{
    matches: {
      id: string;
      name: string;
      result: FaceMatchResult;
    }[];
    bestMatch?: {
      id: string;
      name: string;
      result: FaceMatchResult;
    };
  }> {
    const matches: {
      id: string;
      name: string;
      result: FaceMatchResult;
    }[] = [];

    // Extract target features once
    const targetResult = await this.extractFeatures(targetImageBase64);
    if (!targetResult.success || !targetResult.features) {
      return { matches };
    }

    // Compare each image
    for (const img of imagesToSearch) {
      const result = await this.compareFaces(img.base64, targetResult.features);
      matches.push({
        id: img.id,
        name: img.name,
        result,
      });

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    // Sort by match score
    matches.sort((a, b) => b.result.matchScore - a.result.matchScore);

    const bestMatch = matches.find(m =>
      m.result.verdict === 'LIKELY_MATCH' || m.result.verdict === 'POSSIBLE_MATCH'
    );

    return { matches, bestMatch };
  }

  getTargetFeatures(): FacialFeatures | null {
    return this.targetFeatures;
  }
}
