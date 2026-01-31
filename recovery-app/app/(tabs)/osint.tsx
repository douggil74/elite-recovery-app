/**
 * OSINT Search - Unified "Find This Person" tool
 * Single form, one button fires all relevant tools based on inputs
 */
import { useState, useCallback, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';
import { useSettings } from '@/hooks/useSettings';
import { useAppLock } from '@/contexts/AppLockContext';
import {
  searchHolehe,
  searchCourtRecords,
  searchCriminalHistory,
  investigatePerson,
  getBackgroundCheckLinks,
  searchGoogleDorks,
  searchSherlock,
  searchIgnorant,
  getVehicleSearchLinks,
  checkOSINTHealth,
  type HoleheResult,
  type CourtRecordResult,
  type ArrestsSearchResult,
  type InvestigateResult,
  type BackgroundCheckLinks,
  type GoogleDorkResult,
  type SherlockResult,
  type IgnorantResult,
  type VehicleSearchLinks,
  type HealthCheckResult,
} from '@/lib/osint-service';

// Load Black Ops One font for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap';
  link.rel = 'stylesheet';
  if (!document.head.querySelector('link[href*="Black+Ops+One"]')) {
    document.head.appendChild(link);
  }
}

const OSINT_API = 'https://elite-recovery-osint.fly.dev';

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

type ToolStatus = 'idle' | 'running' | 'done' | 'error';

// State-specific portal data for records lookups
const STATE_DATA: Record<string, {
  name: string;
  voter: string;
  property: string;
  sos: string;
  court: string;
  doc: string;
}> = {
  AL: {
    name: 'Alabama',
    voter: 'https://myinfo.alabamavotes.gov/voterview',
    property: 'https://www.google.com/search?q=Alabama+county+property+tax+records+search',
    sos: 'https://arc-sos.state.al.us/cgi/corpdetl.mbr/input',
    court: 'https://v2.alacourt.com/',
    doc: 'https://doc.state.al.us/InmateSearch',
  },
  AZ: {
    name: 'Arizona',
    voter: 'https://voter.azsos.gov/VoterView/RegistrantSearch.do',
    property: 'https://mcassessor.maricopa.gov/',
    sos: 'https://ecorp.azcc.gov/EntitySearch/Index',
    court: 'https://www.azcourts.gov/records',
    doc: 'https://corrections.az.gov/inmate-search',
  },
  CA: {
    name: 'California',
    voter: 'https://voterstatus.sos.ca.gov/',
    property: 'https://www.google.com/search?q=California+county+assessor+property+search',
    sos: 'https://bizfileonline.sos.ca.gov/search/business',
    court: 'https://www.courts.ca.gov/find-my-court.htm',
    doc: 'https://inmatelocator.cdcr.ca.gov/',
  },
  FL: {
    name: 'Florida',
    voter: 'https://registration.elections.myflorida.com/CheckVoterStatus',
    property: 'https://www.google.com/search?q=Florida+county+property+appraiser+search',
    sos: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByName',
    court: 'https://www.myflcourtaccess.com/',
    doc: 'http://www.dc.state.fl.us/offendersearch/',
  },
  GA: {
    name: 'Georgia',
    voter: 'https://mvp.sos.ga.gov/s/',
    property: 'https://www.google.com/search?q=Georgia+county+tax+assessor+property+search',
    sos: 'https://ecorp.sos.ga.gov/BusinessSearch',
    court: 'https://www.google.com/search?q=Georgia+court+case+search',
    doc: 'http://www.dcor.state.ga.us/GDC/OffenderQuery/jsp/OffQryForm.jsp',
  },
  IL: {
    name: 'Illinois',
    voter: 'https://ova.elections.il.gov/RegistrationLookup.aspx',
    property: 'https://www.google.com/search?q=Illinois+county+assessor+property+search',
    sos: 'https://www.ilsos.gov/corporatellc/',
    court: 'https://www.judici.com/',
    doc: 'https://www.idoc.state.il.us/subsections/search/inms_print.asp',
  },
  LA: {
    name: 'Louisiana',
    voter: 'https://voterportal.sos.la.gov/Home/VoterLogin',
    property: 'https://www.google.com/search?q=Louisiana+parish+assessor+property+search',
    sos: 'https://coraweb.sos.la.gov/commercialsearch/CommercialSearch.aspx',
    court: 'https://www.lasc.org/court_records',
    doc: 'https://doc.louisiana.gov/imprisoned-people-in-our-custody/offender-locator/',
  },
  MS: {
    name: 'Mississippi',
    voter: 'https://www.msegov.com/sos/voter_registration/AmIRegistered',
    property: 'https://www.google.com/search?q=Mississippi+county+property+tax+records+search',
    sos: 'https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx',
    court: 'https://courts.ms.gov/',
    doc: 'https://www.mdoc.ms.gov/inmate-information/inmate-search',
  },
  NC: {
    name: 'North Carolina',
    voter: 'https://vt.ncsbe.gov/RegLkup/',
    property: 'https://www.google.com/search?q=North+Carolina+county+property+tax+records',
    sos: 'https://www.sosnc.gov/online_services/search/by_title/_Business_Registration',
    court: 'https://www.nccourts.gov/court-dates',
    doc: 'https://webapps.doc.state.nc.us/opi/offendersearch.do?method=view',
  },
  NV: {
    name: 'Nevada',
    voter: 'https://www.nvsos.gov/votersearch/',
    property: 'https://www.google.com/search?q=Nevada+county+assessor+property+search',
    sos: 'https://esos.nv.gov/EntitySearch/OnlineEntitySearch',
    court: 'https://www.clarkcountycourts.us/Anonymous/',
    doc: 'https://ofdsearch.doc.nv.gov/',
  },
  NY: {
    name: 'New York',
    voter: 'https://voterlookup.elections.ny.gov/',
    property: 'https://www.google.com/search?q=New+York+county+property+records+search',
    sos: 'https://appext20.dos.ny.gov/corp_public/CORPSEARCH.ENTITY_SEARCH_ENTRY',
    court: 'https://iapps.courts.state.ny.us/webcivil/ecourtsMain',
    doc: 'http://nysdoccslookup.doccs.ny.gov/',
  },
  OH: {
    name: 'Ohio',
    voter: 'https://voterlookup.ohiosos.gov/voterlookup.aspx',
    property: 'https://www.google.com/search?q=Ohio+county+auditor+property+search',
    sos: 'https://businesssearch.ohiosos.gov/',
    court: 'https://www.supremecourt.ohio.gov/JCS/caseLookup/',
    doc: 'https://appgateway.drc.ohio.gov/OffenderSearch',
  },
  PA: {
    name: 'Pennsylvania',
    voter: 'https://www.pavoterservices.pa.gov/pages/voterregistrationstatus.aspx',
    property: 'https://www.google.com/search?q=Pennsylvania+county+property+tax+records',
    sos: 'https://www.corporations.pa.gov/search/corpsearch',
    court: 'https://ujsportal.pacourts.us/CaseSearch',
    doc: 'https://inmatelocator.cor.pa.gov/',
  },
  TN: {
    name: 'Tennessee',
    voter: 'https://tnmap.tn.gov/voterlookup/',
    property: 'https://www.google.com/search?q=Tennessee+county+property+assessor+search',
    sos: 'https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx',
    court: 'https://www.tncourts.gov/courts/court-clerk-offices',
    doc: 'https://apps.tn.gov/foil/search.jsp',
  },
  TX: {
    name: 'Texas',
    voter: 'https://teamrv-mvp.sos.texas.gov/MVP/mvp.do',
    property: 'https://www.google.com/search?q=Texas+county+appraisal+district+property+search',
    sos: 'https://mycpa.cpa.state.tx.us/coa/',
    court: 'https://card.txcourts.gov/case',
    doc: 'https://offender.tdcj.texas.gov/OffenderSearch/',
  },
};

interface ToolState {
  status: ToolStatus;
  error?: string;
}

// Time formatting for history
const formatTimeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

const SEARCH_HISTORY_KEY_PREFIX = 'osint_search_history';
const MAX_HISTORY = 5;

interface SearchHistoryEntry {
  name: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  timestamp: number;
}

