/**
 * AI Squad - Type Definitions
 * Multi-AI Investigation System
 */

// Agent types
export type AgentRole = 'extractor' | 'eyes' | 'brain' | 'hunter' | 'coordinator';

// Shared context that all agents can read/write
export interface SharedContext {
  caseId: string;
  targetName: string;

  // Data collected by agents
  extractedData: ExtractedData;
  visualAnalysis: VisualAnalysis[];
  webFindings: WebFinding[];
  crossReferences: CrossReference[];

  // Final synthesis
  topLocations: RankedLocation[];
  actionPlan: ActionItem[];
  confidence: number;

  // Conversation
  messages: AgentMessage[];
  pendingQuestions: SmartQuestion[];
}

export interface ExtractedData {
  subjects: SubjectInfo[];
  addresses: AddressInfo[];
  phones: PhoneInfo[];
  vehicles: VehicleInfo[];
  relatives: RelativeInfo[];
  employers: EmployerInfo[];
  socialMedia: SocialMediaInfo[];
  rawSources: SourceDocument[];
}

export interface SubjectInfo {
  name: string;
  aliases: string[];
  dob?: string;
  ssn?: string; // last 4 only
  description?: string;
  isTarget: boolean;
}

export interface AddressInfo {
  fullAddress: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  type: 'current' | 'previous' | 'work' | 'family' | 'unknown';
  dateRange?: { from?: string; to?: string };
  source: string;
  confidence: number;
  linkedTo?: string[]; // person names
}

export interface PhoneInfo {
  number: string;
  type: 'mobile' | 'landline' | 'work' | 'unknown';
  carrier?: string;
  isActive?: boolean;
  source: string;
  linkedTo?: string[];
}

export interface VehicleInfo {
  description: string;
  year?: string;
  make?: string;
  model?: string;
  color?: string;
  plate?: string;
  plateState?: string;
  vin?: string;
  registeredTo?: string;
  registeredAddress?: string;
  source: string;
}

export interface RelativeInfo {
  name: string;
  relationship: string;
  address?: string;
  phone?: string;
  confidence: number;
  source: string;
}

export interface EmployerInfo {
  name: string;
  address?: string;
  phone?: string;
  position?: string;
  dateRange?: { from?: string; to?: string };
  isCurrent?: boolean;
  source: string;
}

export interface SocialMediaInfo {
  platform: string;
  username?: string;
  profileUrl?: string;
  lastActive?: string;
  location?: string;
  source: string;
}

export interface SourceDocument {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'web';
  uploadedAt: Date;
  processedBy: AgentRole[];
}

// Visual analysis from EYES agent
export interface VisualAnalysis {
  imageId: string;
  imageName: string;
  clues: VisualClue[];
  possibleLocations: PossibleLocation[];
  matchedAddresses: AddressMatch[];
  analysis: string;
}

export interface VisualClue {
  type: 'sign' | 'landmark' | 'building' | 'vehicle' | 'vegetation' | 'weather' | 'text' | 'person' | 'other';
  description: string;
  confidence: number;
  locationHint?: string;
}

export interface PossibleLocation {
  description: string;
  confidence: number;
  reasoning: string;
  coordinates?: { lat: number; lng: number };
  searchQuery?: string;
}

export interface AddressMatch {
  address: string;
  matchScore: number;
  reasoning: string;
}

// Web findings from HUNTER agent
export interface WebFinding {
  source: 'social_media' | 'public_records' | 'news' | 'images' | 'other';
  platform?: string;
  url?: string;
  title: string;
  content: string;
  date?: string;
  relevance: number;
  linkedPerson?: string;
  locationMentioned?: string;
}

// Cross-references from BRAIN agent
export interface CrossReference {
  type: 'address_match' | 'phone_match' | 'person_connection' | 'vehicle_sighting' | 'pattern' | 'timeline';
  description: string;
  confidence: number;
  evidence: string[];
  sources: string[];
  implication: string;
}

// Final ranked locations
export interface RankedLocation {
  rank: number;
  address: string;
  probability: number;
  type: 'target_residence' | 'work' | 'family' | 'associate' | 'frequent_location';
  reasoning: string[];
  sources: string[];
  bestTime?: string;
  whoMightBeThere?: string[];
  risks?: string[];
  lastVerified?: string;
}

// Action items
export interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  location?: string;
  timing?: string;
  cost: 'free' | 'cheap' | 'moderate' | 'expensive';
  expectedOutcome: string;
}

// Agent messages
export interface AgentMessage {
  id: string;
  agent: AgentRole;
  timestamp: Date;
  type: 'analysis' | 'finding' | 'question' | 'recommendation' | 'alert';
  content: string;
  data?: any;
}

// Smart questions agents can ask
export interface SmartQuestion {
  agent: AgentRole;
  question: string;
  reason: string;
  expectedDataType?: string;
  priority: 'high' | 'medium' | 'low';
}

// Agent task
export interface AgentTask {
  id: string;
  agent: AgentRole;
  type: string;
  input: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// API Keys configuration
export interface AIConfig {
  openaiKey?: string;
  googleMapsKey?: string;
  googleSearchKey?: string;
  searchEngineId?: string;
  anthropicKey?: string; // For Claude
  perplexityKey?: string; // For web search
}
