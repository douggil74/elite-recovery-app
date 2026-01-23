import { useState, useEffect } from 'react';
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
import { calculateRiskScore, RiskScoreResult, RiskScoreInput } from '@/lib/osint-service';
import { useCases } from '@/hooks/useCases';

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
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
};

const RISK_COLORS = {
  'LOW RISK': THEME.success,
  'MODERATE RISK': THEME.warning,
  'HIGH RISK': '#f97316',
  'VERY HIGH RISK': THEME.danger,
};

export default function RiskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillName?: string;
    prefillAge?: string;
    prefillBond?: string;
    prefillCharges?: string;
    prefillMugshot?: string;
  }>();
  const { createCase } = useCases();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [result, setResult] = useState<RiskScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

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

  const calculateScore = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const input: RiskScoreInput = {
        name: name.trim(),
        age: age ? parseInt(age) : undefined,
        bond_amount: bondAmount ? parseFloat(bondAmount) : undefined,
        prior_ftas: parseInt(priorFTAs) || 0,
        prior_convictions: parseInt(priorConvictions) || 0,
        months_in_jail: monthsInJail ? parseInt(monthsInJail) : undefined,
        employment_status: employmentStatus,
        residence_type: residenceType,
        residence_duration_months: residenceDuration ? parseInt(residenceDuration) : undefined,
        local_ties: parseInt(localTies) || 0,
        has_vehicle: hasVehicle,
        phone_verified: phoneVerified,
        references_verified: parseInt(referencesVerified) || 0,
        income_monthly: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
        charges: charges ? charges.split(',').map(c => c.trim()) : undefined,
      };

      const scoreResult = await calculateRiskScore(input);
      setResult(scoreResult);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate risk score');
    } finally {
      setIsLoading(false);
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
    setError(null);
  };

  const createCaseWithOSINT = async () => {
    if (!name.trim() || !result) return;
    setIsCreatingCase(true);
    try {
      const newCase = await createCase(
        name.trim(),
        'fta_recovery',
        undefined,
        undefined,
        result.score,
        result.risk_level
      );
      // Navigate to case detail with OSINT auto-run
      router.push({
        pathname: `/case/${newCase.id}`,
        params: { autoRunOSINT: 'true' }
      });
    } catch (err) {
      setError('Failed to create case');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const createCaseWithDocs = async () => {
    if (!name.trim() || !result) return;
    setIsCreatingCase(true);
    try {
      const newCase = await createCase(
        name.trim(),
        'fta_recovery',
        undefined,
        undefined,
        result.score,
        result.risk_level
      );
      // Navigate to case detail for document upload
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

        {/* Action Buttons */}
        <Text style={styles.nextStepsTitle}>NEXT STEPS</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.osintButton]}
          onPress={createCaseWithOSINT}
          disabled={isCreatingCase}
        >
          {isCreatingCase ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="search" size={20} color="#fff" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Run OSINT Search</Text>
                <Text style={styles.actionButtonSubtext}>Create case & search social media</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.docsButton]}
          onPress={createCaseWithDocs}
          disabled={isCreatingCase}
        >
          {isCreatingCase ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" />
              <View style={styles.actionButtonTextContainer}>
                <Text style={styles.actionButtonText}>Upload Documents</Text>
                <Text style={styles.actionButtonSubtext}>Create case & upload docs for refined score</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* New Assessment Button */}
        <TouchableOpacity style={styles.newAssessmentButton} onPress={resetForm}>
          <Ionicons name="refresh" size={18} color={THEME.text} />
          <Text style={styles.newAssessmentText}>New Assessment</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>FTA RISK SCORE</Text>
            <Text style={styles.headerSubtitle}>
              Assess failure-to-appear risk before posting bond
            </Text>
          </View>
        </View>

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
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 1,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 2,
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
  newAssessmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.surfaceLight,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 40,
    marginTop: 12,
  },
  newAssessmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  nextStepsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 10,
  },
  osintButton: {
    backgroundColor: THEME.primary,
  },
  docsButton: {
    backgroundColor: '#1e40af',
  },
  actionButtonTextContainer: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
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
});
