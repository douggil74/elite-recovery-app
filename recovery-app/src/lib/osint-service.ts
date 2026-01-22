/**
 * OSINT Service - Automated Social Media & Public Records Search
 * Performs real verification of user profiles across platforms
 */

export interface ProfileCheckResult {
  platform: string;
  username: string;
  exists: boolean | 'unknown';
  profileUrl: string;
  confidence: number;
  details?: {
    name?: string;
    bio?: string;
    followers?: number;
    posts?: number;
    location?: string;
    lastActive?: string;
  };
  error?: string;
}

export interface OSINTSearchResult {
  profiles: ProfileCheckResult[];
  peopleSearchResults: PeopleSearchResult[];
  summary: string;
  searchedAt: Date;
}

export interface PeopleSearchResult {
  source: string;
  url: string;
  status: 'found' | 'not_found' | 'unknown';
  possibleMatches?: number;
}

// CORS proxy for client-side requests (use your own in production)
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Generate username variations from a full name
 */
export function generateUsernameVariations(fullName: string): string[] {
  const parts = fullName.toLowerCase().trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  const middle = parts.length > 2 ? parts[1] : '';

  const variations = new Set<string>();

  // Basic combinations
  variations.add(`${first}${last}`);
  variations.add(`${first}.${last}`);
  variations.add(`${first}_${last}`);
  variations.add(`${last}${first}`);
  variations.add(`${first}${last.charAt(0)}`);
  variations.add(`${first.charAt(0)}${last}`);

  // With middle initial
  if (middle) {
    variations.add(`${first}${middle.charAt(0)}${last}`);
    variations.add(`${first}.${middle.charAt(0)}.${last}`);
  }

  // Common patterns with numbers (birth years, etc)
  for (const year of ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '00', '01', '02']) {
    variations.add(`${first}${last}${year}`);
  }

  return Array.from(variations);
}

/**
 * Check if a username exists on a platform using various methods
 */
async function checkPlatform(
  platform: string,
  username: string,
  fullName: string
): Promise<ProfileCheckResult> {
  const baseResult: ProfileCheckResult = {
    platform,
    username,
    exists: 'unknown',
    profileUrl: '',
    confidence: 0,
  };

  try {
    switch (platform.toLowerCase()) {
      case 'instagram': {
        const url = `https://www.instagram.com/${username}/`;
        baseResult.profileUrl = url;
        // Instagram returns 200 for existing profiles, 404 for non-existing
        try {
          const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: { 'Accept': 'text/html' },
          });
          if (response.ok) {
            const text = await response.text();
            // Check for profile page indicators
            if (text.includes('"@type":"Person"') || text.includes('profilePage')) {
              baseResult.exists = true;
              baseResult.confidence = 85;
              // Try to extract follower count
              const followerMatch = text.match(/"edge_followed_by":\{"count":(\d+)\}/);
              if (followerMatch) {
                baseResult.details = { followers: parseInt(followerMatch[1]) };
              }
            } else if (text.includes("Sorry, this page isn't available")) {
              baseResult.exists = false;
              baseResult.confidence = 90;
            }
          }
        } catch (e) {
          baseResult.error = 'Request failed';
        }
        break;
      }

      case 'tiktok': {
        const url = `https://www.tiktok.com/@${username}`;
        baseResult.profileUrl = url;
        try {
          const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
            method: 'GET',
          });
          if (response.ok) {
            const text = await response.text();
            if (text.includes('"uniqueId"') && !text.includes("Couldn't find this account")) {
              baseResult.exists = true;
              baseResult.confidence = 80;
            } else {
              baseResult.exists = false;
              baseResult.confidence = 75;
            }
          }
        } catch (e) {
          baseResult.error = 'Request failed';
        }
        break;
      }

      case 'twitter':
      case 'twitter/x': {
        const url = `https://twitter.com/${username}`;
        baseResult.profileUrl = url;
        // Twitter is harder to check without API, set as search link
        baseResult.profileUrl = `https://twitter.com/search?q=${encodeURIComponent(fullName)}&f=user`;
        baseResult.exists = 'unknown';
        baseResult.confidence = 0;
        break;
      }

      case 'facebook': {
        baseResult.profileUrl = `https://www.facebook.com/search/people/?q=${encodeURIComponent(fullName)}`;
        baseResult.exists = 'unknown';
        baseResult.confidence = 0;
        break;
      }

      case 'linkedin': {
        baseResult.profileUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(fullName)}`;
        baseResult.exists = 'unknown';
        baseResult.confidence = 0;
        break;
      }

      case 'snapchat': {
        const url = `https://www.snapchat.com/add/${username}`;
        baseResult.profileUrl = url;
        try {
          const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
            method: 'GET',
          });
          if (response.ok) {
            const text = await response.text();
            if (text.includes('Add on Snapchat') && !text.includes('not found')) {
              baseResult.exists = true;
              baseResult.confidence = 70;
            } else {
              baseResult.exists = false;
              baseResult.confidence = 60;
            }
          }
        } catch (e) {
          baseResult.error = 'Request failed';
        }
        break;
      }

      default:
        baseResult.exists = 'unknown';
    }
  } catch (error: any) {
    baseResult.error = error?.message || 'Check failed';
  }

  return baseResult;
}

