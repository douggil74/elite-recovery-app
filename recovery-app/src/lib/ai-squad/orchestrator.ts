/**
 * AI Squad Orchestrator
 * Main controller that coordinates all AI agents
 */

import { ExtractorAgent } from './agents/extractor';
import { EyesAgent } from './agents/eyes';
import { BrainAgent } from './agents/brain';
import { HunterAgent } from './agents/hunter';
import { CoordinatorAgent } from './agents/coordinator';
import type {
  SharedContext,
  ExtractedData,
  VisualAnalysis,
  WebFinding,
  AgentMessage,
  AgentTask,
  RankedLocation,
  SmartQuestion,
  AIConfig,
} from './types';

export interface OrchestratorCallbacks {
  onAgentActivity?: (agent: string, status: string, detail: string) => void;
  onMessage?: (message: AgentMessage) => void;
  onLocationUpdate?: (locations: RankedLocation[]) => void;
  onConfidenceUpdate?: (confidence: number) => void;
  onQuestion?: (question: SmartQuestion) => void;
  onError?: (agent: string, error: string) => void;
}

export class AISquadOrchestrator {
  private extractor: ExtractorAgent;
  private eyes: EyesAgent;
  private brain: BrainAgent;
  private hunter: HunterAgent;
  private coordinator: CoordinatorAgent;

  private context: SharedContext;
  private callbacks: OrchestratorCallbacks;
  private tasks: Map<string, AgentTask> = new Map();
  private isProcessing = false;

  constructor(config: AIConfig, callbacks: OrchestratorCallbacks = {}) {
    const apiKey = config.openaiKey || '';

    this.extractor = new ExtractorAgent(apiKey);
    this.eyes = new EyesAgent(apiKey);
    this.brain = new BrainAgent(apiKey);
    this.hunter = new HunterAgent(apiKey);
    this.coordinator = new CoordinatorAgent(apiKey);

    this.callbacks = callbacks;
    this.context = this.createEmptyContext();
  }

  /**
   * Initialize context for a new case
   */
  initCase(caseId: string, targetName: string): void {
    this.context = this.createEmptyContext();
    this.context.caseId = caseId;
    this.context.targetName = targetName;
    this.tasks.clear();

    this.addMessage('coordinator', 'analysis',
      `Investigation initialized for ${targetName}. Upload documents, photos, or provide information to begin.`
    );
  }

  /**
   * Get current context
   */
  getContext(): SharedContext {
    return this.context;
  }

  /**
   * Process a document (PDF text, skip trace report, etc.)
   */
  async processDocument(text: string, sourceName: string): Promise<void> {
    const taskId = this.createTask('extractor', 'extract', { text, sourceName });

    this.notify('extractor', 'running', `Processing ${sourceName}...`);
    this.addMessage('coordinator', 'analysis',
      `📄 Processing document: ${sourceName}`
    );

    try {
      const result = await this.extractor.extractFromText(text, sourceName);

      if (result.success && result.data) {
        this.mergeExtractedData(result.data);
        this.completeTask(taskId, result.data);

        const summary = this.summarizeExtraction(result.data);
        this.addMessage('extractor', 'finding', summary);

        // Trigger BRAIN analysis if we have enough data
        await this.triggerBrainAnalysis();
      } else {
        this.failTask(taskId, result.error || 'Extraction failed');
        this.addMessage('extractor', 'alert',
          `⚠️ Could not extract data from ${sourceName}: ${result.error}`
        );
      }

    } catch (error: any) {
      this.failTask(taskId, error.message);
      this.callbacks.onError?.('extractor', error.message);
    }
  }

  /**
   * Process an image
   */
  async processImage(imageBase64: string, imageName: string, context?: string): Promise<void> {
    const taskId = this.createTask('eyes', 'analyze', { imageName });

    this.notify('eyes', 'running', `Analyzing ${imageName}...`);
    this.addMessage('coordinator', 'analysis',
      `🖼️ Analyzing image: ${imageName}`
    );

    try {
      const result = await this.eyes.analyzeImage(imageBase64, imageName, context);

      if (result.success && result.analysis) {
        // Store analysis
        this.context.visualAnalysis.push(result.analysis);
        this.completeTask(taskId, result.analysis);

        // Match against known addresses
        const knownAddresses = this.context.extractedData.addresses.map(a => a.fullAddress);
        if (knownAddresses.length > 0) {
          const matches = await this.eyes.matchAgainstAddresses(result.analysis, knownAddresses);
          result.analysis.matchedAddresses = matches;
        }

        // Summarize findings
        const cluesSummary = result.analysis.clues
          .filter(c => c.confidence >= 50)
          .slice(0, 5)
          .map(c => `• ${c.type}: ${c.description}`)
          .join('\n');

        const locationSummary = result.analysis.possibleLocations
          .slice(0, 3)
          .map(l => `• ${l.description} (${l.confidence}%)`)
          .join('\n');

        this.addMessage('eyes', 'finding',
          `📸 Image Analysis: ${imageName}\n\nClues found:\n${cluesSummary || 'None significant'}\n\nPossible locations:\n${locationSummary || 'Unable to determine'}`
        );

        // Trigger BRAIN analysis
        await this.triggerBrainAnalysis();

      } else {
        this.failTask(taskId, result.error || 'Analysis failed');
        this.addMessage('eyes', 'alert',
          `⚠️ Could not analyze ${imageName}: ${result.error}`
        );
      }

    } catch (error: any) {
      this.failTask(taskId, error.message);
      this.callbacks.onError?.('eyes', error.message);
    }
  }

