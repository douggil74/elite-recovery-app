import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, VERSION, AI_CONFIG, OSINT_CONFIG } from '@/constants';

interface FeatureSection {
  title: string;
  icon: string;
  items: { name: string; description: string; type?: 'ai' | 'db' | 'api' | 'tool' }[];
}

const FEATURES: FeatureSection[] = [
  {
    title: 'Jail Roster Import',
    icon: 'download',
    items: [
      { name: 'Auto-Scrape Bookings', description: 'Paste jail booking URL to extract inmate data automatically', type: 'tool' },
      { name: 'Mugshot Extraction', description: 'Pulls booking photo from supported jail sites', type: 'tool' },
      { name: 'Charge Parsing', description: 'Extracts all charges with bond amounts', type: 'tool' },
      { name: 'Bulk Import', description: 'Import multiple inmates by time period (24h, 48h, 72h)', type: 'tool' },
      { name: 'Revize Sites', description: 'Works with St. Tammany Parish and other Revize-powered jails', type: 'tool' },
    ],
  },
  {
    title: 'FTA Risk Scoring',
    icon: 'analytics',
    items: [
      { name: 'Risk Score (0-100)', description: 'Calculates failure-to-appear probability', type: 'ai' },
      { name: 'Prior FTA Detection', description: 'Detects FUGITIVE charges indicating prior warrants', type: 'tool' },
      { name: 'Charge Analysis', description: 'Weighs felony vs misdemeanor, violent crimes', type: 'tool' },
      { name: 'Bond Amount Factor', description: 'Higher bonds = more skin in the game', type: 'tool' },
      { name: 'AI Assessment', description: 'AI generates risk narrative with recommendations', type: 'ai' },
    ],
  },
  {
    title: 'AI Intelligence',
    icon: 'hardware-chip',
    items: [
      { name: 'Agent Dialogue', description: 'Investigative partner that thinks alongside you', type: 'ai' },
      { name: 'Photo Analysis', description: 'Extracts addresses, plates, landmarks from images', type: 'ai' },
      { name: 'Document Reading', description: 'Parses skip-trace reports and bail documents', type: 'ai' },
      { name: 'Reanalyze', description: 'Clears old intel and re-processes all documents fresh', type: 'ai' },
      { name: 'Contact Validation', description: 'Filters out data headers and junk from parsed contacts', type: 'tool' },
      { name: 'Address Dedup', description: 'Normalizes and deduplicates addresses automatically', type: 'tool' },
      { name: 'Recovery Brief', description: 'Generates tactical recovery plans', type: 'ai' },
      { name: 'Face Matching', description: 'Compares mugshot to social media photos', type: 'ai' },
    ],
  },
  {
    title: 'Username Search',
    icon: 'at',
    items: [
      { name: 'Direct HTTP Checks', description: 'Checks 24 major platforms (Twitter, Instagram, TikTok, etc.)', type: 'tool' },
      { name: 'Real Profile URLs', description: 'Returns actual profile links, not just availability', type: 'tool' },
      { name: 'Name Variations', description: 'Auto-generates usernames from name (Doug/Douglas, etc.)', type: 'tool' },
    ],
  },
  {
    title: 'Email Search',
    icon: 'mail',
    items: [
      { name: 'Holehe', description: 'Checks if email is registered on 120+ services', type: 'tool' },
      { name: 'Google Account Check', description: 'Detects Google account, YouTube, Blogger, Maps reviews', type: 'tool' },
      { name: 'Search Links', description: 'Google Image search, public Docs/Drive files', type: 'tool' },
    ],
  },
  {
    title: 'Phone Lookup',
    icon: 'call',
    items: [
      { name: 'WhatsApp/Telegram Check', description: 'Detects if phone has messaging apps', type: 'tool' },
      { name: 'Payment Apps', description: 'Lists Venmo, Cash App, Zelle to check manually', type: 'tool' },
      { name: 'Forgot Password Trick', description: 'Use phone in FB/IG recovery to verify account exists', type: 'tool' },
    ],
  },
  {
    title: 'Social Media Links',
    icon: 'share-social',
    items: [
      { name: 'Facebook', description: 'Direct search link with name variations', type: 'db' },
      { name: 'Instagram', description: 'Profile search link', type: 'db' },
      { name: 'TikTok', description: 'Profile search link', type: 'db' },
      { name: 'Twitter/X', description: 'User search link', type: 'db' },
      { name: 'LinkedIn', description: 'Professional profile search link', type: 'db' },
      { name: 'Snapchat', description: 'Add by username link', type: 'db' },
    ],
  },
  {
    title: 'Court Records',
    icon: 'briefcase',
    items: [
      { name: 'CourtListener', description: 'Federal court records search (limited without key)', type: 'api' },
      { name: 'LA Court Records', description: 'Link to re:SearchLA (Tyler Technologies)', type: 'db' },
    ],
  },
  {
    title: 'People Search Links',
    icon: 'people',
    items: [
      { name: 'TruePeopleSearch', description: 'Free comprehensive people search', type: 'db' },
      { name: 'FastPeopleSearch', description: 'Quick people lookup', type: 'db' },
      { name: 'Whitepages', description: 'Phone and address directory', type: 'db' },
      { name: 'Spokeo', description: 'Aggregated people data', type: 'db' },
    ],
  },
  {
    title: 'Cloud Storage',
    icon: 'cloud',
    items: [
      { name: 'Firebase Firestore', description: 'All cases synced to cloud in real-time', type: 'db' },
      { name: 'REST API Fallback', description: 'Automatic fallback when WebSocket is unavailable', type: 'api' },
      { name: 'Cloud Sync Indicator', description: 'Live connection status with tap-to-sync', type: 'tool' },
      { name: 'Offline Cache', description: 'AsyncStorage cache for instant loading', type: 'tool' },
    ],
  },
];

