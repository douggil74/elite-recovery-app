/**
 * Cloud-first Database Module
 * All CRUD operations go directly to Firebase Firestore.
 * No local SQLite or AsyncStorage for case/report data.
 */

import uuid from 'react-native-uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Case, Report, AuditLogEntry, CasePurpose, AuditAction, ParsedReport } from '@/types';
import { getCurrentUserId } from './auth-state';
import {
  getDb,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from './firebase';

// Old AsyncStorage keys from pre-cloud database.ts
const LEGACY_KEYS = {
  CASES: 'bail_recovery_cases',
  REPORTS: 'bail_recovery_reports',
  AUDIT_LOG: 'bail_recovery_audit',
};

// Helper to get the current user ID or throw
function requireUserId(): string {
  const uid = getCurrentUserId();
  if (!uid) {
    throw new Error('User must be logged in to access data');
  }
  return uid;
}

// Deep-strip undefined values from an object so Firestore doesn't reject it.
// Firestore throws on any undefined value at any nesting depth.
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = stripUndefined(value);
      }
    }
    return clean;
  }
  return obj;
}

// Helper to get Firestore or throw
async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

// Cases CRUD
export interface CreateCaseOptions {
  name: string;
  purpose: CasePurpose;
  internalCaseId?: string;
  notes?: string;
  ftaScore?: number;
  ftaRiskLevel?: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK';
  mugshotUrl?: string;
  bookingNumber?: string;
  jailSource?: string;
  charges?: string[];
  bondAmount?: number;
  rosterData?: {
    inmate: Record<string, any>;
    charges: Record<string, any>[];
    bonds: Record<string, any>[];
  };
}

export async function createCase(
  name: string,
  purpose: CasePurpose,
  internalCaseId?: string,
  notes?: string,
  ftaScore?: number,
  ftaRiskLevel?: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK',
  options?: Partial<CreateCaseOptions>
): Promise<Case> {
  const userId = requireUserId();
  const db = await requireDb();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  const newCase: Case = {
    id,
    name,
    internalCaseId,
    purpose,
    notes,
    ftaScore,
    ftaRiskLevel,
    attestationAccepted: false,
    createdAt: now,
    updatedAt: now,
    mugshotUrl: options?.mugshotUrl,
    bookingNumber: options?.bookingNumber,
    jailSource: options?.jailSource,
    charges: options?.charges,
    bondAmount: options?.bondAmount,
    rosterData: options?.rosterData,
  };

  // Deep-strip undefined values for Firestore
  const firestoreData = { ...stripUndefined(newCase), userId, syncedAt: serverTimestamp() };

  console.log('[DB] Creating case:', id, name, 'userId:', userId);
  // Fire-and-forget: setDoc writes to local cache immediately but its Promise
  // waits for server ACK which can hang if WebSocket is connecting.
  // The onSnapshot subscription will pick up the local write instantly.
  const writePromise = setDoc(doc(db, 'cases', id), firestoreData);
  writePromise
    .then(() => console.log('[DB] Case server-confirmed:', id))
    .catch(err => console.error('[DB] Case write failed (will retry):', id, err));

  return newCase;
}

