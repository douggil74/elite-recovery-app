/**
 * COORDINATOR Agent
 * Orchestrates all other agents, manages workflow, summarizes for user
 * Model: GPT-4o (needs good reasoning + communication)
 */

import OpenAI from 'openai';
import type { SharedContext, AgentMessage, SmartQuestion, RankedLocation } from '../types';

const COORDINATOR_PROMPT = `You are the COORDINATOR of a multi-AI fugitive recovery investigation system.

YOUR ROLE: Orchestrate the investigation, communicate with the human investigator, and synthesize findings.

YOUR TEAM:
- EXTRACTOR: Parses documents, extracts addresses, phones, relatives, vehicles
- EYES: Analyzes photos for geolocation clues, faces, vehicles
- BRAIN: Cross-references all data, finds patterns, ranks locations
- HUNTER: Searches web, social media, public records

YOUR RESPONSIBILITIES:

1. **INTAKE** - When new data arrives:
   - Determine which agent(s) should process it
   - Prioritize critical information
   - Identify data gaps

2. **ORCHESTRATION** - During investigation:
   - Coordinate agent activities
   - Ensure cross-referencing happens
   - Request additional analysis when needed

3. **COMMUNICATION** - With the investigator:
   - Provide clear status updates
   - Summarize findings in plain English
   - Ask smart questions that would help the case
   - Alert on critical discoveries

4. **SYNTHESIS** - Present results:
   - Combine all agent outputs
   - Provide confidence assessments
   - Recommend next steps

COMMUNICATION STYLE:
- Be direct and professional
- Lead with the most important findings
- Use bullet points for lists
- Highlight high-confidence leads
- Be honest about data limitations

OUTPUT JSON FOR STATUS UPDATES:
{
  "status": "processing|analyzing|complete|needs_input",
  "summary": "what's happening/what was found",
  "findings": ["key finding 1", "key finding 2"],
  "topLeads": [
    {
      "location": "address",
      "probability": 0-100,
      "why": "reason this is a top lead"
    }
  ],
  "nextSteps": ["what agents are doing next"],
  "questionsForUser": ["questions that would help"],
  "alerts": ["urgent items"],
  "agentActivities": [
    {
      "agent": "name",
      "status": "running|complete|waiting",
      "task": "what it's doing"
    }
  ]
}`;

const ANSWER_QUESTION_PROMPT = `You are an expert fugitive recovery investigator assistant.
Answer the user's question based on the investigation data provided.
Be direct, specific, and actionable. If you don't have enough data to answer confidently, say so.

CRITICAL - LISTEN TO USER FEEDBACK:
- If user says an address is "nogo", "no good", "didn't work" - REMOVE it from your rankings
- If user says they "caught" someone at a location - that location is CONFIRMED
- If user says "check [location]" - prioritize that in your response
- User field experience OVERRIDES paper data

CRITICAL - UNDERSTAND DOCUMENT TYPES:
- "indemnitor" = the person who POSTED BOND, not the target
- "defendant" = the actual TARGET/FUGITIVE you're hunting
- Don't confuse these - the defendant is who we're looking for

CRITICAL - DATE AWARENESS:
- Vehicle sighting files often have dates in filename (07_03_24 = July 3, 2024)
- Recent sightings are MORE VALUABLE than old skip-trace data
- Always prioritize the MOST RECENT information`;


