/**
 * HUNTER Agent
 * Searches web, social media, and public records for intelligence
 * Uses: Web Search APIs, Social Media scraping suggestions
 */

import OpenAI from 'openai';
import type { WebFinding, SocialMediaInfo } from '../types';

const HUNTER_PROMPT = `You are HUNTER, an OSINT (Open Source Intelligence) specialist for fugitive recovery.

YOUR JOB: Generate search strategies and analyze web findings to locate targets.

SEARCH STRATEGIES:
1. **SOCIAL MEDIA**
   - Facebook: Search by name, aliases, relatives' friends lists
   - Instagram: Username variations, tagged photos, location tags
   - TikTok: Username search, location-based content
   - LinkedIn: Employment verification, connections
   - Twitter/X: Real-time location posts, mentions
   - Snapchat: Snap Map activity (if public)

2. **PUBLIC RECORDS**
   - Court records (new charges, court dates)
   - Property records (recent purchases, ownership)
   - Business registrations
   - Voter registration
   - Vehicle registration (where legal)

3. **LOCATION INTELLIGENCE**
   - Check-ins, tagged locations
   - Geotagged photos
   - Local business reviews they've left
   - Events they've RSVPed to

4. **NETWORK ANALYSIS**
   - Who comments on their posts?
   - Who do they interact with most?
   - Whose posts do they appear in?
   - Who might be hiding them?

SEARCH QUERY GENERATION:
- Generate specific, effective search queries
- Include variations (nicknames, maiden names, misspellings)
- Target recent activity (filter by date when possible)
- Check relatives' and associates' accounts

OUTPUT JSON:
{
  "searchQueries": [
    {
      "platform": "google|facebook|instagram|tiktok|linkedin|twitter|court_records|property_records",
      "query": "exact search query",
      "purpose": "what we're looking for",
      "priority": "high|medium|low"
    }
  ],
  "usernameVariations": ["possible usernames to search"],
  "networkTargets": [
    {
      "name": "person to check",
      "relationship": "how connected to target",
      "reason": "why their account might have intel"
    }
  ],
  "locationChecks": [
    {
      "location": "place to check",
      "platform": "where to search",
      "searchQuery": "specific query"
    }
  ],
  "timelineStrategy": "when and how often to check for updates"
}`;

const ANALYZE_FINDINGS_PROMPT = `Analyze these web/social media findings for fugitive recovery intelligence.

Extract:
1. Current/recent locations mentioned
2. People they're interacting with
3. Activity patterns (when they're online, where they go)
4. Any upcoming events or plans mentioned
5. Signs of where they might be hiding

Return JSON:
{
  "findings": [
    {
      "source": "social_media|public_records|news|images|other",
      "platform": "specific platform",
      "title": "brief title",
      "content": "relevant content",
      "date": "if available",
      "relevance": 0-100,
      "locationMentioned": "any location",
      "linkedPerson": "person if applicable"
    }
  ],
  "locationHints": ["places mentioned or implied"],
  "activityPattern": "when they seem to be active",
  "networkInsights": "who they're connected to",
  "actionableIntel": ["specific things to follow up on"]
}`;

