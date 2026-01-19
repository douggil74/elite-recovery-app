import type {
  ParsedAddress,
  ParsedPhone,
  ParsedVehicle,
  ParsedEmployment,
} from '@/types';

const CURRENT_YEAR = new Date().getFullYear();

export function rankAddresses(
  addresses: ParsedAddress[],
  phones: ParsedPhone[],
  vehicles: ParsedVehicle[],
  employment: ParsedEmployment[]
): ParsedAddress[] {
  if (addresses.length === 0) return [];

  // Create a map of addresses for cross-referencing
  const addressScores: Map<string, { score: number; reasons: string[]; signals: string[] }> = new Map();

  for (const addr of addresses) {
    const key = normalizeAddress(addr.fullAddress);
    addressScores.set(key, { score: 0, reasons: [], signals: [] });
  }

  // Score each address
  for (const addr of addresses) {
    const key = normalizeAddress(addr.fullAddress);
    const scoreData = addressScores.get(key)!;

    // Recency scoring (most important factor)
    const recencyScore = calculateRecencyScore(addr.toDate);
    scoreData.score += recencyScore * 0.4; // 40% weight
    if (recencyScore > 0.7) {
      scoreData.reasons.push('Recent address record');
    }

    // Current flag
    if (addr.isCurrent) {
      scoreData.score += 0.2;
      scoreData.reasons.push('Marked as current');
    }

    // Check if address appears in vehicle records
    for (const vehicle of vehicles) {
      if (vehicle.registeredAddress && fuzzyMatch(addr.fullAddress, vehicle.registeredAddress)) {
        scoreData.score += 0.1;
        scoreData.reasons.push('Linked to vehicle registration');
        scoreData.signals.push('vehicle');
        break;
      }
    }

    // Check if address appears in employment records
    for (const emp of employment) {
      if (emp.address && fuzzyMatch(addr.fullAddress, emp.address)) {
        scoreData.score += 0.1;
        scoreData.reasons.push('Linked to employment');
        scoreData.signals.push('employment');
        break;
      }
    }

    // Check for phone number correlation (same area code/region)
    const addrAreaCode = extractAreaCode(addr.fullAddress);
    if (addrAreaCode) {
      for (const phone of phones) {
        const phoneAreaCode = phone.number.match(/\((\d{3})\)/)?.[1];
        if (phoneAreaCode === addrAreaCode) {
          scoreData.score += 0.05;
          scoreData.reasons.push('Same area code as contact phone');
          scoreData.signals.push('phone');
          break;
        }
      }
    }

    // Address completeness bonus
    if (addr.city && addr.state && addr.zip) {
      scoreData.score += 0.05;
    }
  }

  // Normalize scores and update addresses
  const scoredAddresses = addresses.map((addr) => {
    const key = normalizeAddress(addr.fullAddress);
    const scoreData = addressScores.get(key)!;
    const confidence = Math.min(1, Math.max(0, scoreData.score));

    return {
      ...addr,
      confidence,
      reasons: scoreData.reasons,
      linkedSignals: scoreData.signals.length > 0 ? scoreData.signals : undefined,
    };
  });

  // Sort by confidence descending
  scoredAddresses.sort((a, b) => b.confidence - a.confidence);

  return scoredAddresses;
}

export function rankPhones(
  phones: ParsedPhone[],
  addresses: ParsedAddress[]
): ParsedPhone[] {
  if (phones.length === 0) return [];

  const scoredPhones = phones.map((phone) => {
    let score = 0;
    const reasons: string[] = [];

    // Active status
    if (phone.isActive) {
      score += 0.3;
      reasons.push('Active line');
    }

    // Phone type scoring
    if (phone.type === 'mobile') {
      score += 0.2;
      reasons.push('Mobile phone');
    } else if (phone.type === 'landline') {
      score += 0.1;
      reasons.push('Landline');
    }

    // Recency scoring
    const recencyScore = calculateRecencyScore(phone.lastSeen);
    score += recencyScore * 0.3;
    if (recencyScore > 0.7) {
      reasons.push('Recent activity');
    }

    // Area code correlation with addresses
    const phoneAreaCode = phone.number.match(/\((\d{3})\)/)?.[1];
    if (phoneAreaCode && addresses.length > 0) {
      // Check if area code matches top address region
      const topAddress = addresses[0];
      const addrAreaCode = extractAreaCode(topAddress.fullAddress);
      if (addrAreaCode === phoneAreaCode) {
        score += 0.1;
        reasons.push('Matches primary address region');
      }
    }

    // Carrier info bonus (indicates verified phone)
    if (phone.carrier) {
      score += 0.05;
    }

    const confidence = Math.min(1, Math.max(0, score));

    return {
      ...phone,
      confidence,
    };
  });

  // Sort by confidence descending
  scoredPhones.sort((a, b) => b.confidence - a.confidence);

  return scoredPhones;
}