/**
 * Check people search databases
 */
async function checkPeopleSearch(
  fullName: string,
  state?: string
): Promise<PeopleSearchResult[]> {
  const results: PeopleSearchResult[] = [];
  const encodedName = encodeURIComponent(fullName.replace(/ /g, '-'));
  const encodedNameSpace = encodeURIComponent(fullName);

  // TruePeopleSearch
  results.push({
    source: 'TruePeopleSearch',
    url: `https://www.truepeoplesearch.com/results?name=${encodedNameSpace}${state ? `&citystatezip=${state}` : ''}`,
    status: 'unknown',
  });

  // FastPeopleSearch
  results.push({
    source: 'FastPeopleSearch',
    url: `https://www.fastpeoplesearch.com/name/${encodedName}`,
    status: 'unknown',
  });

  // Whitepages
  results.push({
    source: 'Whitepages',
    url: `https://www.whitepages.com/name/${encodedName}`,
    status: 'unknown',
  });

  // That's Them
  results.push({
    source: "That's Them",
    url: `https://thatsthem.com/name/${encodedName}`,
    status: 'unknown',
  });

  // CourtListener (Federal courts)
  results.push({
    source: 'CourtListener',
    url: `https://www.courtlistener.com/?q=${encodedNameSpace}&type=r`,
    status: 'unknown',
  });

  // VINE (Victim notification - shows if in custody)
  results.push({
    source: 'VINELink',
    url: `https://www.vinelink.com/#/search`,
    status: 'unknown',
  });

  return results;
}

/**
 * Main function to perform comprehensive OSINT search
 */
