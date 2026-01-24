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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

export default function OSINTScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'email' | 'phone' | 'username' | 'address'>('name');
  const [searchResults, setSearchResults] = useState<{ category: string; items: { name: string; url: string; icon: string }[] }[]>([]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const links = generateSearchLinks(searchQuery.trim(), searchType);
    setSearchResults(links);
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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* TRACE Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandTitle}>OSINT</Text>
          <Text style={styles.brandSubtitle}>
            Open Source Intelligence Search
          </Text>
        </View>

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
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.searchBtnText}>Generate Search Links</Text>
        </TouchableOpacity>

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
  brandHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: THEME.primary,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '400',
    color: THEME.primary,
    letterSpacing: 6,
    textShadowColor: THEME.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    fontFamily: Platform.OS === 'web' ? '"Black Ops One", monospace' : undefined,
  },
  brandSubtitle: {
    fontSize: 11,
    color: THEME.textMuted,
    letterSpacing: 2,
    marginTop: 6,
    textTransform: 'uppercase',
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
});
