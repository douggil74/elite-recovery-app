// App constants

export const APP_NAME = 'Bail Recovery';
export const VERSION = '1.0.0';

// Database
export const DB_NAME = 'bailrecovery.db';
export const DB_VERSION = 1;

// Security
export const ENCRYPTION_KEY_ALIAS = 'bail_recovery_encryption_key';
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
  PASSCODE_HASH: 'passcode_hash',
  LAST_AUTH: 'last_auth_time',
  ONBOARDED: 'onboarded',
} as const;

// Audit actions labels
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  case_created: 'Case Created',
  case_updated: 'Case Updated',
  case_deleted: 'Case Deleted',
  pdf_uploaded: 'PDF Uploaded',
  report_parsed: 'Report Analyzed',
  report_viewed: 'Report Viewed',
  field_revealed: 'Sensitive Field Revealed',
  brief_generated: 'Recovery Brief Generated',
  brief_exported: 'Brief Exported',
  journey_created: 'Journey Plan Created',
  case_shared: 'Case Shared',
};

// Purpose labels
export const PURPOSE_LABELS = {
  fta_recovery: 'FTA Recovery',
} as const;

// Default settings
export const DEFAULT_SETTINGS = {
  passcodeEnabled: false,
  biometricsEnabled: false,
  storageMode: 'local' as const,
  autoDeleteDays: null,
  maskFieldsByDefault: true,
};

// Journey plan default checklist
export const DEFAULT_JOURNEY_CHECKLIST = [
  'Bond paperwork and court documents',
  'Valid bail enforcement credentials/license',
  'Photo ID of subject',
  'Local law enforcement contact numbers',
  'Backup phone / communication device',
  'Vehicle inspection completed',
  'Notify partner/office of destination',
  'Safety equipment check',
  'Review local jurisdiction requirements',
];

// Colors
export const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
  masked: '#94a3b8',
};

// Risk severity colors
export const SEVERITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

// Identity check colors
export const IDENTITY_STATUS_COLORS = {
  pass: '#10b981',
  concern: '#f59e0b',
  fail: '#ef4444',
};
