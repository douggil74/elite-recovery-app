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

// Hardcoded Firebase config for Elite Recovery
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCqfAmWsCdAOnJp_r3A_19boRcynTK639k",
  authDomain: "fugitive-database.firebaseapp.com",
  projectId: "fugitive-database",
  storageBucket: "fugitive-database.firebasestorage.app",
  messagingSenderId: "249201297502",
  appId: "1:249201297502:web:d054894322fc1ecc5b8ccf",
  measurementId: "G-FJWP0PBSR4"
};

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Initialize Firebase with hardcoded config
 */
export async function initializeFirebase(): Promise<Firestore | null> {
  if (db) return db;

  try {
    if (getApps().length === 0) {
      app = initializeApp(FIREBASE_CONFIG);
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
