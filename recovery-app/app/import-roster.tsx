/**
 * Jail Roster Import - Automated scraping
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCases } from '@/hooks/useCases';

const BACKEND_URL = 'https://elite-recovery-osint.onrender.com';

// Dark Red Theme
const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceLight: '#18181b',
  border: '#27272a',
  borderLight: '#3f3f46',
  primary: '#dc2626',
  primaryMuted: '#450a0a',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
};

interface InmateData {
  name: string;
  booking_number?: string;
  dob?: string;
  age?: string;
  sex?: string;
  race?: string;
  height?: string;
  weight?: string;
  hair_color?: string;
  eye_color?: string;
  address?: string;
}

interface ChargeData {
  charge?: string;
  description?: string;
}

interface BondData {
  amount?: string;
}

export default function ImportRosterScreen() {
  const router = useRouter();
  const { createCase } = useCases();

  // Scrape state
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Extracted data
  const [extractedData, setExtractedData] = useState<{
    inmate: InmateData;
    charges: ChargeData[];
    bonds: BondData[];
    photo_url: string | null;
  } | null>(null);

  const [isCreatingCase, setIsCreatingCase] = useState(false);

  const scrapeRoster = async () => {
    if (!url.trim()) {
      setScrapeError('Please paste a jail roster URL');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setScrapeError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setIsLoading(true);
    setScrapeError(null);
    setExtractedData(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/jail-roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.inmate?.name) {
        // Success - store extracted data
        setExtractedData({
          inmate: data.inmate,
          charges: data.charges || [],
          bonds: data.bonds || [],
          photo_url: data.photo_url,
        });
        setScrapeError(null);
      } else if (data.errors?.length > 0) {
        // Show specific errors from scraper
        setScrapeError(data.errors.join(' | '));
      } else {
        setScrapeError('Could not extract inmate data from this page. The site may be using anti-bot protection.');
      }
    } catch (err: any) {
      setScrapeError(err.message || 'Failed to connect to scraper');
    } finally {
      setIsLoading(false);
    }
  };

  const openUrlInBrowser = () => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const createCaseFromData = async () => {
    if (!extractedData?.inmate?.name) {
      Alert.alert('Error', 'No inmate data to create case');
      return;
    }

    setIsCreatingCase(true);
    try {
      const newCase = await createCase(extractedData.inmate.name, 'fta_recovery');

      // Navigate to case with all the data
      router.push({
        pathname: `/case/${newCase.id}`,
        params: {
          rosterData: JSON.stringify({
            ...extractedData,
            source_url: url,
          }),
        },
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to create case');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const goToFTARisk = () => {
    if (!extractedData?.inmate) return;
    const params = new URLSearchParams();
    if (extractedData.inmate.name) params.append('prefillName', extractedData.inmate.name);
    if (extractedData.inmate.age) params.append('prefillAge', extractedData.inmate.age);
    if (extractedData.bonds?.length > 0) {
      const total = extractedData.bonds.reduce((sum, b) => {
        const amt = b.amount?.replace(/[$,]/g, '');
        return sum + (parseFloat(amt || '0') || 0);
      }, 0);
      if (total > 0) params.append('prefillBond', total.toString());
    }
    if (extractedData.charges?.length > 0) {
      params.append('prefillCharges', extractedData.charges.length.toString());
    }
    router.push(`/(tabs)/risk?${params.toString()}`);
  };

  const clearData = () => {
    setExtractedData(null);
    setScrapeError(null);
  };

  const getTotalBond = () => {
    if (!extractedData?.bonds?.length) return null;
    const total = extractedData.bonds.reduce((sum, b) => {
      const amt = b.amount?.replace(/[$,]/g, '');
      return sum + (parseFloat(amt || '0') || 0);
    }, 0);
    return total > 0 ? `$${total.toLocaleString()}` : null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Jail Roster</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* URL Input Section */}
        <View style={styles.section}>
          <Text style={styles.sectionDesc}>
            Paste a jail booking URL to automatically extract inmate data, charges, bonds, and mugshot.
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="link" size={20} color={THEME.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://inmates.jail.com/bookings/12345"
              placeholderTextColor={THEME.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
            onPress={scrapeRoster}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryBtnText}>SCRAPING...</Text>
              </>
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>EXTRACT DATA</Text>
              </>
            )}
          </TouchableOpacity>

          {isLoading && (
            <Text style={styles.loadingHint}>
              Trying multiple methods to bypass anti-bot protection...
            </Text>
          )}

          {scrapeError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={20} color={THEME.danger} />
              <Text style={styles.errorText}>{scrapeError}</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.retryBtn} onPress={scrapeRoster}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
                {url && (
                  <TouchableOpacity style={styles.viewBrowserBtn} onPress={openUrlInBrowser}>
                    <Ionicons name="open-outline" size={16} color="#fff" />
                    <Text style={styles.viewBrowserText}>View Page</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Extracted Data Display */}
        {extractedData && (
          <View style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={24} color={THEME.success} />
              <Text style={styles.resultTitle}>Data Extracted</Text>
            </View>

            {/* Mugshot & Basic Info */}
            <View style={styles.inmateCard}>
              {extractedData.photo_url ? (
                <Image source={{ uri: extractedData.photo_url }} style={styles.mugshotImage} />
              ) : (
                <View style={[styles.mugshotImage, styles.mugshotPlaceholder]}>
                  <Ionicons name="person" size={40} color={THEME.textMuted} />
                </View>
              )}
              <View style={styles.inmateInfo}>
                <Text style={styles.inmateName}>{extractedData.inmate.name}</Text>
                {extractedData.inmate.booking_number && (
                  <Text style={styles.inmateDetail}>Booking: {extractedData.inmate.booking_number}</Text>
                )}
                {extractedData.inmate.dob && (
                  <Text style={styles.inmateDetail}>DOB: {extractedData.inmate.dob}</Text>
                )}
                <View style={styles.descriptors}>
                  {extractedData.inmate.age && (
                    <Text style={styles.descriptor}>{extractedData.inmate.age} yrs</Text>
                  )}
                  {extractedData.inmate.sex && (
                    <Text style={styles.descriptor}>{extractedData.inmate.sex}</Text>
                  )}
                  {extractedData.inmate.race && (
                    <Text style={styles.descriptor}>{extractedData.inmate.race}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Physical Description */}
            {(extractedData.inmate.height || extractedData.inmate.weight ||
              extractedData.inmate.hair_color || extractedData.inmate.eye_color) && (
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>PHYSICAL DESCRIPTION</Text>
                <View style={styles.detailRow}>
                  {extractedData.inmate.height && (
                    <Text style={styles.detailItem}>Height: {extractedData.inmate.height}</Text>
                  )}
                  {extractedData.inmate.weight && (
                    <Text style={styles.detailItem}>Weight: {extractedData.inmate.weight}</Text>
                  )}
                  {extractedData.inmate.hair_color && (
                    <Text style={styles.detailItem}>Hair: {extractedData.inmate.hair_color}</Text>
                  )}
                  {extractedData.inmate.eye_color && (
                    <Text style={styles.detailItem}>Eyes: {extractedData.inmate.eye_color}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Address */}
            {extractedData.inmate.address && (
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>ADDRESS</Text>
                <Text style={styles.detailValue}>{extractedData.inmate.address}</Text>
              </View>
            )}

            {/* Charges */}
            {extractedData.charges.length > 0 && (
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>CHARGES ({extractedData.charges.length})</Text>
                {extractedData.charges.map((charge, idx) => (
                  <View key={idx} style={styles.chargeItem}>
                    <Ionicons name="alert-circle" size={16} color={THEME.danger} />
                    <Text style={styles.chargeText}>
                      {charge.charge || charge.description || JSON.stringify(charge)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bond */}
            {getTotalBond() && (
              <View style={styles.bondBox}>
                <Ionicons name="cash" size={24} color={THEME.warning} />
                <View>
                  <Text style={styles.bondLabel}>TOTAL BOND</Text>
                  <Text style={styles.bondAmount}>{getTotalBond()}</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: THEME.warning }]}
                onPress={goToFTARisk}
              >
                <Ionicons name="analytics" size={22} color="#fff" />
                <View style={styles.actionBtnText}>
                  <Text style={styles.actionBtnTitle}>Calculate FTA Risk</Text>
                  <Text style={styles.actionBtnSubtitle}>Pre-filled with extracted data</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: THEME.primary }]}
                onPress={createCaseFromData}
                disabled={isCreatingCase}
              >
                {isCreatingCase ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="briefcase" size={22} color="#fff" />
                    <View style={styles.actionBtnText}>
                      <Text style={styles.actionBtnTitle}>Create Recovery Case</Text>
                      <Text style={styles.actionBtnSubtitle}>Start tracking this subject</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearBtn} onPress={clearData}>
                <Ionicons name="close-circle" size={16} color={THEME.textMuted} />
                <Text style={styles.clearBtnText}>Clear & Try Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionDesc: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: THEME.text,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  loadingHint: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: THEME.danger + '15',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.danger + '40',
    gap: 10,
    marginTop: 8,
  },
  errorText: {
    color: THEME.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.info,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  viewBrowserText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultSection: {
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.success,
  },
  inmateCard: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 12,
    gap: 14,
  },
  mugshotImage: {
    width: 90,
    height: 120,
    borderRadius: 8,
    backgroundColor: THEME.surfaceLight,
  },
  mugshotPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    borderStyle: 'dashed',
  },
  inmateInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  inmateName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 6,
  },
  inmateDetail: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  descriptors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  descriptor: {
    fontSize: 12,
    color: THEME.textMuted,
    backgroundColor: THEME.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  detailBox: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    fontSize: 14,
    color: THEME.text,
  },
  detailValue: {
    fontSize: 14,
    color: THEME.text,
    lineHeight: 20,
  },
  chargeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  chargeText: {
    flex: 1,
    fontSize: 14,
    color: THEME.text,
    lineHeight: 20,
  },
  bondBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: THEME.warning + '15',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.warning + '40',
    marginBottom: 16,
  },
  bondLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.warning,
    letterSpacing: 0.5,
  },
  bondAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.warning,
  },
  actions: {
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
  },
  actionBtnText: {
    flex: 1,
  },
  actionBtnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  clearBtnText: {
    color: THEME.textMuted,
    fontSize: 14,
  },
});
