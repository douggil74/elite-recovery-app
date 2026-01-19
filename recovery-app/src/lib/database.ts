import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import type { Case, Report, AuditLogEntry, CasePurpose, AuditAction, ParsedReport } from '@/types';

// Web uses AsyncStorage, native uses SQLite
const isWeb = Platform.OS === 'web';

// Storage keys for web
const STORAGE_KEYS = {
  CASES: 'bail_recovery_cases',
  REPORTS: 'bail_recovery_reports',
  AUDIT_LOG: 'bail_recovery_audit',
};

// In-memory cache for web
let casesCache: Case[] = [];
let reportsCache: Report[] = [];
let auditCache: AuditLogEntry[] = [];
let initialized = false;

async function initWeb() {
  if (initialized) return;

  try {
    const casesJson = await AsyncStorage.getItem(STORAGE_KEYS.CASES);
    casesCache = casesJson ? JSON.parse(casesJson) : [];

    const reportsJson = await AsyncStorage.getItem(STORAGE_KEYS.REPORTS);
    reportsCache = reportsJson ? JSON.parse(reportsJson) : [];

    const auditJson = await AsyncStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
    auditCache = auditJson ? JSON.parse(auditJson) : [];

    initialized = true;
  } catch (e) {
    console.error('Failed to init web storage:', e);
    casesCache = [];
    reportsCache = [];
    auditCache = [];
    initialized = true;
  }
}

async function saveWebData() {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(casesCache));
    await AsyncStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reportsCache));
    await AsyncStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(auditCache));
  } catch (e) {
    console.error('Failed to save web data:', e);
  }
}

// SQLite for native platforms
let db: any = null;

