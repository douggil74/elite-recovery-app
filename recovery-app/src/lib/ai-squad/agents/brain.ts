/**
 * BRAIN Agent
 * Cross-references all data, finds patterns, calculates probabilities
 * Model: GPT-4o (advanced reasoning)
 */

import OpenAI from 'openai';
import type {
  SharedContext,
  CrossReference,
  RankedLocation,
  ActionItem,
  SmartQuestion,
} from '../types';

const BRAIN_PROMPT = `You are BRAIN, the analytical core of a fugitive recovery AI system.

YOUR MISSION: Synthesize ALL intelligence from multiple sources to locate the target.

YOU RECEIVE DATA FROM:
- EXTRACTOR: Parsed documents (addresses, phones, relatives, vehicles)
- EYES: Photo analysis (geolocation clues, visual matches)
- HUNTER: Web findings (social media, public records)

YOUR JOB:
1. **CROSS-REFERENCE** - Find connections between data sources
   - Same address in multiple documents = HIGH confidence
   - Photo location matches known address = CRITICAL lead
   - Relative's address near target's last known = likely hideout

2. **DETECT PATTERNS**
   - Movement patterns (where do they go repeatedly?)
   - Relationship patterns (who are they closest to?)
   - Time patterns (when are they active online? at home?)
   - Evasion patterns (are they actively hiding?)

3. **CALCULATE PROBABILITIES**
   - Rank locations by ACTUAL likelihood of finding target
   - Factor in: data recency, source reliability, multiple confirmations
   - Be REALISTIC - don't inflate confidence without evidence

4. **IDENTIFY GAPS**
   - What data would significantly improve confidence?
   - What questions should we ask the investigator?

5. **CREATE ACTION PLAN**
   - Prioritized steps to locate and recover target
   - Include timing recommendations
   - Flag any risks or concerns

REASONING RULES:
- **VEHICLE SIGHTINGS = HIGHEST PRIORITY** - If someone was SEEN at a location, that's #1
- **RECENT > OLD** - Data from 2024 beats 2019 ALWAYS. Check dates in filenames!
- **FIELD INTEL > PAPER INTEL** - A sighting report beats a skip-trace report
- **DEFENDANT > INDEMNITOR** - Focus on the TARGET, not the co-signer
- MULTIPLE SOURCES > SINGLE SOURCE
- VERIFIED > UNVERIFIED
- CURRENT INDICATORS (active phone, utility bills) = HIGH weight
- FAMILY CONNECTIONS = Common hideout locations
- **USER FEEDBACK IS LAW** - If user says an address is "nogo", REMOVE IT from rankings
- Don't assume - if data is thin, say so

PRIORITY ORDER FOR LOCATIONS:
1. Where target was SIGHTED (vehicle sighting, surveillance)
2. Current address from RECENT documents (< 6 months old)
3. Known associate/family addresses where they might hide
4. Older addresses from skip-trace (use as backup only)

IGNORE/DEPRIORITIZE:
- Indemnitor addresses (unless target might be there)
- Addresses user has marked as "nogo" or "no good"
- Old addresses (> 2 years) unless no better data exists

OUTPUT JSON:
{
  "crossReferences": [
    {
      "type": "address_match|phone_match|person_connection|vehicle_sighting|pattern|timeline",
      "description": "what was found",
      "confidence": 0-100,
      "evidence": ["source 1 shows...", "source 2 confirms..."],
      "implication": "what this means for the investigation"
    }
  ],
  "topLocations": [
    {
      "rank": 1-4,
      "address": "full address",
      "probability": 0-100,
      "type": "target_residence|work|family|associate|frequent_location",
      "reasoning": ["reason 1", "reason 2"],
      "sources": ["document names"],
      "bestTime": "when to check",
      "whoMightBeThere": ["people"],
      "risks": ["any concerns"]
    }
  ],
  "patterns": [
    {
      "type": "movement|relationship|time|evasion",
      "description": "pattern found",
      "confidence": 0-100,
      "evidence": ["supporting data"]
    }
  ],
  "actionPlan": [
    {
      "priority": "critical|high|medium|low",
      "action": "specific action",
      "location": "where if applicable",
      "timing": "when",
      "cost": "free|cheap|moderate|expensive",
      "expectedOutcome": "what we expect to learn/achieve"
    }
  ],
  "questions": [
    {
      "question": "what we need to know",
      "reason": "why it would help",
      "priority": "high|medium|low"
    }
  ],
  "confidenceAssessment": "overall assessment of data quality and investigation status",
  "warnings": ["any red flags or concerns"]
}`;

