import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, WarningBanner } from '@/components';
import { updateCase } from '@/lib/database';
import { COLORS } from '@/constants';

export default function PurposeScreen() {
  const router = useRouter();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();

  const [permissiblePurpose, setPermissiblePurpose] = useState(false);
  const [noHarassment, setNoHarassment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canProceed = permissiblePurpose && noHarassment;

  const handleSubmit = async () => {
    if (!canProceed || !caseId) return;

    setIsSubmitting(true);

    try {
      await updateCase(caseId, { attestationAccepted: true });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save attestation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />
        <Text style={styles.title}>Lawful Use Attestation</Text>
        <Text style={styles.subtitle}>
          This app is for authorized bail recovery professionals only
        </Text>
      </View>

      <WarningBanner
        title="Important Notice"
        message="Misuse of person data for harassment, stalking, or any illegal purpose is strictly prohibited and may result in criminal prosecution."
        severity="high"
      />

      <Text style={styles.sectionTitle}>Required Attestations</Text>

      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => setPermissiblePurpose(!permissiblePurpose)}
      >
        <View
          style={[
            styles.checkboxBox,
            permissiblePurpose && styles.checkboxBoxChecked,
          ]}
        >
          {permissiblePurpose && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
        <Text style={styles.checkboxLabel}>
          I have a permissible purpose under GLBA/DPPA and am authorized to access
          this person data for the selected purpose.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => setNoHarassment(!noHarassment)}
      >
        <View
          style={[
            styles.checkboxBox,
            noHarassment && styles.checkboxBoxChecked,
          ]}
        >
          {noHarassment && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
        <Text style={styles.checkboxLabel}>
          I will NOT use this data for harassment, stalking, intimidation, or any
          purpose outside the lawful scope of bail recovery.
        </Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          All actions in this app are logged with timestamps for compliance and
          audit purposes.
        </Text>
      </View>

      <Button
        title="I Understand and Agree"
        onPress={handleSubmit}
        disabled={!canProceed}
        loading={isSubmitting}
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 18,
  },
  submitButton: {
    marginTop: 24,
  },
});
