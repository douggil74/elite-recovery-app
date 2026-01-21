/**
 * Elite Recovery AI Learning System
 *
 * This module tracks what works and what doesn't in the AI system,
 * logging insights for continuous improvement.
 *
 * Knowledge base files:
 * - LEARNING.md - Main learning log
 * - AI-PROMPTS.md - Effective prompts library
 * - OSINT-TECHNIQUES.md - OSINT methods encyclopedia
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  LEARNINGS: 'elite_recovery_learnings',
  PROMPT_METRICS: 'elite_recovery_prompt_metrics',
  OSINT_STATS: 'elite_recovery_osint_stats',
  SESSION_LOG: 'elite_recovery_session_log',
};

// Learning categories
export type LearningCategory =
  | 'photo_intelligence'
  | 'face_matching'
  | 'osint_tools'
  | 'chat_ai'
  | 'document_analysis'
  | 'location_intel'
  | 'vehicle_intel';

// Impact levels
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// Learning entry structure
export interface LearningEntry {
  id: string;
  timestamp: string;
  category: LearningCategory;
  type: 'success' | 'failure' | 'pattern' | 'insight';
  title: string;
  description: string;
  evidence?: string;
  impact: ImpactLevel;
  caseId?: string;
  metadata?: Record<string, unknown>;
}

// Prompt performance tracking
export interface PromptMetrics {
  promptId: string;
  promptVersion: string;
  uses: number;
  successes: number;
  failures: number;
  avgResponseQuality: number; // 0-100
  lastUsed: string;
  issues: string[];
}

// OSINT tool statistics
export interface OsintToolStats {
  tool: string;
  searches: number;
  resultsFound: number;
  avgResultCount: number;
  successRate: number;
  lastUsed: string;
  commonPatterns: string[];
}

/**
 * Learning System - Tracks and logs AI learnings
 */
class LearningSystem {
  private learnings: LearningEntry[] = [];
  private promptMetrics: Map<string, PromptMetrics> = new Map();
  private osintStats: Map<string, OsintToolStats> = new Map();
  private initialized = false;

  /**
   * Initialize the learning system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load existing learnings from storage
      const storedLearnings = await AsyncStorage.getItem(STORAGE_KEYS.LEARNINGS);
      if (storedLearnings) {
        this.learnings = JSON.parse(storedLearnings);
      }

      const storedPromptMetrics = await AsyncStorage.getItem(STORAGE_KEYS.PROMPT_METRICS);
      if (storedPromptMetrics) {
        const parsed = JSON.parse(storedPromptMetrics);
        this.promptMetrics = new Map(Object.entries(parsed));
      }

      const storedOsintStats = await AsyncStorage.getItem(STORAGE_KEYS.OSINT_STATS);
      if (storedOsintStats) {
        const parsed = JSON.parse(storedOsintStats);
        this.osintStats = new Map(Object.entries(parsed));
      }

      this.initialized = true;
      console.log('[LearningSystem] Initialized with', this.learnings.length, 'learnings');
    } catch (error) {
      console.error('[LearningSystem] Failed to initialize:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Log a new learning
   */
  async logLearning(entry: Omit<LearningEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.initialize();

    const learning: LearningEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    this.learnings.push(learning);
    await this.saveLearnings();

    console.log('[LearningSystem] Logged:', learning.title);
    return learning.id;
  }

  /**
   * Log a successful technique
   */
  async logSuccess(
    category: LearningCategory,
    title: string,
    description: string,
    impact: ImpactLevel = 'MEDIUM',
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logLearning({
      category,
      type: 'success',
      title,
      description,
      impact,
      metadata,
    });
  }

  /**
   * Log a failed approach
   */
  async logFailure(
    category: LearningCategory,
    title: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.logLearning({
      category,
      type: 'failure',
      title,
      description,
      impact: 'MEDIUM',
      metadata,
    });
  }

  /**
   * Log a discovered pattern
   */
  async logPattern(
    category: LearningCategory,
    title: string,
    description: string,
    evidence?: string
  ): Promise<string> {
    return this.logLearning({
      category,
      type: 'pattern',
      title,
      description,
      evidence,
      impact: 'MEDIUM',
    });
  }