export class BrainAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Analyze all data and produce comprehensive intelligence
   */
  async analyze(context: SharedContext): Promise<{
    success: boolean;
    crossReferences: CrossReference[];
    topLocations: RankedLocation[];
    actionPlan: ActionItem[];
    questions: SmartQuestion[];
    assessment: string;
    warnings: string[];
    error?: string;
  }> {
    try {
      // Build context summary for BRAIN
      const contextSummary = this.buildContextSummary(context);

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: BRAIN_PROMPT },
          {
            role: 'user',
            content: `INVESTIGATION: ${context.targetName}

${contextSummary}

Analyze ALL data. Cross-reference everything. Rank locations by probability. Create action plan.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        success: true,
        crossReferences: parsed.crossReferences || [],
        topLocations: parsed.topLocations || [],
        actionPlan: parsed.actionPlan || [],
        questions: (parsed.questions || []).map((q: any) => ({
          ...q,
          agent: 'brain' as const,
        })),
        assessment: parsed.confidenceAssessment || '',
        warnings: parsed.warnings || [],
      };

    } catch (error: any) {
      console.error('BRAIN analysis error:', error);
      return {
        success: false,
        crossReferences: [],
        topLocations: [],
        actionPlan: [],
        questions: [],
        assessment: '',
        warnings: [],
        error: error?.message || 'Analysis failed',
      };
    }
  }

  /**
   * Build a summary of all context for BRAIN to analyze
   */
  private buildContextSummary(context: SharedContext): string {
    const sections: string[] = [];

    // Extracted data summary
    const data = context.extractedData;
    if (data) {
      if (data.subjects?.length) {
        sections.push(`SUBJECTS (${data.subjects.length}):\n${data.subjects.map(s =>
          `- ${s.name}${s.isTarget ? ' [TARGET]' : ''} ${s.dob ? `DOB: ${s.dob}` : ''} ${s.aliases?.length ? `Aliases: ${s.aliases.join(', ')}` : ''}`
        ).join('\n')}`);
      }

      if (data.addresses?.length) {
        sections.push(`ADDRESSES (${data.addresses.length}):\n${data.addresses.map(a =>
          `- ${a.fullAddress} [${a.type}] ${a.dateRange ? `(${a.dateRange.from || '?'} - ${a.dateRange.to || 'present'})` : ''} Confidence: ${a.confidence}% Source: ${a.source}`
        ).join('\n')}`);
      }

      if (data.phones?.length) {
        sections.push(`PHONES (${data.phones.length}):\n${data.phones.map(p =>
          `- ${p.number} [${p.type}] ${p.isActive ? 'ACTIVE' : ''} ${p.carrier || ''} Source: ${p.source}`
        ).join('\n')}`);
      }

      if (data.vehicles?.length) {
        sections.push(`VEHICLES (${data.vehicles.length}):\n${data.vehicles.map(v =>
          `- ${v.description} ${v.plate ? `Plate: ${v.plate}` : ''} ${v.registeredTo ? `Reg to: ${v.registeredTo}` : ''}`
        ).join('\n')}`);
      }

      if (data.relatives?.length) {
        sections.push(`RELATIVES/ASSOCIATES (${data.relatives.length}):\n${data.relatives.map(r =>
          `- ${r.name} (${r.relationship}) ${r.address || ''} ${r.phone || ''}`
        ).join('\n')}`);
      }

      if (data.employers?.length) {
        sections.push(`EMPLOYERS (${data.employers.length}):\n${data.employers.map(e =>
          `- ${e.name} ${e.address || ''} ${e.isCurrent ? '[CURRENT]' : ''}`
        ).join('\n')}`);
      }
    }

    // Visual analysis
    if (context.visualAnalysis?.length) {
      sections.push(`PHOTO ANALYSIS (${context.visualAnalysis.length} images):\n${context.visualAnalysis.map(v => {
        const topClues = v.clues.slice(0, 5).map(c => `  - ${c.type}: ${c.description}`).join('\n');
        const topLocations = v.possibleLocations.slice(0, 3).map(l => `  - ${l.description} (${l.confidence}%)`).join('\n');
        return `Image: ${v.imageName}\nClues:\n${topClues}\nPossible locations:\n${topLocations}`;
      }).join('\n\n')}`);
    }

    // Web findings
    if (context.webFindings?.length) {
      sections.push(`WEB FINDINGS (${context.webFindings.length}):\n${context.webFindings.map(w =>
        `- [${w.source}] ${w.title}: ${w.content.slice(0, 200)}...`
      ).join('\n')}`);
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Quick probability update when new data arrives
   */
  async updateProbabilities(
    currentLocations: RankedLocation[],
    newData: string
  ): Promise<RankedLocation[]> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Update location probabilities based on new data. Return JSON array of updated locations.',
          },
          {
            role: 'user',
            content: `CURRENT RANKED LOCATIONS:
${currentLocations.map(l => `#${l.rank}. ${l.address} - ${l.probability}%`).join('\n')}

NEW DATA:
${newData}

Update probabilities and re-rank if needed. Return:
{ "locations": [{ "address": "", "probability": 0-100, "change": "reason for change" }] }`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      // Merge updates with existing locations
      const updated = currentLocations.map(loc => {
        const update = parsed.locations?.find((u: any) =>
          u.address.toLowerCase().includes(loc.address.toLowerCase().split(',')[0])
        );
        if (update) {
          return {
            ...loc,
            probability: update.probability,
            reasoning: [...loc.reasoning, update.change],
          };
        }
        return loc;
      });

      // Re-rank by probability
      return updated
        .sort((a, b) => b.probability - a.probability)
        .map((loc, i) => ({ ...loc, rank: i + 1 }));

    } catch (error) {
      console.error('Probability update error:', error);
      return currentLocations;
    }
  }
}
