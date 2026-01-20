/**
 * EXTRACTOR Agent
 * Parses documents, PDFs, and text to extract structured data
 * Model: GPT-4o-mini (fast, cheap, high volume)
 */

import OpenAI from 'openai';
import type { ExtractedData, SubjectInfo, AddressInfo, PhoneInfo, VehicleInfo, RelativeInfo, EmployerInfo } from '../types';

const EXTRACTOR_PROMPT = `You are EXTRACTOR, a specialized AI that parses skip-trace reports, court documents, and investigative files.

YOUR JOB: Extract EVERY piece of useful data from documents. Miss nothing.

CRITICAL - DOCUMENT TYPE RECOGNITION:
- **"defendant_documents"** = This is about the TARGET/FUGITIVE you're looking for
- **"indemnitor_documents"** = This is about the CO-SIGNER who posted bond, NOT the target
- **"warrant"** = Legal document about the defendant/target
- **"vehicle sighting"** = Recent field intel, HIGHEST PRIORITY
- Files with dates (e.g., "07_03_24") = Parse the date, RECENT DATA IS MORE VALUABLE

CRITICAL - DATE AWARENESS:
- Look for dates in filenames like MM_DD_YY or MM-DD-YYYY
- Look for dates in document content
- Mark data recency: "from 2024" vs "from 2019" matters hugely
- Vehicle sightings and recent reports should OVERRIDE older skip-trace data

EXTRACT:
1. **PEOPLE** - Names, aliases, DOB, SSN (last 4), physical descriptions
   - DISTINGUISH: Is this the defendant (target) or indemnitor (co-signer)?
2. **ADDRESSES** - Full addresses with context (current, previous, work, family)
   - Note the DATE associated with each address if available
3. **PHONES** - Numbers with type (mobile, landline, work)
4. **VEHICLES** - Make, model, year, color, plate, VIN
5. **RELATIVES** - Names, relationships, contact info
6. **EMPLOYERS** - Company names, addresses, positions, dates
7. **SOCIAL MEDIA** - Usernames, platforms, profile URLs

RULES:
- Extract VERBATIM - don't paraphrase addresses or names
- Note the CONTEXT - is this address current or from 5 years ago?
- Capture EVERYTHING - even small details matter
- Mark confidence levels based on data recency and source quality
- RECENT > OLD: A 2024 vehicle sighting beats a 2020 skip-trace address

OUTPUT JSON:
{
  "subjects": [{ "name": "", "aliases": [], "dob": "", "ssn": "", "description": "", "isTarget": true/false }],
  "addresses": [{ "fullAddress": "", "type": "current|previous|work|family|unknown", "dateRange": { "from": "", "to": "" }, "confidence": 0-100, "linkedTo": ["person name"] }],
  "phones": [{ "number": "", "type": "mobile|landline|work|unknown", "carrier": "", "isActive": true/false, "linkedTo": [] }],
  "vehicles": [{ "description": "", "year": "", "make": "", "model": "", "color": "", "plate": "", "plateState": "", "vin": "", "registeredTo": "", "registeredAddress": "" }],
  "relatives": [{ "name": "", "relationship": "", "address": "", "phone": "", "confidence": 0-100 }],
  "employers": [{ "name": "", "address": "", "phone": "", "position": "", "dateRange": { "from": "", "to": "" }, "isCurrent": true/false }],
  "socialMedia": [{ "platform": "", "username": "", "profileUrl": "" }],
  "flags": ["any warnings, deceased indicators, etc"]
}`;

export class ExtractorAgent {
  private client: OpenAI;
  private sourceName: string = 'unknown';

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Extract data from text content
   */
  async extractFromText(text: string, sourceName: string): Promise<{
    success: boolean;
    data?: Partial<ExtractedData>;
    error?: string;
  }> {
    this.sourceName = sourceName;

    if (!text || text.trim().length < 50) {
      return { success: false, error: 'Text too short to analyze' };
    }

    try {
      // For very large documents, chunk and merge
      if (text.length > 80000) {
        return this.extractFromLargeText(text, sourceName);
      }

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXTRACTOR_PROMPT },
          { role: 'user', content: `Extract all data from this document (Source: ${sourceName}):\n\n${text.slice(0, 100000)}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      // Add source to all extracted items
      const data = this.addSourceToData(parsed, sourceName);

      return { success: true, data };

    } catch (error: any) {
      console.error('Extractor error:', error);
      return { success: false, error: error?.message || 'Extraction failed' };
    }
  }

  /**
   * Handle large documents by chunking
   */
  private async extractFromLargeText(text: string, sourceName: string): Promise<{
    success: boolean;
    data?: Partial<ExtractedData>;
    error?: string;
  }> {
    const chunkSize = 60000;
    const overlap = 2000;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    const results: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: EXTRACTOR_PROMPT },
            { role: 'user', content: `Extract data from chunk ${i + 1}/${chunks.length} of ${sourceName}:\n\n${chunks[i]}` },
          ],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content || '{}';
        results.push(JSON.parse(content));
      } catch (error) {
        console.error(`Chunk ${i + 1} failed:`, error);
      }
    }

    // Merge all chunk results
    const merged = this.mergeResults(results);
    const data = this.addSourceToData(merged, sourceName);

    return { success: true, data };
  }

  /**
   * Merge results from multiple chunks
   */
  private mergeResults(results: any[]): any {
    const merged: any = {
      subjects: [],
      addresses: [],
      phones: [],
      vehicles: [],
      relatives: [],
      employers: [],
      socialMedia: [],
      flags: [],
    };

    const seen = {
      addresses: new Set<string>(),
      phones: new Set<string>(),
      names: new Set<string>(),
    };

    for (const result of results) {
      // Merge subjects (dedupe by name)
      for (const subject of result.subjects || []) {
        const key = subject.name?.toLowerCase();
        if (key && !seen.names.has(key)) {
          seen.names.add(key);
          merged.subjects.push(subject);
        }
      }

      // Merge addresses (dedupe)
      for (const addr of result.addresses || []) {
        const key = addr.fullAddress?.toLowerCase().replace(/\s+/g, ' ');
        if (key && !seen.addresses.has(key)) {
          seen.addresses.add(key);
          merged.addresses.push(addr);
        }
      }

      // Merge phones (dedupe)
      for (const phone of result.phones || []) {
        const key = phone.number?.replace(/\D/g, '');
        if (key && !seen.phones.has(key)) {
          seen.phones.add(key);
          merged.phones.push(phone);
        }
      }

      // Merge others (allow some duplicates)
      merged.vehicles.push(...(result.vehicles || []));
      merged.relatives.push(...(result.relatives || []));
      merged.employers.push(...(result.employers || []));
      merged.socialMedia.push(...(result.socialMedia || []));

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
   * Add source attribution to all extracted data
   */
  private addSourceToData(data: any, source: string): Partial<ExtractedData> {
    const addSource = (items: any[]) => items?.map(item => ({ ...item, source })) || [];

    return {
      subjects: addSource(data.subjects),
      addresses: addSource(data.addresses),
      phones: addSource(data.phones),
      vehicles: addSource(data.vehicles),
      relatives: addSource(data.relatives),
      employers: addSource(data.employers),
      socialMedia: addSource(data.socialMedia),
    };
  }
}
