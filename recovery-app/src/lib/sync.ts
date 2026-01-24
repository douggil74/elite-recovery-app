/**
 * Cloud Sync Service
 * Syncs cases, reports, and chat history to Firebase Firestore
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDb,
  isFirebaseReady,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from './firebase';
import { getSettings, saveSettings } from './storage';
import type { Case, Report, AppSettings } from '@/types';

// Device ID for identifying this device
let deviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;

  const stored = await AsyncStorage.getItem('device_id');
  if (stored) {
    deviceId = stored;
    return deviceId;
  }

  // Generate a new device ID
  deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  await AsyncStorage.setItem('device_id', deviceId);
  return deviceId;
}

// User ID from settings (for multi-device sync)
async function getUserId(): Promise<string | null> {
  const settings = await getSettings();
  return settings.userId || null;
}

/**
 * Check if cloud sync is enabled
 */
export async function isSyncEnabled(): Promise<boolean> {
  return isFirebaseReady();
}

/**
 * Sync a case to Firestore
 */
export async function syncCase(caseData: Case): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const userId = await getUserId();
    const caseRef = doc(db, 'cases', caseData.id);

    await setDoc(caseRef, {
      ...caseData,
      userId: userId || await getDeviceId(),
      syncedAt: serverTimestamp(),
      updatedAt: caseData.updatedAt,
      createdAt: caseData.createdAt,
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Failed to sync case:', error);
    return false;
  }
}

/**
 * Sync a report to Firestore
 */
export async function syncReport(caseId: string, report: Report): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const reportRef = doc(db, 'cases', caseId, 'reports', report.id);

    await setDoc(reportRef, {
      ...report,
      syncedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Failed to sync report:', error);
    return false;
  }
}

/**
 * Sync chat history to Firestore
 */
export async function syncChat(caseId: string, messages: any[]): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const chatRef = doc(db, 'cases', caseId, 'chat', 'history');

    await setDoc(chatRef, {
      messages,
      syncedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Failed to sync chat:', error);
    return false;
  }
}

/**
 * Sync target photo to Firestore
 */
export async function syncPhoto(caseId: string, photoDataUrl: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const photoRef = doc(db, 'cases', caseId, 'photo', 'target');

    await setDoc(photoRef, {
      dataUrl: photoDataUrl,
      syncedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Failed to sync photo:', error);
    return false;
  }
}

/**
 * Delete a case from Firestore
 */
export async function deleteSyncedCase(caseId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Delete chat
    await deleteDoc(doc(db, 'cases', caseId, 'chat', 'history'));

    // Delete photo
    await deleteDoc(doc(db, 'cases', caseId, 'photo', 'target'));

    // Delete reports
    const reportsSnap = await getDocs(collection(db, 'cases', caseId, 'reports'));
    for (const reportDoc of reportsSnap.docs) {
      await deleteDoc(reportDoc.ref);
    }

    // Delete case
    await deleteDoc(doc(db, 'cases', caseId));

    return true;
  } catch (error) {
    console.error('Failed to delete synced case:', error);
    return false;
  }
}

/**
 * Fetch all cases from Firestore for this user/device
 */
export async function fetchSyncedCases(): Promise<Case[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const userId = await getUserId();
    const identifier = userId || await getDeviceId();

    const casesQuery = query(
      collection(db, 'cases'),
      where('userId', '==', identifier),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(casesQuery);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      } as Case;
    });
  } catch (error) {
    console.error('Failed to fetch synced cases:', error);
    return [];
  }
}

/**
 * Fetch chat history for a case from Firestore
 */
export async function fetchSyncedChat(caseId: string): Promise<any[] | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const chatRef = doc(db, 'cases', caseId, 'chat', 'history');
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      return chatSnap.data().messages || [];
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch synced chat:', error);
    return null;
  }
}

/**
 * Fetch target photo for a case from Firestore
 */
export async function fetchSyncedPhoto(caseId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const photoRef = doc(db, 'cases', caseId, 'photo', 'target');
    const photoSnap = await getDoc(photoRef);

    if (photoSnap.exists()) {
      return photoSnap.data().dataUrl || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch synced photo:', error);
    return null;
  }
}