export class CoordinatorAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Generate a status update for the user
   */
  async generateStatusUpdate(context: SharedContext): Promise<{
    summary: string;
    findings: string[];
    topLeads: { location: string; probability: number; why: string }[];
    nextSteps: string[];
    questions: string[];
    alerts: string[];
  }> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: COORDINATOR_PROMPT },
          {
            role: 'user',
            content: `Generate status update for investigation: ${context.targetName}

CURRENT DATA:
- Documents processed: ${context.extractedData?.rawSources?.length || 0}
- Addresses found: ${context.extractedData?.addresses?.length || 0}
- Phones found: ${context.extractedData?.phones?.length || 0}
- Relatives/associates: ${context.extractedData?.relatives?.length || 0}
- Photos analyzed: ${context.visualAnalysis?.length || 0}
- Web findings: ${context.webFindings?.length || 0}
- Cross-references: ${context.crossReferences?.length || 0}

TOP LOCATIONS:
${context.topLocations?.map(l => `#${l.rank}. ${l.address} (${l.probability}%)`).join('\n') || 'None ranked yet'}

OVERALL CONFIDENCE: ${context.confidence || 0}%

Provide a status update for the investigator.`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || '',
        findings: parsed.findings || [],
        topLeads: parsed.topLeads || [],
        nextSteps: parsed.nextSteps || [],
        questions: parsed.questionsForUser || [],
        alerts: parsed.alerts || [],
      };

    } catch (error: any) {
      console.error('Coordinator status error:', error);
      return {
        summary: 'Status update unavailable',
        findings: [],
        topLeads: [],
        nextSteps: [],
        questions: [],
        alerts: [],
      };
    }
  }

  /**
   * Answer a user's question about the investigation
   */
  async answerQuestion(
    question: string,
    context: SharedContext
  ): Promise<{
    answer: string;
    confidence: number;
    relatedData: string[];
    followUpSuggestions: string[];
  }> {
    try {
      const contextSummary = this.buildContextForQuestion(context);

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: ANSWER_QUESTION_PROMPT },
          {
            role: 'user',
            content: `INVESTIGATION: ${context.targetName}

${contextSummary}

USER QUESTION: ${question}

Answer directly based on available data. Return JSON:
{
  "answer": "your answer",
  "confidence": 0-100,
  "relatedData": ["relevant data points"],
  "followUpSuggestions": ["suggested follow-up questions"]
}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        answer: parsed.answer || 'Unable to answer based on current data.',
        confidence: parsed.confidence || 0,
        relatedData: parsed.relatedData || [],
        followUpSuggestions: parsed.followUpSuggestions || [],
      };

    } catch (error: any) {
      console.error('Coordinator answer error:', error);
      return {
        answer: 'Error processing question.',
        confidence: 0,
        relatedData: [],
        followUpSuggestions: [],
      };
    }
  }

  /**
   * Determine what to do with new input
   */
  async triageInput(
    inputType: 'document' | 'image' | 'text' | 'url',
    inputDescription: string,
    context: SharedContext
  ): Promise<{
    agents: ('extractor' | 'eyes' | 'brain' | 'hunter')[];
    priority: 'critical' | 'high' | 'medium' | 'low';
    reasoning: string;
  }> {
    const rules: Record<string, ('extractor' | 'eyes' | 'brain' | 'hunter')[]> = {
      document: ['extractor'],
      image: ['eyes'],
      text: ['extractor'],
      url: ['hunter'],
    };

    // Always include BRAIN for cross-referencing if we have existing data
    const agents = [...rules[inputType]];
    if (
      context.extractedData?.addresses?.length ||
      context.visualAnalysis?.length ||
      context.webFindings?.length
    ) {
      agents.push('brain');
    }

    // Determine priority based on content hints
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    const lowerDesc = inputDescription.toLowerCase();

    if (
      lowerDesc.includes('current') ||
      lowerDesc.includes('recent') ||
      lowerDesc.includes('today') ||
      lowerDesc.includes('active')
    ) {
      priority = 'critical';
    } else if (
      lowerDesc.includes('address') ||
      lowerDesc.includes('location') ||
      lowerDesc.includes('phone')
    ) {
      priority = 'high';
    }

    return {
      agents,
      priority,
      reasoning: `${inputType} input will be processed by ${agents.join(', ')}`,
    };
  }

  /**
   * Generate investigation summary for export/report
   */
  async generateReport(context: SharedContext): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Generate a professional fugitive recovery investigation report.
Include: Executive summary, subject profile, top locations with probabilities,
evidence summary, recommended actions, and data sources.
Format in clear sections with headers.`,
          },
          {
            role: 'user',
            content: `Generate report for: ${context.targetName}

