import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CaseCard } from '@/components';
import { useCases } from '@/hooks/useCases';
import { confirm } from '@/lib/confirm';
import { COLORS } from '@/constants';

// Load Black Ops One font for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap';
  link.rel = 'stylesheet';
  if (!document.head.querySelector('link[href*="Black+Ops+One"]')) {
    document.head.appendChild(link);
  }
}

// Use shared COLORS for consistency across app
const THEME = {
  bg: COLORS.background,
  surface: COLORS.card,
  surfaceLight: COLORS.surface,
  border: COLORS.border,
  borderLight: COLORS.borderLight,
  primary: COLORS.primary,
  primaryMuted: COLORS.primaryMuted,
  success: COLORS.success,
  info: '#3b82f6',
  text: COLORS.text,
  textSecondary: COLORS.textSecondary,
  textMuted: COLORS.textMuted,
};

export default function CasesScreen() {
  const router = useRouter();
  const { cases, isLoading, error, refresh, deleteCase } = useCases();

  // Initial load
  useEffect(() => {
    refresh();
  }, []);

  // Refresh when screen gets focus (coming back from other tabs)
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
        <Ionicons name="folder-open-outline" size={48} color={THEME.primary} />
      </View>
      <Text style={styles.emptyTitle}>No Cases</Text>
      <Text style={styles.emptyText}>
        Create your first case to begin tracking a subject.
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handleNewCase}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>New Case</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* TRACE Header - Centered Branding */}
      <View style={styles.brandHeader}>
        <View style={styles.brandTitleRow}>
          <Ionicons name="locate" size={42} color={THEME.primary} style={styles.brandLogo} />
          <Text style={styles.brandTitle}>TRACE</Text>
        </View>
        <Text style={styles.brandAcronym}>
          <Text style={styles.acronymLetter}>T</Text>actical{' '}
          <Text style={styles.acronymLetter}>R</Text>ecovery{' '}
          <Text style={styles.acronymLetter}>A</Text>nalysis &{' '}
          <Text style={styles.acronymLetter}>C</Text>apture{' '}
          <Text style={styles.acronymLetter}>E</Text>ngine
        </Text>
      </View>

      {/* Sub Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitle}>
            {totalCases === 0
              ? 'AI-powered fugitive recovery intelligence'
              : `${totalCases} case${totalCases !== 1 ? 's' : ''} · ${totalAddresses} locations`}
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
            <Text style={[styles.statValue, { color: THEME.primary }]}>{totalAddresses}</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={18} color="#ef4444" />
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
        style={styles.listWrapper}
        contentContainerStyle={[
          styles.listContent,
          cases.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={THEME.primary}
          />
        }
        ListEmptyComponent={isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
            <Text style={styles.loadingText}>Loading cases...</Text>
          </View>
        ) : renderEmptyState()}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    width: '100%',
    maxWidth: 800,
  },
  brandHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 12,
    width: '100%',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogo: {
    textShadowColor: THEME.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: '400',
    color: THEME.primary,
    letterSpacing: 8,
    textShadowColor: THEME.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
    fontFamily: '"Black Ops One", monospace',
  },
  brandAcronym: {
    fontSize: 12,
    color: THEME.textSecondary,
    letterSpacing: 2,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  acronymLetter: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.primary,
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
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    borderColor: THEME.border,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: THEME.border,
  },
  listWrapper: {
    width: '100%',
    maxWidth: 800,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: THEME.textSecondary,
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
    backgroundColor: THEME.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: THEME.text,
  },
  emptyText: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 240,
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
    backgroundColor: '#ef444420',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 14,
  },
  retryText: {
    color: THEME.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '80%',
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.border,
  },
  orText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  importButton: {
    backgroundColor: THEME.info,
  },
  importHint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  // Footer styles for import link
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  importFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.primary,
    backgroundColor: THEME.primaryMuted,
  },
  importFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  importFooterHint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