export async function getCase(id: string): Promise<Case | null> {
  try {
    const db = await requireDb();
    const caseRef = doc(db, 'cases', id);

    // Try cache first (instant for recently created/viewed cases)
    let snap: any = null;
    try {
      snap = await getDocFromCache(caseRef);
    } catch {
      // Cache miss — try server with timeout
      snap = await Promise.race([
        getDoc(caseRef),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
    }

    if (!snap || !snap.exists()) return null;

    const data = snap.data();
    return {
      ...data,
      id: snap.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    } as Case;
  } catch (error: any) {
    console.warn('[DB] getCase failed:', error?.message || error);
    return null;
  }
}

export async function getAllCases(): Promise<Case[]> {
  const userId = getCurrentUserId();
  if (!userId) {
    console.log('[DB] getAllCases: no userId yet, returning empty');
    return [];
  }
  const db = await getDb();
  if (!db) {
    console.log('[DB] getAllCases: no db yet, returning empty');
    return [];
  }
  console.log('[DB] getAllCases for userId:', userId);

  // Simple query without orderBy to avoid needing a composite index
  const casesQuery = query(
    collection(db, 'cases'),
    where('userId', '==', userId)
  );

  try {
    // Try cache first (instant), fall back to server with timeout.
    // onSnapshot in useCases provides real-time updates after this initial load.
    let snapshot: any = null;
    try {
      snapshot = await getDocsFromCache(casesQuery);
      if (snapshot.empty) throw new Error('cache empty');
    } catch {
      snapshot = await Promise.race([
        getDocs(casesQuery),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
    }

    if (!snapshot) {
      console.warn('[DB] getAllCases timed out — onSnapshot will catch up');
      return [];
    }

    console.log('[DB] getAllCases:', snapshot.docs.length, 'cases');

    const cases = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      } as Case;
    });

    // Sort client-side (newest first)
    cases.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return cases;
  } catch (error: any) {
    console.warn('[DB] getAllCases failed:', error?.message || error);
    return [];
  }
}

export async function updateCase(
  id: string,
  updates: Partial<Pick<Case, 'name' | 'internalCaseId' | 'notes' | 'attestationAccepted' | 'autoDeleteAt' | 'primaryTarget'>>
): Promise<void> {
  const db = await requireDb();
  const now = new Date().toISOString();

  // Deep-strip undefined values for Firestore
  const firestoreUpdates = {
    ...stripUndefined(updates),
    updatedAt: now,
    syncedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'cases', id), firestoreUpdates, { merge: true });
}