export async function performOSINTSearch(
  fullName: string,
  options?: {
    state?: string;
    knownUsernames?: string[];
    checkAllVariations?: boolean;
  }
): Promise<OSINTSearchResult> {
  const searchedAt = new Date();
  const profiles: ProfileCheckResult[] = [];

  // Generate username variations
  const usernames = options?.knownUsernames?.length
    ? options.knownUsernames
    : generateUsernameVariations(fullName);

  const platforms = ['Instagram', 'TikTok', 'Snapchat', 'Twitter/X', 'Facebook', 'LinkedIn'];

  // Check each platform with primary username
  const primaryUsername = usernames[0];

  for (const platform of platforms) {
    const result = await checkPlatform(platform, primaryUsername, fullName);
    profiles.push(result);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  // If checking all variations, do additional checks for found platforms
  if (options?.checkAllVariations) {
    for (const username of usernames.slice(1, 5)) {
      for (const platform of ['Instagram', 'TikTok']) {
        const existing = profiles.find(p => p.platform === platform);
        if (existing?.exists === false) {
          const result = await checkPlatform(platform, username, fullName);
          if (result.exists === true) {
            // Replace with found profile
            const idx = profiles.findIndex(p => p.platform === platform);
            if (idx >= 0) profiles[idx] = result;
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  // Get people search results
  const peopleSearchResults = await checkPeopleSearch(fullName, options?.state);

  // Generate summary
  const foundProfiles = profiles.filter(p => p.exists === true).length;
  const summary = `Checked ${platforms.length} social platforms. Found ${foundProfiles} verified profile(s). Generated ${peopleSearchResults.length} people search links.`;

  return {
    profiles,
    peopleSearchResults,
    summary,
    searchedAt,
  };
}

/**
 * Quick check for a single platform
 */
export async function quickCheckUsername(
  platform: string,
  username: string
): Promise<ProfileCheckResult> {
  return checkPlatform(platform, username, '');
}

/**
 * Reverse image search URLs
 */
export function getReverseImageSearchUrls(): { name: string; url: string; note: string }[] {
  return [
    { name: 'Google Images', url: 'https://images.google.com/', note: 'Click camera icon to upload' },
    { name: 'Yandex Images', url: 'https://yandex.com/images/', note: 'Best for faces - click camera' },
    { name: 'TinEye', url: 'https://tineye.com/', note: 'Upload or paste URL' },
    { name: 'PimEyes', url: 'https://pimeyes.com/', note: 'Face recognition search' },
    { name: 'FaceCheck.ID', url: 'https://facecheck.id/', note: 'Face search database' },
    { name: 'Search4faces', url: 'https://search4faces.com/', note: 'VK/OK face search' },
  ];
}

/**
 * Username search across many platforms (like Sherlock)
 */
export function getMultiPlatformUsernameSearchUrl(username: string): string {
  return `https://whatsmyname.app/?q=${encodeURIComponent(username)}`;
}


// ============================================================================
// BACKEND OSINT INTEGRATIONS
// ============================================================================

const OSINT_API_BASE = 'https://elite-recovery-osint.onrender.com';

/**
 * PhoneInfoga - Advanced phone number OSINT
 */
export interface PhoneInfogaResult {
  phone: string;
  searched_at: string;
  raw_local: string | null;
  international: string | null;
  country: string | null;
  carrier: string | null;
  line_type: string | null;
  valid: boolean;
  possible_owner: string | null;
  social_results: Array<{ title: string; url: string; snippet: string }>;
  dork_results: string[];
  errors: string[];
  execution_time: number;
}

export async function searchPhoneInfoga(phone: string): Promise<PhoneInfogaResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/phoneinfoga`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) throw new Error(`PhoneInfoga error: ${response.statusText}`);
  return response.json();
}


/**
 * H8Mail - Email breach/leak checking
 */
export interface H8mailResult {
  email: string;
  searched_at: string;
  breaches_found: Array<{ source: string; breach_name?: string; data?: string; date?: string }>;
  leaked_passwords: string[];
  related_emails: string[];
  total_breaches: number;
  errors: string[];
  execution_time: number;
}

export async function searchH8mail(email: string, chase: boolean = true): Promise<H8mailResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/h8mail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, chase_breaches: chase }),
  });
  if (!response.ok) throw new Error(`H8mail error: ${response.statusText}`);
  return response.json();
}


/**
 * theHarvester - Domain/email reconnaissance
 */
export interface HarvesterResult {
  domain: string;
  searched_at: string;
  emails_found: string[];
  hosts_found: string[];
  ips_found: string[];
  urls_found: string[];
  people_found: string[];
  total_results: number;
  errors: string[];
  execution_time: number;
}

export async function searchHarvester(
  domain: string,
  sources: string[] = ['google', 'bing', 'linkedin']
): Promise<HarvesterResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/harvester`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, sources }),
  });
  if (!response.ok) throw new Error(`theHarvester error: ${response.statusText}`);
  return response.json();
}


/**
 * Social-Analyzer - Enhanced username search (1000+ sites)
 */
export interface SocialAnalyzerResult {
  username: string;
  searched_at: string;
  profiles_found: Array<{
    platform: string;
    url: string;
    status: string;
    extracted_info?: Record<string, unknown>;
  }>;
  total_found: number;
  metadata_extracted: Record<string, unknown>;
  errors: string[];
  execution_time: number;
}

export async function searchSocialAnalyzer(
  username: string,
  metadata: boolean = true
): Promise<SocialAnalyzerResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/social-analyzer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, metadata, timeout: 120 }),
  });
  if (!response.ok) throw new Error(`Social-Analyzer error: ${response.statusText}`);
  return response.json();
}