const PYTHON_TOOLS_LIVE = [
  // Username Search
  { name: 'Sherlock', description: 'Username search across 400+ sites', status: 'live', category: 'username' },
  { name: 'Direct HTTP Checks', description: 'Username search across 24 major platforms via direct requests', status: 'live', category: 'username' },
  // Email Tools
  { name: 'Holehe', description: 'Check email registration on 120+ services', status: 'live', category: 'email' },
  // Combined OSINT
  { name: 'Combined Search', description: 'Multi-tool OSINT search in one request', status: 'live', category: 'osint' },
];

const VERCEL_INFO = {
  url: 'recovery-app-blond.vercel.app',
  endpoints: [
    'POST /api/ai/chat - AI chat proxy (server-side OpenAI key)',
  ],
};

const BACKEND_INFO = {
  url: OSINT_CONFIG.productionUrl,
  version: VERSION,
  endpoints: [
    '/api/sherlock - Username search (400+ sites)',
    '/api/holehe - Email discovery (120+ services)',
    '/api/osint/search - Combined OSINT search',
    '/health - Backend health check',
  ],
};

export default function AboutScreen() {
  const router = useRouter();

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'ai': return '#8b5cf6'; // purple
      case 'db': return '#3b82f6'; // blue
      case 'api': return '#22c55e'; // green
      case 'tool': return '#f59e0b'; // amber
      default: return COLORS.textSecondary;
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'ai': return 'AI';
      case 'db': return 'DB';
      case 'api': return 'API';
      case 'tool': return 'TOOL';
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About This App</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.logoBox}>
            <Ionicons name="locate" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>Elite Recovery System</Text>
          <Text style={styles.appVersion}>Version {VERSION}</Text>
          <Text style={styles.appTagline}>
            Advanced Recovery Intelligence Platform
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>7</Text>
            <Text style={styles.statLabel}>OSINT Tools</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>144+</Text>
            <Text style={styles.statLabel}>Sites Checked</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>Cloud</Text>
            <Text style={styles.statLabel}>Firestore Sync</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>GPT-4o</Text>
            <Text style={styles.statLabel}>AI Engine</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.legendText}>AI Model</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Database</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>API</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.legendText}>Tool</Text>
          </View>
        </View>

        {/* Feature Sections */}
        {FEATURES.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.itemList}>
              {section.items.map((item, itemIdx) => (
                <View key={itemIdx} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.type && (
                      <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '30' }]}>
                        <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                          {getTypeLabel(item.type)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* AI Engine */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>AI Engine</Text>
            <View style={[styles.typeBadge, { backgroundColor: '#8b5cf630', marginLeft: 8 }]}>
              <Text style={[styles.typeText, { color: '#8b5cf6' }]}>{AI_CONFIG.provider}</Text>
            </View>
          </View>

          <View style={[styles.item, { borderLeftColor: '#8b5cf6', marginBottom: 8 }]}>
            <Text style={styles.itemName}>Chat Model: GPT-4o (via Vercel)</Text>
            <Text style={styles.itemDesc}>AI dialogue and document analysis with server-side API key</Text>
          </View>
          <View style={[styles.item, { borderLeftColor: '#8b5cf6' }]}>
            <Text style={styles.itemName}>API Keys: Vercel Environment Variables</Text>
            <Text style={styles.itemDesc}>OpenAI, Anthropic, Google Maps, IPQualityScore - never client-side</Text>
          </View>
        </View>

        {/* Vercel Serverless */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud-done" size={20} color="#22c55e" />
            <Text style={styles.sectionTitle}>Vercel Serverless API</Text>
            <View style={[styles.typeBadge, { backgroundColor: '#22c55e30', marginLeft: 8 }]}>
              <Text style={[styles.typeText, { color: '#22c55e' }]}>LIVE</Text>
            </View>
          </View>

          <View style={[styles.item, { borderLeftColor: '#22c55e', marginBottom: 8 }]}>
            <Text style={styles.itemName}>{VERCEL_INFO.url}</Text>
            <Text style={styles.itemDesc}>Server-side API keys (never exposed to client)</Text>
          </View>
          {VERCEL_INFO.endpoints.map((ep, idx) => (
            <View key={idx} style={[styles.item, { borderLeftColor: '#22c55e', marginBottom: 4 }]}>
              <Text style={styles.itemDesc}>{ep}</Text>
            </View>
          ))}
        </View>

        {/* Python OSINT Backend - LIVE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="logo-python" size={20} color="#3776ab" />
            <Text style={styles.sectionTitle}>Python OSINT Backend</Text>
            <View style={[styles.typeBadge, { backgroundColor: '#22c55e30', marginLeft: 8 }]}>
              <Text style={[styles.typeText, { color: '#22c55e' }]}>LIVE</Text>
            </View>
          </View>

          <View style={[styles.item, { borderLeftColor: '#22c55e', marginBottom: 12 }]}>
            <Text style={styles.itemName}>{BACKEND_INFO.url}</Text>
            <Text style={styles.itemDesc}>Version {BACKEND_INFO.version}</Text>
          </View>

          <View style={styles.itemList}>
            {PYTHON_TOOLS_LIVE.map((tool, idx) => (
              <View key={idx} style={[styles.item, { borderLeftColor: tool.status === 'live' ? '#22c55e' : '#f59e0b' }]}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{tool.name}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: tool.status === 'live' ? '#22c55e30' : '#f59e0b30' }]}>
                    <Text style={[styles.typeText, { color: tool.status === 'live' ? '#22c55e' : '#f59e0b' }]}>
                      {tool.status === 'live' ? 'LIVE' : 'PLANNED'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemDesc}>{tool.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Support Info */}
        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>Support</Text>
          <Text style={styles.supportText}>
            For technical support, training, or custom integrations, contact your account representative.
          </Text>
          <TouchableOpacity
            style={styles.supportLink}
            onPress={() => Linking.openURL('mailto:douglas@eliterecoveryla.com')}
          >
            <Ionicons name="mail" size={16} color={COLORS.primary} />
            <Text style={styles.supportLinkText}>douglas@eliterecoveryla.com</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Elite Recovery System - For authorized law enforcement and licensed bail recovery use only.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginHorizontal: 3,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemList: {
    gap: 6,
  },
  item: {
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  supportSection: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  supportText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supportLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 24,
  },
});