export async function deleteCase(id: string): Promise<void> {
  const db = await requireDb();

  // Mark as pending delete so onSnapshot callbacks can filter it out
  pendingDeletes.add(id);

  try {
    // Delete subcollections in parallel — all with .catch so nothing blocks
    const subDeletes: Promise<void>[] = [
      deleteDoc(doc(db, 'cases', id, 'chat', 'history')).catch(() => {}),
      deleteDoc(doc(db, 'cases', id, 'photo', 'target')).catch(() => {}),
    ];

    // Delete reports subcollection — timeout so it can't hang
    try {
      const reportsSnap = await Promise.race([
        getDocs(collection(db, 'cases', id, 'reports')),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (reportsSnap) {
        for (const reportDoc of reportsSnap.docs) {
          subDeletes.push(deleteDoc(reportDoc.ref).catch(() => {}));
        }
      }
    } catch { /* no reports */ }

    // Fire all subcollection deletes, then delete the case doc
    await Promise.all(subDeletes);
    await deleteDoc(doc(db, 'cases', id));
  } finally {
    pendingDeletes.delete(id);
  }
}

/** Case IDs currently being deleted — used by sync to filter onSnapshot results */
export const pendingDeletes = new Set<string>();

// Reports CRUD
export async function createReport(
  caseId: string,
  parsedData: ParsedReport,
  pdfPath?: string
): Promise<Report> {
  const db = await requireDb();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  const newReport: Report = {
    id,
    caseId,
    pdfPath,
    parsedData,
    createdAt: now,
  };

  // Write report to subcollection — deep-strip undefined values
  // (parsedData can have nested undefined fields like subject.dob)
  const reportData = { ...stripUndefined(newReport), syncedAt: serverTimestamp() };
  await setDoc(doc(db, 'cases', caseId, 'reports', id), reportData);

  // Update case timestamp
  await setDoc(doc(db, 'cases', caseId), {
    updatedAt: now,
    syncedAt: serverTimestamp(),
  }, { merge: true });

  return newReport;
}

export async function getReportsForCase(caseId: string): Promise<Report[]> {
  try {
    const db = await requireDb();
    const reportsRef = collection(db, 'cases', caseId, 'reports');

    // Try cache first (instant), fall back to server with timeout
    let snapshot: any = null;
    try {
      snapshot = await getDocsFromCache(reportsRef);
    } catch {
      snapshot = await Promise.race([
        getDocs(reportsRef),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
    }

    if (!snapshot) {
      console.warn('[DB] getReportsForCase timed out');
      return [];
    }

    console.log('[DB] getReportsForCase:', snapshot.docs.length, 'reports');

    const reports = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        caseId: data.caseId,
        pdfPath: data.pdfPath || undefined,
        parsedData: data.parsedData,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      } as Report;
    });

    reports.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return reports;
  } catch (error: any) {
    console.warn('[DB] getReportsForCase failed:', error?.message || error);
    return [];
  }
}

export async function deleteReport(id: string, caseId?: string): Promise<void> {
  if (!caseId) {
    console.warn('deleteReport called without caseId - cannot delete from Firestore');
    return;
  }
  const db = await requireDb();
  await deleteDoc(doc(db, 'cases', caseId, 'reports', id));
}

// Audit Log - now stored in Firestore under users/{uid}/audit
export async function logAudit(
  action: AuditAction,
  caseId?: string,
  details?: string
): Promise<void> {
  try {
    const userId = getCurrentUserId();
    if (!userId) return; // Can't log audit without a user

    const db = await requireDb();
    const id = uuid.v4() as string;
    const now = new Date().toISOString();

    const entry: Record<string, any> = {
      id,
      action,
      timestamp: now,
      syncedAt: serverTimestamp(),
    };
    if (caseId) entry.caseId = caseId;
    if (details) entry.details = details;

    await setDoc(doc(db, 'users', userId, 'audit', id), entry);
  } catch (error) {
    // Don't let audit failures break the app
    console.warn('Audit log failed:', error);
  }
}

export async function getAuditLog(
  limit: number = 100,
  caseId?: string
): Promise<AuditLogEntry[]> {
  try {
    const userId = getCurrentUserId();
    if (!userId) return [];

    const db = await requireDb();

    let auditQuery;
    if (caseId) {
      auditQuery = query(
        collection(db, 'users', userId, 'audit'),
        where('caseId', '==', caseId)
      );
    } else {
      auditQuery = query(collection(db, 'users', userId, 'audit'));
    }

    const snapshot = await getDocs(auditQuery);

    const entries = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: data.id || docSnap.id,
        caseId: data.caseId || undefined,
        action: data.action,
        details: data.details || undefined,
        timestamp: data.timestamp,
      } as AuditLogEntry;
    });

    // Sort client-side and apply limit
    entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    return entries.slice(0, limit);
  } catch (error) {
    console.warn('Failed to get audit log:', error);
    return [];
  }
}

export async function clearAuditLogForCase(caseId: string): Promise<void> {
  try {
    const userId = getCurrentUserId();
    if (!userId) return;

    const db = await requireDb();
    const auditQuery = query(
      collection(db, 'users', userId, 'audit'),
      where('caseId', '==', caseId)
    );

    const snapshot = await getDocs(auditQuery);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
    }
  } catch (error) {
    console.warn('Failed to clear audit log:', error);
  }
}


/**
 * Migrate old AsyncStorage cases/reports to Firestore.
 * Called on login to recover any data that was only stored locally.
 * Also claims any orphaned Firestore cases that have no userId.
 */
