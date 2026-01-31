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
  getAuthInstance,
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

// Firebase project config for REST API fallback
const FIREBASE_PROJECT_ID = 'fugitive-database';
const FIRESTORE_DATABASE_ID = 'default'; // without parentheses

/**
 * Write to Firestore using REST API (bypasses WebSocket issues)
 */
async function writeViaRestApi(
  collectionPath: string,
  docId: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const auth = getAuthInstance();
    if (!auth?.currentUser) {
      console.error('[REST] No authenticated user');
      return false;
    }

    // Get fresh ID token
    const token = await auth.currentUser.getIdToken(true);

    // Convert data to Firestore REST API format
    const firestoreDoc = convertToFirestoreFormat(data);

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/${collectionPath}/${docId}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: firestoreDoc }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[REST] Write failed:', response.status, error);
      return false;
    }

    console.log('[REST] Write successful:', collectionPath, docId);
    return true;
  } catch (error) {
    console.error('[REST] Write error:', error);
    return false;
  }
}

/**
 * Read from Firestore using REST API
 */
async function readViaRestApi(
  collectionPath: string,
  userId: string
): Promise<any[]> {
  try {
    const auth = getAuthInstance();
    if (!auth?.currentUser) {
      console.error('[REST] No authenticated user');
      return [];
    }

    const token = await auth.currentUser.getIdToken(true);

    // Use structured query to filter by userId
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionPath }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: userId }
            }
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[REST] Read failed:', response.status, error);
      return [];
    }

    const results = await response.json();
    return results
      .filter((r: any) => r.document)
      .map((r: any) => convertFromFirestoreFormat(r.document));
  } catch (error) {
    console.error('[REST] Read error:', error);
    return [];
  }
}

/**
 * Convert JS object to Firestore REST API format
 */
function convertToFirestoreFormat(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      result[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        result[key] = { integerValue: String(value) };
      } else {
        result[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      result[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      result[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: String(v) };
            if (typeof v === 'object') return { mapValue: { fields: convertToFirestoreFormat(v) } };
            return { stringValue: String(v) };
          })
        }
      };
    } else if (typeof value === 'object') {
      // Check for serverTimestamp sentinel
      if (value?.constructor?.name === 'FieldValue') {
        result[key] = { timestampValue: new Date().toISOString() };
      } else {
        result[key] = { mapValue: { fields: convertToFirestoreFormat(value) } };
      }
    }
  }

  return result;
}

/**
 * Convert Firestore REST API format back to JS object
 */
function convertFromFirestoreFormat(doc: any): Record<string, any> {
  const result: Record<string, any> = {};

  // Extract document ID from name path
  if (doc.name) {
    const parts = doc.name.split('/');
    result.id = parts[parts.length - 1];
  }

  if (!doc.fields) return result;

  for (const [key, value] of Object.entries(doc.fields as Record<string, any>)) {
    result[key] = convertFieldValue(value);
  }

  return result;
}

function convertFieldValue(field: any): any {
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue' in field) return null;
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue' in field) {
    return (field.arrayValue.values || []).map(convertFieldValue);
  }
  if ('mapValue' in field) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      obj[k] = convertFieldValue(v);
    }
    return obj;
  }
  return null;
}

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

/**
 * Test cloud connectivity using REST API (most reliable).
 * Returns true if cloud sync is working, false otherwise.
 */
