import OpenAI from 'openai';
import { parseReportText } from './parser';
import type { ParsedReport, AnalyzeResponse } from '@/types';

// Token estimation: ~4 chars per token for English text
const CHARS_PER_TOKEN = 4;
const MAX_INPUT_TOKENS = 100000; // Leave room for system prompt and response
const MAX_INPUT_CHARS = MAX_INPUT_TOKENS * CHARS_PER_TOKEN; // ~400k chars
const CHUNK_SIZE = 80000; // ~20k tokens per chunk
const CHUNK_OVERLAP = 2000; // Overlap to avoid cutting context

const BAIL_RECOVERY_PROMPT = `You are an expert bail recovery consultant analyzing a skip-trace report.

IMPORTANT ANALYSIS GUIDELINES:
- Multiple addresses are NORMAL - people move, have work addresses, etc. Do NOT assume evasion.
- Distinguish between: RESIDENTIAL addresses, WORK/BUSINESS addresses, FAMILY addresses, OLD/HISTORICAL addresses
- Most recent RESIDENTIAL address with active utilities/mail is highest priority
- Work addresses are for daytime contact only
- Historical addresses (5+ years old) are low priority unless family still lives there
- Only flag "evasion" if there are ACTUAL red flags (fake names, rapid unexplained moves, disconnected phones)

Your job: Analyze this data and tell the agent WHERE to find this person, ranked by likelihood.

Provide:

1. **SUBJECT IDENTITY** - Name, DOB, aliases, physical description if available

2. **MOST LIKELY LOCATIONS** (ranked 1-5)
   For each location:
   - Full address
   - Type: CURRENT HOME / WORK / FAMILY / HISTORICAL
   - Probability score (0-100%)
   - Reasoning based on DATA (recency, utility records, vehicle registration, mail delivery)
   - Best time to check (morning/evening for home, business hours for work)

3. **CONTACT STRATEGY**
   - Phone numbers ranked (mobile > landline, recent > old)
   - Key relatives who might know current location
   - Approach suggestions

4. **RED FLAGS** (only if actually present in data)
   - Deceased indicators
   - Active warrants mentioned
   - Actual inconsistencies in data

5. **ACTION PLAN** (free/cheap actions first)
   - Specific steps with addresses and times

Base ALL conclusions on the actual data provided. Do not assume criminal behavior from normal address history.`;

const ANALYSIS_SCHEMA = `{
  "subject": {
    "fullName": "string",
    "aliases": ["string"],
    "dob": "string",
    "description": "string (brief description for identification)"
  },
  "likelyLocations": [{
    "rank": "number (1-5)",
    "address": "string (full address)",
    "type": "CURRENT_HOME | WORK | FAMILY | HISTORICAL",
    "probability": "number (0-100)",
    "reasoning": "string (based on actual data: recency, utilities, vehicle reg, etc.)",
    "tips": "string (best time to check - morning/evening for home, business hours for work)",
    "lastVerified": "string (date if available from data)"
  }],
  "contactStrategy": {
    "phones": [{
      "number": "string",
      "type": "string (mobile/landline/work)",
      "notes": "string (whose phone, best approach)"
    }],
    "keyContacts": [{
      "name": "string",
      "relationship": "string",
      "phone": "string",
      "address": "string",
      "approach": "string (how to approach this person)"
    }]
  },
  "redFlags": [{
    "type": "string",
    "message": "string",
    "severity": "high|medium|low"
  }],
  "actionPlan": [{
    "step": "number",
    "action": "string (specific action)",
    "cost": "free|cheap|moderate|expensive",
    "priority": "high|medium|low"
  }],
  "analysisNotes": "string (any other relevant observations)"
}`;

// Chunk extraction prompt - for processing pieces of large reports
const CHUNK_EXTRACT_PROMPT = `You are extracting structured data from a PORTION of a skip-trace report.
Extract ALL addresses, phone numbers, names, and dates you find. Do not rank or analyze - just extract.

Return JSON with these arrays:
{
  "addresses": [{ "address": "string", "context": "string (what this address is - home, work, family, etc)", "dates": "string" }],
  "phones": [{ "number": "string", "type": "string", "notes": "string" }],
  "people": [{ "name": "string", "relationship": "string", "details": "string" }],
  "vehicles": [{ "description": "string", "plate": "string", "vin": "string" }],
  "employment": [{ "employer": "string", "dates": "string", "address": "string" }],
  "flags": ["string - any warnings, deceased indicators, criminal flags"]
}`;

