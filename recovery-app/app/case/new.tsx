import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components';
import { useCases } from '@/hooks/useCases';
import { COLORS } from '@/constants';

export default function NewCaseScreen() {
  const router = useRouter();
  const { createCase } = useCases();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Action options
  const [runFTAScore, setRunFTAScore] = useState(false);
  const [runOSINT, setRunOSINT] = useState(true);

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
    setSubmitError(null);

    try {
      const newCase = await createCase(
        name.trim(),
        'fta_recovery'
      );

      if (runFTAScore) {
        router.replace({
          pathname: '/(tabs)/risk',
          params: { prefillName: name.trim(), caseId: newCase.id }
        });
      } else {
        router.replace({
          pathname: `/case/${newCase.id}`,
          params: { autoRunOSINT: runOSINT ? 'true' : 'false' }
        });
      }
    } catch (error: any) {
      console.error('[NewCase] Create failed:', error);
      setSubmitError(error?.message || 'Failed to create case. Check your connection and try again.');
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
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Case</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Lawful Use Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
            <Text style={styles.infoBannerText}>
              Only create cases for authorized fugitive recovery purposes.
            </Text>
          </View>

          {/* Name Input */}
          <Text style={styles.inputLabel}>Subject Name</Text>
          <View style={[styles.inputWrapper, errors.name ? styles.inputWrapperError : null]}>
            <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Enter subject's full name"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              autoCapitalize="words"
              autoFocus
            />
          </View>
          {errors.name ? (
            <Text style={styles.inputError}>{errors.name}</Text>
          ) : null}

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

          {submitError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          )}

          <Button
            title="Create Case"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!name.trim()}
            size="large"
            style={styles.submitButton}
          />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    outlineStyle: 'none',
  } as any,
  inputError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 8,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#fca5a5',
  },
});
