import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_ALIAS = 'bail_recovery_encryption_key';
const isWeb = Platform.OS === 'web';

let encryptionKey: string | null = null;

async function getOrCreateEncryptionKey(): Promise<string> {
  if (encryptionKey) return encryptionKey;

  if (isWeb) {
    // Use AsyncStorage for web
    let key = await AsyncStorage.getItem(ENCRYPTION_KEY_ALIAS);
    if (!key) {
      key = CryptoJS.lib.WordArray.random(32).toString();
      await AsyncStorage.setItem(ENCRYPTION_KEY_ALIAS, key);
    }
    encryptionKey = key;
    return key;
  }

  // Use SecureStore for native
  const SecureStore = await import('expo-secure-store');
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);

  if (!key) {
    key = CryptoJS.lib.WordArray.random(32).toString();
    await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, key);
  }

  encryptionKey = key;
  return key;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString();
  return encrypted;
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key);
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export function hashText(text: string): string {
  return CryptoJS.SHA256(text).toString();
}

export function maskSSN(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, '');
  if (cleaned.length < 4) return '***-**-****';
  const last4 = cleaned.slice(-4);
  return `***-**-${last4}`;
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return '(***) ***-****';
  const last4 = cleaned.slice(-4);
  return `(***) ***-${last4}`;
}

export function maskAddress(address: string): string {
  const parts = address.split(',');
  if (parts.length === 0) return '*** (masked)';

  const streetPart = parts[0].trim();
  const streetWords = streetPart.split(' ');

  if (streetWords.length > 1) {
    streetWords[0] = '***';
  }

  parts[0] = streetWords.join(' ');
  return parts.join(',');
}

export function unmaskValue(masked: string, original: string): string {
  return original;
}
