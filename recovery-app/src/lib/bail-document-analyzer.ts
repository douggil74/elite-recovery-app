/**
 * Bail Bond Document Analyzer - Claude Edition
 * Analyzes bail bond PDFs (bondsman paperwork, check-in logs, court records, etc.)
 * and extracts structured intelligence for fugitive recovery
 */

import Anthropic from '@anthropic-ai/sdk';

// Always use Haiku 3.5 - fastest and most cost-effective for document extraction
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';
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

const CLAUDE_SYSTEM_PROMPT = `You are an expert bail bond document analyst for licensed fugitive recovery professionals.

Your job is to analyze bail bond documents (bondsman paperwork, check-in logs, court records, intake forms, references) and extract ALL intelligence that could help locate the subject.

DOCUMENT TYPES YOU'LL SEE:
- Bail bond applications (defendant info, references, employment)
- Check-in logs (locations where defendant reported, timestamps)
- Court documents (charges, case numbers, court dates)
- Intake/booking forms (physical description, identifiers)
- Reference pages (contacts, family, employers)
- ID copies (addresses, DOB, physical details)
- Notes from bondsman (movement patterns, concerns)

EXTRACTION PRIORITIES:
1. SUBJECT IDENTIFICATION - Full name, DOB, SSN (last 4 only), phone, email, physical description
2. ALL ADDRESSES - Every address mentioned, with context (residence, work, family, check-in location)
3. CHECK-IN TIMELINE - Build a timeline of where they've been
4. CONTACTS/REFERENCES - Names, relationships, phones, addresses of anyone connected
5. VEHICLES - Year, make, model, color, plate, VIN
6. EMPLOYMENT - Current and past employers with addresses
7. BOND/CHARGES - Total bond, individual charges, court info
8. RED FLAGS - Flight risk indicators, missed check-ins, suspicious patterns

Be THOROUGH. Extract EVERYTHING. Even small details matter for locating a fugitive.

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
    "Patterns noticed",
    "Special instructions or concerns"
  ],
  "warnings": [
    "Red flags for recovery agents",
    "Safety concerns",
    "Known weapons",
    "Gang affiliations"
  ]
}

IMPORTANT:
- Extract EVERY address mentioned, even from check-in logs
- Include ALL phone numbers from ALL contacts
- Note the SOURCE of each piece of information
- Convert all dates to consistent format
- For SSN, only include last 4 digits
- Mark current vs historical addresses/employment`;

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
    console.log('Starting Claude analysis...');
    if (primaryTarget) {
      console.log('Primary target context:', primaryTarget.fullName);
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    // Build the analysis prompt based on whether we have a primary target
    let analysisPrompt: string;

    if (primaryTarget) {
      // We have a primary target - analyze document as potential associate intel
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

DOCUMENT TEXT:
${text.slice(0, 50000)}`;
    } else {
      // No primary target yet - this is the first document, establishing the target
      analysisPrompt = `Analyze this bail bond document and extract all intelligence. Return ONLY valid JSON, no other text.

DOCUMENT TEXT:
${text.slice(0, 50000)}`;
    }

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      system: CLAUDE_SYSTEM_PROMPT,
    });

    console.log('Claude response received');

    // Extract text from response
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', responseText.slice(0, 500));
      return {
        success: false,
        error: 'Could not parse analysis results',
      };
    }

    const rawIntel = JSON.parse(jsonMatch[0]) as ExtractedIntel;
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

  // Build relatives
  const relatives: ParsedRelative[] =
    intel.contacts?.map((contact) => ({
      name: contact.name,
      relationship: contact.relationship,
      currentAddress: contact.address,
      phones: contact.phone ? [contact.phone] : undefined,
      confidence: 0.8,
    })) || [];

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
  };
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

function normalizePhone(phone: string): string {
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