export async function testCloudConnection(): Promise<{ success: boolean; error?: string; latency?: number; method?: string }> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not logged in' };
    }

    const auth = getAuthInstance();
    if (!auth?.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const startTime = Date.now();

    // Test using REST API directly (bypasses WebSocket issues)
    const token = await auth.currentUser.getIdToken(true);
    const testId = `_test_${Date.now()}`;

    // Write test document via REST
    const writeUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/users/${userId}/connectivity/${testId}`;

    const writeResponse = await fetch(writeUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          test: { booleanValue: true },
          timestamp: { timestampValue: new Date().toISOString() }
        }
      }),
    });

    if (!writeResponse.ok) {
      const error = await writeResponse.text();
      console.error('[DB] REST write test failed:', writeResponse.status, error);
      return { success: false, error: `REST write failed: ${writeResponse.status}` };
    }

    // Clean up - delete test document
    fetch(writeUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});

    const latency = Date.now() - startTime;
    console.log('[DB] Cloud connection test passed via REST API, latency:', latency, 'ms');
    return { success: true, latency, method: 'REST' };
  } catch (error: any) {
    console.error('[DB] Cloud connection test failed:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Push all locally cached cases to the cloud via REST API.
 * This ensures any cases stuck in local cache get synced.
 */
export async function forceSyncPendingWrites(): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    if (!userId) return false;

    const db = await getDb();
    if (!db) return false;

    // Read all cases from local cache
    const casesQuery = query(
      collection(db, 'cases'),
      where('userId', '==', userId)
    );

    let snapshot: any = null;
    try {
      snapshot = await getDocsFromCache(casesQuery);
    } catch {
      console.log('[DB] No cached cases to sync');
      return true;
    }

    if (!snapshot || snapshot.empty) {
      console.log('[DB] No cases in cache');
      return true;
    }

    console.log('[DB] Syncing', snapshot.docs.length, 'cached cases to cloud via REST API');

    let synced = 0;
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const caseData: Record<string, any> = {
        ...data,
        id: docSnap.id,
        userId,
        syncedAt: new Date().toISOString(),
      };

      // Convert Firestore Timestamps to ISO strings for REST API
      if (data.createdAt?.toDate) {
        caseData.createdAt = data.createdAt.toDate().toISOString();
      }
      if (data.updatedAt?.toDate) {
        caseData.updatedAt = data.updatedAt.toDate().toISOString();
      }

      // Remove any nested undefined/null values
      const cleanData = stripUndefined(caseData);

      const success = await writeViaRestApi('cases', docSnap.id, cleanData);
      if (success) {
        synced++;
        console.log('[DB] Synced case to cloud:', docSnap.id, data.name);

        // Also sync subcollections (reports, documents, chat, photo)
        for (const subCol of ['reports', 'documents']) {
          try {
            const subSnap = await getDocsFromCache(collection(db, 'cases', docSnap.id, subCol));
            for (const subDoc of subSnap.docs) {
              const subData = stripUndefined({ ...subDoc.data(), syncedAt: new Date().toISOString() });
              await writeViaRestApi(`cases/${docSnap.id}/${subCol}`, subDoc.id, subData);
            }
            if (subSnap.docs.length > 0) {
              console.log(`[DB] Synced ${subSnap.docs.length} ${subCol} for case:`, docSnap.id);
            }
          } catch { /* subcollection may not exist in cache */ }
        }

        // Sync chat history
        try {
          const chatSnap = await getDocFromCache(doc(db, 'cases', docSnap.id, 'chat', 'history'));
          if (chatSnap.exists()) {
            const chatData = stripUndefined({ ...chatSnap.data(), syncedAt: new Date().toISOString() });
            await writeViaRestApi(`cases/${docSnap.id}/chat`, 'history', chatData);
            console.log('[DB] Synced chat for case:', docSnap.id);
          }
        } catch { /* no chat in cache */ }
      } else {
        console.error('[DB] Failed to sync case:', docSnap.id);
      }
    }

    console.log(`[DB] Force sync complete: ${synced}/${snapshot.docs.length} cases synced`);
    return synced > 0;
  } catch (error) {
    console.error('[DB] Force sync failed:', error);
    return false;
  }
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

  // Try WebSocket first, fall back to REST API if it times out
  const caseRef = doc(db, 'cases', id);
  let savedToCloud = false;

  try {
    // Try WebSocket write with 5 second timeout
    await Promise.race([
      setDoc(caseRef, firestoreData),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000)
      ),
    ]);
    console.log('[DB] Case saved via WebSocket:', id);
    savedToCloud = true;
  } catch (err: any) {
    console.warn('[DB] WebSocket write failed, trying REST API:', err?.message);

    // Fall back to REST API
    const restData = {
      ...newCase,
      userId,
      syncedAt: new Date().toISOString(),
    };
    savedToCloud = await writeViaRestApi('cases', id, restData);

    if (savedToCloud) {
      console.log('[DB] Case saved via REST API:', id);
    } else {
      console.error('[DB] Both WebSocket and REST API failed for case:', id);
    }
  }

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
    let source = 'unknown';
    try {
      snapshot = await getDocsFromCache(casesQuery);
      if (snapshot.empty) throw new Error('cache empty');
      source = 'cache';
      console.log('[DB] getAllCases from cache:', snapshot.docs.length);
    } catch (cacheErr) {
      console.log('[DB] Cache miss, fetching from server...');
      // Increase timeout to 15 seconds for slow connections
      const serverFetch = getDocs(casesQuery);
      snapshot = await Promise.race([
        serverFetch,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);
      source = 'server';
    }

    if (!snapshot) {
      console.warn('[DB] getAllCases WebSocket timed out — trying REST API');

      // Try REST API fallback
      const restCases = await readViaRestApi('cases', userId);
      if (restCases.length > 0) {
        console.log('[DB] Loaded', restCases.length, 'cases via REST API');
        return restCases as Case[];
      }

      // Final fallback to AsyncStorage
      console.warn('[DB] REST API returned empty — trying local storage fallback');
      try {
        const localCasesJson = await AsyncStorage.getItem(LEGACY_KEYS.CASES);
        if (localCasesJson) {
          const localCases: Case[] = JSON.parse(localCasesJson);
          console.log('[DB] Loaded', localCases.length, 'cases from local storage fallback');
          return localCases;
        }
      } catch (e) {
        console.warn('[DB] Local storage fallback failed:', e);
      }
      return [];
    }
    console.log('[DB] getAllCases from', source + ':', snapshot.docs.length, 'docs');

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
  updates: Partial<Pick<Case, 'name' | 'internalCaseId' | 'notes' | 'attestationAccepted' | 'autoDeleteAt' | 'primaryTarget' | 'charges' | 'bondAmount'>>
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

    // Delete reports and documents subcollections — timeout so they can't hang
    for (const subCol of ['reports', 'documents']) {
      try {
        const snap = await Promise.race([
          getDocs(collection(db, 'cases', id, subCol)),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (snap) {
          for (const d of snap.docs) {
            subDeletes.push(deleteDoc(d.ref).catch(() => {}));
          }
        }
      } catch { /* subcollection may not exist */ }
    }

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

// Document Text Persistence — store raw uploaded document text in Firestore
// so documents survive browser clears and are accessible across devices
export interface StoredDocument {
  id: string;
  name: string;
  text: string;
  date: string;
}

export async function saveDocumentText(
  caseId: string,
  docName: string,
  text: string
): Promise<void> {
  try {
    const db = await requireDb();
    const id = uuid.v4() as string;
    const now = new Date().toISOString();
    await setDoc(doc(db, 'cases', caseId, 'documents', id), {
      id,
      name: docName,
      text,
      date: now,
      syncedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[DB] saveDocumentText failed:', error);
  }
}

export async function deleteDocumentText(caseId: string, documentId: string): Promise<void> {
  try {
    const db = await requireDb();
    await deleteDoc(doc(db, 'cases', caseId, 'documents', documentId));
  } catch (error) {
    console.warn('[DB] deleteDocumentText failed:', error);
  }
}

export async function getDocumentsForCase(caseId: string): Promise<StoredDocument[]> {
  try {
    const db = await requireDb();
    const docsRef = collection(db, 'cases', caseId, 'documents');

    let snapshot: any = null;
    try {
      snapshot = await getDocsFromCache(docsRef);
    } catch {
      snapshot = await Promise.race([
        getDocs(docsRef),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
    }

    if (!snapshot || snapshot.docs.length === 0) return [];

    return snapshot.docs.map((d: any) => ({
      id: d.id,
      name: d.data().name,
      text: d.data().text,
      date: d.data().date,
    }));
  } catch (error) {
    console.warn('[DB] getDocumentsForCase failed:', error);
    return [];
  }
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
