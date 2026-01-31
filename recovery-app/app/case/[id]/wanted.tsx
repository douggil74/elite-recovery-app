import { useState, useEffect, useCallback, useRef } from 'react';
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
  Image,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCase } from '@/hooks/useCase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCaseIntel, saveCaseIntel, type CaseIntel } from '@/lib/case-intel';

const isWeb = Platform.OS === 'web';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function WantedPosterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { caseData, reports, isLoading, refresh } = useCase(id!);
  const [refreshing, setRefreshing] = useState(false);
  const [subjectPhoto, setSubjectPhoto] = useState<string | null>(null);
  const [caseIntel, setCaseIntel] = useState<CaseIntel | null>(null);
  const [description, setDescription] = useState('');
  const [chargesOverride, setChargesOverride] = useState('');
  const [lastSeen, setLastSeen] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('Presumed dangerous. Do not approach.');
  const [contactName, setContactName] = useState('Dusty');
  const [contactPhone, setContactPhone] = useState('504-214-0220');
  const [isGenerating, setIsGenerating] = useState(false);

  // Layout controls (editable)
  const [fontScale, setFontScale] = useState(85); // 70-100%
  const [photoSize, setPhotoSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Poster photos (up to 3)
  const [posterPhotos, setPosterPhotos] = useState<string[]>([]);
  const posterPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const posterPhotoSlotRef = useRef<number>(0);

  // Refresh data every time this screen gets focus
  useFocusEffect(
    useCallback(() => {
      refresh();
      if (id) {
        loadCaseIntel(id).then(setCaseIntel);
        AsyncStorage.getItem(`case_photo_${id}`).then(photo => {
          if (photo) setSubjectPhoto(photo);
        });
        AsyncStorage.getItem(`case_poster_photos_${id}`).then(stored => {
          if (stored) {
            try { setPosterPhotos(JSON.parse(stored)); } catch {}
          }
        });
      }
    }, [refresh, id])
  );

  // Load poster overrides from intel
  useEffect(() => {
    if (!caseIntel?.posterOverrides) return;
    if (caseIntel.posterOverrides.description) setDescription(caseIntel.posterOverrides.description);
    if (caseIntel.posterOverrides.charges) setChargesOverride(caseIntel.posterOverrides.charges);
    if (caseIntel.posterOverrides.lastSeen) setLastSeen(caseIntel.posterOverrides.lastSeen);
    if (caseIntel.posterOverrides.additionalInfo) setAdditionalInfo(caseIntel.posterOverrides.additionalInfo);
    if (caseIntel.posterOverrides.contactName) setContactName(caseIntel.posterOverrides.contactName);
    if (caseIntel.posterOverrides.contactPhone) setContactPhone(caseIntel.posterOverrides.contactPhone);
  }, [caseIntel]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    if (id) setCaseIntel(await loadCaseIntel(id));
    setRefreshing(false);
  };

  const savePosterOverrides = async () => {
    if (!id) return;
    const base = caseIntel || { caseId: id } as CaseIntel;
    const updated = {
      ...base,
      posterOverrides: {
        description: description || undefined,
        charges: chargesOverride || undefined,
        lastSeen: lastSeen || undefined,
        additionalInfo: additionalInfo || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
      },
    };
    try {
      await saveCaseIntel(updated);
      setCaseIntel(updated);
    } catch (e) {
      console.log('Failed to save poster overrides:', e);
    }
  };

  // --- Poster Photo Handlers ---

  const handleAddPosterPhoto = async (slot: number) => {
    if (isWeb) {
      posterPhotoSlotRef.current = slot;
      posterPhotoInputRef.current?.click();
    } else {
      try {
        const ImagePicker = await import('expo-image-picker');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const uri = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;
          const newPhotos = [...posterPhotos];
          newPhotos[slot] = uri;
          setPosterPhotos(newPhotos);
          AsyncStorage.setItem(`case_poster_photos_${id}`, JSON.stringify(newPhotos)).catch(() => {});
        }
      } catch {}
    }
  };

  const handlePosterPhotoWeb = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl) {
        const newPhotos = [...posterPhotos];
        newPhotos[posterPhotoSlotRef.current] = dataUrl;
        setPosterPhotos(newPhotos);
        AsyncStorage.setItem(`case_poster_photos_${id}`, JSON.stringify(newPhotos)).catch(() => {});
      }
    };
    reader.readAsDataURL(file);
    if (posterPhotoInputRef.current) posterPhotoInputRef.current.value = '';
  };

  const handleRemovePosterPhoto = (slot: number) => {
    const newPhotos = posterPhotos.filter((_, i) => i !== slot);
    setPosterPhotos(newPhotos);
    AsyncStorage.setItem(`case_poster_photos_${id}`, JSON.stringify(newPhotos)).catch(() => {});
  };

  // Get parsed data from latest report
  const latestReport = reports?.[0];
  const parsedData = latestReport?.parsedData;
  const subject = parsedData?.subject || {} as any;

  // Auto-fill description from parsed subject data
  useEffect(() => {
    if (description || !subject?.fullName) return;
    const parts: string[] = [];
    if (subject.race) parts.push(subject.race);
    if (subject.sex) parts.push(subject.sex);
    if (subject.height) parts.push(subject.height);
    if (subject.weight) parts.push(subject.weight);
    if (subject.hairColor) parts.push(`${subject.hairColor} hair`);
    if (subject.eyeColor) parts.push(`${subject.eyeColor} eyes`);
    if (subject.tattoos?.length) parts.push(`Tattoos: ${Array.isArray(subject.tattoos) ? subject.tattoos.join(', ') : subject.tattoos}`);
    if (subject.scars?.length) parts.push(`Scars: ${Array.isArray(subject.scars) ? subject.scars.join(', ') : subject.scars}`);
    if (parts.length > 0) setDescription(parts.join(', '));
  }, [subject, description]);

  // --- Data accessors ---

  const getSubjectName = () => {
    return caseData?.name?.toUpperCase()
      || caseData?.primaryTarget?.fullName?.toUpperCase()
      || subject?.fullName?.toUpperCase()
      || 'UNKNOWN';
  };

  const getAliases = (): string[] => {
    if (caseData?.primaryTarget?.aliases?.length) return caseData.primaryTarget.aliases;
    if (subject?.aliases?.length) return subject.aliases;
    return [];
  };

  const getCharges = (): string[] => {
    if (caseData?.charges && caseData.charges.length > 0) return caseData.charges;
    if (caseData?.rosterData?.charges) {
      const rosterCharges = caseData.rosterData.charges
        .map((c: any) => c.description || c.charge || c.offense || '')
        .filter(Boolean);
      if (rosterCharges.length > 0) return rosterCharges;
    }
    // Check AI-extracted bond info charges
    const bondCharges = parsedData?.aiAnalysis?.bondInfo?.charges;
    if (Array.isArray(bondCharges) && bondCharges.length > 0) {
      const extracted = bondCharges
        .map((c: any) => c.charge || c.description || '')
        .filter(Boolean);
      if (extracted.length > 0) return extracted;
    }
    const recs = parsedData?.recommendations || [];
    const chargeRecs = recs.filter((r: string) => r.startsWith('Charge:'));
    if (chargeRecs.length > 0) return chargeRecs.map((r: string) => r.replace('Charge: ', ''));
    return [];
  };

  // Auto-fill charges from case data if not already set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (chargesOverride) return;
    const detected = getCharges();
    if (detected.length > 0) setChargesOverride(detected.join('; '));
  }, [caseData, parsedData, chargesOverride]);

  const getBondAmount = (): string => {
    const recs = parsedData?.recommendations || [];
    const bondRec = recs.find((r: string) => r.includes('Total Bond'));
    if (bondRec) {
      const match = bondRec.match(/\$[\d,]+/);
      if (match) return match[0];
    }
    const amount = caseData?.bondAmount;
    if (!amount || amount === 0) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
  };

  const getDob = (): string => {
    return caseData?.rosterData?.inmate?.dob || caseData?.primaryTarget?.dob || subject?.dob || '';
  };

  const getAge = (): string => {
    const dob = getDob();
    if (!dob) return '';
    try {
      const parts = dob.split('/');
      let birthDate: Date;
      if (parts.length === 3) {
        birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else {
        birthDate = new Date(dob);
      }
      if (isNaN(birthDate.getTime())) return '';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 && age < 120 ? String(age) : '';
    } catch {
      return '';
    }
  };

  const getDemographics = () => {
    const inmate = caseData?.rosterData?.inmate;
    const pt = caseData?.primaryTarget;
    return {
      race: subject?.race || pt?.race || inmate?.race,
      sex: subject?.sex || pt?.sex || inmate?.sex,
      height: subject?.height || pt?.height || inmate?.height,
      weight: subject?.weight || pt?.weight || inmate?.weight,
      hairColor: subject?.hairColor || pt?.hairColor || inmate?.hair,
      eyeColor: subject?.eyeColor || pt?.eyeColor || inmate?.eyes,
    };
  };

  const getPhotoSrc = (): string => {
    if (subjectPhoto) return subjectPhoto;
    if (caseData?.mugshotUrl) return caseData.mugshotUrl;
    return '';
  };

  // Collect all available photos for the poster (subject photo + poster photos)
  const getAllPosterPhotos = (): string[] => {
    const photos: string[] = [];
    const main = getPhotoSrc();
    if (main) photos.push(main);
    posterPhotos.forEach(p => { if (p) photos.push(p); });
    return photos.slice(0, 3); // Max 3
  };

  const generatePosterHtml = (): string => {
    const name = escapeHtml(getSubjectName());
    const aliases = getAliases().map(escapeHtml);
    const demographics = getDemographics();
    const age = getAge();
    const allPhotos = getAllPosterPhotos();

    // Always show charges — use the editable override
    const chargesText = escapeHtml(chargesOverride || getCharges().join('; ') || 'Charges pending');

    // Build details lines
    const detailLines: string[] = [];
    if (age) detailLines.push(`Age: ${escapeHtml(age)}`);
    if (demographics.height) detailLines.push(`Height: ${escapeHtml(demographics.height)}`);
    if (demographics.weight) detailLines.push(`Weight: ${escapeHtml(demographics.weight.includes('lb') ? demographics.weight : demographics.weight + ' lbs')}`);
    if (demographics.race) detailLines.push(`Race: ${escapeHtml(demographics.race)}`);
    if (demographics.sex) detailLines.push(`Sex: ${escapeHtml(demographics.sex)}`);
    if (demographics.hairColor) detailLines.push(`Hair: ${escapeHtml(demographics.hairColor)}`);
    if (demographics.eyeColor) detailLines.push(`Eyes: ${escapeHtml(demographics.eyeColor)}`);

    // Build photos HTML (up to 3 in a row)
    const photosHtml = allPhotos.length > 0
      ? `<div class="photos-row">${allPhotos.map(src =>
          `<img src="${escapeHtml(src)}" alt="Subject Photo" />`
        ).join('')}</div>`
      : '';

    const escapedLastSeen = lastSeen ? escapeHtml(lastSeen) : '';
    const escapedAdditionalInfo = additionalInfo ? escapeHtml(additionalInfo) : '';
    const escapedContactName = escapeHtml(contactName || 'Dusty');
    const escapedContactPhone = escapeHtml(contactPhone || '504-214-0220');

    // Calculate font sizes based on content length and user scale
    const scale = fontScale / 100;
    const descLen = description?.length || 0;
    const chargesLen = chargesText.length;
    const infoLen = escapedAdditionalInfo.length;

    const baseDescFont = descLen > 200 ? 14 : descLen > 100 ? 16 : 18;
    const baseChargesFont = chargesLen > 200 ? 14 : chargesLen > 100 ? 16 : 18;
    const baseInfoFont = infoLen > 150 ? 14 : infoLen > 80 ? 15 : 16;

    const descFontSize = Math.round(baseDescFont * scale);
    const chargesFontSize = Math.round(baseChargesFont * scale);
    const infoFontSize = Math.round(baseInfoFont * scale);

    // Scaled base fonts
    const titleSize = Math.round(64 * scale);
    const nameSize = Math.round(28 * scale);
    const aliasSize = Math.round(12 * scale);
    const rewardSize = Math.round(14 * scale);
    const detailsSize = Math.round(14 * scale);
    const contactSize = Math.round(18 * scale);

    // Photo size based on setting
    const photoWidthMap = { small: 120, medium: 150, large: 180 };
    const photoWidth = photoWidthMap[photoSize];
    const photoHeight = Math.round(photoWidth * 1.3);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wanted Poster - ${name}</title>
<style>
  @page { margin: 0.4in; size: letter; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    background: #ffffff;
    color: #000000;
    max-width: 8.5in;
    margin: 0 auto;
    padding: 24px 32px;
  }
  .toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #1a1a1a;
    padding: 12px 20px;
    display: flex;
    gap: 12px;
    justify-content: center;
    z-index: 1000;
  }
  .toolbar button {
    background: #dc2626;
    color: white;
    border: none;
    padding: 10px 24px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
  }
  .toolbar button:hover { background: #b91c1c; }
  .toolbar button.secondary {
    background: #333;
  }
  .toolbar button.secondary:hover { background: #444; }
  .poster-content {
    margin-top: 60px;
  }
  .wanted-title {
    text-align: center;
    font-size: ${titleSize}px;
    font-weight: 900;
    letter-spacing: ${Math.round(12 * scale)}px;
    text-transform: uppercase;
    margin-bottom: 2px;
    line-height: 1;
  }
  .subject-name {
    text-align: center;
    font-size: ${nameSize}px;
    font-weight: 700;
    margin-bottom: 2px;
    text-transform: uppercase;
  }
  .aliases {
    text-align: center;
    font-size: ${aliasSize}px;
    color: #333;
    margin-bottom: 2px;
    font-style: italic;
  }
  .reward-line {
    text-align: center;
    font-style: italic;
    font-size: ${rewardSize}px;
    margin-bottom: ${Math.round(12 * scale)}px;
  }
  .last-seen {
    font-size: ${detailsSize}px;
    margin-bottom: ${Math.round(10 * scale)}px;
    line-height: 1.4;
  }
  .last-seen em { font-style: italic; }
  .details-list {
    font-size: ${detailsSize}px;
    line-height: 1.6;
    margin-bottom: ${Math.round(10 * scale)}px;
  }
  .description-section {
    font-size: ${descFontSize}px;
    line-height: 1.4;
    margin-bottom: 10px;
  }
  .charges-section {
    font-size: ${chargesFontSize}px;
    line-height: 1.4;
    margin-bottom: 10px;
    font-weight: 600;
  }
  .additional-info {
    font-size: ${infoFontSize}px;
    line-height: 1.4;
    margin-bottom: 14px;
  }
  .photos-row {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .photos-row img {
    width: ${photoWidth}px;
    height: ${photoHeight}px;
    object-fit: cover;
    border: 1px solid #999;
  }
  .contact-line {
    text-align: center;
    font-size: ${contactSize}px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .reward-note {
    text-align: center;
    font-size: ${Math.round(12 * scale)}px;
    color: #333;
  }
  @media print {
    .toolbar { display: none !important; }
    .poster-content { margin-top: 0; }
    body { padding: 0.3in; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Save as PDF / Print</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
  <div class="poster-content">
    <div class="wanted-title">WANTED</div>
    <div class="subject-name">${name}</div>
    ${aliases.length > 0 ? `<div class="aliases">AKA: ${aliases.join(', ')}</div>` : ''}
    <div class="reward-line">*Reward for Capture</div>

    ${escapedLastSeen ? `<div class="last-seen">Last seen: <em>${escapedLastSeen}</em></div>` : ''}

    ${detailLines.length > 0 ? `<div class="details-list">${detailLines.join('<br>')}</div>` : ''}

    ${description ? `<div class="description-section">Description: ${escapeHtml(description)}</div>` : ''}

    <div class="charges-section">Charges: ${chargesText}</div>

    ${escapedAdditionalInfo ? `<div class="additional-info">Additional Information: ${escapedAdditionalInfo}</div>` : ''}

    ${photosHtml}

    <div class="contact-line">Call or Text ${escapedContactName} @ ${escapedContactPhone}</div>
    <div class="reward-note">* Reward based on information provided</div>
  </div>
</body>
</html>`;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      await savePosterOverrides();
      const html = generatePosterHtml();

      if (isWeb) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          // User clicks "Save as PDF / Print" button in the toolbar
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
            dialogTitle: `Wanted Poster - ${getSubjectName()}`,
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

  if (isLoading && !latestReport && !caseData) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading case data...</Text>
      </View>
    );
  }

  const photoSrc = getPhotoSrc();
  const allPhotos = getAllPosterPhotos();
  const demographics = getDemographics();
  const age = getAge();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#dc2626"
        />
      }
    >
      {/* Hidden file input for web poster photo uploads */}
      {isWeb && (
        <input
          ref={posterPhotoInputRef as any}
          type="file"
          accept="image/*"
          onChange={handlePosterPhotoWeb}
          style={{ display: 'none' }}
        />
      )}

      {/* Preview card — white background to match printed poster */}
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>WANTED</Text>
        <Text style={styles.previewName}>{getSubjectName()}</Text>
        {getAliases().length > 0 && (
          <Text style={styles.previewAliases}>AKA: {getAliases().join(', ')}</Text>
        )}
        <Text style={styles.previewReward}>*Reward for Capture</Text>

        {/* Physical details */}
        <View style={styles.previewDetails}>
          {age ? <Text style={styles.previewDetailLine}>Age: {age}</Text> : null}
          {demographics.height ? <Text style={styles.previewDetailLine}>Height: {demographics.height}</Text> : null}
          {demographics.weight ? <Text style={styles.previewDetailLine}>Weight: {demographics.weight}</Text> : null}
        </View>

        {description ? (
          <Text style={styles.previewDescription} numberOfLines={3}>
            Description: {description}
          </Text>
        ) : null}

        <Text style={styles.previewCharges} numberOfLines={3}>
          Charges: {chargesOverride || 'Not set'}
        </Text>

        {/* Photo thumbnails */}
        {allPhotos.length > 0 && (
          <View style={styles.previewPhotosRow}>
            {allPhotos.map((src, idx) => (
              <Image key={idx} source={{ uri: src }} style={styles.previewPhotoThumb} resizeMode="cover" />
            ))}
          </View>
        )}

        <Text style={styles.previewContact}>Call or Text {contactName} @ {contactPhone}</Text>
      </View>

      {/* --- POSTER PHOTOS --- */}
      <Text style={styles.sectionTitle}>Poster Photos (up to 3)</Text>
      <Text style={styles.sectionHint}>Subject photo is automatically included. Add additional photos below.</Text>

      <View style={styles.photoSlotsRow}>
        {/* Slot 0: Subject photo (auto) */}
        <View style={styles.photoSlot}>
          {photoSrc ? (
            <Image source={{ uri: photoSrc }} style={styles.photoSlotImage} resizeMode="cover" />
          ) : (
            <View style={styles.photoSlotEmpty}>
              <Ionicons name="person" size={24} color="#525252" />
              <Text style={styles.photoSlotLabel}>Subject</Text>
            </View>
          )}
          <Text style={styles.photoSlotCaption}>Main</Text>
        </View>

        {/* Slots 1-2: Additional poster photos */}
        {[0, 1].map(slot => (
          <View key={slot} style={styles.photoSlot}>
            {posterPhotos[slot] ? (
              <TouchableOpacity onPress={() => handleRemovePosterPhoto(slot)} style={{ position: 'relative' }}>
                <Image source={{ uri: posterPhotos[slot] }} style={styles.photoSlotImage} resizeMode="cover" />
                <View style={styles.photoRemoveBadge}>
                  <Ionicons name="close" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoSlotEmpty} onPress={() => handleAddPosterPhoto(slot)}>
                <Ionicons name="add" size={28} color="#dc2626" />
                <Text style={styles.photoSlotLabel}>Add</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.photoSlotCaption}>Photo {slot + 2}</Text>
          </View>
        ))}
      </View>

      {/* --- LAYOUT CONTROLS --- */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Layout Settings</Text>
      <Text style={styles.sectionHint}>Adjust to fit on one page</Text>

      <View style={styles.layoutRow}>
        <View style={styles.layoutControl}>
          <Text style={styles.layoutLabel}>Font Scale: {fontScale}%</Text>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              style={styles.sliderBtn}
              onPress={() => setFontScale(Math.max(60, fontScale - 5))}
            >
              <Ionicons name="remove" size={18} color="#fff" />
            </TouchableOpacity>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${((fontScale - 60) / 40) * 100}%` }]} />
            </View>
            <TouchableOpacity
              style={styles.sliderBtn}
              onPress={() => setFontScale(Math.min(100, fontScale + 5))}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.layoutControl}>
          <Text style={styles.layoutLabel}>Photo Size</Text>
          <View style={styles.photoSizeRow}>
            {(['small', 'medium', 'large'] as const).map(size => (
              <TouchableOpacity
                key={size}
                style={[styles.photoSizeBtn, photoSize === size && styles.photoSizeBtnActive]}
                onPress={() => setPhotoSize(size)}
              >
                <Text style={[styles.photoSizeBtnText, photoSize === size && styles.photoSizeBtnTextActive]}>
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* --- EDITABLE FIELDS --- */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Poster Details</Text>
      <Text style={styles.sectionHint}>Edit fields below, then hit Preview</Text>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Physical Description</Text>
        <TextInput
          style={styles.fieldInput}
          value={description}
          onChangeText={setDescription}
          onBlur={savePosterOverrides}
          placeholder="Race, sex, height, weight, hair, eyes, tattoos..."
          placeholderTextColor="#525252"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Charges</Text>
        <TextInput
          style={styles.fieldInput}
          value={chargesOverride}
          onChangeText={setChargesOverride}
          onBlur={savePosterOverrides}
          placeholder="List all charges separated by semicolons..."
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
          placeholder="Last known location, date..."
          placeholderTextColor="#525252"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.fieldCard}>
        <Text style={styles.fieldLabel}>Additional Information</Text>
        <TextInput
          style={styles.fieldInput}
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          onBlur={savePosterOverrides}
          placeholder="Presumed dangerous. Do not approach."
          placeholderTextColor="#525252"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.fieldRow}>
        <View style={[styles.fieldCard, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Contact Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={contactName}
            onChangeText={setContactName}
            onBlur={savePosterOverrides}
            placeholder="Dusty"
            placeholderTextColor="#525252"
          />
        </View>
        <View style={[styles.fieldCard, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Contact Phone</Text>
          <TextInput
            style={styles.fieldInput}
            value={contactPhone}
            onChangeText={setContactPhone}
            onBlur={savePosterOverrides}
            placeholder="504-214-0220"
            placeholderTextColor="#525252"
            keyboardType="phone-pad"
          />
        </View>
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
          {isGenerating ? 'Opening...' : 'Preview & Save PDF'}
        </Text>
      </TouchableOpacity>
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
    paddingBottom: 60,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#a3a3a3',
    fontSize: 14,
    marginTop: 16,
  },

  // --- Preview card (white to match printed poster) ---
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 10,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  previewAliases: {
    fontSize: 13,
    color: '#333',
    fontStyle: 'italic',
    marginTop: 2,
  },
  previewReward: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#333',
    marginTop: 2,
    marginBottom: 12,
  },
  previewDetails: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  previewDetailLine: {
    fontSize: 14,
    color: '#000',
    marginBottom: 1,
  },
  previewDescription: {
    fontSize: 13,
    color: '#000',
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  previewCharges: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  previewPhotosRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  previewPhotoThumb: {
    width: 48,
    height: 62,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  previewContact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },

  // --- Photo slots ---
  photoSlotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoSlot: {
    flex: 1,
    alignItems: 'center',
  },
  photoSlotImage: {
    width: '100%',
    aspectRatio: 0.77,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  photoSlotEmpty: {
    width: '100%',
    aspectRatio: 0.77,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#27272a',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
  },
  photoSlotLabel: {
    fontSize: 11,
    color: '#525252',
    marginTop: 2,
  },
  photoSlotCaption: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 4,
  },
  photoRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Layout controls ---
  layoutRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  layoutControl: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  layoutLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 4,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#27272a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#dc2626',
    borderRadius: 3,
  },
  photoSizeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  photoSizeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#27272a',
    alignItems: 'center',
  },
  photoSizeBtnActive: {
    backgroundColor: '#dc2626',
  },
  photoSizeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
  },
  photoSizeBtnTextActive: {
    color: '#fff',
  },

  // --- Form fields ---
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#71717a',
    marginBottom: 12,
  },
  fieldCard: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
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
    minHeight: 36,
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
    marginTop: 16,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
