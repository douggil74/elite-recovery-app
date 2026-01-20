/**
 * OSINT Person Search API
 * Comprehensive person search across multiple data sources
 * Self-sufficient - aggregates all OSINT capabilities
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PersonSearchResult {
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

// Generate username variations from a full name
function generateUsernameVariations(fullName: string): string[] {
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
  variations.add(first);
  variations.add(last);

  // With middle initial
  if (middle) {
    variations.add(`${first}${middle.charAt(0)}${last}`);
    variations.add(`${first}.${middle.charAt(0)}.${last}`);
  }

  // Common patterns with numbers
  for (const year of ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '00', '01', '02', '03', '04', '05']) {
    variations.add(`${first}${last}${year}`);
    variations.add(`${first}_${last}${year}`);
  }

  // Without vowels (common username pattern)
  const noVowels = `${first}${last}`.replace(/[aeiou]/gi, '');
  if (noVowels.length >= 3) {
    variations.add(noVowels);
  }

  return Array.from(variations).slice(0, 20);
}

// Generate comprehensive search links
function generateSearchLinks(name: string, state?: string, city?: string) {
  const encodedName = encodeURIComponent(name);
  const encodedNameDash = encodeURIComponent(name.replace(/ /g, '-'));
  const encodedNamePlus = encodeURIComponent(name.replace(/ /g, '+'));
  const locationQuery = state ? `+${state}` : '';

  return [
    // Social Media
    { category: 'Social Media', name: 'Facebook', url: `https://www.facebook.com/search/people/?q=${encodedName}`, description: 'Search Facebook profiles' },
    { category: 'Social Media', name: 'Instagram', url: `https://www.google.com/search?q=site:instagram.com+"${encodedName}"`, description: 'Search Instagram via Google' },
    { category: 'Social Media', name: 'TikTok', url: `https://www.tiktok.com/search?q=${encodedName}`, description: 'Search TikTok profiles' },
    { category: 'Social Media', name: 'Twitter/X', url: `https://twitter.com/search?q=${encodedName}&f=user`, description: 'Search Twitter users' },
    { category: 'Social Media', name: 'LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${encodedName}`, description: 'Search LinkedIn profiles' },
    { category: 'Social Media', name: 'Snapchat', url: `https://www.snapchat.com/add/${name.toLowerCase().replace(/ /g, '')}`, description: 'Check Snapchat username' },
    { category: 'Social Media', name: 'Reddit', url: `https://www.reddit.com/search/?q=${encodedName}&type=user`, description: 'Search Reddit users' },

    // People Search
    { category: 'People Search', name: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/results?name=${encodedName}${locationQuery}`, description: 'Free people search' },
    { category: 'People Search', name: 'FastPeopleSearch', url: `https://www.fastpeoplesearch.com/name/${encodedNameDash}`, description: 'Fast people lookup' },
    { category: 'People Search', name: 'Whitepages', url: `https://www.whitepages.com/name/${encodedNameDash}`, description: 'Whitepages directory' },
    { category: 'People Search', name: 'Spokeo', url: `https://www.spokeo.com/${encodedNameDash}`, description: 'Aggregated people data' },
    { category: 'People Search', name: "That's Them", url: `https://thatsthem.com/name/${encodedNameDash}`, description: 'People finder' },
    { category: 'People Search', name: 'PeekYou', url: `https://www.peekyou.com/search?fn=${name.split(' ')[0]}&ln=${name.split(' ').slice(-1)[0]}`, description: 'Social profile aggregator' },
    { category: 'People Search', name: 'ZabaSearch', url: `https://www.zabasearch.com/search?searchreason=search_people&search_term=${encodedNamePlus}`, description: 'Free people search' },
    { category: 'People Search', name: 'Radaris', url: `https://radaris.com/p/${encodedNameDash}/`, description: 'Background check data' },
    { category: 'People Search', name: 'BeenVerified', url: `https://www.beenverified.com/people/${encodedNameDash}/`, description: 'Comprehensive background' },
    { category: 'People Search', name: 'Intelius', url: `https://www.intelius.com/people-search/${encodedNameDash}`, description: 'People intelligence' },

    // Court Records
    { category: 'Court Records', name: 'CourtListener', url: `https://www.courtlistener.com/?q=${encodedName}&type=r`, description: 'Federal court records' },
    { category: 'Court Records', name: 'PACER', url: `https://www.google.com/search?q=site:pacer.uscourts.gov+"${encodedName}"`, description: 'Federal court filings' },
    { category: 'Court Records', name: 'UniCourt', url: `https://unicourt.com/search?q=${encodedName}`, description: 'Court case search' },
    { category: 'Court Records', name: 'State Courts', url: `https://www.google.com/search?q="${encodedName}"+court+records${locationQuery}`, description: 'State court search' },
    { category: 'Court Records', name: 'Docket Alarm', url: `https://www.docketalarm.com/search/?q=${encodedName}`, description: 'Legal docket search' },

    // Criminal/Arrest
    { category: 'Criminal Records', name: 'Mugshots', url: `https://www.google.com/search?q="${encodedName}"+mugshot+arrest`, description: 'Mugshot search' },
    { category: 'Criminal Records', name: 'JailBase', url: `https://www.google.com/search?q=site:jailbase.com+"${encodedName}"`, description: 'Jail booking records' },
    { category: 'Criminal Records', name: 'BustedNewspaper', url: `https://www.google.com/search?q=site:bustednewspaper.com+"${encodedName}"`, description: 'Arrest news' },
    { category: 'Criminal Records', name: 'VINELink', url: `https://www.vinelink.com/#/search`, description: 'Offender custody status' },
    { category: 'Criminal Records', name: 'Sex Offender', url: `https://www.nsopw.gov/search?searchname=${encodedName}`, description: 'National sex offender registry' },

    // Property Records
    { category: 'Property Records', name: 'County Assessor', url: `https://www.google.com/search?q="${encodedName}"+property+assessor${locationQuery}`, description: 'Property ownership' },
    { category: 'Property Records', name: 'Zillow', url: `https://www.google.com/search?q=site:zillow.com+"${encodedName}"`, description: 'Real estate records' },
    { category: 'Property Records', name: 'Redfin', url: `https://www.google.com/search?q=site:redfin.com+"${encodedName}"`, description: 'Property sales' },

    // Business Records
    { category: 'Business Records', name: 'OpenCorporates', url: `https://opencorporates.com/officers?utf8=%E2%9C%93&q=${encodedName}`, description: 'Corporate officer search' },
    { category: 'Business Records', name: 'Corp Wiki', url: `https://corpwiki.com/search/?q=${encodedName}`, description: 'Business connections' },
    { category: 'Business Records', name: 'Crunchbase', url: `https://www.crunchbase.com/discover/people/0/people?q=${encodedName}`, description: 'Startup/business profiles' },
    { category: 'Business Records', name: 'Bloomberg', url: `https://www.bloomberg.com/search?query=${encodedName}`, description: 'Business leaders' },

    // News & Media
    { category: 'News', name: 'Google News', url: `https://news.google.com/search?q="${encodedName}"`, description: 'News mentions' },
    { category: 'News', name: 'Newspapers.com', url: `https://www.newspapers.com/search/#query=${encodedName}`, description: 'Historical newspapers' },
    { category: 'News', name: 'Archive.org', url: `https://web.archive.org/web/*/https://*${name.replace(/ /g, '*')}*`, description: 'Internet archive' },

    // Images
    { category: 'Images', name: 'Google Images', url: `https://www.google.com/search?tbm=isch&q="${encodedName}"`, description: 'Image search' },
    { category: 'Images', name: 'Bing Images', url: `https://www.bing.com/images/search?q="${encodedName}"`, description: 'Bing image search' },
    { category: 'Images', name: 'Yandex Images', url: `https://yandex.com/images/search?text="${encodedName}"`, description: 'Yandex image search' },

    // Username Search
    { category: 'Username Search', name: 'WhatsMyName', url: `https://whatsmyname.app/?q=${name.toLowerCase().replace(/ /g, '')}`, description: 'Username across 400+ sites' },
    { category: 'Username Search', name: 'Namechk', url: `https://namechk.com/`, description: 'Username availability' },
    { category: 'Username Search', name: 'KnowEm', url: `https://knowem.com/checkusernames.php`, description: 'Brand username search' },

    // Professional
    { category: 'Professional', name: 'Xing', url: `https://www.xing.com/search/members?keywords=${encodedName}`, description: 'European LinkedIn' },
    { category: 'Professional', name: 'AngelList', url: `https://angel.co/search?q=${encodedName}`, description: 'Startup profiles' },
    { category: 'Professional', name: 'GitHub', url: `https://github.com/search?q=${encodedName}&type=users`, description: 'Developer profiles' },

    // Dating
    { category: 'Dating', name: 'Tinder (via Google)', url: `https://www.google.com/search?q=site:gotinder.com+"${encodedName}"`, description: 'Tinder profile search' },
    { category: 'Dating', name: 'PlentyOfFish', url: `https://www.google.com/search?q=site:pof.com+"${encodedName}"`, description: 'POF profile search' },

    // Genealogy
    { category: 'Genealogy', name: 'FamilySearch', url: `https://www.familysearch.org/search/record/results?q.anyPlace=${encodedName}`, description: 'Family history' },
    { category: 'Genealogy', name: 'Ancestry', url: `https://www.ancestry.com/search/?name=${encodedName}`, description: 'Ancestry records' },
    { category: 'Genealogy', name: 'FindAGrave', url: `https://www.findagrave.com/memorial/search?firstname=${name.split(' ')[0]}&lastname=${name.split(' ').slice(-1)[0]}`, description: 'Cemetery records' },

    // Scam/Fraud Research
    { category: 'Fraud Research', name: 'Social Catfish', url: `https://www.social-catfish.com/search/results?q=${encodedName}`, description: 'Scam/catfish detection' },
    { category: 'Fraud Research', name: 'ScamDigger', url: `https://scamdigger.com/search?q=${encodedName}`, description: 'Romance scam database' },
    { category: 'Fraud Research', name: 'ScamWarners', url: `https://www.scamwarners.com/search/?q=${encodedName}`, description: 'Scam reports' },
    { category: 'Fraud Research', name: 'RomanceScam', url: `https://www.romancescam.com/search/?q=${encodedName}`, description: 'Romance fraud database' },
  ];
}

