import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCase } from '@/hooks/useCase';
import { COLORS } from '@/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCaseIntel, saveCaseIntel, type CaseIntel } from '@/lib/case-intel';

const isWeb = Platform.OS === 'web';

export default function WantedPosterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { caseData, reports, isLoading } = useCase(id!);
  const [subjectPhoto, setSubjectPhoto] = useState<string | null>(null);
  const [caseIntel, setCaseIntel] = useState<CaseIntel | null>(null);
  const [description, setDescription] = useState('');
  const [lastSeen, setLastSeen] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const photo = await AsyncStorage.getItem(`case_photo_${id}`);
        if (photo) setSubjectPhoto(photo);

        const intel = await loadCaseIntel(id);
        setCaseIntel(intel);
        if (intel.posterOverrides) {
          if (intel.posterOverrides.description) setDescription(intel.posterOverrides.description);
          if (intel.posterOverrides.lastSeen) setLastSeen(intel.posterOverrides.lastSeen);
          if (intel.posterOverrides.additionalInfo) setAdditionalInfo(intel.posterOverrides.additionalInfo);
        }
      } catch (e) {
        console.log('Error loading wanted poster data:', e);
      }
    };
    loadData();
  }, [id]);

  const savePosterOverrides = async () => {
    if (!id || !caseIntel) return;
    const updated = {
      ...caseIntel,
      posterOverrides: {
        description: description || undefined,
        lastSeen: lastSeen || undefined,
        additionalInfo: additionalInfo || undefined,
      },
    };
    await saveCaseIntel(updated);
    setCaseIntel(updated);
  };

  // Get parsed data from the latest report (AI-analyzed documents)
  const parsedData = reports?.[0]?.parsedData;
  const subject = parsedData?.subject;

  // Auto-fill description from parsed subject data if not manually set
  useEffect(() => {
    if (description || !subject) return;
    const parts: string[] = [];
    if (subject.race) parts.push(subject.race);
    if (subject.sex) parts.push(subject.sex);
    if (subject.height) parts.push(subject.height);
    if (subject.weight) parts.push(subject.weight);
    if (subject.hairColor) parts.push(`${subject.hairColor} hair`);
    if (subject.eyeColor) parts.push(`${subject.eyeColor} eyes`);
    if (subject.tattoos?.length) parts.push(`Tattoos: ${subject.tattoos.join(', ')}`);
    if (subject.scars?.length) parts.push(`Scars: ${subject.scars.join(', ')}`);
    if (parts.length > 0) setDescription(parts.join(', '));
  }, [subject, description]);

  const getSubjectName = () => {
    if (!caseData) return 'UNKNOWN';
    return caseData.name?.toUpperCase() || 'UNKNOWN';
  };

  const getAliases = (): string[] => {
    if (caseData?.primaryTarget?.aliases?.length) return caseData.primaryTarget.aliases;
    if (subject?.aliases?.length) return subject.aliases;
    return [];
  };

  const getCharges = (): string[] => {
    // From case data (roster import)
    if (caseData?.charges && caseData.charges.length > 0) return caseData.charges;
    if (caseData?.rosterData?.charges) {
      const rosterCharges = caseData.rosterData.charges
        .map((c: any) => c.description || c.charge || c.offense || '')
        .filter(Boolean);
      if (rosterCharges.length > 0) return rosterCharges;
    }
    // From parsed report data (AI analysis)
    if (parsedData?.charges?.length) {
      return parsedData.charges.map((c: any) =>
        typeof c === 'string' ? c : (c.description || c.charge || c.offense || '')
      ).filter(Boolean);
    }
    return [];
  };

  const getBondAmount = (): string => {
    const amount = caseData?.bondAmount || parsedData?.bondAmount || subject?.bondAmount;
    if (!amount) return '';
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.]/g, '')) : amount;
    if (isNaN(num) || num === 0) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(num);
  };

  const getDob = (): string => {
    return caseData?.primaryTarget?.dob || caseData?.rosterData?.inmate?.dob || subject?.dob || '';
  };

  const getDemographics = (): { race?: string; sex?: string; height?: string; weight?: string } => {
    const inmate = caseData?.rosterData?.inmate;
    return {
      race: subject?.race || inmate?.race,
      sex: subject?.sex || inmate?.sex,
      height: subject?.height || inmate?.height,
      weight: subject?.weight || inmate?.weight,
    };
  };

  const getPhotoSrc = (): string => {
    if (subjectPhoto) return subjectPhoto;
    if (caseData?.mugshotUrl) return caseData.mugshotUrl;
    return '';
  };

  const generatePosterHtml = (): string => {
    const name = getSubjectName();
    const aliases = getAliases();
    const charges = getCharges();
    const bond = getBondAmount();
    const dob = getDob();
    const demographics = getDemographics();
    const photoSrc = getPhotoSrc();

    const chargesHtml = charges.length > 0
      ? charges.map(c => `<div style="padding:4px 0;border-bottom:1px solid #1a1a1a;font-size:14px;">${c}</div>`).join('')
      : '';

    const detailParts: string[] = [];
    if (dob) detailParts.push(`DOB: ${dob}`);
    if (demographics.race) detailParts.push(`Race: ${demographics.race}`);
    if (demographics.sex) detailParts.push(`Sex: ${demographics.sex}`);
    if (demographics.height) detailParts.push(`Height: ${demographics.height}`);
    if (demographics.weight) detailParts.push(`Weight: ${demographics.weight}`);
    const detailLine = detailParts.join('  |  ');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @page { margin: 0; size: letter; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
    background: #0a0a0a;
    color: #e5e5e5;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .poster {
    max-width: 700px;
    margin: 0 auto;
    padding: 40px 32px;
    background: #0a0a0a;
    min-height: 100vh;
    text-align: center;
  }
  .wanted-title {
    font-size: 64px;
    font-weight: 900;
    color: #dc2626;
    letter-spacing: 12px;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .wanted-subtitle {
    font-size: 16px;
    color: #a3a3a3;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 28px;
  }
  .photo-frame {
    display: inline-block;
    border: 4px solid #dc2626;
    padding: 4px;
    background: #171717;
    margin-bottom: 24px;
  }
  .photo-frame img {
    display: block;
    width: 300px;
    height: 360px;
    object-fit: cover;
  }
  .no-photo {
    width: 300px;
    height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #171717;
    color: #525252;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .subject-name {
    font-size: 36px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 3px;
    margin-bottom: 4px;
  }
  .aliases {
    font-size: 14px;
    color: #a3a3a3;
    margin-bottom: 20px;
    font-style: italic;
  }
  .section {
    text-align: left;
    margin: 16px 0;
    padding: 0 20px;
  }
  .section-label {
    font-size: 12px;
    font-weight: 700;
    color: #dc2626;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .section-text {
    font-size: 14px;
    color: #d4d4d4;
    line-height: 1.5;
  }
  .charges-list {
    text-align: left;
    padding: 0 20px;
    margin: 16px 0;
  }
  .bond-line {
    font-size: 18px;
    font-weight: 700;
    color: #fbbf24;
    margin: 8px 0 4px;
    text-align: left;
    padding: 0 20px;
  }
  .detail-line {
    font-size: 13px;
    color: #a3a3a3;
    text-align: left;
    padding: 0 20px;
    margin-bottom: 16px;
  }
  .contact-block {
    margin-top: 24px;
    padding: 16px 20px;
    border-top: 2px solid #dc2626;
    border-bottom: 2px solid #dc2626;
  }
  .contact-label {
    font-size: 13px;
    color: #a3a3a3;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .contact-phone {
    font-size: 32px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 4px;
  }
  .footer {
    margin-top: 20px;
    font-size: 12px;
    color: #525252;
  }
  .footer .company {
    font-size: 14px;
    color: #a3a3a3;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .footer .warning {
    color: #dc2626;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 1px;
  }
  @media print {
    body { background: #0a0a0a; }
    .poster { padding: 30px 24px; }
  }
</style>
</head>
<body>
<div class="poster">
  <div class="wanted-title">WANTED</div>
  <div class="wanted-subtitle">Failure to Appear &mdash; Bail Forfeiture</div>

  <div class="photo-frame">
    ${photoSrc
      ? `<img src="${photoSrc}" alt="Subject Photo" />`
      : `<div class="no-photo">No Photo Available</div>`}
  </div>

  <div class="subject-name">${name}</div>
  ${aliases.length > 0
    ? `<div class="aliases">AKA: ${aliases.join(', ')}</div>`
    : ''}

  ${chargesHtml ? `
  <div class="charges-list">
    <div class="section-label">Charges</div>
    ${chargesHtml}
  </div>` : ''}

  ${bond ? `<div class="bond-line">Bond: ${bond}</div>` : ''}
  ${detailLine ? `<div class="detail-line">${detailLine}</div>` : ''}

  ${description ? `
  <div class="section">
    <div class="section-label">Description</div>
    <div class="section-text">${description}</div>
  </div>` : ''}

  ${lastSeen ? `
  <div class="section">
    <div class="section-label">Last Seen</div>
    <div class="section-text">${lastSeen}</div>
  </div>` : ''}

  ${additionalInfo ? `
  <div class="section">
    <div class="section-label">Additional Information</div>
    <div class="section-text">${additionalInfo}</div>
  </div>` : ''}

  <div class="contact-block">
    <div class="contact-label">If You Have Information Contact</div>
    <div class="contact-phone">985-264-9519</div>
  </div>

  <div class="footer">
    <div class="company">Elite Recovery of Louisiana</div>
    <div class="warning">DO NOT ATTEMPT TO APPREHEND</div>
  </div>
</div>
</body>
</html>`;
  };

  const handleGenerate = async () => {
    if (!caseData) {
      Alert.alert('Error', 'No case data available.');
      return;
    }

    setIsGenerating(true);

    try {
      // Save overrides first
      await savePosterOverrides();

      const html = generatePosterHtml();

      if (isWeb) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        } else {
          Alert.alert('Error', 'Please allow popups to generate the poster.');
        }
      } else {
        const Print = await import('expo-print');
        const Sharing = await import('expo-sharing');

        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Wanted Poster - ${caseData.name}`,
          });
        } else {
          Alert.alert('Success', 'Wanted poster PDF generated.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to generate poster. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="warning-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Case Data</Text>
        <Text style={styles.emptyText}>Open a case to generate a wanted poster.</Text>
      </View>
    );
  }

  const charges = getCharges();
  const bond = getBondAmount();
  const photoSrc = getPhotoSrc();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Preview card */}
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>WANTED</Text>
        <Text style={styles.previewSubtitle}>Failure to Appear</Text>

        {photoSrc ? (
          <View style={styles.photoFrame}>
            <View style={styles.photoInner}>
              {isWeb ? (
                <img
                  src={photoSrc}
                  style={{ width: 160, height: 192, objectFit: 'cover' } as any}
                  alt="Subject"
                />
              ) : (
                (() => {
                  const { Image } = require('react-native');
                  return <Image source={{ uri: photoSrc }} style={{ width: 160, height: 192 }} resizeMode="cover" />;
                })()
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.photoFrame, styles.noPhoto]}>
            <Text style={styles.noPhotoText}>No Photo</Text>
          </View>
        )}

        <Text style={styles.previewName}>{getSubjectName()}</Text>
        {getAliases().length > 0 && (
          <Text style={styles.previewAliases}>AKA: {getAliases().join(', ')}</Text>
        )}
        {charges.length > 0 && (
          <Text style={styles.previewCharges}>{charges.length} charge{charges.length !== 1 ? 's' : ''}</Text>
        )}
        {bond ? <Text style={styles.previewBond}>Bond: {bond}</Text> : null}
      </View>

      {/* Editable fields */}
      <Text style={styles.sectionTitle}>Poster Details</Text>
      <Text style={styles.sectionHint}>These fields can also be set by the AI in chat</Text>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Physical Description</Text>
        <TextInput
          style={styles.fieldInput}
          value={description}
          onChangeText={setDescription}
          onBlur={savePosterOverrides}
          placeholder="Height, weight, hair, eyes, tattoos, scars..."
          placeholderTextColor="#525252"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Last Seen</Text>
        <TextInput
          style={styles.fieldInput}
          value={lastSeen}
          onChangeText={setLastSeen}
          onBlur={savePosterOverrides}
          placeholder="Last known location, date, circumstances..."
          placeholderTextColor="#525252"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Additional Information</Text>
        <TextInput
          style={styles.fieldInput}
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          onBlur={savePosterOverrides}
          placeholder="Known hangouts, vehicle, associates to watch..."
          placeholderTextColor="#525252"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Generate button */}
      <TouchableOpacity
        onPress={handleGenerate}
        disabled={isGenerating}
        style={[styles.generateBtn, isGenerating && { opacity: 0.5 }]}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="print" size={20} color="#fff" />
        )}
        <Text style={styles.generateBtnText}>
          {isGenerating ? 'Generating...' : 'Generate Poster'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        Contact number: 985-264-9519 (hardcoded on poster)
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
    paddingBottom: 60,
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
  previewCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#dc2626',
    letterSpacing: 8,
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  photoFrame: {
    borderWidth: 3,
    borderColor: '#dc2626',
    padding: 3,
    backgroundColor: '#171717',
    marginBottom: 16,
  },
  photoInner: {
    width: 160,
    height: 192,
    overflow: 'hidden',
  },
  noPhoto: {
    width: 166,
    height: 198,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    color: '#525252',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  previewAliases: {
    fontSize: 12,
    color: '#a3a3a3',
    fontStyle: 'italic',
    marginTop: 2,
  },
  previewCharges: {
    fontSize: 12,
    color: '#d4d4d4',
    marginTop: 8,
  },
  previewBond: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  fieldCard: {
    backgroundColor: '#1c2128',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldInput: {
    color: '#e5e5e5',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 10,
    marginTop: 8,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});
