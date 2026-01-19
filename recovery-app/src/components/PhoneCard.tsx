import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { maskPhone } from '@/lib/encryption';
import { audit } from '@/lib/audit';
import type { ParsedPhone } from '@/types';

interface PhoneCardProps {
  phone: ParsedPhone;
  rank: number;
  caseId?: string;
  showMasked?: boolean;
}

export function PhoneCard({
  phone,
  rank,
  caseId,
  showMasked = true,
}: PhoneCardProps) {
  const [isRevealed, setIsRevealed] = useState(!showMasked);

  const displayNumber = isRevealed ? phone.number : maskPhone(phone.number);

  const typeIcons: Record<string, string> = {
    mobile: 'phone-portrait-outline',
    landline: 'call-outline',
    voip: 'globe-outline',
    unknown: 'help-circle-outline',
  };

  const typeLabels: Record<string, string> = {
    mobile: 'Mobile',
    landline: 'Landline',
    voip: 'VoIP',
    unknown: 'Unknown',
  };

  const handleReveal = () => {
    if (!isRevealed) {
      setIsRevealed(true);
      if (caseId) {
        audit('field_revealed', { caseId, fieldName: 'phone' });
      }
    } else {
      setIsRevealed(false);
    }
  };

  const handleCall = () => {
    if (!isRevealed) {
      Alert.alert('Reveal First', 'Please reveal the number before calling.');
      return;
    }

    const cleaned = phone.number.replace(/\D/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  const handleText = () => {
    if (!isRevealed) {
      Alert.alert('Reveal First', 'Please reveal the number before texting.');
      return;
    }

    const cleaned = phone.number.replace(/\D/g, '');
    Linking.openURL(`sms:${cleaned}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.rankContainer}>
          <Text style={styles.rank}>#{rank}</Text>
        </View>
        <View style={styles.typeContainer}>
          <Ionicons
            name={typeIcons[phone.type || 'unknown'] as any}
            size={14}
            color={COLORS.textSecondary}
          />
          <Text style={styles.type}>{typeLabels[phone.type || 'unknown']}</Text>
        </View>
        {phone.isActive && (
          <View style={styles.activeBadge}>
            <View style={styles.activeIndicator} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      <TouchableOpacity onPress={handleReveal} style={styles.numberContainer}>
        <Text style={[styles.number, !isRevealed && styles.masked]}>
          {displayNumber}
        </Text>
        <Ionicons
          name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>

      {phone.carrier && (
        <Text style={styles.carrier}>Carrier: {phone.carrier}</Text>
      )}

      {(phone.firstSeen || phone.lastSeen) && (
        <Text style={styles.dates}>
          {phone.firstSeen ? `First: ${phone.firstSeen}` : ''}
          {phone.firstSeen && phone.lastSeen ? ' | ' : ''}
          {phone.lastSeen ? `Last: ${phone.lastSeen}` : ''}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
          <Ionicons name="call" size={18} color={COLORS.success} />
          <Text style={[styles.actionText, { color: COLORS.success }]}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleText}>
          <Ionicons name="chatbubble" size={18} color={COLORS.primary} />
          <Text style={[styles.actionText, { color: COLORS.primary }]}>Text</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  rankContainer: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  rank: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  type: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  activeText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  number: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  masked: {
    color: COLORS.masked,
    fontFamily: 'monospace',
  },
  carrier: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  dates: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
