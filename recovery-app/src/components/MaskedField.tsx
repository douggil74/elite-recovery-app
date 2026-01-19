import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { audit } from '@/lib/audit';

interface MaskedFieldProps {
  label: string;
  value: string;
  maskedValue: string;
  caseId?: string;
  fieldName?: string;
  showByDefault?: boolean;
  confirmReveal?: boolean;
}

export function MaskedField({
  label,
  value,
  maskedValue,
  caseId,
  fieldName,
  showByDefault = false,
  confirmReveal = true,
}: MaskedFieldProps) {
  const [isRevealed, setIsRevealed] = useState(showByDefault);

  const handleReveal = () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }

    if (confirmReveal) {
      Alert.alert(
        'Reveal Sensitive Data',
        `Are you sure you want to reveal ${label}? This action will be logged.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reveal',
            onPress: () => {
              setIsRevealed(true);
              if (caseId) {
                audit('field_revealed', {
                  caseId,
                  fieldName: fieldName || label,
                });
              }
            },
          },
        ]
      );
    } else {
      setIsRevealed(true);
      if (caseId) {
        audit('field_revealed', {
          caseId,
          fieldName: fieldName || label,
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.valueContainer}
        onPress={handleReveal}
        activeOpacity={0.7}
      >
        <Text style={[styles.value, !isRevealed && styles.masked]}>
          {isRevealed ? value : maskedValue}
        </Text>
        <Ionicons
          name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  value: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  masked: {
    color: COLORS.masked,
    fontFamily: 'monospace',
  },
});