// Tool label map for status chips
const TOOL_LABELS: Record<string, string> = {
  holehe: 'Holehe',
  phoneLookup: 'Phone Intel',
  investigate: 'Investigate',
  courtRecords: 'Courts',
  arrests: 'Arrests',
  backgroundLinks: 'Background',
  googleDorks: 'Google Dorks',
  googleLookup: 'Google Lookup',
  nameDorks: 'Name Dorks',
  emailDorks: 'Email Dorks',
  phoneDorks: 'Phone Dorks',
  sherlock: 'Sherlock',
  ignorant: 'Msg Apps',
  vehicleSearch: 'Vehicle',
};

export default function OSINTScreen() {
  const { settings } = useSettings();

  // Active user from app-level code lock
  const { activeUser } = useAppLock();

  const getHistoryKey = (user: string) => `${SEARCH_HISTORY_KEY_PREFIX}_${user}`;

  // Input fields
  const [nameQuery, setNameQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [selectedState, setSelectedState] = useState('LA');
  const [showStatePicker, setShowStatePicker] = useState(false);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // Tool status tracking
  const [toolStates, setToolStates] = useState<Record<string, ToolState>>({});

  // Result states
  const [holeheResult, setHoleheResult] = useState<HoleheResult | null>(null);
  const [phoneResult, setPhoneResult] = useState<any>(null);
  const [investigateResult, setInvestigateResult] = useState<InvestigateResult | null>(null);
  const [courtResult, setCourtResult] = useState<CourtRecordResult | null>(null);
  const [arrestsResult, setArrestsResult] = useState<ArrestsSearchResult | null>(null);
  const [backgroundResult, setBackgroundResult] = useState<BackgroundCheckLinks | null>(null);
  const [dorksResult, setDorksResult] = useState<GoogleDorkResult | null>(null);
  const [googleLookupResult, setGoogleLookupResult] = useState<any>(null);
  const [sherlockResult, setSherlockResult] = useState<SherlockResult | null>(null);
  const [ignorantResult, setIgnorantResult] = useState<IgnorantResult | null>(null);
  const [vehicleResult, setVehicleResult] = useState<VehicleSearchLinks | null>(null);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);

  // Standalone search inputs
  const [usernameQuery, setUsernameQuery] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');

  // Search history
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    if (!activeUser) return;
    const key = getHistoryKey(activeUser);
    AsyncStorage.getItem(key).then(raw => {
      if (raw) {
        try { setSearchHistory(JSON.parse(raw)); } catch {}
      } else {
        setSearchHistory([]);
      }
    });
  }, [activeUser]);

  const saveToHistory = useCallback(async (entry: SearchHistoryEntry) => {
    if (!activeUser) return;
    const key = getHistoryKey(activeUser);
    setSearchHistory(prev => {
      // Dedupe by matching all fields (not timestamp)
      const deduped = prev.filter(h =>
        h.name !== entry.name || h.email !== entry.email || h.phone !== entry.phone || h.address !== entry.address,
      );
      const next = [entry, ...deduped].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [activeUser]);

  const loadFromHistory = (entry: SearchHistoryEntry) => {
    clearAll();
    setNameQuery(entry.name);
    setEmailQuery(entry.email);
    setPhoneQuery(entry.phone);
    setAddressQuery(entry.address);
    setSelectedState(entry.state);
  };

  const clearHistory = async () => {
    if (!activeUser) return;
    setSearchHistory([]);
    await AsyncStorage.removeItem(getHistoryKey(activeUser));
  };

  // Section collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateTool = (tool: string, state: Partial<ToolState>) => {
    setToolStates(prev => ({ ...prev, [tool]: { ...prev[tool], ...state } as ToolState }));
  };

  const clearResults = () => {
    setHoleheResult(null);
    setPhoneResult(null);
    setInvestigateResult(null);
    setCourtResult(null);
    setArrestsResult(null);
    setBackgroundResult(null);
    setDorksResult(null);
    setGoogleLookupResult(null);
    setSherlockResult(null);
    setIgnorantResult(null);
    setVehicleResult(null);
    setToolStates({});
    setCollapsed({});
  };

  const clearAll = () => {
    clearResults();
    setNameQuery('');
    setEmailQuery('');
    setPhoneQuery('');
    setAddressQuery('');
    setSelectedState('LA');
    setHasSearched(false);
    setHealthResult(null);
  };

  const buildReport = (): string => {
    const name = normalizeName(nameQuery.trim());
    const email = emailQuery.trim();
    const phone = phoneQuery.trim();
    const address = addressQuery.trim();
    const state = selectedState ? STATE_DATA[selectedState]?.name || selectedState : '';
    const lines: string[] = [];
    const divider = '─'.repeat(60);

    lines.push('OSINT REPORT');
    lines.push(divider);
    if (name) lines.push(`Subject: ${name}`);
    if (state) lines.push(`State: ${state}`);
    if (email) lines.push(`Email: ${email}`);
    if (phone) lines.push(`Phone: ${phone}`);
    if (address) lines.push(`Address: ${address}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    // Summary
    const summary = buildSummary();
    if (summary) {
      lines.push(summary);
      lines.push('');
    }

    // Arrests
    if (arrestsResult) {
      lines.push(divider);
      lines.push('ARREST RECORDS');
      lines.push(divider);
      if (arrestsResult.fta_count > 0) {
        lines.push(`WARNING: ${arrestsResult.fta_count} FTA(s), ${arrestsResult.warrant_count} Warrant(s)`);
      }
      if (arrestsResult.arrests_found?.length) {
        for (const a of arrestsResult.arrests_found) {
          lines.push(`  ${a.name}${a.age ? ` (${a.age})` : ''}`);
          lines.push(`    Date: ${a.booking_date || 'Unknown'}`);
          lines.push(`    Charges: ${a.charges?.join(', ') || 'None listed'}`);
          if (a.parish) lines.push(`    Parish: ${a.parish}`);
          if (a.details_url) lines.push(`    Link: ${a.details_url}`);
          lines.push('');
        }
      } else {
        lines.push('  No arrest records found');
        lines.push('');
      }
    }

    // Court Records
    if (courtResult) {
      lines.push(divider);
      lines.push('COURT RECORDS');
      lines.push(divider);
      if (courtResult.cases_found?.length) {
        for (const c of courtResult.cases_found) {
          lines.push(`  ${c.case_name}`);
          lines.push(`    Court: ${c.court} | Filed: ${c.date_filed} | Docket: ${c.docket_number}`);
          if (c.url) lines.push(`    Link: ${c.url}`);
          lines.push('');
        }
      } else {
        lines.push('  No court records found');
        lines.push('');
      }
    }

    // Phone
    if (phoneResult) {
      lines.push(divider);
      lines.push('PHONE INTELLIGENCE');
      lines.push(divider);
      if (phoneResult.line_type) {
        lines.push(`  Type: ${phoneResult.line_type}`);
        if (phoneResult.carrier) lines.push(`  Carrier: ${phoneResult.carrier}`);
        if (phoneResult.active !== null && phoneResult.active !== undefined) {
          lines.push(`  Status: ${phoneResult.active ? 'Active' : 'Inactive'}`);
        }
        if (phoneResult.phone_city || phoneResult.phone_state) {
          lines.push(`  Location: ${[phoneResult.phone_city, phoneResult.phone_state].filter(Boolean).join(', ')}`);
        }
        if (phoneResult.prepaid) lines.push('  Prepaid: Yes');
        if (phoneResult.name) lines.push(`  Registered To: ${phoneResult.name}`);
        if (phoneResult.fraud_score != null && phoneResult.fraud_score > 50) {
          lines.push(`  Fraud Score: ${phoneResult.fraud_score}/100`);
        }
        if (phoneResult.spammer) lines.push('  Known Spammer: Yes');
      }
      if (phoneResult.accounts_found?.length) {
        lines.push('  Linked Accounts:');
        for (const a of phoneResult.accounts_found) {
          lines.push(`    - ${a.platform}${a.url ? ` (${a.url})` : ''}`);
        }
      }
      if (ignorantResult?.accounts_found?.length) {
        lines.push('  Messaging Apps (Ignorant):');
        for (const a of ignorantResult.accounts_found) {
          lines.push(`    - ${a.platform}: ${a.status}`);
        }
      }
      lines.push('');
    }

    // Social / Digital Profiles
    if (investigateResult || holeheResult || googleLookupResult) {
      lines.push(divider);
      lines.push('SOCIAL & DIGITAL PROFILES');
      lines.push(divider);
      if (investigateResult?.confirmed_profiles?.length) {
        lines.push('  Confirmed Profiles:');
        for (const p of investigateResult.confirmed_profiles) {
          lines.push(`    - ${p.platform}${p.username ? ` (@${p.username})` : ''}${p.url ? ` - ${p.url}` : ''}`);
        }
      }
      if (investigateResult?.discovered_emails?.length) {
        lines.push('  Discovered Emails:');
        for (const e of investigateResult.discovered_emails) {
          lines.push(`    - ${e}`);
        }
      }
      if (investigateResult?.summary) {
        lines.push(`  Summary: ${investigateResult.summary}`);
      }
      if (holeheResult?.registered_on?.length) {
        lines.push('  Email Registrations (Holehe):');
        for (const item of holeheResult.registered_on) {
          lines.push(`    - ${item.service}${item.details ? ` (${item.details})` : ''}`);
        }
      }
      if (googleLookupResult?.intel) {
        if (googleLookupResult.intel.google_account_exists) {
          lines.push('  Google Account: Exists');
        }
        if (googleLookupResult.intel.services_found?.length) {
          for (const svc of googleLookupResult.intel.services_found) {
            lines.push(`    - Google: ${svc.service}${svc.url ? ` (${svc.url})` : ''}`);
          }
        }
      }
      lines.push('');
    }

    // Sherlock
    if (sherlockResult?.found?.length) {
      lines.push(divider);
      lines.push(`USERNAME SEARCH - SHERLOCK (${sherlockResult.found.length} found)`);
      lines.push(divider);
      for (const item of sherlockResult.found) {
        lines.push(`  ${item.platform}: ${item.url}`);
      }
      lines.push('');
    }

    // Vehicle
    if (vehicleResult?.search_links?.length) {
      lines.push(divider);
      lines.push('VEHICLE SEARCH LINKS');
      lines.push(divider);
      for (const link of vehicleResult.search_links) {
        lines.push(`  ${link.name}: ${link.url}`);
      }
      lines.push('');
    }

    // People Search Links
    if (backgroundResult?.links) {
      lines.push(divider);
      lines.push('PEOPLE SEARCH LINKS');
      lines.push(divider);
      for (const [category, items] of Object.entries(backgroundResult.links)) {
        lines.push(`  ${category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:`);
        for (const item of items as any[]) {
          lines.push(`    - ${item.name}: ${item.url}`);
        }
      }
      lines.push('');
    }

    // Google Dorks
    if (dorksResult?.dorks?.length) {
      lines.push(divider);
      lines.push(`GOOGLE DORKS (${dorksResult.dorks.length})`);
      lines.push(divider);
      for (const dork of dorksResult.dorks) {
        lines.push(`  [${dork.category}] ${dork.dork}`);
        lines.push(`    ${dork.google_url}`);
      }
      lines.push('');
    }

    // Tool status
    const errors = activeTools.filter(k => toolStates[k].status === 'error');
    if (errors.length) {
      lines.push(divider);
      lines.push('TOOL ERRORS');
      lines.push(divider);
      for (const tool of errors) {
        lines.push(`  ${TOOL_LABELS[tool] || tool}: ${toolStates[tool].error}`);
      }
      lines.push('');
    }

    lines.push(divider);
    lines.push('End of Report');

    return lines.join('\n');
  };

  const exportReport = async () => {
    const report = buildReport();
    const namePart = normalizeName(nameQuery.trim()).replace(/\s+/g, '_') || phoneQuery.trim().replace(/\D/g, '') || emailQuery.trim().split('@')[0] || 'search';
    const filename = `OSINT_${namePart}_${new Date().toISOString().slice(0, 10)}.txt`;

    if (Platform.OS === 'web') {
      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      try {
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, report);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Export OSINT Report' });
        }
      } catch {
        // Fallback: copy to clipboard
        copyToClipboard(report);
      }
    }
  };

  const openUrl = (url: string, copyQuery?: string) => {
    if (copyQuery && Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(copyQuery);
    }
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const hasAnyInput = nameQuery.trim() || emailQuery.trim() || phoneQuery.trim() || addressQuery.trim();

  const handleSearch = useCallback(async () => {
    const name = nameQuery.trim();
    const email = emailQuery.trim();
    const phone = phoneQuery.trim();
    const address = addressQuery.trim();
    if (!name && !email && !phone && !address) return;

    clearResults();
    setIsSearching(true);
    setHasSearched(true);

    // Save to history
    saveToHistory({ name, email, phone, address, state: selectedState, timestamp: Date.now() });

    // Set default collapsed states - custody/arrests/courts/phone expanded, rest collapsed
    setCollapsed({
      addresses: true,
      vehicle: true,
      social: true,
      peopleSearch: true,
      publicRecords: true,
      dorks: true,
      tips: true,
    });

    const promises: Promise<void>[] = [];

    const runTool = async <T,>(
      toolKey: string,
      fn: () => Promise<T>,
      onSuccess: (data: T) => void,
    ) => {
      updateTool(toolKey, { status: 'running' });
      try {
        const result = await fn();
        onSuccess(result);
        updateTool(toolKey, { status: 'done' });
      } catch (e: any) {
        updateTool(toolKey, { status: 'error', error: e.message || 'Failed' });
      }
    };

    const normalized = name ? normalizeName(name) : '';

    // Collect all dork results for merging after completion
    const dorkResults: GoogleDorkResult[] = [];

    // Name-based tools only fire when name is provided
    if (normalized) {
      promises.push(
        runTool('investigate', () => investigatePerson(normalized), setInvestigateResult),
        runTool('courtRecords', () => searchCourtRecords(normalized), setCourtResult),
        runTool('arrests', () => searchCriminalHistory(normalized), setArrestsResult),
        runTool('backgroundLinks', () => getBackgroundCheckLinks(normalized), setBackgroundResult),
      );

      promises.push(
        runTool('nameDorks', async () => {
          const result = await searchGoogleDorks(normalized, 'name');
          dorkResults.push(result);
          return result;
        }, () => {}),
      );
    }

    // Email-based tools
    if (email) {
      promises.push(
        runTool('holehe', () => searchHolehe(email), setHoleheResult),
        runTool('googleLookup', async () => {
          const res = await fetch(`${OSINT_API}/api/google-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          if (!res.ok) throw new Error(`Google lookup: ${res.statusText}`);
          return res.json();
        }, setGoogleLookupResult),
        runTool('emailDorks', async () => {
          const result = await searchGoogleDorks(email, 'email');
          dorkResults.push(result);
          return result;
        }, () => {}),
      );
    }

    // Phone-based tools
    if (phone) {
      promises.push(
        runTool('phoneLookup', async () => {
          const res = await fetch(`${OSINT_API}/api/phone-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          if (!res.ok) throw new Error(`Phone lookup: ${res.statusText}`);
          return res.json();
        }, setPhoneResult),
        runTool('ignorant', () => searchIgnorant(phone), setIgnorantResult),
        runTool('phoneDorks', async () => {
          const result = await searchGoogleDorks(phone, 'phone');
          dorkResults.push(result);
          return result;
        }, () => {}),
      );
    }

    await Promise.allSettled(promises);

    // Merge all dork results after everything completes
    if (dorkResults.length > 0) {
      const allDorks: GoogleDorkResult['dorks'] = [];
      const seenUrls = new Set<string>();
      for (const dr of dorkResults) {
        for (const d of (dr.dorks || [])) {
          if (!seenUrls.has(d.google_url)) {
            seenUrls.add(d.google_url);
            allDorks.push(d);
          }
        }
      }
      setDorksResult({ dorks: allDorks, query: normalized, type: 'combined', state: '', searched_at: new Date().toISOString(), total: allDorks.length });
    }

    setIsSearching(false);
  }, [nameQuery, emailQuery, phoneQuery, addressQuery]);

  const checkHealth = useCallback(async () => {
    try {
      const result = await checkOSINTHealth();
      setHealthResult(result);
    } catch {
      setHealthResult(null);
    }
  }, []);

  // Count active tools
  const activeTools = Object.keys(toolStates);
  const runningCount = activeTools.filter(k => toolStates[k].status === 'running').length;
  const errorCount = activeTools.filter(k => toolStates[k].status === 'error').length;

  // Build progress summary
  const buildSummary = (): string | null => {
    if (!hasSearched || isSearching) return null;
    const parts: string[] = [];
    if (arrestsResult?.arrests_found?.length) {
      parts.push(`${arrestsResult.arrests_found.length} arrest${arrestsResult.arrests_found.length !== 1 ? 's' : ''}`);
    }
    if (courtResult?.cases_found?.length) {
      parts.push(`${courtResult.cases_found.length} court case${courtResult.cases_found.length !== 1 ? 's' : ''}`);
    }
    if (phoneResult?.line_type) {
      parts.push(`phone ${phoneResult.active ? 'active' : 'inactive'} (${phoneResult.line_type})`);
    }
    const socialCount = (investigateResult?.confirmed_profiles?.length || 0) +
      (holeheResult?.registered_on?.length || 0) +
      (sherlockResult?.found?.length || 0);
    if (socialCount > 0) {
      parts.push(`${socialCount} social profile${socialCount !== 1 ? 's' : ''}`);
    }
    const msgAppCount = ignorantResult?.accounts_found?.filter(a => a.status === 'found' || a.status === 'possible').length || 0;
    if (msgAppCount > 0) {
      parts.push(`${msgAppCount} messaging app${msgAppCount !== 1 ? 's' : ''}`);
    }
    if (parts.length === 0) return 'Search complete - check static portal links below';
    return `Found: ${parts.join(', ')}`;
  };

  const normalized = normalizeName(nameQuery.trim());
  const stateInfo = selectedState ? STATE_DATA[selectedState] : null;

  // Render a collapsible section
  const renderSection = (
    key: string,
    title: string,
    icon: string,
    count: number | null,
    color: string,
    children: React.ReactNode,
  ) => {
    const isCollapsed = collapsed[key];
    return (
      <View key={key} style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(key)}>
          <Ionicons name={icon as any} size={18} color={color} />
          <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
          {count !== null && (
            <View style={[styles.countBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.countText, { color }]}>{count}</Text>
            </View>
          )}
          <Ionicons
            name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
            size={16}
            color={THEME.textMuted}
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>
        {!isCollapsed && <View style={styles.sectionBody}>{children}</View>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ============= INPUT FORM ============= */}
        <View style={styles.formSection}>
          {/* Name (required) */}
          <View style={styles.inputRow}>
            <Ionicons name="person" size={18} color={THEME.textMuted} />
            <TextInput
              style={styles.formInput}
              value={nameQuery}
              onChangeText={setNameQuery}
              placeholder="Full Name"
              placeholderTextColor={THEME.textMuted}
              autoCapitalize="words"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>

          {/* State Selector */}
          <View style={styles.inputRow}>
            <Ionicons name="flag" size={18} color={selectedState ? THEME.primary : THEME.textMuted} />
            <TouchableOpacity
              style={styles.stateDropdown}
              onPress={() => setShowStatePicker(!showStatePicker)}
            >
              <Text style={[styles.stateDropdownText, selectedState && { color: THEME.primary }]}>
                {selectedState ? `${STATE_DATA[selectedState]?.name || selectedState}` : 'Select State'}
              </Text>
              <Ionicons name={showStatePicker ? 'chevron-up' : 'chevron-down'} size={14} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>
          {showStatePicker && (
            <View style={styles.statePickerGrid}>
              {Object.entries(STATE_DATA).map(([code]) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.stateChip, selectedState === code && styles.stateChipActive]}
                  onPress={() => { setSelectedState(code); setShowStatePicker(false); }}
                >
                  <Text style={[styles.stateChipText, selectedState === code && styles.stateChipTextActive]}>{code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Email (optional) */}
          <View style={styles.inputRow}>
            <Ionicons name="mail" size={18} color={emailQuery.trim() ? THEME.info : THEME.textMuted} />
            <TextInput
              style={styles.formInput}
              value={emailQuery}
              onChangeText={setEmailQuery}
              placeholder="Email"
              placeholderTextColor={THEME.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>

          {/* Phone (optional) */}
          <View style={styles.inputRow}>
            <Ionicons name="call" size={18} color={phoneQuery.trim() ? THEME.warning : THEME.textMuted} />
            <TextInput
              style={styles.formInput}
              value={phoneQuery}
              onChangeText={setPhoneQuery}
              placeholder="Phone"
              placeholderTextColor={THEME.textMuted}
              keyboardType="phone-pad"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>

          {/* Address (optional) */}
          <View style={styles.inputRow}>
            <Ionicons name="location" size={18} color={addressQuery.trim() ? THEME.success : THEME.textMuted} />
            <TextInput
              style={styles.formInput}
              value={addressQuery}
              onChangeText={setAddressQuery}
              placeholder="Known Address"
              placeholderTextColor={THEME.textMuted}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Search + Clear Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.searchBtn, (!hasAnyInput || isSearching) && styles.btnDisabled]}
            onPress={handleSearch}
            disabled={!hasAnyInput || isSearching}
          >
            {isSearching ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.searchBtnText}>Searching ({runningCount} running)...</Text>
              </>
            ) : (
              <>
                <Ionicons name="search" size={20} color="#fff" />
                <Text style={styles.searchBtnText}>FIND THIS PERSON</Text>
              </>
            )}
          </TouchableOpacity>
          {(hasSearched || hasAnyInput) && !isSearching && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
              <Ionicons name="close-circle" size={20} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tool Status Bar */}
        {activeTools.length > 0 && (
          <View style={styles.toolStatusBar}>
            {activeTools.map(tool => {
              const state = toolStates[tool];
              const statusColor = state.status === 'running' ? THEME.warning :
                state.status === 'done' ? THEME.success :
                state.status === 'error' ? THEME.danger : THEME.textMuted;
              return (
                <View key={tool} style={[styles.toolChip, { borderColor: statusColor + '60' }]}>
                  {state.status === 'running' ? (
                    <ActivityIndicator size={10} color={statusColor} />
                  ) : (
                    <View style={[styles.toolDot, { backgroundColor: statusColor }]} />
                  )}
                  <Text style={[styles.toolChipText, { color: statusColor }]}>
                    {TOOL_LABELS[tool] || tool}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Progress Summary + Export */}
        {hasSearched && !isSearching && (() => {
          const summary = buildSummary();
          return summary ? (
            <View style={styles.summaryBar}>
              <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
              <Text style={styles.summaryText}>{summary}</Text>
              <TouchableOpacity style={styles.exportBtn} onPress={exportReport}>
                <Ionicons name="download-outline" size={16} color={THEME.info} />
                <Text style={styles.exportBtnText}>Report</Text>
              </TouchableOpacity>
            </View>
          ) : null;
        })()}

        {/* ============= RESULTS SECTIONS ============= */}

        {hasSearched && (() => {
          const q = normalized;
          const encoded = encodeURIComponent(q);
          const email = emailQuery.trim();
          const encodedEmail = encodeURIComponent(email);
          const address = addressQuery.trim();
          const encodedAddress = encodeURIComponent(address);

          return (
            <>
              {q ? (
                <View style={styles.clipboardHint}>
                  <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                  <Text style={styles.clipboardHintText}>Portal links auto-copy the search name to your clipboard for quick paste</Text>
                </View>
              ) : null}

              {/* 1. CUSTODY CHECK (only when name provided) */}
              {q ? renderSection('custody', 'Custody Check', 'lock-closed', null, '#f97316', (
                <View>
                  <TouchableOpacity style={styles.resultItem} onPress={() => openUrl('https://www.bop.gov/inmateloc/', q)}>
                    <Ionicons name="lock-closed" size={14} color={'#f97316'} />
                    <Text style={[styles.resultItemText, styles.linkText]}>Federal BOP Inmate Locator</Text>
                    <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                  </TouchableOpacity>
                  {stateInfo && (
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(stateInfo.doc, q)}>
                      <Ionicons name="person" size={14} color={'#f97316'} />
                      <Text style={[styles.resultItemText, styles.linkText]}>{stateInfo.name} DOC Inmate Search</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.resultItem} onPress={() => openUrl('https://www.vinelink.com/#/search', q)}>
                    <Ionicons name="notifications" size={14} color={'#f97316'} />
                    <Text style={[styles.resultItemText, styles.linkText]}>VINE Victim Notification</Text>
                    <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resultItem} onPress={() => openUrl('https://www.nsopw.gov/', q)}>
                    <Ionicons name="alert-circle" size={14} color={'#f97316'} />
                    <Text style={[styles.resultItemText, styles.linkText]}>NSOPW Sex Offender Registry</Text>
                    <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                  </TouchableOpacity>
                </View>
              )) : null}

              {/* 2. ARREST RECORDS (from searchCriminalHistory API) */}
              {arrestsResult && renderSection(
                'arrests', 'Arrest Records', 'alert-circle', arrestsResult.arrests_found?.length || 0, THEME.danger,
                <View>
                  {arrestsResult.fta_count > 0 && (
                    <View style={[styles.alertBanner, { backgroundColor: THEME.danger + '20' }]}>
                      <Ionicons name="warning" size={16} color={THEME.danger} />
                      <Text style={[styles.alertText, { color: THEME.danger }]}>
                        {arrestsResult.fta_count} FTA(s) found | {arrestsResult.warrant_count} Warrant(s)
                      </Text>
                    </View>
                  )}

                  {arrestsResult.arrests_found?.length > 0 ? (
                    arrestsResult.arrests_found.map((a, i) => (
                      <TouchableOpacity key={i} style={styles.resultItem} onPress={() => a.details_url && openUrl(a.details_url)}>
                        <Ionicons name="person" size={14} color={THEME.danger} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultItemText, a.details_url && styles.linkText]}>
                            {a.name} {a.age ? `(${a.age})` : ''}
                          </Text>
                          <Text style={styles.resultDetailText}>
                            {a.booking_date || 'Unknown date'} - {a.charges?.join(', ') || 'No charges listed'}
                          </Text>
                          {a.parish && <Text style={styles.resultDetailText}>Parish: {a.parish}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No arrest records found</Text>
                  )}
                  {arrestsResult.search_url && (
                    <TouchableOpacity style={styles.viewAllBtn} onPress={() => openUrl(arrestsResult.search_url)}>
                      <Text style={styles.viewAllText}>View on Arrests.org</Text>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                    </TouchableOpacity>
                  )}
                </View>,
              )}

              {/* 3. COURT RECORDS (from searchCourtRecords API) */}
              {courtResult && renderSection(
                'courts', 'Court Records', 'briefcase', courtResult.cases_found?.length || 0, THEME.danger,
                <View>
                  {courtResult.cases_found?.length > 0 ? (
                    courtResult.cases_found.map((c, i) => (
                      <TouchableOpacity key={i} style={styles.resultItem} onPress={() => c.url && openUrl(c.url)}>
                        <Ionicons name="document-text" size={14} color={THEME.danger} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.resultItemText, c.url && styles.linkText]} numberOfLines={1}>
                            {c.case_name}
                          </Text>
                          <Text style={styles.resultDetailText}>
                            {c.court} - {c.date_filed} - {c.docket_number}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No court records found</Text>
                  )}
                </View>,
              )}

              {/* 4. PHONE INTELLIGENCE (only if phone provided) */}
              {phoneResult && renderSection(
                'phone', 'Phone Intelligence', 'call', null, THEME.warning,
                <View>
                  {phoneResult.line_type && (
                    <View style={styles.phoneTypeSection}>
                      <View style={[styles.lineTypeBadge, {
                        backgroundColor: phoneResult.line_type === 'Wireless' ? THEME.success + '20' :
                          phoneResult.line_type === 'Landline' ? THEME.warning + '20' :
                          phoneResult.line_type === 'VOIP' ? '#f97316' + '20' : THEME.textMuted + '20',
                        borderColor: phoneResult.line_type === 'Wireless' ? THEME.success :
                          phoneResult.line_type === 'Landline' ? THEME.warning :
                          phoneResult.line_type === 'VOIP' ? '#f97316' : THEME.textMuted,
                      }]}>
                        <Ionicons
                          name={phoneResult.line_type === 'Wireless' ? 'phone-portrait' :
                            phoneResult.line_type === 'Landline' ? 'call' : 'globe'}
                          size={18}
                          color={phoneResult.line_type === 'Wireless' ? THEME.success :
                            phoneResult.line_type === 'Landline' ? THEME.warning :
                            phoneResult.line_type === 'VOIP' ? '#f97316' : THEME.textMuted}
                        />
                        <Text style={[styles.lineTypeText, {
                          color: phoneResult.line_type === 'Wireless' ? THEME.success :
                            phoneResult.line_type === 'Landline' ? THEME.warning :
                            phoneResult.line_type === 'VOIP' ? '#f97316' : THEME.textMuted,
                        }]}>
                          {phoneResult.line_type === 'Wireless' ? 'CELL PHONE' :
                           phoneResult.line_type === 'Landline' ? 'LANDLINE' :
                           phoneResult.line_type === 'VOIP' ? `VOIP${phoneResult.voip_provider ? ` - ${phoneResult.voip_provider}` : ''}` :
                           phoneResult.line_type.toUpperCase()}
                        </Text>
                        {phoneResult.active === true && <View style={styles.activeIndicator} />}
                      </View>

                      <View style={styles.phoneDetails}>
                        {phoneResult.carrier ? <Text style={styles.detailText}>Carrier: {phoneResult.carrier}</Text> : null}
                        {phoneResult.active !== null && phoneResult.active !== undefined ? (
                          <Text style={[styles.detailText, { color: phoneResult.active ? THEME.success : THEME.danger }]}>
                            {phoneResult.active ? 'Active' : 'Inactive'}
                          </Text>
                        ) : null}
                        {(phoneResult.phone_city || phoneResult.phone_state) ? (
                          <Text style={styles.detailText}>
                            Location: {[phoneResult.phone_city, phoneResult.phone_state].filter(Boolean).join(', ')}
                          </Text>
                        ) : null}
                        {phoneResult.prepaid === true && <Text style={[styles.detailText, { color: THEME.warning }]}>Prepaid</Text>}
                        {phoneResult.name ? <Text style={styles.detailText}>Registered: {phoneResult.name}</Text> : null}
                        {phoneResult.fraud_score != null && phoneResult.fraud_score > 50 && (
                          <Text style={[styles.detailText, { color: THEME.danger }]}>Fraud Score: {phoneResult.fraud_score}/100</Text>
                        )}
                        {phoneResult.spammer && <Text style={[styles.detailText, { color: THEME.danger }]}>Known Spammer</Text>}
                      </View>

                      {settings.googleVoiceNumber && (
                        <TouchableOpacity
                          style={styles.gvTextButton}
                          onPress={() => {
                            const cleanPhone = phoneQuery.replace(/\D/g, '');
                            openUrl(`https://voice.google.com/u/0/messages?itemId=t.+1${cleanPhone}`);
                          }}
                        >
                          <Ionicons name="chatbubble-ellipses" size={16} color="#f59e0b" />
                          <Text style={styles.gvTextBtnText}>GV Text</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {(phoneResult.accounts_found?.length > 0 || phoneResult.apps_to_check?.length > 0) && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Linked Accounts</Text>
                      {(phoneResult.accounts_found || []).map((item: any, i: number) => (
                        <TouchableOpacity key={`a-${i}`} style={styles.resultItem} onPress={() => item.url && openUrl(item.url)}>
                          <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
                          <Text style={[styles.resultItemText, item.url && styles.linkText]}>{item.platform}</Text>
                        </TouchableOpacity>
                      ))}
                      {(phoneResult.apps_to_check || []).map((item: any, i: number) => (
                        <View key={`c-${i}`} style={styles.resultItem}>
                          <Ionicons name="help-circle" size={14} color={THEME.textMuted} />
                          <Text style={styles.resultItemText}>{item.platform}</Text>
                          {item.note && <Text style={styles.resultDetailText}>{item.note}</Text>}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Crowdsourced phone lookups */}
                  <View style={styles.subSection}>
                    <Text style={styles.subLabel}>Crowdsourced Lookups</Text>
                    <TouchableOpacity style={styles.resultItem} onPress={() => { copyToClipboard(phoneQuery.trim()); openUrl('https://sync.me/'); }}>
                      <Ionicons name="people" size={14} color={THEME.warning} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Sync.me</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.truecaller.com/search/us/${phoneQuery.trim().replace(/\D/g, '')}`)}>
                      <Ionicons name="people" size={14} color={THEME.warning} />
                      <Text style={[styles.resultItemText, styles.linkText]}>TrueCaller</Text>
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => { copyToClipboard(phoneQuery.trim()); openUrl('https://www.spydialer.com/'); }}>
                      <Ionicons name="ear" size={14} color={THEME.warning} />
                      <Text style={[styles.resultItemText, styles.linkText]}>SpyDialer</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <Text style={styles.tipTextSmall}>Crowdsourced data comes from real contact lists - often more accurate than scraped data</Text>
                  </View>

                  {/* Ignorant - Messaging app detection */}
                  {ignorantResult && (ignorantResult.accounts_found?.length > 0 || (ignorantResult as any).apps_to_check?.length > 0) && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Messaging Apps</Text>
                      {(ignorantResult.accounts_found || []).map((item, i) => (
                        <TouchableOpacity key={`msg-${i}`} style={styles.resultItem} onPress={() => (item as any).url && openUrl((item as any).url)}>
                          <Ionicons
                            name={item.status === 'found' || item.status === 'possible' ? 'checkmark-circle' : 'close-circle'}
                            size={14}
                            color={item.status === 'found' || item.status === 'possible' ? THEME.success : THEME.textMuted}
                          />
                          <Text style={[styles.resultItemText, (item as any).url && styles.linkText]}>{item.platform}</Text>
                          {(item as any).url && <Ionicons name="open-outline" size={12} color={THEME.textMuted} />}
                        </TouchableOpacity>
                      ))}
                      {((ignorantResult as any).apps_to_check || []).map((item: any, i: number) => (
                        <View key={`chk-${i}`} style={styles.resultItem}>
                          <Ionicons name="help-circle" size={14} color={THEME.warning} />
                          <Text style={styles.resultItemText}>{item.platform}</Text>
                          {item.note && <Text style={styles.resultDetailText}>{item.note}</Text>}
                        </View>
                      ))}
                      <Text style={styles.tipTextSmall}>
                        If registered on WhatsApp or Telegram, check their profile picture and "last seen" for activity
                      </Text>
                    </View>
                  )}

                  {phoneResult.tip && <Text style={styles.tipText}>{phoneResult.tip}</Text>}
                </View>,
              )}

              {/* 5. ADDRESSES & PROPERTY (static links, enhanced if address provided) */}
              {(q || address) ? renderSection('addresses', 'Addresses & Property',
                'home', null, THEME.info,
                <View>
                  {address ? (
                    <>
                      <View style={styles.subSection}>
                        <Text style={styles.subLabel}>Surveillance & Mapping</Text>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.google.com/maps/@?api=1&map_action=pano&query=${encodedAddress}`)}>
                          <Ionicons name="eye" size={14} color={THEME.success} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Google Street View</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.google.com/maps/search/${encodedAddress}`)}>
                          <Ionicons name="map" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Google Maps</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://earth.google.com/web/search/${encodedAddress}`)}>
                          <Ionicons name="globe" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Google Earth</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.bing.com/maps?q=${encodedAddress}&style=x`)}>
                          <Ionicons name="map" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Bing Maps (alt street view)</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://maps.apple.com/?q=${encodedAddress}`)}>
                          <Ionicons name="navigate" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Apple Maps Look Around</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.subSection}>
                        <Text style={styles.subLabel}>Property Records</Text>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.zillow.com/homes/${encodedAddress.replace(/%20/g, '-')}_rb/`)}>
                          <Ionicons name="home" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Zillow</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.redfin.com/search?q=${encodedAddress}`)}>
                          <Ionicons name="home" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Redfin</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.melissa.com/v2/lookups/propertyviewer/zipcode/?expression=${encodedAddress}`)}>
                          <Ionicons name="business" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>Melissa Property Lookup</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}
                  {stateInfo && (
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(stateInfo.property, q || address)}>
                      <Ionicons name="document-text" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>{stateInfo.name} County Assessor</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  )}
                  {q ? (
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.google.com/search?q=${encoded}+property+records+owner+parcel`)}>
                      <Ionicons name="search" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Google: Property Owner Search</Text>
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                  {address ? (
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://web.archive.org/web/*/${encodedAddress}`)}>
                      <Ionicons name="time" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Wayback Machine (address history)</Text>
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.tipTextSmall}>Check historical Street View dates for vehicles and activity patterns. If blurred, try Bing or Apple Maps, or move down the street for an unblurred angle.</Text>
                </View>,
              ) : null}

              {/* 5b. VEHICLE SEARCH */}
              {q ? renderSection('vehicle', 'Vehicle Search', 'car-sport', vehicleResult?.search_links?.length || null, '#f97316',
                <View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultDetailText, { marginBottom: 4 }]}>License Plate</Text>
                      <TextInput
                        style={styles.inlineInput}
                        value={vehiclePlate}
                        onChangeText={setVehiclePlate}
                        placeholder="ABC1234"
                        placeholderTextColor={THEME.textMuted}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultDetailText, { marginBottom: 4 }]}>VIN</Text>
                      <TextInput
                        style={styles.inlineInput}
                        value={vehicleVin}
                        onChangeText={setVehicleVin}
                        placeholder="1HGCM82633A..."
                        placeholderTextColor={THEME.textMuted}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.inlineSearchBtn, { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', gap: 6 },
                      toolStates.vehicleSearch?.status === 'running' && { opacity: 0.6 }]}
                    disabled={toolStates.vehicleSearch?.status === 'running' || (!vehiclePlate.trim() && !vehicleVin.trim())}
                    onPress={async () => {
                      if (!vehiclePlate.trim() && !vehicleVin.trim()) return;
                      updateTool('vehicleSearch', { status: 'running' });
                      try {
                        const result = await getVehicleSearchLinks({
                          plate: vehiclePlate.trim() || undefined,
                          vin: vehicleVin.trim() || undefined,
                          state: selectedState,
                        });
                        setVehicleResult(result);
                        updateTool('vehicleSearch', { status: 'done' });
                      } catch (e: any) {
                        updateTool('vehicleSearch', { status: 'error', error: e.message });
                      }
                    }}
                  >
                    {toolStates.vehicleSearch?.status === 'running' ? (
                      <ActivityIndicator size={14} color="#f97316" />
                    ) : (
                      <>
                        <Ionicons name="search" size={14} color="#f97316" />
                        <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 13 }}>Search Vehicle</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {vehicleResult && vehicleResult.search_links?.length > 0 && (
                    <View style={[styles.subSection, { marginTop: 12 }]}>
                      <Text style={styles.subLabel}>Search Links</Text>
                      {vehicleResult.search_links.map((link, i) => (
                        <TouchableOpacity key={i} style={styles.resultItem} onPress={() => openUrl(link.url)}>
                          <Ionicons
                            name={link.type === 'free' ? 'car' : link.type === 'vin' ? 'barcode' : 'search'}
                            size={14}
                            color="#f97316"
                          />
                          <Text style={[styles.resultItemText, styles.linkText]}>{link.name}</Text>
                          <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.tipTextSmall}>
                    Enter a plate or VIN to get lookup links. Check Street View historical imagery at known addresses to spot vehicles.
                  </Text>
                </View>,
              ) : null}

              {/* 6. SOCIAL & DIGITAL PROFILES */}
              {(investigateResult || holeheResult || googleLookupResult || sherlockResult) && renderSection(
                'social', 'Social & Digital Profiles', 'people',
                (investigateResult?.confirmed_profiles?.length || 0) + (holeheResult?.registered_on?.length || 0) + (sherlockResult?.found?.length || 0),
                THEME.purple,
                <View>
                  {/* Sherlock username search */}
                  <View style={styles.subSection}>
                    <Text style={styles.subLabel}>Username Search (Sherlock)</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <TextInput
                        style={[styles.inlineInput, { flex: 1 }]}
                        value={usernameQuery}
                        onChangeText={setUsernameQuery}
                        placeholder="Enter username"
                        placeholderTextColor={THEME.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={[styles.inlineSearchBtn, toolStates.sherlock?.status === 'running' && { opacity: 0.6 }]}
                        disabled={toolStates.sherlock?.status === 'running' || !usernameQuery.trim()}
                        onPress={async () => {
                          if (!usernameQuery.trim()) return;
                          updateTool('sherlock', { status: 'running' });
                          try {
                            const result = await searchSherlock(usernameQuery.trim());
                            setSherlockResult(result);
                            updateTool('sherlock', { status: 'done' });
                          } catch (e: any) {
                            updateTool('sherlock', { status: 'error', error: e.message });
                          }
                        }}
                      >
                        {toolStates.sherlock?.status === 'running' ? (
                          <ActivityIndicator size={14} color={THEME.purple} />
                        ) : (
                          <Ionicons name="search" size={16} color={THEME.purple} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {sherlockResult && sherlockResult.found?.length > 0 && (
                      <View>
                        <Text style={[styles.resultDetailText, { marginBottom: 6 }]}>
                          Found on {sherlockResult.found.length} of {sherlockResult.total_sites} sites ({sherlockResult.execution_time.toFixed(1)}s)
                        </Text>
                        {sherlockResult.found.slice(0, 30).map((item, i) => (
                          <TouchableOpacity key={i} style={styles.resultItem} onPress={() => openUrl(item.url)}>
                            <Ionicons name="link" size={14} color={THEME.purple} />
                            <Text style={[styles.resultItemText, styles.linkText]} numberOfLines={1}>{item.platform}</Text>
                            <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                          </TouchableOpacity>
                        ))}
                        {sherlockResult.found.length > 30 && (
                          <Text style={styles.resultDetailText}>+{sherlockResult.found.length - 30} more</Text>
                        )}
                      </View>
                    )}
                    {sherlockResult && sherlockResult.found?.length === 0 && (
                      <Text style={styles.emptyText}>No profiles found for "{usernameQuery}"</Text>
                    )}
                    <Text style={styles.tipTextSmall}>
                      Found a username on one platform? Search it here to find ALL their accounts across 400+ sites.
                    </Text>
                  </View>

                  {/* Investigation confirmed profiles */}
                  {(investigateResult?.confirmed_profiles?.length ?? 0) > 0 && investigateResult && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Confirmed Profiles</Text>
                      {investigateResult.confirmed_profiles.map((p, i) => (
                        <TouchableOpacity key={i} style={styles.resultItem} onPress={() => p.url && openUrl(p.url)}>
                          <Ionicons name="link" size={14} color={THEME.purple} />
                          <Text style={[styles.resultItemText, p.url && styles.linkText]} numberOfLines={1}>
                            {p.platform}{p.username ? ` (@${p.username})` : ''}
                          </Text>
                          {p.url && <Ionicons name="open-outline" size={12} color={THEME.textMuted} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {(investigateResult?.discovered_emails?.length ?? 0) > 0 && investigateResult && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Discovered Emails</Text>
                      {investigateResult.discovered_emails.map((e, i) => (
                        <Text key={i} style={styles.resultText}>{e}</Text>
                      ))}
                    </View>
                  )}

                  {investigateResult?.summary && !investigateResult?.confirmed_profiles?.length && (
                    <Text style={styles.resultText}>{investigateResult.summary}</Text>
                  )}

                  {/* Holehe email registrations */}
                  {holeheResult && email && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Email Registrations (Holehe)</Text>
                      {holeheResult.registered_on?.length > 0 ? (
                        holeheResult.registered_on.map((item, i) => (
                          <View key={i} style={styles.resultItem}>
                            <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
                            <Text style={styles.resultItemText}>{item.service}</Text>
                            {item.details && <Text style={styles.resultDetailText}>{item.details}</Text>}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyText}>No registered services found</Text>
                      )}
                    </View>
                  )}

                  {/* Google Lookup */}
                  {googleLookupResult && email && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Google Account Intel</Text>
                      {googleLookupResult.intel?.google_account_exists && (
                        <View style={styles.resultItem}>
                          <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
                          <Text style={styles.resultItemText}>Google Account exists</Text>
                        </View>
                      )}
                      {googleLookupResult.intel?.services_found?.map((svc: any, i: number) => (
                        <TouchableOpacity key={i} style={styles.resultItem} onPress={() => svc.url && openUrl(svc.url)}>
                          <Ionicons name="link" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, svc.url && styles.linkText]}>
                            Google: {svc.service}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Email intelligence links */}
                  {email && (
                    <View style={styles.subSection}>
                      <Text style={styles.subLabel}>Email Intel Links</Text>
                      <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://epieos.com/?q=${encodedEmail}&t=email`)}>
                        <Ionicons name="person-circle" size={14} color={THEME.purple} />
                        <Text style={[styles.resultItemText, styles.linkText]}>Epieos (Email to Identity)</Text>
                        <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://haveibeenpwned.com/account/${encodedEmail}`)}>
                        <Ionicons name="alert-circle" size={14} color={THEME.danger} />
                        <Text style={[styles.resultItemText, styles.linkText]}>Have I Been Pwned</Text>
                        <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.google.com/search?q="${encodedEmail}"+site:google.com/maps`)}>
                        <Ionicons name="map" size={14} color={THEME.success} />
                        <Text style={[styles.resultItemText, styles.linkText]}>Google Maps Reviews Search</Text>
                        <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>,
              )}

              {/* 7. PEOPLE SEARCH LINKS (from getBackgroundCheckLinks API + static redundancy) */}
              {q ? renderSection(
                'peopleSearch', 'People Search Links', 'search',
                (Object.values(backgroundResult?.links || {}).flat().length || 0) + 7,
                THEME.info,
                <View>
                  {backgroundResult && Object.entries(backgroundResult.links || {}).map(([category, items]) => (
                    <View key={category} style={styles.subSection}>
                      <Text style={styles.subLabel}>{category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
                      {(items as any[]).map((item: any, i: number) => (
                        <TouchableOpacity key={i} style={styles.resultItem} onPress={() => openUrl(item.url)}>
                          <Ionicons name="open-outline" size={14} color={THEME.info} />
                          <Text style={[styles.resultItemText, styles.linkText]}>{item.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  <View style={styles.subSection}>
                    <Text style={styles.subLabel}>Redundancy Sites</Text>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.fastpeoplesearch.com/name/${encoded.replace(/%20/g, '-')}`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Fast People Search</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.cyberbackgroundchecks.com/`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Cyber Background Checks</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://radaris.com/`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Radaris</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.advancedbackgroundchecks.com/name/${encoded.replace(/%20/g, '-')}`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Advanced Background Checks</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.truepeoplesearch.com/results?name=${encoded}`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>True People Search</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.searchpeoplefree.com/`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Search People Free</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.zabasearch.com/people/${encoded.replace(/%20/g, '+')}/`, q)}>
                      <Ionicons name="open-outline" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>ZabaSearch</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.tipTextSmall}>Check all sites - single-source data is unreliable. Look for relatives listed, then pivot off their profiles.</Text>
                </View>,
              ) : null}

              {/* 8. PUBLIC RECORDS (static portal links, state-aware) */}
              {q ? renderSection('publicRecords', 'Public Records', 'library', null, THEME.success, (
                <View>
                  <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://opencorporates.com/officers?q=${encoded}&utf8=true`)}>
                    <Ionicons name="briefcase" size={14} color={THEME.success} />
                    <Text style={[styles.resultItemText, styles.linkText]}>OpenCorporates Officer Search</Text>
                    <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                  </TouchableOpacity>
                  {stateInfo && (
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(stateInfo.sos, q)}>
                      <Ionicons name="document-text" size={14} color={THEME.success} />
                      <Text style={[styles.resultItemText, styles.linkText]}>{stateInfo.name} LLC / Corp Registry</Text>
                      <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.resultItem} onPress={() => openUrl('https://www.pacer.gov/', q)}>
                    <Ionicons name="hammer" size={14} color={THEME.danger} />
                    <Text style={[styles.resultItemText, styles.linkText]}>PACER (Federal Courts)</Text>
                    <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                  </TouchableOpacity>
                  {stateInfo && (
                    <>
                      <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(stateInfo.court, q)}>
                        <Ionicons name="document-text" size={14} color={THEME.danger} />
                        <Text style={[styles.resultItemText, styles.linkText]}>{stateInfo.name} Court Records</Text>
                        <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(stateInfo.voter, q)}>
                        <Ionicons name="checkmark-done-circle" size={14} color={THEME.success} />
                        <Text style={[styles.resultItemText, styles.linkText]}>{stateInfo.name} Voter Registration</Text>
                        <Ionicons name="clipboard-outline" size={12} color={THEME.textMuted} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://web.archive.org/web/*/${encoded}`)}>
                    <Ionicons name="time" size={14} color={THEME.info} />
                    <Text style={[styles.resultItemText, styles.linkText]}>Wayback Machine (web history)</Text>
                    <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                  </TouchableOpacity>
                  <View style={styles.subSection}>
                    <Text style={styles.subLabel}>Alternative Search Engines</Text>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://yandex.com/search/?text=${encoded}`)}>
                      <Ionicons name="search" size={14} color={THEME.purple} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Yandex (often finds more than Google)</Text>
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://duckduckgo.com/?q=${encoded}`)}>
                      <Ionicons name="search" size={14} color={THEME.success} />
                      <Text style={[styles.resultItemText, styles.linkText]}>DuckDuckGo</Text>
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resultItem} onPress={() => openUrl(`https://www.bing.com/search?q=${encoded}`)}>
                      <Ionicons name="search" size={14} color={THEME.info} />
                      <Text style={[styles.resultItemText, styles.linkText]}>Bing Search</Text>
                      <Ionicons name="open-outline" size={12} color={THEME.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.tipTextSmall}>Old LLC filings often contain home addresses. Diversify search engines - Yandex often returns results Google filters out.</Text>
                </View>
              )) : null}

              {/* 9. GOOGLE DORKS (combined from all dork calls, collapsed by default) */}
              {dorksResult && dorksResult.dorks?.length > 0 && renderSection(
                'dorks', 'Google Dorks', 'code-slash', dorksResult.dorks?.length || 0, '#f97316',
                <View>
                  {(dorksResult.dorks || []).map((dork, i) => (
                    <View key={i} style={styles.dorkItem}>
                      <View style={styles.dorkHeader}>
                        <View style={[styles.dorkCategoryBadge, {
                          backgroundColor: dork.category === 'bail_recovery' ? THEME.danger + '20' :
                            dork.category === 'social_media' ? THEME.purple + '20' :
                            dork.category === 'public_records' ? THEME.info + '20' :
                            dork.category === 'location' ? THEME.success + '20' :
                            THEME.warning + '20',
                        }]}>
                          <Text style={[styles.dorkCategoryText, {
                            color: dork.category === 'bail_recovery' ? THEME.danger :
                              dork.category === 'social_media' ? THEME.purple :
                              dork.category === 'public_records' ? THEME.info :
                              dork.category === 'location' ? THEME.success :
                              THEME.warning,
                          }]}>
                            {dork.category.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dorkText} numberOfLines={2}>{dork.dork}</Text>
                      <View style={styles.dorkActions}>
                        <TouchableOpacity style={styles.dorkBtn} onPress={() => openUrl(dork.google_url)}>
                          <Ionicons name="open-outline" size={14} color={THEME.info} />
                          <Text style={[styles.dorkBtnText, { color: THEME.info }]}>Open</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dorkBtn} onPress={() => copyToClipboard(dork.dork)}>
                          <Ionicons name="copy-outline" size={14} color={THEME.textSecondary} />
                          <Text style={[styles.dorkBtnText, { color: THEME.textSecondary }]}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>,
              )}

              {/* 10. INVESTIGATION TIPS (collapsed by default) */}
              {renderSection('tips', 'Investigation Tips', 'school', null, THEME.warning, (
                <View>
                  {[
                    'Phone numbers are unique identifiers - always prioritize phone pivots over addresses (which may be shared).',
                    'Check 5+ people search sites for the same person. Single-source data is unreliable. Look for consensus.',
                    'Pivot from relatives: if the target has no social media, check relatives listed on people search sites for connections.',
                    'Government records (voting, property, court) are the most reliable - they verify identity with ID.',
                    'Voter registration often contains verified home addresses - the subject had to show a driver\'s license.',
                    'Check Google Street View historical imagery (click the clock icon) for vehicles at the address.',
                    'If Street View is blurred, try Bing Maps or Apple Maps for unblurred views, or move down the street for a different angle.',
                    'Google Maps reviews from an email reveal frequented locations - restaurants, businesses, gyms.',
                    'Old LLC filings often contain home addresses that were later changed to business addresses.',
                    'Diversify search engines: Yandex often returns results Google filters out. Try DuckDuckGo and Bing too.',
                    'Wayback Machine can reveal old website registrations and business listings with personal info.',
                    'Crowdsourced apps (Sync.me, TrueCaller) have data from real contact lists - often more accurate than scraped data.',
                  ].map((tip, i) => (
                    <View key={i} style={styles.tipItem}>
                      <Ionicons name="bulb-outline" size={13} color={THEME.warning} />
                      <Text style={styles.tipItemText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          );
        })()}

        {/* Error display for any tool failures */}
        {errorCount > 0 && (
          <View style={styles.errorBox}>
            <Ionicons name="warning" size={16} color={THEME.danger} />
            <View style={{ flex: 1 }}>
              {activeTools.filter(k => toolStates[k].status === 'error').map(tool => (
                <Text key={tool} style={styles.errorText}>
                  {TOOL_LABELS[tool] || tool}: {toolStates[tool].error}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Tool Health Check */}
        <TouchableOpacity style={styles.healthBtn} onPress={checkHealth}>
          <Ionicons name="pulse" size={16} color={THEME.textMuted} />
          <Text style={styles.healthBtnText}>Check Backend Health</Text>
        </TouchableOpacity>

        {healthResult && (
          <View style={styles.healthBox}>
            <Text style={[styles.healthStatus, { color: healthResult.status === 'ok' ? THEME.success : THEME.danger }]}>
              Backend: {healthResult.status} (v{healthResult.version})
            </Text>
            <View style={styles.healthTools}>
              {Object.entries(healthResult.tools || {}).map(([tool, status]) => (
                <View key={tool} style={styles.healthToolRow}>
                  <View style={[styles.toolDot, {
                    backgroundColor: status === 'installed' ? THEME.success : THEME.danger,
                  }]} />
                  <Text style={styles.healthToolText}>{tool}: {status}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Search History */}
        {searchHistory.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Ionicons name="time-outline" size={14} color={THEME.textMuted} />
              <Text style={styles.historyTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={clearHistory} style={styles.historyClearBtn}>
                <Text style={styles.historyClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {searchHistory.map((entry, i) => {
              const label = entry.name || entry.email || entry.phone || entry.address || 'Search';
              const parts: string[] = [];
              if (entry.name) parts.push(entry.name);
              if (entry.email) parts.push(entry.email);
              if (entry.phone) parts.push(entry.phone);
              if (entry.address) parts.push(entry.address.length > 30 ? entry.address.slice(0, 30) + '...' : entry.address);
              const subtitle = parts.length > 1 ? parts.slice(1).join(' | ') : '';
              const timeAgo = formatTimeAgo(entry.timestamp);
              return (
                <TouchableOpacity key={i} style={styles.historyItem} onPress={() => loadFromHistory(entry)}>
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyLabel} numberOfLines={1}>{label}</Text>
                    {subtitle ? <Text style={styles.historySubtitle} numberOfLines={1}>{subtitle}</Text> : null}
                  </View>
                  <Text style={styles.historyTime}>{timeAgo}</Text>
                  <Ionicons name="arrow-forward" size={14} color={THEME.textMuted} />
                </TouchableOpacity>
              );
            })}
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
  // Form
  formSection: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 10,
  },
  formInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: THEME.text,
  },
  stateDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  stateDropdownText: {
    fontSize: 15,
    color: THEME.textMuted,
  },
  statePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
    backgroundColor: THEME.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    minWidth: 46,
    alignItems: 'center',
  },
  stateChipActive: {
    backgroundColor: THEME.primaryMuted,
    borderColor: THEME.primary,
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  stateChipTextActive: {
    color: THEME.primary,
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  searchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  clearBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  searchBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // Tool status bar
  toolStatusBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 6,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: THEME.surface,
  },
  toolDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  toolChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: THEME.success + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.success + '30',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.success,
    flex: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: THEME.info + '15',
    borderWidth: 1,
    borderColor: THEME.info + '30',
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.info,
  },
  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  subSection: {
    marginTop: 10,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  // Result items
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: THEME.bg,
    borderRadius: 8,
    marginBottom: 4,
  },
  resultItemText: {
    fontSize: 13,
    color: THEME.text,
    flex: 1,
  },
  resultDetailText: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  resultText: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  linkText: {
    color: THEME.info,
    textDecorationLine: 'underline',
  },
  emptyText: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  tipText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Phone type section
  phoneTypeSection: {
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
  activeIndicator: {
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
  detailText: {
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
  gvTextBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  // Dorks
  dorkItem: {
    backgroundColor: THEME.bg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  dorkHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dorkCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dorkCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dorkText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginBottom: 6,
  },
  dorkActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dorkBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Alerts
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // View all button
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.info,
  },
  // Errors
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.danger + '20',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: THEME.danger,
  },
  // Clipboard hint
  clipboardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clipboardHintText: {
    fontSize: 11,
    color: THEME.textMuted,
    fontStyle: 'italic',
  },
  // Tips
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tipItemText: {
    fontSize: 12,
    color: THEME.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  tipTextSmall: {
    fontSize: 11,
    color: THEME.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  // Health check
  healthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  healthBtnText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  healthBox: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: THEME.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  healthStatus: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  healthTools: {
    gap: 4,
  },
  healthToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthToolText: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  // History
  historySection: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyClearText: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  historyItemContent: {
    flex: 1,
    gap: 2,
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
  },
  historySubtitle: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  historyTime: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  inlineInput: {
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: THEME.text,
  },
  inlineSearchBtn: {
    backgroundColor: THEME.surfaceLight,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
