/**
 * React Hook for Learning System Integration
 *
 * Provides easy access to learning system functions from React components.
 */

import { useCallback, useEffect, useState } from 'react';
import learningSystem, {
  LearningCategory,
  LearningEntry,
  ImpactLevel,
  logPhotoSuccess,
  logOsintSuccess,
  logFaceMatchSuccess,
  logPromptIssue,
  logDiscoveredPattern,
} from '../lib/learning-system';

export interface UseLearningSystemReturn {
  // State
  initialized: boolean;
  recentLearnings: LearningEntry[];

  // Core logging functions
  logSuccess: (
    category: LearningCategory,
    title: string,
    description: string,
    impact?: ImpactLevel
  ) => Promise<void>;
  logFailure: (
    category: LearningCategory,
    title: string,
    description: string
  ) => Promise<void>;
  logPattern: (
    category: LearningCategory,
    title: string,
    description: string,
    evidence?: string
  ) => Promise<void>;

  // Specialized logging
  logPhotoIntel: typeof logPhotoSuccess;
  logOsintResult: typeof logOsintSuccess;
  logFaceMatch: typeof logFaceMatchSuccess;
  logPromptProblem: typeof logPromptIssue;
  logNewPattern: typeof logDiscoveredPattern;

  // Track prompt usage
  trackPrompt: (
    promptId: string,
    version: string,
    success: boolean,
    quality: number,
    issue?: string
  ) => Promise<void>;

  // Track OSINT tool usage
  trackOsintTool: (
    tool: string,
    resultCount: number,
    patterns?: string[]
  ) => Promise<void>;

  // Data access
  getReport: () => string;
  exportData: () => ReturnType<typeof learningSystem.exportData>;
  refreshLearnings: () => void;
}

export function useLearningSystem(): UseLearningSystemReturn {
  const [initialized, setInitialized] = useState(false);
  const [recentLearnings, setRecentLearnings] = useState<LearningEntry[]>([]);

  // Initialize learning system on mount
  useEffect(() => {
    async function init() {
      await learningSystem.initialize();
      setInitialized(true);
      setRecentLearnings(learningSystem.getRecentLearnings(5));
    }
    init();
  }, []);

  // Refresh learnings from storage
  const refreshLearnings = useCallback(() => {
    setRecentLearnings(learningSystem.getRecentLearnings(5));
  }, []);

  // Core logging with auto-refresh
  const logSuccess = useCallback(
    async (
      category: LearningCategory,
      title: string,
      description: string,
      impact: ImpactLevel = 'MEDIUM'
    ) => {
      await learningSystem.logSuccess(category, title, description, impact);
      refreshLearnings();
    },
    [refreshLearnings]
  );

  const logFailure = useCallback(
    async (category: LearningCategory, title: string, description: string) => {
      await learningSystem.logFailure(category, title, description);
      refreshLearnings();
    },
    [refreshLearnings]
  );

  const logPattern = useCallback(
    async (
      category: LearningCategory,
      title: string,
      description: string,
      evidence?: string
    ) => {
      await learningSystem.logPattern(category, title, description, evidence);
      refreshLearnings();
    },
    [refreshLearnings]
  );

  // Prompt tracking
  const trackPrompt = useCallback(
    async (
      promptId: string,
      version: string,
      success: boolean,
      quality: number,
      issue?: string
    ) => {
      await learningSystem.trackPromptUse(promptId, version, success, quality, issue);
    },
    []
  );

  // OSINT tool tracking
  const trackOsintTool = useCallback(
    async (tool: string, resultCount: number, patterns?: string[]) => {
      await learningSystem.trackOsintTool(tool, resultCount, patterns);
    },
    []
  );

  // Data access
  const getReport = useCallback(() => {
    return learningSystem.generateReport();
  }, []);

  const exportData = useCallback(() => {
    return learningSystem.exportData();
  }, []);

  return {
    initialized,
    recentLearnings,
    logSuccess,
    logFailure,
    logPattern,
    logPhotoIntel: logPhotoSuccess,
    logOsintResult: logOsintSuccess,
    logFaceMatch: logFaceMatchSuccess,
    logPromptProblem: logPromptIssue,
    logNewPattern: logDiscoveredPattern,
    trackPrompt,
    trackOsintTool,
    getReport,
    exportData,
    refreshLearnings,
  };
}

export default useLearningSystem;
