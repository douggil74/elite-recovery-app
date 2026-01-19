import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, WarningBanner } from '@/components';
import { useCases } from '@/hooks/useCases';
import { COLORS } from '@/constants';

export default function NewCaseScreen() {
  const router = useRouter();
  const { createCase } = useCases();

  const [name, setName] = useState('');
  const [internalCaseId, setInternalCaseId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        'fta_recovery', // Always FTA recovery
        internalCaseId.trim() || undefined,
        notes.trim() || undefined
      );

      router.replace(`/case/${newCase.id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create case. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <WarningBanner
        title="Lawful Use Required"
        message="Only create cases for authorized bail recovery purposes. All activity is logged."
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

      <Input
        label="Internal Case ID (optional)"
        placeholder="Your internal reference number"
        value={internalCaseId}
        onChangeText={setInternalCaseId}
        autoCapitalize="characters"
      />

      <Input
        label="Notes (optional)"
        placeholder="Add any relevant notes about this case"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />

      <Button
        title="Create Recovery Case"
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
  submitButton: {
    marginTop: 8,
  },
});
