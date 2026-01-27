/**
 * Bail Bond Document Analyzer - Claude Edition
 * Analyzes bail bond PDFs (bondsman paperwork, check-in logs, court records, etc.)
 * and extracts structured intelligence for fugitive recovery
 */

import Anthropic from '@anthropic-ai/sdk';

// Always use Haiku 3.5 - fastest and most cost-effective for document extraction
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
const CHUNK_SIZE = 90000; // chars per chunk - Haiku 3.5 has 200K context
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

export interface BailDocumentAnalysis {
  success: boolean;
  report?: ParsedReport;
  summary?: string;
  documentTypes?: string[];
  error?: string;
  isAssociateDocument?: boolean; // True if this doc is about someone other than the primary target
}

export interface PrimaryTargetContext {
  fullName: string;
  dob?: string;
  aliases?: string[];
}

const CLAUDE_SYSTEM_PROMPT = `You are TRACE - Tactical Recovery Analysis & Case Engine - an elite intelligence analyst for licensed bail recovery professionals.

Your job is to analyze bail bond documents and generate comprehensive INTELLIGENCE REPORTS that help agents LOCATE and APPREHEND fugitives. You don't just extract data - you ANALYZE patterns, PREDICT behavior, and RECOMMEND surveillance strategies.

DOCUMENT TYPES YOU'LL SEE:
- Bail bond applications (defendant info, references, employment)
- Check-in logs (locations where defendant reported, timestamps)
- Court documents (charges, case numbers, court dates)
- Intake/booking forms (physical description, identifiers)
- Reference pages (contacts, family, employers)
- Notes from bondsman (movement patterns, concerns)
- **DELVEPOINT/SKIP TRACE COMPREHENSIVE REPORTS** - These are MASSIVE data dumps containing:
  - Full address history (10-30+ addresses with dates)
  - 1st/2nd/3rd degree relatives with DOBs, phones, addresses
  - Complete phone history (current and historical)
  - Vehicle history (all registrations with VINs)
  - Employment history
  - Property records, liens, bankruptcies, foreclosures
  - Email addresses and social media
  - Criminal records and court filings

  For Delvepoint reports: Extract EVERY relative, EVERY address, EVERY phone. These are gold mines.

CRITICAL ANALYSIS RULES:

1. **ANCHOR POINTS vs TRANSIENT LOCATIONS**
   - ANCHOR POINTS: Places they RETURN TO repeatedly (family homes, girlfriend's house, regular employer)
   - TRANSIENT: One-time stops (truck stops, gas stations, rest areas, travel plazas)
   - For check-in data, identify which locations are ANCHORS vs TRANSIENT
   - Truck stops, travel centers, "Love's", "Pilot", "Flying J", rest areas = TRANSIENT (ignore for apprehension)
   - Residential addresses with 2+ check-ins = HIGH VALUE ANCHOR

2. **TRUCK DRIVER PATTERN ANALYSIS** (if applicable)
   - Truck drivers check in from the road - most locations are one-nighters, NOT where they live
   - Look for REPEATED locations - that's where they actually go between routes
   - Family addresses (especially mother's house) are #1 anchor points
   - Identify their "home base" - where they return between routes

3. **PREDICTION MODEL**
   - Based on check-in patterns, predict WHEN they'll be at an anchor point
   - Weekly patterns? Bi-weekly? Monthly?
   - Which day of week do they typically return home?

4. **SURVEILLANCE RECOMMENDATIONS**
   - Best times to find subject at anchor locations
   - Which contacts are most likely to lead to subject
   - Warning signs (weapons, associates, dogs, etc.)

Return your response as a JSON object with this EXACT structure:
{
  "documentTypes": ["bail_application", "check_in_log", "court_record", etc.],
  "subject": {
    "fullName": "LAST, First Middle",
    "aliases": [],
    "dob": "MM/DD/YYYY",
    "ssn": "XXXX (last 4 only)",
    "phone": "primary phone",
    "email": "email if found",
    "cid": "customer/client ID",
    "driversLicense": "state and number",
    "height": "5'10\"",
    "weight": "180 lbs",
    "eyeColor": "brown",
    "hairColor": "black",
    "tattoos": ["description and location"],
    "scars": ["description and location"]
  },
  "bondInfo": {
    "totalAmount": 35000,
    "charges": [
      {
        "charge": "CHARGE DESCRIPTION",
        "bondAmount": 20000,
        "caseNumber": "case#",
        "court": "court name",
        "filingDate": "date"
      }
    ],
    "bondsman": "bondsman name",
    "powerNumber": "power#",
    "bondDate": "date bond was posted",
    "courtDates": ["upcoming court dates"]
  },
  "checkIns": [
    {
      "date": "MM/DD/YYYY",
      "location": "full address or city/state",
      "city": "city",
      "state": "ST",
      "notes": "any notes about this check-in"
    }
  ],
  "addresses": [
    {
      "address": "street address",
      "city": "city",
      "state": "ST",
      "zip": "zip",
      "type": "residence|work|family|check-in|unknown",
      "dateReported": "when this address was given",
      "source": "which document mentioned this"
    }
  ],
  "cosigners": [
    {
      "name": "Full Name",
      "relationship": "mother|spouse|friend|etc",
      "phone": "phone number",
      "address": "full address",
      "employer": "employer name",
      "source": "bail application|indemnitor agreement"
    }
  ],
  "references": [
    {
      "name": "Full Name",
      "relationship": "friend|family|employer|etc",
      "phone": "phone number",
      "address": "address if provided",
      "source": "reference page|application"
    }
  ],
  "contacts": [
    {
      "name": "Full Name",
      "relationship": "mother|father|spouse|friend|employer|etc",
      "phone": "phone number",
      "address": "address if provided",
      "source": "reference page|application|notes"
    }
  ],
  "vehicles": [
    {
      "year": "2011",
      "make": "Ford",
      "model": "F350",
      "color": "Black",
      "plate": "ABC1234",
      "vin": "VIN if provided"
    }
  ],
  "employment": [
    {
      "employer": "Company Name",
      "position": "job title",
      "address": "work address",
      "phone": "work phone",
      "current": true
    }
  ],
  "caseNotes": [
    "Important observations from documents",
    "Flight risk indicators",
    "Patterns noticed"
  ],
  "warnings": [
    "Red flags for recovery agents",
    "Safety concerns"
  ],
  "traceAnalysis": {
    "anchorPoints": [
      {
        "location": "1519 Esther Street, Harvey, LA 70058",
        "type": "family_residence",
        "owner": "Mother - Gloria Goudy",
        "checkInCount": 15,
        "confidence": 95,
        "reason": "Multiple check-ins from this location, mother's residence"
      }
    ],
    "transientLocations": [
      "Love's Travel Stop, Baker Road, Walbridge, OH",
      "Greater Chicago Truck Plaza, Bolingbrook, IL"
    ],
    "patternAnalysis": {
      "isTruckDriver": true,
      "checkInFrequency": "weekly",
      "typicalReturnDay": "Sunday-Monday",
      "routePattern": "Interstate trucking across midwest/south",
      "homeBaseLocation": "Harvey, LA (mother's residence)"
    },
    "predictionModel": {
      "nextLikelyLocation": "1519 Esther Street, Harvey, LA",
      "bestTimeWindow": "Sunday evening through Monday morning",
      "confidence": 85,
      "reasoning": "Subject checks in from Harvey, LA at mom's house between routes. Pattern shows weekly returns."
    },
    "surveillanceRecommendations": [
      "Primary: Stake out 1519 Esther Street, Harvey, LA on Sunday evenings",
      "Subject likely arrives late Sunday or early Monday between trucking routes",
      "Contact mother Gloria Goudy - she may have his current route schedule",
      "Check for 2011 Black Ford F350 at location"
    ],
    "criticalObservations": [
      "Subject is a truck driver - check-in locations are mostly road stops, NOT residences",
      "Mother's house in Harvey, LA is the PRIMARY ANCHOR POINT",
      "55+ check-ins over 17 months shows compliance but also predictable pattern"
    ]
  }
}

IMPORTANT:
- ALWAYS include traceAnalysis section with pattern analysis
- Distinguish ANCHOR POINTS from TRANSIENT locations
- Truck stops, gas stations, travel plazas = TRANSIENT (low value for apprehension)
- Family homes, repeated addresses = ANCHOR POINTS (high value)
- For truck drivers, identify their home base and return patterns
- Provide specific surveillance recommendations with timing
- Extract EVERY address but RANK by value for recovery
- Include ALL phone numbers from ALL contacts
- Note the SOURCE of each piece of information
- For Delvepoint/skip trace reports: extract ALL relatives (1st, 2nd, 3rd degree), ALL addresses with dates, ALL phones, ALL vehicles
- Include relatives' current phones and addresses - these are your LEADS
- Always provide a "reason" string for anchor points (never null/undefined)`;

