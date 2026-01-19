import {
  SECTION_PATTERNS,
  DATA_PATTERNS,
  PHONE_TYPE_PATTERNS,
  EMPLOYMENT_STATUS,
} from './patterns';
import { rankAddresses, rankPhones } from './ranker';
import type {
  ParsedReport,
  Subject,
  ParsedAddress,
  ParsedPhone,
  ParsedRelative,
  ParsedVehicle,
  ParsedEmployment,
  ReportFlag,
} from '@/types';

export interface ParseResult {
  success: boolean;
  data?: ParsedReport;
  parseMethod: 'deterministic' | 'ai' | 'hybrid';
  confidence: number;
  error?: string;
}

export function parseReportText(text: string): ParseResult {
  try {
    if (!text || typeof text !== 'string') {
      return {
        success: false,
        parseMethod: 'deterministic',
        confidence: 0,
        error: 'No text provided for parsing',
      };
    }

    const normalizedText = normalizeText(text);
    const sections = extractSections(normalizedText);

    const subject = parseSubject(normalizedText, sections.subject);
    const addresses = parseAddresses(normalizedText, sections.addresses);
    const phones = parsePhones(normalizedText, sections.phones);
    const relatives = parseRelatives(normalizedText, sections.relatives);
    const vehicles = parseVehicles(normalizedText, sections.vehicles);
    const employment = parseEmployment(normalizedText, sections.employment);
    const flags = parseFlags(normalizedText);

    // Rank addresses and phones
    const rankedAddresses = rankAddresses(addresses, phones, vehicles, employment);
    const rankedPhones = rankPhones(phones, addresses);

    // Calculate overall confidence
    const confidence = calculateConfidence(subject, rankedAddresses, rankedPhones);

    const report: ParsedReport = {
      subject,
      addresses: rankedAddresses,
      phones: rankedPhones,
      relatives,
      vehicles,
      employment,
      flags,
      recommendations: generateRecommendations(subject, rankedAddresses, rankedPhones, relatives),
      parseMethod: 'deterministic',
      parseConfidence: confidence,
    };

    return {
      success: true,
      data: report,
      parseMethod: 'deterministic',
      confidence,
    };
  } catch (error) {
    return {
      success: false,
      parseMethod: 'deterministic',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

interface SectionMap {
  subject: string;
  addresses: string;
  phones: string;
  relatives: string;
  vehicles: string;
  employment: string;
  aliases: string;
}

function extractSections(text: string): SectionMap {
  const sections: SectionMap = {
    subject: '',
    addresses: '',
    phones: '',
    relatives: '',
    vehicles: '',
    employment: '',
    aliases: '',
  };

  // Find section boundaries
  const lines = text.split('\n');
  let currentSection: keyof SectionMap | null = null;
  let sectionContent: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line starts a new section
    let newSection: keyof SectionMap | null = null;

    for (const [sectionName, patterns] of Object.entries(SECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(trimmedLine)) {
          newSection = sectionName as keyof SectionMap;
          break;
        }
      }
      if (newSection) break;
    }

    if (newSection) {
      // Save previous section
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection] = sectionContent.join('\n');
      }
      currentSection = newSection;
      sectionContent = [trimmedLine];
    } else if (currentSection) {
      sectionContent.push(trimmedLine);
    }
  }

  // Save last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join('\n');
  }

  // If no sections found, use full text for subject
  if (!sections.subject) {
    sections.subject = text.substring(0, 2000);
  }

  return sections;
}