/**
 * CourtListener - Federal court records search
 */
export interface CourtRecordResult {
  query: string;
  searched_at: string;
  cases_found: Array<{
    case_name: string;
    court: string;
    date_filed: string;
    docket_number: string;
    status: string;
    url: string;
    snippet: string;
  }>;
  people_found: Array<{
    name: string;
    born: string;
    positions: string[];
    url: string;
  }>;
  total_results: number;
  courtlistener_urls: string[];
  errors: string[];
  execution_time: number;
}

export async function searchCourtRecords(
  name: string,
  options?: { case_name?: string; court?: string; filed_after?: string; filed_before?: string }
): Promise<CourtRecordResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/court-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...options }),
  });
  if (!response.ok) throw new Error(`Court records error: ${response.statusText}`);
  return response.json();
}


/**
 * State court links generator
 */
export interface StateCourtLinks {
  name: string;
  state: string;
  searched_at: string;
  court_links: Record<string, string>;
  federal_links: { pacer: string; courtlistener: string };
}

export async function getStateCourtLinks(name: string, state: string): Promise<StateCourtLinks> {
  const response = await fetch(`${OSINT_API_BASE}/api/state-courts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, state }),
  });
  if (!response.ok) throw new Error(`State courts error: ${response.statusText}`);
  return response.json();
}


/**
 * Sherlock - Username search (400+ sites) via backend
 */
export interface SherlockResult {
  username: string;
  searched_at: string;
  tool: string;
  total_sites: number;
  found: Array<{ platform: string; url: string; response_time?: number }>;
  not_found: string[];
  errors: string[];
  execution_time: number;
}

export async function searchSherlock(username: string, timeout: number = 60): Promise<SherlockResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/sherlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, timeout }),
  });
  if (!response.ok) throw new Error(`Sherlock error: ${response.statusText}`);
  return response.json();
}


/**
 * Maigret - Comprehensive username search via backend
 */
export async function searchMaigret(username: string, timeout: number = 120): Promise<SherlockResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/maigret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, timeout }),
  });
  if (!response.ok) throw new Error(`Maigret error: ${response.statusText}`);
  return response.json();
}


/**
 * Holehe - Email account discovery via backend
 */
export interface HoleheResult {
  email: string;
  searched_at: string;
  tool: string;
  registered_on: Array<{ service: string; status: string; details?: string }>;
  not_registered: string[];
  errors: string[];
  execution_time: number;
}

export async function searchHolehe(email: string, timeout: number = 60): Promise<HoleheResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/holehe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, timeout }),
  });
  if (!response.ok) throw new Error(`Holehe error: ${response.statusText}`);
  return response.json();
}


/**
 * Full username search - Combined Sherlock + Maigret
 */
export interface FullUsernameResult {
  username: string;
  searched_at: string;
  sherlock: SherlockResult;
  maigret: SherlockResult;
  combined: {
    total_unique_profiles: number;
    profiles: Array<{ platform: string; url: string }>;
  };
}

export async function searchFullUsername(username: string, timeout: number = 60): Promise<FullUsernameResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/username/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, timeout }),
  });
  if (!response.ok) throw new Error(`Full username search error: ${response.statusText}`);
  return response.json();
}


/**
 * Intelligent investigation - Smart multi-tool flow
 */
export interface InvestigateResult {
  name: string;
  searched_at: string;
  flow_steps: Array<{ step: number; action: string; status: string; result?: string }>;
  discovered_emails: string[];
  discovered_usernames: string[];
  confirmed_profiles: Array<{
    platform: string;
    url: string;
    username?: string;
    source: string;
  }>;
  people_search_links: Array<{ name: string; url: string; type: string }>;
  summary: string;
  execution_time: number;
}

export async function investigatePerson(
  name: string,
  options?: { email?: string; phone?: string; location?: string }
): Promise<InvestigateResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...options }),
  });
  if (!response.ok) throw new Error(`Investigation error: ${response.statusText}`);
  return response.json();
}


/**
 * Full OSINT Sweep - All tools combined
 */
export interface FullSweepResult {
  target: { name: string; email?: string; phone?: string; username?: string; state?: string };
  searched_at: string;
  username_results: SherlockResult | null;
  email_results: HoleheResult | null;
  phone_results: PhoneInfogaResult | null;
  summary: string;
  total_profiles_found: number;
  execution_time: number;
}

export async function performFullSweep(
  name: string,
  options?: { email?: string; phone?: string; username?: string; state?: string }
): Promise<FullSweepResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...options }),
  });
  if (!response.ok) throw new Error(`Full sweep error: ${response.statusText}`);
  return response.json();
}


/**
 * Check backend health and available tools
 */
export interface HealthCheckResult {
  status: string;
  timestamp: string;
  tools: Record<string, string>;
  version: string;
}

export async function checkOSINTHealth(): Promise<HealthCheckResult> {
  const response = await fetch(`${OSINT_API_BASE}/health`);
  if (!response.ok) throw new Error(`Health check error: ${response.statusText}`);
  return response.json();
}


/**
 * Ignorant - Phone number social account check
 */
export interface IgnorantResult {
  phone: string;
  country_code: string;
  searched_at: string;
  accounts_found: Array<{ platform: string; status: string }>;
  total_found: number;
  errors: string[];
  execution_time: number;
}

export async function searchIgnorant(phone: string, countryCode: string = 'US'): Promise<IgnorantResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/ignorant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, country_code: countryCode }),
  });
  if (!response.ok) throw new Error(`Ignorant error: ${response.statusText}`);
  return response.json();
}


/**
 * Blackbird - Comprehensive username search
 */
export interface BlackbirdResult {
  username: string;
  searched_at: string;
  tool: string;
  found: Array<{ platform: string; url: string; http_status: number }>;
  total_found: number;
  errors: string[];
  execution_time: number;
}

export async function searchBlackbird(username: string, timeout: number = 90): Promise<BlackbirdResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/blackbird`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, timeout }),
  });
  if (!response.ok) throw new Error(`Blackbird error: ${response.statusText}`);
  return response.json();
}