interface ExtractedIntel {
  documentTypes?: string[];
  isAssociateDocument?: boolean; // True if this doc is about an associate, not the primary target
  subject: {
    fullName: string;
    aliases?: string[];
    dob?: string;
    ssn?: string;
    phone?: string;
    email?: string;
    cid?: string;
    driversLicense?: string;
    height?: string;
    weight?: string;
    eyeColor?: string;
    hairColor?: string;
    tattoos?: string[];
    scars?: string[];
  };
  bondInfo?: {
    totalAmount?: number;
    charges?: {
      charge: string;
      bondAmount?: number;
      caseNumber?: string;
      court?: string;
      filingDate?: string;
    }[];
    bondsman?: string;
    powerNumber?: string;
    bondDate?: string;
    courtDates?: string[];
  };
  checkIns?: {
    date: string;
    location: string;
    city?: string;
    state?: string;
    notes?: string;
  }[];
  addresses?: {
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    type: string;
    dateReported?: string;
    source: string;
  }[];
  cosigners?: {
    name: string;
    relationship: string;
    phone?: string;
    address?: string;
    employer?: string;
    source: string;
  }[];
  references?: {
    name: string;
    relationship: string;
    phone?: string;
    address?: string;
    source: string;
  }[];
  contacts?: {
    name: string;
    relationship: string;
    phone?: string;
    address?: string;
    source: string;
  }[];
  vehicles?: {
    year?: string;
    make?: string;
    model?: string;
    color?: string;
    plate?: string;
    vin?: string;
  }[];
  employment?: {
    employer: string;
    position?: string;
    address?: string;
    phone?: string;
    current?: boolean;
  }[];
  caseNotes?: string[];
  warnings?: string[];
  traceAnalysis?: {
    anchorPoints?: {
      location: string;
      type: string;
      owner?: string;
      checkInCount?: number;
      confidence: number;
      reason: string;
    }[];
    transientLocations?: string[];
    patternAnalysis?: {
      isTruckDriver?: boolean;
      checkInFrequency?: string;
      typicalReturnDay?: string;
      routePattern?: string;
      homeBaseLocation?: string;
    };
    predictionModel?: {
      nextLikelyLocation?: string;
      bestTimeWindow?: string;
      confidence?: number;
      reasoning?: string;
    };
    surveillanceRecommendations?: string[];
    criticalObservations?: string[];
  };
}