  /**
   * Check if image contains target face
   */
  async checkForTargetFace(imageBase64: string, targetDescription?: string): Promise<{
    hasFace: boolean;
    couldBeTarget: boolean;
    description?: string;
    confidence: number;
  }> {
    return this.eyes.detectFace(imageBase64, targetDescription);
  }

  /**
   * Generate web search strategy
   */
  async generateSearchStrategy(): Promise<{
    queries: any[];
    profiles: any[];
    records: any[];
  }> {
    const target = this.context.extractedData.subjects.find(s => s.isTarget);
    const relatives = this.context.extractedData.relatives;
    const addresses = this.context.extractedData.addresses;

    if (!target) {
      return { queries: [], profiles: [], records: [] };
    }

    this.notify('hunter', 'running', 'Generating search strategy...');

    const strategy = await this.hunter.generateSearchStrategy(
      target.name,
      target.aliases || [],
      relatives.map(r => ({ name: r.name, relationship: r.relationship })),
      addresses.map(a => a.city || a.state || '').filter(Boolean)
    );

    const profiles = this.hunter.generateProfileUrls(
      target.name,
      strategy.usernameVariations
    );

    const state = addresses[0]?.state;
    const records = this.hunter.generatePublicRecordUrls(target.name, state);

    this.addMessage('hunter', 'finding',
      `🔍 Search Strategy Generated\n\n` +
      `Queries: ${strategy.searchQueries.length}\n` +
      `Profile checks: ${profiles.length} platforms\n` +
      `Record searches: ${records.length}\n\n` +
      `Top priority searches:\n` +
      strategy.searchQueries
        .filter((q: any) => q.priority === 'high')
        .slice(0, 5)
        .map((q: any) => `• [${q.platform}] ${q.query}`)
        .join('\n')
    );

    return {
      queries: strategy.searchQueries,
      profiles,
      records,
    };
  }

  /**
   * Process web findings (user reports what they found)
   */
  async processWebFinding(finding: Partial<WebFinding>): Promise<void> {
    const webFinding: WebFinding = {
      source: finding.source || 'other',
      title: finding.title || 'Web Finding',
      content: finding.content || '',
      relevance: finding.relevance || 50,
      platform: finding.platform,
      url: finding.url,
      date: finding.date,
      linkedPerson: finding.linkedPerson,
      locationMentioned: finding.locationMentioned,
    };

    this.context.webFindings.push(webFinding);

    // If there's substantial content, analyze it
    if (finding.content && finding.content.length > 100) {
      const analysis = await this.hunter.analyzeFindings(
        finding.content,
        finding.source || 'web',
        this.context.targetName
      );

      if (analysis.success) {
        // Add any location hints to our findings
        for (const hint of analysis.locationHints) {
          this.addMessage('hunter', 'finding',
            `📍 Location hint from web: ${hint}`
          );
        }

        // Trigger brain analysis
        await this.triggerBrainAnalysis();
      }
    }
  }

  /**
   * Ask a question about the investigation
   */
  async askQuestion(question: string): Promise<string> {
    // Check for user feedback that should update rankings
    this.processUserFeedback(question);

    const result = await this.coordinator.answerQuestion(question, this.context);

    this.addMessage('coordinator', 'analysis', result.answer);

    if (result.followUpSuggestions.length > 0) {
      this.addMessage('coordinator', 'recommendation',
        `You might also want to ask:\n${result.followUpSuggestions.map(q => `• ${q}`).join('\n')}`
      );
    }

    return result.answer;
  }

