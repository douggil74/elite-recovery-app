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