  /**
   * Track prompt performance
   */
  async trackPromptUse(
    promptId: string,
    version: string,
    success: boolean,
    quality: number, // 0-100
    issue?: string
  ): Promise<void> {
    await this.initialize();

    const existing = this.promptMetrics.get(promptId) || {
      promptId,
      promptVersion: version,
      uses: 0,
      successes: 0,
      failures: 0,
      avgResponseQuality: 0,
      lastUsed: '',
      issues: [],
    };

    existing.uses++;
    if (success) {
      existing.successes++;
    } else {
      existing.failures++;
      if (issue) {
        existing.issues.push(issue);
      }
    }

    // Update rolling average
    existing.avgResponseQuality =
      (existing.avgResponseQuality * (existing.uses - 1) + quality) / existing.uses;
    existing.lastUsed = new Date().toISOString();
    existing.promptVersion = version;

    this.promptMetrics.set(promptId, existing);
    await this.savePromptMetrics();
  }

  /**
   * Track OSINT tool usage
   */
  async trackOsintTool(
    tool: string,
    resultCount: number,
    patterns?: string[]
  ): Promise<void> {
    await this.initialize();

    const existing = this.osintStats.get(tool) || {
      tool,
      searches: 0,
      resultsFound: 0,
      avgResultCount: 0,
      successRate: 0,
      lastUsed: '',
      commonPatterns: [],
    };

    existing.searches++;
    existing.resultsFound += resultCount > 0 ? 1 : 0;
    existing.avgResultCount =
      (existing.avgResultCount * (existing.searches - 1) + resultCount) / existing.searches;
    existing.successRate = (existing.resultsFound / existing.searches) * 100;
    existing.lastUsed = new Date().toISOString();

    if (patterns) {
      patterns.forEach(p => {
        if (!existing.commonPatterns.includes(p)) {
          existing.commonPatterns.push(p);
        }
      });
    }

    this.osintStats.set(tool, existing);
    await this.saveOsintStats();
  }

  /**
   * Get learnings by category
   */
  getLearningsByCategory(category: LearningCategory): LearningEntry[] {
    return this.learnings.filter(l => l.category === category);
  }

  /**
   * Get recent learnings
   */
  getRecentLearnings(limit = 10): LearningEntry[] {
    return [...this.learnings]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get high-impact learnings
   */
  getHighImpactLearnings(): LearningEntry[] {
    return this.learnings.filter(l => l.impact === 'HIGH');
  }

  /**
   * Get prompt performance summary
   */
  getPromptPerformance(promptId: string): PromptMetrics | undefined {
    return this.promptMetrics.get(promptId);
  }

  /**
   * Get OSINT tool effectiveness
   */
  getOsintEffectiveness(): OsintToolStats[] {
    return Array.from(this.osintStats.values())
      .sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Generate learning report for export
   */
  generateReport(): string {
    const successCount = this.learnings.filter(l => l.type === 'success').length;
    const failureCount = this.learnings.filter(l => l.type === 'failure').length;
    const patternCount = this.learnings.filter(l => l.type === 'pattern').length;

    const report = `
# Elite Recovery Learning Report
Generated: ${new Date().toISOString()}

## Summary
- Total Learnings: ${this.learnings.length}
- Successes: ${successCount}
- Failures: ${failureCount}
- Patterns Discovered: ${patternCount}

## High Impact Learnings
${this.getHighImpactLearnings()
  .map(l => `- [${l.category}] ${l.title}: ${l.description}`)
  .join('\n')}

## Prompt Performance
${Array.from(this.promptMetrics.values())
  .map(p => `- ${p.promptId} v${p.promptVersion}: ${p.successRate}% success, ${p.avgResponseQuality.toFixed(1)} avg quality`)
  .join('\n')}

## OSINT Tool Effectiveness
${Array.from(this.osintStats.values())
  .map(o => `- ${o.tool}: ${o.successRate.toFixed(1)}% success rate, ${o.avgResultCount.toFixed(1)} avg results`)
  .join('\n')}

## Recent Learnings
${this.getRecentLearnings(20)
  .map(l => `- [${l.timestamp.split('T')[0]}] ${l.type.toUpperCase()}: ${l.title}`)
  .join('\n')}
`;

    return report;
  }

  /**
   * Export all data as JSON
   */
  exportData(): {
    learnings: LearningEntry[];
    promptMetrics: Record<string, PromptMetrics>;
    osintStats: Record<string, OsintToolStats>;
  } {
    return {
      learnings: this.learnings,
      promptMetrics: Object.fromEntries(this.promptMetrics),
      osintStats: Object.fromEntries(this.osintStats),
    };
  }

  /**
   * Clear all learnings (use with caution)
   */
  async clearAll(): Promise<void> {
    this.learnings = [];
    this.promptMetrics.clear();
    this.osintStats.clear();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.LEARNINGS,
      STORAGE_KEYS.PROMPT_METRICS,
      STORAGE_KEYS.OSINT_STATS,
    ]);
  }