  /**
   * Process user feedback to update rankings
   * Detects phrases like "nogo", "caught at", "bad address", etc.
   */
  private processUserFeedback(message: string): void {
    const lower = message.toLowerCase();

    // Detect "nogo" or "no good" patterns
    const nogoPatterns = [
      /(\w+(?:\s+\w+)*)\s+(?:is\s+)?(?:nogo|no\s*go|no\s*good|bad|dead\s*end|didn'?t\s*work)/gi,
      /(?:nogo|no\s*go|no\s*good)\s+(?:on|at|for)?\s*(\w+(?:\s+\w+)*)/gi,
    ];

    for (const pattern of nogoPatterns) {
      const matches = lower.matchAll(pattern);
      for (const match of matches) {
        const location = match[1]?.trim();
        if (location && location.length > 3) {
          // Mark this location as bad in context
          this.context.topLocations = this.context.topLocations.map(loc => {
            if (loc.address.toLowerCase().includes(location)) {
              return { ...loc, probability: 0, reasoning: [...loc.reasoning, 'USER MARKED AS NO-GO'] };
            }
            return loc;
          }).filter(loc => loc.probability > 0);

          this.callbacks.onLocationUpdate?.(this.context.topLocations);
        }
      }
    }

    // Detect "caught at" or "found at" patterns - these CONFIRM a location
    const confirmedPatterns = [
      /(?:caught|found|spotted|seen|located)\s+(?:her|him|them|target)?\s*(?:at|on)?\s*(.+)/gi,
    ];

    for (const pattern of confirmedPatterns) {
      const matches = lower.matchAll(pattern);
      for (const match of matches) {
        const location = match[1]?.trim();
        if (location && location.length > 5) {
          // Boost this location to top
          this.context.topLocations = this.context.topLocations.map(loc => {
            if (loc.address.toLowerCase().includes(location)) {
              return { ...loc, probability: 100, reasoning: ['USER CONFIRMED - TARGET WAS HERE', ...loc.reasoning] };
            }
            return loc;
          });

          // Re-sort
          this.context.topLocations.sort((a, b) => b.probability - a.probability);
          this.callbacks.onLocationUpdate?.(this.context.topLocations);
        }
      }
    }
  }

  /**
   * Get chat response
   */
  async chat(message: string): Promise<string> {
    const response = await this.coordinator.generateChatResponse(
      message,
      this.context,
      this.context.messages.slice(-10)
    );

    this.addMessage('coordinator', 'analysis', response);

    return response;
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<{
    summary: string;
    findings: string[];
    topLeads: { location: string; probability: number; why: string }[];
    nextSteps: string[];
    questions: string[];
  }> {
    return this.coordinator.generateStatusUpdate(this.context);
  }

  /**
   * Generate full report
   */
  async generateReport(): Promise<string> {
    return this.coordinator.generateReport(this.context);
  }

  /**
   * Trigger BRAIN analysis (cross-reference all data)
   */
  private async triggerBrainAnalysis(): Promise<void> {
    // Don't run if we don't have enough data
    const hasData =
      this.context.extractedData.addresses.length > 0 ||
      this.context.visualAnalysis.length > 0 ||
      this.context.webFindings.length > 0;

    if (!hasData || this.isProcessing) return;

    this.isProcessing = true;
    const taskId = this.createTask('brain', 'analyze', {});

    this.notify('brain', 'running', 'Cross-referencing all data...');

    try {
      const result = await this.brain.analyze(this.context);

      if (result.success) {
        // Update context with BRAIN's analysis
        this.context.crossReferences = result.crossReferences;
        this.context.topLocations = result.topLocations;

        // Calculate overall confidence
        if (result.topLocations.length > 0) {
          this.context.confidence = Math.round(
            result.topLocations.reduce((sum, l) => sum + l.probability, 0) / result.topLocations.length
          );
        }

        // Add any questions
        for (const q of result.questions) {
          if (!this.context.pendingQuestions.some(pq => pq.question === q.question)) {
            this.context.pendingQuestions.push(q);
            this.callbacks.onQuestion?.(q);
          }
        }

        this.completeTask(taskId, result);

        // Notify about location updates
        this.callbacks.onLocationUpdate?.(result.topLocations);
        this.callbacks.onConfidenceUpdate?.(this.context.confidence);

        // Generate summary message
        if (result.topLocations.length > 0) {
          const topLocation = result.topLocations[0];
          this.addMessage('brain', 'finding',
            `🧠 Analysis Complete\n\n` +
            `Top Location: ${topLocation.address}\n` +
            `Probability: ${topLocation.probability}%\n` +
            `Type: ${topLocation.type}\n` +
            `Reasoning: ${topLocation.reasoning.slice(0, 2).join('; ')}\n\n` +
            `Overall confidence: ${this.context.confidence}%`
          );
        }

        // Report any warnings
        if (result.warnings.length > 0) {
          this.addMessage('brain', 'alert',
            `⚠️ Warnings:\n${result.warnings.map(w => `• ${w}`).join('\n')}`
          );
        }

      } else {
        this.failTask(taskId, result.error || 'Analysis failed');
      }

    } catch (error: any) {
      this.failTask(taskId, error.message);
      this.callbacks.onError?.('brain', error.message);
    }

    this.isProcessing = false;
  }

  /**
   * Merge extracted data into context
   */
  private mergeExtractedData(newData: Partial<ExtractedData>): void {
    const existing = this.context.extractedData;

    // Merge arrays, avoiding duplicates
    const mergeArray = <T extends { [key: string]: any }>(
      existing: T[],
      incoming: T[] | undefined,
      keyFn: (item: T) => string
    ): T[] => {
      if (!incoming) return existing;
      const existingKeys = new Set(existing.map(keyFn));
      const newItems = incoming.filter(item => !existingKeys.has(keyFn(item)));
      return [...existing, ...newItems];
    };

    this.context.extractedData = {
      ...existing,
      subjects: mergeArray(existing.subjects, newData.subjects, s => s.name.toLowerCase()),
      addresses: mergeArray(existing.addresses, newData.addresses, a => a.fullAddress.toLowerCase()),
      phones: mergeArray(existing.phones, newData.phones, p => p.number.replace(/\D/g, '')),
      vehicles: mergeArray(existing.vehicles, newData.vehicles, v => v.description.toLowerCase()),
      relatives: mergeArray(existing.relatives, newData.relatives, r => r.name.toLowerCase()),
      employers: mergeArray(existing.employers, newData.employers, e => e.name.toLowerCase()),
      socialMedia: mergeArray(existing.socialMedia, newData.socialMedia, s => `${s.platform}:${s.username}`),
    };
  }

  /**
   * Summarize extracted data
   */
  private summarizeExtraction(data: Partial<ExtractedData>): string {
    const parts: string[] = [];

    if (data.subjects?.length) {
      const target = data.subjects.find(s => s.isTarget);
      if (target) {
        parts.push(`Target: ${target.name}${target.aliases?.length ? ` (aliases: ${target.aliases.join(', ')})` : ''}`);
      }
    }

    if (data.addresses?.length) {
      parts.push(`Found ${data.addresses.length} address(es)`);
      const current = data.addresses.find(a => a.type === 'current');
      if (current) {
        parts.push(`Current: ${current.fullAddress}`);
      }
    }

    if (data.phones?.length) {
      const active = data.phones.filter(p => p.isActive);
      parts.push(`Found ${data.phones.length} phone(s)${active.length ? ` (${active.length} active)` : ''}`);
    }

    if (data.relatives?.length) {
      parts.push(`Found ${data.relatives.length} relative(s)/associate(s)`);
    }

    if (data.vehicles?.length) {
      parts.push(`Found ${data.vehicles.length} vehicle(s)`);
    }

    return `📋 Extraction Complete\n\n${parts.join('\n')}`;
  }

  /**
   * Create empty context
   */
  private createEmptyContext(): SharedContext {
    return {
      caseId: '',
      targetName: '',
      extractedData: {
        subjects: [],
        addresses: [],
        phones: [],
        vehicles: [],
        relatives: [],
        employers: [],
        socialMedia: [],
        rawSources: [],
      },
      visualAnalysis: [],
      webFindings: [],
      crossReferences: [],
      topLocations: [],
      actionPlan: [],
      confidence: 0,
      messages: [],
      pendingQuestions: [],
    };
  }

  /**
   * Add message to context
   */
  private addMessage(
    agent: string,
    type: 'analysis' | 'finding' | 'question' | 'recommendation' | 'alert',
    content: string
  ): void {
    const message: AgentMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agent: agent as any,
      timestamp: new Date(),
      type,
      content,
    };

    this.context.messages.push(message);
    this.callbacks.onMessage?.(message);
  }

  /**
   * Task management
   */
  private createTask(agent: string, type: string, input: any): string {
    const id = `${agent}-${Date.now()}`;
    const task: AgentTask = {
      id,
      agent: agent as any,
      type,
      input,
      status: 'pending',
      startedAt: new Date(),
    };
    this.tasks.set(id, task);
    return id;
  }

  private completeTask(id: string, result: any): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();
      this.notify(task.agent, 'complete', 'Done');
    }
  }

  private failTask(id: string, error: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = 'failed';
      task.error = error;
      task.completedAt = new Date();
      this.notify(task.agent, 'error', error);
    }
  }

  private notify(agent: string, status: string, detail: string): void {
    this.callbacks.onAgentActivity?.(agent, status, detail);
  }
}

// Export singleton factory
let orchestratorInstance: AISquadOrchestrator | null = null;

export function getOrchestrator(
  config?: AIConfig,
  callbacks?: OrchestratorCallbacks
): AISquadOrchestrator {
  if (!orchestratorInstance && config) {
    orchestratorInstance = new AISquadOrchestrator(config, callbacks);
  }
  return orchestratorInstance!;
}

export function resetOrchestrator(): void {
  orchestratorInstance = null;
}
