/**
 * Advanced Face Matching System
 * Uses GPT-4 Vision to extract detailed facial biometrics and compare faces
 * Better than Yandex - focuses on actual facial structure, not pose/skin
 * Now uses backend proxy - no local API key needed
 */

import learningSystem from './learning-system';

const BACKEND_URL = 'https://elite-recovery-osint.fly.dev';

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
  private targetFeatures: FacialFeatures | null = null;

  constructor(_apiKey?: string) {
    // API key no longer needed - using backend proxy
  }

  /**
   * Extract facial features from an image using backend proxy
   */
  async extractFeatures(imageBase64: string): Promise<{
    success: boolean;
    features?: FacialFeatures;
    quality?: string;
    error?: string;
  }> {
    try {
      // Clean base64 data
      const base64Data = imageBase64.includes('base64,')
        ? imageBase64.split('base64,')[1]
        : imageBase64;

      const response = await fetch(`${BACKEND_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          prompt: FACE_EXTRACTION_PROMPT + '\n\nExtract all facial biometrics from this face.',
          model: 'gpt-4o',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `${response.status} ${errorText}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
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

      // Now compare the two feature sets using backend proxy
      const prompt = FACE_COMPARISON_PROMPT
        .replace('{face1}', JSON.stringify(features, null, 2))
        .replace('{face2}', JSON.stringify(unknownResult.features, null, 2))
        + '\n\nCompare these two facial profiles and determine if they are the same person.';

      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Perform the comparison and output JSON.' },
          ],
          model: 'gpt-4o-mini',
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      const result: FaceMatchResult = {
        matchScore: parsed.matchScore || 0,
        confidence: parsed.confidence || 0,
        matchingFeatures: parsed.matchingFeatures || [],
        differingFeatures: parsed.differingFeatures || [],
        verdict: parsed.verdict || 'NO_MATCH',
        explanation: parsed.explanation || 'Comparison complete',
      };

      // Track learning from this comparison
      this.trackFaceMatchLearning(result).catch(() => {});

      return result;

    } catch (error: any) {
      console.error('Face comparison error:', error);
      // Track failure
      learningSystem.logFailure(
        'face_matching',
        'Face comparison failed',
        `Error: ${error?.message || 'Unknown error'}`
      ).catch(() => {});
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
   * Track learnings from face match results
   */
  private async trackFaceMatchLearning(result: FaceMatchResult): Promise<void> {
    try {
      // Track successful high-confidence matches
      if (result.verdict === 'LIKELY_MATCH' && result.matchScore >= 85) {
        await learningSystem.logSuccess(
          'face_matching',
          `High-confidence match: ${result.matchScore}%`,
          `Verdict: ${result.verdict}. Matching features: ${result.matchingFeatures.slice(0, 3).join(', ')}`,
          'HIGH'
        );
      } else if (result.verdict === 'POSSIBLE_MATCH') {
        await learningSystem.logSuccess(
          'face_matching',
          `Possible match found: ${result.matchScore}%`,
          `May need additional verification. Features: ${result.matchingFeatures.slice(0, 3).join(', ')}`,
          'MEDIUM'
        );
      }

      // Track prompt effectiveness
      const quality = result.matchScore > 50 ? Math.min(100, result.matchScore + result.confidence / 2) : 40;
      await learningSystem.trackPromptUse(
        'face_comparison_v2',
        '2.0',
        result.verdict !== 'NO_MATCH',
        quality
      );
    } catch (error) {
      console.error('[FaceMatch] Learning tracking error:', error);
    }
  }

  /**
   * Compare two images directly - extracts features and compares
   */
  async compareImages(
    image1Base64: string,
    image2Base64: string
  ): Promise<FaceMatchResult> {
    try {
      // Extract features from first image (target)
      const features1 = await this.extractFeatures(image1Base64);
      if (!features1.success || !features1.features) {
        return {
          matchScore: 0,
          confidence: 0,
          matchingFeatures: [],
          differingFeatures: [],
          verdict: 'NO_MATCH',
          explanation: `Could not extract features from first image: ${features1.error}`,
        };
      }

      // Compare second image against first
      return await this.compareFaces(image2Base64, features1.features);

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
