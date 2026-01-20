/**
 * Python OSINT Backend Client
 * Connects to the FastAPI OSINT service running Sherlock, Maigret, holehe, etc.
 */

import { getSettings } from './storage';

// Production URL: Update this once deployed to Render.com
// Default to Render.com deployment, falls back to localhost for development
const PRODUCTION_BACKEND_URL = 'https://elite-recovery-osint.onrender.com';
const LOCAL_DEV_URL = 'http://localhost:8000';

const getBackendUrl = async (): Promise<string> => {
  const settings = await getSettings();
  // Check for custom backend URL in settings, then production, then localhost
  const customUrl = (settings as any).osintBackendUrl;
  if (customUrl) return customUrl;

  // Try production first, then fall back to localhost
  try {
    const prodCheck = await fetch(`${PRODUCTION_BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (prodCheck.ok) return PRODUCTION_BACKEND_URL;
  } catch {
    // Production not available, try localhost
  }

  return LOCAL_DEV_URL;
};

// ============================================================================
// Types
// ============================================================================

export interface SherlockResult {
  username: string;
  searched_at: string;
  tool: string;
  total_sites: number;
  found: {
    platform: string;
    url: string;
    response_time?: number;
  }[];
  not_found: string[];
  errors: string[];
  execution_time: number;
}

export interface MaigretResult {
  username: string;
  searched_at: string;
  tool: string;
  total_sites: number;
  found: {
    platform: string;
    url: string;
    tags?: string[];
    ids?: Record<string, any>;
  }[];
  not_found: string[];
  errors: string[];
  execution_time: number;
}

export interface HoleheResult {
  email: string;
  searched_at: string;
  tool: string;
  registered_on: {
    service: string;
    status: string;
    details?: string;
  }[];
  not_registered: string[];
  errors: string[];
  execution_time: number;
}

export interface PhoneResult {
  phone: string;
  searched_at: string;
  carrier?: string;
  line_type?: string;
  location?: {
    city: string;
    state: string;
  };
  reputation?: Record<string, any>;
  social_media: {
    platform: string;
    url: string;
  }[];
  execution_time: number;
}

export interface FullSweepResult {
  target: {
    name: string;
    email?: string;
    phone?: string;
    username?: string;
    state?: string;
  };
  searched_at: string;
  username_results?: SherlockResult;
  email_results?: HoleheResult;
  phone_results?: PhoneResult;
  summary: string;
  total_profiles_found: number;
  execution_time: number;
}

export interface CombinedUsernameResult {
  username: string;
  searched_at: string;
  sherlock: SherlockResult;
  maigret: MaigretResult;
  combined: {
    total_unique_profiles: number;
    profiles: {
      platform: string;
      url: string;
    }[];
  };
}

export interface BackendHealth {
  status: string;
  timestamp: string;
  tools: {
    sherlock: string;
    maigret: string;
    holehe: string;
    socialscan: string;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if Python OSINT backend is available
 */
export async function checkBackendHealth(): Promise<BackendHealth | null> {
  try {
    const baseUrl = await getBackendUrl();
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.log('Python OSINT backend not available:', error);
    return null;
  }
}

/**
 * Search username using Sherlock (400+ sites)
 */
export async function searchWithSherlock(
  username: string,
  timeout: number = 60
): Promise<SherlockResult> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/sherlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ username, timeout }),
  });

  if (!response.ok) {
    throw new Error(`Sherlock search failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Search username using Maigret (comprehensive)
 */
export async function searchWithMaigret(
  username: string,
  timeout: number = 120
): Promise<MaigretResult> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/maigret`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ username, timeout }),
  });

  if (!response.ok) {
    throw new Error(`Maigret search failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Check email registration using holehe
 */
export async function searchWithHolehe(
  email: string,
  timeout: number = 60
): Promise<HoleheResult> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/holehe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ email, timeout }),
  });

  if (!response.ok) {
    throw new Error(`holehe search failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Full username search using both Sherlock and Maigret
 */
export async function fullUsernameSearch(
  username: string,
  timeout: number = 120
): Promise<CombinedUsernameResult> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/username/full`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ username, timeout }),
  });

  if (!response.ok) {
    throw new Error(`Full username search failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Phone intelligence search
 */
export async function searchPhone(
  phone: string,
  countryCode: string = 'US'
): Promise<PhoneResult> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/phone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ phone, country_code: countryCode }),
  });

  if (!response.ok) {
    throw new Error(`Phone search failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Full OSINT sweep on a target
 */
export async function fullOsintSweep(target: {
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  state?: string;
}): Promise<FullSweepResult> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(`${baseUrl}/api/sweep`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(target),
  });

  if (!response.ok) {
    throw new Error(`OSINT sweep failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Quick socialscan check
 */
export async function quickSocialScan(
  query: string,
  type: 'username' | 'email' = 'username'
): Promise<{
  query: string;
  type: string;
  searched_at: string;
  tool: string;
  results: { platform: string; available: boolean; taken: boolean }[];
  errors: string[];
  execution_time: number;
}> {
  const baseUrl = await getBackendUrl();
  const response = await fetch(
    `${baseUrl}/api/socialscan?query=${encodeURIComponent(query)}&type=${type}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`socialscan failed: ${response.statusText}`);
  }

  return await response.json();
}

// ============================================================================
// Smart Search (with fallback to JS implementation)
// ============================================================================

/**
 * Smart OSINT search - uses Python backend if available, falls back to JS
 */
export async function smartOsintSearch(
  target: {
    name: string;
    email?: string;
    phone?: string;
    username?: string;
    state?: string;
  },
  onProgress?: (message: string, data?: any) => void
): Promise<{
  usedPythonBackend: boolean;
  results: FullSweepResult | null;
  jsResults?: any;
}> {
  // Check if Python backend is available
  onProgress?.('Checking OSINT backend availability...', null);
  const health = await checkBackendHealth();

  if (health && health.status === 'healthy') {
    onProgress?.('Python OSINT backend connected - using Sherlock, Maigret, holehe...', health);

    try {
      onProgress?.(`Running full OSINT sweep on ${target.name}...`, null);
      const results = await fullOsintSweep(target);

      onProgress?.('OSINT sweep complete!', results);

      return {
        usedPythonBackend: true,
        results,
      };
    } catch (error) {
      onProgress?.(`Python backend error: ${error}. Falling back to JS implementation.`, null);
    }
  } else {
    onProgress?.('Python backend not available. Using JavaScript OSINT implementation.', null);
  }

  // Fallback to JS implementation
  // Import the JS OSINT functions dynamically
  const { fullOSINTSweep } = await import('./osint-api');

  try {
    const jsResults = await fullOSINTSweep(target, (step, result) => {
      onProgress?.(step, result);
    });

    return {
      usedPythonBackend: false,
      results: null,
      jsResults,
    };
  } catch (error) {
    onProgress?.(`JS OSINT error: ${error}`, null);
    return {
      usedPythonBackend: false,
      results: null,
      jsResults: null,
    };
  }
}
