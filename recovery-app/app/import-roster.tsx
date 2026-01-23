/**
 * Jail Roster Import - Single booking scraper with history
 */
import { useState, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCases } from '@/hooks/useCases';

const IMPORT_HISTORY_KEY = 'jail_import_history';
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
  bond_type?: string;
  bond_amount?: string;
}

interface BondData {
  amount?: string;
  charge?: string;
}

interface FTAScore {
  score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'UNKNOWN';
  factors: Array<{ factor: string; impact: string; severity: string }>;
  prior_bookings: Array<{ booking_number: number; name: string }>;
  court_records: Array<{ case_name: string; court: string }>;
  ai_analysis?: string;
}

export default function ImportRosterScreen() {
  const router = useRouter();
  const { createCase } = useCases();

  // Single scrape state
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{
    inmate: InmateData;
    charges: ChargeData[];
    bonds: BondData[];
    photo_url: string | null;
  } | null>(null);
  const [singleFtaScore, setSingleFtaScore] = useState<FTAScore | null>(null);
  const [singleFtaLoading, setSingleFtaLoading] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  // Import history
  interface ImportHistoryItem {
    id: string;
    inmate: InmateData;
    charges: ChargeData[];
    bonds: BondData[];
    photo_url: string | null;
    fta_score?: FTAScore;
    source_url: string;
    imported_at: string;
  }
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load import history on mount
  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = async () => {
    try {
      const historyJson = await AsyncStorage.getItem(IMPORT_HISTORY_KEY);
      if (historyJson) {
        setImportHistory(JSON.parse(historyJson));
      }
    } catch (err) {
      console.log('Failed to load import history:', err);
    }
  };

  const saveToHistory = async (data: {
    inmate: InmateData;
    charges: ChargeData[];
    bonds: BondData[];
    photo_url: string | null;
    fta_score?: FTAScore;
  }) => {
    try {
      const newItem: ImportHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...data,
        source_url: url,
        imported_at: new Date().toISOString(),
      };
      const updated = [newItem, ...importHistory].slice(0, 50); // Keep last 50
      setImportHistory(updated);
      await AsyncStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.log('Failed to save to history:', err);
    }
  };

  const clearHistory = async () => {
    Alert.alert('Clear History', 'Delete all import history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setImportHistory([]);
          await AsyncStorage.removeItem(IMPORT_HISTORY_KEY);
        },
      },
    ]);
  };

  // Calculate FTA score for single inmate
  const calculateSingleFTAScore = async (inmateData: {
    inmate: InmateData;
    charges: ChargeData[];
    bonds: BondData[];
  }) => {
    setSingleFtaLoading(true);
    try {
      // Calculate bond amount
      let bondAmount = 0;
      if (inmateData.bonds?.length > 0) {
        bondAmount = inmateData.bonds.reduce((sum, b) => {
          const amt = b.amount?.replace(/[$,]/g, '');
          return sum + (parseFloat(amt || '0') || 0);
        }, 0);
      }

      // Extract booking number from URL if possible
      const bookingMatch = url.match(/\/bookings\/(\d+)/);
      const bookingNumber = bookingMatch ? parseInt(bookingMatch[1]) : undefined;

      // Extract base URL
      const urlObj = new URL(url);
      const jailBaseUrl = `${urlObj.protocol}//${urlObj.host}`;

      const res = await fetch(`${BACKEND_URL}/api/fta-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inmateData.inmate.name,
          age: inmateData.inmate.age,
          address: inmateData.inmate.address,
          charges: inmateData.charges,
          bond_amount: bondAmount > 0 ? bondAmount : undefined,
          booking_number: bookingNumber,
          jail_base_url: jailBaseUrl,
        }),
      });

      if (res.ok) {
        const scoreData = await res.json();
        setSingleFtaScore(scoreData as FTAScore);
      }
    } catch (err) {
      console.log('FTA score error:', err);
    } finally {
      setSingleFtaLoading(false);
    }
  };

  // Single URL scrape
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
    setSingleFtaScore(null);

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
        const extracted = {
          inmate: data.inmate,
          charges: data.charges || [],
          bonds: data.bonds || [],
          photo_url: data.photo_url,
        };
        setExtractedData(extracted);
        setScrapeError(null);
        // Auto-calculate FTA score
        calculateSingleFTAScore(extracted);
        // Save to history
        saveToHistory(extracted);
      } else if (data.errors?.length > 0) {
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
      // Calculate bond amount
      let bondAmount = 0;
      if (extractedData.bonds?.length > 0) {
        bondAmount = extractedData.bonds.reduce((sum, b) => {
          const amt = b.amount?.replace(/[$,]/g, '');
          return sum + (parseFloat(amt || '0') || 0);
        }, 0);
      }

      // Extract charges as strings
      const chargeStrings = extractedData.charges?.map(c => c.charge || c.description || '').filter(Boolean) || [];

      // Get FTA risk level
      let ftaRiskLevel: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK' | undefined;
      if (singleFtaScore) {
        switch (singleFtaScore.risk_level) {
          case 'LOW': ftaRiskLevel = 'LOW RISK'; break;
          case 'MEDIUM': ftaRiskLevel = 'MODERATE RISK'; break;
          case 'HIGH': ftaRiskLevel = 'HIGH RISK'; break;
          case 'VERY_HIGH': ftaRiskLevel = 'VERY HIGH RISK'; break;
        }
      }

      const newCase = await createCase(
        extractedData.inmate.name,
        'fta_recovery',
        extractedData.inmate.booking_number, // internal case ID
        undefined, // notes
        singleFtaScore?.score, // FTA score
        ftaRiskLevel,
        {
          mugshotUrl: extractedData.photo_url || undefined,
          bookingNumber: extractedData.inmate.booking_number,
          jailSource: url,
          charges: chargeStrings,
          bondAmount: bondAmount > 0 ? bondAmount : undefined,
          rosterData: {
            inmate: extractedData.inmate,
            charges: extractedData.charges,
            bonds: extractedData.bonds,
          },
        }
      );

      router.push({
        pathname: `/case/${newCase.id}`,
        params: {
          rosterData: JSON.stringify({
            ...extractedData,
            source_url: url,
            fta_score: singleFtaScore,
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
      const chargeTexts = extractedData.charges
        .map(c => c.charge || c.description || '')
        .filter(Boolean)
        .join(', ');
      if (chargeTexts) {
        params.append('prefillCharges', chargeTexts);
      }
    }
    router.push(`/(tabs)/risk?${params.toString()}`);
  };

  const clearData = () => {
    setExtractedData(null);
    setScrapeError(null);
    setSingleFtaScore(null);
  };

  const getTotalBond = () => {
    if (!extractedData?.bonds?.length) return null;
    const total = extractedData.bonds.reduce((sum, b) => {
      const amt = b.amount?.replace(/[$,]/g, '');
      return sum + (parseFloat(amt || '0') || 0);
    }, 0);
    return total > 0 ? `$${total.toLocaleString()}` : null;
  };

  // Get FTA score color based on risk level
  const getFTAScoreColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return THEME.success;
      case 'MEDIUM': return THEME.warning;
      case 'HIGH': return '#f97316'; // Orange
      case 'VERY_HIGH': return THEME.danger;
      default: return THEME.textMuted;
    }
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
        <View style={styles.headerRight}>
          {importHistory.length > 0 && (
            <TouchableOpacity
              style={[styles.historyBtn, showHistory && styles.historyBtnActive]}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Ionicons name="time" size={20} color={showHistory ? '#fff' : THEME.textMuted} />
              <Text style={[styles.historyBtnText, showHistory && styles.historyBtnTextActive]}>
                {importHistory.length}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Import History Panel */}
      {showHistory && importHistory.length > 0 && (
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Import History ({importHistory.length})</Text>
            <TouchableOpacity onPress={clearHistory}>
              <Text style={styles.clearHistoryText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.historyList} horizontal={false}>
            {importHistory.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.historyItem}
                onPress={() => {
                  setExtractedData({
                    inmate: item.inmate,
                    charges: item.charges,
                    bonds: item.bonds,
                    photo_url: item.photo_url,
                  });
                  setSingleFtaScore(item.fta_score || null);
                  setUrl(item.source_url);
                  setShowHistory(false);
                }}
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.historyThumb} />
                ) : (
                  <View style={[styles.historyThumb, styles.historyThumbPlaceholder]}>
                    <Ionicons name="person" size={16} color={THEME.textMuted} />
                  </View>
                )}
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.inmate.name}</Text>
                  <Text style={styles.historyMeta}>
                    {new Date(item.imported_at).toLocaleDateString()} • {item.charges?.length || 0} charges
                  </Text>
                </View>
                {item.fta_score && (
                  <View style={[styles.historyScore, { backgroundColor: getFTAScoreColor(item.fta_score.risk_level) }]}>
                    <Text style={styles.historyScoreText}>{item.fta_score.score}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Single URL Input Section */}
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

                {/* FTA Risk Score */}
                {singleFtaLoading ? (
                  <View style={styles.ftaLoadingBox}>
                    <ActivityIndicator color={THEME.primary} />
                    <Text style={styles.ftaLoadingText}>Analyzing FTA risk factors...</Text>
                  </View>
                ) : singleFtaScore ? (
                  <View style={[styles.ftaScoreBox, { borderColor: getFTAScoreColor(singleFtaScore.risk_level) }]}>
                    <View style={styles.ftaScoreHeader}>
                      <View style={[styles.ftaScoreBadgeLarge, { backgroundColor: getFTAScoreColor(singleFtaScore.risk_level) }]}>
                        <Text style={styles.ftaScoreNumber}>{singleFtaScore.score}</Text>
                      </View>
                      <View style={styles.ftaScoreInfo}>
                        <Text style={[styles.ftaScoreRisk, { color: getFTAScoreColor(singleFtaScore.risk_level) }]}>
                          {singleFtaScore.risk_level.replace('_', ' ')} RISK
                        </Text>
                        <Text style={styles.ftaScoreSubtext}>FTA Risk Score (0-100)</Text>
                      </View>
                    </View>

                    {/* Risk Factors */}
                    {singleFtaScore.factors.length > 0 && (
                      <View style={styles.ftaFactorsList}>
                        <Text style={styles.ftaFactorsTitle}>RISK FACTORS</Text>
                        {singleFtaScore.factors.map((factor, idx) => (
                          <View key={idx} style={styles.ftaFactorItem}>
                            <Ionicons
                              name={factor.impact.startsWith('+') ? 'arrow-up' : 'arrow-down'}
                              size={14}
                              color={factor.impact.startsWith('+') ? THEME.danger : THEME.success}
                            />
                            <Text style={styles.ftaFactorText}>{factor.factor}</Text>
                            <Text style={[
                              styles.ftaFactorImpact,
                              { color: factor.impact.startsWith('+') ? THEME.danger : THEME.success }
                            ]}>{factor.impact}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Prior Bookings Warning */}
                    {singleFtaScore.prior_bookings.length > 0 && (
                      <View style={styles.priorBookingsBox}>
                        <Ionicons name="warning" size={18} color={THEME.danger} />
                        <View style={styles.priorBookingsInfo}>
                          <Text style={styles.priorBookingsTitle}>
                            {singleFtaScore.prior_bookings.length} Prior Booking(s) Found
                          </Text>
                          <Text style={styles.priorBookingsText}>
                            This person has been booked at this jail before
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* AI Analysis */}
                    {singleFtaScore.ai_analysis && (
                      <View style={styles.aiAnalysisBox}>
                        <View style={styles.aiAnalysisHeader}>
                          <Ionicons name="sparkles" size={16} color={THEME.purple} />
                          <Text style={styles.aiAnalysisTitle}>AI ASSESSMENT</Text>
                        </View>
                        <Text style={styles.aiAnalysisText}>{singleFtaScore.ai_analysis}</Text>
                      </View>
                    )}
                  </View>
                ) : null}

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
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: THEME.surfaceLight,
  },
  historyBtnActive: {
    backgroundColor: THEME.primary,
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  historyBtnTextActive: {
    color: '#fff',
  },
  historyPanel: {
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    maxHeight: 250,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  clearHistoryText: {
    fontSize: 12,
    color: THEME.danger,
  },
  historyList: {
    padding: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: THEME.surfaceLight,
    borderRadius: 8,
    marginBottom: 6,
  },
  historyThumb: {
    width: 36,
    height: 48,
    borderRadius: 4,
    backgroundColor: THEME.surface,
  },
  historyThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
  },
  historyMeta: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  historyScore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyScoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: THEME.surfaceLight,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  modeBtnActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  modeBtnTextActive: {
    color: '#fff',
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
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
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
  inputHint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 16,
    marginTop: -8,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 10,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: THEME.primaryMuted,
    borderColor: THEME.primary,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  periodBtnTextActive: {
    color: THEME.primary,
  },
  periodCount: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 4,
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
  // Bulk results styles
  bulkResultsSection: {
    padding: 16,
  },
  bulkResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bulkResultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.success,
  },
  bulkResultsSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  bulkCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 10,
  },
  bulkCardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  bulkMugshot: {
    width: 60,
    height: 80,
    borderRadius: 6,
    backgroundColor: THEME.surfaceLight,
  },
  bulkCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bulkName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
    flex: 1,
  },
  ftaScoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ftaScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  ftaFactorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  ftaRiskLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ftaWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.danger + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ftaWarningText: {
    fontSize: 10,
    color: THEME.danger,
    fontWeight: '600',
  },
  bulkDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkDetail: {
    fontSize: 12,
    color: THEME.textMuted,
    backgroundColor: THEME.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bulkBookingNum: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 4,
  },
  bulkCharges: {
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  bulkChargeText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  bulkMoreCharges: {
    fontSize: 11,
    color: THEME.textMuted,
    fontStyle: 'italic',
  },
  bulkBondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  bulkBondText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.warning,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bulkActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  // Single FTA Score styles
  ftaLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  ftaLoadingText: {
    color: THEME.textSecondary,
    fontSize: 14,
  },
  ftaScoreBox: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  ftaScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  ftaScoreBadgeLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ftaScoreNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  ftaScoreInfo: {
    flex: 1,
  },
  ftaScoreRisk: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ftaScoreSubtext: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  ftaFactorsList: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingTop: 12,
    marginBottom: 12,
  },
  ftaFactorsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  ftaFactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ftaFactorText: {
    flex: 1,
    fontSize: 13,
    color: THEME.text,
  },
  ftaFactorImpact: {
    fontSize: 13,
    fontWeight: '700',
  },
  priorBookingsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.danger + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  priorBookingsInfo: {
    flex: 1,
  },
  priorBookingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.danger,
  },
  priorBookingsText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  aiAnalysisBox: {
    backgroundColor: THEME.purple + '15',
    padding: 12,
    borderRadius: 8,
  },
  aiAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiAnalysisTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
    letterSpacing: 0.5,
  },
  aiAnalysisText: {
    fontSize: 13,
    color: THEME.text,
    lineHeight: 19,
  },
});
