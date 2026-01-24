/**
 * OSINT Search Tab - Access to ALL OSINT tools
 * Seamless navigation to FTA Risk and Cases
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCases } from '@/hooks/useCases';

const BACKEND_URL = 'https://elite-recovery-osint.onrender.com';

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

// All available OSINT tools organized by category
const OSINT_TOOLS = {
  username: [
    { id: 'sherlock', name: 'Sherlock', desc: 'Search 400+ sites', endpoint: '/api/sherlock' },
    { id: 'maigret', name: 'Maigret', desc: 'Comprehensive search', endpoint: '/api/maigret' },
    { id: 'blackbird', name: 'Blackbird', desc: 'Alternative search', endpoint: '/api/blackbird' },
    { id: 'socialanalyzer', name: 'Social-Analyzer', desc: '1000+ sites', endpoint: '/api/social-analyzer' },
    { id: 'socialscan', name: 'Socialscan', desc: 'Quick check', endpoint: '/api/socialscan' },
  ],
  email: [
    { id: 'holehe', name: 'Holehe', desc: 'Check 120+ services', endpoint: '/api/holehe' },
    { id: 'h8mail', name: 'h8mail', desc: 'Breach/leak search', endpoint: '/api/h8mail' },
    { id: 'ghunt', name: 'GHunt', desc: 'Google account intel', endpoint: '/api/ghunt' },
    { id: 'harvester', name: 'theHarvester', desc: 'Domain recon', endpoint: '/api/harvester' },
  ],
  phone: [
    { id: 'phoneinfoga', name: 'PhoneInfoga', desc: 'Advanced phone OSINT', endpoint: '/api/phoneinfoga' },
    { id: 'ignorant', name: 'Ignorant', desc: 'Social account check', endpoint: '/api/ignorant' },
  ],
  instagram: [
    { id: 'instaloader', name: 'Instaloader', desc: 'Profile intel', endpoint: '/api/instagram' },
    { id: 'toutatis', name: 'Toutatis', desc: 'Deep intel (phone/email)', endpoint: '/api/toutatis' },
  ],
  web: [
    { id: 'websearch', name: 'Web Search', desc: 'DuckDuckGo search', endpoint: '/api/web-search' },
    { id: 'whois', name: 'WHOIS', desc: 'Domain registration', endpoint: '/api/whois' },
    { id: 'wayback', name: 'Wayback', desc: 'Historical snapshots', endpoint: '/api/wayback' },
    { id: 'iplookup', name: 'IP Lookup', desc: 'Geolocation', endpoint: '/api/ip-lookup' },
  ],
  records: [
    { id: 'courtlistener', name: 'CourtListener', desc: 'Federal court records', endpoint: '/api/court-records' },
    { id: 'statecourts', name: 'State Courts', desc: 'State court links', endpoint: '/api/state-courts' },
    { id: 'background', name: 'Background', desc: 'Background check links', endpoint: '/api/background-links' },
    { id: 'vehicle', name: 'Vehicle Search', desc: 'Plate/VIN lookup', endpoint: '/api/vehicle-search' },
  ],
};

// Comprehensive search options
const SWEEP_TYPES = [
  { id: 'investigate', name: 'Quick Search', desc: 'Smart person search', endpoint: '/api/investigate' },
  { id: 'sweep', name: 'Full Sweep', desc: 'Username + Email + Phone', endpoint: '/api/sweep' },
  { id: 'megasweep', name: 'MEGA Sweep', desc: 'ALL tools combined', endpoint: '/api/mega-sweep' },
];

interface SearchResult {
  type: 'profile' | 'link' | 'service' | 'record';
  name: string;
  url?: string;
  details?: string;
  source?: string;
}

// Name parsing utilities for proper Facebook search
interface ParsedName {
  first: string;
  middle: string;
  last: string;
  suffix: string;
  full: string;
}

const SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', '2nd', '3rd', '4th'];

function parseName(fullName: string): ParsedName {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { first: '', middle: '', last: '', suffix: '', full: fullName };
  }

  // Check if last part is a suffix
  let suffix = '';
  if (parts.length > 1 && SUFFIXES.includes(parts[parts.length - 1].toLowerCase())) {
    suffix = parts.pop()!;
  }

  // Now parse first, middle, last
  let first = '';
  let middle = '';
  let last = '';

  if (parts.length === 1) {
    first = parts[0];
  } else if (parts.length === 2) {
    first = parts[0];
    last = parts[1];
  } else {
    first = parts[0];
    last = parts[parts.length - 1];
    middle = parts.slice(1, -1).join(' ');
  }

  return { first, middle, last, suffix, full: fullName };
}

function generateFacebookVariants(name: ParsedName): { label: string; query: string }[] {
  const variants: { label: string; query: string }[] = [];
  const { first, middle, last, suffix } = name;

  if (!first) return variants;

  // Standard format: First Last (always first)
  if (last) {
    const base = `${first} ${last}`;
    variants.push({ label: 'First Last', query: base });

    // With suffix if present
    if (suffix) {
      variants.push({ label: 'First Last Suffix', query: `${base} ${suffix}` });
    }

    // With middle name
    if (middle) {
      variants.push({ label: 'First Middle Last', query: `${first} ${middle} ${last}` });
      if (suffix) {
        variants.push({ label: 'Full Name + Suffix', query: `${first} ${middle} ${last} ${suffix}` });
      }
    }
  } else {
    // Just first name
    variants.push({ label: 'Name', query: first });
  }

  return variants;
}

function buildFacebookSearchUrl(query: string): string {
  return `https://www.facebook.com/search/people/?q=${encodeURIComponent(query)}`;
}

export default function OSINTScreen() {
  const router = useRouter();
  const { createCase } = useCases();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'username' | 'email' | 'phone' | 'domain'>('name');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Creating case state
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  const runSearch = async (endpoint?: string) => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setResults([]);
    setSearchSummary(null);
    const startTime = Date.now();

    try {
      // Determine which endpoint to use
      const targetEndpoint = endpoint || '/api/investigate';

      // Build request body based on search type
      let body: any = { timeout: 90 };

      if (searchType === 'name') {
        body.name = searchQuery.trim();
      } else if (searchType === 'username') {
        body.username = searchQuery.trim().replace(/^@/, '');
      } else if (searchType === 'email') {
        body.email = searchQuery.trim();
      } else if (searchType === 'phone') {
        body.phone = searchQuery.trim();
      } else if (searchType === 'domain') {
        body.domain = searchQuery.trim();
      }

      const res = await fetch(`${BACKEND_URL}${targetEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
      }

      const data = await res.json();

      // Parse results based on endpoint type
      const parsedResults: SearchResult[] = [];

      // People search links
      if (data.people_search_links) {
        data.people_search_links.forEach((link: any) => {
          parsedResults.push({
            type: 'link',
            name: link.name,
            url: link.url,
            details: link.type || 'search',
            source: 'people_search',
          });
        });
      }

      // Confirmed profiles
      if (data.confirmed_profiles) {
        data.confirmed_profiles.forEach((profile: any) => {
          parsedResults.push({
            type: 'profile',
            name: profile.platform || 'Unknown',
            url: profile.url,
            details: profile.username || profile.source,
            source: 'confirmed',
          });
        });
      }

      // Found profiles (from username search)
      if (data.found) {
        data.found.forEach((profile: any) => {
          parsedResults.push({
            type: 'profile',
            name: profile.platform || profile.site || 'Unknown',
            url: profile.url,
            details: data.username || searchQuery,
            source: data.tool || 'search',
          });
        });
      }

      // Registered services (from email search)
      if (data.registered_on) {
        data.registered_on.forEach((service: any) => {
          const serviceName = typeof service === 'string' ? service : service.service;
          parsedResults.push({
            type: 'service',
            name: serviceName,
            details: 'Email registered',
            source: 'holehe',
          });
        });
      }

      // Breaches found (from h8mail)
      if (data.breaches_found) {
        data.breaches_found.forEach((breach: any) => {
          parsedResults.push({
            type: 'record',
            name: breach.source || breach.breach_name || 'Data Breach',
            details: breach.data || 'Exposed',
            source: 'h8mail',
          });
        });
      }

      // Court cases
      if (data.cases_found) {
        data.cases_found.forEach((c: any) => {
          parsedResults.push({
            type: 'record',
            name: c.case_name || 'Court Case',
            url: c.url,
            details: `${c.court} - ${c.date_filed}`,
            source: 'courtlistener',
          });
        });
      }

      // Profile data (from Instagram tools)
      if (data.profile) {
        const p = data.profile;
        if (p.username) {
          parsedResults.push({
            type: 'profile',
            name: 'Instagram',
            url: `https://instagram.com/${p.username}`,
            details: `${p.full_name || p.username} | ${p.followers || 0} followers | ${p.posts || 0} posts`,
            source: 'instaloader',
          });
        }
      }

      // Intel (from GHunt/Toutatis)
      if (data.intel && Object.keys(data.intel).length > 0) {
        Object.entries(data.intel).forEach(([key, value]) => {
          if (value && value !== 'None') {
            parsedResults.push({
              type: 'record',
              name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              details: String(value),
              source: 'intel',
            });
          }
        });
      }

      // Accounts found (from Ignorant)
      if (data.accounts_found) {
        data.accounts_found.forEach((acc: any) => {
          parsedResults.push({
            type: 'service',
            name: acc.platform,
            details: 'Phone registered',
            source: 'ignorant',
          });
        });
      }

      // Search links (from vehicle/background)
      if (data.search_links) {
        data.search_links.forEach((link: any) => {
          parsedResults.push({
            type: 'link',
            name: link.name,
            url: link.url,
            details: link.type,
            source: 'search_links',
          });
        });
      }

      // WHOIS data
      if (data.whois_data && data.whois_data.registrar) {
        parsedResults.push({
          type: 'record',
          name: 'Domain Registration',
          details: `Registrar: ${data.whois_data.registrar} | Created: ${data.whois_data.creation_date}`,
          source: 'whois',
        });
      }

      // Wayback snapshots
      if (data.snapshots) {
        data.snapshots.forEach((snap: any) => {
          parsedResults.push({
            type: 'link',
            name: `Wayback ${snap.type}`,
            url: snap.archive_url,
            details: snap.timestamp,
            source: 'wayback',
          });
        });
      }

      // Web search results
      if (data.results && targetEndpoint.includes('web-search')) {
        data.results.forEach((r: any) => {
          parsedResults.push({
            type: 'link',
            name: r.title || 'Web Result',
            url: r.url,
            details: r.snippet?.substring(0, 100),
            source: 'web_search',
          });
        });
      }

      // Mega sweep results (nested)
      if (data.results && data.results.username_searches) {
        data.results.username_searches.forEach((search: any) => {
          const found = search.result?.found || [];
          found.forEach((profile: any) => {
            parsedResults.push({
              type: 'profile',
              name: profile.platform || 'Unknown',
              url: profile.url,
              details: search.tool,
              source: search.tool,
            });
          });
        });
      }

      setResults(parsedResults);
      setSearchSummary(data.summary || `Found ${parsedResults.length} results for: ${searchQuery}`);
      setSearchTime(Date.now() - startTime);

    } catch (err: any) {
      setSearchError(err.message || 'Search failed. Check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const runSpecificTool = async (tool: typeof OSINT_TOOLS.username[0]) => {
    setSelectedTool(tool.id);
    await runSearch(tool.endpoint);
    setSelectedTool(null);
  };

  const goToFTARisk = () => {
    router.push(`/(tabs)/risk?prefillName=${encodeURIComponent(searchQuery.trim())}`);
  };

  const createCaseFromResults = async () => {
    if (!searchQuery.trim()) return;

    setIsCreatingCase(true);
    try {
      const newCase = await createCase(searchQuery.trim(), 'fta_recovery');
      router.push(`/case/${newCase.id}`);
    } catch (err) {
      setSearchError('Failed to create case');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const openUrl = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const getResultIcon = (type: string): string => {
    switch (type) {
      case 'profile': return 'person-circle';
      case 'service': return 'checkmark-circle';
      case 'record': return 'document-text';
      case 'link': return 'link';
      default: return 'globe-outline';
    }
  };

  const getResultColor = (type: string): string => {
    switch (type) {
      case 'profile': return THEME.success;
      case 'service': return THEME.info;
      case 'record': return THEME.warning;
      case 'link': return THEME.purple;
      default: return THEME.textMuted;
    }
  };

  const getCategoryIcon = (cat: string): string => {
    switch (cat) {
      case 'username': return 'at';
      case 'email': return 'mail';
      case 'phone': return 'call';
      case 'instagram': return 'logo-instagram';
      case 'web': return 'globe';
      case 'records': return 'briefcase';
      default: return 'search';
    }
  };

  const hasResults = results.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="search" size={32} color={THEME.primary} />
          </View>
          <Text style={styles.headerTitle}>OSINT SEARCH</Text>
          <Text style={styles.headerSubtitle}>
            25+ tools • 1500+ sites • All powered by Python
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchSection}>
          <View style={styles.searchTypeRow}>
            {(['name', 'username', 'email', 'phone', 'domain'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, searchType === type && styles.typeBtnActive]}
                onPress={() => setSearchType(type)}
              >
                <Ionicons
                  name={
                    type === 'name' ? 'person' :
                    type === 'username' ? 'at' :
                    type === 'email' ? 'mail' :
                    type === 'phone' ? 'call' :
                    'globe'
                  }
                  size={14}
                  color={searchType === type ? THEME.primary : THEME.textMuted}
                />
                <Text style={[styles.typeBtnText, searchType === type && styles.typeBtnTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={THEME.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                searchType === 'name' ? 'Enter full name' :
                searchType === 'username' ? 'Enter username' :
                searchType === 'email' ? 'Enter email' :
                searchType === 'phone' ? 'Enter phone' :
                'Enter domain'
              }
              placeholderTextColor={THEME.textMuted}
              autoCapitalize={searchType === 'name' ? 'words' : 'none'}
              keyboardType={searchType === 'email' ? 'email-address' : searchType === 'phone' ? 'phone-pad' : 'default'}
              onSubmitEditing={() => runSearch()}
            />
          </View>
        </View>

        {/* Main Search Buttons */}
        <View style={styles.sweepSection}>
          {SWEEP_TYPES.map((sweep) => (
            <TouchableOpacity
              key={sweep.id}
              style={[
                styles.sweepBtn,
                sweep.id === 'megasweep' && styles.sweepBtnMega,
                isSearching && styles.btnDisabled
              ]}
              onPress={() => runSearch(sweep.endpoint)}
              disabled={isSearching}
            >
              <Ionicons
                name={sweep.id === 'investigate' ? 'flash' : sweep.id === 'sweep' ? 'layers' : 'infinite'}
                size={20}
                color="#fff"
              />
              <View style={styles.sweepBtnText}>
                <Text style={styles.sweepBtnTitle}>{sweep.name}</Text>
                <Text style={styles.sweepBtnDesc}>{sweep.desc}</Text>
              </View>
              {isSearching && selectedTool === sweep.id && <ActivityIndicator color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Advanced Tools Toggle */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={styles.advancedToggleText}>
            {showAdvanced ? 'Hide' : 'Show'} Individual Tools
          </Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={THEME.primary}
          />
        </TouchableOpacity>

        {/* Individual Tools */}
        {showAdvanced && (
          <View style={styles.toolsSection}>
            {Object.entries(OSINT_TOOLS).map(([category, tools]) => (
              <View key={category} style={styles.toolCategory}>
                <View style={styles.categoryHeader}>
                  <Ionicons name={getCategoryIcon(category) as any} size={16} color={THEME.primary} />
                  <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
                </View>
                <View style={styles.toolsGrid}>
                  {tools.map((tool) => (
                    <TouchableOpacity
                      key={tool.id}
                      style={[styles.toolBtn, isSearching && styles.btnDisabled]}
                      onPress={() => runSpecificTool(tool)}
                      disabled={isSearching}
                    >
                      {isSearching && selectedTool === tool.id ? (
                        <ActivityIndicator size="small" color={THEME.primary} />
                      ) : (
                        <>
                          <Text style={styles.toolName}>{tool.name}</Text>
                          <Text style={styles.toolDesc}>{tool.desc}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Error */}
        {searchError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={THEME.danger} />
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {/* Results */}
        {hasResults && (
          <View style={styles.resultsSection}>
            {/* Summary */}
            {searchSummary && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{searchSummary}</Text>
                {searchTime && (
                  <Text style={styles.searchTime}>{(searchTime / 1000).toFixed(1)}s</Text>
                )}
              </View>
            )}

            {/* Facebook Name Variants - only show for name searches */}
            {searchType === 'name' && searchQuery.trim() && (
              <View style={styles.fbVariantsSection}>
                <View style={styles.fbVariantsHeader}>
                  <Ionicons name="logo-facebook" size={18} color="#1877f2" />
                  <Text style={styles.fbVariantsTitle}>FACEBOOK SEARCH VARIANTS</Text>
                </View>
                <Text style={styles.fbVariantsHint}>
                  Facebook requires "First Last Jr" format. Try these variants:
                </Text>
                <View style={styles.fbVariantsGrid}>
                  {generateFacebookVariants(parseName(searchQuery)).map((variant, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.fbVariantBtn}
                      onPress={() => openUrl(buildFacebookSearchUrl(variant.query))}
                    >
                      <Text style={styles.fbVariantLabel}>{variant.label}</Text>
                      <Text style={styles.fbVariantQuery}>{variant.query}</Text>
                      <Ionicons name="open-outline" size={14} color="#1877f2" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Results List */}
            <View style={styles.resultsList}>
              <Text style={styles.resultsTitle}>
                RESULTS ({results.length})
              </Text>
              {results.map((result, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.resultCard}
                  onPress={() => result.url && openUrl(result.url)}
                  disabled={!result.url}
                >
                  <Ionicons
                    name={getResultIcon(result.type) as any}
                    size={22}
                    color={getResultColor(result.type)}
                  />
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{result.name}</Text>
                    {result.details && (
                      <Text style={styles.resultDetails} numberOfLines={1}>{result.details}</Text>
                    )}
                    {result.source && (
                      <Text style={styles.resultSource}>{result.source}</Text>
                    )}
                  </View>
                  {result.url && (
                    <Ionicons name="open-outline" size={16} color={THEME.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              <Text style={styles.actionTitle}>NEXT STEPS</Text>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: THEME.warning }]} onPress={goToFTARisk}>
                <Ionicons name="analytics" size={22} color="#fff" />
                <View style={styles.actionBtnText}>
                  <Text style={styles.actionBtnTitle}>Calculate FTA Risk Score</Text>
                  <Text style={styles.actionBtnSubtitle}>Assess bond risk for "{searchQuery}"</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: THEME.info }]}
                onPress={createCaseFromResults}
                disabled={isCreatingCase}
              >
                {isCreatingCase ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="briefcase" size={22} color="#fff" />
                    <View style={styles.actionBtnText}>
                      <Text style={styles.actionBtnTitle}>Create Recovery Case</Text>
                      <Text style={styles.actionBtnSubtitle}>Save and start full investigation</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Facebook Quick Search - show when name is entered and not searching */}
        {!hasResults && !isSearching && searchType === 'name' && searchQuery.trim().length > 2 && (
          <View style={[styles.quickActions, { marginBottom: 16 }]}>
            <View style={styles.fbVariantsSection}>
              <View style={styles.fbVariantsHeader}>
                <Ionicons name="logo-facebook" size={18} color="#1877f2" />
                <Text style={styles.fbVariantsTitle}>QUICK FACEBOOK SEARCH</Text>
              </View>
              <Text style={styles.fbVariantsHint}>
                Facebook requires "First Last Jr" format. Tap a variant to search:
              </Text>
              <View style={styles.fbVariantsGrid}>
                {generateFacebookVariants(parseName(searchQuery)).map((variant, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.fbVariantBtn}
                    onPress={() => openUrl(buildFacebookSearchUrl(variant.query))}
                  >
                    <Text style={styles.fbVariantLabel}>{variant.label}</Text>
                    <Text style={styles.fbVariantQuery}>{variant.query}</Text>
                    <Ionicons name="open-outline" size={14} color="#1877f2" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions when no results */}
        {!hasResults && !isSearching && (
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

            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/import-roster')}>
              <Ionicons name="download" size={28} color={THEME.success} />
              <View style={styles.quickActionText}>
                <Text style={styles.quickActionTitle}>Import Jail Roster</Text>
                <Text style={styles.quickActionDesc}>Auto-fill data from booking URL</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>AVAILABLE TOOLS</Text>
            <View style={styles.toolsPreview}>
              <Text style={styles.toolsInfoHeader}>USERNAME</Text>
              <Text style={styles.toolsInfoText}>
                Sherlock • Maigret • Blackbird • Social-Analyzer • Socialscan
              </Text>

              <Text style={[styles.toolsInfoHeader, { marginTop: 8 }]}>EMAIL</Text>
              <Text style={styles.toolsInfoText}>
                Holehe • h8mail • GHunt • theHarvester
              </Text>

              <Text style={[styles.toolsInfoHeader, { marginTop: 8 }]}>PHONE</Text>
              <Text style={styles.toolsInfoText}>
                PhoneInfoga • Ignorant
              </Text>

              <Text style={[styles.toolsInfoHeader, { marginTop: 8 }]}>INSTAGRAM</Text>
              <Text style={styles.toolsInfoText}>
                Instaloader • Toutatis
              </Text>

              <Text style={[styles.toolsInfoHeader, { marginTop: 8 }]}>WEB/RECORDS</Text>
              <Text style={styles.toolsInfoText}>
                CourtListener • Web Search • WHOIS • Wayback • Vehicle Search • Background
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
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
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  typeBtnTextActive: {
    color: THEME.primary,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: THEME.text,
  },
  sweepSection: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  sweepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.primary,
    padding: 14,
    borderRadius: 12,
  },
  sweepBtnMega: {
    backgroundColor: THEME.purple,
  },
  sweepBtnText: {
    flex: 1,
  },
  sweepBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  sweepBtnDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  advancedToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
  toolsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  toolCategory: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolBtn: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    minWidth: 100,
    alignItems: 'center',
  },
  toolName: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text,
  },
  toolDesc: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.danger + '20',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: THEME.danger,
    fontSize: 14,
    flex: 1,
  },
  resultsSection: {
    paddingHorizontal: 16,
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  summaryText: {
    fontSize: 13,
    color: THEME.textSecondary,
    flex: 1,
  },
  searchTime: {
    fontSize: 12,
    color: THEME.success,
    fontWeight: '600',
  },
  fbVariantsSection: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1877f240',
  },
  fbVariantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  fbVariantsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1877f2',
    letterSpacing: 1,
  },
  fbVariantsHint: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  fbVariantsGrid: {
    gap: 8,
  },
  fbVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.bg,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
  },
  fbVariantLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    width: 90,
  },
  fbVariantQuery: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  resultsList: {
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  resultDetails: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  resultSource: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 2,
  },
  actionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  actionBtnText: {
    flex: 1,
  },
  actionBtnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  quickActions: {
    paddingHorizontal: 16,
    marginTop: 8,
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
  toolsPreview: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  toolsInfoHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.primary,
    letterSpacing: 1,
  },
  toolsInfoText: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
});
