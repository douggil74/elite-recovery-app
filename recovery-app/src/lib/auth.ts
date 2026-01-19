import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { STORAGE_KEYS, AUTH_TIMEOUT_MS } from '@/constants';

const isWeb = Platform.OS === 'web';

export interface AuthState {
  isLocked: boolean;
  passcodeEnabled: boolean;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  lastAuthTime: number | null;
}

// Helper functions for secure storage (AsyncStorage on web, SecureStore on native)
async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(key);
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
}

export async function checkBiometricsAvailable(): Promise<{
  available: boolean;
  types: number[];
}> {
  if (isWeb) {
    // Biometrics not available on web
    return { available: false, types: [] };
  }

  const LocalAuthentication = await import('expo-local-authentication');
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { available: false, types: [] };
  }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return { available: true, types };
}

export async function authenticateWithBiometrics(
  promptMessage: string = 'Authenticate to access case data'
): Promise<{ success: boolean; error?: string }> {
  if (isWeb) {
    return { success: false, error: 'Biometrics not available on web' };
  }

  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      await updateLastAuthTime();
      return { success: true };
    }

    return {
      success: false,
      error: result.error || 'Authentication failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication error',
    };
  }
}

export async function setPasscode(passcode: string): Promise<void> {
  // Hash the passcode before storing
  const hash = CryptoJS.SHA256(passcode).toString();
  await secureSet(STORAGE_KEYS.PASSCODE_HASH, hash);
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const storedHash = await secureGet(STORAGE_KEYS.PASSCODE_HASH);
  if (!storedHash) return false;

  const inputHash = CryptoJS.SHA256(passcode).toString();
  const isValid = inputHash === storedHash;

  if (isValid) {
    await updateLastAuthTime();
  }

  return isValid;
}

export async function hasPasscode(): Promise<boolean> {
  const hash = await secureGet(STORAGE_KEYS.PASSCODE_HASH);
  return hash !== null;
}

export async function removePasscode(): Promise<void> {
  await secureDelete(STORAGE_KEYS.PASSCODE_HASH);
}

export async function updateLastAuthTime(): Promise<void> {
  const now = Date.now().toString();
  await secureSet(STORAGE_KEYS.LAST_AUTH, now);
}

export async function getLastAuthTime(): Promise<number | null> {
  const stored = await secureGet(STORAGE_KEYS.LAST_AUTH);
  return stored ? parseInt(stored, 10) : null;
}

export async function isAuthValid(): Promise<boolean> {
  const lastAuth = await getLastAuthTime();
  if (!lastAuth) return false;

  const elapsed = Date.now() - lastAuth;
  return elapsed < AUTH_TIMEOUT_MS;
}

export async function shouldRequireAuth(
  passcodeEnabled: boolean,
  biometricsEnabled: boolean
): Promise<boolean> {
  // If no auth is enabled, no need to authenticate
  if (!passcodeEnabled && !biometricsEnabled) {
    return false;
  }

  // Check if recent authentication is still valid
  const isValid = await isAuthValid();
  return !isValid;
}

export async function clearAuthState(): Promise<void> {
  await secureDelete(STORAGE_KEYS.LAST_AUTH);
}

export function validatePasscodeStrength(passcode: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (passcode.length < 4) {
    errors.push('Passcode must be at least 4 digits');
  }

  if (passcode.length > 8) {
    errors.push('Passcode must be at most 8 digits');
  }

  if (!/^\d+$/.test(passcode)) {
    errors.push('Passcode must contain only numbers');
  }

  // Check for simple patterns
  const simplePatterns = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '4321'];
  if (simplePatterns.includes(passcode)) {
    errors.push('Passcode is too simple - avoid common patterns');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
