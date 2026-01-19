import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, WarningBanner } from '@/components';
import { useCase } from '@/hooks/useCase';
import { audit } from '@/lib/audit';
import { maskAddress, maskPhone } from '@/lib/encryption';
import { COLORS, PURPOSE_LABELS } from '@/constants';

const isWeb = Platform.OS === 'web';

export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { caseData, reports, getBrief } = useCase(id!);
  const [isExporting, setIsExporting] = useState(false);

  const latestReport = reports[0];
  const brief = getBrief();

  const generatePdfHtml = (maskSensitive: boolean) => {
    if (!caseData || !latestReport) return '';

    const { subject, addresses, phones, relatives } = latestReport.parsedData;

    const formatAddress = (addr: string) =>
      maskSensitive ? maskAddress(addr) : addr;
    const formatPhone = (phone: string) =>
      maskSensitive ? maskPhone(phone) : phone;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1e40af; margin-bottom: 5px; }
    h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px; }
    .header { margin-bottom: 30px; }
    .meta { color: #6b7280; font-size: 12px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
    .warning-title { font-weight: bold; color: #92400e; }
    .section { margin-bottom: 25px; }
    .info-row { display: flex; margin: 8px 0; }
    .info-label { color: #6b7280; width: 120px; font-size: 13px; }
    .info-value { color: #1f2937; flex: 1; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .rank { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px; }
    .status-pass { color: #059669; }
    .status-concern { color: #d97706; }
    .status-fail { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    th { background: #f3f4f6; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
    .confidential { color: #dc2626; font-weight: bold; text-align: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="confidential">CONFIDENTIAL - AUTHORIZED USE ONLY</div>

  <div class="header">
    <h1>Recovery Brief</h1>
    <div class="meta">
      Case: ${caseData.name} ${caseData.internalCaseId ? `(#${caseData.internalCaseId})` : ''}<br>
      Purpose: ${PURPOSE_LABELS[caseData.purpose]}<br>
      Generated: ${new Date().toLocaleString()}
    </div>
  </div>

  <div class="warning">
    <div class="warning-title">Lawful Use Only</div>
    This document contains sensitive personal information. Use only for authorized bail recovery purposes.
  </div>

  <h2>Subject Information</h2>
  <div class="section">
    <div class="info-row">
      <span class="info-label">Name:</span>
      <span class="info-value">${subject.fullName}</span>
    </div>
    ${subject.dob ? `
    <div class="info-row">
      <span class="info-label">DOB:</span>
      <span class="info-value">${subject.dob}</span>
    </div>` : ''}
    ${subject.partialSsn ? `
    <div class="info-row">
      <span class="info-label">SSN (partial):</span>
      <span class="info-value">${maskSensitive ? '***-**-****' : subject.partialSsn}</span>
    </div>` : ''}
    ${subject.aliases && subject.aliases.length > 0 ? `
    <div class="info-row">
      <span class="info-label">Aliases:</span>
      <span class="info-value">${subject.aliases.join(', ')}</span>
    </div>` : ''}
  </div>

  ${brief ? `
  <h2>Identity Verification</h2>
  <div class="section">
    <p><strong>Status:</strong> <span class="status-${brief.identityCheck.status}">${brief.identityCheck.status.toUpperCase()}</span></p>
    ${brief.identityCheck.reasons.length > 0 ? `<p><strong>Notes:</strong> ${brief.identityCheck.reasons.join('; ')}</p>` : ''}
  </div>` : ''}

  <h2>Top Addresses (Ranked by Likelihood)</h2>
  <div class="section">
    ${addresses.slice(0, 5).map((addr, idx) => `
    <div class="card">
      <span class="rank">#${idx + 1}</span>
      ${addr.isCurrent ? '<span class="badge">CURRENT</span>' : ''}
      <p style="margin: 10px 0;">${formatAddress(addr.fullAddress)}</p>
      <div style="font-size: 12px; color: #6b7280;">
        ${addr.fromDate ? `Dates: ${addr.fromDate} - ${addr.toDate || 'Present'}` : ''}
        ${addr.confidence ? ` | Confidence: ${Math.round(addr.confidence * 100)}%` : ''}
      </div>
      ${addr.reasons.length > 0 ? `<div style="font-size: 12px; color: #059669; margin-top: 5px;">${addr.reasons.join(', ')}</div>` : ''}
    </div>
    `).join('')}
  </div>

  <h2>Contact Numbers</h2>
  <div class="section">
    <table>
      <tr><th>Rank</th><th>Number</th><th>Type</th><th>Status</th></tr>
      ${phones.slice(0, 5).map((phone, idx) => `
      <tr>
        <td>#${idx + 1}</td>
        <td>${formatPhone(phone.number)}</td>
        <td>${phone.type || 'Unknown'}</td>
        <td>${phone.isActive ? 'Active' : 'Unknown'}</td>
      </tr>
      `).join('')}
    </table>
  </div>

  ${relatives.length > 0 ? `
  <h2>Key Relatives/Associates</h2>
  <div class="section">
    <table>
      <tr><th>Name</th><th>Relationship</th><th>Contact</th></tr>
      ${relatives.slice(0, 5).map((rel) => `
      <tr>
        <td>${rel.name}</td>
        <td>${rel.relationship || '-'}</td>
        <td>${rel.phones?.[0] ? formatPhone(rel.phones[0]) : (rel.currentAddress ? formatAddress(rel.currentAddress) : '-')}</td>
      </tr>
      `).join('')}
    </table>
  </div>` : ''}

  ${latestReport.parsedData.vehicles.length > 0 ? `
  <h2>Vehicles</h2>
  <div class="section">
    <table>
      <tr><th>Year</th><th>Make</th><th>Model</th><th>Color</th><th>Plate</th></tr>
      ${latestReport.parsedData.vehicles.slice(0, 3).map((veh) => `
      <tr>
        <td>${veh.year || '-'}</td>
        <td>${veh.make || '-'}</td>
        <td>${veh.model || '-'}</td>
        <td>${veh.color || '-'}</td>
        <td>${veh.plate || '-'}</td>
      </tr>
      `).join('')}
    </table>
  </div>` : ''}

  <div class="footer">
    <p>This document is for authorized bail recovery use only.</p>
    <p>All access has been logged for compliance purposes.</p>
    <p>Generated by Bail Recovery App</p>
  </div>
</body>
</html>
    `;
  };

  const handleExport = async (maskSensitive: boolean) => {
    if (!caseData || !latestReport) {
      Alert.alert('Error', 'No report data available to export.');
      return;
    }

    setIsExporting(true);

    try {
      const html = generatePdfHtml(maskSensitive);

      await audit('brief_exported', {
        caseId: id,
        caseName: caseData.name,
        additionalInfo: maskSensitive ? 'Masked' : 'Full',
      });

      if (isWeb) {
        // Web: Open print dialog with HTML content
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          Alert.alert('Error', 'Please allow popups to export PDF.');
        }
      } else {
        // Native: Use expo-print and expo-sharing
        const Print = await import('expo-print');
        const Sharing = await import('expo-sharing');

        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Recovery Brief - ${caseData.name}`,
          });
        } else {
          Alert.alert('Success', 'PDF generated successfully.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!latestReport) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="share-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Report Data</Text>
        <Text style={styles.emptyText}>
          Upload and analyze a report before exporting.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <WarningBanner
        title="Export Warning"
        message="Exported documents contain sensitive information. Handle and share responsibly according to your organization's policies."
        severity="medium"
      />

      <Card title="Case Brief" style={styles.card}>
        <View style={styles.previewInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Case:</Text>
            <Text style={styles.infoValue}>{caseData?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subject:</Text>
            <Text style={styles.infoValue}>{latestReport.parsedData.subject.fullName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Addresses:</Text>
            <Text style={styles.infoValue}>{latestReport.parsedData.addresses.length} found</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phones:</Text>
            <Text style={styles.infoValue}>{latestReport.parsedData.phones.length} found</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Export Options</Text>

      <Card style={styles.optionCard}>
        <View style={styles.optionHeader}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.success} />
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>Masked (Recommended)</Text>
            <Text style={styles.optionDescription}>
              SSN, full addresses, and phone numbers are partially masked. Safe for sharing with team members.
            </Text>
          </View>
        </View>
        <Button
          title="Export Masked PDF"
          onPress={() => handleExport(true)}
          loading={isExporting}
          style={styles.exportButton}
          icon={<Ionicons name="download" size={18} color="#fff" />}
        />
      </Card>

      <Card style={styles.optionCard}>
        <View style={styles.optionHeader}>
          <Ionicons name="warning" size={24} color={COLORS.warning} />
          <View style={styles.optionInfo}>
            <Text style={styles.optionTitle}>Full (Unmasked)</Text>
            <Text style={styles.optionDescription}>
              All data is visible. Only use for internal records. Handle with care.
            </Text>
          </View>
        </View>
        <Button
          title="Export Full PDF"
          onPress={() => handleExport(false)}
          variant="secondary"
          loading={isExporting}
          style={styles.exportButton}
          icon={<Ionicons name="download-outline" size={18} color={COLORS.text} />}
        />
      </Card>

      <Text style={styles.disclaimer}>
        All exports are logged in the audit trail. PDFs are generated locally and not stored on any server.
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
  card: {
    marginBottom: 16,
  },
  previewInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  optionCard: {
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  exportButton: {
    alignSelf: 'flex-start',
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
