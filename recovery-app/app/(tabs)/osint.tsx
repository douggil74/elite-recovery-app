/**
 * OSINT Search Tab - Direct search links to OSINT resources
 * No backend required - generates URLs directly
 */
import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  analyzeSubject,
  formatSubjectAnalysisForChat,
  type SubjectAnalysis,
} from '@/lib/subject-analysis';
import {
  analyzePhotoLocation,
  formatGeoAnalysisForChat,
  enhanceWithBusinessLookups,
  type GeoAnalysisResult,
} from '@/lib/geo-analysis';

// Load Black Ops One font for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap';
  link.rel = 'stylesheet';
  if (!document.head.querySelector('link[href*="Black+Ops+One"]')) {
    document.head.appendChild(link);
  }
}

// Dark Red Theme
const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceLight: '#18181b',
  border: '#27272a',
  borderLight: '#3f3f46',
  primary: '#dc2626',
  primaryMuted: '#450a0a',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
};

// Name normalization - convert "LAST, First" to "First Last"
const normalizeName = (name: string): string => {
  if (!name) return '';
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      return `${parts[1]} ${parts[0]}`.trim();
    }
  }
  return name.trim();
};

// Generate search URLs
const generateSearchLinks = (query: string, type: string) => {
  const encoded = encodeURIComponent(query);
  const normalized = normalizeName(query);
  const encodedNorm = encodeURIComponent(normalized);
  const username = query.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

  const links: { category: string; items: { name: string; url: string; icon: string }[] }[] = [];

  if (type === 'name') {
    links.push({
      category: 'Social Media',
      items: [
        { name: 'Facebook', url: `https://www.facebook.com/search/people/?q=${encodedNorm}`, icon: 'logo-facebook' },
        { name: 'Instagram', url: `https://www.instagram.com/${username}`, icon: 'logo-instagram' },
        { name: 'TikTok', url: `https://www.tiktok.com/@${username}`, icon: 'logo-tiktok' },
        { name: 'Twitter/X', url: `https://twitter.com/search?q=${encodedNorm}&f=user`, icon: 'logo-twitter' },
        { name: 'LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${encodedNorm}`, icon: 'logo-linkedin' },
      ],
    });
    links.push({
      category: 'People Search',
      items: [
        { name: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/results?name=${encodedNorm}`, icon: 'search' },
        { name: 'FastPeopleSearch', url: `https://www.fastpeoplesearch.com/name/${encodedNorm.replace(/ /g, '-')}`, icon: 'search' },
        { name: 'Whitepages', url: `https://www.whitepages.com/name/${encodedNorm.replace(/ /g, '-')}`, icon: 'search' },
        { name: 'Spokeo', url: `https://www.spokeo.com/${encodedNorm.replace(/ /g, '-')}`, icon: 'search' },
        { name: 'That\'s Them', url: `https://thatsthem.com/name/${encodedNorm.replace(/ /g, '-')}`, icon: 'search' },
      ],
    });
    links.push({
      category: 'Court Records',
      items: [
        { name: 'CourtListener', url: `https://www.courtlistener.com/?q=${encodedNorm}`, icon: 'briefcase' },
        { name: 'PACER', url: `https://pacer.uscourts.gov/`, icon: 'briefcase' },
        { name: 'LA Courts', url: `https://www.lasc.org/`, icon: 'briefcase' },
      ],
    });
  } else if (type === 'email') {
    links.push({
      category: 'Email Lookup',
      items: [
        { name: 'Have I Been Pwned', url: `https://haveibeenpwned.com/account/${encoded}`, icon: 'shield' },
        { name: 'Hunter.io', url: `https://hunter.io/email-verifier/${encoded}`, icon: 'mail' },
        { name: 'EmailRep', url: `https://emailrep.io/${encoded}`, icon: 'mail' },
      ],
    });
    links.push({
      category: 'Social Search',
      items: [
        { name: 'Google', url: `https://www.google.com/search?q="${encoded}"`, icon: 'logo-google' },
        { name: 'Facebook', url: `https://www.facebook.com/search/people/?q=${encoded}`, icon: 'logo-facebook' },
        { name: 'LinkedIn', url: `https://www.linkedin.com/search/results/all/?keywords=${encoded}`, icon: 'logo-linkedin' },
      ],
    });
  } else if (type === 'phone') {
    const cleanPhone = query.replace(/\D/g, '');
    links.push({
      category: 'Phone Lookup',
      items: [
        { name: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/results?phoneno=${cleanPhone}`, icon: 'call' },
        { name: 'FastPeopleSearch', url: `https://www.fastpeoplesearch.com/${cleanPhone}`, icon: 'call' },
        { name: 'Whitepages', url: `https://www.whitepages.com/phone/${cleanPhone}`, icon: 'call' },
        { name: 'Spokeo', url: `https://www.spokeo.com/phone/${cleanPhone}`, icon: 'call' },
        { name: 'CallerID', url: `https://www.truecaller.com/search/us/${cleanPhone}`, icon: 'call' },
      ],
    });
    links.push({
      category: 'Social Search',
      items: [
        { name: 'Google', url: `https://www.google.com/search?q="${cleanPhone}"`, icon: 'logo-google' },
        { name: 'Facebook', url: `https://www.facebook.com/search/top/?q=${cleanPhone}`, icon: 'logo-facebook' },
      ],
    });
  } else if (type === 'username') {
    links.push({
      category: 'Username Search',
      items: [
        { name: 'WhatsMyName', url: `https://whatsmyname.app/?q=${encoded}`, icon: 'at' },
        { name: 'NameCheckr', url: `https://www.namecheckr.com/`, icon: 'at' },
        { name: 'KnowEm', url: `https://knowem.com/checkusernames.php?u=${encoded}`, icon: 'at' },
      ],
    });
    links.push({
      category: 'Social Media',
      items: [
        { name: 'Instagram', url: `https://www.instagram.com/${encoded}`, icon: 'logo-instagram' },
        { name: 'Twitter/X', url: `https://twitter.com/${encoded}`, icon: 'logo-twitter' },
        { name: 'TikTok', url: `https://www.tiktok.com/@${encoded}`, icon: 'logo-tiktok' },
        { name: 'Reddit', url: `https://www.reddit.com/user/${encoded}`, icon: 'logo-reddit' },
        { name: 'GitHub', url: `https://github.com/${encoded}`, icon: 'logo-github' },
      ],
    });
  } else if (type === 'address') {
    links.push({
      category: 'Property Records',
      items: [
        { name: 'Google Maps', url: `https://www.google.com/maps/search/${encoded}`, icon: 'map' },
        { name: 'Zillow', url: `https://www.zillow.com/homes/${encoded.replace(/ /g, '-')}_rb/`, icon: 'home' },
        { name: 'Redfin', url: `https://www.redfin.com/search?q=${encoded}`, icon: 'home' },
      ],
    });
  }

  return links;
};

// Backend API URL
const OSINT_API = 'https://elite-recovery-osint.fly.dev';

// Types for backend results
interface OSINTResult {
  type: 'email' | 'username' | 'name';
  query: string;
  accounts: { service: string; url?: string; status: string }[];
  totalFound: number;
  executionTime: number;
  errors: string[];
}

export default function OSINTScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'email' | 'phone' | 'username' | 'address'>('name');
  const [searchResults, setSearchResults] = useState<{ category: string; items: { name: string; url: string; icon: string }[] }[]>([]);

  // Backend OSINT results
  const [osintResult, setOsintResult] = useState<OSINTResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Photo Analysis State
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingGeo, setIsAnalyzingGeo] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SubjectAnalysis | null>(null);
  const [geoResult, setGeoResult] = useState<GeoAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [imageSearchUrls, setImageSearchUrls] = useState<{
    google_lens?: string;
    yandex?: string;
    bing?: string;
    tineye?: string;
  } | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedLocations, setEnhancedLocations] = useState<{
    businessLocations: { name: string; matches: { city: string; state: string; lat: number; lon: number }[] }[];
    narrowedRegion?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // Generate fallback links
    const links = generateSearchLinks(searchQuery.trim(), searchType);
    setSearchResults(links);

    // For email and username, also call backend APIs for actual results
    if (searchType === 'email' || searchType === 'username') {
      setIsSearching(true);
      setSearchError(null);
      setOsintResult(null);

      try {
        if (searchType === 'email') {
          // Use Holehe for email search
          const response = await fetch(`${OSINT_API}/api/holehe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: searchQuery.trim() }),
          });

          if (response.ok) {
            const data = await response.json();
            setOsintResult({
              type: 'email',
              query: searchQuery.trim(),
              accounts: (data.registered_on || []).map((item: any) => ({
                service: item.service,
                status: item.status,
                url: item.service.includes('.') ? `https://${item.service}` : undefined,
              })),
              totalFound: data.registered_on?.length || 0,
              executionTime: data.execution_time || 0,
              errors: [],
            });
          } else {
            setSearchError('Email search failed');
          }
        } else if (searchType === 'username') {
          // Use Sherlock for username search
          const response = await fetch(`${OSINT_API}/api/sherlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: searchQuery.trim(), timeout: 60 }),
          });

          if (response.ok) {
            const data = await response.json();
            setOsintResult({
              type: 'username',
              query: searchQuery.trim(),
              accounts: (data.found || []).map((item: any) => ({
                service: item.site || item.name,
                url: item.url,
                status: 'found',
              })),
              totalFound: data.found?.length || 0,
              executionTime: data.execution_time || 0,
              errors: data.errors || [],
            });
          } else {
            setSearchError('Username search failed');
          }
        }
      } catch (error: any) {
        setSearchError(error.message || 'Search failed');
      } finally {
        setIsSearching(false);
      }
    } else {
      // Clear backend results for other search types
      setOsintResult(null);
    }
  };

  const openUrl = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setAnalysisError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setUploadedPhoto(dataUrl);
        setAnalysisResult(null);
        setAnalysisError(null);
      }
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const runPhotoAnalysis = async () => {
    if (!uploadedPhoto) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Run analysis and upload image for reverse search in parallel
      const [result, uploadResult] = await Promise.all([
        analyzeSubject(uploadedPhoto),
        uploadImageForSearch(uploadedPhoto),
      ]);

      if (result) {
        setAnalysisResult(result);
      } else {
        setAnalysisError('Could not analyze photo. Try a clearer image.');
      }

      if (uploadResult?.search_urls) {
        setImageSearchUrls(uploadResult.search_urls);
      }
    } catch (error: any) {
      setAnalysisError(error?.message || 'Analysis failed');
    }

    setIsAnalyzing(false);
  };

  const uploadImageForSearch = async (imageBase64: string) => {
    try {
      const response = await fetch('https://elite-recovery-osint.fly.dev/api/image/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Image upload for search failed:', e);
    }
    return null;
  };

  const clearPhoto = () => {
    setUploadedPhoto(null);
    setAnalysisResult(null);
    setGeoResult(null);
    setAnalysisError(null);
    setImageSearchUrls(null);
    setEnhancedLocations(null);
  };

  // Geo analysis - predict photo location
  const runGeoAnalysis = async () => {
    if (!uploadedPhoto) return;

    setIsAnalyzingGeo(true);
    setAnalysisError(null);
    setGeoResult(null);
    setEnhancedLocations(null);

    try {
      const result = await analyzePhotoLocation(uploadedPhoto);
      // Always set result - even error states are returned as result objects now
      setGeoResult(result);

      // If it's an error result, also show the error
      if (result?.primaryLocation?.country === 'Analysis Failed') {
        setAnalysisError(result.summary);
      }
    } catch (error: any) {
      setAnalysisError(error?.message || 'Geo analysis failed');
    }

    setIsAnalyzingGeo(false);
  };

  // Enhanced OpenStreetMap lookup for businesses
  const runEnhancedLookup = async () => {
    if (!geoResult || geoResult.businessNames.length === 0) return;

    setIsEnhancing(true);
    try {
      const result = await enhanceWithBusinessLookups(geoResult);
      setEnhancedLocations(result);
    } catch (error: any) {
      console.error('Enhanced lookup failed:', error);
    }
    setIsEnhancing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Search Type Selection */}
        <View style={styles.typeSection}>
          {(['name', 'email', 'phone', 'username', 'address'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, searchType === type && styles.typeBtnActive]}
              onPress={() => {
                setSearchType(type);
                setSearchResults([]);
              }}
            >
              <Ionicons
                name={
                  type === 'name' ? 'person' :
                  type === 'email' ? 'mail' :
                  type === 'phone' ? 'call' :
                  type === 'username' ? 'at' : 'location'
                }
                size={16}
                color={searchType === type ? THEME.primary : THEME.textMuted}
              />
              <Text style={[styles.typeBtnText, searchType === type && styles.typeBtnTextActive]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={THEME.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              searchType === 'name' ? 'Enter full name (e.g., John Smith)' :
              searchType === 'email' ? 'Enter email address' :
              searchType === 'phone' ? 'Enter phone number' :
              searchType === 'username' ? 'Enter username' :
              'Enter address'
            }
            placeholderTextColor={THEME.textMuted}
            autoCapitalize={searchType === 'name' ? 'words' : 'none'}
            keyboardType={searchType === 'email' ? 'email-address' : searchType === 'phone' ? 'phone-pad' : 'default'}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.searchBtn, isSearching && styles.btnDisabled]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.searchBtnText}>
                {searchType === 'email' || searchType === 'username' ? 'Search Accounts' : 'Generate Search Links'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Backend OSINT Results */}
        {osintResult && (
          <View style={styles.osintResultsContainer}>
            <View style={styles.osintResultsHeader}>
              <Ionicons name="checkmark-circle" size={20} color={THEME.success} />
              <Text style={styles.osintResultsTitle}>
                {osintResult.totalFound} Account{osintResult.totalFound !== 1 ? 's' : ''} Found
              </Text>
              <Text style={styles.osintResultsTime}>
                {osintResult.executionTime.toFixed(1)}s
              </Text>
            </View>

            {osintResult.accounts.length > 0 ? (
              <View style={styles.accountsList}>
                {osintResult.accounts.slice(0, 20).map((account, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.accountItem}
                    onPress={() => account.url && openUrl(account.url)}
                    disabled={!account.url}
                  >
                    <Ionicons
                      name={account.url ? 'link' : 'checkmark'}
                      size={14}
                      color={account.url ? THEME.info : THEME.success}
                    />
                    <Text style={[styles.accountName, account.url && styles.accountNameClickable]}>
                      {account.service}
                    </Text>
                    {account.url && (
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
                {osintResult.accounts.length > 20 && (
                  <Text style={styles.moreAccounts}>
                    +{osintResult.accounts.length - 20} more accounts
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.noAccountsText}>No accounts found for this {osintResult.type}</Text>
            )}

            {osintResult.errors.length > 0 && (
              <Text style={styles.osintErrors}>
                {osintResult.errors.length} error(s) during search
              </Text>
            )}
          </View>
        )}

        {searchError && (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={16} color={THEME.danger} />
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {/* Photo Analysis Section */}
        <View style={styles.photoSection}>
          <Text style={styles.photoSectionTitle}>SUBJECT PHOTO ANALYSIS</Text>
          <Text style={styles.photoSectionDesc}>
            Upload a mugshot or photo to extract tattoos, scars, physical description, and GPS location
          </Text>

          {/* Hidden file input for web */}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef as any}
              type="file"
              accept="image/*"
              onChange={handleFileChange as any}
              style={{ display: 'none' }}
            />
          )}

          {!uploadedPhoto ? (
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePhotoUpload}>
              <Ionicons name="camera" size={24} color={THEME.primary} />
              <Text style={styles.uploadBtnText}>Upload Subject Photo</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: uploadedPhoto }} style={styles.photoPreview} />
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={[styles.analyzeBtn, isAnalyzing && styles.btnDisabled]}
                  onPress={runPhotoAnalysis}
                  disabled={isAnalyzing || isAnalyzingGeo}
                >
                  {isAnalyzing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="body" size={16} color="#fff" />
                      <Text style={styles.analyzeBtnText}>ID Analysis</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.geoBtn, isAnalyzingGeo && styles.btnDisabled]}
                  onPress={runGeoAnalysis}
                  disabled={isAnalyzing || isAnalyzingGeo}
                >
                  {isAnalyzingGeo ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="location" size={16} color="#fff" />
                      <Text style={styles.analyzeBtnText}>Geo Location</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearBtn} onPress={clearPhoto}>
                  <Ionicons name="close" size={18} color={THEME.danger} />
                </TouchableOpacity>
              </View>
              {(analysisResult || geoResult) && (
                <View style={styles.analysisTypeBadges}>
                  {analysisResult && <Text style={styles.analysisBadge}>ID</Text>}
                  {geoResult && <Text style={styles.geoBadge}>GEO</Text>}
                </View>
              )}
            </View>
          )}

          {analysisError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={16} color={THEME.danger} />
              <Text style={styles.errorText}>{analysisError}</Text>
            </View>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <View style={styles.analysisResults}>
              {/* GPS Location - Highest Priority */}
              {analysisResult.exifData?.gps && (
                <View style={styles.gpsAlert}>
                  <Ionicons name="location" size={20} color={THEME.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gpsTitle}>GPS LOCATION FOUND!</Text>
                    <Text style={styles.gpsCoords}>
                      {analysisResult.exifData.gps.latitude.toFixed(6)}, {analysisResult.exifData.gps.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() => openUrl(analysisResult.exifData!.gps!.googleMapsUrl!)}
                  >
                    <Ionicons name="map" size={16} color="#fff" />
                    <Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Timestamp */}
              {analysisResult.exifData?.dateTime?.original && (
                <View style={styles.timestampRow}>
                  <Ionicons name="calendar" size={16} color={THEME.warning} />
                  <Text style={styles.timestampText}>
                    Photo taken: {analysisResult.exifData.dateTime.original}
                  </Text>
                </View>
              )}

              {/* BOLO Description */}
              {analysisResult.boloDescription && (
                <View style={styles.boloSection}>
                  <Text style={styles.boloTitle}>BOLO DESCRIPTION</Text>
                  <Text style={styles.boloText}>{analysisResult.boloDescription}</Text>
                </View>
              )}

              {/* Key Identifiers */}
              {analysisResult.identificationPriority.length > 0 && (
                <View style={styles.identifiersSection}>
                  <Text style={styles.identifiersTitle}>KEY IDENTIFIERS</Text>
                  {analysisResult.identificationPriority.slice(0, 5).map((item, idx) => (
                    <View key={idx} style={styles.identifierRow}>
                      <Text style={styles.identifierNum}>{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.identifierFeature}>{item.feature}</Text>
                        <Text style={styles.identifierReason}>{item.reason}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Tattoos */}
              {analysisResult.tattoos.length > 0 && (
                <View style={styles.tattoosSection}>
                  <Text style={styles.tattoosTitle}>TATTOOS ({analysisResult.tattoos.length})</Text>
                  {analysisResult.tattoos.map((tattoo, idx) => (
                    <View key={idx} style={styles.tattooItem}>
                      <Text style={styles.tattooLocation}>{tattoo.location.toUpperCase()}</Text>
                      <Text style={styles.tattooDesc}>{tattoo.description}</Text>
                      {tattoo.text && <Text style={styles.tattooText}>Text: "{tattoo.text}"</Text>}
                      <Text style={styles.tattooMeta}>
                        {tattoo.style} · {tattoo.size} · {tattoo.colors.join(', ')}
                      </Text>
                      {tattoo.possibleMeaning && (
                        <Text style={styles.tattooMeaning}>Meaning: {tattoo.possibleMeaning}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Reverse Image Search Links - Use actual working URLs if available */}
              <View style={styles.reverseSearchSection}>
                <Text style={styles.reverseSearchTitle}>REVERSE IMAGE SEARCH</Text>
                {imageSearchUrls ? (
                  <>
                    <TouchableOpacity
                      style={styles.reverseSearchBtnActive}
                      onPress={() => openUrl(imageSearchUrls.yandex!)}
                    >
                      <View style={styles.reverseSearchReady}>
                        <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                        <Text style={styles.reverseSearchNameActive}>Yandex (Best for Faces)</Text>
                      </View>
                      <Ionicons name="open-outline" size={14} color={THEME.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reverseSearchBtnActive}
                      onPress={() => openUrl(imageSearchUrls.google_lens!)}
                    >
                      <View style={styles.reverseSearchReady}>
                        <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                        <Text style={styles.reverseSearchNameActive}>Google Lens</Text>
                      </View>
                      <Ionicons name="open-outline" size={14} color={THEME.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reverseSearchBtnActive}
                      onPress={() => openUrl(imageSearchUrls.tineye!)}
                    >
                      <View style={styles.reverseSearchReady}>
                        <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                        <Text style={styles.reverseSearchNameActive}>TinEye</Text>
                      </View>
                      <Ionicons name="open-outline" size={14} color={THEME.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reverseSearchBtnActive}
                      onPress={() => openUrl(imageSearchUrls.bing!)}
                    >
                      <View style={styles.reverseSearchReady}>
                        <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                        <Text style={styles.reverseSearchNameActive}>Bing Visual Search</Text>
                      </View>
                      <Ionicons name="open-outline" size={14} color={THEME.success} />
                    </TouchableOpacity>
                    <Text style={styles.searchUrlNote}>Image uploaded - links will auto-search</Text>
                  </>
                ) : (
                  <>
                    {analysisResult.reverseImageLinks.slice(0, 4).map((link, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.reverseSearchBtn}
                        onPress={() => openUrl(link.url)}
                      >
                        <Text style={styles.reverseSearchName}>{link.service}</Text>
                        <Ionicons name="open-outline" size={14} color={THEME.textMuted} />
                      </TouchableOpacity>
                    ))}
                    <Text style={styles.searchUrlNote}>Manual upload required</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Geo Analysis Results */}
          {geoResult && (
            <View style={styles.geoResults}>
              <Text style={styles.geoResultsTitle}>GEOLOCATION ANALYSIS</Text>

              {/* Primary Location */}
              <View style={styles.geoPrimaryLocation}>
                <Ionicons name="location" size={24} color={THEME.info} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.geoPrimaryText}>
                    {[geoResult.primaryLocation.city, geoResult.primaryLocation.region, geoResult.primaryLocation.country].filter(Boolean).join(', ')}
                  </Text>
                  {geoResult.primaryLocation.neighborhood && (
                    <Text style={styles.geoNeighborhood}>{geoResult.primaryLocation.neighborhood}</Text>
                  )}
                  <Text style={styles.geoConfidence}>
                    Confidence: {geoResult.primaryLocation.confidence.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.geoMapBtn}
                  onPress={() => openUrl(geoResult.mapSearchLinks.googleMaps)}
                >
                  <Ionicons name="map" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Summary */}
              {geoResult.summary && (
                <View style={styles.geoSummary}>
                  <Text style={styles.geoSummaryText}>{geoResult.summary}</Text>
                </View>
              )}

              {/* Visual Clues */}
              {geoResult.visualClues.length > 0 && (
                <View style={styles.geoCluesSection}>
                  <Text style={styles.geoCluesTitle}>Visual Evidence</Text>
                  {geoResult.visualClues.filter(c => c.confidence === 'strong').slice(0, 3).map((clue, idx) => (
                    <View key={idx} style={styles.geoClueItem}>
                      <Ionicons
                        name={clue.type === 'signage' ? 'text' : clue.type === 'architecture' ? 'business' : clue.type === 'vegetation' ? 'leaf' : 'eye'}
                        size={14}
                        color={THEME.info}
                      />
                      <Text style={styles.geoClueText}>{clue.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Area Codes Found */}
              {geoResult.areaCodesFound && geoResult.areaCodesFound.length > 0 && (
                <View style={styles.geoAreaCodesSection}>
                  <Text style={styles.geoAreaCodesTitle}>📞 AREA CODES DETECTED</Text>
                  {geoResult.areaCodesFound.map((ac, idx) => (
                    <View key={idx} style={styles.areaCodeItem}>
                      <Text style={styles.areaCodeNum}>{ac.code}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.areaCodeState}>{ac.state}</Text>
                        <Text style={styles.areaCodeCities}>{ac.cities.join(', ')}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Regional Chains Found */}
              {geoResult.regionalChains && geoResult.regionalChains.length > 0 && (
                <View style={styles.geoRegionalSection}>
                  <Text style={styles.geoRegionalTitle}>🏪 REGIONAL CHAINS IDENTIFIED</Text>
                  {geoResult.regionalChains.map((chain, idx) => (
                    <View key={idx} style={styles.regionalChainItem}>
                      <Text style={styles.regionalChainName}>{chain.name}</Text>
                      <Text style={styles.regionalChainRegion}>{chain.region}</Text>
                      <Text style={styles.regionalChainStates}>Found in: {chain.states.join(', ')}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Searchable Text */}
              {(geoResult.businessNames.length > 0 || geoResult.signText.length > 0) && (
                <View style={styles.geoSearchableSection}>
                  <Text style={styles.geoSearchableTitle}>Searchable Text Found</Text>
                  {geoResult.businessNames.length > 0 && (
                    <Text style={styles.geoSearchableText}>Businesses: {geoResult.businessNames.join(', ')}</Text>
                  )}
                  {geoResult.signText.length > 0 && (
                    <Text style={styles.geoSearchableText}>Signs: {geoResult.signText.join(', ')}</Text>
                  )}
                </View>
              )}

              {/* Business Search Links */}
              {geoResult.businessSearchLinks && geoResult.businessSearchLinks.length > 0 && (
                <View style={styles.geoBusinessLinksSection}>
                  <Text style={styles.geoBusinessLinksTitle}>🗺️ SEARCH BUSINESSES ON MAP</Text>
                  {geoResult.businessSearchLinks.slice(0, 4).map((link, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.businessLinkBtn}
                      onPress={() => openUrl(link.searchUrl)}
                    >
                      <Ionicons name="location" size={14} color={THEME.info} />
                      <Text style={styles.businessLinkText}>{link.business}</Text>
                      <Ionicons name="open-outline" size={14} color={THEME.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Enhanced OSM Lookup Button */}
              {geoResult.businessNames.length > 0 && !enhancedLocations && (
                <TouchableOpacity
                  style={[styles.enhanceBtn, isEnhancing && styles.btnDisabled]}
                  onPress={runEnhancedLookup}
                  disabled={isEnhancing}
                >
                  {isEnhancing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="globe" size={16} color="#fff" />
                      <Text style={styles.enhanceBtnText}>Deep Search (OpenStreetMap)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Enhanced Locations Results */}
              {enhancedLocations && (
                <View style={styles.enhancedSection}>
                  <Text style={styles.enhancedTitle}>🌐 OPENSTREETMAP RESULTS</Text>

                  {enhancedLocations.narrowedRegion && (
                    <View style={styles.narrowedRegionBox}>
                      <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                      <Text style={styles.narrowedRegionText}>
                        Multiple businesses found in: <Text style={styles.narrowedRegionHighlight}>{enhancedLocations.narrowedRegion}</Text>
                      </Text>
                    </View>
                  )}

                  {enhancedLocations.businessLocations.map((biz, idx) => (
                    <View key={idx} style={styles.osmBusinessItem}>
                      <Text style={styles.osmBusinessName}>{biz.name}</Text>
                      {biz.matches.slice(0, 3).map((match, midx) => (
                        <TouchableOpacity
                          key={midx}
                          style={styles.osmMatchItem}
                          onPress={() => openUrl(`https://www.google.com/maps/@${match.lat},${match.lon},17z`)}
                        >
                          <Ionicons name="navigate" size={12} color={THEME.info} />
                          <Text style={styles.osmMatchText}>
                            {match.city}{match.city && match.state ? ', ' : ''}{match.state}
                          </Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}

                  {enhancedLocations.businessLocations.length === 0 && (
                    <Text style={styles.noOsmResults}>No exact matches found in OpenStreetMap</Text>
                  )}
                </View>
              )}

              {/* Search Suggestions */}
              {geoResult.searchSuggestions.length > 0 && (
                <View style={styles.geoSuggestionsSection}>
                  <Text style={styles.geoSuggestionsTitle}>Search Suggestions</Text>
                  {geoResult.searchSuggestions.slice(0, 3).map((suggestion, idx) => (
                    <Text key={idx} style={styles.geoSuggestionText}>• {suggestion}</Text>
                  ))}
                </View>
              )}

              {/* Alternative Locations */}
              {geoResult.alternativeLocations.length > 0 && (
                <View style={styles.geoAltSection}>
                  <Text style={styles.geoAltTitle}>Alternatives</Text>
                  {geoResult.alternativeLocations.slice(0, 2).map((alt, idx) => (
                    <Text key={idx} style={styles.geoAltText}>
                      {[alt.city, alt.region].filter(Boolean).join(', ')} ({alt.confidence})
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Results */}
        {searchResults.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>
              Search "{searchType === 'name' ? normalizeName(searchQuery) : searchQuery}" on:
            </Text>

            {searchResults.map((category, catIdx) => (
              <View key={catIdx} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category.category}</Text>
                <View style={styles.linksGrid}>
                  {category.items.map((item, itemIdx) => (
                    <TouchableOpacity
                      key={itemIdx}
                      style={styles.linkBtn}
                      onPress={() => openUrl(item.url)}
                    >
                      <Ionicons name={item.icon as any} size={18} color={THEME.primary} />
                      <Text style={styles.linkBtnText}>{item.name}</Text>
                      <Ionicons name="open-outline" size={14} color={THEME.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        {searchResults.length === 0 && (
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>QUICK NAVIGATION</Text>

            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/risk')}>
              <Ionicons name="analytics" size={28} color={THEME.warning} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>FTA Risk Score</Text>
                <Text style={styles.quickActionDesc}>Calculate bond risk before posting</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)')}>
              <Ionicons name="briefcase" size={28} color={THEME.info} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Recovery Cases</Text>
                <Text style={styles.quickActionDesc}>Manage active investigations</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SEARCH TYPES</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoHeader}>👤 NAME</Text>
              <Text style={styles.infoText}>Social media, people search, court records</Text>

              <Text style={[styles.infoHeader, { marginTop: 12 }]}>📧 EMAIL</Text>
              <Text style={styles.infoText}>Breach check, email verification, social lookup</Text>

              <Text style={[styles.infoHeader, { marginTop: 12 }]}>📞 PHONE</Text>
              <Text style={styles.infoText}>Reverse lookup, carrier info, social search</Text>

              <Text style={[styles.infoHeader, { marginTop: 12 }]}>@ USERNAME</Text>
              <Text style={styles.infoText}>Cross-platform username search</Text>

              <Text style={[styles.infoHeader, { marginTop: 12 }]}>📍 ADDRESS</Text>
              <Text style={styles.infoText}>Property records, maps, ownership</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 40,
  },
  typeSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  typeBtnActive: {
    backgroundColor: THEME.primaryMuted,
    borderColor: THEME.primary,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  typeBtnTextActive: {
    color: THEME.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.text,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.primary,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  searchBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  linksGrid: {
    gap: 8,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 12,
  },
  linkBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: THEME.text,
  },
  quickActions: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 14,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  quickActionDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  infoHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  infoText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  // Photo Analysis Styles
  photoSection: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  photoSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  photoSectionDesc: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.primaryMuted,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.primary,
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.primary,
  },
  photoPreviewContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 150,
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  analyzeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  clearBtn: {
    padding: 10,
    backgroundColor: THEME.danger + '20',
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.danger + '20',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    color: THEME.danger,
    flex: 1,
  },
  analysisResults: {
    marginTop: 16,
  },
  gpsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.success + '20',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.success,
  },
  gpsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.success,
  },
  gpsCoords: {
    fontSize: 12,
    color: THEME.text,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mapBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timestampText: {
    fontSize: 13,
    color: THEME.warning,
  },
  boloSection: {
    backgroundColor: THEME.surfaceLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  boloTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 6,
    letterSpacing: 1,
  },
  boloText: {
    fontSize: 13,
    color: THEME.text,
    lineHeight: 20,
  },
  identifiersSection: {
    marginBottom: 12,
  },
  identifiersTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.warning,
    marginBottom: 8,
    letterSpacing: 1,
  },
  identifierRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  identifierNum: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
    width: 18,
    height: 18,
    textAlign: 'center',
    lineHeight: 18,
    backgroundColor: THEME.primaryMuted,
    borderRadius: 9,
  },
  identifierFeature: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
  },
  identifierReason: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  tattoosSection: {
    marginBottom: 12,
  },
  tattoosTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
    marginBottom: 8,
    letterSpacing: 1,
  },
  tattooItem: {
    backgroundColor: THEME.surfaceLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: THEME.purple,
  },
  tattooLocation: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
    marginBottom: 4,
  },
  tattooDesc: {
    fontSize: 13,
    color: THEME.text,
    marginBottom: 4,
  },
  tattooText: {
    fontSize: 12,
    color: THEME.warning,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  tattooMeta: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  tattooMeaning: {
    fontSize: 12,
    color: THEME.info,
    marginTop: 4,
  },
  reverseSearchSection: {
    marginTop: 4,
  },
  reverseSearchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    marginBottom: 8,
    letterSpacing: 1,
  },
  reverseSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceLight,
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  reverseSearchName: {
    fontSize: 13,
    color: THEME.text,
    fontWeight: '500',
  },
  reverseSearchBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.success + '15',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.success + '40',
  },
  reverseSearchReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reverseSearchNameActive: {
    fontSize: 13,
    color: THEME.success,
    fontWeight: '600',
  },
  searchUrlNote: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Geo Analysis Button
  geoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.info,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  analysisTypeBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  analysisBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.primary,
    backgroundColor: THEME.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  geoBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.info,
    backgroundColor: THEME.info + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // Geo Results
  geoResults: {
    marginTop: 16,
    padding: 12,
    backgroundColor: THEME.info + '10',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.info + '30',
  },
  geoResultsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.info,
    letterSpacing: 1,
    marginBottom: 12,
  },
  geoPrimaryLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  geoPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  geoNeighborhood: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  geoConfidence: {
    fontSize: 11,
    color: THEME.info,
    marginTop: 2,
  },
  geoMapBtn: {
    backgroundColor: THEME.info,
    padding: 8,
    borderRadius: 6,
  },
  geoSummary: {
    backgroundColor: THEME.surface,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  geoSummaryText: {
    fontSize: 13,
    color: THEME.text,
    lineHeight: 20,
  },
  geoCluesSection: {
    marginBottom: 12,
  },
  geoCluesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    marginBottom: 6,
  },
  geoClueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  geoClueText: {
    fontSize: 12,
    color: THEME.text,
    flex: 1,
  },
  geoSearchableSection: {
    backgroundColor: THEME.warning + '15',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  geoSearchableTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.warning,
    marginBottom: 4,
  },
  geoSearchableText: {
    fontSize: 12,
    color: THEME.text,
  },
  geoSuggestionsSection: {
    marginBottom: 12,
  },
  geoSuggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    marginBottom: 6,
  },
  geoSuggestionText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  geoAltSection: {
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    paddingTop: 10,
  },
  geoAltTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    marginBottom: 4,
  },
  geoAltText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  // Area Codes Section
  geoAreaCodesSection: {
    backgroundColor: THEME.success + '15',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.success + '30',
  },
  geoAreaCodesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.success,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  areaCodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  areaCodeNum: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.success,
    backgroundColor: THEME.success + '25',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  areaCodeState: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  areaCodeCities: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  // Regional Chains Section
  geoRegionalSection: {
    backgroundColor: THEME.purple + '15',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.purple + '30',
  },
  geoRegionalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  regionalChainItem: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: THEME.purple,
  },
  regionalChainName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  regionalChainRegion: {
    fontSize: 12,
    color: THEME.purple,
    fontWeight: '500',
  },
  regionalChainStates: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  // Business Search Links
  geoBusinessLinksSection: {
    marginBottom: 12,
  },
  geoBusinessLinksTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.info,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  businessLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.surface,
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.info + '30',
  },
  businessLinkText: {
    fontSize: 13,
    color: THEME.text,
    flex: 1,
    fontWeight: '500',
  },
  // Enhanced OSM Lookup
  enhanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.purple,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  enhanceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  enhancedSection: {
    backgroundColor: THEME.surface,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.purple + '40',
  },
  enhancedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  narrowedRegionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.success + '20',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  narrowedRegionText: {
    fontSize: 13,
    color: THEME.text,
    flex: 1,
  },
  narrowedRegionHighlight: {
    fontWeight: '700',
    color: THEME.success,
  },
  osmBusinessItem: {
    marginBottom: 12,
  },
  osmBusinessName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 6,
  },
  osmMatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.surfaceLight,
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    marginLeft: 8,
  },
  osmMatchText: {
    fontSize: 12,
    color: THEME.textSecondary,
    flex: 1,
  },
  noOsmResults: {
    fontSize: 12,
    color: THEME.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Backend OSINT Results Styles
  osintResultsContainer: {
    backgroundColor: THEME.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.success + '40',
  },
  osintResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  osintResultsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.success,
    flex: 1,
  },
  osintResultsTime: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  accountsList: {
    gap: 6,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.bg,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  accountName: {
    fontSize: 13,
    color: THEME.text,
    flex: 1,
  },
  accountNameClickable: {
    color: THEME.info,
    textDecorationLine: 'underline',
  },
  moreAccounts: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  noAccountsText: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  osintErrors: {
    fontSize: 11,
    color: THEME.warning,
    marginTop: 8,
    textAlign: 'center',
  },
});
