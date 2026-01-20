import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, VERSION } from '@/constants';

interface FeatureSection {
  title: string;
  icon: string;
  items: { name: string; description: string; type?: 'ai' | 'db' | 'api' | 'tool' }[];
}

const FEATURES: FeatureSection[] = [
  {
    title: 'AI Models & Intelligence',
    icon: 'hardware-chip',
    items: [
      { name: 'GPT-4o (OpenAI)', description: 'Primary AI for document analysis, chat, and investigation planning', type: 'ai' },
      { name: 'GPT-4o Vision', description: 'Photo intelligence - extracts addresses, plates, landmarks from images', type: 'ai' },
      { name: 'EXTRACTOR Agent', description: 'Analyzes bail documents and extracts subject data', type: 'ai' },
      { name: 'EYES Agent', description: 'Processes photos for facial features and background analysis', type: 'ai' },
      { name: 'BRAIN Agent', description: 'Synthesizes all data to predict likely locations', type: 'ai' },
      { name: 'HUNTER Agent', description: 'OSINT specialist - finds digital footprints and associates', type: 'ai' },
      { name: 'COORDINATOR Agent', description: 'Orchestrates all agents and provides tactical recommendations', type: 'ai' },
      { name: 'Face Matching AI', description: 'Compares facial bone structure, not just pose/skin color', type: 'ai' },
    ],
  },
  {
    title: 'Photo Intelligence',
    icon: 'camera',
    items: [
      { name: 'Address Extraction', description: 'Identifies house numbers, street signs, mailbox addresses', type: 'tool' },
      { name: 'License Plate Detection', description: 'Reads partial/full plates, identifies state, suggests DMV lookup', type: 'tool' },
      { name: 'Business Recognition', description: 'Identifies store names, logos, chains to narrow location', type: 'tool' },
      { name: 'Geographic Analysis', description: 'Terrain, vegetation, architecture style for region identification', type: 'tool' },
      { name: 'Associate Detection', description: 'Identifies people in photos, clothing, distinguishing marks', type: 'tool' },
      { name: 'Reverse Image Search', description: 'Links to Google, Yandex, TinEye, PimEyes, FaceCheck.ID', type: 'tool' },
    ],
  },
  {
    title: 'Social Media Search',
    icon: 'share-social',
    items: [
      { name: 'Facebook', description: 'Profile and people search', type: 'api' },
      { name: 'Instagram', description: 'Username search with variations', type: 'api' },
      { name: 'TikTok', description: 'Profile search', type: 'api' },
      { name: 'Twitter/X', description: 'User search', type: 'api' },
      { name: 'LinkedIn', description: 'Professional profile search', type: 'api' },
      { name: 'Snapchat', description: 'Username lookup', type: 'api' },
      { name: 'Reddit', description: 'User search', type: 'api' },
      { name: 'GitHub', description: 'Developer profile search', type: 'api' },
    ],
  },
  {
    title: 'People Search Databases',
    icon: 'people',
    items: [
      { name: 'TruePeopleSearch', description: 'Free comprehensive people search', type: 'db' },
      { name: 'FastPeopleSearch', description: 'Quick people lookup', type: 'db' },
      { name: 'Whitepages', description: 'Phone and address directory', type: 'db' },
      { name: 'Spokeo', description: 'Aggregated people data', type: 'db' },
      { name: "That's Them", description: 'People finder service', type: 'db' },
      { name: 'PeekYou', description: 'Social profile aggregator', type: 'db' },
      { name: 'ZabaSearch', description: 'Free people search', type: 'db' },
      { name: 'Radaris', description: 'Background check data', type: 'db' },
      { name: 'BeenVerified', description: 'Comprehensive background', type: 'db' },
      { name: 'Intelius', description: 'People intelligence', type: 'db' },
    ],
  },
  {
    title: 'Court & Criminal Records',
    icon: 'document-text',
    items: [
      { name: 'CourtListener', description: 'Federal court records and opinions', type: 'db' },
      { name: 'PACER', description: 'Federal court filings', type: 'db' },
      { name: 'UniCourt', description: 'Court case search', type: 'db' },
      { name: 'Docket Alarm', description: 'Legal docket search', type: 'db' },
      { name: 'JailBase', description: 'Jail booking records', type: 'db' },
      { name: 'BustedNewspaper', description: 'Arrest news and mugshots', type: 'db' },
      { name: 'VINELink', description: 'Offender custody status', type: 'db' },
      { name: 'NSOPW', description: 'National sex offender registry', type: 'db' },
    ],
  },
  {
    title: 'Property & Business Records',
    icon: 'business',
    items: [
      { name: 'County Assessor Search', description: 'Property ownership records', type: 'db' },
      { name: 'Zillow', description: 'Real estate records', type: 'db' },
      { name: 'Redfin', description: 'Property sales history', type: 'db' },
      { name: 'OpenCorporates', description: 'Corporate officer search', type: 'db' },
      { name: 'Corp Wiki', description: 'Business connections', type: 'db' },
      { name: 'Crunchbase', description: 'Startup and business profiles', type: 'db' },
    ],
  },
  {
    title: 'Fraud & Scam Research',
    icon: 'warning',
    items: [
      { name: 'Social Catfish', description: 'Scam and catfish detection', type: 'db' },
      { name: 'ScamDigger', description: 'Romance scam database', type: 'db' },
      { name: 'ScamWarners', description: 'Scam reports and alerts', type: 'db' },
      { name: 'RomanceScam', description: 'Romance fraud database', type: 'db' },
    ],
  },
  {
    title: 'Username OSINT',
    icon: 'at',
    items: [
      { name: 'WhatsMyName', description: 'Username search across 400+ sites', type: 'tool' },
      { name: 'Username Variations', description: 'Auto-generates common username patterns from name', type: 'tool' },
      { name: 'Platform Verification', description: 'Checks if profiles exist on 70+ platforms', type: 'api' },
      { name: 'Namechk', description: 'Username availability checker', type: 'tool' },
      { name: 'KnowEm', description: 'Brand username search', type: 'tool' },
    ],
  },
  {
    title: 'Phone Intelligence',
    icon: 'call',
    items: [
      { name: 'Area Code Database', description: 'Full US area code location mapping', type: 'db' },
      { name: 'Carrier Detection', description: 'Identifies phone carrier and line type', type: 'tool' },
      { name: 'VoIP Detection', description: 'Identifies burner/VoIP numbers', type: 'tool' },
      { name: 'TrueCaller Search', description: 'Caller ID and spam check', type: 'api' },
      { name: 'Whitepages Phone', description: 'Reverse phone lookup', type: 'db' },
      { name: 'NumLookup', description: 'Phone number intelligence', type: 'api' },
    ],
  },
  {
    title: 'Email Intelligence',
    icon: 'mail',
    items: [
      { name: 'Email Analysis', description: 'Extracts provider, domain type, possible real name', type: 'tool' },
      { name: 'Disposable Detection', description: 'Identifies temporary/burner emails', type: 'tool' },
      { name: 'Gravatar Check', description: 'Finds profile photo from email hash', type: 'api' },
      { name: 'Service Registration', description: 'Checks registration on Twitter, Spotify, Discord, etc.', type: 'api' },
      { name: 'Business Email Detection', description: 'Identifies corporate vs personal emails', type: 'tool' },
    ],
  },
  {
    title: 'Genealogy & Historical',
    icon: 'git-network',
    items: [
      { name: 'FamilySearch', description: 'Family history records', type: 'db' },
      { name: 'Ancestry', description: 'Ancestry and genealogy records', type: 'db' },
      { name: 'FindAGrave', description: 'Cemetery and memorial records', type: 'db' },
      { name: 'Newspapers.com', description: 'Historical newspaper archives', type: 'db' },
      { name: 'Archive.org', description: 'Internet archive and wayback machine', type: 'db' },
    ],
  },
  {
    title: 'Data Storage & Sync',
    icon: 'cloud',
    items: [
      { name: 'Firebase Firestore', description: 'Real-time cloud database for case sync', type: 'db' },
      { name: 'SQLite (Native)', description: 'Local encrypted storage for mobile apps', type: 'db' },
      { name: 'AsyncStorage (Web)', description: 'Browser local storage for web app', type: 'db' },
      { name: 'Auto-Sync', description: 'All changes automatically sync to cloud', type: 'tool' },
      { name: 'Multi-Device', description: 'Access cases from any device with same account', type: 'tool' },
    ],
  },
  {
    title: 'Security Features',
    icon: 'shield-checkmark',
    items: [
      { name: 'Passcode Lock', description: '4-8 digit passcode protection', type: 'tool' },
      { name: 'Biometric Auth', description: 'Face ID and Touch ID support', type: 'tool' },
      { name: 'Auto-Delete', description: 'Configurable automatic case deletion', type: 'tool' },
      { name: 'Audit Log', description: 'Complete activity tracking', type: 'tool' },
      { name: 'Field Masking', description: 'Sensitive data hidden by default', type: 'tool' },
    ],
  },
];