export async function migrateLocalDataToFirestore(): Promise<number> {
  const userId = getCurrentUserId();
  if (!userId) return 0;

  let migrated = 0;

  try {
    const db = await getDb();
    if (!db) return 0;

    // Step 1: Migrate old AsyncStorage cases
    const casesJson = await AsyncStorage.getItem(LEGACY_KEYS.CASES);
    if (casesJson) {
      const localCases: Case[] = JSON.parse(casesJson);
      console.log('[Migration] Found', localCases.length, 'local cases to migrate');

      // Also load reports
      const reportsJson = await AsyncStorage.getItem(LEGACY_KEYS.REPORTS);
      const localReports: Report[] = reportsJson ? JSON.parse(reportsJson) : [];

      for (const c of localCases) {
        try {
          // Check if case already exists in Firestore (try cache first, skip if offline)
          let existingDoc;
          try {
            existingDoc = await getDocFromCache(doc(db, 'cases', c.id));
          } catch {
            existingDoc = await Promise.race([
              getDoc(doc(db, 'cases', c.id)),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
            ]);
            if (!existingDoc) {
              console.log('[Migration] Skipping case (offline):', c.id);
              continue;
            }
          }
          if (existingDoc.exists()) {
            // Case exists - make sure it has our userId
            const data = existingDoc.data();
            if (!data.userId) {
              await setDoc(doc(db, 'cases', c.id), { userId, syncedAt: serverTimestamp() }, { merge: true });
              console.log('[Migration] Claimed orphan case:', c.id, c.name);
              migrated++;
            }
            continue;
          }

          // Write case to Firestore
          const firestoreData: Record<string, any> = { userId, syncedAt: serverTimestamp() };
          for (const [key, value] of Object.entries(c)) {
            if (value !== undefined) {
              firestoreData[key] = value;
            }
          }
          await setDoc(doc(db, 'cases', c.id), firestoreData);
          console.log('[Migration] Migrated case:', c.id, c.name);
          migrated++;

          // Migrate reports for this case
          const caseReports = localReports.filter(r => r.caseId === c.id);
          for (const r of caseReports) {
            try {
              const reportData: Record<string, any> = { syncedAt: serverTimestamp() };
              for (const [key, value] of Object.entries(r)) {
                if (value !== undefined) {
                  reportData[key] = value;
                }
              }
              await setDoc(doc(db, 'cases', c.id, 'reports', r.id), reportData);
              console.log('[Migration] Migrated report:', r.id, 'for case:', c.id);
            } catch (e) {
              console.warn('[Migration] Failed to migrate report:', r.id, e);
            }
          }
        } catch (e) {
          console.warn('[Migration] Failed to migrate case:', c.id, e);
        }
      }

      // Clear old AsyncStorage data after successful migration
      if (migrated > 0) {
        await AsyncStorage.removeItem(LEGACY_KEYS.CASES);
        await AsyncStorage.removeItem(LEGACY_KEYS.REPORTS);
        await AsyncStorage.removeItem(LEGACY_KEYS.AUDIT_LOG);
        console.log('[Migration] Cleared legacy AsyncStorage data');
      }
    }

    // Step 2: Claim any orphaned Firestore cases (cases with no userId)
    // This handles cases that were synced to Firestore but without a userId field
    try {
      const allCasesSnap = await getDocs(collection(db, 'cases'));
      for (const docSnap of allCasesSnap.docs) {
        const data = docSnap.data();
        if (!data.userId) {
          await setDoc(doc(db, 'cases', docSnap.id), { userId, syncedAt: serverTimestamp() }, { merge: true });
          console.log('[Migration] Claimed orphan Firestore case:', docSnap.id, data.name);
          migrated++;
        }
      }
    } catch (e) {
      console.warn('[Migration] Failed to scan for orphan cases:', e);
    }

  } catch (error) {
    console.error('[Migration] Migration failed:', error);
  }

  if (migrated > 0) {
    console.log('[Migration] Total migrated/claimed:', migrated);
  }
  return migrated;
}

// Cleanup for auto-delete
export async function cleanupExpiredCases(): Promise<number> {
  try {
    const userId = getCurrentUserId();
    if (!userId) return 0;

    const db = await getDb();
    if (!db) return 0;
    const now = new Date().toISOString();

    const casesQuery = query(
      collection(db, 'cases'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(casesQuery);
    let deleted = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.autoDeleteAt && data.autoDeleteAt < now) {
        await deleteCase(docSnap.id);
        deleted++;
      }
    }

    return deleted;
  } catch (error) {
    console.warn('Cleanup failed:', error);
    return 0;
  }
}
