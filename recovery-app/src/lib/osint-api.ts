/**
 * OSINT API Client
 * Calls the self-hosted OSINT serverless functions
 */

// API base - will be same origin when deployed
const getApiBase = () => {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  // Use same origin for production, skip for localhost (use local service instead)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''; // Will fail and fallback to local service
  }
  return ''; // Same origin
};

export interface UsernameSearchResult {
  username: string;
  searchedAt: string;
  totalTime: number;
  summary: {
    total: number;
    found: number;
    notFound: number;
    unknown: number;
  };
  found: { platform: string; url: string }[];
  notFound: string[];
  unknown: { platform: string; error?: string }[];
}

export interface EmailSearchResult {
  email: string;
  searchedAt: string;
  totalTime: number;
  analysis: {
    localPart: string;
    domain: string;
    isDisposable: boolean;
    isBusinessEmail: boolean;
    provider: string;
    possibleRealName: string;
  };
  gravatar: {
    exists: boolean;
    avatarUrl?: string;
  };
  summary: {
    totalChecked: number;
    registered: number;
    notRegistered: number;
  };
  registeredOn: string[];
  notRegisteredOn: string[];
}

export interface PhoneSearchResult {
  phone: string;
  searchedAt: string;
  analysis: {
    number: string;
    formatted: string;
    countryCode: string;
    areaCode: string;
    lineType: string;
    carrier: string;
    location: {
      state: string;
      city: string;
      timezone: string;
    };
    isValid: boolean;
    isPossibleMobile: boolean;
    isPossibleVoIP: boolean;
  };
  searchLinks: Record<string, string>;
  tips: string[];
}

export interface PersonSearchResult {
  name: string;
  searchedAt: string;
  usernameVariations: string[];
  searchLinks: {
    category: string;
    name: string;
    url: string;
    description: string;
  }[];
  tips: string[];
}

/**
 * Search username across 70+ platforms
 */
export async function searchUsername(
  username: string,
  options?: { quick?: boolean; platforms?: string[] }
): Promise<UsernameSearchResult> {
  const params = new URLSearchParams({ username });
  if (options?.quick) params.append('quick', 'true');
  if (options?.platforms) params.append('platforms', options.platforms.join(','));

  const response = await fetch(`${getApiBase()}/api/osint/username?${params}`);

  if (!response.ok) {
    throw new Error(`Username search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check email registration across services
 */
export async function searchEmail(
  email: string,
  options?: { quick?: boolean }
): Promise<EmailSearchResult> {
  const params = new URLSearchParams({ email });
  if (options?.quick) params.append('quick', 'true');

  const response = await fetch(`${getApiBase()}/api/osint/email?${params}`);

  if (!response.ok) {
    throw new Error(`Email search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Analyze phone number and get search links
 */
export async function searchPhone(phone: string): Promise<PhoneSearchResult> {
  const response = await fetch(`${getApiBase()}/api/osint/phone?phone=${encodeURIComponent(phone)}`);

  if (!response.ok) {
    throw new Error(`Phone search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Comprehensive person search with all links
 */
export async function searchPerson(
  name: string,
  options?: { state?: string; city?: string }
): Promise<PersonSearchResult> {
  const params = new URLSearchParams({ name });
  if (options?.state) params.append('state', options.state);
  if (options?.city) params.append('city', options.city);

  const response = await fetch(`${getApiBase()}/api/osint/person?${params}`);

  if (!response.ok) {
    throw new Error(`Person search failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Run full OSINT sweep on a target
 */
export async function fullOSINTSweep(
  target: {
    name: string;
    email?: string;
    phone?: string;
    state?: string;
  },
  onProgress?: (step: string, result: any) => void
): Promise<{
  person: PersonSearchResult | null;
  username: UsernameSearchResult | null;
  email: EmailSearchResult | null;
  phone: PhoneSearchResult | null;
  summary: string;
}> {
  const results: {
    person: PersonSearchResult | null;
    username: UsernameSearchResult | null;
    email: EmailSearchResult | null;
    phone: PhoneSearchResult | null;
    summary: string;
  } = {
    person: null,
    username: null,
    email: null,
    phone: null,
    summary: '',
  };

  // Person search (always)
  try {
    onProgress?.('Searching person databases...', null);
    results.person = await searchPerson(target.name, { state: target.state });
    onProgress?.('Person search complete', results.person);
  } catch (e) {
    console.error('Person search error:', e);
  }

  // Username search (generate from name)
  try {
    const username = target.name.toLowerCase().replace(/\s+/g, '');
    onProgress?.(`Searching username @${username}...`, null);
    results.username = await searchUsername(username, { quick: true });
    onProgress?.('Username search complete', results.username);
  } catch (e) {
    console.error('Username search error:', e);
  }

  // Email search (if provided)
  if (target.email) {
    try {
      onProgress?.(`Checking email ${target.email}...`, null);
      results.email = await searchEmail(target.email, { quick: true });
      onProgress?.('Email search complete', results.email);
    } catch (e) {
      console.error('Email search error:', e);
    }
  }

  // Phone search (if provided)
  if (target.phone) {
    try {
      onProgress?.(`Analyzing phone ${target.phone}...`, null);
      results.phone = await searchPhone(target.phone);
      onProgress?.('Phone search complete', results.phone);
    } catch (e) {
      console.error('Phone search error:', e);
    }
  }

  // Generate summary
  const summaryParts: string[] = [];

  if (results.username) {
    summaryParts.push(`Found ${results.username.summary.found} social profiles`);
  }

  if (results.email) {
    summaryParts.push(`Email registered on ${results.email.summary.registered} services`);
  }

  if (results.phone) {
    summaryParts.push(`Phone from ${results.phone.analysis.location.city}, ${results.phone.analysis.location.state}`);
  }

  if (results.person) {
    summaryParts.push(`Generated ${results.person.searchLinks.length} search links`);
  }

  results.summary = summaryParts.join(' • ') || 'Search complete';

  return results;
}