const PYTHON_TOOLS_LIVE = [
  { name: 'Sherlock', description: 'Username hunting across 400+ sites', status: 'live' },
  { name: 'Maigret', description: 'Comprehensive username search', status: 'live' },
  { name: 'holehe', description: 'Email to registered accounts', status: 'live' },
  { name: 'socialscan', description: 'Email/username availability', status: 'live' },
  { name: 'Intelligent Investigation', description: 'Smart flow: name → usernames → profiles', status: 'live' },
  { name: 'Multi-Username Search', description: 'Searches username variations automatically', status: 'live' },
  { name: 'phoneinfoga', description: 'Advanced phone OSINT', status: 'planned' },
  { name: 'GHunt', description: 'Google account investigation', status: 'planned' },
];

const BACKEND_INFO = {
  url: 'https://elite-recovery-osint.onrender.com',
  version: '1.1.0',
  endpoints: [
    '/api/sherlock - Username search (400+ sites)',
    '/api/maigret - Comprehensive username search',
    '/api/holehe - Email account discovery',
    '/api/socialscan - Quick availability check',
    '/api/investigate - Intelligent person investigation',
    '/api/multi-username - Multi-username variation search',
    '/api/sweep - Full OSINT sweep',
    '/api/ai/chat - AI chat (OpenAI proxy)',
    '/api/ai/analyze - Image analysis',
    '/api/ai/brief - Recovery brief generation',
  ]
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
            <Ionicons name="locate" size={40} color={COLORS.primary} />
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
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>AI Agents</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>70+</Text>
            <Text style={styles.statLabel}>Platforms</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>40+</Text>
            <Text style={styles.statLabel}>Databases</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>400+</Text>
            <Text style={styles.statLabel}>Username Sites</Text>
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

        {/* Python OSINT Backend - LIVE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="logo-python" size={20} color="#3776ab" />
            <Text style={styles.sectionTitle}>Python OSINT Backend</Text>
            <View style={[styles.typeBadge, { backgroundColor: '#22c55e30', marginLeft: 8 }]}>
              <Text style={[styles.typeText, { color: '#22c55e' }]}>LIVE</Text>
            </View>
          </View>

          {/* Backend Status */}
          <View style={[styles.item, { borderLeftColor: '#22c55e', marginBottom: 12 }]}>
            <Text style={styles.itemName}>Backend: {BACKEND_INFO.url}</Text>
            <Text style={styles.itemDesc}>Version {BACKEND_INFO.version} - All tools installed and running</Text>
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
            onPress={() => Linking.openURL('mailto:support@eliterecovery.la')}
          >
            <Ionicons name="mail" size={16} color={COLORS.primary} />
            <Text style={styles.supportLinkText}>support@eliterecovery.la</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Elite Recovery LA - For authorized law enforcement and licensed bail recovery use only.
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
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
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
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 10,
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
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemList: {
    gap: 8,
  },
  item: {
    backgroundColor: COLORS.surface,
    padding: 12,
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
    fontSize: 14,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
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