function calculateRecencyScore(dateStr?: string): number {
  if (!dateStr) return 0.3; // Unknown date gets middle score

  const upperDate = dateStr.toUpperCase();
  if (upperDate === 'CURRENT' || upperDate === 'PRESENT') {
    return 1.0;
  }

  // Parse the date
  const parsed = parseDate(dateStr);
  if (!parsed) return 0.3;

  const yearsAgo = CURRENT_YEAR - parsed.year;

  if (yearsAgo <= 0) return 1.0; // This year
  if (yearsAgo === 1) return 0.85;
  if (yearsAgo === 2) return 0.7;
  if (yearsAgo <= 5) return 0.5;
  if (yearsAgo <= 10) return 0.3;
  return 0.1;
}

function parseDate(dateStr: string): { year: number; month?: number } | null {
  // Try MM/DD/YYYY or MM-DD-YYYY
  let match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    let year = parseInt(match[3]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    return { year, month: parseInt(match[1]) };
  }

  // Try MM/YYYY or MM-YYYY
  match = dateStr.match(/(\d{1,2})[\/\-](\d{4})/);
  if (match) {
    return { year: parseInt(match[2]), month: parseInt(match[1]) };
  }

  // Try just year
  match = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  if (match) {
    return { year: parseInt(match[1]) };
  }

  return null;
}

function normalizeAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(STREET|ST)\b/g, 'ST')
    .replace(/\b(AVENUE|AVE)\b/g, 'AVE')
    .replace(/\b(DRIVE|DR)\b/g, 'DR')
    .replace(/\b(ROAD|RD)\b/g, 'RD')
    .replace(/\b(LANE|LN)\b/g, 'LN')
    .replace(/\b(BOULEVARD|BLVD)\b/g, 'BLVD')
    .replace(/\b(APARTMENT|APT)\b/g, 'APT')
    .replace(/\b(SUITE|STE)\b/g, 'STE')
    .trim();
}

function fuzzyMatch(addr1: string, addr2: string): boolean {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);

  // Exact match
  if (norm1 === norm2) return true;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Extract street number and name for comparison
  const street1 = norm1.match(/^(\d+)\s+(.+?)(?:\s+(?:APT|STE|UNIT))?(?:,|$)/);
  const street2 = norm2.match(/^(\d+)\s+(.+?)(?:\s+(?:APT|STE|UNIT))?(?:,|$)/);

  if (street1 && street2) {
    // Same street number and similar street name
    if (street1[1] === street2[1]) {
      const streetName1 = street1[2].replace(/\s+/g, '');
      const streetName2 = street2[2].replace(/\s+/g, '');
      if (streetName1.includes(streetName2) || streetName2.includes(streetName1)) {
        return true;
      }
    }
  }

  return false;
}

function extractAreaCode(address: string): string | null {
  // This is a simplified approach - in production, you'd use a proper
  // zip code to area code mapping
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!zipMatch) return null;

  const zip = zipMatch[1];
  // Map common zip code prefixes to area codes (simplified)
  // In production, use a proper database
  const zipPrefix = zip.substring(0, 3);

  const zipToAreaCode: Record<string, string> = {
    '100': '212', // NYC
    '101': '212',
    '102': '212',
    '103': '212',
    '104': '212',
    '105': '914', // Westchester
    '106': '914',
    '107': '914',
    '900': '310', // LA
    '901': '310',
    '902': '310',
    '903': '310',
    '904': '310',
    '770': '404', // Atlanta
    '771': '404',
    '600': '312', // Chicago
    '601': '312',
    '602': '312',
    '330': '216', // Cleveland
    '331': '216',
    '750': '214', // Dallas
    '751': '214',
    '752': '214',
  };

  return zipToAreaCode[zipPrefix] || null;
}

export function generateLocationBrief(
  rankedAddresses: ParsedAddress[]
): { rank: number; address: ParsedAddress; whyLikely: string[] }[] {
  return rankedAddresses.slice(0, 5).map((addr, index) => ({
    rank: index + 1,
    address: addr,
    whyLikely: addr.reasons,
  }));
}
