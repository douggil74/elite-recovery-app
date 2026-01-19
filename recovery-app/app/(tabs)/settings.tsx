import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { getStorageUsage, clearAllData } from '@/lib/storage';
import { confirm, showAlert } from '@/lib/confirm';
import { Button, Input } from '@/components';
import { COLORS, VERSION } from '@/constants';

export default function SettingsScreen() {
  const {
    passcodeEnabled,
    biometricsEnabled,
    biometricsAvailable,
    enablePasscode,
    disablePasscode,
    enableBiometrics,
    disableBiometrics,
    lock,
  } = useAuth();

  const { settings, updateSettings } = useSettings();
  const [storageUsed, setStorageUsed] = useState('0 B');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(settings.openaiApiKey || '');
  const [newPasscode, setNewPasscode] = useState('');
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState(settings.firebaseConfig || '');
  const [userId, setUserId] = useState(settings.userId || '');

  useEffect(() => {
    loadStorageUsage();
  }, []);

  useEffect(() => {
    setApiKey(settings.openaiApiKey || '');
    setFirebaseConfig(settings.firebaseConfig || '');
    setUserId(settings.userId || '');
  }, [settings.openaiApiKey, settings.firebaseConfig, settings.userId]);

  const loadStorageUsage = async () => {
    const usage = await getStorageUsage();
    setStorageUsed(usage.formatted);
  };

  const handlePasscodeToggle = async () => {
    if (passcodeEnabled) {
      const confirmed = await confirm({
        title: 'Disable Passcode',
        message: 'Are you sure you want to disable the passcode lock?',
        confirmText: 'Disable',
        destructive: true,
      });
      if (confirmed) {
        disablePasscode();
      }
    } else {
      setShowPasscodeSetup(true);
    }
  };

  const handleSetPasscode = async () => {
    if (newPasscode.length < 4) {
      showAlert('Error', 'Passcode must be at least 4 digits');
      return;
    }
    const result = await enablePasscode(newPasscode);
    if (result.success) {
      setShowPasscodeSetup(false);
      setNewPasscode('');
      showAlert('Success', 'Passcode has been set');
    } else {
      showAlert('Error', result.error || 'Failed to set passcode');
    }
  };

  const handleBiometricsToggle = async () => {
    if (biometricsEnabled) {
      disableBiometrics();
    } else {
      const result = await enableBiometrics();
      if (!result.success) {
        showAlert('Error', result.error || 'Failed to enable biometrics');
      }
    }
  };

  const handleAutoDeleteChange = (days: number | null) => {
    updateSettings({ autoDeleteDays: days });
  };

  const handleSaveApiKey = () => {
    updateSettings({ openaiApiKey: apiKey || undefined });
    setShowApiKeyInput(false);
    showAlert('Success', apiKey ? 'API key saved' : 'API key removed');
  };

  const handleSaveFirebase = () => {
    // Clean up the config - remove whitespace and newlines
    const cleanConfig = firebaseConfig.trim().replace(/\s+/g, '').replace(/[\n\r]/g, '');

    // Validate JSON if provided
    if (cleanConfig) {
      try {
        const parsed = JSON.parse(cleanConfig);
        if (!parsed.projectId || !parsed.apiKey) {
          showAlert('Invalid Config', 'Firebase config must include projectId and apiKey');
          return;
        }
        // Save the cleaned version
        updateSettings({
          firebaseConfig: cleanConfig,
          userId: userId.trim() || undefined,
          storageMode: 'cloud',
        });
        setShowFirebaseSetup(false);
        showAlert('Success', 'Cloud sync enabled');
      } catch (e) {
        console.error('JSON parse error:', e);
        showAlert('Invalid JSON', 'Could not parse config. Make sure all keys have quotes.');
        return;
      }
    } else {
      updateSettings({
        firebaseConfig: undefined,
        userId: userId.trim() || undefined,
        storageMode: 'local',
      });
      setShowFirebaseSetup(false);
      showAlert('Success', 'Cloud sync disabled');
    }
  };

  const handleClearData = async () => {
    const confirmed = await confirm({
      title: 'Clear All Data',
      message: 'This will permanently delete all cases, reports, and settings. This action cannot be undone.',
      confirmText: 'Clear All',
      destructive: true,
    });

    if (confirmed) {
      await clearAllData();
      loadStorageUsage();
      showAlert('Done', 'All data has been cleared');
    }
  };

  const handleLockNow = () => {
    lock();
  };

  const autoDeleteOptions = [
    { label: 'Never', value: null },
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Security Section */}
      <Text style={styles.sectionTitle}>Security</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Passcode Lock</Text>
            <Text style={styles.settingDescription}>
              Require passcode to access the app
            </Text>
          </View>
          <Switch
            value={passcodeEnabled}
            onValueChange={handlePasscodeToggle}
            trackColor={{ true: COLORS.primary }}
          />
        </View>

        {showPasscodeSetup && (
          <View style={styles.passcodeSetup}>
            <TextInput
              style={styles.passcodeInput}
              value={newPasscode}
              onChangeText={setNewPasscode}
              placeholder="Enter 4-8 digit passcode"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
            <View style={styles.passcodeButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                size="small"
                onPress={() => {
                  setShowPasscodeSetup(false);
                  setNewPasscode('');
                }}
              />
              <Button
                title="Set Passcode"
                size="small"
                onPress={handleSetPasscode}
              />
            </View>
          </View>
        )}

        {biometricsAvailable && (
          <View style={[styles.settingRow, styles.settingRowBorder]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Face ID / Touch ID</Text>
              <Text style={styles.settingDescription}>
                Use biometrics for quick unlock
              </Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleBiometricsToggle}
              trackColor={{ true: COLORS.primary }}
            />
          </View>
        )}

        {(passcodeEnabled || biometricsEnabled) && (
          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowBorder]}
            onPress={handleLockNow}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: COLORS.primary }]}>
                Lock Now
              </Text>
            </View>
            <Ionicons name="lock-closed" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* AI Analysis Section */}
      <Text style={styles.sectionTitle}>AI Analysis</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowApiKeyInput(!showApiKeyInput)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>OpenAI API Key</Text>
            <Text style={styles.settingDescription}>
              {settings.openaiApiKey ? 'Key configured' : 'Not configured'}
            </Text>
          </View>
          <Ionicons
            name={showApiKeyInput ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>

        {showApiKeyInput && (
          <View style={styles.apiKeySetup}>
            <TextInput
              style={styles.apiKeyInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.apiKeyHint}>
              Get your API key from platform.openai.com
            </Text>
            <Button title="Save API Key" onPress={handleSaveApiKey} size="small" />
          </View>
        )}
      </View>

      {/* Cloud Sync Section */}
      <Text style={styles.sectionTitle}>Cloud Sync</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowFirebaseSetup(!showFirebaseSetup)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Firebase Configuration</Text>
            <Text style={styles.settingDescription}>
              {settings.firebaseConfig ? 'Cloud sync enabled' : 'Local only'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Ionicons
              name={settings.firebaseConfig ? 'cloud-done' : 'cloud-offline'}
              size={14}
              color={settings.firebaseConfig ? COLORS.success : COLORS.textSecondary}
            />
            <Text style={[styles.badgeText, !settings.firebaseConfig && { color: COLORS.textSecondary }]}>
              {settings.firebaseConfig ? 'Synced' : 'Local'}
            </Text>
          </View>
        </TouchableOpacity>

        {showFirebaseSetup && (
          <View style={styles.apiKeySetup}>
            <Text style={styles.apiKeyHint}>
              Paste your Firebase config JSON from Firebase Console {'->'} Project Settings {'->'} Web App
            </Text>
            <TextInput
              style={[styles.apiKeyInput, { height: 120, textAlignVertical: 'top' }]}
              value={firebaseConfig}
              onChangeText={setFirebaseConfig}
              placeholder='{"apiKey": "...", "projectId": "...", ...}'
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.apiKeyHint, { marginTop: 12 }]}>
              User ID (for multi-device sync - use same ID on all devices)
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              value={userId}
              onChangeText={setUserId}
              placeholder="your-email@example.com"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button title="Save Firebase Config" onPress={handleSaveFirebase} size="small" style={{ marginTop: 12 }} />
          </View>
        )}
      </View>

      {/* Data Management Section */}
      <Text style={styles.sectionTitle}>Data Management</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Storage Mode</Text>
            <Text style={styles.settingDescription}>
              {settings.storageMode === 'local'
                ? 'Local only (more secure)'
                : 'Cloud sync enabled'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Ionicons
              name={settings.storageMode === 'cloud' ? 'cloud-done' : 'shield-checkmark'}
              size={14}
              color={COLORS.success}
            />
            <Text style={styles.badgeText}>{settings.storageMode === 'cloud' ? 'Cloud' : 'Local'}</Text>
          </View>
        </View>

        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-Delete Cases</Text>
            <Text style={styles.settingDescription}>
              Automatically delete cases after
            </Text>
          </View>
        </View>
        <View style={styles.optionsRow}>
          {autoDeleteOptions.map((option) => (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.optionButton,
                settings.autoDeleteDays === option.value && styles.optionButtonActive,
              ]}
              onPress={() => handleAutoDeleteChange(option.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  settings.autoDeleteDays === option.value && styles.optionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Storage Used</Text>
            <Text style={styles.settingDescription}>{storageUsed}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowBorder]}
          onPress={handleClearData}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: COLORS.danger }]}>
              Clear All Data
            </Text>
            <Text style={styles.settingDescription}>
              Delete all cases and settings
            </Text>
          </View>
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Version</Text>
          </View>
          <Text style={styles.versionText}>{VERSION}</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Bail Recovery App - For authorized use only
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    paddingTop: 0,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  passcodeSetup: {
    padding: 16,
    paddingTop: 0,
  },
  passcodeInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  passcodeButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  apiKeySetup: {
    padding: 16,
    paddingTop: 0,
  },
  apiKeyInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  apiKeyHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 24,
  },
});
