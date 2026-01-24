import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
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
        <Ionicons name="document-text" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Intel Report</Text>
        <Text style={styles.emptyText}>
          Upload bail bond paperwork or documents to generate a comprehensive intel report.
        </Text>
        <Button
          title="Upload Documents"
          onPress={() => router.push(`/case/${id}/upload`)}
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  // Get all data from parsed report
  const parsedData = latestReport?.parsedData;
  const subject = parsedData?.subject || {};
  const addresses = parsedData?.addresses || [];
  const phones = parsedData?.phones || [];
  const relatives = parsedData?.relatives || [];
  const vehicles = parsedData?.vehicles || [];
  const employment = parsedData?.employment || [];
  const flags = parsedData?.flags || [];
  const recommendations = parsedData?.recommendations || [];

  // Get brief data for action plan
  const { actionPlan, likelyLocations, contactStrategy } = brief as any;

  // Get the PRIMARY TARGET name - use case name first (from jail roster/mugshot), not parsed doc subject
  // The parsed doc subject might be a co-signer, reference, or indemnitor - NOT the actual target
  const primaryTargetName = caseData?.name || caseData?.primaryTarget?.fullName || 'Unknown';
  const primaryTargetDOB = caseData?.rosterData?.inmate?.dob || caseData?.primaryTarget?.dob || subject.dob;

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.reportTitle}>INTEL REPORT</Text>
        <Text style={styles.reportSubtitle}>{primaryTargetName}</Text>
      </View>

      {/* Warnings/Red Flags at top */}
      {flags.length > 0 && flags.map((flag: any, idx: number) => (
        <WarningBanner
          key={idx}
          title={flag.type?.toUpperCase() || 'WARNING'}
          message={flag.message}
          severity={flag.severity || 'medium'}
        />
      ))}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SUBJECT PROFILE */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>SUBJECT PROFILE</Text>
        </View>
        <Card style={styles.card}>
          <Text style={styles.subjectName}>{primaryTargetName}</Text>

          <View style={styles.infoGrid}>
            {primaryTargetDOB && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>DOB:</Text>
                <Text style={styles.infoValue}>{primaryTargetDOB}</Text>
              </View>
            )}
            {subject.partialSsn && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>SSN:</Text>
                <Text style={styles.infoValue}>XXX-XX-{subject.partialSsn}</Text>
              </View>
            )}
            {subject.personId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CID:</Text>
                <Text style={styles.infoValue}>{subject.personId}</Text>
              </View>
            )}
            {phones.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone:</Text>
                <Text style={styles.infoValueMono}>{phones[0].number}</Text>
              </View>
            )}
            {subject.aliases && subject.aliases.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>AKA:</Text>
                <Text style={styles.infoValue}>{subject.aliases.join(', ')}</Text>
              </View>
            )}
          </View>
        </Card>
      </View>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CHARGES & BOND */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {recommendations.some((r: string) => r.includes('Bond') || r.includes('Charge')) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
            <Text style={styles.sectionTitle}>CHARGES & BOND</Text>
          </View>
          <Card style={styles.card}>
            {recommendations
              .filter((r: string) => r.includes('Bond') || r.includes('Charge'))
              .map((rec: string, idx: number) => {
                const isBond = rec.includes('Total Bond');
                return (
                  <View key={idx} style={[styles.chargeItem, isBond && styles.bondTotal]}>
                    <Text style={[styles.chargeText, isBond && styles.bondTotalText]}>
                      {rec}
                    </Text>
                  </View>
                );
              })}
          </Card>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TOP LOCATIONS - RANKED */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {(likelyLocations?.length > 0 || addresses.length > 0) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={COLORS.success} />
            <Text style={styles.sectionTitle}>TOP LOCATIONS</Text>
          </View>

          {likelyLocations?.length > 0 ? (
            likelyLocations.slice(0, 5).map((loc: any, idx: number) => (
              <Card key={idx} style={[styles.locationCard, idx === 0 && styles.topLocation]}>
                <View style={styles.locationHeader}>
                  <View style={[styles.rankBadge, idx === 0 && styles.rankBadgeTop]}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>
                  {loc.probability && (
                    <View style={styles.probabilityBadge}>
                      <Text style={styles.probabilityText}>{loc.probability}%</Text>
                    </View>
                  )}
                  {loc.type && (
                    <Text style={styles.locationType}>
                      {loc.type.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.locationAddress}>{loc.address}</Text>
                {loc.reasoning && (
                  <Text style={styles.locationReason}>{loc.reasoning}</Text>
                )}
                {loc.tips && (
                  <View style={styles.tipBox}>
                    <Ionicons name="time" size={14} color={COLORS.warning} />
                    <Text style={styles.tipText}>{loc.tips}</Text>
                  </View>
                )}
              </Card>
            ))
          ) : (
            addresses.slice(0, 5).map((addr: any, idx: number) => (
              <Card key={idx} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>
                  {addr.confidence && (
                    <View style={styles.probabilityBadge}>
                      <Text style={styles.probabilityText}>
                        {Math.round(addr.confidence * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.locationAddress}>
                  {addr.fullAddress || addr.address}
                </Text>
                {addr.reasons?.length > 0 && (
                  <Text style={styles.locationReason}>{addr.reasons[0]}</Text>
                )}
              </Card>
            ))
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CONTACTS / REFERENCES */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {(relatives.length > 0 || contactStrategy?.keyContacts?.length > 0) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>CONTACTS / REFERENCES</Text>
          </View>
          <Card style={styles.card}>
            {(contactStrategy?.keyContacts || relatives).map((contact: any, idx: number) => (
              <View key={idx} style={styles.contactItem}>
                <View style={styles.contactHeader}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactRelation}>{contact.relationship}</Text>
                </View>
                {(contact.phone || contact.phones?.[0]) && (
                  <View style={styles.contactDetail}>
                    <Ionicons name="call" size={14} color={COLORS.success} />
                    <Text style={styles.contactPhone}>
                      {contact.phone || contact.phones?.[0]}
                    </Text>
                  </View>
                )}
                {(contact.address || contact.currentAddress) && (
                  <View style={styles.contactDetail}>
                    <Ionicons name="location" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.contactAddress}>
                      {contact.address || contact.currentAddress}
                    </Text>
                  </View>
                )}
                {contact.approach && (
                  <Text style={styles.contactApproach}>→ {contact.approach}</Text>
                )}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* VEHICLE */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {vehicles.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car" size={20} color={COLORS.warning} />
            <Text style={styles.sectionTitle}>VEHICLE</Text>
          </View>
          <Card style={styles.card}>
            {vehicles.map((v: any, idx: number) => (
              <View key={idx} style={styles.vehicleItem}>
                <Text style={styles.vehicleDesc}>
                  {[v.year, v.make, v.model, v.color].filter(Boolean).join(' ') || v.description}
                </Text>
                {v.plate && (
                  <View style={styles.plateContainer}>
                    <Text style={styles.plateLabel}>PLATE:</Text>
                    <Text style={styles.plateNumber}>{v.plate}</Text>
                  </View>
                )}
                {v.vin && (
                  <Text style={styles.vinText}>VIN: {v.vin}</Text>
                )}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* EMPLOYMENT */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {employment.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>EMPLOYMENT</Text>
          </View>
          <Card style={styles.card}>
            {employment.map((emp: any, idx: number) => (
              <View key={idx} style={styles.employmentItem}>
                <View style={styles.employmentHeader}>
                  <Text style={styles.employerName}>{emp.employer}</Text>
                  {emp.isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentText}>CURRENT</Text>
                    </View>
                  )}
                </View>
                {emp.title && <Text style={styles.jobTitle}>{emp.title}</Text>}
                {emp.address && (
                  <View style={styles.employmentDetail}>
                    <Ionicons name="location" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.employmentAddress}>{emp.address}</Text>
                  </View>
                )}
                {emp.phone && (
                  <View style={styles.employmentDetail}>
                    <Ionicons name="call" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.employmentPhone}>{emp.phone}</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PHONE NUMBERS */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {phones.length > 1 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="call" size={20} color={COLORS.success} />
            <Text style={styles.sectionTitle}>ALL PHONE NUMBERS</Text>
          </View>
          <Card style={styles.card}>
            {phones.map((phone: any, idx: number) => (
              <View key={idx} style={styles.phoneItem}>
                <Text style={styles.phoneNumber}>{phone.number}</Text>
                <Text style={styles.phoneType}>{phone.type || 'unknown'}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* KEY INTEL / CASE NOTES */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {recommendations.filter((r: string) => !r.includes('Bond') && !r.includes('Charge')).length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={20} color={COLORS.warning} />
            <Text style={styles.sectionTitle}>KEY INTEL</Text>
          </View>
          <Card style={styles.card}>
            {recommendations
              .filter((r: string) => !r.includes('Bond') && !r.includes('Charge'))
              .map((note: string, idx: number) => (
                <View key={idx} style={styles.intelItem}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.intelText}>{note}</Text>
                </View>
              ))}
          </Card>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* RECOMMENDED ACTION PLAN */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {actionPlan && actionPlan.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.sectionTitle}>RECOMMENDED ACTION PLAN</Text>
          </View>
          <Card style={styles.card}>
            {actionPlan.map((action: any, idx: number) => (
              <View key={idx} style={styles.actionItem}>
                <View style={[
                  styles.actionNumber,
                  action.priority === 'high' && styles.actionNumberHigh
                ]}>
                  <Text style={styles.actionNumberText}>{action.step || idx + 1}</Text>
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionText}>{action.action}</Text>
                  <View style={styles.actionMeta}>
                    <View style={[
                      styles.actionTag,
                      action.cost === 'free' && styles.tagFree,
                      action.cost === 'cheap' && styles.tagCheap,
                    ]}>
                      <Text style={[
                        styles.actionTagText,
                        action.cost === 'free' && styles.tagTextFree,
                        action.cost === 'cheap' && styles.tagTextCheap,
                      ]}>
                        {action.cost}
                      </Text>
                    </View>
                    <View style={[
                      styles.actionTag,
                      action.priority === 'high' && styles.tagHigh,
                    ]}>
                      <Text style={[
                        styles.actionTagText,
                        action.priority === 'high' && styles.tagTextHigh,
                      ]}>
                        {action.priority}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Report generated {new Date(brief.generatedAt).toLocaleString()}
        </Text>
        <Text style={styles.footerMethod}>
          {parsedData?.parseMethod === 'ai' ? 'AI-Powered Analysis' : 'Standard Analysis'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
    backgroundColor: '#0a0a0a',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fafafa',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  // Header
  header: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  reportTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  reportSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fafafa',
    marginTop: 4,
  },
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  // Subject Profile
  subjectName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 16,
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717a',
    width: 70,
  },
  infoValue: {
    fontSize: 15,
    color: '#fafafa',
    flex: 1,
  },
  infoValueMono: {
    fontSize: 15,
    color: '#22c55e',
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
  },
  // Charges
  chargeItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  chargeText: {
    fontSize: 14,
    color: '#fafafa',
  },
  bondTotal: {
    backgroundColor: COLORS.danger + '15',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginBottom: -16,
    marginTop: 8,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  bondTotalText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
  // Locations
  locationCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  topLocation: {
    borderLeftColor: COLORS.success,
    borderColor: COLORS.success + '40',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  rankBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rankBadgeTop: {
    backgroundColor: COLORS.success,
  },
  rankText: {
    color: '#fff',
    fontWeight: '800',
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
  locationType: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 6,
  },
  locationReason: {
    fontSize: 14,
    color: '#a1a1aa',
    lineHeight: 20,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: COLORS.warning + '15',
    padding: 10,
    borderRadius: 8,
  },
  tipText: {
    fontSize: 13,
    color: COLORS.warning,
    flex: 1,
  },
  // Contacts
  contactItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fafafa',
  },
  contactRelation: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  contactPhone: {
    fontSize: 15,
    color: COLORS.success,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  contactAddress: {
    fontSize: 14,
    color: '#a1a1aa',
    flex: 1,
  },
  contactApproach: {
    fontSize: 13,
    color: COLORS.warning,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Vehicle
  vehicleItem: {
    paddingVertical: 8,
  },
  vehicleDesc: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 8,
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8,
  },
  plateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
  },
  plateNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.warning,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  vinText: {
    fontSize: 12,
    color: '#71717a',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  // Employment
  employmentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  employmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  employerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fafafa',
    flex: 1,
  },
  currentBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  currentText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: 0.5,
  },
  jobTitle: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 6,
  },
  employmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  employmentAddress: {
    fontSize: 13,
    color: '#a1a1aa',
    flex: 1,
  },
  employmentPhone: {
    fontSize: 14,
    color: '#fafafa',
    fontFamily: 'monospace',
  },
  // Phones
  phoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
    fontFamily: 'monospace',
  },
  phoneType: {
    fontSize: 13,
    color: '#71717a',
  },
  // Intel Notes
  intelItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  bulletPoint: {
    fontSize: 16,
    color: COLORS.warning,
    fontWeight: '700',
  },
  intelText: {
    fontSize: 14,
    color: '#fafafa',
    flex: 1,
    lineHeight: 20,
  },
  // Action Plan
  actionItem: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  actionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionNumberHigh: {
    backgroundColor: COLORS.danger,
  },
  actionNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    color: '#fafafa',
    lineHeight: 22,
    marginBottom: 8,
  },
  actionMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  actionTag: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase',
  },
  tagFree: {
    backgroundColor: COLORS.success + '20',
  },
  tagTextFree: {
    color: COLORS.success,
  },
  tagCheap: {
    backgroundColor: COLORS.primary + '20',
  },
  tagTextCheap: {
    color: COLORS.primary,
  },
  tagHigh: {
    backgroundColor: COLORS.danger + '20',
  },
  tagTextHigh: {
    color: COLORS.danger,
  },
  // Footer
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#52525b',
  },
  footerMethod: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
});