/**
 * Subscribe to realtime updates for a case's chat
 */
export function subscribeToChatUpdates(
  caseId: string,
  callback: (messages: any[]) => void
): () => void {
  let unsubscribe = () => {};

  (async () => {
    const db = await getDb();
    if (!db) return;

    const chatRef = doc(db, 'cases', caseId, 'chat', 'history');
    unsubscribe = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const messages = snap.data().messages || [];
        callback(messages);
      }
    });
  })();

  return () => unsubscribe();
}

/**
 * Full sync - push all local data to cloud
 */
export async function pushAllToCloud(
  cases: Case[],
  getReportsForCase: (caseId: string) => Promise<Report[]>
): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const caseData of cases) {
    const success = await syncCase(caseData);
    if (success) {
      synced++;

      // Sync reports
      const reports = await getReportsForCase(caseData.id);
      for (const report of reports) {
        await syncReport(caseData.id, report);
      }

      // Sync chat
      const chat = await AsyncStorage.getItem(`case_chat_${caseData.id}`);
      if (chat) {
        await syncChat(caseData.id, JSON.parse(chat));
      }

      // Sync photo
      const photo = await AsyncStorage.getItem(`case_photo_${caseData.id}`);
      if (photo) {
        await syncPhoto(caseData.id, photo);
      }
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Sync settings to Firestore for a user
 */
export async function syncSettings(userId: string, settings: Partial<AppSettings>): Promise<boolean> {
  const db = await getDb();
  if (!db || !userId) return false;

  try {
    const settingsRef = doc(db, 'users', userId, 'data', 'settings');

    // Don't sync passcode-related settings for security
    const { passcode, ...safeSettings } = settings as any;

    await setDoc(settingsRef, {
      ...safeSettings,
      syncedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Failed to sync settings:', error);
    return false;
  }
}

/**
 * Fetch settings from Firestore for a user
 */
export async function fetchSyncedSettings(userId: string): Promise<Partial<AppSettings> | null> {
  const db = await getDb();
  if (!db || !userId) return null;

  try {
    const settingsRef = doc(db, 'users', userId, 'data', 'settings');
    const settingsSnap = await getDoc(settingsRef);

    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      // Remove Firestore metadata
      const { syncedAt, ...settings } = data;
      return settings as Partial<AppSettings>;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch synced settings:', error);
    return null;
  }
}

/**
 * Set user ID in local settings and return it
 */
export async function setUserIdForSync(userId: string): Promise<void> {
  await saveSettings({ userId });
}

/**
 * Migrate cases from deviceId to userId on first login
 * This handles cases created before user logged in
 */
export async function migrateCasesToUser(userId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const deviceId = await getDeviceId();

    // Find all cases with this deviceId
    const deviceCasesQuery = query(
      collection(db, 'cases'),
      where('userId', '==', deviceId)
    );

    const snapshot = await getDocs(deviceCasesQuery);
    let migrated = 0;

    for (const docSnap of snapshot.docs) {
      try {
        // Update the case to use the new userId
        await setDoc(doc(db, 'cases', docSnap.id), {
          userId: userId,
          migratedAt: serverTimestamp(),
        }, { merge: true });
        migrated++;
      } catch (e) {
        console.warn('[Sync] Failed to migrate case:', docSnap.id, e);
      }
    }

    console.log(`[Sync] Migrated ${migrated} cases from device to user account`);
    return migrated;
  } catch (error) {
    console.error('[Sync] Migration failed:', error);
    return 0;
  }
}

/**
 * Fetch cases from cloud and save to local storage
 * Call this on login to pull down user's cases
 */
export async function pullCasesFromCloud(userId: string): Promise<Case[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Query for cases belonging to this user
    const casesQuery = query(
      collection(db, 'cases'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(casesQuery);

    const cases: Case[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      } as Case;
    });

    console.log(`[Sync] Pulled ${cases.length} cases from cloud for user ${userId}`);
    return cases;
  } catch (error) {
    console.error('[Sync] Failed to pull cases:', error);
    return [];
  }
}
