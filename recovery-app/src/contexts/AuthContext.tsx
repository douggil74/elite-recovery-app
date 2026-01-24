/**
 * Authentication Context
 * Manages user authentication state across the app
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AuthUser,
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  signOut as firebaseSignOut,
  signInWithGoogle as firebaseSignInWithGoogle,
  getCurrentUser,
  subscribeToAuthChanges,
  resetPassword,
  initializeFirebase,
  getUserOrganization,
  Organization,
} from '@/lib/firebase';
import { setUserIdForSync, fetchSyncedSettings, syncSettings, migrateCasesToUser, pullCasesFromCloud } from '@/lib/sync';
import { createCase as dbCreateCase, getAllCases, getCase } from '@/lib/database';
import { getSettings, saveSettings } from '@/lib/storage';

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

// Sync settings and cases when user logs in
async function handleUserLogin(authUser: AuthUser): Promise<void> {
  // Set user ID in local settings for sync to work - this is critical
  await setUserIdForSync(authUser.uid);
  console.log('[Auth] User ID set for sync:', authUser.uid);

  // Run sync operations in background - don't block login
  setTimeout(async () => {
    try {
      // 1. Migrate any cases stored under deviceId to this userId
      console.log('[Auth] Migrating cases to user account...');
      await migrateCasesToUser(authUser.uid);

      // 2. Pull cases from cloud and save locally
      console.log('[Auth] Pulling cases from cloud...');
      const cloudCases = await Promise.race([
        pullCasesFromCloud(authUser.uid),
        new Promise<[]>((_, reject) => setTimeout(() => reject(new Error('Cases sync timeout')), 10000))
      ]);

      if (cloudCases && cloudCases.length > 0) {
        // Get local case IDs to avoid duplicates
        const localCases = await getAllCases();
        const localIds = new Set(localCases.map(c => c.id));
        let newCount = 0;

        // Save each case to local storage if not already there
        for (const cloudCase of cloudCases) {
          // Skip if case already exists locally
          if (localIds.has(cloudCase.id)) {
            continue;
          }

          try {
            await dbCreateCase(
              cloudCase.name,
              cloudCase.purpose || 'bail_recovery',
              cloudCase.internalCaseId,
              cloudCase.notes,
              cloudCase.ftaScore,
              cloudCase.ftaRiskLevel,
              {
                existingId: cloudCase.id,
                skipSync: true,
                mugshotUrl: cloudCase.mugshotUrl,
                bookingNumber: cloudCase.bookingNumber,
                jailSource: cloudCase.jailSource,
                charges: cloudCase.charges,
                bondAmount: cloudCase.bondAmount,
                rosterData: cloudCase.rosterData,
              }
            );
            newCount++;
          } catch (e: any) {
            console.warn('[Auth] Failed to save cloud case locally:', cloudCase.id, e);
          }
        }
        console.log(`[Auth] Synced ${newCount} new cases from cloud (${cloudCases.length} total in cloud)`);
      }

      // 3. Sync settings from cloud
      const cloudSettings = await Promise.race([
        fetchSyncedSettings(authUser.uid),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Settings sync timeout')), 5000))
      ]);

      if (cloudSettings) {
        await saveSettings(cloudSettings);
        console.log('[Auth] Loaded settings from cloud');
      } else {
        // No cloud settings, push local settings to cloud
        const localSettings = await getSettings();
        if (localSettings.anthropicApiKey || localSettings.openaiApiKey) {
          await syncSettings(authUser.uid, localSettings);
          console.log('[Auth] Pushed local settings to cloud');
        }
      }
    } catch (e) {
      console.warn('[Auth] Sync operations failed:', e);
    }
  }, 100);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      await initializeFirebase();

      // Check for existing session
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        if (currentUser.organizationId) {
          const org = await getUserOrganization(currentUser.organizationId);
          setOrganization(org);
        }
        // Sync settings for existing session
        await handleUserLogin(currentUser);
      }

      // Subscribe to auth changes
      unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
        if (firebaseUser) {
          const authUser = await getCurrentUser();
          setUser(authUser);
          if (authUser?.organizationId) {
            const org = await getUserOrganization(authUser.organizationId);
            setOrganization(org);
          }
        } else {
          setUser(null);
          setOrganization(null);
        }
        setLoading(false);
      });

      setLoading(false);
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await firebaseSignIn(email, password);
    if (result.user) {
      setUser(result.user);
      if (result.user.organizationId) {
        const org = await getUserOrganization(result.user.organizationId);
        setOrganization(org);
      }
      // Sync settings from cloud
      await handleUserLogin(result.user);
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  const signInWithGoogle = async () => {
    const result = await firebaseSignInWithGoogle();
    if (result.user) {
      setUser(result.user);
      if (result.user.organizationId) {
        const org = await getUserOrganization(result.user.organizationId);
        setOrganization(org);
      }
      // Sync settings from cloud
      await handleUserLogin(result.user);
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  const signUp = async (email: string, password: string, displayName: string, organizationName?: string) => {
    const result = await firebaseSignUp(email, password, displayName, organizationName);
    if (result.user) {
      setUser(result.user);
      if (result.user.organizationId) {
        const org = await getUserOrganization(result.user.organizationId);
        setOrganization(org);
      }
      // Sync settings from cloud (will push local to cloud for new user)
      await handleUserLogin(result.user);
      return { success: true, error: null };
    }
    return { success: false, error: result.error };
  };

  const signOut = async () => {
    await firebaseSignOut();
    setUser(null);
    setOrganization(null);
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
