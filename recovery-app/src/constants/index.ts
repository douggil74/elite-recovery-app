// App constants

export const APP_NAME = 'Fugitive Recovery';
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
  storageMode: 'cloud' as const,  // Always sync to cloud by default
  autoDeleteDays: null,
  maskFieldsByDefault: true,
  osintBackendUrl: null as string | null, // Custom OSINT backend URL (defaults to production)
};

// OSINT Backend Configuration
export const OSINT_CONFIG = {
  productionUrl: 'https://elite-recovery-osint.onrender.com',
  localDevUrl: 'http://localhost:8000',
  healthCheckTimeout: 3000, // 3 seconds
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

// Colors - Dark Red Theme
export const COLORS = {
  // Primary red
  primary: '#dc2626',      // red-600
  primaryDark: '#b91c1c',  // red-700
  primaryLight: '#ef4444', // red-500
  primaryMuted: '#450a0a', // red-950 for backgrounds

  // Secondary/neutral
  secondary: '#71717a',    // zinc-500

  // Status colors
  success: '#22c55e',      // green-500
  warning: '#f59e0b',      // amber-500
  danger: '#ef4444',       // red-500

  // Dark backgrounds
  background: '#000000',   // pure black
  surface: '#18181b',      // zinc-900
  surfaceLight: '#27272a', // zinc-800
  card: '#0a0a0a',         // near black

  // Text
  text: '#fafafa',         // zinc-50
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#71717a',    // zinc-500

  // Borders
  border: '#27272a',       // zinc-800
  borderLight: '#3f3f46',  // zinc-700

  // Misc
  masked: '#52525b',       // zinc-600
};

// Risk severity colors
export const SEVERITY_COLORS = {
  low: '#22c55e',    // green-500
  medium: '#f59e0b', // amber-500
  high: '#ef4444',   // red-500
};

// Identity check colors
export const IDENTITY_STATUS_COLORS = {
  pass: '#22c55e',   // green-500
  concern: '#f59e0b', // amber-500
  fail: '#ef4444',   // red-500
};
