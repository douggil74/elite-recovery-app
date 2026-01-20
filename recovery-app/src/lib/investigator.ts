/**
 * Investigator AI - Enhanced cross-reference analysis engine
 * Analyzes multiple files, finds patterns, asks smart questions
 */

import OpenAI from 'openai';
import type { ParsedReport, ParsedAddress, ParsedPhone, ParsedRelative, ParsedVehicle } from '@/types';

export interface InvestigatorContext {
  targetName: string;
  files: UploadedFile[];
  existingData?: ParsedReport;
  conversationHistory: ConversationMessage[];
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'doc';
  content?: string; // Extracted text
  dataUrl?: string; // For images
  extractedData?: any;
  isTargetPhoto?: boolean;
  personType?: 'target' | 'relative' | 'associate';
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: string[]; // Follow-up questions AI suggests
  actionItems?: ActionItem[];
}

export interface ActionItem {
  type: 'upload_request' | 'question' | 'lead' | 'warning';
  text: string;
  priority: 'high' | 'medium' | 'low';
  relatedPerson?: string;
}

export interface RankedAddress {
  rank: number;
  address: string;
  fullAddress: string;
  probability: number; // 0-100
  type: 'current_residence' | 'work' | 'family' | 'historical' | 'unknown';
  reasoning: string[];
  sources: string[]; // Which files mentioned this
  linkedData: {
    phones?: string[];
    vehicles?: string[];
    people?: string[];
  };
  bestTime?: string;
  lastVerified?: string;
}

export interface RankedVehicle {
  rank: number;
  description: string;
  plate?: string;
  probability: number;
  reasoning: string;
  sources: string[];
}

export interface InvestigationResult {
  topAddresses: RankedAddress[];
  vehicles: RankedVehicle[];
  patterns: PatternMatch[];
  questions: SmartQuestion[];
  warnings: string[];
  nextSteps: string[];
}

export interface PatternMatch {
  type: 'cohabitation' | 'movement' | 'contact_cluster' | 'alias' | 'vehicle_sighting';
  description: string;
  confidence: number;
  evidence: string[];
}

export interface SmartQuestion {
  question: string;
  reason: string;
  expectedDataType?: string;
  relatedPerson?: string;
}

const INVESTIGATOR_SYSTEM_PROMPT = `You are HUNTER, an elite AI investigative assistant for licensed fugitive recovery professionals.

YOUR MISSION: Analyze all available data to locate the target. Be tactical, precise, and thorough.

CAPABILITIES:
- Cross-reference multiple data sources (skip-traces, public records, social media)
- Identify patterns humans miss (cohabitation, movement patterns, contact clusters)
- Rank addresses by ACTUAL probability of finding the target
- Ask smart follow-up questions to fill intelligence gaps
- Flag stale data vs current intel

ANALYSIS PRINCIPLES:
1. CURRENT > HISTORICAL - Recent data trumps old data
2. MULTIPLE SOURCES = HIGHER CONFIDENCE - If 3 files mention same address, it's solid
3. LINKED SIGNALS - Address with registered vehicle + active phone = high priority
4. FAMILY PATTERNS - People hide at family homes, especially mothers
5. WORK SCHEDULES - Know when they'll be home vs at work

WHEN ANALYZING:
- Look for addresses appearing in multiple files
- Cross-reference relatives' addresses with target's history
- Identify which phones are still active
- Find current vehicles and plates
- Spot patterns: Do they move frequently? Use aliases? Same contacts repeatedly?

OUTPUT FORMAT:
Always provide:
1. TOP 4 ADDRESSES ranked by probability (with percentages and reasoning)
2. CURRENT VEHICLES with plates if available
3. PATTERNS DETECTED
4. SMART QUESTIONS - What more data would help?
5. IMMEDIATE ACTION - What should the investigator do NOW?

Be direct. Be tactical. Help catch the fugitive.`;

