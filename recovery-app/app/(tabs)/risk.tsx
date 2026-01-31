import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  calculateRiskScore,
  RiskScoreResult,
  RiskScoreInput,
  searchCriminalHistory,
  ArrestsSearchResult,
  investigatePerson,
  InvestigateResult,
  getBackgroundCheckLinks,
  BackgroundCheckLinks,
  searchGoogleDorks,
  GoogleDorkResult,
  searchCourtRecords,
  CourtRecordResult,
} from '@/lib/osint-service';
import { useCases } from '@/hooks/useCases';
import { COLORS } from '@/constants';

// Use shared COLORS for consistency across app
const THEME = {
  bg: COLORS.background,
  surface: COLORS.card,
  surfaceLight: COLORS.surface,
  border: COLORS.border,
  borderLight: COLORS.borderLight,
  primary: COLORS.primary,
  primaryMuted: COLORS.primaryMuted,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  text: COLORS.text,
  textSecondary: COLORS.textSecondary,
  textMuted: COLORS.textMuted,
};

const RISK_COLORS = {
  'LOW RISK': COLORS.success,
  'MODERATE RISK': COLORS.warning,
  'HIGH RISK': '#f97316',
  'VERY HIGH RISK': COLORS.danger,
};

export default function RiskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillName?: string;
    prefillAge?: string;
    prefillBond?: string;
    prefillCharges?: string;
    prefillMugshot?: string;
    prefillFTAs?: string;
    prefillConvictions?: string;
  }>();
  const { createCase } = useCases();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [result, setResult] = useState<RiskScoreResult | null>(null);
  const [criminalHistory, setCriminalHistory] = useState<ArrestsSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // OSINT sweep state
  const [osintStates, setOsintStates] = useState<Record<string, { status: 'idle' | 'running' | 'done' | 'error'; error?: string }>>({
    arrests: { status: 'idle' },
    courts: { status: 'idle' },
    profiles: { status: 'idle' },
    background: { status: 'idle' },
    dorks: { status: 'idle' },
  });
  const [osintRunning, setOsintRunning] = useState(false);
  const [investigateResult, setInvestigateResult] = useState<InvestigateResult | null>(null);
  const [courtResult, setCourtResult] = useState<CourtRecordResult | null>(null);
  const [osintExpanded, setOsintExpanded] = useState(false);

  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bondAmount, setBondAmount] = useState('');
  const [mugshotUrl, setMugshotUrl] = useState<string | null>(null);
  const [priorFTAs, setPriorFTAs] = useState('0');
  const [priorConvictions, setPriorConvictions] = useState('0');
  const [monthsInJail, setMonthsInJail] = useState('0');
  const [employmentStatus, setEmploymentStatus] = useState<'employed' | 'unemployed' | 'self-employed'>('employed');
  const [residenceType, setResidenceType] = useState<'own' | 'rent' | 'with_family' | 'homeless'>('rent');
  const [residenceDuration, setResidenceDuration] = useState('');
  const [localTies, setLocalTies] = useState('3');
  const [hasVehicle, setHasVehicle] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [referencesVerified, setReferencesVerified] = useState('2');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [charges, setCharges] = useState('');

  // Prefill form from URL params (from import-roster)
  useEffect(() => {
    if (prefillApplied) return;

    let hasParams = false;
    if (params.prefillName) {
      setName(params.prefillName);
      hasParams = true;
    }
    if (params.prefillAge) {
      setAge(params.prefillAge);
      hasParams = true;
    }
    if (params.prefillBond) {
      setBondAmount(params.prefillBond);
      hasParams = true;
    }
    if (params.prefillCharges) {
      // prefillCharges contains actual charge descriptions
      setCharges(params.prefillCharges);
      hasParams = true;
    }
    if (params.prefillMugshot) {
      setMugshotUrl(params.prefillMugshot);
      hasParams = true;
    }
    if (params.prefillFTAs) {
      setPriorFTAs(params.prefillFTAs);
      hasParams = true;
    }
    if (params.prefillConvictions) {
      setPriorConvictions(params.prefillConvictions);
      hasParams = true;
    }

    if (hasParams) {
      setPrefillApplied(true);
    }
  }, [params, prefillApplied]);

  // Handle mugshot edit/update
  const handleEditMugshot = () => {
    Alert.prompt(
      'Update Photo URL',
      'Enter a new URL for the subject photo:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: (newUrl) => {
            if (newUrl && newUrl.startsWith('http')) {
              setMugshotUrl(newUrl);
            }
          },
        },
      ],
      'plain-text',
      mugshotUrl || ''
    );
  };

  const updateOsintState = (tool: string, status: 'idle' | 'running' | 'done' | 'error', error?: string) => {
    if (!isMounted.current) return;
    setOsintStates(prev => ({ ...prev, [tool]: { status, error } }));
  };

  const calculateScore = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsLoading(true);
    setOsintRunning(true);
    setError(null);
    setResult(null);
    setInvestigateResult(null);
    setCourtResult(null);
    setOsintExpanded(false);

    // Reset OSINT states
    const initialStates: Record<string, { status: 'idle' | 'running' | 'done' | 'error' }> = {
      arrests: { status: 'running' },
      courts: { status: 'running' },
      profiles: { status: 'running' },
      background: { status: 'running' },
      dorks: { status: 'running' },
    };
    setOsintStates(initialStates);

    const trimmedName = name.trim();

    // Use local variables to track enriched data from OSINT results
    // (setState is async so we can't rely on state for Phase 2)
    let enrichedFTAs = parseInt(priorFTAs) || 0;
    let enrichedConvictions = parseInt(priorConvictions) || 0;
    let enrichedCharges = charges;
    let enrichedAge = age;

    try {
      // ---- Phase 1: OSINT Sweep (all tools in parallel) ----
      const osintPromises = await Promise.allSettled([
        // 1. Arrests search
        (async () => {
          try {
            const arrestResult = await searchCriminalHistory(trimmedName);
            if (!isMounted.current) return;
            updateOsintState('arrests', 'done');
            setCriminalHistory(arrestResult);

            // Auto-fill from arrests data
            if (arrestResult.fta_count > 0 && arrestResult.fta_count > enrichedFTAs) {
              enrichedFTAs = arrestResult.fta_count;
              setPriorFTAs(String(arrestResult.fta_count));
            }
            if (arrestResult.total_results > 0 && arrestResult.total_results > enrichedConvictions) {
              enrichedConvictions = arrestResult.total_results;
              setPriorConvictions(String(arrestResult.total_results));
            }
            // Auto-fill charges from arrest records if not already set
            if (!charges.trim() && arrestResult.arrests_found.length > 0) {
              const allCharges = arrestResult.arrests_found.flatMap(a => a.charges);
              const uniqueCharges = [...new Set(allCharges)].slice(0, 10);
              if (uniqueCharges.length > 0) {
                enrichedCharges = uniqueCharges.join(', ');
                setCharges(enrichedCharges);
              }
            }
            // Auto-fill age from arrest records if not set
            if (!age && arrestResult.arrests_found.length > 0) {
              const ageRecord = arrestResult.arrests_found.find(a => a.age);
              if (ageRecord?.age) {
                enrichedAge = ageRecord.age;
                setAge(ageRecord.age);
              }
            }
          } catch {
            updateOsintState('arrests', 'error');
          }
        })(),

        // 2. Court records
        (async () => {
          try {
            const courts = await searchCourtRecords(trimmedName);
            if (!isMounted.current) return;
            updateOsintState('courts', 'done');
            setCourtResult(courts);
          } catch {
            updateOsintState('courts', 'error');
          }
        })(),

        // 3. Investigate person (social profiles)
        (async () => {
          try {
            const profiles = await investigatePerson(trimmedName);
            if (!isMounted.current) return;
            updateOsintState('profiles', 'done');
            setInvestigateResult(profiles);
          } catch {
            updateOsintState('profiles', 'error');
          }
        })(),

        // 4. Background check links
        (async () => {
          try {
            await getBackgroundCheckLinks(trimmedName);
            if (!isMounted.current) return;
            updateOsintState('background', 'done');
          } catch {
            updateOsintState('background', 'error');
          }
        })(),

        // 5. Google Dorks
        (async () => {
          try {
            await searchGoogleDorks(trimmedName, 'name');
            if (!isMounted.current) return;
            updateOsintState('dorks', 'done');
          } catch {
            updateOsintState('dorks', 'error');
          }
        })(),
      ]);

      if (!isMounted.current) return;
      setOsintRunning(false);

      // ---- Phase 2: Calculate score with enriched data ----
      const input: RiskScoreInput = {
        name: trimmedName,
        age: enrichedAge ? parseInt(enrichedAge) : undefined,
        bond_amount: bondAmount ? parseFloat(bondAmount) : undefined,
        prior_ftas: enrichedFTAs,
        prior_convictions: enrichedConvictions,
        months_in_jail: monthsInJail ? parseInt(monthsInJail) : undefined,
        employment_status: employmentStatus,
        residence_type: residenceType,
        residence_duration_months: residenceDuration ? parseInt(residenceDuration) : undefined,
        local_ties: parseInt(localTies) || 0,
        has_vehicle: hasVehicle,
        phone_verified: phoneVerified,
        references_verified: parseInt(referencesVerified) || 0,
        income_monthly: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
        charges: enrichedCharges ? enrichedCharges.split(',').map(c => c.trim()) : undefined,
      };

      const scoreResult = await calculateRiskScore(input);
      if (!isMounted.current) return;
      setResult(scoreResult);
    } catch (err: any) {
      if (!isMounted.current) return;
      setOsintRunning(false);
      setError(err.message || 'Failed to calculate risk score');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setAge('');
    setBondAmount('');
    setPriorFTAs('0');
    setPriorConvictions('0');
    setMonthsInJail('0');
    setEmploymentStatus('employed');
    setResidenceType('rent');
    setResidenceDuration('');
    setLocalTies('3');
    setHasVehicle(true);
    setPhoneVerified(true);
    setReferencesVerified('2');
    setMonthlyIncome('');
    setCharges('');
    setResult(null);
    setCriminalHistory(null);
    setError(null);
    setInvestigateResult(null);
    setCourtResult(null);
    setOsintExpanded(false);
    setOsintRunning(false);
    setOsintStates({
      arrests: { status: 'idle' },
      courts: { status: 'idle' },
      profiles: { status: 'idle' },
      background: { status: 'idle' },
      dorks: { status: 'idle' },
    });
  };

  const searchHistory = async () => {
    if (!name.trim()) {
      setError('Enter a name first to search criminal history');
      return;
    }

    setIsSearchingHistory(true);
    setError(null);

    try {
      const historyResult = await searchCriminalHistory(name.trim());

      // Only update state if component is still mounted
      if (!isMounted.current) return;

      setCriminalHistory(historyResult);

      // Auto-fill prior FTAs if found
      if (historyResult.fta_count > 0) {
        setPriorFTAs(String(historyResult.fta_count));
      }

      // Update prior convictions based on total arrests
      if (historyResult.total_results > 0) {
        const currentConvictions = parseInt(priorConvictions) || 0;
        if (historyResult.total_results > currentConvictions) {
          setPriorConvictions(String(historyResult.total_results));
        }
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err.message || 'Failed to search criminal history');
    } finally {
      if (isMounted.current) {
        setIsSearchingHistory(false);
      }
    }
  };

  const addToCaseLog = async () => {
    if (!name.trim() || !result) return;
    setIsCreatingCase(true);
    try {
      const newCase = await createCase(
        name.trim(),
        'fta_recovery',
        undefined,
        `FTA Score: ${result.score} (${result.risk_level})\n${result.recommendation}`,
        result.score,
        result.risk_level
      );
      // Navigate to case detail
      router.push(`/case/${newCase.id}`);
    } catch (err) {
      setError('Failed to create case');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const renderToggleButton = (
    label: string,
    isSelected: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[styles.toggleButton, isSelected && styles.toggleButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.toggleButtonText, isSelected && styles.toggleButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const OSINT_TOOLS = [
    { key: 'arrests', label: 'Arrests' },
    { key: 'courts', label: 'Courts' },
    { key: 'profiles', label: 'Profiles' },
    { key: 'background', label: 'Background' },
    { key: 'dorks', label: 'Dorks' },
  ];

  const renderOsintStatusBar = () => {
    const anyActive = Object.values(osintStates).some(s => s.status !== 'idle');
    if (!anyActive) return null;

    return (
      <View style={styles.osintStatusContainer}>
        <Text style={styles.osintStatusTitle}>OSINT CHECK</Text>
        <View style={styles.osintChipsRow}>
          {OSINT_TOOLS.map(tool => {
            const state = osintStates[tool.key];
            const chipColor =
              state.status === 'running' ? THEME.warning :
              state.status === 'done' ? THEME.success :
              state.status === 'error' ? THEME.danger :
              THEME.textMuted;
            const icon =
              state.status === 'running' ? 'ellipse' :
              state.status === 'done' ? 'checkmark-circle' :
              state.status === 'error' ? 'close-circle' :
              'ellipse-outline';

            return (
              <View key={tool.key} style={[styles.osintChip, { borderColor: chipColor + '60', backgroundColor: chipColor + '15' }]}>
                {state.status === 'running' ? (
                  <ActivityIndicator size={10} color={chipColor} />
                ) : (
                  <Ionicons name={icon} size={12} color={chipColor} />
                )}
                <Text style={[styles.osintChipText, { color: chipColor }]}>{tool.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderOsintSummary = () => {
    const hasAnyData = criminalHistory || courtResult || investigateResult;
    if (!hasAnyData) return null;

    const arrestCount = criminalHistory?.total_results || 0;
    const ftaFlags = criminalHistory?.fta_count || 0;
    const warrantFlags = criminalHistory?.warrant_count || 0;
    const courtCases = courtResult?.total_results || 0;
    const profilesFound = investigateResult?.confirmed_profiles?.length || 0;

    return (
      <View style={styles.osintSummaryContainer}>
        <TouchableOpacity
          style={styles.osintSummaryHeader}
          onPress={() => setOsintExpanded(!osintExpanded)}
        >
          <Ionicons name="globe-outline" size={18} color={THEME.primary} />
          <Text style={styles.osintSummaryTitle}>OSINT Intelligence</Text>
          <Ionicons name={osintExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.textMuted} />
        </TouchableOpacity>

        {osintExpanded && (
          <View style={styles.osintSummaryBody}>
            {/* Arrests summary */}
            <View style={styles.osintSummaryRow}>
              <Ionicons name="finger-print" size={14} color={arrestCount > 0 ? THEME.danger : THEME.success} />
              <Text style={styles.osintSummaryText}>
                {arrestCount} arrest{arrestCount !== 1 ? 's' : ''} found
                {ftaFlags > 0 ? ` | ${ftaFlags} FTA flag${ftaFlags !== 1 ? 's' : ''}` : ''}
                {warrantFlags > 0 ? ` | ${warrantFlags} warrant${warrantFlags !== 1 ? 's' : ''}` : ''}
              </Text>
            </View>

            {/* Court records summary */}
            <View style={styles.osintSummaryRow}>
              <Ionicons name="briefcase" size={14} color={courtCases > 0 ? THEME.warning : THEME.success} />
              <Text style={styles.osintSummaryText}>
                {courtCases} court case{courtCases !== 1 ? 's' : ''} found
              </Text>
            </View>

            {/* Social profiles summary */}
            <View style={styles.osintSummaryRow}>
              <Ionicons name="people" size={14} color={profilesFound > 0 ? THEME.primary : THEME.textMuted} />
              <Text style={styles.osintSummaryText}>
                {profilesFound} social profile{profilesFound !== 1 ? 's' : ''} found
              </Text>
            </View>

            {/* Link to OSINT tab */}
            <TouchableOpacity
              style={styles.osintFullSearchLink}
              onPress={() => router.push({ pathname: '/(tabs)/osint', params: { prefillName: name.trim() } })}
            >
              <Ionicons name="open-outline" size={14} color={THEME.primary} />
              <Text style={styles.osintFullSearchLinkText}>Full OSINT search</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    const riskColor = RISK_COLORS[result.risk_level] || THEME.warning;
    const scorePercentage = Math.min(100, Math.max(0, result.score));

    return (
      <View style={styles.resultContainer}>
        {/* Score Circle */}
        <View style={[styles.scoreCircle, { borderColor: riskColor }]}>
          <Text style={[styles.scoreNumber, { color: riskColor }]}>{result.score}</Text>
          <Text style={styles.scoreLabel}>FTA RISK</Text>
        </View>

        {/* Risk Level Badge */}
        <View style={[styles.riskBadge, { backgroundColor: riskColor + '30', borderColor: riskColor }]}>
          <Ionicons
            name={result.score >= 70 ? 'warning' : result.score >= 40 ? 'alert-circle' : 'checkmark-circle'}
            size={20}
            color={riskColor}
          />
          <Text style={[styles.riskBadgeText, { color: riskColor }]}>{result.risk_level}</Text>
        </View>

        {/* Recommendation */}
        <View style={styles.recommendationBox}>
          <Ionicons name="bulb-outline" size={18} color={THEME.warning} />
          <Text style={styles.recommendationText}>{result.recommendation}</Text>
        </View>

        {/* Risk Factors */}
        {result.risk_factors.length > 0 && (
          <View style={styles.factorsSection}>
            <Text style={styles.factorsSectionTitle}>
              <Ionicons name="warning-outline" size={14} color={THEME.danger} /> Risk Factors
            </Text>
            {result.risk_factors.map((factor, idx) => (
              <View key={idx} style={styles.factorItem}>
                <Ionicons name="remove" size={14} color={THEME.danger} />
                <Text style={styles.factorText}>{factor}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Positive Factors */}
        {result.positive_factors.length > 0 && (
          <View style={styles.factorsSection}>
            <Text style={styles.factorsSectionTitle}>
              <Ionicons name="checkmark-circle-outline" size={14} color={THEME.success} /> Positive Factors
            </Text>
            {result.positive_factors.map((factor, idx) => (
              <View key={idx} style={styles.factorItem}>
                <Ionicons name="add" size={14} color={THEME.success} />
                <Text style={[styles.factorText, { color: THEME.success }]}>{factor}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Score Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownTitle}>Score Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Base Score</Text>
            <Text style={styles.breakdownValue}>{result.score_breakdown.base_score}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Adjustments</Text>
            <Text style={[styles.breakdownValue, {
              color: result.score_breakdown.adjustments >= 0 ? THEME.danger : THEME.success
            }]}>
              {result.score_breakdown.adjustments >= 0 ? '+' : ''}{result.score_breakdown.adjustments}
            </Text>
          </View>
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownTotalLabel}>Final Score</Text>
            <Text style={[styles.breakdownTotalValue, { color: riskColor }]}>{result.score_breakdown.final_score}</Text>
          </View>
        </View>

        {/* OSINT Intelligence Summary */}
        {renderOsintSummary()}

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.addCaseButton, isCreatingCase && styles.btnDisabled]}
            onPress={addToCaseLog}
            disabled={isCreatingCase}
          >
            {isCreatingCase ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addCaseButtonText}>Add to Case Log</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.newAssessmentButton} onPress={resetForm}>
            <Ionicons name="refresh" size={18} color={THEME.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.actionHint}>
          Save to case log to track this person, run OSINT, upload documents, etc.
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Score Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>SCORE LEGEND</Text>
          <View style={styles.legendBar}>
            <View style={[styles.legendSegment, { backgroundColor: THEME.success, flex: 40 }]} />
            <View style={[styles.legendSegment, { backgroundColor: THEME.warning, flex: 30 }]} />
            <View style={[styles.legendSegment, { backgroundColor: '#f97316', flex: 15 }]} />
            <View style={[styles.legendSegment, { backgroundColor: THEME.danger, flex: 15 }]} />
          </View>
          <View style={styles.legendLabels}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: THEME.success }]} />
              <Text style={styles.legendText}>0-39</Text>
              <Text style={styles.legendDesc}>LOW RISK</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: THEME.warning }]} />
              <Text style={styles.legendText}>40-69</Text>
              <Text style={styles.legendDesc}>MODERATE</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
              <Text style={styles.legendText}>70-84</Text>
              <Text style={styles.legendDesc}>HIGH RISK</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: THEME.danger }]} />
              <Text style={styles.legendText}>85-100</Text>
              <Text style={styles.legendDesc}>VERY HIGH</Text>
            </View>
          </View>
          <Text style={styles.legendHint}>
            Higher scores = greater chance of failure to appear
          </Text>
        </View>

        {/* Prefill notification */}
        {prefillApplied && !result && (
          <View style={styles.prefillNotice}>
            <Ionicons name="checkmark-circle" size={20} color={THEME.success} />
            <Text style={styles.prefillNoticeText}>
              Data imported from jail roster
            </Text>
          </View>
        )}

        {/* Quick Import from Jail Roster */}
        {!result && !prefillApplied && (
          <TouchableOpacity
            style={styles.importRosterBtn}
            onPress={() => router.push('/import-roster')}
          >
            <Ionicons name="download" size={20} color={THEME.success} />
            <Text style={styles.importRosterText}>Import from Jail Roster</Text>
            <Text style={styles.importRosterHint}>Auto-fill data from booking URL</Text>
          </TouchableOpacity>
        )}

        {result ? (
          renderResult()
        ) : (
          <View style={styles.formContainer}>
            {/* Subject Photo & Name Row */}
            <View style={styles.subjectHeader}>
              <TouchableOpacity
                style={styles.mugshotContainer}
                onPress={handleEditMugshot}
              >
                {mugshotUrl ? (
                  <Image source={{ uri: mugshotUrl }} style={styles.mugshotImage} />
                ) : (
                  <View style={[styles.mugshotImage, styles.mugshotPlaceholder]}>
                    <Ionicons name="person" size={32} color={THEME.textMuted} />
                  </View>
                )}
                <View style={styles.mugshotEditBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={styles.nameInputContainer}>
                <Text style={styles.inputLabel}>Client Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full legal name"
                  placeholderTextColor={THEME.textMuted}
                />
              </View>
            </View>

            {/* Age & Bond Amount Row */}
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.textInput}
                  value={age}
                  onChangeText={setAge}
                  placeholder="25"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Bond Amount $</Text>
                <TextInput
                  style={styles.textInput}
                  value={bondAmount}
                  onChangeText={setBondAmount}
                  placeholder="5000"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Charges */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Charges (comma-separated)</Text>
              <TextInput
                style={styles.textInput}
                value={charges}
                onChangeText={setCharges}
                placeholder="theft, drug possession"
                placeholderTextColor={THEME.textMuted}
              />
            </View>

            {/* Prior FTAs & Convictions Row */}
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Prior FTAs</Text>
                <TextInput
                  style={styles.textInput}
                  value={priorFTAs}
                  onChangeText={setPriorFTAs}
                  placeholder="0"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Prior Convictions</Text>
                <TextInput
                  style={styles.textInput}
                  value={priorConvictions}
                  onChangeText={setPriorConvictions}
                  placeholder="0"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Search Criminal History Button */}
            <TouchableOpacity
              style={[styles.historySearchButton, isSearchingHistory && styles.btnDisabled]}
              onPress={searchHistory}
              disabled={isSearchingHistory}
            >
              {isSearchingHistory ? (
                <ActivityIndicator color={THEME.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="search" size={18} color={THEME.primary} />
                  <Text style={styles.historySearchButtonText}>Search Criminal History</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.historySearchHint}>
              Searches Louisiana arrest records for prior FTAs, warrants, and charges
            </Text>

            {/* Criminal History Results */}
            {criminalHistory && (
              <View style={styles.historyResultsContainer}>
                <View style={styles.historyHeader}>
                  <Ionicons name="document-text" size={18} color={THEME.warning} />
                  <Text style={styles.historyTitle}>Criminal History Found</Text>
                </View>

                {/* Summary Stats */}
                <View style={styles.historyStats}>
                  <View style={styles.historyStat}>
                    <Text style={[styles.historyStatValue, { color: criminalHistory.total_results > 0 ? THEME.danger : THEME.success }]}>
                      {criminalHistory.total_results}
                    </Text>
                    <Text style={styles.historyStatLabel}>Arrests</Text>
                  </View>
                  <View style={styles.historyStat}>
                    <Text style={[styles.historyStatValue, { color: criminalHistory.fta_count > 0 ? THEME.danger : THEME.success }]}>
                      {criminalHistory.fta_count}
                    </Text>
                    <Text style={styles.historyStatLabel}>FTAs</Text>
                  </View>
                  <View style={styles.historyStat}>
                    <Text style={[styles.historyStatValue, { color: criminalHistory.warrant_count > 0 ? THEME.danger : THEME.success }]}>
                      {criminalHistory.warrant_count}
                    </Text>
                    <Text style={styles.historyStatLabel}>Warrants</Text>
                  </View>
                </View>

                {/* Arrest List */}
                {criminalHistory.arrests_found.length > 0 && (
                  <View style={styles.arrestsList}>
                    {criminalHistory.arrests_found.map((arrest, idx) => (
                      <View key={idx} style={styles.arrestItem}>
                        <View style={styles.arrestHeader}>
                          <Text style={styles.arrestName}>{arrest.name}</Text>
                          {arrest.booking_date && (
                            <Text style={styles.arrestDate}>{arrest.booking_date}</Text>
                          )}
                        </View>
                        {arrest.charges.length > 0 && (
                          <View style={styles.chargesList}>
                            {arrest.charges.slice(0, 5).map((charge, cidx) => (
                              <View key={cidx} style={styles.chargeItem}>
                                <Text style={[
                                  styles.chargeText,
                                  charge.toLowerCase().includes('fta') || charge.toLowerCase().includes('failure to appear')
                                    ? { color: THEME.danger }
                                    : {}
                                ]}>
                                  {charge}
                                </Text>
                              </View>
                            ))}
                            {arrest.charges.length > 5 && (
                              <Text style={styles.moreCharges}>+{arrest.charges.length - 5} more charges</Text>
                            )}
                          </View>
                        )}
                        {(arrest.has_fta || arrest.has_warrant) && (
                          <View style={styles.arrestFlags}>
                            {arrest.has_fta && (
                              <View style={styles.ftaFlag}>
                                <Ionicons name="warning" size={12} color={THEME.danger} />
                                <Text style={styles.ftaFlagText}>FTA</Text>
                              </View>
                            )}
                            {arrest.has_warrant && (
                              <View style={styles.warrantFlag}>
                                <Ionicons name="alert-circle" size={12} color={THEME.warning} />
                                <Text style={styles.warrantFlagText}>WARRANT</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {criminalHistory.errors.length > 0 && (
                  <Text style={styles.historyError}>{criminalHistory.errors[0]}</Text>
                )}

                <Text style={styles.historyExecTime}>
                  Searched in {criminalHistory.execution_time.toFixed(1)}s
                </Text>
              </View>
            )}

            {/* Months in Jail */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Months in Jail (total)</Text>
              <TextInput
                style={styles.textInput}
                value={monthsInJail}
                onChangeText={setMonthsInJail}
                placeholder="0"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
              />
            </View>

            {/* Employment Status */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Employment Status</Text>
              <View style={styles.toggleGroup}>
                {renderToggleButton('Employed', employmentStatus === 'employed', () => setEmploymentStatus('employed'))}
                {renderToggleButton('Self-Employed', employmentStatus === 'self-employed', () => setEmploymentStatus('self-employed'))}
                {renderToggleButton('Unemployed', employmentStatus === 'unemployed', () => setEmploymentStatus('unemployed'))}
              </View>
            </View>

            {/* Monthly Income */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monthly Income $</Text>
              <TextInput
                style={styles.textInput}
                value={monthlyIncome}
                onChangeText={setMonthlyIncome}
                placeholder="3000"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
              />
            </View>

            {/* Residence Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Residence Type</Text>
              <View style={styles.toggleGroup}>
                {renderToggleButton('Own', residenceType === 'own', () => setResidenceType('own'))}
                {renderToggleButton('Rent', residenceType === 'rent', () => setResidenceType('rent'))}
                {renderToggleButton('Family', residenceType === 'with_family', () => setResidenceType('with_family'))}
                {renderToggleButton('None', residenceType === 'homeless', () => setResidenceType('homeless'))}
              </View>
            </View>

            {/* Residence Duration & Local Ties */}
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Residence (months)</Text>
                <TextInput
                  style={styles.textInput}
                  value={residenceDuration}
                  onChangeText={setResidenceDuration}
                  placeholder="24"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Local Ties (0-5)</Text>
                <TextInput
                  style={styles.textInput}
                  value={localTies}
                  onChangeText={setLocalTies}
                  placeholder="3"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* References Verified */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>References Verified</Text>
              <TextInput
                style={styles.textInput}
                value={referencesVerified}
                onChangeText={setReferencesVerified}
                placeholder="2"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
              />
            </View>

            {/* Toggle Options */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxItem}
                onPress={() => setHasVehicle(!hasVehicle)}
              >
                <Ionicons
                  name={hasVehicle ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={hasVehicle ? THEME.primary : THEME.textMuted}
                />
                <Text style={styles.checkboxLabel}>Has Vehicle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxItem}
                onPress={() => setPhoneVerified(!phoneVerified)}
              >
                <Ionicons
                  name={phoneVerified ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={phoneVerified ? THEME.primary : THEME.textMuted}
                />
                <Text style={styles.checkboxLabel}>Phone Verified</Text>
              </TouchableOpacity>
            </View>

            {/* OSINT Status Bar */}
            {renderOsintStatusBar()}

            {/* Error */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={THEME.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Calculate Button */}
            <TouchableOpacity
              style={[styles.calculateButton, isLoading && styles.calculateButtonDisabled]}
              onPress={calculateScore}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="analytics" size={20} color="#fff" />
                  <Text style={styles.calculateButtonText}>CALCULATE RISK SCORE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  legendContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  legendBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  legendSegment: {
    height: '100%',
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  legendItem: {
    alignItems: 'center',
    flex: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
  },
  legendDesc: {
    fontSize: 9,
    color: THEME.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  legendHint: {
    fontSize: 11,
    color: THEME.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  formContainer: {
    padding: 16,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 14,
  },
  mugshotContainer: {
    position: 'relative',
  },
  mugshotImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: THEME.surface,
  },
  mugshotPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    borderStyle: 'dashed',
  },
  mugshotEditBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.bg,
  },
  nameInputContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME.text,
  },
  toggleGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  toggleButtonActive: {
    backgroundColor: THEME.primaryMuted,
    borderColor: THEME.primary,
  },
  toggleButtonText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: THEME.primary,
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    marginTop: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: THEME.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.danger + '20',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: THEME.danger,
    fontSize: 14,
    flex: 1,
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 40,
  },
  calculateButtonDisabled: {
    opacity: 0.6,
  },
  calculateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  // Result styles
  resultContainer: {
    padding: 20,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  riskBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 20,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: THEME.text,
    lineHeight: 20,
  },
  factorsSection: {
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  factorsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 10,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  factorText: {
    fontSize: 13,
    color: THEME.textSecondary,
    flex: 1,
  },
  breakdownSection: {
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    color: THEME.text,
    fontWeight: '600',
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingTop: 8,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  addCaseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addCaseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  newAssessmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surfaceLight,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  newAssessmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  actionHint: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  importRosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: THEME.success + '15',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.success + '40',
  },
  importRosterText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.success,
  },
  importRosterHint: {
    fontSize: 12,
    color: THEME.textSecondary,
    width: '100%',
    marginTop: 2,
  },
  prefillNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.success + '20',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.success + '40',
  },
  prefillNoticeText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.success,
  },
  // Criminal History Search Styles
  historySearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.primaryMuted,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.primary + '50',
  },
  historySearchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  historySearchHint: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  historyResultsContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.warning + '40',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.warning,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: THEME.bg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  historyStat: {
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  historyStatLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arrestsList: {
    marginTop: 8,
  },
  arrestItem: {
    backgroundColor: THEME.bg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.warning,
  },
  arrestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  arrestName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    flex: 1,
  },
  arrestDate: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  chargesList: {
    marginTop: 6,
  },
  chargeItem: {
    paddingVertical: 2,
  },
  chargeText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  moreCharges: {
    fontSize: 11,
    color: THEME.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  arrestFlags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ftaFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.danger + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ftaFlagText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.danger,
  },
  warrantFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  warrantFlagText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.warning,
  },
  historyError: {
    fontSize: 12,
    color: THEME.danger,
    marginTop: 8,
  },
  historyExecTime: {
    fontSize: 10,
    color: THEME.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  // OSINT Status Bar
  osintStatusContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.primary + '40',
  },
  osintStatusTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.primary,
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  osintChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  osintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  osintChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // OSINT Summary
  osintSummaryContainer: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.primary + '30',
    overflow: 'hidden',
  },
  osintSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  osintSummaryTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.primary,
    letterSpacing: 0.5,
  },
  osintSummaryBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  osintSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  osintSummaryText: {
    fontSize: 13,
    color: THEME.textSecondary,
    flex: 1,
  },
  osintFullSearchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  osintFullSearchLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
});
