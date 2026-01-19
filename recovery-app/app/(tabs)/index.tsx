import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CaseCard } from '@/components';
import { useCases } from '@/hooks/useCases';
import { confirm } from '@/lib/confirm';

const DARK = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  primary: '#58a6ff',
  success: '#3fb950',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
};

export default function CasesScreen() {
  const router = useRouter();
  const { cases, isLoading, error, refresh, deleteCase } = useCases();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleCasePress = (caseId: string) => {
    router.push(`/case/${caseId}`);
  };

  const handleNewCase = () => {
    router.push('/case/new');
  };

  const handleDeleteCase = async (caseId: string, caseName: string) => {
    const confirmed = await confirm({
      title: 'Delete Case',
      message: `Delete "${caseName}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });

    if (confirmed) {
      await deleteCase(caseId);
    }
  };

  // Stats summary
  const totalCases = cases.length;
  const casesWithData = cases.filter(c => c.addressCount > 0).length;
  const totalAddresses = cases.reduce((sum, c) => sum + c.addressCount, 0);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="briefcase-outline" size={48} color={DARK.primary} />
      </View>
      <Text style={styles.emptyTitle}>No Cases Yet</Text>
      <Text style={styles.emptyText}>
        Add your first recovery case to get started with AI-powered skip trace analysis.
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleNewCase}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>Create First Case</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Recovery Dashboard</Text>
          <Text style={styles.subtitle}>
            {totalCases === 0
              ? 'Ready to start'
              : `${totalCases} case${totalCases !== 1 ? 's' : ''} · ${totalAddresses} locations tracked`}
          </Text>
        </View>
        {totalCases > 0 && (
          <TouchableOpacity style={styles.addButton} onPress={handleNewCase}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick stats */}
      {totalCases > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{casesWithData}</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalCases - casesWithData}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalAddresses}</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={18} color="#f85149" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cases list */}
      <FlatList
        data={cases}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CaseCard
            caseData={item}
            onPress={() => handleCasePress(item.id)}
            onDelete={() => handleDeleteCase(item.id, item.name)}
            status={item.status}
            addressCount={item.addressCount}
            phoneCount={item.phoneCount}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          cases.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={DARK.primary}
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK.text,
  },
  subtitle: {
    fontSize: 14,
    color: DARK.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DARK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: DARK.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK.text,
  },
  statLabel: {
    fontSize: 11,
    color: DARK.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: DARK.border,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DARK.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: DARK.text,
  },
  emptyText: {
    fontSize: 15,
    color: DARK.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DARK.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8514920',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
  },
  errorText: {
    flex: 1,
    color: '#f85149',
    fontSize: 14,
  },
  retryText: {
    color: DARK.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
