import { useState, useEffect, useCallback } from 'react';
import {
  checkBiometricsAvailable,
  authenticateWithBiometrics,
  verifyPasscode,
  hasPasscode,
  setPasscode as setStoredPasscode,
  removePasscode,
  shouldRequireAuth,
  clearAuthState,
} from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/storage';
import type { AppSettings } from '@/types';

export interface UseAuthReturn {
  isLoading: boolean;
  isLocked: boolean;
  passcodeEnabled: boolean;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  authenticate: () => Promise<{ success: boolean; error?: string }>;
  authenticateWithPasscode: (code: string) => Promise<{ success: boolean; error?: string }>;
  enablePasscode: (code: string) => Promise<{ success: boolean; error?: string }>;
  disablePasscode: () => Promise<void>;
  enableBiometrics: () => Promise<{ success: boolean; error?: string }>;
  disableBiometrics: () => Promise<void>;
  lock: () => Promise<void>;
  checkLockStatus: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [passcodeEnabled, setPasscodeEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  // Initialize auth state
  useEffect(() => {
    const init = async () => {
      try {
        // Check biometrics availability
        const bioCheck = await checkBiometricsAvailable();
        setBiometricsAvailable(bioCheck.available);

        // Check if passcode is set
        const hasPass = await hasPasscode();
        setPasscodeEnabled(hasPass);

        // Get settings
        const settings = await getSettings();
        setBiometricsEnabled(settings.biometricsEnabled && bioCheck.available);

        // Check if auth is required
        const needsAuth = await shouldRequireAuth(
          hasPass,
          settings.biometricsEnabled && bioCheck.available
        );
        setIsLocked(needsAuth);
      } catch (error) {
        console.error('Auth init error:', error);
        setIsLocked(true);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const checkLockStatus = useCallback(async (): Promise<boolean> => {
    const needsAuth = await shouldRequireAuth(passcodeEnabled, biometricsEnabled);
    setIsLocked(needsAuth);
    return needsAuth;
  }, [passcodeEnabled, biometricsEnabled]);

  const authenticate = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (biometricsEnabled) {
      const result = await authenticateWithBiometrics();
      if (result.success) {
        setIsLocked(false);
      }
      return result;
    }
    return { success: false, error: 'No authentication method available' };
  }, [biometricsEnabled]);

  const authenticateWithPasscode = useCallback(
    async (code: string): Promise<{ success: boolean; error?: string }> => {
      const isValid = await verifyPasscode(code);
      if (isValid) {
        setIsLocked(false);
        return { success: true };
      }
      return { success: false, error: 'Invalid passcode' };
    },
    []
  );

  const enablePasscode = useCallback(
    async (code: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await setStoredPasscode(code);
        setPasscodeEnabled(true);
        await saveSettings({ passcodeEnabled: true });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set passcode',
        };
      }
    },
    []
  );

  const disablePasscode = useCallback(async () => {
    await removePasscode();
    setPasscodeEnabled(false);
    await saveSettings({ passcodeEnabled: false });
  }, []);

  const enableBiometrics = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!biometricsAvailable) {
      return { success: false, error: 'Biometrics not available' };
    }

    // Test that biometrics works
    const result = await authenticateWithBiometrics('Enable biometric login');
    if (result.success) {
      setBiometricsEnabled(true);
      await saveSettings({ biometricsEnabled: true });
    }
    return result;
  }, [biometricsAvailable]);

  const disableBiometrics = useCallback(async () => {
    setBiometricsEnabled(false);
    await saveSettings({ biometricsEnabled: false });
  }, []);

  const lock = useCallback(async () => {
    await clearAuthState();
    setIsLocked(true);
  }, []);

  return {
    isLoading,
    isLocked,
    passcodeEnabled,
    biometricsEnabled,
    biometricsAvailable,
    authenticate,
    authenticateWithPasscode,
    enablePasscode,
    disablePasscode,
    enableBiometrics,
    disableBiometrics,
    lock,
    checkLockStatus,
  };
}
