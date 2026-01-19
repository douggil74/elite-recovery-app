// Core types for Bail Recovery App

export type CasePurpose = 'fta_recovery';

export type AuditAction =
  | 'case_created'
  | 'case_updated'
  | 'case_deleted'
  | 'pdf_uploaded'
  | 'report_parsed'
  | 'report_viewed'
  | 'field_revealed'
  | 'brief_generated'
  | 'brief_exported'
  | 'journey_created'
  | 'case_shared';

export interface Case {
  id: string;
  name: string;
  internalCaseId?: string;
  purpose: CasePurpose;
  notes?: string;
  attestationAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  autoDeleteAt?: string;
}

export interface AuditLogEntry {
  id: string;
  caseId?: string;
  action: AuditAction;
  details?: string;
  timestamp: string;
}

// Parsed report types
export interface Subject {
  fullName: string;
  aliases?: string[];
  dob?: string;
  partialSsn?: string; // Last 4 only, masked
  personId?: string;
  deceasedIndicator?: boolean;
}

export interface ParsedAddress {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  fullAddress: string;
  fromDate?: string;
  toDate?: string;
  confidence: number; // 0-1
  reasons: string[];
  isCurrent?: boolean;
  linkedSignals?: string[]; // e.g., ['phone', 'vehicle', 'employment']
}

export interface ParsedPhone {
  number: string;
  type?: 'mobile' | 'landline' | 'voip' | 'unknown';
  carrier?: string;
  firstSeen?: string;
  lastSeen?: string;
  confidence: number;
  isActive?: boolean;
}

export interface ParsedRelative {
  name: string;
  relationship?: string;
  age?: number;
  currentAddress?: string;
  phones?: string[];
  confidence: number;
}

export interface ParsedVehicle {
  year?: string;
  make?: string;
  model?: string;
  color?: string;
  vin?: string;
  plate?: string;
  state?: string;
  registeredAddress?: string;
}

export interface ParsedEmployment {
  employer?: string;
  title?: string;
  address?: string;
  phone?: string;
  fromDate?: string;
  toDate?: string;
  isCurrent?: boolean;
}

export interface ReportFlag {
  type: 'deceased' | 'high_risk' | 'fraud_alert' | 'address_mismatch' | 'info';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ParsedReport {
  subject: Subject;
  addresses: ParsedAddress[];
  phones: ParsedPhone[];
  relatives: ParsedRelative[];
  vehicles: ParsedVehicle[];
  employment: ParsedEmployment[];
  flags: ReportFlag[];
  recommendations: string[];
  parseMethod: 'deterministic' | 'ai' | 'hybrid';
  parseConfidence: number;
  rawTextHash?: string;
  aiAnalysis?: any; // Full AI response for generating briefs
}

export interface Report {
  id: string;
  caseId: string;
  pdfPath?: string;
  parsedData: ParsedReport;
  createdAt: string;
}

// Recovery Brief types
export type IdentityCheckStatus = 'pass' | 'concern' | 'fail';

export interface IdentityCheck {
  status: IdentityCheckStatus;
  reasons: string[];
  matchedFields: string[];
  unmatchedFields: string[];
}

export interface LocationLead {
  rank: number;
  address: ParsedAddress;
  whyLikely: string[];
  contactsAtAddress?: string[];
}

export interface ContactLead {
  rank: number;
  type: 'phone' | 'relative' | 'employer';
  name?: string;
  contact: string;
  reason: string;
}

export interface RecoveryBrief {
  caseId: string;
  identityCheck: IdentityCheck;
  topLocations: LocationLead[];
  topContacts: ContactLead[];
  nextActions: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    cost: 'free' | 'cheap' | 'moderate';
  }[];
  generatedAt: string;
}

// Journey Plan types
export interface JourneyStop {
  id: string;
  address: string;
  type: 'primary' | 'secondary' | 'workplace' | 'relative';
  notes?: string;
  order: number;
}

export interface JourneyPlan {
  id: string;
  caseId: string;
  startingLocation: string;
  stops: JourneyStop[];
  checklist: {
    item: string;
    checked: boolean;
  }[];
  createdAt: string;
}

// Settings types
export interface AppSettings {
  passcodeEnabled: boolean;
  biometricsEnabled: boolean;
  storageMode: 'local' | 'cloud';
  autoDeleteDays: number | null; // null = never
  maskFieldsByDefault: boolean;
  openaiApiKey?: string;
  // Firebase cloud sync
  firebaseConfig?: string; // JSON string of FirebaseConfig
  userId?: string; // User ID for multi-device sync
}

// API response types
export interface AnalyzeResponse {
  success: boolean;
  data?: ParsedReport;
  error?: string;
}