const CROSS_REFERENCE_PROMPT = `Analyze these files together. Cross-reference ALL data to find patterns.

LOOK FOR:
1. Addresses appearing in MULTIPLE files = high confidence
2. Relatives whose addresses match target's history = likely hideout
3. Phone numbers linked to multiple people = contact network
4. Vehicles registered to current addresses = active location
5. Employment patterns = daytime location
6. People living together = cohabitation patterns

RANK addresses 1-4 by probability (percentage) with SPECIFIC reasoning based on evidence.

For each address, note:
- Which files/sources mention it
- Any linked phone numbers
- Any linked vehicles
- Best time to check
- Who else might be there`;

/**
 * Main investigator class
 */
export class Investigator {
  private client: OpenAI;
  private context: InvestigatorContext;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.context = {
      targetName: '',
      files: [],
      conversationHistory: [],
    };
  }

  /**
   * Initialize investigation for a target
   */
  async startInvestigation(targetName: string): Promise<ConversationMessage> {
    this.context.targetName = targetName;
    this.context.files = [];
    this.context.conversationHistory = [];

    const greeting: ConversationMessage = {
      role: 'assistant',
      content: `Investigation opened for: **${targetName}**

What intel do you have? Drop files here:
• Skip-trace reports (PDF/text)
• Court documents
• Surveillance photos
• Associate data files

The more data you feed me, the better I can triangulate their location.`,
      timestamp: new Date(),
      suggestions: [
        'I have a skip-trace PDF',
        'I have surveillance photos',
        'I have data on a relative',
      ],
    };

    this.context.conversationHistory.push(greeting);
    return greeting;
  }

  /**
   * Process a new file upload
   */
  async processFile(file: UploadedFile): Promise<ConversationMessage> {
    this.context.files.push(file);

    // Check if it's an image
    if (file.type === 'image') {
      return this.handleImageUpload(file);
    }

    // For documents, analyze the content
    return this.analyzeDocument(file);
  }

  /**
   * Handle image upload - detect face and ask if it's the target
   */
  private async handleImageUpload(file: UploadedFile): Promise<ConversationMessage> {
    // For now, always ask if it's the target
    // In future: integrate face detection API

    const response: ConversationMessage = {
      role: 'assistant',
      content: `Got the image: **${file.name}**

Is this a photo of the target (${this.context.targetName})?

If yes, I'll save it as the case profile photo.
If it's a relative or associate, let me know who.`,
      timestamp: new Date(),
      suggestions: [
        `Yes, this is ${this.context.targetName}`,
        'No, this is a relative',
        'No, this is an associate',
        'This is a location photo',
      ],
    };

    this.context.conversationHistory.push(response);
    return response;
  }

  /**
   * Analyze a document and extract intelligence
   */
  private async analyzeDocument(file: UploadedFile): Promise<ConversationMessage> {
    if (!file.content) {
      return {
        role: 'assistant',
        content: `Could not read **${file.name}**. Try pasting the text directly.`,
        timestamp: new Date(),
      };
    }

    try {
      // First, extract entities
      const extractResponse = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract all addresses, phones, people, vehicles from this document.
Return JSON:
{
  "subjectName": "string (main person in document)",
  "addresses": [{ "address": "string", "type": "home|work|family|unknown", "dates": "string", "current": boolean }],
  "phones": [{ "number": "string", "type": "mobile|landline|work", "active": boolean }],
  "people": [{ "name": "string", "relationship": "string", "address": "string", "phone": "string" }],
  "vehicles": [{ "year": "string", "make": "string", "model": "string", "color": "string", "plate": "string", "vin": "string" }],
  "employment": [{ "employer": "string", "address": "string", "current": boolean }]
}`,
          },
          {
            role: 'user',
            content: file.content.slice(0, 50000), // Limit for token management
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const extracted = JSON.parse(extractResponse.choices[0]?.message?.content || '{}');
      file.extractedData = extracted;

      const addressCount = extracted.addresses?.length || 0;
      const phoneCount = extracted.phones?.length || 0;
      const peopleCount = extracted.people?.length || 0;
      const vehicleCount = extracted.vehicles?.length || 0;

      // Now run cross-reference if we have multiple files
      let analysis = '';
      let questions: SmartQuestion[] = [];

      if (this.context.files.length > 1) {
        const crossRef = await this.runCrossReference();
        analysis = crossRef.analysis;
        questions = crossRef.questions;
      }

      const response: ConversationMessage = {
        role: 'assistant',
        content: `**${file.name}** analyzed.

📍 **${addressCount}** addresses found
📱 **${phoneCount}** phone numbers
👥 **${peopleCount}** people/contacts
🚗 **${vehicleCount}** vehicles

${analysis}

${questions.length > 0 ? '\n**I have some questions that could help:**' : ''}`,
        timestamp: new Date(),
        suggestions: questions.slice(0, 3).map(q => q.question),
        actionItems: questions.map(q => ({
          type: 'question' as const,
          text: q.question,
          priority: 'medium' as const,
          relatedPerson: q.relatedPerson,
        })),
      };

      this.context.conversationHistory.push(response);
      return response;

    } catch (error) {
      console.error('Analysis error:', error);
      return {
        role: 'assistant',
        content: `Error analyzing **${file.name}**. Check your API key in Settings.`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run cross-reference analysis on all files
   */
  async runCrossReference(): Promise<{ analysis: string; questions: SmartQuestion[]; result: InvestigationResult }> {
    const allData = this.context.files
      .filter(f => f.extractedData)
      .map(f => ({
        fileName: f.name,
        personType: f.personType || 'unknown',
        data: f.extractedData,
      }));

    if (allData.length === 0) {
      return {
        analysis: 'No data to cross-reference yet.',
        questions: [],
        result: { topAddresses: [], vehicles: [], patterns: [], questions: [], warnings: [], nextSteps: [] },
      };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: INVESTIGATOR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `TARGET: ${this.context.targetName}

DATA FROM ${allData.length} FILES:
${JSON.stringify(allData, null, 2)}

${CROSS_REFERENCE_PROMPT}

Return JSON:
{
  "topAddresses": [{
    "rank": 1-4,
    "address": "full address",
    "probability": 0-100,
    "type": "current_residence|work|family|historical",
    "reasoning": ["reason1", "reason2"],
    "sources": ["file1.pdf", "file2.pdf"],
    "linkedPhones": ["555-1234"],
    "linkedVehicles": ["2019 Honda Civic ABC123"],
    "bestTime": "evening",
    "whoMightBeThere": "mother Jane Doe"
  }],
  "vehicles": [{
    "description": "2019 Honda Civic, Black",
    "plate": "ABC123",
    "probability": 0-100,
    "reasoning": "registered to current address"
  }],
  "patterns": [{
    "type": "cohabitation|movement|alias",
    "description": "string",
    "confidence": 0-100,
    "evidence": ["string"]
  }],
  "questions": [{
    "question": "string",
    "reason": "why this would help",
    "relatedPerson": "name if applicable"
  }],
  "warnings": ["any red flags"],
  "immediateActions": ["what to do now"]
}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      // Build analysis text
      let analysis = '';

      if (result.topAddresses?.length > 0) {
        analysis += '\n\n**🎯 TOP LOCATIONS:**\n';
        result.topAddresses.slice(0, 4).forEach((addr: any, i: number) => {
          analysis += `\n**#${i + 1}** (${addr.probability}%) - ${addr.address}\n`;
          analysis += `   Type: ${addr.type?.replace('_', ' ')}\n`;
          analysis += `   Why: ${addr.reasoning?.join(', ')}\n`;
          if (addr.bestTime) analysis += `   Best time: ${addr.bestTime}\n`;
        });
      }

      if (result.vehicles?.length > 0) {
        analysis += '\n\n**🚗 VEHICLES:**\n';
        result.vehicles.forEach((v: any) => {
          analysis += `• ${v.description}${v.plate ? ` - Plate: **${v.plate}**` : ''}\n`;
        });
      }

      if (result.patterns?.length > 0) {
        analysis += '\n\n**🔍 PATTERNS DETECTED:**\n';
        result.patterns.forEach((p: any) => {
          analysis += `• ${p.description} (${p.confidence}% confidence)\n`;
        });
      }

      if (result.immediateActions?.length > 0) {
        analysis += '\n\n**⚡ RECOMMENDED ACTIONS:**\n';
        result.immediateActions.forEach((a: string) => {
          analysis += `• ${a}\n`;
        });
      }

      return {
        analysis,
        questions: result.questions || [],
        result: {
          topAddresses: result.topAddresses || [],
          vehicles: result.vehicles || [],
          patterns: result.patterns || [],
          questions: result.questions || [],
          warnings: result.warnings || [],
          nextSteps: result.immediateActions || [],
        },
      };

    } catch (error) {
      console.error('Cross-reference error:', error);
      return {
        analysis: 'Error running cross-reference analysis.',
        questions: [],
        result: { topAddresses: [], vehicles: [], patterns: [], questions: [], warnings: [], nextSteps: [] },
      };
    }
  }

  /**
   * Handle user message in investigation chat
   */
  async chat(message: string): Promise<ConversationMessage> {
    // Add user message to history
    this.context.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Check for specific commands/responses
    const lowerMsg = message.toLowerCase();

    // Handle "yes this is the target" for photos
    if (lowerMsg.includes('yes') && (lowerMsg.includes('target') || lowerMsg.includes(this.context.targetName.toLowerCase()))) {
      const lastImage = [...this.context.files].reverse().find(f => f.type === 'image');
      if (lastImage) {
        lastImage.isTargetPhoto = true;
        lastImage.personType = 'target';
        return {
          role: 'assistant',
          content: `Got it. Photo saved as **${this.context.targetName}**'s profile.

This helps with identification in the field. Got any more intel to upload?`,
          timestamp: new Date(),
          suggestions: [
            'I have more files',
            'Run full analysis',
            'Show me top addresses',
          ],
        };
      }
    }

    // Handle relative/associate identification
    if (lowerMsg.includes('relative') || lowerMsg.includes('associate')) {
      const lastImage = [...this.context.files].reverse().find(f => f.type === 'image');
      if (lastImage) {
        lastImage.personType = lowerMsg.includes('relative') ? 'relative' : 'associate';
        return {
          role: 'assistant',
          content: `Noted as ${lastImage.personType}. What's their name and relationship to ${this.context.targetName}?`,
          timestamp: new Date(),
        };
      }
    }

    // Handle analysis request
    if (lowerMsg.includes('analysis') || lowerMsg.includes('analyze') || lowerMsg.includes('top address')) {
      const crossRef = await this.runCrossReference();
      return {
        role: 'assistant',
        content: crossRef.analysis || 'Need more data to analyze. Upload some files first.',
        timestamp: new Date(),
        suggestions: crossRef.questions.slice(0, 3).map(q => q.question),
      };
    }

    // General chat - use AI
    try {
      const allData = this.context.files
        .filter(f => f.extractedData)
        .map(f => ({ fileName: f.name, data: f.extractedData }));

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${INVESTIGATOR_SYSTEM_PROMPT}

CURRENT INVESTIGATION:
Target: ${this.context.targetName}
Files uploaded: ${this.context.files.length}
Data available: ${JSON.stringify(allData, null, 2)}

Respond to the investigator's question. Be tactical and specific. Reference actual data.`,
          },
          ...this.context.conversationHistory.slice(-10).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const reply = response.choices[0]?.message?.content || 'Connection lost. Try again.';

      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };

      this.context.conversationHistory.push(assistantMsg);
      return assistantMsg;

    } catch (error) {
      console.error('Chat error:', error);
      return {
        role: 'assistant',
        content: 'Error processing. Check API key in Settings.',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get current investigation summary
   */
  getSummary(): { fileCount: number; addressCount: number; hasTargetPhoto: boolean } {
    const targetPhoto = this.context.files.find(f => f.isTargetPhoto);
    const allAddresses = this.context.files
      .filter(f => f.extractedData?.addresses)
      .flatMap(f => f.extractedData.addresses);

    return {
      fileCount: this.context.files.length,
      addressCount: allAddresses.length,
      hasTargetPhoto: !!targetPhoto,
    };
  }

  /**
   * Get target photo if set
   */
  getTargetPhoto(): string | null {
    const photo = this.context.files.find(f => f.isTargetPhoto);
    return photo?.dataUrl || null;
  }
}

/**
 * Create a new investigator instance
 */
export function createInvestigator(apiKey: string): Investigator {
  return new Investigator(apiKey);
}