async function getDatabase(): Promise<any> {
  if (isWeb) {
    await initWeb();
    return null;
  }

  if (db) return db;

  // Dynamic import for native only
  const SQLite = await import('expo-sqlite');
  db = await SQLite.openDatabaseAsync('bailrecovery.db');
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: any): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      internal_case_id TEXT,
      purpose TEXT NOT NULL,
      notes TEXT,
      attestation_accepted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      auto_delete_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      pdf_path TEXT,
      raw_text_hash TEXT,
      parsed_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reports_case_id ON reports(case_id);
    CREATE INDEX IF NOT EXISTS idx_audit_case_id ON audit_log(case_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  `);
}

// Cases CRUD
export async function createCase(
  name: string,
  purpose: CasePurpose,
  internalCaseId?: string,
  notes?: string
): Promise<Case> {
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  const newCase: Case = {
    id,
    name,
    internalCaseId,
    purpose,
    notes,
    attestationAccepted: false,
    createdAt: now,
    updatedAt: now,
  };

  if (isWeb) {
    await initWeb();
    casesCache.push(newCase);
    await saveWebData();
    return newCase;
  }

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO cases (id, name, internal_case_id, purpose, notes, attestation_accepted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, name, internalCaseId || null, purpose, notes || null, now, now]
  );

  return newCase;
}

export async function getCase(id: string): Promise<Case | null> {
  if (isWeb) {
    await initWeb();
    return casesCache.find(c => c.id === id) || null;
  }

  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    name: string;
    internal_case_id: string | null;
    purpose: CasePurpose;
    notes: string | null;
    attestation_accepted: number;
    created_at: string;
    updated_at: string;
    auto_delete_at: string | null;
  }>('SELECT * FROM cases WHERE id = ?', [id]);

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    internalCaseId: row.internal_case_id || undefined,
    purpose: row.purpose,
    notes: row.notes || undefined,
    attestationAccepted: row.attestation_accepted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    autoDeleteAt: row.auto_delete_at || undefined,
  };
}

export async function getAllCases(): Promise<Case[]> {
  if (isWeb) {
    await initWeb();
    return [...casesCache].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    internal_case_id: string | null;
    purpose: CasePurpose;
    notes: string | null;
    attestation_accepted: number;
    created_at: string;
    updated_at: string;
    auto_delete_at: string | null;
  }>('SELECT * FROM cases ORDER BY updated_at DESC');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    internalCaseId: row.internal_case_id || undefined,
    purpose: row.purpose,
    notes: row.notes || undefined,
    attestationAccepted: row.attestation_accepted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    autoDeleteAt: row.auto_delete_at || undefined,
  }));
}

export async function updateCase(
  id: string,
  updates: Partial<Pick<Case, 'name' | 'internalCaseId' | 'notes' | 'attestationAccepted' | 'autoDeleteAt'>>
): Promise<void> {
  const now = new Date().toISOString();

  if (isWeb) {
    await initWeb();
    const idx = casesCache.findIndex(c => c.id === id);
    if (idx !== -1) {
      casesCache[idx] = {
        ...casesCache[idx],
        ...updates,
        updatedAt: now,
      };
      await saveWebData();
    }
    return;
  }

  const database = await getDatabase();
  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.internalCaseId !== undefined) {
    setClauses.push('internal_case_id = ?');
    values.push(updates.internalCaseId || null);
  }
  if (updates.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(updates.notes || null);
  }
  if (updates.attestationAccepted !== undefined) {
    setClauses.push('attestation_accepted = ?');
    values.push(updates.attestationAccepted ? 1 : 0);
  }
  if (updates.autoDeleteAt !== undefined) {
    setClauses.push('auto_delete_at = ?');
    values.push(updates.autoDeleteAt || null);
  }

  values.push(id);
  await database.runAsync(
    `UPDATE cases SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteCase(id: string): Promise<void> {
  if (isWeb) {
    await initWeb();
    casesCache = casesCache.filter(c => c.id !== id);
    reportsCache = reportsCache.filter(r => r.caseId !== id);
    await saveWebData();
    return;
  }

  const database = await getDatabase();
  await database.runAsync('DELETE FROM cases WHERE id = ?', [id]);
}

// Reports CRUD
export async function createReport(
  caseId: string,
  parsedData: ParsedReport,
  pdfPath?: string
): Promise<Report> {
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  const newReport: Report = {
    id,
    caseId,
    pdfPath,
    parsedData,
    createdAt: now,
  };

  if (isWeb) {
    await initWeb();
    reportsCache.push(newReport);
    // Update case timestamp
    const caseIdx = casesCache.findIndex(c => c.id === caseId);
    if (caseIdx !== -1) {
      casesCache[caseIdx].updatedAt = now;
    }
    await saveWebData();
    return newReport;
  }

  const database = await getDatabase();
  const encryptedData = JSON.stringify(parsedData); // Skip encryption for simplicity on native too

  await database.runAsync(
    `INSERT INTO reports (id, case_id, pdf_path, parsed_data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, caseId, pdfPath || null, encryptedData, now]
  );

  await database.runAsync(
    'UPDATE cases SET updated_at = ? WHERE id = ?',
    [now, caseId]
  );

  return newReport;
}

export async function getReportsForCase(caseId: string): Promise<Report[]> {
  if (isWeb) {
    await initWeb();
    return reportsCache
      .filter(r => r.caseId === caseId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    case_id: string;
    pdf_path: string | null;
    parsed_data: string;
    created_at: string;
  }>('SELECT * FROM reports WHERE case_id = ? ORDER BY created_at DESC', [caseId]);

  return rows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    pdfPath: row.pdf_path || undefined,
    parsedData: JSON.parse(row.parsed_data),
    createdAt: row.created_at,
  }));
}

export async function deleteReport(id: string): Promise<void> {
  if (isWeb) {
    await initWeb();
    reportsCache = reportsCache.filter(r => r.id !== id);
    await saveWebData();
    return;
  }

  const database = await getDatabase();
  await database.runAsync('DELETE FROM reports WHERE id = ?', [id]);
}

// Audit Log
export async function logAudit(
  action: AuditAction,
  caseId?: string,
  details?: string
): Promise<void> {
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  const entry: AuditLogEntry = {
    id,
    caseId,
    action,
    details,
    timestamp: now,
  };

  if (isWeb) {
    await initWeb();
    auditCache.push(entry);
    // Keep only last 500 entries
    if (auditCache.length > 500) {
      auditCache = auditCache.slice(-500);
    }
    await saveWebData();
    return;
  }

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO audit_log (id, case_id, action, details, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [id, caseId || null, action, details || null, now]
  );
}

export async function getAuditLog(
  limit: number = 100,
  caseId?: string
): Promise<AuditLogEntry[]> {
  if (isWeb) {
    await initWeb();
    let filtered = caseId
      ? auditCache.filter(a => a.caseId === caseId)
      : auditCache;
    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  const database = await getDatabase();
  let query = 'SELECT * FROM audit_log';
  const params: (string | number)[] = [];

  if (caseId) {
    query += ' WHERE case_id = ?';
    params.push(caseId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = await database.getAllAsync<{
    id: string;
    case_id: string | null;
    action: AuditAction;
    details: string | null;
    timestamp: string;
  }>(query, params);

  return rows.map((row) => ({
    id: row.id,
    caseId: row.case_id || undefined,
    action: row.action,
    details: row.details || undefined,
    timestamp: row.timestamp,
  }));
}

export async function clearAuditLogForCase(caseId: string): Promise<void> {
  if (isWeb) {
    await initWeb();
    auditCache = auditCache.filter(a => a.caseId !== caseId);
    await saveWebData();
    return;
  }

  const database = await getDatabase();
  await database.runAsync('DELETE FROM audit_log WHERE case_id = ?', [caseId]);
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(`setting_${key}`);
  }

  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(`setting_${key}`, value);
    return;
  }

  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}

// Cleanup for auto-delete
export async function cleanupExpiredCases(): Promise<number> {
  const now = new Date().toISOString();

  if (isWeb) {
    await initWeb();
    const before = casesCache.length;
    casesCache = casesCache.filter(c =>
      !c.autoDeleteAt || c.autoDeleteAt >= now
    );
    const deleted = before - casesCache.length;
    if (deleted > 0) {
      await saveWebData();
    }
    return deleted;
  }

  const database = await getDatabase();
  const result = await database.runAsync(
    'DELETE FROM cases WHERE auto_delete_at IS NOT NULL AND auto_delete_at < ?',
    [now]
  );

  return result.changes;
}
