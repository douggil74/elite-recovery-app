/**
 * OSINT Username Search API
 * Searches username across 100+ platforms (like Sherlock but in JS)
 * Self-sufficient - no external dependencies
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PlatformResult {
  platform: string;
  url: string;
  exists: boolean | 'unknown';
  responseTime: number;
  error?: string;
}

// Platform configurations - URL patterns and detection methods
const PLATFORMS: {
  name: string;
  url: string;
  errorType: 'status_code' | 'message' | 'redirect';
  errorIndicators?: string[];
  headers?: Record<string, string>;
}[] = [
  // Social Media
  { name: 'Instagram', url: 'https://www.instagram.com/{}/', errorType: 'message', errorIndicators: ["Sorry, this page isn't available"] },
  { name: 'TikTok', url: 'https://www.tiktok.com/@{}', errorType: 'message', errorIndicators: ["Couldn't find this account", "没有找到"] },
  { name: 'Twitter/X', url: 'https://twitter.com/{}', errorType: 'status_code' },
  { name: 'Facebook', url: 'https://www.facebook.com/{}', errorType: 'message', errorIndicators: ["page you requested", "content isn't available"] },
  { name: 'YouTube', url: 'https://www.youtube.com/@{}', errorType: 'status_code' },
  { name: 'Snapchat', url: 'https://www.snapchat.com/add/{}', errorType: 'message', errorIndicators: ['not found', '404'] },
  { name: 'Pinterest', url: 'https://www.pinterest.com/{}/', errorType: 'status_code' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/{}', errorType: 'status_code' },
  { name: 'Reddit', url: 'https://www.reddit.com/user/{}', errorType: 'message', errorIndicators: ['page not found', 'Sorry, nobody'] },
  { name: 'Tumblr', url: 'https://{}.tumblr.com', errorType: 'message', errorIndicators: ["There's nothing here"] },

  // Developer/Tech
  { name: 'GitHub', url: 'https://github.com/{}', errorType: 'status_code' },
  { name: 'GitLab', url: 'https://gitlab.com/{}', errorType: 'status_code' },
  { name: 'Bitbucket', url: 'https://bitbucket.org/{}/', errorType: 'status_code' },
  { name: 'Dev.to', url: 'https://dev.to/{}', errorType: 'status_code' },
  { name: 'Medium', url: 'https://medium.com/@{}', errorType: 'status_code' },
  { name: 'HackerNews', url: 'https://news.ycombinator.com/user?id={}', errorType: 'message', errorIndicators: ['No such user'] },
  { name: 'StackOverflow', url: 'https://stackoverflow.com/users/{}', errorType: 'status_code' },
  { name: 'Replit', url: 'https://replit.com/@{}', errorType: 'status_code' },
  { name: 'CodePen', url: 'https://codepen.io/{}', errorType: 'status_code' },
  { name: 'NPM', url: 'https://www.npmjs.com/~{}', errorType: 'status_code' },

  // Gaming
  { name: 'Steam', url: 'https://steamcommunity.com/id/{}', errorType: 'message', errorIndicators: ['specified profile could not be found'] },
  { name: 'Twitch', url: 'https://www.twitch.tv/{}', errorType: 'message', errorIndicators: ["Sorry. Unless you've got a time machine"] },
  { name: 'Xbox', url: 'https://account.xbox.com/profile?gamertag={}', errorType: 'status_code' },
  { name: 'PlayStation', url: 'https://psnprofiles.com/{}', errorType: 'status_code' },
  { name: 'Epic Games', url: 'https://fortnitetracker.com/profile/all/{}', errorType: 'message', errorIndicators: ['Player Not Found'] },
  { name: 'Roblox', url: 'https://www.roblox.com/users/profile?username={}', errorType: 'status_code' },
  { name: 'Minecraft', url: 'https://namemc.com/profile/{}', errorType: 'status_code' },

  // Music/Media
  { name: 'Spotify', url: 'https://open.spotify.com/user/{}', errorType: 'status_code' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/{}', errorType: 'status_code' },
  { name: 'Bandcamp', url: 'https://{}.bandcamp.com', errorType: 'status_code' },
  { name: 'Last.fm', url: 'https://www.last.fm/user/{}', errorType: 'status_code' },
  { name: 'Mixcloud', url: 'https://www.mixcloud.com/{}/', errorType: 'status_code' },

  // Forums/Communities
  { name: 'Discord (Servers)', url: 'https://discord.com/users/{}', errorType: 'status_code' },
  { name: 'Telegram', url: 'https://t.me/{}', errorType: 'message', errorIndicators: ['not exist', "doesn't exist"] },
  { name: 'Patreon', url: 'https://www.patreon.com/{}', errorType: 'status_code' },
  { name: 'Gab', url: 'https://gab.com/{}', errorType: 'status_code' },
  { name: 'Mastodon', url: 'https://mastodon.social/@{}', errorType: 'status_code' },
  { name: 'Minds', url: 'https://www.minds.com/{}', errorType: 'status_code' },

  // Professional/Business
  { name: 'AngelList', url: 'https://angel.co/u/{}', errorType: 'status_code' },
  { name: 'Crunchbase', url: 'https://www.crunchbase.com/person/{}', errorType: 'status_code' },
  { name: 'Behance', url: 'https://www.behance.net/{}', errorType: 'status_code' },
  { name: 'Dribbble', url: 'https://dribbble.com/{}', errorType: 'status_code' },
  { name: 'Flickr', url: 'https://www.flickr.com/people/{}/', errorType: 'status_code' },
  { name: 'Gravatar', url: 'https://en.gravatar.com/{}', errorType: 'message', errorIndicators: ['Profile not found'] },
  { name: 'About.me', url: 'https://about.me/{}', errorType: 'status_code' },
  { name: 'Linktree', url: 'https://linktr.ee/{}', errorType: 'status_code' },

  // Dating
  { name: 'OkCupid', url: 'https://www.okcupid.com/profile/{}', errorType: 'status_code' },
  { name: 'PlentyOfFish', url: 'https://www.pof.com/viewprofile.aspx?profile_id={}', errorType: 'status_code' },

  // Other
  { name: 'Venmo', url: 'https://account.venmo.com/u/{}', errorType: 'status_code' },
  { name: 'CashApp', url: 'https://cash.app/${}', errorType: 'status_code' },
  { name: 'PayPal', url: 'https://www.paypal.me/{}', errorType: 'status_code' },
  { name: 'Etsy', url: 'https://www.etsy.com/shop/{}', errorType: 'status_code' },
  { name: 'eBay', url: 'https://www.ebay.com/usr/{}', errorType: 'message', errorIndicators: ['not found', "doesn't exist"] },
  { name: 'Imgur', url: 'https://imgur.com/user/{}', errorType: 'status_code' },
  { name: 'SlideShare', url: 'https://www.slideshare.net/{}', errorType: 'status_code' },
  { name: 'Vimeo', url: 'https://vimeo.com/{}', errorType: 'status_code' },
  { name: 'Dailymotion', url: 'https://www.dailymotion.com/{}', errorType: 'status_code' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/User:{}', errorType: 'message', errorIndicators: ['does not exist'] },
  { name: 'Wattpad', url: 'https://www.wattpad.com/user/{}', errorType: 'status_code' },
  { name: 'Goodreads', url: 'https://www.goodreads.com/{}', errorType: 'status_code' },
  { name: 'Scribd', url: 'https://www.scribd.com/{}', errorType: 'status_code' },
  { name: 'MyAnimeList', url: 'https://myanimelist.net/profile/{}', errorType: 'status_code' },
  { name: 'Trello', url: 'https://trello.com/{}', errorType: 'status_code' },
  { name: 'ProductHunt', url: 'https://www.producthunt.com/@{}', errorType: 'status_code' },
  { name: 'Keybase', url: 'https://keybase.io/{}', errorType: 'status_code' },
  { name: 'Fiverr', url: 'https://www.fiverr.com/{}', errorType: 'status_code' },
  { name: 'Quora', url: 'https://www.quora.com/profile/{}', errorType: 'status_code' },
  { name: '500px', url: 'https://500px.com/p/{}', errorType: 'status_code' },
  { name: 'VSCO', url: 'https://vsco.co/{}', errorType: 'status_code' },
  { name: 'We Heart It', url: 'https://weheartit.com/{}', errorType: 'status_code' },
  { name: 'Pexels', url: 'https://www.pexels.com/@{}', errorType: 'status_code' },
  { name: 'Unsplash', url: 'https://unsplash.com/@{}', errorType: 'status_code' },
];

async function checkPlatform(
  platform: typeof PLATFORMS[0],
  username: string
): Promise<PlatformResult> {
  const url = platform.url.replace('{}', username);
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...platform.headers,
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    // Check by status code
    if (platform.errorType === 'status_code') {
      return {
        platform: platform.name,
        url,
        exists: response.status === 200,
        responseTime,
      };
    }

    // Check by message content
    if (platform.errorType === 'message' && platform.errorIndicators) {
      const text = await response.text();
      const hasError = platform.errorIndicators.some(indicator =>
        text.toLowerCase().includes(indicator.toLowerCase())
      );
      return {
        platform: platform.name,
        url,
        exists: !hasError && response.status === 200,
        responseTime,
      };
    }

    // Check by redirect
    if (platform.errorType === 'redirect') {
      return {
        platform: platform.name,
        url,
        exists: !response.redirected,
        responseTime,
      };
    }

    return {
      platform: platform.name,
      url,
      exists: response.status === 200,
      responseTime,
    };

  } catch (error: any) {
    return {
      platform: platform.name,
      url,
      exists: 'unknown',
      responseTime: Date.now() - startTime,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const username = (req.query.username as string) || (req.body?.username as string);
  const platforms = (req.query.platforms as string)?.split(',') || req.body?.platforms;
  const quick = req.query.quick === 'true' || req.body?.quick === true;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Clean username
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

  // Filter platforms if specified
  let platformsToCheck = PLATFORMS;
  if (platforms && Array.isArray(platforms)) {
    platformsToCheck = PLATFORMS.filter(p =>
      platforms.some(name => p.name.toLowerCase().includes(name.toLowerCase()))
    );
  }

  // Quick mode - only check top 10 most common
  if (quick) {
    const quickPlatforms = ['Instagram', 'TikTok', 'Twitter/X', 'Facebook', 'YouTube', 'Snapchat', 'Reddit', 'GitHub', 'LinkedIn', 'Steam'];
    platformsToCheck = PLATFORMS.filter(p => quickPlatforms.includes(p.name));
  }

  const startTime = Date.now();

  // Check all platforms in parallel (with concurrency limit)
  const results: PlatformResult[] = [];
  const batchSize = 10; // Check 10 at a time

  for (let i = 0; i < platformsToCheck.length; i += batchSize) {
    const batch = platformsToCheck.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(platform => checkPlatform(platform, cleanUsername))
    );
    results.push(...batchResults);
  }

  const totalTime = Date.now() - startTime;
  const found = results.filter(r => r.exists === true);
  const notFound = results.filter(r => r.exists === false);
  const unknown = results.filter(r => r.exists === 'unknown');

  return res.status(200).json({
    username: cleanUsername,
    searchedAt: new Date().toISOString(),
    totalTime,
    summary: {
      total: results.length,
      found: found.length,
      notFound: notFound.length,
      unknown: unknown.length,
    },
    found: found.map(r => ({ platform: r.platform, url: r.url })),
    notFound: notFound.map(r => r.platform),
    unknown: unknown.map(r => ({ platform: r.platform, error: r.error })),
    allResults: results,
  });
}
