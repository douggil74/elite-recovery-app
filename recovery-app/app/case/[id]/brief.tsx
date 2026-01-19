import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, WarningBanner } from '@/components';
import { useCase } from '@/hooks/useCase';
import { COLORS } from '@/constants';

export default function BriefScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { caseData, reports, refresh, getBrief } = useCase(id!);
  const [refreshing, setRefreshing] = useState(false);

  const brief = getBrief();
  const latestReport = reports[0];

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (!brief || !latestReport) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Analysis Yet</Text>
        <Text style={styles.emptyText}>
          Upload a skip-trace report to get AI-powered location recommendations.
        </Text>
        <Button
          title="Upload Report"
          onPress={() => router.push(`/case/${id}/upload`)}
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  const { subject, likelyLocations, contactStrategy, redFlags, actionPlan, analysisNotes } = brief as any;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Red Flags at top */}
      {redFlags && redFlags.length > 0 && redFlags.map((flag: any, idx: number) => (
        <WarningBanner
          key={idx}
          title={flag.type?.toUpperCase() || 'WARNING'}
          message={flag.message}
          severity={flag.severity || 'medium'}
        />
      ))}

      {/* Subject Identity */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>SUBJECT</Text>
        <Text style={styles.subjectName}>{subject?.fullName || 'Unknown'}</Text>
        {subject?.dob && (
          <Text style={styles.subjectDetail}>DOB: {subject.dob}</Text>
        )}
        {subject?.aliases && subject.aliases.length > 0 && (
          <Text style={styles.subjectDetail}>
            AKA: {subject.aliases.join(', ')}
          </Text>
        )}
        {subject?.description && (
          <Text style={styles.subjectDescription}>{subject.description}</Text>
        )}
      </Card>

      {/* Most Likely Locations - THE KEY OUTPUT */}
      <Text style={styles.mainSectionTitle}>WHERE TO LOOK</Text>
      {likelyLocations && likelyLocations.length > 0 ? (
        likelyLocations.map((location: any, idx: number) => (
          <Card key={idx} style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{location.rank || idx + 1}</Text>
              </View>
              <View style={styles.probabilityBadge}>
                <Text style={styles.probabilityText}>{location.probability}%</Text>
              </View>
            </View>
            <Text style={styles.locationAddress}>{location.address}</Text>
            {location.type && (
              <Text style={styles.locationType}>{location.type.replace('_', ' ')}</Text>
            )}
            <Text style={styles.locationReasoning}>{location.reasoning}</Text>
            {location.tips && (
              <View style={styles.tipContainer}>
                <Ionicons name="bulb" size={14} color={COLORS.warning} />
                <Text style={styles.tipText}>{location.tips}</Text>
              </View>
            )}
          </Card>
        ))
      ) : (
        <Card style={styles.card}>
          <Text style={styles.noDataText}>No locations found in report</Text>
        </Card>
      )}

      {/* Contact Strategy */}
      {contactStrategy && (contactStrategy.phones?.length > 0 || contactStrategy.keyContacts?.length > 0) && (
        <>
          <Text style={styles.mainSectionTitle}>CONTACT STRATEGY</Text>

          {contactStrategy.phones?.length > 0 && (
            <Card style={styles.card}>
              <Text style={styles.subsectionTitle}>Phone Numbers</Text>
              {contactStrategy.phones.map((phone: any, idx: number) => (
                <View key={idx} style={styles.contactItem}>
                  <View style={styles.contactMain}>
                    <Text style={styles.phoneNumber}>{phone.number}</Text>
                    <Text style={styles.phoneType}>{phone.type}</Text>
                  </View>
                  {phone.notes && (
                    <Text style={styles.contactNotes}>{phone.notes}</Text>
                  )}
                </View>
              ))}
            </Card>
          )}

          {contactStrategy.keyContacts?.length > 0 && (
            <Card style={styles.card}>
              <Text style={styles.subsectionTitle}>Key People</Text>
              {contactStrategy.keyContacts.map((contact: any, idx: number) => (
                <View key={idx} style={styles.contactItem}>
                  <View style={styles.contactMain}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactRelation}>{contact.relationship}</Text>
                  </View>
                  {contact.phone && (
                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                  )}
                  {contact.address && (
                    <Text style={styles.contactAddress}>{contact.address}</Text>
                  )}
                  {contact.approach && (
                    <Text style={styles.contactApproach}>→ {contact.approach}</Text>
                  )}
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Action Plan */}
      {actionPlan && actionPlan.length > 0 && (
        <>
          <Text style={styles.mainSectionTitle}>ACTION PLAN</Text>
          <Card style={styles.card}>
            {actionPlan.map((action: any, idx: number) => (
              <View key={idx} style={styles.actionItem}>
                <View style={styles.actionStepBadge}>
                  <Text style={styles.actionStepText}>{action.step}</Text>
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionText}>{action.action}</Text>
                  <View style={styles.actionMeta}>
                    <Text style={[
                      styles.actionCost,
                      action.cost === 'free' && styles.costFree,
                      action.cost === 'cheap' && styles.costCheap,
                    ]}>
                      {action.cost}
                    </Text>
                    <Text style={[
                      styles.actionPriority,
                      action.priority === 'high' && styles.priorityHigh,
                    ]}>
                      {action.priority}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Analysis Notes */}
      {analysisNotes && (
        <Card style={styles.card}>
          <Text style={styles.subsectionTitle}>Additional Notes</Text>
          <Text style={styles.notesText}>{analysisNotes}</Text>
        </Card>
      )}

      <Text style={styles.footer}>
        Analysis generated {new Date(brief.generatedAt).toLocaleString()}
        {brief.method === 'ai' ? ' • AI Analysis' : ' • Basic Analysis'}
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
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  mainSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  subjectName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subjectDetail: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  subjectDescription: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 8,
    fontStyle: 'italic',
  },
  locationCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rankBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rankText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  probabilityBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  probabilityText: {
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 14,
  },
  locationAddress: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  locationType: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  locationReasoning: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: COLORS.warning + '15',
    padding: 10,
    borderRadius: 8,
  },
  tipText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  contactItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  phoneType: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  contactNotes: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  contactRelation: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  contactPhone: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  contactAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contactApproach: {
    fontSize: 13,
    color: COLORS.warning,
    marginTop: 6,
    fontStyle: 'italic',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionStepText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 21,
  },
  actionMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionCost: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  costFree: {
    backgroundColor: COLORS.success + '20',
    color: COLORS.success,
  },
  costCheap: {
    backgroundColor: COLORS.primary + '20',
    color: COLORS.primary,
  },
  actionPriority: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: COLORS.danger + '20',
    color: COLORS.danger,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 20,
  },
});
