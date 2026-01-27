/**
 * Authentication Context
 * Manages user authentication state across the app.
 * With cloud-first architecture, login just sets the userId for Firestore access.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthUser,
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  signOut as firebaseSignOut,
  signInWithGoogle as firebaseSignInWithGoogle,
  subscribeToAuthChanges,
  resetPassword,
  initializeFirebase,
  getUserOrganization,
  Organization,
} from '@/lib/firebase';
import { setCurrentUserId } from '@/lib/auth-state';
import { saveSettings, getSettings } from '@/lib/storage';
import { migrateLocalDataToFirestore } from '@/lib/database';
import { STORAGE_KEYS } from '@/constants';

interface AuthContextType {
  user: AuthUser | null;
  organization: Organization | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  signInWithGoogle: () => Promise<{ success: boolean; error: string | null }>;
  signUp: (email: string, password: string, displayName: string, organizationName?: string) => Promise<{ success: boolean; error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Set up auth state — fast, no blocking Firestore reads
async function handleUserLogin(authUser: AuthUser): Promise<void> {
  // Set userId in auth-state module so database.ts and storage.ts can access Firestore
  setCurrentUserId(authUser.uid);

  // Read settings from LOCAL cache only (instant) — no Firestore wait
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      const settings = JSON.parse(stored);
      console.log('[Auth] Settings from cache. API key present:', !!settings.openaiApiKey);
    } else {
      console.log('[Auth] No cached settings yet');
    }
  } catch (e) {
    console.warn('[Auth] Failed to read local settings:', e);
  }

  // Background: sync settings from Firestore (updates cache for next time)
  getSettings().catch(e => console.warn('[Auth] Background settings sync failed:', e));
  // Background: migrate old local data
  migrateLocalDataToFirestore()
    .then(migrated => { if (migrated > 0) console.log('[Auth] Migrated', migrated, 'cases'); })
    .catch(e => console.warn('[Auth] Migration failed:', e));
  // Background: save userId
  saveSettings({ userId: authUser.uid }).catch(() => {});

  console.log('[Auth] User logged in:', authUser.uid);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let isFirstCallback = true;

    const initAuth = async () => {
      await initializeFirebase();

      // Use onAuthStateChanged as the SINGLE source of truth for auth state.
      // The first callback fires once Firebase has restored the session from
      // IndexedDB — only then do we know if the user is logged in or not.
      // This avoids the race where getCurrentUser() returns null because
      // auth restoration hasn't completed yet.
      unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
        if (firebaseUser) {
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            role: 'agent',
          };
          setUser(authUser);
          await handleUserLogin(authUser);
          // Load org and extended profile in background
          if (authUser.organizationId) {
            getUserOrganization(authUser.organizationId)
              .then(org => setOrganization(org)).catch(() => {});
          }
        } else {
          setUser(null);
          setOrganization(null);
          setCurrentUserId(null);
        }

        // Only set loading=false after the first callback (auth state resolved)
        if (isFirstCallback) {
          isFirstCallback = false;
          setLoading(false);
        }
      });
    };

    initAuth();

    // Safety: if auth restoration takes longer than 5s, stop blocking the UI.
    // The user will see the login screen and can sign in manually.
    const safetyTimeout = setTimeout(() => {
      if (isFirstCallback) {
        console.warn('[Auth] Auth state took >5s to resolve, unblocking UI');
        isFirstCallback = false;
        setLoading(false);
      }
    }, 5000);

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await firebaseSignIn(email, password);
    if (result.user) {
      setUser(result.user);
      await handleUserLogin(result.user);
      // Org lookup in background
      if (result.user.organizationId) {
        getUserOrganization(result.user.organizationId)
          .then(org => setOrganization(org)).catch(() => {});
      }
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  const signInWithGoogle = async () => {
    const result = await firebaseSignInWithGoogle();
    if (result.user) {
      setUser(result.user);
      await handleUserLogin(result.user);
      if (result.user.organizationId) {
        getUserOrganization(result.user.organizationId)
          .then(org => setOrganization(org)).catch(() => {});
      }
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  const signUp = async (email: string, password: string, displayName: string, organizationName?: string) => {
    const result = await firebaseSignUp(email, password, displayName, organizationName);
    if (result.user) {
      setUser(result.user);
      await handleUserLogin(result.user);
      if (result.user.organizationId) {
        getUserOrganization(result.user.organizationId)
          .then(org => setOrganization(org)).catch(() => {});
      }
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  const signOut = async () => {
    await firebaseSignOut();
    setUser(null);
    setOrganization(null);
    setCurrentUserId(null);
    // Clear local cache on sign out but PRESERVE settings (API keys)
    try {
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(k => k !== STORAGE_KEYS.SETTINGS);
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (e) {
      console.warn('[Auth] Failed to clear local cache:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
