/**
 * OSINT Search Tab - Direct search links to OSINT resources
 * No backend required - generates URLs directly
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useSettings } from '@/hooks/useSettings';

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
  warning: COLORS.warning,
  danger: COLORS.danger,
  info: '#3b82f6',
  purple: '#8b5cf6',
  text: COLORS.text,
  textSecondary: COLORS.textSecondary,
  textMuted: COLORS.textMuted,
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
  type: 'email' | 'username' | 'name' | 'phone';
  query: string;
  accounts: { service: string; url?: string; status?: string; note?: string }[];
  totalFound: number;
  executionTime: number;
  errors: string[];
  tip?: string;
  // IPQS phone type fields
  lineType?: string;
  carrier?: string;
  active?: boolean | null;
  voipProvider?: string;
  fraudScore?: number;
  phoneCity?: string;
  phoneState?: string;
  prepaid?: boolean | null;
  risky?: boolean;
  spammer?: boolean;
  name?: string;
}

export default function OSINTScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'email' | 'phone' | 'username' | 'address'>('name');
  const [searchResults, setSearchResults] = useState<{ category: string; items: { name: string; url: string; icon: string }[] }[]>([]);

  // Backend OSINT results
  const [osintResult, setOsintResult] = useState<OSINTResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);


  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // Generate fallback links
    const links = generateSearchLinks(searchQuery.trim(), searchType);
    setSearchResults(links);

    // Call backend APIs for actual results
    if (searchType === 'email' || searchType === 'username' || searchType === 'phone') {
      setIsSearching(true);
      setSearchError(null);
      setOsintResult(null);

      try {
        if (searchType === 'email') {
          // Use Holehe for email search + Google lookup
          const [holeheRes, googleRes] = await Promise.all([
            fetch(`${OSINT_API}/api/holehe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: searchQuery.trim() }),
            }),
            fetch(`${OSINT_API}/api/google-lookup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: searchQuery.trim() }),
            }),
          ]);

          const accounts: any[] = [];
          let totalFound = 0;

          if (holeheRes.ok) {
            const data = await holeheRes.json();
            (data.registered_on || []).forEach((item: any) => {
              accounts.push({
                service: item.service,
                status: item.status,
                url: item.service.includes('.') ? `https://${item.service}` : undefined,
              });
            });
            totalFound += data.registered_on?.length || 0;
          }

          if (googleRes.ok) {
            const googleData = await googleRes.json();
            if (googleData.intel?.google_account_exists) {
              accounts.unshift({
                service: 'Google Account',
                status: 'exists',
                url: `https://google.com/search?q="${searchQuery.trim()}"`,
              });
              totalFound += 1;
            }
            (googleData.intel?.services_found || []).forEach((svc: any) => {
              accounts.push({
                service: `Google: ${svc.service}`,
                status: 'found',
                url: svc.url,
              });
              totalFound += 1;
            });
          }

          setOsintResult({
            type: 'email',
            query: searchQuery.trim(),
            accounts,
            totalFound,
            executionTime: 0,
            errors: [],
          });
        } else if (searchType === 'username') {
          // Use direct HTTP checks for username search
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
                service: item.platform || item.site || item.name,
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
        } else if (searchType === 'phone') {
          // Use phone lookup endpoint
          const response = await fetch(`${OSINT_API}/api/phone-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: searchQuery.trim() }),
          });

          if (response.ok) {
            const data = await response.json();
            const accounts = [
              ...(data.accounts_found || []).map((item: any) => ({
                service: item.platform,
                status: item.status,
                url: item.url,
                note: item.note,
              })),
              ...(data.apps_to_check || []).map((item: any) => ({
                service: item.platform,
                status: item.status,
                note: item.note,
              })),
            ];
            setOsintResult({
              type: 'phone',
              query: searchQuery.trim(),
              accounts,
              totalFound: data.total_found || 0,
              executionTime: data.execution_time || 0,
              errors: data.errors || [],
              tip: data.tip,
              // IPQS phone type fields
              lineType: data.line_type,
              carrier: data.carrier,
              active: data.active,
              voipProvider: data.voip_provider,
              fraudScore: data.fraud_score,
              phoneCity: data.phone_city,
              phoneState: data.phone_state,
              prepaid: data.prepaid,
              risky: data.risky,
              spammer: data.spammer,
              name: data.name,
            });
          } else {
            setSearchError('Phone search failed');
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
                {searchType === 'name' || searchType === 'address' ? 'Search Person' : 'Find Accounts'}
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
                {osintResult.type === 'phone' ? 'Phone Intelligence' : `${osintResult.totalFound} Account${osintResult.totalFound !== 1 ? 's' : ''} Found`}
              </Text>
              <Text style={styles.osintResultsTime}>
                {osintResult.executionTime.toFixed(1)}s
              </Text>
            </View>

            {/* Phone Line Type Badge + Details */}
            {osintResult.type === 'phone' && osintResult.lineType && (
              <View style={styles.phoneTypeSection}>
                {/* Line type badge */}
                <View style={[styles.lineTypeBadge, {
                  backgroundColor: osintResult.lineType === 'Wireless' ? THEME.success + '20' :
                    osintResult.lineType === 'Landline' ? THEME.warning + '20' :
                    osintResult.lineType === 'VOIP' ? '#f97316' + '20' : THEME.textMuted + '20',
                  borderColor: osintResult.lineType === 'Wireless' ? THEME.success :
                    osintResult.lineType === 'Landline' ? THEME.warning :
                    osintResult.lineType === 'VOIP' ? '#f97316' : THEME.textMuted,
                }]}>
                  <Ionicons
                    name={osintResult.lineType === 'Wireless' ? 'phone-portrait' :
                      osintResult.lineType === 'Landline' ? 'call' : 'globe'}
                    size={18}
                    color={osintResult.lineType === 'Wireless' ? THEME.success :
                      osintResult.lineType === 'Landline' ? THEME.warning :
                      osintResult.lineType === 'VOIP' ? '#f97316' : THEME.textMuted}
                  />
                  <Text style={[styles.lineTypeText, {
                    color: osintResult.lineType === 'Wireless' ? THEME.success :
                      osintResult.lineType === 'Landline' ? THEME.warning :
                      osintResult.lineType === 'VOIP' ? '#f97316' : THEME.textMuted,
                  }]}>
                    {osintResult.lineType === 'Wireless' ? 'CELL PHONE' :
                     osintResult.lineType === 'Landline' ? 'LANDLINE' :
                     osintResult.lineType === 'VOIP' ? `VOIP${osintResult.voipProvider ? ` - ${osintResult.voipProvider}` : ''}` :
                     osintResult.lineType.toUpperCase()}
                  </Text>
                  {osintResult.active === true && (
                    <View style={styles.activeIndicatorSmall} />
                  )}
                </View>

                {/* Phone details */}
                <View style={styles.phoneDetails}>
                  {osintResult.carrier ? (
                    <Text style={styles.phoneDetailText}>Carrier: {osintResult.carrier}</Text>
                  ) : null}
                  {osintResult.active !== null && osintResult.active !== undefined ? (
                    <Text style={[styles.phoneDetailText, { color: osintResult.active ? THEME.success : THEME.danger }]}>
                      {osintResult.active ? 'Active' : 'Inactive'}
                    </Text>
                  ) : null}
                  {osintResult.phoneCity || osintResult.phoneState ? (
                    <Text style={styles.phoneDetailText}>
                      Location: {[osintResult.phoneCity, osintResult.phoneState].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                  {osintResult.prepaid === true && (
                    <Text style={[styles.phoneDetailText, { color: THEME.warning }]}>Prepaid</Text>
                  )}
                  {osintResult.name ? (
                    <Text style={styles.phoneDetailText}>Registered: {osintResult.name}</Text>
                  ) : null}
                  {osintResult.fraudScore != null && osintResult.fraudScore > 50 && (
                    <Text style={[styles.phoneDetailText, { color: THEME.danger }]}>
                      Fraud Score: {osintResult.fraudScore}/100
                    </Text>
                  )}
                  {osintResult.spammer && (
                    <Text style={[styles.phoneDetailText, { color: THEME.danger }]}>Known Spammer</Text>
                  )}
                </View>

                {/* Google Voice Text button */}
                {settings.googleVoiceNumber && (
                  <TouchableOpacity
                    style={styles.gvTextButton}
                    onPress={() => {
                      const cleanPhone = osintResult.query.replace(/\D/g, '');
                      const gvUrl = `https://voice.google.com/u/0/messages?itemId=t.+1${cleanPhone}`;
                      openUrl(gvUrl);
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#f59e0b" />
                    <Text style={styles.gvTextButtonText}>GV Text</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {osintResult.type !== 'phone' && (
              osintResult.accounts.length > 0 ? (
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
              )
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
              <Text style={styles.infoText}>Reverse lookup, carrier info, line type, fraud score</Text>

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
  // Phone Type Section Styles
  phoneTypeSection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: THEME.bg,
    borderRadius: 10,
    gap: 8,
  },
  lineTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  lineTypeText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeIndicatorSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.success,
    marginLeft: 4,
  },
  phoneDetails: {
    gap: 3,
    paddingLeft: 4,
  },
  phoneDetailText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  gvTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f59e0b' + '20',
    borderWidth: 1,
    borderColor: '#f59e0b' + '40',
    marginTop: 4,
  },
  gvTextButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
});
