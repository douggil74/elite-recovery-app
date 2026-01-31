import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import type { Case } from '@/types';

export type CaseStatus = 'open' | 'active' | 'closed' | 'void' | 'new' | 'has_data' | 'located';

interface CaseCardProps {
  caseData: Case;
  onPress: () => void;
  onDelete?: () => void;
  status?: CaseStatus;
  addressCount?: number;
  phoneCount?: number;
}

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'OPEN', color: '#3b82f6', bg: '#3b82f620' },
  active: { label: 'ACTIVE', color: '#f59e0b', bg: '#f59e0b20' },
  closed: { label: 'CLOSED', color: '#22c55e', bg: '#22c55e20' },
  void: { label: 'VOID', color: '#ef4444', bg: '#ef444420' },
  // Legacy status mappings
  new: { label: 'OPEN', color: '#3b82f6', bg: '#3b82f620' },
  has_data: { label: 'ACTIVE', color: '#f59e0b', bg: '#f59e0b20' },
  located: { label: 'CLOSED', color: '#22c55e', bg: '#22c55e20' },
};

const getFtaColor = (score: number): string => {
  if (score >= 70) return '#ef4444'; // danger - very high risk
  if (score >= 50) return '#f97316'; // orange - high risk
  if (score >= 30) return '#f59e0b'; // warning - moderate
  return '#22c55e'; // success - low risk
};

export function CaseCard({
  caseData,
  onPress,
  onDelete,
  status = 'new',
  addressCount = 0,
  phoneCount = 0
}: CaseCardProps) {
  const statusConfig = STATUS_CONFIG[status];
  const hasData = addressCount > 0 || phoneCount > 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Build physical description line from primaryTarget or rosterData
  const getPhysicalLine = (): string => {
    const pt = caseData.primaryTarget;
    const inmate = caseData.rosterData?.inmate;
    const parts: string[] = [];
    const race = pt?.race || inmate?.race;
    const sex = pt?.sex || inmate?.sex;
    if (race && sex) {
      // Compact: "W/M" or "B/F"
      parts.push(`${race.charAt(0)}/${sex.charAt(0)}`);
    } else if (race) {
      parts.push(race);
    } else if (sex) {
      parts.push(sex);
    }
    const height = pt?.height || inmate?.height;
    if (height) parts.push(height);
    const weight = pt?.weight || inmate?.weight;
    if (weight) parts.push(weight.includes('lb') ? weight : `${weight} lbs`);
    return parts.join('  ');
  };

  // Charges summary
  const getChargesSummary = (): string => {
    const charges = caseData.charges;
    if (!charges || charges.length === 0) return '';
    if (charges.length === 1) return charges[0];
    if (charges.length <= 2) return charges.join(', ');
    return `${charges[0]} +${charges.length - 1} more`;
  };

  // Bond display
  const getBondDisplay = (): string => {
    const amount = caseData.bondAmount;
    if (!amount || amount === 0) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
  };

  const physicalLine = getPhysicalLine();
  const chargesSummary = getChargesSummary();
  const bondDisplay = getBondDisplay();
  const hasDetails = physicalLine || chargesSummary || bondDisplay;

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: statusConfig.color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Mugshot photo */}
      <View style={styles.photoContainer}>
        {caseData.mugshotUrl ? (
          <Image source={{ uri: caseData.mugshotUrl }} style={styles.mugshot} />
        ) : (
          <View style={styles.mugshotPlaceholder}>
            <Ionicons name="person" size={28} color="#52525b" />
          </View>
        )}
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Top row: Name and status */}
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{caseData.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Physical description line */}
        {physicalLine ? (
          <Text style={styles.physicalLine} numberOfLines={1}>{physicalLine}</Text>
        ) : null}

        {/* Stats row: FTA, addresses, phones */}
        <View style={styles.statsRow}>
          {caseData.ftaScore !== undefined && (
            <View style={[styles.ftaBadge, { backgroundColor: getFtaColor(caseData.ftaScore) + '25' }]}>
              <Ionicons name="shield-checkmark" size={12} color={getFtaColor(caseData.ftaScore)} />
              <Text style={[styles.ftaScore, { color: getFtaColor(caseData.ftaScore) }]}>
                FTA: {caseData.ftaScore}
              </Text>
            </View>
          )}
          {hasData && (
            <>
              <View style={styles.stat}>
                <Ionicons name="location" size={14} color={COLORS.primary} />
                <Text style={styles.statText}>{addressCount}</Text>
              </View>
              {phoneCount > 0 && (
                <View style={styles.stat}>
                  <Ionicons name="call" size={14} color={COLORS.success} />
                  <Text style={styles.statText}>{phoneCount}</Text>
                </View>
              )}
            </>
          )}
          {bondDisplay ? (
            <Text style={styles.bondText}>{bondDisplay}</Text>
          ) : null}
        </View>

        {/* Charges line */}
        {chargesSummary ? (
          <Text style={styles.chargesLine} numberOfLines={1}>{chargesSummary}</Text>
        ) : null}

        {!hasData && !caseData.ftaScore && !hasDetails && (
          <Text style={styles.noDataText}>No data yet</Text>
        )}

        {/* Bottom row: Meta info */}
        <View style={styles.bottomRow}>
          {caseData.internalCaseId && (
            <Text style={styles.caseId}>#{caseData.internalCaseId}</Text>
          )}
          <Text style={styles.date}>{formatDate(caseData.updatedAt)}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {onDelete && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={styles.deleteBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  photoContainer: {
    marginRight: 12,
  },
  mugshot: {
    width: 56,
    height: 68,
    borderRadius: 6,
    backgroundColor: '#18181b',
  },
  mugshotPlaceholder: {
    width: 56,
    height: 68,
    borderRadius: 6,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fafafa',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  ftaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ftaScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  physicalLine: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  chargesLine: {
    fontSize: 12,
    color: '#d4d4d8',
    marginBottom: 4,
  },
  bondText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fbbf24',
  },
  noDataText: {
    fontSize: 13,
    color: '#52525b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  caseId: {
    fontSize: 12,
    color: '#52525b',
    fontFamily: 'monospace',
  },
  date: {
    fontSize: 12,
    color: '#52525b',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  deleteBtn: {
    padding: 6,
  },
});
