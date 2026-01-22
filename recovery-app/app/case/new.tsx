import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, WarningBanner } from '@/components';
import { useCases } from '@/hooks/useCases';
import { COLORS } from '@/constants';

export default function NewCaseScreen() {
  const router = useRouter();
  const { createCase } = useCases();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Action options
  const [runFTAScore, setRunFTAScore] = useState(false);
  const [runOSINT, setRunOSINT] = useState(true); // Default to run OSINT

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Subject name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const newCase = await createCase(
        name.trim(),
        'fta_recovery'
      );

      // Navigate to case with action flags
      if (runFTAScore) {
        // Go to FTA Risk tab with pre-filled name
        router.replace({
          pathname: '/(tabs)/risk',
          params: { prefillName: name.trim(), caseId: newCase.id }
        });
      } else {
        // Go to case detail (OSINT will auto-run if enabled)
        router.replace({
          pathname: `/case/${newCase.id}`,
          params: { autoRunOSINT: runOSINT ? 'true' : 'false' }
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create case. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const OptionToggle = ({
    label,
    description,
    icon,
    value,
    onToggle
  }: {
    label: string;
    description: string;
    icon: string;
    value: boolean;
    onToggle: () => void
  }) => (
    <TouchableOpacity
      style={[styles.optionCard, value && styles.optionCardActive]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.optionLeft}>
        <Ionicons
          name={icon as any}
          size={24}
          color={value ? COLORS.primary : COLORS.textMuted}
        />
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, value && styles.optionLabelActive]}>{label}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
      </View>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={24}
        color={value ? COLORS.primary : COLORS.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <WarningBanner
        title="Lawful Use Required"
        message="Only create cases for authorized fugitive recovery purposes."
        severity="info"
      />

      <Input
        label="Subject Name"
        placeholder="Enter subject's full name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (errors.name) setErrors({ ...errors, name: '' });
        }}
        error={errors.name}
        autoCapitalize="words"
      />

      <Text style={styles.sectionTitle}>ACTIONS AFTER CREATION</Text>

      <OptionToggle
        label="Run OSINT Search"
        description="Search social media, public records, court records"
        icon="search-outline"
        value={runOSINT}
        onToggle={() => setRunOSINT(!runOSINT)}
      />

      <OptionToggle
        label="Calculate FTA Risk Score"
        description="Assess failure-to-appear risk for bond decision"
        icon="analytics-outline"
        value={runFTAScore}
        onToggle={() => setRunFTAScore(!runFTAScore)}
      />

      <Button
        title="Create Case"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!name.trim()}
        size="large"
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: COLORS.primary,
  },
  optionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  submitButton: {
    marginTop: 24,
  },
});
