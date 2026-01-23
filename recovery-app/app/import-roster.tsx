/**
 * Jail Roster Import - Single and Bulk scraping
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
  FlatList,
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

// Time period options for bulk import
const TIME_PERIODS = [
  { label: '24 Hours', value: 24, count: 15 },
  { label: '48 Hours', value: 48, count: 30 },
  { label: '72 Hours', value: 72, count: 45 },
  { label: '1 Week', value: 168, count: 50 },
];

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

interface BulkInmate {
  booking_number: number;
  url: string;
  inmate: InmateData;
  charges: ChargeData[];
  bonds: BondData[];
  photo_url: string | null;
  fta_score?: FTAScore;
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

  // Mode: 'single' or 'bulk'
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

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

  // Bulk scrape state
  const [baseUrl, setBaseUrl] = useState('https://inmates.stpso.revize.com');
  const [selectedPeriod, setSelectedPeriod] = useState(TIME_PERIODS[0]);
  const [bulkResults, setBulkResults] = useState<BulkInmate[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [ftaLoading, setFtaLoading] = useState(false);

  const [isCreatingCase, setIsCreatingCase] = useState(false);

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
        setExtractedData({
          inmate: data.inmate,
          charges: data.charges || [],
          bonds: data.bonds || [],
          photo_url: data.photo_url,
        });
        setScrapeError(null);
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

  // Calculate FTA scores for inmates
  const calculateFTAScores = async (inmates: BulkInmate[]) => {
    setFtaLoading(true);
    try {
      // Prepare batch request
      const scoreRequests = inmates.map((inmate) => ({
        name: inmate.inmate.name,
        age: inmate.inmate.age,
        address: inmate.inmate.address,
        charges: inmate.charges,
        bond_amount: getBondAmountNumber(inmate),
        booking_number: inmate.booking_number,
        jail_base_url: baseUrl.trim(),
      }));

      const res = await fetch(`${BACKEND_URL}/api/fta-score/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreRequests),
      });

      if (res.ok) {
        const data = await res.json();
        // Merge FTA scores into inmates
        const updatedInmates = inmates.map((inmate, idx) => ({
          ...inmate,
          fta_score: data.results[idx] as FTAScore,
        }));
        setBulkResults(updatedInmates);
      }
    } catch (err) {
      console.log('FTA scoring error:', err);
    } finally {
      setFtaLoading(false);
    }
  };

  // Helper to extract bond amount as number
  const getBondAmountNumber = (inmate: BulkInmate): number => {
    if (inmate.bonds?.length > 0) {
      const total = inmate.bonds.reduce((sum, b) => {
        const amt = b.amount?.replace(/[$,]/g, '');
        return sum + (parseFloat(amt || '0') || 0);
      }, 0);
      if (total > 0) return total;
    }
    for (const charge of inmate.charges || []) {
      if (charge.bond_amount) {
        const amt = charge.bond_amount.replace(/[$,]/g, '');
        const num = parseFloat(amt);
        if (num > 0) return num;
      }
    }
    return 0;
  };

  // Bulk scrape
  const bulkScrape = async () => {
    if (!baseUrl.trim()) {
      setBulkError('Please enter a jail roster URL');
      return;
    }

    setBulkLoading(true);
    setBulkError(null);
    setBulkResults([]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/jail-roster/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: baseUrl.trim(),
          count: selectedPeriod.count,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.inmates && data.inmates.length > 0) {
        setBulkResults(data.inmates);
        setBulkError(null);
        // Auto-calculate FTA scores
        calculateFTAScores(data.inmates);
      } else {
        setBulkError(`No inmates found. Found ${data.count_found} of ${data.count_requested} requested.`);
      }
    } catch (err: any) {
      setBulkError(err.message || 'Failed to fetch bulk data');
    } finally {
      setBulkLoading(false);
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

  const createCaseFromBulkInmate = async (inmate: BulkInmate) => {
    if (!inmate.inmate?.name) return;

    try {
      const newCase = await createCase(inmate.inmate.name, 'fta_recovery');
      router.push({
        pathname: `/case/${newCase.id}`,
        params: {
          rosterData: JSON.stringify({
            inmate: inmate.inmate,
            charges: inmate.charges,
            bonds: inmate.bonds,
            photo_url: inmate.photo_url,
            source_url: inmate.url,
          }),
        },
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to create case');
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

  const goToFTARiskFromBulk = (inmate: BulkInmate) => {
    const params = new URLSearchParams();
    if (inmate.inmate.name) params.append('prefillName', inmate.inmate.name);
    if (inmate.inmate.age) params.append('prefillAge', inmate.inmate.age);
    if (inmate.bonds?.length > 0) {
      const total = inmate.bonds.reduce((sum, b) => {
        const amt = b.amount?.replace(/[$,]/g, '');
        return sum + (parseFloat(amt || '0') || 0);
      }, 0);
      if (total > 0) params.append('prefillBond', total.toString());
    }
    if (inmate.charges?.length > 0) {
      const chargeTexts = inmate.charges
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
  };

  const clearBulkData = () => {
    setBulkResults([]);
    setBulkError(null);
  };

  const getTotalBond = () => {
    if (!extractedData?.bonds?.length) return null;
    const total = extractedData.bonds.reduce((sum, b) => {
      const amt = b.amount?.replace(/[$,]/g, '');
      return sum + (parseFloat(amt || '0') || 0);
    }, 0);
    return total > 0 ? `$${total.toLocaleString()}` : null;
  };

  const getBondForInmate = (inmate: BulkInmate) => {
    if (!inmate.bonds?.length && !inmate.charges?.length) return null;

    // Check bonds array first
    if (inmate.bonds?.length > 0) {
      const total = inmate.bonds.reduce((sum, b) => {
        const amt = b.amount?.replace(/[$,]/g, '');
        return sum + (parseFloat(amt || '0') || 0);
      }, 0);
      if (total > 0) return `$${total.toLocaleString()}`;
    }

    // Check charges for bond_amount
    for (const charge of inmate.charges || []) {
      if (charge.bond_amount) {
        const amt = charge.bond_amount.replace(/[$,]/g, '');
        const num = parseFloat(amt);
        if (num > 0) return `$${num.toLocaleString()}`;
      }
      if (charge.bond_type) {
        return charge.bond_type;
      }
    }

    return null;
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

  const renderBulkInmateCard = ({ item }: { item: BulkInmate }) => (
    <View style={styles.bulkCard}>
      <View style={styles.bulkCardHeader}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.bulkMugshot} />
        ) : (
          <View style={[styles.bulkMugshot, styles.mugshotPlaceholder]}>
            <Ionicons name="person" size={24} color={THEME.textMuted} />
          </View>
        )}
        <View style={styles.bulkCardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.bulkName}>{item.inmate.name}</Text>
            {/* FTA Score Badge */}
            {item.fta_score ? (
              <View style={[styles.ftaScoreBadge, { backgroundColor: getFTAScoreColor(item.fta_score.risk_level) }]}>
                <Text style={styles.ftaScoreText}>{item.fta_score.score}</Text>
              </View>
            ) : ftaLoading ? (
              <ActivityIndicator size="small" color={THEME.primary} />
            ) : null}
          </View>
          <View style={styles.bulkDetails}>
            {item.inmate.age && <Text style={styles.bulkDetail}>{item.inmate.age} yrs</Text>}
            {item.inmate.sex && <Text style={styles.bulkDetail}>{item.inmate.sex}</Text>}
            {item.inmate.race && <Text style={styles.bulkDetail}>{item.inmate.race}</Text>}
          </View>
          <Text style={styles.bulkBookingNum}>#{item.booking_number}</Text>
        </View>
      </View>

      {/* FTA Risk Factors */}
      {item.fta_score && item.fta_score.factors.length > 0 && (
        <View style={styles.ftaFactorsRow}>
          <Text style={[styles.ftaRiskLabel, { color: getFTAScoreColor(item.fta_score.risk_level) }]}>
            {item.fta_score.risk_level.replace('_', ' ')} RISK
          </Text>
          {item.fta_score.prior_bookings.length > 0 && (
            <View style={styles.ftaWarning}>
              <Ionicons name="alert-circle" size={12} color={THEME.danger} />
              <Text style={styles.ftaWarningText}>{item.fta_score.prior_bookings.length} prior</Text>
            </View>
          )}
        </View>
      )}

      {/* Charges */}
      {item.charges?.length > 0 && (
        <View style={styles.bulkCharges}>
          {item.charges.slice(0, 2).map((charge, idx) => (
            <Text key={idx} style={styles.bulkChargeText} numberOfLines={1}>
              {charge.charge || charge.description}
            </Text>
          ))}
          {item.charges.length > 2 && (
            <Text style={styles.bulkMoreCharges}>+{item.charges.length - 2} more</Text>
          )}
        </View>
      )}

      {/* Bond */}
      {getBondForInmate(item) && (
        <View style={styles.bulkBondRow}>
          <Ionicons name="cash" size={14} color={THEME.warning} />
          <Text style={styles.bulkBondText}>{getBondForInmate(item)}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.bulkActions}>
        <TouchableOpacity
          style={[styles.bulkActionBtn, { backgroundColor: THEME.warning }]}
          onPress={() => goToFTARiskFromBulk(item)}
        >
          <Ionicons name="analytics" size={14} color="#fff" />
          <Text style={styles.bulkActionText}>FTA Risk</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bulkActionBtn, { backgroundColor: THEME.primary }]}
          onPress={() => createCaseFromBulkInmate(item)}
        >
          <Ionicons name="briefcase" size={14} color="#fff" />
          <Text style={styles.bulkActionText}>Create Case</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'single' && styles.modeBtnActive]}
          onPress={() => setMode('single')}
        >
          <Ionicons name="person" size={18} color={mode === 'single' ? '#fff' : THEME.textMuted} />
          <Text style={[styles.modeBtnText, mode === 'single' && styles.modeBtnTextActive]}>
            Single Booking
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'bulk' && styles.modeBtnActive]}
          onPress={() => setMode('bulk')}
        >
          <Ionicons name="people" size={18} color={mode === 'bulk' ? '#fff' : THEME.textMuted} />
          <Text style={[styles.modeBtnText, mode === 'bulk' && styles.modeBtnTextActive]}>
            Bulk Import
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {mode === 'single' ? (
          <>
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
          </>
        ) : (
          <>
            {/* Bulk Import Section */}
            <View style={styles.section}>
              <Text style={styles.sectionDesc}>
                Fetch recent bookings automatically. Select a jail site and time period.
              </Text>

              {/* Base URL */}
              <Text style={styles.inputLabel}>JAIL ROSTER URL</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="globe" size={20} color={THEME.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  placeholder="https://inmates.stpso.revize.com"
                  placeholderTextColor={THEME.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              {/* Time Period Selection */}
              <Text style={styles.inputLabel}>TIME PERIOD</Text>
              <View style={styles.periodGrid}>
                {TIME_PERIODS.map((period) => (
                  <TouchableOpacity
                    key={period.value}
                    style={[
                      styles.periodBtn,
                      selectedPeriod.value === period.value && styles.periodBtnActive,
                    ]}
                    onPress={() => setSelectedPeriod(period)}
                  >
                    <Text
                      style={[
                        styles.periodBtnText,
                        selectedPeriod.value === period.value && styles.periodBtnTextActive,
                      ]}
                    >
                      {period.label}
                    </Text>
                    <Text style={styles.periodCount}>~{period.count} bookings</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fetch Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, bulkLoading && styles.btnDisabled]}
                onPress={bulkScrape}
                disabled={bulkLoading}
              >
                {bulkLoading ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.primaryBtnText}>FETCHING INMATES...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="download" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>FETCH RECENT BOOKINGS</Text>
                  </>
                )}
              </TouchableOpacity>

              {bulkLoading && (
                <Text style={styles.loadingHint}>
                  Finding latest bookings and scraping up to {selectedPeriod.count} records...
                </Text>
              )}

              {bulkError && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning" size={20} color={THEME.danger} />
                  <Text style={styles.errorText}>{bulkError}</Text>
                </View>
              )}
            </View>

            {/* Bulk Results */}
            {bulkResults.length > 0 && (
              <View style={styles.bulkResultsSection}>
                <View style={styles.bulkResultsHeader}>
                  <View>
                    <Text style={styles.bulkResultsTitle}>
                      {bulkResults.length} Inmates Found
                    </Text>
                    <Text style={styles.bulkResultsSubtitle}>
                      {ftaLoading ? 'Calculating FTA risk scores...' : 'FTA scores shown (0-100, higher = more risk)'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={clearBulkData}>
                    <Ionicons name="close-circle" size={24} color={THEME.textMuted} />
                  </TouchableOpacity>
                </View>

                {bulkResults.map((item, index) => (
                  <View key={item.booking_number || index}>
                    {renderBulkInmateCard({ item })}
                  </View>
                ))}
              </View>
            )}
          </>
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
});
