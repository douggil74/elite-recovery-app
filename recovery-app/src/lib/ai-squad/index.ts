/**
 * AI Squad - Multi-AI Fugitive Recovery Investigation System
 *
 * This module provides a coordinated multi-AI system for analyzing
 * documents, photos, and web data to locate fugitives.
 *
 * AGENTS:
 * - EXTRACTOR: Document parsing (GPT-4o-mini)
 * - EYES: Visual/geolocation analysis (GPT-4o Vision)
 * - BRAIN: Cross-reference & reasoning (GPT-4o)
 * - HUNTER: Web/social media search (GPT-4o-mini)
 * - COORDINATOR: Orchestration & communication (GPT-4o)
 */

// Main orchestrator
export {
  AISquadOrchestrator,
  getOrchestrator,
  resetOrchestrator,
  type OrchestratorCallbacks
} from './orchestrator';

// Individual agents (for direct access if needed)
export { ExtractorAgent } from './agents/extractor';
export { EyesAgent } from './agents/eyes';
export { BrainAgent } from './agents/brain';
export { HunterAgent } from './agents/hunter';
export { CoordinatorAgent } from './agents/coordinator';

// Types
export type {
  AgentRole,
  SharedContext,
  ExtractedData,
  SubjectInfo,
  AddressInfo,
  PhoneInfo,
  VehicleInfo,
  RelativeInfo,
  EmployerInfo,
  SocialMediaInfo,
  SourceDocument,
  VisualAnalysis,
  VisualClue,
  PossibleLocation,
  AddressMatch,
  WebFinding,
  CrossReference,
  RankedLocation,
  ActionItem,
  AgentMessage,
  SmartQuestion,
  AgentTask,
  AIConfig,
} from './types';
