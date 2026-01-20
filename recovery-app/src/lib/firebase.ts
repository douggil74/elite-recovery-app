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
  updateDoc,
} from 'firebase/firestore';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getSettings } from './storage';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

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
    auth = getAuth(app);
    console.log('Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return null;
  }
}

/**
 * Get Auth instance
 */
export function getAuthInstance(): Auth | null {
  if (!auth && app) {
    auth = getAuth(app);
  }
  return auth;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  organizationId?: string;
  role?: 'admin' | 'agent' | 'viewer';
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    await initializeFirebase();
    const authInstance = getAuthInstance();
    if (!authInstance) {
      return { user: null, error: 'Auth not initialized' };
    }

    const credential = await signInWithEmailAndPassword(authInstance, email, password);

    // Get user profile from Firestore
    const userDoc = await getDoc(doc(db!, 'users', credential.user.uid));
    const userData = userDoc.data();

    return {
      user: {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
        organizationId: userData?.organizationId,
        role: userData?.role || 'agent',
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return { user: null, error: error.message || 'Failed to sign in' };
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    await initializeFirebase();
    const authInstance = getAuthInstance();
    if (!authInstance || !db) {
      return { user: null, error: 'Firebase not initialized' };
    }

    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(authInstance, provider);

    // Check if user profile exists
    const userDoc = await getDoc(doc(db, 'users', credential.user.uid));

    if (!userDoc.exists()) {
      // Create user profile for new Google users
      const defaultOrgRef = doc(collection(db, 'organizations'));
      const organizationId = defaultOrgRef.id;

      await setDoc(defaultOrgRef, {
        name: `${credential.user.displayName}'s Organization`,
        createdAt: serverTimestamp(),
        createdBy: credential.user.uid,
        plan: 'free',
        memberCount: 1,
      });

      await setDoc(doc(db, 'users', credential.user.uid), {
        email: credential.user.email,
        displayName: credential.user.displayName,
        organizationId,
        role: 'admin',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });

      return {
        user: {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: credential.user.displayName,
          organizationId,
          role: 'admin',
        },
        error: null,
      };
    }

    const userData = userDoc.data();

    // Update last login
    await updateDoc(doc(db, 'users', credential.user.uid), {
      lastLogin: serverTimestamp(),
    });

    return {
      user: {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
        organizationId: userData?.organizationId,
        role: userData?.role || 'agent',
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    return { user: null, error: error.message || 'Failed to sign in with Google' };
  }
}

/**
 * Sign up new user
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
  organizationName?: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    await initializeFirebase();
    const authInstance = getAuthInstance();
    if (!authInstance) {
      return { user: null, error: 'Firebase not initialized' };
    }

    // Create auth user first
    const credential = await createUserWithEmailAndPassword(authInstance, email, password);

    // Update display name
    await updateProfile(credential.user, { displayName });

    // Try to create Firestore profile (but don't fail if it doesn't work)
    let organizationId: string | undefined;

    if (db) {
      try {
        if (organizationName) {
          const orgRef = doc(collection(db, 'organizations'));
          organizationId = orgRef.id;

          await setDoc(orgRef, {
            name: organizationName,
            createdAt: serverTimestamp(),
            createdBy: credential.user.uid,
            plan: 'free',
            memberCount: 1,
          });
        } else {
          organizationId = `personal_${credential.user.uid}`;

          await setDoc(doc(db, 'organizations', organizationId), {
            name: `${displayName}'s Workspace`,
            createdAt: serverTimestamp(),
            createdBy: credential.user.uid,
            plan: 'free',
            memberCount: 1,
            isPersonal: true,
          });
        }

        await setDoc(doc(db, 'users', credential.user.uid), {
          email,
          displayName,
          organizationId,
          role: 'admin',
          createdAt: serverTimestamp(),
        });
      } catch (firestoreError) {
        console.warn('Firestore profile creation failed, continuing:', firestoreError);
        // Continue anyway - auth user was created
      }
    }

    return {
      user: {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName,
        organizationId,
        role: 'admin',
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return { user: null, error: error.message || 'Failed to create account' };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const authInstance = getAuthInstance();
  if (authInstance) {
    await firebaseSignOut(authInstance);
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
  try {
    await initializeFirebase();
    const authInstance = getAuthInstance();
    if (!authInstance) {
      return { success: false, error: 'Auth not initialized' };
    }

    await sendPasswordResetEmail(authInstance, email);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send reset email' };
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  await initializeFirebase();
  const authInstance = getAuthInstance();
  if (!authInstance?.currentUser) return null;

  const user = authInstance.currentUser;

  // Get user profile from Firestore
  const userDoc = await getDoc(doc(db!, 'users', user.uid));
  const userData = userDoc.data();

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    organizationId: userData?.organizationId,
    role: userData?.role || 'agent',
  };
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  const authInstance = getAuthInstance();
  if (!authInstance) {
    console.warn('Auth not initialized for subscription');
    return () => {};
  }
  return onAuthStateChanged(authInstance, callback);
}

// ============================================================================
// ORGANIZATION MANAGEMENT
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  memberCount: number;
  createdAt: Date;
  createdBy: string;
  isPersonal?: boolean;
}

/**
 * Get user's organization
 */
export async function getUserOrganization(organizationId: string): Promise<Organization | null> {
  await initializeFirebase();
  if (!db) return null;

  const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
  if (!orgDoc.exists()) return null;

  const data = orgDoc.data();
  return {
    id: orgDoc.id,
    name: data.name,
    plan: data.plan || 'free',
    memberCount: data.memberCount || 1,
    createdAt: data.createdAt?.toDate() || new Date(),
    createdBy: data.createdBy,
    isPersonal: data.isPersonal,
  };
}

/**
 * Invite user to organization
 */
export async function inviteToOrganization(
  organizationId: string,
  email: string,
  role: 'admin' | 'agent' | 'viewer' = 'agent'
): Promise<{ success: boolean; error: string | null }> {
  await initializeFirebase();
  if (!db) return { success: false, error: 'Database not initialized' };

  try {
    await setDoc(doc(collection(db, 'invitations')), {
      organizationId,
      email,
      role,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
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
  updateDoc,
};

// Re-export Auth types
export type { User };