/**
 * Instaloader - Instagram profile intel
 */
export interface InstagramProfileResult {
  username: string;
  searched_at: string;
  profile: {
    username?: string;
    full_name?: string;
    biography?: string;
    followers?: number;
    following?: number;
    posts?: number;
    is_private?: boolean;
    is_verified?: boolean;
    external_url?: string;
    profile_pic_url?: string;
    business_category?: string;
  };
  errors: string[];
  execution_time: number;
}

export async function searchInstagram(username: string): Promise<InstagramProfileResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/instagram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error(`Instagram error: ${response.statusText}`);
  return response.json();
}


/**
 * Toutatis - Instagram deep intel (phone/email)
 */
export interface ToutatisResult {
  username: string;
  searched_at: string;
  intel: Record<string, string>;
  errors: string[];
  execution_time: number;
}

export async function searchToutatis(username: string, sessionId?: string): Promise<ToutatisResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/toutatis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, session_id: sessionId }),
  });
  if (!response.ok) throw new Error(`Toutatis error: ${response.statusText}`);
  return response.json();
}


/**
 * GHunt - Google account investigation
 */
export interface GhuntResult {
  email: string;
  searched_at: string;
  intel: {
    google_id?: string;
    name?: string;
    profile_photos?: string[];
    google_maps_reviews?: unknown[];
    youtube_channel?: string;
    google_calendar?: string;
    last_profile_edit?: string;
  };
  errors: string[];
  execution_time: number;
}

