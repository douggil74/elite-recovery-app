/**
 * Cloud Sync Service (Simplified)
 * With cloud-first architecture, cases and reports are written directly to Firestore
 * by database.ts. This module handles chat/photo sync and real-time subscriptions.
 */

import {
  getDb,
  isFirebaseReady,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from './firebase';
import { getCurrentUserId } from './auth-state';
import { pendingDeletes } from './database';
import type { Case } from '@/types';

/**
 * Check if cloud sync is enabled
 */
export async function isSyncEnabled(): Promise<boolean> {
  return isFirebaseReady();
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
 * Fetch chat history for a case from Firestore
 */
export async function fetchSyncedChat(caseId: string): Promise<any[] | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const chatRef = doc(db, 'cases', caseId, 'chat', 'history');

    // Simple read with timeout — Firestore SDK handles cache internally
    const chatSnap = await Promise.race([
      getDoc(chatRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (chatSnap && chatSnap.exists()) {
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

    // Simple read with timeout — Firestore SDK handles cache internally
    const photoSnap = await Promise.race([
      getDoc(photoRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (photoSnap && photoSnap.exists()) {
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
 * Subscribe to realtime updates for ALL cases
 * Uses getCurrentUserId from auth-state module
 */
export function subscribeToAllCases(
  callback: (cases: Case[]) => void
): () => void {
  let unsubscribe = () => {};

  (async () => {
    const db = await getDb();
    if (!db) return;

    const userId = getCurrentUserId();
    if (!userId) {
      console.log('[Sync] No userId, skipping real-time subscription');
      return;
    }
    console.log('[Sync] Subscribing to cases for userId:', userId);

    const casesQuery = query(
      collection(db, 'cases'),
      where('userId', '==', userId)
    );

    unsubscribe = onSnapshot(casesQuery, (snapshot) => {
      console.log('[Sync] onSnapshot fired, docs:', snapshot.docs.length, 'fromCache:', snapshot.metadata.fromCache);
      const cases: Case[] = snapshot.docs
        .filter(docSnap => !pendingDeletes.has(docSnap.id))
        .map(docSnap => {
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
      console.log(`[Sync] Real-time update: ${cases.length} cases (${pendingDeletes.size} pending deletes filtered)`);
      callback(cases);
    }, (error) => {
      console.error('[Sync] Real-time subscription error:', error.code, error.message);
    });
  })();

  return () => unsubscribe();
}

/**
 * Subscribe to realtime updates for a single case
 */
export function subscribeToCaseUpdates(
  caseId: string,
  callback: (caseData: Case | null) => void
): () => void {
  let unsubscribe = () => {};

  (async () => {
    const db = await getDb();
    if (!db) return;

    const caseRef = doc(db, 'cases', caseId);
    unsubscribe = onSnapshot(caseRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback({
          ...data,
          id: snap.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as Case);
      } else {
        callback(null);
      }
    });
  })();

  return () => unsubscribe();
}