DATA:
${this.buildContextForQuestion(context)}

TOP LOCATIONS:
${context.topLocations?.map(l =>
  `${l.rank}. ${l.address}
   Probability: ${l.probability}%
   Type: ${l.type}
   Reasoning: ${l.reasoning.join('; ')}
   Best time: ${l.bestTime || 'Unknown'}
   Risks: ${l.risks?.join(', ') || 'None noted'}`
).join('\n\n') || 'None ranked'}

OVERALL CONFIDENCE: ${context.confidence}%`,
          },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      });

      return response.choices[0]?.message?.content || 'Report generation failed.';

    } catch (error: any) {
      console.error('Report generation error:', error);
      return 'Error generating report.';
    }
  }

  /**
   * Build context summary for questions
   */
  private buildContextForQuestion(context: SharedContext): string {
    const sections: string[] = [];

    const data = context.extractedData;
    if (data) {
      if (data.subjects?.length) {
        sections.push(`SUBJECTS:\n${data.subjects.map(s =>
          `- ${s.name}${s.isTarget ? ' [TARGET]' : ''}: ${s.description || 'No description'}`
        ).join('\n')}`);
      }

      if (data.addresses?.length) {
        sections.push(`ADDRESSES:\n${data.addresses.map(a =>
          `- ${a.fullAddress} (${a.type}, ${a.confidence}% confidence)`
        ).join('\n')}`);
      }

      if (data.phones?.length) {
        sections.push(`PHONES:\n${data.phones.map(p =>
          `- ${p.number} (${p.type}${p.isActive ? ', ACTIVE' : ''})`
        ).join('\n')}`);
      }

      if (data.relatives?.length) {
        sections.push(`RELATIVES/ASSOCIATES:\n${data.relatives.map(r =>
          `- ${r.name} (${r.relationship})${r.address ? ': ' + r.address : ''}`
        ).join('\n')}`);
      }

      if (data.vehicles?.length) {
        sections.push(`VEHICLES:\n${data.vehicles.map(v =>
          `- ${v.description}${v.plate ? ' Plate: ' + v.plate : ''}`
        ).join('\n')}`);
      }
    }

    if (context.crossReferences?.length) {
      sections.push(`KEY CROSS-REFERENCES:\n${context.crossReferences
        .filter(c => c.confidence >= 70)
        .slice(0, 5)
        .map(c => `- ${c.description} (${c.confidence}%): ${c.implication}`)
        .join('\n')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Prioritize pending questions from all agents
   */
  prioritizeQuestions(questions: SmartQuestion[]): SmartQuestion[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    return [...questions].sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by agent (brain > hunter > extractor > eyes)
      const agentOrder = { brain: 0, hunter: 1, extractor: 2, eyes: 3, coordinator: 4 };
      return (agentOrder[a.agent] || 5) - (agentOrder[b.agent] || 5);
    });
  }

  /**
   * Generate conversational response for chat
   */
  async generateChatResponse(
    userMessage: string,
    context: SharedContext,
    recentMessages: AgentMessage[]
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are the lead investigator AI for a fugitive recovery case.
Respond conversationally but professionally to the user.
Use the investigation data to provide helpful, actionable responses.
If they ask about locations, give specific addresses and probabilities.
If they ask what to do next, give clear action items.
Be concise but thorough.`,
          },
          ...recentMessages.slice(-5).map(m => ({
            role: m.agent === 'coordinator' ? 'assistant' as const : 'user' as const,
            content: m.content,
          })),
          {
            role: 'user',
            content: `[CONTEXT: Investigating ${context.targetName}.
Top locations: ${context.topLocations?.slice(0, 3).map(l => `${l.address} (${l.probability}%)`).join(', ') || 'None yet'}.
Overall confidence: ${context.confidence}%]

User: ${userMessage}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || 'I understand. Let me help with that.';

    } catch (error: any) {
      console.error('Chat response error:', error);
      return 'Sorry, I encountered an error processing your request.';
    }
  }
}
