import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAuditLog, formatAuditEntry } from '@/lib/audit';
import { COLORS, AUDIT_ACTION_LABELS } from '@/constants';
import type { AuditLogEntry } from '@/types';

export default function AuditScreen() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const log = await getAuditLog({ limit: 200 });
      setEntries(log);
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  const getActionIcon = (action: string): string => {
    const icons: Record<string, string> = {
      case_created: 'folder-outline',
      case_updated: 'create-outline',
      case_deleted: 'trash-outline',
      pdf_uploaded: 'cloud-upload-outline',
      report_parsed: 'analytics-outline',
      report_viewed: 'eye-outline',
      field_revealed: 'eye-outline',
      brief_generated: 'document-text-outline',
      brief_exported: 'share-outline',
      journey_created: 'navigate-outline',
      case_shared: 'share-social-outline',
    };
    return icons[action] || 'ellipse-outline';
  };

  const getActionColor = (action: string): string => {
    if (action.includes('delete')) return COLORS.danger;
    if (action.includes('reveal')) return COLORS.warning;
    if (action.includes('created') || action.includes('upload')) return COLORS.success;
    return COLORS.primary;
  };

  const renderEntry = ({ item }: { item: AuditLogEntry }) => {
    const formatted = formatAuditEntry(item);
    const icon = getActionIcon(item.action);
    const color = getActionColor(item.action);

    return (
      <View style={styles.entry}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <View style={styles.entryContent}>
          <Text style={styles.entryTitle}>{formatted.title}</Text>
          {formatted.description ? (
            <Text style={styles.entryDescription} numberOfLines={2}>
              {formatted.description}
            </Text>
          ) : null}
          <Text style={styles.entryTime}>{formatted.time}</Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No Activity Yet</Text>
      <Text style={styles.emptyText}>
        Your activity history will appear here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
        <Text style={styles.headerText}>
          All actions are logged for compliance
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={[
          styles.listContent,
          entries.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadEntries}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary + '10',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  headerText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  entryContent: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  entryDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  entryTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
