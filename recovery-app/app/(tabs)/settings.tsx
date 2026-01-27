import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { getStorageUsage, clearAllData } from '@/lib/storage';
import { confirm, showAlert } from '@/lib/confirm';
import { Button, Input } from '@/components';
import { COLORS, VERSION } from '@/constants';
import { getAllCases } from '@/lib/database';
import { isFirebaseReady } from '@/lib/firebase';
import { checkAIBackendHealth } from '@/lib/ai-service';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, organization, signOut: authSignOut } = useAuthContext();
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
  const [newPasscode, setNewPasscode] = useState('');
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);

  // API Key state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);

  // Communication state
  const [googleVoiceNumber, setGoogleVoiceNumber] = useState('');
  const [showGoogleVoice, setShowGoogleVoice] = useState(false);
  const [savingGV, setSavingGV] = useState(false);

  const handleSaveGoogleVoice = async () => {
    setSavingGV(true);
    try {
      await updateSettings({
        googleVoiceNumber: googleVoiceNumber.trim() || undefined,
      });
      setShowGoogleVoice(false);
      showAlert('Success', 'Google Voice number saved');
    } catch (e) {
      showAlert('Error', 'Failed to save');
    }
    setSavingGV(false);
  };

  // AI Backend status
  const [aiStatus, setAiStatus] = useState<{
    available: boolean | null;
    hasOpenAIKey: boolean | null;
    checking: boolean;
  }>({ available: null, hasOpenAIKey: null, checking: false });

  // Database status
  const [dbStatus, setDbStatus] = useState<{
    cloudWorking: boolean | null;
    cloudCases: number;
    testing: boolean;
    lastTested: string | null;
  }>({
    cloudWorking: null,
    cloudCases: 0,
    testing: false,
    lastTested: null,
  });

  useEffect(() => {
    loadStorageUsage();
    testDatabaseConnections();
    checkAIStatus();
    // Load saved API keys
    if (settings.anthropicApiKey) {
      setAnthropicKey(settings.anthropicApiKey);
    }
    if (settings.openaiApiKey) {
      setOpenaiKey(settings.openaiApiKey);
    }
    if (settings.googleMapsApiKey) {
      setGoogleMapsKey(settings.googleMapsApiKey);
    }
    if (settings.googleVoiceNumber) {
      setGoogleVoiceNumber(settings.googleVoiceNumber);
    }
  }, [settings.anthropicApiKey, settings.openaiApiKey, settings.googleMapsApiKey, settings.googleVoiceNumber]);

  const checkAIStatus = async () => {
    setAiStatus(prev => ({ ...prev, checking: true }));
    try {
      const status = await checkAIBackendHealth();
      setAiStatus({
        available: status.available,
        hasOpenAIKey: status.hasOpenAIKey,
        checking: false,
      });
    } catch {
      setAiStatus({ available: false, hasOpenAIKey: false, checking: false });
    }
  };

  const testDatabaseConnections = async () => {
    setDbStatus(prev => ({ ...prev, testing: true }));

    let cloudWorking = false;
    let cloudCases = 0;

    // Test Firestore connection (cloud-first - this is the primary data store)
    try {
      const firebaseReady = await isFirebaseReady();
      if (firebaseReady) {
        const cases = await getAllCases();
        cloudCases = cases.length;
        cloudWorking = true;
      }
    } catch (e) {
      console.error('Database test failed:', e);
      cloudWorking = false;
    }

    setDbStatus({
      cloudWorking,
      cloudCases,
      testing: false,
      lastTested: new Date().toLocaleTimeString(),
    });
  };

  const handleSignOut = async () => {
    const confirmed = await confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      destructive: true,
    });
    if (confirmed) {
      await authSignOut();
      router.replace('/auth/login');
    }
  };

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

  const handleSaveApiKeys = async () => {
    setSavingKeys(true);
    try {
      await updateSettings({
        anthropicApiKey: anthropicKey.trim() || undefined,
        openaiApiKey: openaiKey.trim() || undefined,
        googleMapsApiKey: googleMapsKey.trim() || undefined,
      });
      setShowApiKeys(false);
      showAlert('Success', 'API keys saved successfully');
      checkAIStatus(); // Refresh AI status
    } catch (error) {
      showAlert('Error', 'Failed to save API keys');
    } finally {
      setSavingKeys(false);
    }
  };

  const maskApiKey = (key: string | undefined) => {
    if (!key) return 'Not configured';
    if (key.length <= 12) return '••••••••';
    return key.slice(0, 8) + '••••••••' + key.slice(-4);
  };

  const autoDeleteOptions = [
    { label: 'Never', value: null },
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{user?.displayName || 'User'}</Text>
            <Text style={styles.settingDescription}>{user?.email}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: COLORS.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={[styles.badgeText, { color: COLORS.success }]}>Signed In</Text>
          </View>
        </View>

        {organization && (
          <View style={[styles.settingRow, styles.settingRowBorder]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Organization</Text>
              <Text style={styles.settingDescription}>{organization.name}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="business" size={14} color={COLORS.primary} />
              <Text style={[styles.badgeText, { color: COLORS.primary }]}>{organization.plan}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowBorder]}
          onPress={handleSignOut}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: COLORS.danger }]}>Sign Out</Text>
          </View>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

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
              placeholderTextColor={COLORS.textMuted}
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

      {/* API Keys Section */}
      <Text style={styles.sectionTitle}>API Keys</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowApiKeys(!showApiKeys)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Claude API Key (Anthropic)</Text>
            <Text style={styles.settingDescription}>
              {maskApiKey(settings.anthropicApiKey)}
            </Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: settings.anthropicApiKey ? COLORS.success + '20' : COLORS.warning + '20'
          }]}>
            <Ionicons
              name={settings.anthropicApiKey ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={settings.anthropicApiKey ? COLORS.success : COLORS.warning}
            />
            <Text style={[styles.statusText, {
              color: settings.anthropicApiKey ? COLORS.success : COLORS.warning
            }]}>
              {settings.anthropicApiKey ? 'Set' : 'Not Set'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowBorder]}
          onPress={() => setShowApiKeys(!showApiKeys)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>OpenAI API Key</Text>
            <Text style={styles.settingDescription}>
              {maskApiKey(settings.openaiApiKey)}
            </Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: settings.openaiApiKey ? COLORS.success + '20' : COLORS.textSecondary + '20'
          }]}>
            <Ionicons
              name={settings.openaiApiKey ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={settings.openaiApiKey ? COLORS.success : COLORS.textSecondary}
            />
            <Text style={[styles.statusText, {
              color: settings.openaiApiKey ? COLORS.success : COLORS.textSecondary
            }]}>
              {settings.openaiApiKey ? 'Set' : 'Optional'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowBorder]}
          onPress={() => setShowApiKeys(!showApiKeys)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Google Maps API Key</Text>
            <Text style={styles.settingDescription}>
              {maskApiKey(settings.googleMapsApiKey)}
            </Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: settings.googleMapsApiKey ? COLORS.success + '20' : COLORS.textSecondary + '20'
          }]}>
            <Ionicons
              name={settings.googleMapsApiKey ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={settings.googleMapsApiKey ? COLORS.success : COLORS.textSecondary}
            />
            <Text style={[styles.statusText, {
              color: settings.googleMapsApiKey ? COLORS.success : COLORS.textSecondary
            }]}>
              {settings.googleMapsApiKey ? 'Set' : 'Optional'}
            </Text>
          </View>
        </TouchableOpacity>

        {showApiKeys && (
          <View style={styles.apiKeySetup}>
            <Text style={[styles.settingDescription, { marginBottom: 12 }]}>
              Claude (Anthropic) is preferred for bail document analysis. OpenAI is used for OCR fallback.
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              value={anthropicKey}
              onChangeText={setAnthropicKey}
              placeholder="sk-ant-api03-..."
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.apiKeyHint}>Get your key at console.anthropic.com</Text>

            <TextInput
              style={styles.apiKeyInput}
              value={openaiKey}
              onChangeText={setOpenaiKey}
              placeholder="sk-proj-... (optional)"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.apiKeyHint}>Get your key at platform.openai.com</Text>

            <TextInput
              style={styles.apiKeyInput}
              value={googleMapsKey}
              onChangeText={setGoogleMapsKey}
              placeholder="AIza... (optional, for map embeds)"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.apiKeyHint}>Google Maps Embed API key - console.cloud.google.com</Text>

            <View style={styles.passcodeButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                size="small"
                onPress={() => {
                  setShowApiKeys(false);
                  setAnthropicKey(settings.anthropicApiKey || '');
                  setOpenaiKey(settings.openaiApiKey || '');
                  setGoogleMapsKey(settings.googleMapsApiKey || '');
                }}
              />
              <Button
                title={savingKeys ? 'Saving...' : 'Save Keys'}
                size="small"
                onPress={handleSaveApiKeys}
                disabled={savingKeys}
              />
            </View>
          </View>
        )}
      </View>

      {/* Communication Section */}
      <Text style={styles.sectionTitle}>Communication</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowGoogleVoice(!showGoogleVoice)}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Google Voice Number</Text>
            <Text style={styles.settingDescription}>
              {settings.googleVoiceNumber || 'Not configured'}
            </Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: settings.googleVoiceNumber ? COLORS.success + '20' : COLORS.textSecondary + '20'
          }]}>
            <Ionicons
              name={settings.googleVoiceNumber ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={settings.googleVoiceNumber ? COLORS.success : COLORS.textSecondary}
            />
            <Text style={[styles.statusText, {
              color: settings.googleVoiceNumber ? COLORS.success : COLORS.textSecondary
            }]}>
              {settings.googleVoiceNumber ? 'Set' : 'Not Set'}
            </Text>
          </View>
        </TouchableOpacity>

        {showGoogleVoice && (
          <View style={styles.apiKeySetup}>
            <Text style={[styles.settingDescription, { marginBottom: 12 }]}>
              Enter your Google Voice number to enable "GV Text" buttons on phone results.
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              value={googleVoiceNumber}
              onChangeText={setGoogleVoiceNumber}
              placeholder="(504) 555-1234"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />
            <View style={styles.passcodeButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                size="small"
                onPress={() => {
                  setShowGoogleVoice(false);
                  setGoogleVoiceNumber(settings.googleVoiceNumber || '');
                }}
              />
              <Button
                title={savingGV ? 'Saving...' : 'Save'}
                size="small"
                disabled={savingGV}
                onPress={handleSaveGoogleVoice}
              />
            </View>
          </View>
        )}
      </View>

      {/* AI & Backend Section */}
      <Text style={styles.sectionTitle}>AI & Backend</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>AI Analysis</Text>
            <Text style={styles.settingDescription}>
              {aiStatus.checking ? 'Checking...' :
                aiStatus.available && aiStatus.hasOpenAIKey ? 'Ready - Server-side AI enabled' :
                aiStatus.available ? 'Backend connected - AI key pending' :
                'Backend offline'}
            </Text>
          </View>
          {aiStatus.checking ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={[styles.statusBadge, {
              backgroundColor: aiStatus.available && aiStatus.hasOpenAIKey ? COLORS.success + '20' :
                aiStatus.available ? COLORS.warning + '20' : COLORS.danger + '20'
            }]}>
              <Ionicons
                name={aiStatus.available && aiStatus.hasOpenAIKey ? 'checkmark-circle' :
                  aiStatus.available ? 'alert-circle' : 'close-circle'}
                size={16}
                color={aiStatus.available && aiStatus.hasOpenAIKey ? COLORS.success :
                  aiStatus.available ? COLORS.warning : COLORS.danger}
              />
              <Text style={[styles.statusText, {
                color: aiStatus.available && aiStatus.hasOpenAIKey ? COLORS.success :
                  aiStatus.available ? COLORS.warning : COLORS.danger
              }]}>
                {aiStatus.available && aiStatus.hasOpenAIKey ? 'Ready' :
                  aiStatus.available ? 'Partial' : 'Offline'}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.settingRow, styles.settingRowBorder]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>OSINT Backend</Text>
            <Text style={styles.settingDescription}>
              Sherlock, Maigret, holehe (2400+ sites)
            </Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: aiStatus.available ? COLORS.success + '20' : COLORS.danger + '20'
          }]}>
            <Ionicons
              name={aiStatus.available ? 'cloud-done' : 'cloud-offline'}
              size={16}
              color={aiStatus.available ? COLORS.success : COLORS.danger}
            />
            <Text style={[styles.statusText, {
              color: aiStatus.available ? COLORS.success : COLORS.danger
            }]}>
              {aiStatus.available ? 'Connected' : 'Offline'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowBorder]}
          onPress={checkAIStatus}
          disabled={aiStatus.checking}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: COLORS.primary }]}>
              Refresh Status
            </Text>
          </View>
          {aiStatus.checking ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Cloud Section */}
      <Text style={styles.sectionTitle}>Cloud Storage</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Firebase Firestore</Text>
            <Text style={styles.settingDescription}>
              All data stored in cloud - synced across devices
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: COLORS.success + '20' }]}>
            <Ionicons name="cloud-done" size={14} color={COLORS.success} />
            <Text style={[styles.badgeText, { color: COLORS.success }]}>Active</Text>
          </View>
        </View>
      </View>

      {/* Database Status Section */}
      <Text style={styles.sectionTitle}>Database</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Firestore</Text>
            <Text style={styles.settingDescription}>
              {dbStatus.testing ? 'Testing...' :
                dbStatus.cloudWorking === null ? 'Not tested' :
                dbStatus.cloudWorking ? `Connected - ${dbStatus.cloudCases} cases` : 'Not connected'}
            </Text>
          </View>
          {dbStatus.testing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={[styles.statusBadge, {
              backgroundColor: dbStatus.cloudWorking === null ? COLORS.textSecondary + '20' :
                dbStatus.cloudWorking ? COLORS.success + '20' : COLORS.danger + '20'
            }]}>
              <Ionicons
                name={dbStatus.cloudWorking === null ? 'help-circle' : dbStatus.cloudWorking ? 'cloud-done' : 'cloud-offline'}
                size={16}
                color={dbStatus.cloudWorking === null ? COLORS.textSecondary : dbStatus.cloudWorking ? COLORS.success : COLORS.danger}
              />
              <Text style={[styles.statusText, {
                color: dbStatus.cloudWorking === null ? COLORS.textSecondary : dbStatus.cloudWorking ? COLORS.success : COLORS.danger
              }]}>
                {dbStatus.cloudWorking === null ? 'Unknown' : dbStatus.cloudWorking ? 'Connected' : 'Offline'}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.settingRow, styles.settingRowBorder]}
          onPress={testDatabaseConnections}
          disabled={dbStatus.testing}
        >
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: COLORS.primary }]}>
              Test Connection
            </Text>
            <Text style={styles.settingDescription}>
              {dbStatus.lastTested ? `Last tested: ${dbStatus.lastTested}` : 'Never tested'}
            </Text>
          </View>
          {dbStatus.testing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Data Management Section */}
      <Text style={styles.sectionTitle}>Data Management</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
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

      {/* About This App Link */}
      <TouchableOpacity
        style={styles.aboutLink}
        onPress={() => router.push('/about')}
      >
        <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
        <Text style={styles.aboutLinkText}>About This App</Text>
        <Text style={styles.aboutLinkSubtext}>Features, databases, AI models & support</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Audit Log */}
      <TouchableOpacity
        style={[styles.aboutLink, { borderColor: COLORS.success + '40', marginTop: 8 }]}
        onPress={() => router.push('/(tabs)/audit')}
      >
        <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.success} />
        <Text style={styles.aboutLinkText}>Audit Log</Text>
        <Text style={styles.aboutLinkSubtext}>Activity history & compliance</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Admin - Backend Testing */}
      <TouchableOpacity
        style={[styles.aboutLink, { borderColor: COLORS.warning + '40', marginTop: 8 }]}
        onPress={() => router.push('/admin')}
      >
        <Ionicons name="flask" size={20} color={COLORS.warning} />
        <Text style={styles.aboutLinkText}>Admin / Diagnostics</Text>
        <Text style={styles.aboutLinkSubtext}>Test backend, AI, OSINT tools</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <Text style={styles.footer}>
        Elite Recovery System - For authorized use only
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
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
    color: COLORS.text,
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
    color: COLORS.text,
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
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  aboutLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  aboutLinkSubtext: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 24,
  },
});
