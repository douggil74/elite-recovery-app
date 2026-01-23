import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import type { Case } from '@/types';

export type CaseStatus = 'new' | 'has_data' | 'active' | 'located';

interface CaseCardProps {
  caseData: Case;
  onPress: () => void;
  onDelete?: () => void;
  status?: CaseStatus;
  addressCount?: number;
  phoneCount?: number;
}

const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: '#71717a', bg: '#71717a20' },
  has_data: { label: 'Ready', color: '#dc2626', bg: '#dc262620' },
  active: { label: 'Active', color: '#f59e0b', bg: '#f59e0b20' },
  located: { label: 'Located', color: '#22c55e', bg: '#22c55e20' },
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
            <Ionicons name="person" size={24} color="#52525b" />
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

        {/* Middle row: Stats */}
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
        </View>
        {!hasData && !caseData.ftaScore && (
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
    width: 50,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#18181b',
  },
  mugshotPlaceholder: {
    width: 50,
    height: 60,
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
    marginBottom: 8,
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
