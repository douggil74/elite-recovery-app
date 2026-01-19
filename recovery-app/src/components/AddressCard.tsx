import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { maskAddress } from '@/lib/encryption';
import { audit } from '@/lib/audit';
import type { ParsedAddress } from '@/types';

interface AddressCardProps {
  address: ParsedAddress;
  rank: number;
  caseId?: string;
  showMasked?: boolean;
  onSelect?: () => void;
  selected?: boolean;
}

export function AddressCard({
  address,
  rank,
  caseId,
  showMasked = true,
  onSelect,
  selected = false,
}: AddressCardProps) {
  const [isRevealed, setIsRevealed] = useState(!showMasked);

  const confidencePercent = Math.round(address.confidence * 100);
  const confidenceColor =
    address.confidence >= 0.7
      ? COLORS.success
      : address.confidence >= 0.4
      ? COLORS.warning
      : COLORS.danger;

  const displayAddress = isRevealed ? address.fullAddress : maskAddress(address.fullAddress);

  const handleReveal = () => {
    if (!isRevealed) {
      Alert.alert(
        'Reveal Address',
        'This action will be logged. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reveal',
            onPress: () => {
              setIsRevealed(true);
              if (caseId) {
                audit('field_revealed', { caseId, fieldName: 'address' });
              }
            },
          },
        ]
      );
    } else {
      setIsRevealed(false);
    }
  };

  const openMaps = () => {
    if (!isRevealed) {
      Alert.alert('Reveal First', 'Please reveal the address before opening in maps.');
      return;
    }

    const encoded = encodeURIComponent(address.fullAddress);
    // Try Apple Maps first on iOS, fallback to Google Maps
    const appleMapsUrl = `maps://?address=${encoded}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    Linking.canOpenURL(appleMapsUrl).then((supported) => {
      if (supported) {
        Linking.openURL(appleMapsUrl);
      } else {
        Linking.openURL(googleMapsUrl);
      }
    });
  };

  return (
    <View style={[styles.container, selected && styles.selected]}>
      <View style={styles.header}>
        <View style={[styles.rankBadge, { backgroundColor: confidenceColor + '20' }]}>
          <Text style={[styles.rankText, { color: confidenceColor }]}>#{rank}</Text>
        </View>
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${confidencePercent}%`, backgroundColor: confidenceColor },
              ]}
            />
          </View>
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {confidencePercent}%
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={handleReveal} style={styles.addressContainer}>
        <Text style={[styles.address, !isRevealed && styles.masked]}>
          {displayAddress}
        </Text>
        <Ionicons
          name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>

      {address.isCurrent && (
        <View style={styles.currentBadge}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
          <Text style={styles.currentText}>Current</Text>
        </View>
      )}

      {address.fromDate && (
        <Text style={styles.dates}>
          {address.fromDate} - {address.toDate || 'Present'}
        </Text>
      )}

      {address.reasons.length > 0 && (
        <View style={styles.reasons}>
          {address.reasons.slice(0, 2).map((reason, idx) => (
            <View key={idx} style={styles.reasonBadge}>
              <Ionicons name="checkmark" size={12} color={COLORS.success} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {onSelect && (
          <TouchableOpacity
            style={[styles.actionButton, selected && styles.actionButtonSelected]}
            onPress={onSelect}
          >
            <Ionicons
              name={selected ? 'checkmark-circle' : 'add-circle-outline'}
              size={18}
              color={selected ? COLORS.success : COLORS.primary}
            />
            <Text style={[styles.actionText, selected && styles.actionTextSelected]}>
              {selected ? 'Selected' : 'Add to Route'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={openMaps}>
          <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
          <Text style={styles.actionText}>Maps</Text>
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
  selected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBar: {
    width: 50,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
  },
  address: {
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  masked: {
    color: COLORS.masked,
    fontFamily: 'monospace',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  currentText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  dates: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  reasonText: {
    fontSize: 11,
    color: COLORS.success,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonSelected: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  actionTextSelected: {
    color: COLORS.success,
  },
});