/**
 * Intelligently split text into chunks by section boundaries
 */
function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  // Section markers to try to split on
  const sectionMarkers = [
    /\n={3,}\s*(?:ADDRESSES?|PHONE|RELATIVE|ASSOCIATE|VEHICLE|EMPLOYMENT|CRIMINAL)/gi,
    /\n-{3,}\s*\n/g,
    /\n\n[A-Z]{2,}[A-Z\s]+:\s*\n/g,
    /\n\n+/g,
  ];

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = CHUNK_SIZE;
    let found = false;

    for (const marker of sectionMarkers) {
      // Look for marker in the zone between CHUNK_SIZE-CHUNK_OVERLAP and CHUNK_SIZE
      const searchZone = remaining.slice(CHUNK_SIZE - CHUNK_OVERLAP, CHUNK_SIZE + CHUNK_OVERLAP);
      marker.lastIndex = 0;
      const match = marker.exec(searchZone);

      if (match) {
        breakPoint = CHUNK_SIZE - CHUNK_OVERLAP + match.index;
        found = true;
        break;
      }
    }

    // If no section marker found, break on newline
    if (!found) {
      const lastNewline = remaining.lastIndexOf('\n', CHUNK_SIZE);
      if (lastNewline > CHUNK_SIZE - CHUNK_OVERLAP) {
        breakPoint = lastNewline;
      }
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint - CHUNK_OVERLAP); // Keep overlap
  }

  return chunks;
}

/**
 * Merge extracted data from multiple chunks
 */
function mergeChunkResults(results: any[]): any {
  const merged = {
    addresses: [] as any[],
    phones: [] as any[],
    people: [] as any[],
    vehicles: [] as any[],
    employment: [] as any[],
    flags: [] as string[],
  };

  const seenAddresses = new Set<string>();
  const seenPhones = new Set<string>();
  const seenPeople = new Set<string>();

  for (const result of results) {
    // Merge addresses
    for (const addr of result.addresses || []) {
      const key = (addr.address || '').toLowerCase().replace(/\s+/g, ' ');
      if (key && !seenAddresses.has(key)) {
        seenAddresses.add(key);
        merged.addresses.push(addr);
      }
    }

    // Merge phones
    for (const phone of result.phones || []) {
      const key = (phone.number || '').replace(/\D/g, '');
      if (key && !seenPhones.has(key)) {
        seenPhones.add(key);
        merged.phones.push(phone);
      }
    }

    // Merge people
    for (const person of result.people || []) {
      const key = (person.name || '').toLowerCase();
      if (key && !seenPeople.has(key)) {
        seenPeople.add(key);
        merged.people.push(person);
      }
    }

    // Merge vehicles (allow duplicates as they might have different details)
    merged.vehicles.push(...(result.vehicles || []));

    // Merge employment
    merged.employment.push(...(result.employment || []));

    // Merge flags (dedupe)
    for (const flag of result.flags || []) {
      if (flag && !merged.flags.includes(flag)) {
        merged.flags.push(flag);
      }
    }
  }

  return merged;
}

/**
 * Process a single chunk with extraction prompt
 */