// Generate investigation tips based on name
function generateTips(name: string): string[] {
  return [
    '📱 Check each social media platform for the target and their known associates',
    '🔗 Look for tagged photos on relatives\' accounts - fugitives often appear in family posts',
    '📍 Monitor location-tagged posts and check-ins',
    '💼 LinkedIn can reveal current employer and workplace location',
    '🚗 Search for vehicle registration in property/DMV records',
    '📞 Use phone numbers from documents to reverse-lookup on social media',
    '👥 Build a network map - who are they closest to?',
    '📧 Try email variations: firstname.lastname@gmail.com, firstnamelastname@yahoo.com',
    '🏠 Check property records for owned/rented properties',
    '⚖️ Monitor court records for new appearances or bond modifications',
    '🔔 Set up Google Alerts for the name to catch new mentions',
    '📸 Use reverse image search on any photos to find other profiles',
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const name = (req.query.name as string) || (req.body?.name as string);
  const state = (req.query.state as string) || (req.body?.state as string);
  const city = (req.query.city as string) || (req.body?.city as string);

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Clean name
  const cleanName = name.trim().replace(/\s+/g, ' ');

  const usernameVariations = generateUsernameVariations(cleanName);
  const searchLinks = generateSearchLinks(cleanName, state, city);
  const tips = generateTips(cleanName);

  const result: PersonSearchResult = {
    name: cleanName,
    searchedAt: new Date().toISOString(),
    usernameVariations,
    searchLinks,
    tips,
  };

  return res.status(200).json(result);
}
