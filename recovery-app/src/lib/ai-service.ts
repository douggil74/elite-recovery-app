/**
 * AI Service
 * Uses backend proxy for all AI calls - no API keys needed on client
 */

import { OSINT_CONFIG } from '@/constants';

const getBackendUrl = (): string => {
  return OSINT_CONFIG?.productionUrl || 'https://elite-recovery-osint.fly.dev';
};

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export interface AnalyzeResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export interface RecoveryBrief {
  subject: string;
  generated_at: string;
  brief: string;
  model: string;
}

// ============================================================================
// AI Chat
// ============================================================================

/**
 * Send chat message to AI via backend proxy
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  model: string = 'gpt-4o-mini',
  maxTokens: number = 2000
): Promise<string> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI request failed: ${error}`);
    }

    const data: ChatResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('AI chat error:', error);
    throw error;
  }
}

// ============================================================================
// Image/Document Analysis
// ============================================================================

/**
 * Analyze image or document with GPT-4 Vision via backend proxy
 */
export async function analyzeImage(
  imageBase64: string,
  prompt: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: imageBase64,
        prompt,
        model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image analysis failed: ${error}`);
    }

    const data: AnalyzeResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Image analysis error:', error);
    throw error;
  }
}

/**
 * Analyze image from URL
 */
export async function analyzeImageUrl(
  imageUrl: string,
  prompt: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
        model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Image analysis failed: ${error}`);
    }

    const data: AnalyzeResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Image URL analysis error:', error);
    throw error;
  }
}

// ============================================================================
// Recovery Brief Generation
// ============================================================================

/**
 * Generate AI-powered recovery brief via backend proxy
 */
export async function generateRecoveryBrief(params: {
  subjectName: string;
  knownAddresses?: string[];
  knownAssociates?: string[];
  vehicleInfo?: string;
  socialProfiles?: { platform: string; url: string }[];
  notes?: string;
}): Promise<RecoveryBrief> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/ai/brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject_name: params.subjectName,
        known_addresses: params.knownAddresses || [],
        known_associates: params.knownAssociates || [],
        vehicle_info: params.vehicleInfo,
        social_profiles: params.socialProfiles || [],
        notes: params.notes,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Brief generation failed: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Brief generation error:', error);
    throw error;
  }
}

// ============================================================================
// Tactical Analysis
// ============================================================================

/**
 * Get tactical advice for a specific situation
 */
export async function getTacticalAdvice(
  situation: string,
  context?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an expert fugitive recovery consultant helping licensed bail enforcement agents.
Provide tactical, professional advice. Be concise and actionable.
Focus on safety, legality, and effectiveness.
Never recommend illegal activities. Always emphasize coordination with local law enforcement when appropriate.`,
    },
    {
      role: 'user',
      content: context
        ? `Context: ${context}\n\nSituation: ${situation}\n\nWhat is your tactical advice?`
        : `Situation: ${situation}\n\nWhat is your tactical advice?`,
    },
  ];

  return sendChatMessage(messages, 'gpt-4o-mini', 1000);
}

// ============================================================================
// Photo Intelligence
// ============================================================================

/**
 * Analyze photo for investigative leads
 */
export async function analyzePhotoForIntel(imageBase64: string): Promise<{
  addresses: string[];
  licensePlates: string[];
  businesses: string[];
  landmarks: string[];
  people: string[];
  vehicles: string[];
  geographicIndicators: string[];
  rawAnalysis: string;
}> {
  const prompt = `Analyze this image for investigative intelligence. Extract any information that could help locate a person or identify their patterns of behavior.

Please identify and list:
1. **Addresses or address fragments** - Any visible street signs, building numbers, mailboxes
2. **License plates** - Any vehicle plates visible, even partial
3. **Business names** - Any store names, logos, or commercial signage
4. **Geographic landmarks** - Recognizable buildings, monuments, natural features
5. **People** - Descriptions of any visible individuals (age range, distinguishing features)
6. **Vehicles** - Make, model, color of any vehicles
7. **Geographic indicators** - Climate clues, vegetation, architectural style, regional characteristics

Be thorough and specific. This is for licensed bail enforcement purposes.`;

  try {
    const analysis = await analyzeImage(imageBase64, prompt);

    // Parse the analysis into structured data
    const sections = {
      addresses: extractSection(analysis, 'address'),
      licensePlates: extractSection(analysis, 'license plate'),
      businesses: extractSection(analysis, 'business'),
      landmarks: extractSection(analysis, 'landmark'),
      people: extractSection(analysis, 'people'),
      vehicles: extractSection(analysis, 'vehicle'),
      geographicIndicators: extractSection(analysis, 'geographic'),
      rawAnalysis: analysis,
    };

    return sections;
  } catch (error) {
    console.error('Photo intel analysis error:', error);
    return {
      addresses: [],
      licensePlates: [],
      businesses: [],
      landmarks: [],
      people: [],
      vehicles: [],
      geographicIndicators: [],
      rawAnalysis: 'Analysis failed: ' + String(error),
    };
  }
}

/**
 * Helper to extract items from analysis text
 */
function extractSection(text: string, keyword: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');

  let inSection = false;
  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check if we're entering a relevant section
    if (lowerLine.includes(keyword)) {
      inSection = true;
      continue;
    }

    // Check if we're leaving the section (new header)
    if (inSection && line.match(/^\d+\.\s*\*\*/)) {
      inSection = false;
      continue;
    }

    // Extract bullet points in the section
    if (inSection) {
      const match = line.match(/^[-•*]\s*(.+)/);
      if (match) {
        items.push(match[1].trim());
      }
    }
  }

  return items;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if AI backend is available
 */
export async function checkAIBackendHealth(): Promise<{
  available: boolean;
  hasOpenAIKey: boolean;
}> {
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { available: false, hasOpenAIKey: false };
    }

    // Try a simple AI call to check if OpenAI key is configured
    try {
      await sendChatMessage([{ role: 'user', content: 'test' }], 'gpt-4o-mini', 10);
      return { available: true, hasOpenAIKey: true };
    } catch {
      return { available: true, hasOpenAIKey: false };
    }
  } catch {
    return { available: false, hasOpenAIKey: false };
  }
}
