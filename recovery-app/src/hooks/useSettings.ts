import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings as storageSaveSettings } from '@/lib/storage';
import { syncSettings, isSyncEnabled } from '@/lib/sync';
import type { AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/constants';

export interface UseSettingsReturn {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  reloadSettings: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      const loaded = await getSettings();
      setSettings(loaded);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await storageSaveSettings(updates);

    // Sync to cloud if enabled and user is logged in
    try {
      const syncEnabled = await isSyncEnabled();
      const currentSettings = await getSettings();
      if (syncEnabled && currentSettings.userId) {
        await syncSettings(currentSettings.userId, updates);
        console.log('[Settings] Synced to cloud');
      }
    } catch (e) {
      console.warn('[Settings] Cloud sync failed:', e);
    }
  }, [settings]);

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await storageSaveSettings(DEFAULT_SETTINGS);
  }, []);

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    await load();
  }, []);

  return {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
    reloadSettings,
  };
}