/**
 * Analyze bail bond documents using Claude
 * @param text - Document text to analyze
 * @param apiKey - Anthropic API key
 * @param primaryTarget - Optional: The PRIMARY fugitive we're looking for. If provided,
 *                        documents about other people (relatives, associates) will be
 *                        analyzed as intel to help locate the primary target.
 */
export async function analyzeBailDocument(
  text: string,
  apiKey: string,
  primaryTarget?: PrimaryTargetContext
): Promise<BailDocumentAnalysis> {
  if (!text || text.trim().length < 50) {
    return {
      success: false,
      error: 'Document text is too short or empty',
    };
  }

  try {
    console.log(`Starting Claude analysis... (${text.length} chars)`);
    if (primaryTarget) {
      console.log('Primary target context:', primaryTarget.fullName);
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    let rawIntel: ExtractedIntel;

    if (text.length <= CHUNK_SIZE) {
      // Single chunk - analyze directly
      rawIntel = await analyzeChunk(client, text, primaryTarget);
    } else {
      // Split into chunks at page boundaries and merge results
      const chunks = splitIntoChunks(text, CHUNK_SIZE);
      console.log(`Document split into ${chunks.length} chunks for analysis`);

      // Analyze first chunk with full extraction
      const firstIntel = await analyzeChunk(client, chunks[0], primaryTarget);

      if (chunks.length === 1) {
        rawIntel = firstIntel;
      } else {
        // Analyze remaining chunks (extraction only, skip TRACE analysis)
        const chunkResults: ExtractedIntel[] = [firstIntel];
        for (let i = 1; i < chunks.length; i++) {
          console.log(`Analyzing chunk ${i + 1}/${chunks.length}...`);
          try {
            const chunkIntel = await analyzeChunk(client, chunks[i], primaryTarget, true);
            chunkResults.push(chunkIntel);
          } catch (e) {
            console.error(`Chunk ${i + 1} analysis failed:`, e);
          }
        }

        // Merge all chunk results
        rawIntel = mergeIntel(chunkResults);

        // Run final TRACE analysis pass on merged data
        console.log('Running final TRACE analysis on merged data...');
        rawIntel = await runTraceAnalysis(client, rawIntel);
      }
    }

    console.log('Parsed intel:', Object.keys(rawIntel));

    // Convert to ParsedReport format
    const report = convertToReport(rawIntel);

    return {
      success: true,
      report,
      documentTypes: rawIntel.documentTypes,
      isAssociateDocument: rawIntel.isAssociateDocument || false,
    };
  } catch (error: any) {
    console.error('Claude analysis error:', error);

    let errorMsg = 'Analysis failed';
    if (error?.status === 401) {
      errorMsg = 'Invalid Anthropic API key. Check your key in Settings.';
    } else if (error?.status === 429) {
      errorMsg = 'Rate limit exceeded. Wait a moment and try again.';
    } else if (error?.message?.includes('insufficient')) {
      errorMsg = 'API quota exceeded. Check your billing at console.anthropic.com';
    } else if (error?.message) {
      errorMsg = error.message;
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Split text into chunks at page boundaries (--- Page X ---)
 */
function splitIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  const pages = text.split(/(?=--- Page \d+)/);
  let currentChunk = '';

  for (const page of pages) {
    if (currentChunk.length + page.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = page;
    } else {
      currentChunk += page;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Analyze a single chunk of text
 */
async function analyzeChunk(
  client: Anthropic,
  text: string,
  primaryTarget?: PrimaryTargetContext,
  extractionOnly = false
): Promise<ExtractedIntel> {
  let analysisPrompt: string;

  if (primaryTarget) {
    analysisPrompt = `IMPORTANT CONTEXT: We are searching for a FUGITIVE named "${primaryTarget.fullName}"${primaryTarget.dob ? ` (DOB: ${primaryTarget.dob})` : ''}${primaryTarget.aliases?.length ? ` (AKA: ${primaryTarget.aliases.join(', ')})` : ''}.

This document may be:
1. DIRECTLY about the fugitive (their bail bond, check-ins, etc.)
2. About an ASSOCIATE (family member, employer, co-signer, etc.) who may know where the fugitive is

FIRST: Determine if this document is about the PRIMARY FUGITIVE or about an ASSOCIATE.

If this is about the PRIMARY FUGITIVE "${primaryTarget.fullName}":
- Extract all their information normally into the subject field
- Set "isAssociateDocument": false

If this is about someone ELSE (associate/relative):
- Still put that person's info in the subject field for reference
- Set "isAssociateDocument": true
- In "caseNotes", add: "ASSOCIATE DOCUMENT: [Person Name] - [Relationship to fugitive if known]"
- Focus on extracting addresses, phones, and contacts that could help locate the fugitive

Analyze this document and extract all intelligence. Return ONLY valid JSON, no other text.
${extractionOnly ? '\nThis is a CONTINUATION of a larger document. Focus on DATA EXTRACTION only - skip traceAnalysis section. Extract ALL contacts, addresses, phones, vehicles, relatives, and employment. Be EXHAUSTIVE - every person, every address, every phone number matters.' : ''}

DOCUMENT TEXT:
${text}`;
  } else {
    analysisPrompt = `Analyze this bail bond document and extract all intelligence. Return ONLY valid JSON, no other text.
${extractionOnly ? '\nThis is a CONTINUATION of a larger document. Focus on DATA EXTRACTION only - skip traceAnalysis section. Extract ALL contacts, addresses, phones, vehicles, relatives, and employment. Be EXHAUSTIVE.' : ''}

DOCUMENT TEXT:
${text}`;
  }

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: analysisPrompt }],
    system: CLAUDE_SYSTEM_PROMPT,
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse analysis results');
  }

  return JSON.parse(jsonMatch[0]) as ExtractedIntel;
}

/**
 * Merge multiple ExtractedIntel results into one
 */
function mergeIntel(results: ExtractedIntel[]): ExtractedIntel {
  if (results.length === 0) throw new Error('No results to merge');
  if (results.length === 1) return results[0];

  const merged: ExtractedIntel = {
    ...results[0], // Base from first chunk (has subject info)
    documentTypes: [...new Set(results.flatMap(r => r.documentTypes || []))],
    checkIns: deduplicateCheckIns(results.flatMap(r => r.checkIns || [])),
    addresses: deduplicateByField(results.flatMap(r => r.addresses || []), 'address'),
    cosigners: deduplicateByField(results.flatMap(r => r.cosigners || []), 'name'),
    references: deduplicateByField(results.flatMap(r => r.references || []), 'name'),
    contacts: deduplicateByField(results.flatMap(r => r.contacts || []), 'name'),
    vehicles: deduplicateByField(results.flatMap(r => r.vehicles || []), 'plate'),
    employment: deduplicateByField(results.flatMap(r => r.employment || []), 'employer'),
    caseNotes: [...new Set(results.flatMap(r => r.caseNotes || []))],
    warnings: [...new Set(results.flatMap(r => r.warnings || []))],
  };

  // Merge bond info (take the most complete one)
  for (const r of results) {
    if (r.bondInfo?.totalAmount && (!merged.bondInfo?.totalAmount || r.bondInfo.charges?.length)) {
      merged.bondInfo = r.bondInfo;
    }
  }

  console.log(`Merged: ${merged.checkIns?.length || 0} check-ins, ${merged.addresses?.length || 0} addresses, ${merged.contacts?.length || 0} contacts`);
  return merged;
}

function deduplicateCheckIns(items: ExtractedIntel['checkIns']): ExtractedIntel['checkIns'] {
  if (!items) return [];
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.date}-${item.location}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateByField<T extends Record<string, any>>(items: T[], field: string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const val = (item[field] || '').toString().toLowerCase().trim();
    if (!val || seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * Run a final TRACE analysis pass on merged intel data
 */
async function runTraceAnalysis(client: Anthropic, intel: ExtractedIntel): Promise<ExtractedIntel> {
  // Summarize the merged data for TRACE analysis
  const summary = JSON.stringify({
    subject: intel.subject,
    checkIns: intel.checkIns,
    addresses: intel.addresses,
    contacts: intel.contacts,
    employment: intel.employment,
    bondInfo: intel.bondInfo,
  });

  const prompt = `Based on this extracted intelligence data, generate ONLY the "traceAnalysis" JSON section.

Analyze check-in patterns, identify anchor points vs transient locations (truck stops, gas stations = transient),
build a prediction model, and provide surveillance recommendations.

DATA:
${summary.slice(0, 45000)}

Return ONLY a JSON object with the "traceAnalysis" key. No other text.`;

  try {
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      system: CLAUDE_SYSTEM_PROMPT,
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const traceResult = JSON.parse(jsonMatch[0]);
      intel.traceAnalysis = traceResult.traceAnalysis || traceResult;
    }
  } catch (e) {
    console.error('TRACE analysis pass failed:', e);
  }

  return intel;
}

/**
 * Convert extracted intel to ParsedReport format
 */
function convertToReport(intel: ExtractedIntel): ParsedReport {
  // Build subject
  const subject: Subject = {
    fullName: intel.subject?.fullName || 'Unknown',
    aliases: intel.subject?.aliases,
    dob: intel.subject?.dob,
    partialSsn: intel.subject?.ssn,
    personId: intel.subject?.cid,
    height: intel.subject?.height,
    weight: intel.subject?.weight,
    race: intel.subject?.race,
    sex: intel.subject?.sex || intel.subject?.gender,
    hairColor: intel.subject?.hairColor,
    eyeColor: intel.subject?.eyeColor,
    tattoos: intel.subject?.tattoos,
    scars: intel.subject?.scars,
    driversLicense: intel.subject?.driversLicense,
    phone: intel.subject?.phone,
    email: intel.subject?.email,
  };

  // Build addresses
  const addressMap = new Map<string, ParsedAddress>();

  // Add explicit addresses
  intel.addresses?.forEach((addr) => {
    const key = normalizeAddress(addr.address);
    const fullAddress = [addr.address, addr.city, addr.state, addr.zip]
      .filter(Boolean)
      .join(', ');

    if (!addressMap.has(key)) {
      addressMap.set(key, {
        address: addr.address,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        fullAddress,
        confidence: addr.type === 'residence' ? 0.9 : 0.7,
        reasons: [`Found in ${addr.source || 'document'}`],
        isCurrent: addr.type === 'residence',
        linkedSignals: [],
      });
    }
  });

  // Add check-in locations
  intel.checkIns?.forEach((checkIn) => {
    const key = normalizeAddress(checkIn.location);
    const fullAddress = [checkIn.location, checkIn.city, checkIn.state]
      .filter(Boolean)
      .join(', ');

    if (!addressMap.has(key)) {
      addressMap.set(key, {
        address: checkIn.location,
        city: checkIn.city,
        state: checkIn.state,
        fullAddress,
        fromDate: checkIn.date,
        confidence: 0.6,
        reasons: [`Check-in on ${checkIn.date}`],
        linkedSignals: [],
      });
    } else {
      const existing = addressMap.get(key)!;
      existing.confidence = Math.min(1, existing.confidence + 0.15);
      existing.reasons.push(`Check-in on ${checkIn.date}`);
    }
  });

  // Add contact addresses
  intel.contacts?.forEach((contact) => {
    if (contact.address) {
      const key = normalizeAddress(contact.address);
      if (!addressMap.has(key)) {
        addressMap.set(key, {
          address: contact.address,
          fullAddress: contact.address,
          confidence: 0.5,
          reasons: [`${contact.relationship}'s address: ${contact.name}`],
          linkedSignals: contact.phone ? ['phone'] : [],
        });
      }
    }
  });

  // Build phones
  const phones: ParsedPhone[] = [];
  const seenPhones = new Set<string>();

  if (intel.subject?.phone && !seenPhones.has(normalizePhone(intel.subject.phone))) {
    phones.push({
      number: intel.subject.phone,
      type: 'mobile',
      confidence: 0.95,
      isActive: true,
    });
    seenPhones.add(normalizePhone(intel.subject.phone));
  }

  intel.contacts?.forEach((contact) => {
    if (contact.phone && !seenPhones.has(normalizePhone(contact.phone))) {
      phones.push({
        number: contact.phone,
        type: 'unknown',
        confidence: 0.7,
      });
      seenPhones.add(normalizePhone(contact.phone));
    }
  });

  // Build relatives (merge contacts, cosigners, and references)
  const relatives: ParsedRelative[] = [];
  const seenNames = new Set<string>();

  // Cosigners first (highest value contacts)
  intel.cosigners?.forEach((cs) => {
    const key = cs.name.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      relatives.push({
        name: cs.name,
        relationship: `COSIGNER - ${cs.relationship}`,
        currentAddress: cs.address,
        phones: cs.phone ? [cs.phone] : undefined,
        confidence: 0.95,
      });
    }
  });

  // References
  intel.references?.forEach((ref) => {
    const key = ref.name.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      relatives.push({
        name: ref.name,
        relationship: `REFERENCE - ${ref.relationship}`,
        currentAddress: ref.address,
        phones: ref.phone ? [ref.phone] : undefined,
        confidence: 0.85,
      });
    }
  });

  // Other contacts
  intel.contacts?.forEach((contact) => {
    const key = contact.name.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      relatives.push({
        name: contact.name,
        relationship: contact.relationship,
        currentAddress: contact.address,
        phones: contact.phone ? [contact.phone] : undefined,
        confidence: 0.8,
      });
    }
  });

  // Build vehicles
  const vehicles: ParsedVehicle[] =
    intel.vehicles?.map((v) => ({
      year: v.year,
      make: v.make,
      model: v.model,
      color: v.color,
      plate: v.plate,
      vin: v.vin,
    })) || [];

  // Build employment
  const employment: ParsedEmployment[] =
    intel.employment?.map((emp) => ({
      employer: emp.employer,
      title: emp.position,
      address: emp.address,
      phone: emp.phone,
      isCurrent: emp.current,
    })) || [];

  // Build flags
  const flags: ReportFlag[] = [];
  intel.warnings?.forEach((warning) => {
    flags.push({
      type: 'high_risk',
      message: warning,
      severity: 'high',
    });
  });

  // Build recommendations
  const recommendations: string[] = [];

  if (intel.bondInfo?.totalAmount) {
    recommendations.push(`Total Bond: $${intel.bondInfo.totalAmount.toLocaleString()}`);
  }

  intel.bondInfo?.charges?.forEach((charge) => {
    recommendations.push(
      `Charge: ${charge.charge}${charge.caseNumber ? ` (Case: ${charge.caseNumber})` : ''}`
    );
  });

  intel.caseNotes?.forEach((note) => {
    recommendations.push(note);
  });

  return {
    subject,
    addresses: Array.from(addressMap.values()).sort((a, b) => b.confidence - a.confidence),
    phones,
    relatives,
    vehicles,
    employment,
    flags,
    recommendations,
    parseMethod: 'ai',
    parseConfidence: 0.9,
    traceAnalysis: intel.traceAnalysis,
    cosigners: intel.cosigners,
    references: intel.references,
    checkIns: intel.checkIns,
  } as ParsedReport & { traceAnalysis?: typeof intel.traceAnalysis; cosigners?: typeof intel.cosigners; references?: typeof intel.references; checkIns?: typeof intel.checkIns };
}

function normalizeAddress(address: string | null | undefined): string {
  if (!address || typeof address !== 'string') return '';
  return address
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '').slice(-10);
}

export async function analyzeMultipleDocuments(
  texts: { name: string; content: string }[],
  apiKey: string
): Promise<BailDocumentAnalysis> {
  if (!texts.length) {
    return { success: false, error: 'No documents provided' };
  }

  const combinedText = texts
    .map((t, i) => `\n\n=== DOCUMENT ${i + 1}: ${t.name} ===\n\n${t.content}`)
    .join('\n');

  return analyzeBailDocument(combinedText, apiKey);
}