function parseSubject(fullText: string, sectionText: string): Subject {
  const searchText = sectionText || fullText.substring(0, 3000);

  // Extract name - try multiple approaches
  let fullName = 'Unknown';

  // First, try the standard pattern
  const nameMatch = searchText.match(DATA_PATTERNS.fullName);
  if (nameMatch) {
    fullName = nameMatch[1].trim();
  }

  // If that didn't work, try "Subject: NAME DOB:" format (Standard Comprehensive Report)
  if (fullName === 'Unknown') {
    const altNameMatch = searchText.match(/Subject\s*:\s*([A-Z][A-Z\s\-'\.]+?)\s+(?:DOB|SSN|\()/i);
    if (altNameMatch) {
      fullName = altNameMatch[1].trim();
    }
  }

  // Try another format: just a line with all caps name
  if (fullName === 'Unknown') {
    const capsNameMatch = searchText.match(/^([A-Z][A-Z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][A-Z]+){1,3})$/m);
    if (capsNameMatch) {
      fullName = capsNameMatch[1].trim();
    }
  }

  // Extract DOB
  let dob: string | undefined;
  for (const pattern of DATA_PATTERNS.dob) {
    const match = searchText.match(pattern);
    if (match) {
      dob = match[1];
      break;
    }
  }

  // Extract partial SSN (last 4 only)
  let partialSsn: string | undefined;

  // Try to extract from format like "SSN: 436-21-####" (masked) or "SSN: 436-21-1234"
  const ssnFullMatch = searchText.match(/SSN\s*:\s*(\d{3})[- ]?(\d{2})[- ]?(\d{4}|#+)/i);
  if (ssnFullMatch) {
    if (ssnFullMatch[3] && !/^#+$/.test(ssnFullMatch[3])) {
      // Last 4 are actual digits
      partialSsn = `***-**-${ssnFullMatch[3]}`;
    } else {
      // Last 4 are masked, use the middle 2 for verification note
      partialSsn = `***-**-****`;
    }
  } else {
    // Try standard patterns
    for (const pattern of DATA_PATTERNS.ssn) {
      const match = searchText.match(pattern);
      if (match && match[1]) {
        partialSsn = `***-**-${match[1]}`;
        break;
      }
    }
  }

  // Extract Person ID
  let personId: string | undefined;
  const idMatch = searchText.match(DATA_PATTERNS.personId);
  if (idMatch) {
    personId = idMatch[1];
  }

  // Check for deceased indicator
  const deceasedIndicator = DATA_PATTERNS.deceased.test(fullText);

  // Extract aliases from alias section or full text
  const aliases: string[] = [];
  const aliasSection = fullText.match(/(?:ALIAS|AKA|ALSO KNOWN AS)[:\s]+([^\n]+(?:\n(?![A-Z]{2,})[^\n]+)*)/i);
  if (aliasSection) {
    const aliasText = aliasSection[1];
    const aliasNames = aliasText.split(/[,;]|\n/).map((a) => a.trim()).filter((a) => a.length > 2 && !/^\d+$/.test(a));
    aliases.push(...aliasNames.slice(0, 10)); // Limit to 10 aliases
  }

  return {
    fullName,
    dob,
    partialSsn,
    personId,
    deceasedIndicator,
    aliases: aliases.length > 0 ? aliases : undefined,
  };
}

function parseAddresses(fullText: string, sectionText: string): ParsedAddress[] {
  const searchText = sectionText || fullText;
  const addresses: ParsedAddress[] = [];
  const seenAddresses = new Set<string>();

  // Split into lines for context-aware parsing
  const lines = searchText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const contextLines = lines.slice(Math.max(0, i - 2), i + 3).join(' ');

    // Try to extract full address
    const addressMatches = line.match(DATA_PATTERNS.address);
    if (addressMatches) {
      for (const addr of addressMatches) {
        const normalized = addr.trim().toUpperCase();
        if (!seenAddresses.has(normalized)) {
          seenAddresses.add(normalized);

          // Parse city/state/zip
          const cityStateMatch = addr.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);

          // Extract date range from context
          const { fromDate, toDate } = extractDateRange(contextLines);

          // Check if current
          const isCurrent = /CURRENT|PRESENT/i.test(contextLines) ||
            (typeof toDate === 'string' && toDate.length > 0 && /CURRENT|PRESENT/i.test(toDate));

          addresses.push({
            address: addr.split(',')[0]?.trim() || addr,
            city: cityStateMatch ? cityStateMatch[1].trim() : undefined,
            state: cityStateMatch ? cityStateMatch[2] : undefined,
            zip: cityStateMatch ? cityStateMatch[3] : undefined,
            fullAddress: addr.trim(),
            fromDate,
            toDate: isCurrent ? 'Current' : toDate,
            confidence: 0.5, // Will be updated by ranker
            reasons: [],
            isCurrent: isCurrent || undefined,
          });
        }
      }
    }

    // Try street address pattern
    const streetMatches = line.match(DATA_PATTERNS.streetAddress);
    if (streetMatches) {
      for (const street of streetMatches) {
        // Look for city/state/zip in same or next line
        const nextLineContext = lines.slice(i, i + 2).join(' ');
        const cityStateMatch = nextLineContext.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);

        if (cityStateMatch) {
          const fullAddr = `${street.trim()}, ${cityStateMatch[0]}`;
          const normalized = fullAddr.toUpperCase();

          if (!seenAddresses.has(normalized)) {
            seenAddresses.add(normalized);

            const { fromDate, toDate } = extractDateRange(contextLines);
            const isCurrent = /CURRENT|PRESENT/i.test(contextLines);

            addresses.push({
              address: street.trim(),
              city: cityStateMatch[1].trim(),
              state: cityStateMatch[2],
              zip: cityStateMatch[3],
              fullAddress: fullAddr,
              fromDate,
              toDate: isCurrent ? 'Current' : toDate,
              confidence: 0.5,
              reasons: [],
              isCurrent,
            });
          }
        }
      }
    }
  }

  return addresses;
}

function extractDateRange(text: string): { fromDate?: string; toDate?: string } {
  for (const pattern of DATA_PATTERNS.dateRange) {
    const match = text.match(pattern);
    if (match) {
      return {
        fromDate: match[1],
        toDate: match[2] || undefined,
      };
    }
  }
  return {};
}

function parsePhones(fullText: string, sectionText: string): ParsedPhone[] {
  const searchText = sectionText || fullText;
  const phones: ParsedPhone[] = [];
  const seenPhones = new Set<string>();

  // Split into lines for context
  const lines = searchText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const contextLine = lines.slice(Math.max(0, i - 1), i + 2).join(' ');

    for (const pattern of DATA_PATTERNS.phone) {
      const matches = line.match(pattern);
      if (matches) {
        for (const phone of matches) {
          const normalized = phone.replace(/\D/g, '');
          if (normalized.length >= 10 && !seenPhones.has(normalized)) {
            seenPhones.add(normalized);

            // Determine phone type
            let type: ParsedPhone['type'] = 'unknown';
            if (PHONE_TYPE_PATTERNS.mobile.test(contextLine)) type = 'mobile';
            else if (PHONE_TYPE_PATTERNS.landline.test(contextLine)) type = 'landline';
            else if (PHONE_TYPE_PATTERNS.voip.test(contextLine)) type = 'voip';

            // Extract dates
            const { fromDate, toDate } = extractDateRange(contextLine);

            // Check if active
            const isActive = /ACTIVE|CURRENT|CONNECTED/i.test(contextLine);

            phones.push({
              number: formatPhone(normalized),
              type,
              firstSeen: fromDate,
              lastSeen: toDate,
              confidence: 0.5,
              isActive,
            });
          }
        }
      }
    }
  }

  return phones;
}