async function processChunk(
  client: OpenAI,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<any> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: CHUNK_EXTRACT_PROMPT,
      },
      {
        role: 'user',
        content: `Extract all data from this portion (chunk ${chunkIndex + 1} of ${totalChunks}):\n\n${chunk}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const responseText = completion.choices[0]?.message?.content?.trim() || '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { addresses: [], phones: [], people: [], vehicles: [], employment: [], flags: [] };
}

/**
 * Analyze large report using chunking strategy
 */
async function analyzeWithChunking(
  text: string,
  apiKey: string,
  onProgress?: (progress: number, message: string) => void
): Promise<AnalyzeResponse> {
  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const chunks = chunkText(text);
  onProgress?.(0.1, `Splitting into ${chunks.length} chunks...`);

  // Process chunks in parallel (up to 3 at a time)
  const chunkResults: any[] = [];
  const batchSize = 3;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map((chunk, idx) =>
      processChunk(client, chunk, i + idx, chunks.length)
    );

    const batchResults = await Promise.all(batchPromises);
    chunkResults.push(...batchResults);

    const progress = Math.min(0.7, 0.1 + (0.6 * (i + batch.length)) / chunks.length);
    onProgress?.(progress, `Processed ${i + batch.length} of ${chunks.length} chunks...`);
  }

  // Merge all extracted data
  onProgress?.(0.75, 'Merging extracted data...');
  const mergedData = mergeChunkResults(chunkResults);

  // Final analysis pass to rank and prioritize
  onProgress?.(0.8, 'Analyzing and ranking locations...');

  const finalPrompt = `Based on this extracted data from a skip-trace report, analyze and rank the most likely locations to find this person.

EXTRACTED DATA:
- ${mergedData.addresses.length} addresses found
- ${mergedData.phones.length} phone numbers
- ${mergedData.people.length} relatives/associates
- ${mergedData.vehicles.length} vehicles
- ${mergedData.employment.length} employers

ADDRESSES:
${mergedData.addresses.slice(0, 20).map((a: any, i: number) => `${i + 1}. ${a.address} (${a.context}) ${a.dates || ''}`).join('\n')}

PHONES:
${mergedData.phones.slice(0, 10).map((p: any) => `- ${p.number} (${p.type}) ${p.notes || ''}`).join('\n')}

PEOPLE:
${mergedData.people.slice(0, 10).map((p: any) => `- ${p.name} (${p.relationship}) ${p.details || ''}`).join('\n')}

FLAGS:
${mergedData.flags.join('\n')}

Respond with ONLY a JSON object matching this schema:
${ANALYSIS_SCHEMA}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: BAIL_RECOVERY_PROMPT,
      },
      {
        role: 'user',
        content: finalPrompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const responseText = completion.choices[0]?.message?.content?.trim() || '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No valid JSON found in final analysis');
  }

  onProgress?.(1.0, 'Analysis complete');

  const aiAnalysis = JSON.parse(jsonMatch[0]);

  // Convert to ParsedReport format
  const parsed: ParsedReport = {
    subject: {
      fullName: aiAnalysis.subject?.fullName || 'Unknown',
      dob: aiAnalysis.subject?.dob,
      aliases: aiAnalysis.subject?.aliases,
    },
    addresses: (aiAnalysis.likelyLocations || []).map((loc: any, idx: number) => ({
      fullAddress: loc.address,
      address: loc.address,
      confidence: (loc.probability || 50) / 100,
      reasons: [loc.reasoning, loc.tips].filter(Boolean),
      rank: loc.rank || idx + 1,
      probability: loc.probability,
    })),
    phones: (aiAnalysis.contactStrategy?.phones || []).map((p: any) => ({
      number: p.number,
      type: p.type || 'unknown',
      notes: p.notes,
      confidence: 0.7,
    })),
    relatives: (aiAnalysis.contactStrategy?.keyContacts || []).map((c: any) => ({
      name: c.name,
      relationship: c.relationship,
      phones: c.phone ? [c.phone] : [],
      currentAddress: c.address,
      approach: c.approach,
      confidence: 0.6,
    })),
    vehicles: mergedData.vehicles.slice(0, 10).map((v: any) => ({
      description: v.description,
      plate: v.plate,
      vin: v.vin,
    })),
    employment: mergedData.employment.slice(0, 10).map((e: any) => ({
      employer: e.employer,
      address: e.address,
      fromDate: e.dates?.split('-')[0]?.trim(),
      toDate: e.dates?.split('-')[1]?.trim(),
    })),
    flags: (aiAnalysis.redFlags || []).map((f: any) => ({
      type: f.type || 'warning',
      message: f.message,
      severity: f.severity || 'medium',
    })),
    recommendations: (aiAnalysis.actionPlan || []).map((a: any) =>
      `${a.step}. ${a.action} (${a.cost}, ${a.priority} priority)`
    ),
    parseMethod: 'ai',
    parseConfidence: 0.85,
    aiAnalysis,
  };

  return {
    success: true,
    data: parsed,
  };
}

