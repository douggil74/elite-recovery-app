import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useCases } from '@/hooks/useCases';

export default function HomeScreen() {
  const router = useRouter();
  const { cases, refresh } = useCases();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const recentCases = cases.slice(0, 3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Bail Recovery</Text>
        <Text style={styles.subtitle}>Professional Case Management</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/case/new')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '15' }]}>
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.actionTitle}>New Case</Text>
            <Text style={styles.actionDesc}>Create a recovery case</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '15' }]}>
              <Ionicons name="folder-open" size={28} color={COLORS.success} />
            </View>
            <Text style={styles.actionTitle}>All Cases</Text>
            <Text style={styles.actionDesc}>{cases.length} case{cases.length !== 1 ? 's' : ''}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/audit')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning + '15' }]}>
              <Ionicons name="document-text" size={28} color={COLORS.warning} />
            </View>
            <Text style={styles.actionTitle}>Audit Log</Text>
            <Text style={styles.actionDesc}>View activity</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.secondary + '15' }]}>
              <Ionicons name="settings" size={28} color={COLORS.secondary} />
            </View>
            <Text style={styles.actionTitle}>Settings</Text>
            <Text style={styles.actionDesc}>Configure app</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Cases */}
      {recentCases.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Cases</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentCases.map((caseItem) => (
            <TouchableOpacity
              key={caseItem.id}
              style={styles.caseItem}
              onPress={() => router.push(`/case/${caseItem.id}`)}
            >
              <View style={styles.caseIcon}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.caseInfo}>
                <Text style={styles.caseName}>{caseItem.name}</Text>
                <Text style={styles.caseDate}>
                  {new Date(caseItem.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          All activity is logged for compliance. Use only for authorized bail recovery purposes.
        </Text>
      </View>

      {/* Version */}
      <Text style={styles.version}>
        v1.0.0 • {Platform.OS === 'web' ? 'Web' : Platform.OS}
      </Text>
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
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  caseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  caseIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  caseInfo: {
    flex: 1,
  },
  caseName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  caseDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 18,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