export async function searchGhunt(email: string): Promise<GhuntResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/ghunt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(`GHunt error: ${response.statusText}`);
  return response.json();
}


/**
 * Mega Sweep - ALL tools combined
 */
export interface MegaSweepResult {
  target: {
    name: string;
    email?: string;
    phone?: string;
    username?: string;
    instagram?: string;
    state?: string;
  };
  searched_at: string;
  results: {
    username_searches: Array<{ tool: string; result: unknown }>;
    email_searches: Array<{ tool: string; result: unknown }>;
    phone_searches: Array<{ tool: string; result: unknown }>;
    instagram_searches: Array<{ tool: string; result: unknown }>;
    court_records: CourtRecordResult | null;
    domain_intel: HarvesterResult | null;
  };
  total_profiles_found: number;
  court_cases_found: number;
  errors: string[];
  execution_time: number;
}

export async function performMegaSweep(
  name: string,
  options?: {
    email?: string;
    phone?: string;
    username?: string;
    instagram?: string;
    state?: string;
  }
): Promise<MegaSweepResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/mega-sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...options }),
  });
  if (!response.ok) throw new Error(`Mega sweep error: ${response.statusText}`);
  return response.json();
}


// ============================================================================
// WEB SEARCH & DOMAIN TOOLS
// ============================================================================

/**
 * Web search using DuckDuckGo
 */
export interface WebSearchResult {
  query: string;
  searched_at: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  total_found: number;
  errors: string[];
  execution_time: number;
}

export async function webSearch(query: string, maxResults: number = 20): Promise<WebSearchResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/web-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_results: maxResults }),
  });
  if (!response.ok) throw new Error(`Web search error: ${response.statusText}`);
  return response.json();
}


/**
 * WHOIS domain lookup
 */
export interface WhoisResult {
  domain: string;
  searched_at: string;
  whois_data: {
    domain_name?: string;
    registrar?: string;
    creation_date?: string;
    expiration_date?: string;
    name_servers?: string[];
    emails?: string[];
    registrant?: string;
    org?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  errors: string[];
  execution_time: number;
}

export async function whoisLookup(domain: string): Promise<WhoisResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/whois`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (!response.ok) throw new Error(`WHOIS error: ${response.statusText}`);
  return response.json();
}


/**
 * Wayback Machine historical search
 */
export interface WaybackResult {
  url: string;
  searched_at: string;
  snapshots: Array<{
    type: string;
    timestamp?: string;
    archive_url: string;
    status_code?: number;
    mime_type?: string;
  }>;
  total_found: number;
  errors: string[];
  execution_time: number;
}

export async function waybackSearch(url: string, limit: number = 10): Promise<WaybackResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/wayback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit }),
  });
  if (!response.ok) throw new Error(`Wayback error: ${response.statusText}`);
  return response.json();
}


/**
 * IP address geolocation
 */
export interface IPLookupResult {
  ip_address: string;
  searched_at: string;
  location: {
    ip?: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    isp?: string;
    org?: string;
  };
  errors: string[];
  execution_time: number;
}

export async function ipLookup(ipAddress: string): Promise<IPLookupResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/ip-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip_address: ipAddress }),
  });
  if (!response.ok) throw new Error(`IP lookup error: ${response.statusText}`);
  return response.json();
}


// ============================================================================
// VEHICLE & BACKGROUND CHECK LINKS
// ============================================================================

/**
 * Vehicle/plate search links
 */
export interface VehicleSearchLinks {
  plate?: string;
  vin?: string;
  state: string;
  searched_at: string;
  search_links: Array<{ name: string; url: string; type: string }>;
}

export async function getVehicleSearchLinks(
  options: { plate?: string; vin?: string; state?: string }
): Promise<VehicleSearchLinks> {
  const response = await fetch(`${OSINT_API_BASE}/api/vehicle-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error(`Vehicle search error: ${response.statusText}`);
  return response.json();
}


