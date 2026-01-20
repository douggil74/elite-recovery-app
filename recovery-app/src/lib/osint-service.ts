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
