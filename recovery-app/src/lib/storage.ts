import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/constants';
import type { AppSettings } from '@/types';

const isWeb = Platform.OS === 'web';

// Web storage for PDFs (stores base64 data in AsyncStorage)
const WEB_PDF_STORAGE_KEY = 'bail_recovery_pdfs';

interface WebPdfStorage {
  [caseId: string]: {
    [filename: string]: {
      data: string; // base64
      size: number;
      createdAt: string;
    };
  };
}

async function getWebPdfStorage(): Promise<WebPdfStorage> {
  if (!isWeb) return {};
  try {
    const stored = await AsyncStorage.getItem(WEB_PDF_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function saveWebPdfStorage(storage: WebPdfStorage): Promise<void> {
  if (!isWeb) return;
  await AsyncStorage.setItem(WEB_PDF_STORAGE_KEY, JSON.stringify(storage));
}

export async function ensureDirectoryExists(dir: string): Promise<void> {
  if (isWeb) return; // No-op on web

  const FileSystem = await import('expo-file-system');
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function getCaseDirectory(caseId: string): Promise<string> {
  if (isWeb) {
    return `web://cases/${caseId}/`;
  }

  const FileSystem = await import('expo-file-system');
  const dir = FileSystem.documentDirectory + 'cases/' + caseId + '/';
  await ensureDirectoryExists(dir);
  return dir;
}

export async function pickPdfDocument(): Promise<{
  success: boolean;
  uri?: string;
  name?: string;
  data?: string; // base64 for web
  error?: string;
}> {
  if (isWeb) {
    // Web file picker using standard HTML input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,application/pdf,.txt,text/plain';
      input.style.display = 'none';

      // Must append to DOM for some browsers
      document.body.appendChild(input);

      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          cleanup();
          resolve({ success: false, error: 'No file selected' });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          cleanup();
          const result = reader.result;
          if (typeof result === 'string' && result.includes(',')) {
            const base64 = result.split(',')[1] || '';
            resolve({
              success: true,
              uri: URL.createObjectURL(file),
              name: file.name,
              data: base64,
            });
          } else {
            resolve({ success: false, error: 'Failed to read file data' });
          }
        };
        reader.onerror = () => {
          cleanup();
          resolve({ success: false, error: 'Failed to read file' });
        };
        reader.readAsDataURL(file);
      };

      // Handle cancel - input loses focus without change event
      input.addEventListener('cancel', () => {
        cleanup();
        resolve({ success: false, error: 'Cancelled' });
      });

      input.click();
    });
  }

  // Native: use expo-document-picker
  try {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return { success: false, error: 'Cancelled' };
    }

    const asset = result.assets[0];
    if (!asset) {
      return { success: false, error: 'No file selected' };
    }

    return {
      success: true,
      uri: asset.uri,
      name: asset.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pick document',
    };
  }
}

export async function savePdfToCase(
  sourceUri: string,
  caseId: string,
  filename: string,
  base64Data?: string
): Promise<string> {
  if (isWeb) {
    // Store PDF data in AsyncStorage for web
    const storage = await getWebPdfStorage();
    if (!storage[caseId]) {
      storage[caseId] = {};
    }
    storage[caseId][filename] = {
      data: base64Data || '',
      size: base64Data ? Math.round(base64Data.length * 0.75) : 0,
      createdAt: new Date().toISOString(),
    };
    await saveWebPdfStorage(storage);
    return `web://cases/${caseId}/${filename}`;
  }

  const FileSystem = await import('expo-file-system');
  const caseDir = await getCaseDirectory(caseId);
  const destPath = caseDir + filename;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destPath,
  });

  return destPath;
}

export async function deletePdfFile(filePath: string): Promise<void> {
  if (isWeb) {
    // Parse web path and remove from storage
    const match = filePath.match(/web:\/\/cases\/([^/]+)\/(.+)/);
    if (match) {
      const [, caseId, filename] = match;
      const storage = await getWebPdfStorage();
      if (storage[caseId]) {
        delete storage[caseId][filename];
        await saveWebPdfStorage(storage);
      }
    }
    return;
  }

  const FileSystem = await import('expo-file-system');
  const info = await FileSystem.getInfoAsync(filePath);
  if (info.exists) {
    await FileSystem.deleteAsync(filePath);
  }
}

