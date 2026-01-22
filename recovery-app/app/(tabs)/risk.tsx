import { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculateRiskScore, RiskScoreResult, RiskScoreInput } from '@/lib/osint-service';

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
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RiskScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bondAmount, setBondAmount] = useState('');
  const [priorFTAs, setPriorFTAs] = useState('0');
  const [priorConvictions, setPriorConvictions] = useState('0');
  const [employmentStatus, setEmploymentStatus] = useState<'employed' | 'unemployed' | 'self-employed'>('employed');
  const [residenceType, setResidenceType] = useState<'own' | 'rent' | 'with_family' | 'homeless'>('rent');
  const [residenceDuration, setResidenceDuration] = useState('');
  const [localTies, setLocalTies] = useState('3');
  const [hasVehicle, setHasVehicle] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [referencesVerified, setReferencesVerified] = useState('2');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [charges, setCharges] = useState('');

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

        {/* New Assessment Button */}
        <TouchableOpacity style={styles.newAssessmentButton} onPress={resetForm}>
          <Ionicons name="refresh" size={18} color="#fff" />
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
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={32} color={THEME.primary} />
          </View>
          <Text style={styles.headerTitle}>FTA RISK SCORE</Text>
          <Text style={styles.headerSubtitle}>
            Assess failure-to-appear risk before posting bond
          </Text>
        </View>

        {result ? (
          renderResult()
        ) : (
          <View style={styles.formContainer}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Client Name *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Full legal name"
                placeholderTextColor={THEME.textMuted}
              />
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
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    padding: 16,
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
  },
  newAssessmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
});