export class HunterAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Generate search strategy for a target
   */
  async generateSearchStrategy(
    targetName: string,
    aliases: string[],
    relatives: { name: string; relationship: string }[],
    knownLocations: string[],
    additionalContext?: string
  ): Promise<{
    success: boolean;
    searchQueries: SearchQuery[];
    usernameVariations: string[];
    networkTargets: NetworkTarget[];
    locationChecks: LocationCheck[];
    error?: string;
  }> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: HUNTER_PROMPT },
          {
            role: 'user',
            content: `Generate search strategy for:

TARGET: ${targetName}
ALIASES: ${aliases.join(', ') || 'none known'}
RELATIVES/ASSOCIATES:
${relatives.map(r => `- ${r.name} (${r.relationship})`).join('\n') || 'none known'}
KNOWN LOCATIONS: ${knownLocations.join('; ') || 'none'}
${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

Generate comprehensive search queries for all platforms.`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        success: true,
        searchQueries: parsed.searchQueries || [],
        usernameVariations: parsed.usernameVariations || [],
        networkTargets: parsed.networkTargets || [],
        locationChecks: parsed.locationChecks || [],
      };

    } catch (error: any) {
      console.error('HUNTER strategy error:', error);
      return {
        success: false,
        searchQueries: [],
        usernameVariations: [],
        networkTargets: [],
        locationChecks: [],
        error: error?.message || 'Strategy generation failed',
      };
    }
  }

  /**
   * Analyze text/content from web findings
   */
  async analyzeFindings(
    rawContent: string,
    source: string,
    targetName: string
  ): Promise<{
    success: boolean;
    findings: WebFinding[];
    locationHints: string[];
    actionableIntel: string[];
    error?: string;
  }> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ANALYZE_FINDINGS_PROMPT },
          {
            role: 'user',
            content: `Analyze this content found from ${source} regarding ${targetName}:

${rawContent.slice(0, 10000)}

Extract all relevant intelligence.`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        success: true,
        findings: parsed.findings || [],
        locationHints: parsed.locationHints || [],
        actionableIntel: parsed.actionableIntel || [],
      };

    } catch (error: any) {
      console.error('HUNTER analysis error:', error);
      return {
        success: false,
        findings: [],
        locationHints: [],
        actionableIntel: [],
        error: error?.message || 'Analysis failed',
      };
    }
  }

  /**
   * Generate social media profile URLs to check
   */
  generateProfileUrls(
    name: string,
    usernames: string[]
  ): SocialMediaCheck[] {
    const checks: SocialMediaCheck[] = [];
    const nameParts = name.toLowerCase().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';

    // Generate username variations if none provided
    const variations = usernames.length ? usernames : [
      `${firstName}${lastName}`,
      `${firstName}.${lastName}`,
      `${firstName}_${lastName}`,
      `${firstName}${lastName[0] || ''}`,
      `${lastName}${firstName}`,
    ];

    // Facebook
    checks.push({
      platform: 'Facebook',
      searchUrl: `https://www.facebook.com/search/people/?q=${encodeURIComponent(name)}`,
      directUrls: variations.map(u => `https://www.facebook.com/${u}`),
    });

    // Instagram
    checks.push({
      platform: 'Instagram',
      searchUrl: `https://www.instagram.com/explore/tags/${firstName}${lastName}/`,
      directUrls: variations.map(u => `https://www.instagram.com/${u}/`),
    });

    // TikTok
    checks.push({
      platform: 'TikTok',
      searchUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(name)}`,
      directUrls: variations.map(u => `https://www.tiktok.com/@${u}`),
    });

    // LinkedIn
    checks.push({
      platform: 'LinkedIn',
      searchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`,
      directUrls: [],
    });

    // Twitter/X
    checks.push({
      platform: 'Twitter',
      searchUrl: `https://twitter.com/search?q=${encodeURIComponent(name)}&f=user`,
      directUrls: variations.map(u => `https://twitter.com/${u}`),
    });

    return checks;
  }

  /**
   * Generate public records search URLs
   */
  generatePublicRecordUrls(
    name: string,
    state?: string,
    county?: string
  ): PublicRecordCheck[] {
    const checks: PublicRecordCheck[] = [];
    const encodedName = encodeURIComponent(name);

    // Court records (state-specific)
    if (state) {
      checks.push({
        type: 'Court Records',
        description: `Search ${state} court records`,
        url: `https://www.google.com/search?q=${encodedName}+court+records+${state}`,
      });
    }

    // General searches
    checks.push({
      type: 'Arrest Records',
      description: 'Search for recent arrests',
      url: `https://www.google.com/search?q=${encodedName}+arrest+mugshot`,
    });

    checks.push({
      type: 'Property Records',
      description: 'Search property ownership',
      url: `https://www.google.com/search?q=${encodedName}+property+records${state ? '+' + state : ''}`,
    });

    checks.push({
      type: 'News',
      description: 'Recent news mentions',
      url: `https://news.google.com/search?q=${encodedName}`,
    });

    return checks;
  }
}

// Type definitions for HUNTER agent
export interface SearchQuery {
  platform: string;
  query: string;
  purpose: string;
  priority: 'high' | 'medium' | 'low';
}

export interface NetworkTarget {
  name: string;
  relationship: string;
  reason: string;
}

export interface LocationCheck {
  location: string;
  platform: string;
  searchQuery: string;
}

export interface SocialMediaCheck {
  platform: string;
  searchUrl: string;
  directUrls: string[];
}

export interface PublicRecordCheck {
  type: string;
  description: string;
  url: string;
}