/**
 * Background check links
 */
export interface BackgroundCheckLinks {
  name: string;
  searched_at: string;
  links: {
    free_services: Array<{ name: string; url: string }>;
    paid_services: Array<{ name: string; url: string }>;
    criminal_records: Array<{ name: string; url: string }>;
    social_media: Array<{ name: string; url: string }>;
    state_specific?: Array<{ name: string; url: string }>;
  };
}

export async function getBackgroundCheckLinks(
  name: string,
  options?: { state?: string; city?: string; dob?: string }
): Promise<BackgroundCheckLinks> {
  const response = await fetch(`${OSINT_API_BASE}/api/background-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...options }),
  });
  if (!response.ok) throw new Error(`Background links error: ${response.statusText}`);
  return response.json();
}


// ============================================================================
// RISK SCORING
// ============================================================================

/**
 * Bond client risk score
 */
export interface RiskScoreResult {
  name: string;
  calculated_at: string;
  score: number;
  risk_level: 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'VERY HIGH RISK';
  recommendation: string;
  risk_factors: string[];
  positive_factors: string[];
  score_breakdown: {
    base_score: number;
    final_score: number;
    adjustments: number;
  };
}

export interface RiskScoreInput {
  name: string;
  age?: number;
  charges?: string[];
  prior_ftas?: number;
  prior_convictions?: number;
  employment_status?: 'employed' | 'unemployed' | 'self-employed';
  residence_type?: 'own' | 'rent' | 'homeless' | 'with_family';
  residence_duration_months?: number;
  local_ties?: number;
  has_vehicle?: boolean;
  phone_verified?: boolean;
  references_verified?: number;
  bond_amount?: number;
  income_monthly?: number;
}

export async function calculateRiskScore(input: RiskScoreInput): Promise<RiskScoreResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/risk-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Risk score error: ${response.statusText}`);
  return response.json();
}


// ============================================================================
// DOCUMENT & METADATA
// ============================================================================

/**
 * Extract metadata from documents/images
 */
export interface MetadataResult {
  filename: string;
  extracted_at: string;
  metadata: Record<string, string | number | boolean | null>;
  errors: string[];
  execution_time: number;
}

export async function extractMetadata(fileBase64: string, filename: string): Promise<MetadataResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/extract-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_base64: fileBase64, filename }),
  });
  if (!response.ok) throw new Error(`Metadata extraction error: ${response.statusText}`);
  return response.json();
}


// ============================================================================
// SOCIAL SCRAPING
// ============================================================================

/**
 * Scrape social media posts
 */
export interface SocialScrapeResult {
  username: string;
  platform: string;
  searched_at: string;
  posts: Array<{
    date?: string;
    content?: string;
    title?: string;
    likes?: number;
    retweets?: number;
    url?: string;
    subreddit?: string;
  }>;
  profile_info: Record<string, unknown>;
  total_found: number;
  errors: string[];
  execution_time: number;
}

export async function scrapeSocial(
  username: string,
  platform: 'twitter' | 'reddit',
  maxPosts: number = 20
): Promise<SocialScrapeResult> {
  const response = await fetch(`${OSINT_API_BASE}/api/social-scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, platform, max_posts: maxPosts }),
  });
  if (!response.ok) throw new Error(`Social scrape error: ${response.statusText}`);
  return response.json();
}