  // Private methods

  private generateId(): string {
    return `learn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveLearnings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LEARNINGS, JSON.stringify(this.learnings));
    } catch (error) {
      console.error('[LearningSystem] Failed to save learnings:', error);
    }
  }

  private async savePromptMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROMPT_METRICS,
        JSON.stringify(Object.fromEntries(this.promptMetrics))
      );
    } catch (error) {
      console.error('[LearningSystem] Failed to save prompt metrics:', error);
    }
  }

  private async saveOsintStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.OSINT_STATS,
        JSON.stringify(Object.fromEntries(this.osintStats))
      );
    } catch (error) {
      console.error('[LearningSystem] Failed to save OSINT stats:', error);
    }
  }
}

// Singleton instance
export const learningSystem = new LearningSystem();

// Convenience functions for common logging patterns

/**
 * Log when photo analysis finds useful information
 */
export async function logPhotoSuccess(
  description: string,
  intelType: 'address' | 'vehicle' | 'person' | 'location' | 'business',
  caseId?: string
): Promise<void> {
  await learningSystem.logSuccess(
    'photo_intelligence',
    `Photo revealed ${intelType}`,
    description,
    'HIGH',
    { intelType, caseId }
  );
}

/**
 * Log when OSINT search finds results
 */
export async function logOsintSuccess(
  tool: string,
  query: string,
  resultCount: number,
  usefulFindings?: string[]
): Promise<void> {
  await learningSystem.trackOsintTool(tool, resultCount);

  if (resultCount > 0) {
    await learningSystem.logSuccess(
      'osint_tools',
      `${tool} found ${resultCount} results`,
      `Query: "${query}" yielded ${usefulFindings?.join(', ') || 'results'}`,
      resultCount >= 5 ? 'HIGH' : 'MEDIUM',
      { tool, query, resultCount }
    );
  }
}

/**
 * Log when face matching succeeds
 */
export async function logFaceMatchSuccess(
  matchScore: number,
  verdict: string,
  caseId?: string
): Promise<void> {
  await learningSystem.logSuccess(
    'face_matching',
    `Face match: ${verdict} (${matchScore}%)`,
    `Achieved ${matchScore}% match confidence`,
    matchScore >= 85 ? 'HIGH' : 'MEDIUM',
    { matchScore, verdict, caseId }
  );
}

/**
 * Log when a prompt produces poor results
 */
export async function logPromptIssue(
  promptId: string,
  issue: string,
  context?: string
): Promise<void> {
  await learningSystem.trackPromptUse(promptId, 'current', false, 30, issue);
  await learningSystem.logFailure(
    'chat_ai',
    `Prompt issue: ${promptId}`,
    `${issue}. Context: ${context || 'N/A'}`,
    { promptId, issue }
  );
}

/**
 * Log a discovered pattern
 */
export async function logDiscoveredPattern(
  category: LearningCategory,
  pattern: string,
  evidence: string
): Promise<void> {
  await learningSystem.logPattern(category, pattern, `Observed: ${pattern}`, evidence);
}

export default learningSystem;