export async function deleteCaseDirectory(caseId: string): Promise<void> {
  if (isWeb) {
    const storage = await getWebPdfStorage();
    delete storage[caseId];
    await saveWebPdfStorage(storage);
    return;
  }

  const FileSystem = await import('expo-file-system');
  const caseDir = FileSystem.documentDirectory + 'cases/' + caseId + '/';
  const info = await FileSystem.getInfoAsync(caseDir);
  if (info.exists) {
    await FileSystem.deleteAsync(caseDir, { idempotent: true });
  }
}

export async function readPdfAsBase64(filePath: string): Promise<string> {
  if (isWeb) {
    // Parse web path and get from storage
    const match = filePath.match(/web:\/\/cases\/([^/]+)\/(.+)/);
    if (match) {
      const [, caseId, filename] = match;
      const storage = await getWebPdfStorage();
      return storage[caseId]?.[filename]?.data || '';
    }
    return '';
  }

  const FileSystem = await import('expo-file-system');
  return await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

// Settings storage
export async function getSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED);
  return value === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
}

// File size helpers
export async function getFileSize(filePath: string): Promise<number> {
  if (isWeb) {
    const match = filePath.match(/web:\/\/cases\/([^/]+)\/(.+)/);
    if (match) {
      const [, caseId, filename] = match;
      const storage = await getWebPdfStorage();
      return storage[caseId]?.[filename]?.size || 0;
    }
    return 0;
  }

  const FileSystem = await import('expo-file-system');
  const info = await FileSystem.getInfoAsync(filePath, { size: true });
  return (info as any).size || 0;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Storage usage
export async function getStorageUsage(): Promise<{
  used: number;
  formatted: string;
}> {
  if (isWeb) {
    try {
      const storage = await getWebPdfStorage();
      let totalSize = 0;
      for (const caseId of Object.keys(storage)) {
        for (const filename of Object.keys(storage[caseId])) {
          totalSize += storage[caseId][filename].size || 0;
        }
      }
      return {
        used: totalSize,
        formatted: formatFileSize(totalSize),
      };
    } catch {
      return { used: 0, formatted: '0 B' };
    }
  }

  try {
    const FileSystem = await import('expo-file-system');
    const DOCUMENTS_DIR = FileSystem.documentDirectory + 'cases/';
    const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
    if (!info.exists) {
      return { used: 0, formatted: '0 B' };
    }

    let totalSize = 0;

    const scanDirectory = async (dir: string) => {
      const contents = await FileSystem.readDirectoryAsync(dir);
      for (const item of contents) {
        const itemPath = dir + item;
        const itemInfo = await FileSystem.getInfoAsync(itemPath, { size: true });
        if (itemInfo.isDirectory) {
          await scanDirectory(itemPath + '/');
        } else {
          totalSize += (itemInfo as any).size || 0;
        }
      }
    };

    await scanDirectory(DOCUMENTS_DIR);

    return {
      used: totalSize,
      formatted: formatFileSize(totalSize),
    };
  } catch {
    return { used: 0, formatted: '0 B' };
  }
}

// Clear all data
export async function clearAllData(): Promise<void> {
  if (isWeb) {
    // Clear web PDF storage
    await AsyncStorage.removeItem(WEB_PDF_STORAGE_KEY);
    // Clear async storage (except settings)
    const keys = await AsyncStorage.getAllKeys();
    const keysToRemove = keys.filter((k) => k !== STORAGE_KEYS.SETTINGS);
    await AsyncStorage.multiRemove(keysToRemove);
    return;
  }

  // Clear file storage
  const FileSystem = await import('expo-file-system');
  const DOCUMENTS_DIR = FileSystem.documentDirectory + 'cases/';
  const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(DOCUMENTS_DIR, { idempotent: true });
  }

  // Clear async storage (except settings)
  const keys = await AsyncStorage.getAllKeys();
  const keysToRemove = keys.filter((k) => k !== STORAGE_KEYS.SETTINGS);
  await AsyncStorage.multiRemove(keysToRemove);
}
