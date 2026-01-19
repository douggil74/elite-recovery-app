/**
 * Firebase Configuration and Initialization
 *
 * Setup:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Firestore Database
 * 3. Copy your config values to Settings in the app (or .env)
 * 4. Set Firestore rules for security
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
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
} from 'firebase/firestore';
import { getSettings } from './storage';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Initialize Firebase with config from settings
 */
export async function initializeFirebase(): Promise<Firestore | null> {
  if (db) return db;

  try {
    const settings = await getSettings();

    if (!settings.firebaseConfig) {
      console.log('Firebase not configured - using local storage only');
      return null;
    }

    const config: FirebaseConfig = JSON.parse(settings.firebaseConfig);

    if (!config.projectId || !config.apiKey) {
      console.log('Invalid Firebase config');
      return null;
    }

    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }

    db = getFirestore(app);
    console.log('Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return null;
  }
}

/**
 * Get Firestore instance (initializes if needed)
 */
export async function getDb(): Promise<Firestore | null> {
  if (db) return db;
  return initializeFirebase();
}

/**
 * Check if Firebase is configured and ready
 */
export async function isFirebaseReady(): Promise<boolean> {
  const firestore = await getDb();
  return firestore !== null;
}

// Re-export Firestore utilities for convenience
export {
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
};