export async function analyzeWithAI(
  text: string,
  apiKey: string
): Promise<AnalyzeResponse> {
  try {
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: BAIL_RECOVERY_PROMPT,
        },
        {
          role: 'user',
          content: `Analyze this skip-trace report and respond with ONLY a JSON object matching this schema:

${ANALYSIS_SCHEMA}

REPORT DATA:
${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    const aiAnalysis = JSON.parse(jsonMatch[0]);

    // Convert AI analysis to our ParsedReport format
    const parsed: ParsedReport = {
      subject: {
        fullName: aiAnalysis.subject?.fullName || 'Unknown',
        dob: aiAnalysis.subject?.dob,
        aliases: aiAnalysis.subject?.aliases,
      },
      addresses: (aiAnalysis.likelyLocations || []).map((loc: any, idx: number) => ({
        fullAddress: loc.address,
        address: loc.address,
        confidence: (loc.probability || 50) / 100,
        reasons: [loc.reasoning, loc.tips].filter(Boolean),
        rank: loc.rank || idx + 1,
        probability: loc.probability,
      })),
      phones: (aiAnalysis.contactStrategy?.phones || []).map((p: any) => ({
        number: p.number,
        type: p.type || 'unknown',
        notes: p.notes,
        confidence: 0.7,
      })),
      relatives: (aiAnalysis.contactStrategy?.keyContacts || []).map((c: any) => ({
        name: c.name,
        relationship: c.relationship,
        phones: c.phone ? [c.phone] : [],
        currentAddress: c.address,
        approach: c.approach,
        confidence: 0.6,
      })),
      vehicles: [],
      employment: [],
      flags: (aiAnalysis.redFlags || []).map((f: any) => ({
        type: f.type || 'warning',
        message: f.message,
        severity: f.severity || 'medium',
      })),
      recommendations: (aiAnalysis.actionPlan || []).map((a: any) =>
        `${a.step}. ${a.action} (${a.cost}, ${a.priority} priority)`
      ),
      parseMethod: 'ai',
      parseConfidence: 0.85,
      aiAnalysis, // Store the full AI analysis for the brief
    };

    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI analysis failed',
    };
  }
}

export async function analyzeReport(
  text: string,
  options?: {
    useAI?: boolean;
    apiKey?: string;
    forceAI?: boolean;
    onProgress?: (progress: number, message: string) => void;
  }
): Promise<AnalyzeResponse> {
  // Validate input
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      error: 'No report text provided',
    };
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 50) {
    return {
      success: false,
      error: 'Report text is too short (minimum 50 characters)',
    };
  }

  try {
    // If we have an API key, use AI analysis (this is the primary path)
    if (options?.apiKey) {
      // Check if report is large enough to need chunking
      const needsChunking = trimmedText.length > CHUNK_SIZE;

      if (needsChunking) {
        options.onProgress?.(0.05, 'Large report detected, using chunked analysis...');
        const chunkResult = await analyzeWithChunking(
          trimmedText,
          options.apiKey,
          options.onProgress
        );
        if (chunkResult.success) {
          return chunkResult;
        }
        console.warn('Chunked analysis failed, trying direct analysis:', chunkResult.error);
      }

      // Standard analysis for smaller reports
      options.onProgress?.(0.1, 'Analyzing report...');
      const aiResult = await analyzeWithAI(trimmedText, options.apiKey);
      if (aiResult.success) {
        options.onProgress?.(1.0, 'Analysis complete');
        return aiResult;
      }
      // If AI fails, fall back to deterministic
      console.warn('AI analysis failed, falling back to deterministic:', aiResult.error);
    }

    // Fallback: deterministic parsing (less intelligent but works offline)
    options?.onProgress?.(0.5, 'Using offline analysis...');
    const deterministicResult = parseReportText(trimmedText);

    if (deterministicResult.success && deterministicResult.data) {
      options?.onProgress?.(1.0, 'Analysis complete');
      return {
        success: true,
        data: deterministicResult.data,
      };
    }

    return {
      success: false,
      error: deterministicResult.error || 'Failed to analyze report',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    };
  }
}

export function generateRecoveryBrief(report: ParsedReport, caseName: string) {
  const { subject, addresses, phones, relatives, flags } = report;
  const aiAnalysis = (report as any).aiAnalysis;

  // If we have AI analysis, use its structured output
  if (aiAnalysis) {
    return {
      caseId: caseName,
      subject: aiAnalysis.subject,
      likelyLocations: aiAnalysis.likelyLocations || [],
      contactStrategy: aiAnalysis.contactStrategy || { phones: [], keyContacts: [] },
      redFlags: aiAnalysis.redFlags || [],
      actionPlan: aiAnalysis.actionPlan || [],
      analysisNotes: aiAnalysis.analysisNotes,
      generatedAt: new Date().toISOString(),
      method: 'ai',
    };
  }

  // Fallback: build brief from deterministic parsing
  return {
    caseId: caseName,
    subject: {
      fullName: subject.fullName,
      dob: subject.dob,
      aliases: subject.aliases,
    },
    likelyLocations: addresses.slice(0, 5).map((addr, idx) => ({
      rank: idx + 1,
      address: addr.fullAddress || addr.address,
      probability: Math.round((addr.confidence || 0.5) * 100),
      reasoning: addr.reasons?.[0] || 'Listed in report',
      tips: addr.isCurrent ? 'Marked as current address' : undefined,
    })),
    contactStrategy: {
      phones: phones.slice(0, 3).map((p) => ({
        number: p.number,
        type: p.type,
        notes: p.isActive ? 'Active' : undefined,
      })),
      keyContacts: relatives.slice(0, 3).map((r) => ({
        name: r.name,
        relationship: r.relationship,
        phone: r.phones?.[0],
        address: r.currentAddress,
      })),
    },
    redFlags: flags,
    actionPlan: [
      { step: 1, action: 'Verify subject identity', cost: 'free', priority: 'high' },
      { step: 2, action: `Call primary phone: ${phones[0]?.number || 'N/A'}`, cost: 'free', priority: 'high' },
      { step: 3, action: `Drive by: ${addresses[0]?.fullAddress || 'N/A'}`, cost: 'cheap', priority: 'high' },
    ],
    generatedAt: new Date().toISOString(),
    method: 'deterministic',
  };
}

// Multi-report cross-reference analysis
const MULTI_REPORT_PROMPT = `You are an expert bail recovery consultant. You have been given skip-trace reports for MULTIPLE people - the subject (fugitive) AND their family/associates.

Your job: CROSS-REFERENCE all these reports to find where the subject is MOST LIKELY HIDING.

KEY INSIGHT: Fugitives often hide with family or friends. Look for:
- Subject's addresses that match family member's current address
- Phone numbers that appear on multiple reports
- Addresses where relatives currently live (subject may be there)
- Vehicles registered to family that subject might be using
- Employment connections between subject and associates

ANALYZE EACH REPORT, then CROSS-REFERENCE to find:
1. Addresses that appear on BOTH subject and family reports = HIGH PROBABILITY
2. Family member's CURRENT address where subject has history = LIKELY HIDING SPOT
3. Shared phone numbers = Active connection, good lead
4. Vehicles in family name at family address = Subject may be using

Rank locations by probability of finding the subject there NOW.`;

export async function analyzeMultipleReportsWithAI(
  reports: { label: string; text: string; relationship: string }[],
  apiKey: string
): Promise<AnalyzeResponse> {
  try {
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    // Format all reports for the prompt
    const reportsText = reports.map((r, idx) =>
      `\n=== REPORT ${idx + 1}: ${r.label} (${r.relationship}) ===\n${r.text}`
    ).join('\n\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: MULTI_REPORT_PROMPT,
        },
        {
          role: 'user',
          content: `Cross-reference these ${reports.length} reports and find where the subject is most likely hiding.

${reportsText}

---

Respond with ONLY a JSON object matching this schema:
${ANALYSIS_SCHEMA}

Focus on CROSS-REFERENCED locations where subject might be hiding based on family connections.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    const aiAnalysis = JSON.parse(jsonMatch[0]);

    const parsed: ParsedReport = {
      subject: {
        fullName: aiAnalysis.subject?.fullName || 'Unknown',
        dob: aiAnalysis.subject?.dob,
        aliases: aiAnalysis.subject?.aliases,
      },
      addresses: (aiAnalysis.likelyLocations || []).map((loc: any, idx: number) => ({
        fullAddress: loc.address,
        address: loc.address,
        confidence: (loc.probability || 50) / 100,
        reasons: [loc.reasoning, loc.tips].filter(Boolean),
        rank: loc.rank || idx + 1,
        probability: loc.probability,
      })),
      phones: (aiAnalysis.contactStrategy?.phones || []).map((p: any) => ({
        number: p.number,
        type: p.type || 'unknown',
        notes: p.notes,
        confidence: 0.7,
      })),
      relatives: (aiAnalysis.contactStrategy?.keyContacts || []).map((c: any) => ({
        name: c.name,
        relationship: c.relationship,
        phones: c.phone ? [c.phone] : [],
        currentAddress: c.address,
        approach: c.approach,
        confidence: 0.6,
      })),
      vehicles: [],
      employment: [],
      flags: (aiAnalysis.redFlags || []).map((f: any) => ({
        type: f.type || 'warning',
        message: f.message,
        severity: f.severity || 'medium',
      })),
      recommendations: (aiAnalysis.actionPlan || []).map((a: any) =>
        `${a.step}. ${a.action} (${a.cost}, ${a.priority} priority)`
      ),
      parseMethod: 'ai',
      parseConfidence: 0.9, // Higher confidence for cross-referenced analysis
      aiAnalysis,
    };

    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    console.error('Multi-report analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Multi-report analysis failed',
    };
  }
}