function formatPhone(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits;
}

function parseRelatives(fullText: string, sectionText: string): ParsedRelative[] {
  const searchText = sectionText || fullText;
  const relatives: ParsedRelative[] = [];

  // Split into blocks (each relative entry usually separated by blank lines or headers)
  const blocks = searchText.split(/\n{2,}|(?=Name:|(?:[A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n)/);

  for (const block of blocks) {
    if (block.trim().length < 10) continue;

    // Try to extract name
    const nameMatch = block.match(/(?:Name[:\s]*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();

    // Skip if it looks like a section header
    if (/^(?:RELATIVE|ASSOCIATE|FAMILY|POSSIBLE)/i.test(name)) continue;

    // Extract relationship
    const relMatch = block.match(DATA_PATTERNS.relationship);
    const relationship = relMatch ? relMatch[1] : undefined;

    // Extract age
    const ageMatch = block.match(/\bAGE[:\s]*(\d{1,3})\b/i);
    const age = ageMatch ? parseInt(ageMatch[1]) : undefined;

    // Extract phone
    const phoneMatch = block.match(DATA_PATTERNS.phone[0]);
    const phones = phoneMatch ? [formatPhone(phoneMatch[0].replace(/\D/g, ''))] : undefined;

    // Extract address
    const addrMatch = block.match(DATA_PATTERNS.address);
    const currentAddress = addrMatch ? addrMatch[0].trim() : undefined;

    relatives.push({
      name,
      relationship,
      age,
      phones,
      currentAddress,
      confidence: 0.6,
    });
  }

  return relatives.slice(0, 20); // Limit to 20 relatives
}

function parseVehicles(fullText: string, sectionText: string): ParsedVehicle[] {
  const searchText = sectionText || fullText;
  const vehicles: ParsedVehicle[] = [];

  // Split into vehicle entries
  const blocks = searchText.split(/\n{2,}|(?=VIN:|Vehicle:|(?:\d{4}\s+[A-Z]))/i);

  for (const block of blocks) {
    if (block.trim().length < 10) continue;

    // Extract VIN
    const vinMatch = block.match(DATA_PATTERNS.vin);
    const vin = vinMatch ? vinMatch[1] : undefined;

    // Extract license plate
    const plateMatch = block.match(DATA_PATTERNS.licensePlate);
    const plate = plateMatch ? plateMatch[1] : undefined;

    // Extract year
    const yearMatch = block.match(/\b(19\d{2}|20[0-2]\d)\b/);
    const year = yearMatch ? yearMatch[1] : undefined;

    // Extract make/model
    const makeModelMatch = block.match(DATA_PATTERNS.vehicleMakeModel);
    let make: string | undefined;
    let model: string | undefined;
    if (makeModelMatch && makeModelMatch[1]) {
      const parts = makeModelMatch[1].split(/\s+/);
      make = parts[0];
      model = parts.slice(1).join(' ') || undefined;
    }

    // Extract color
    const colorMatch = block.match(/\b(BLACK|WHITE|SILVER|GRAY|GREY|RED|BLUE|GREEN|GOLD|BEIGE|BROWN|TAN|YELLOW|ORANGE|PURPLE)\b/i);
    const color = colorMatch ? colorMatch[1] : undefined;

    // Extract state
    const stateMatch = block.match(/\b([A-Z]{2})\s*(?:PLATE|TAG|LICENSE)/i);
    const state = stateMatch ? stateMatch[1] : undefined;

    // Only add if we have meaningful data
    if (vin || plate || (year && make)) {
      vehicles.push({
        year,
        make,
        model,
        color,
        vin,
        plate,
        state,
      });
    }
  }

  return vehicles.slice(0, 10); // Limit to 10 vehicles
}

function parseEmployment(fullText: string, sectionText: string): ParsedEmployment[] {
  const searchText = sectionText || fullText;
  const employment: ParsedEmployment[] = [];

  // Split into employment entries
  const blocks = searchText.split(/\n{2,}|(?=Employer:|Company:|EMPLOYMENT)/i);

  for (const block of blocks) {
    if (block.trim().length < 10) continue;

    // Extract employer name
    const employerMatch = block.match(/(?:Employer|Company|Business)[:\s]*([A-Za-z0-9\s&\-\.]+?)(?:\n|$)/i);
    const employer = employerMatch ? employerMatch[1].trim() : undefined;

    if (!employer) continue;

    // Extract title
    const titleMatch = block.match(/(?:Title|Position|Role)[:\s]*([A-Za-z\s\-]+?)(?:\n|$)/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract address
    const addrMatch = block.match(DATA_PATTERNS.address);
    const address = addrMatch ? addrMatch[0].trim() : undefined;

    // Extract phone
    const phoneMatch = block.match(DATA_PATTERNS.phone[0]);
    const phone = phoneMatch ? formatPhone(phoneMatch[0].replace(/\D/g, '')) : undefined;

    // Extract dates
    const { fromDate, toDate } = extractDateRange(block);

    // Check if current
    const isCurrent = EMPLOYMENT_STATUS.current.test(block) ||
      (typeof toDate === 'string' && toDate.length > 0 && /CURRENT|PRESENT/i.test(toDate));

    employment.push({
      employer,
      title,
      address,
      phone,
      fromDate,
      toDate: isCurrent ? 'Current' : toDate,
      isCurrent: isCurrent || undefined,
    });
  }

  return employment.slice(0, 10); // Limit to 10 employers
}

function parseFlags(fullText: string): ReportFlag[] {
  const flags: ReportFlag[] = [];
  const seenMessages = new Set<string>();

  // Check for deceased - only if it's about the subject specifically
  // Don't flag if "Deceased" appears only in relatives section
  const firstSection = fullText.substring(0, 500); // Check only the subject area
  if (DATA_PATTERNS.deceased.test(firstSection)) {
    flags.push({
      type: 'deceased',
      message: 'Subject may be deceased - verify before proceeding',
      severity: 'high',
    });
    seenMessages.add('deceased');
  }

  // Check for active warrants
  const warrantMatches = fullText.match(DATA_PATTERNS.riskFlags.warrant);
  if (warrantMatches && warrantMatches.length > 0) {
    flags.push({
      type: 'high_risk',
      message: 'Active warrant on file',
      severity: 'high',
    });
  }

  // Check for fraud alerts
  const fraudMatches = fullText.match(DATA_PATTERNS.riskFlags.fraud);
  if (fraudMatches && fraudMatches.length > 0) {
    flags.push({
      type: 'fraud_alert',
      message: 'Fraud alert on file',
      severity: 'high',
    });
  }

  return flags;
}

function calculateConfidence(
  subject: Subject,
  addresses: ParsedAddress[],
  phones: ParsedPhone[]
): number {
  let score = 0;
  let factors = 0;

  // Subject completeness
  if (subject.fullName && subject.fullName !== 'Unknown') {
    score += 0.2;
    factors++;
  }
  if (subject.dob) {
    score += 0.15;
    factors++;
  }
  if (subject.partialSsn) {
    score += 0.15;
    factors++;
  }

  // Address quality
  if (addresses.length > 0) {
    const topAddr = addresses[0];
    score += Math.min(0.25, topAddr.confidence * 0.25);
    factors++;
  }

  // Phone quality
  if (phones.length > 0) {
    const topPhone = phones[0];
    score += Math.min(0.25, topPhone.confidence * 0.25);
    factors++;
  }

  return factors > 0 ? score / (factors * 0.2) : 0;
}

function generateRecommendations(
  subject: Subject,
  addresses: ParsedAddress[],
  phones: ParsedPhone[],
  relatives: ParsedRelative[]
): string[] {
  const recommendations: string[] = [];

  // Based on subject info
  if (subject.deceasedIndicator) {
    recommendations.push('VERIFY: Deceased indicator present - confirm status before proceeding');
  }

  // Based on addresses
  if (addresses.length === 0) {
    recommendations.push('No addresses found - may need additional data sources');
  } else if (addresses[0].confidence < 0.5) {
    recommendations.push('Low confidence on current address - verify through additional means');
  }

  // Based on phones
  if (phones.length === 0) {
    recommendations.push('No phone numbers found - check relatives for contact options');
  } else {
    const activePhones = phones.filter((p) => p.isActive);
    if (activePhones.length > 0) {
      recommendations.push(`${activePhones.length} active phone number(s) - prioritize these for contact`);
    }
  }

  // Based on relatives
  if (relatives.length > 0) {
    const withAddress = relatives.filter((r) => r.currentAddress);
    if (withAddress.length > 0) {
      recommendations.push(`${withAddress.length} relative(s) with known addresses - potential leads`);
    }
  }

  return recommendations;
}

export { rankAddresses, rankPhones } from './ranker';
