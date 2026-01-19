import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  new: { label: 'New', color: '#8b949e', bg: '#8b949e15' },
  has_data: { label: 'Ready', color: '#58a6ff', bg: '#58a6ff15' },
  active: { label: 'Active', color: '#d29922', bg: '#d2992215' },
  located: { label: 'Located', color: '#3fb950', bg: '#3fb95015' },
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
        {hasData ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="location" size={14} color={COLORS.primary} />
              <Text style={styles.statText}>{addressCount} locations</Text>
            </View>
            {phoneCount > 0 && (
              <View style={styles.stat}>
                <Ionicons name="call" size={14} color={COLORS.success} />
                <Text style={styles.statText}>{phoneCount} phones</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.noDataText}>No report data yet</Text>
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
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2128',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#30363d',
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
    color: '#e6edf3',
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
    gap: 16,
    marginBottom: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 13,
    color: '#8b949e',
  },
  noDataText: {
    fontSize: 13,
    color: '#6e7681',
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
    color: '#6e7681',
    fontFamily: 'monospace',
  },
  date: {
    fontSize: 12,
    color: '#6e7681',
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
