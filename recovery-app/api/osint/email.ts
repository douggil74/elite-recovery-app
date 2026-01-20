/**
 * OSINT Email Checker API
 * Check if email is registered on various services (like holehe)
 * Self-sufficient - no external dependencies
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface EmailCheckResult {
  service: string;
  registered: boolean | 'unknown';
  method: string;
  details?: string;
  error?: string;
}

// Services that have password reset/email check endpoints
const EMAIL_SERVICES: {
  name: string;
  checkUrl: string;
  method: 'POST' | 'GET';
  body?: (email: string) => any;
  headers?: Record<string, string>;
  checkResponse: (response: Response, text: string) => boolean | 'unknown';
}[] = [
  {
    name: 'Twitter/X',
    checkUrl: 'https://api.twitter.com/i/users/email_available.json',
    method: 'GET',
    checkResponse: (res, text) => {
      try {
        const data = JSON.parse(text);
        return data.taken === true;
      } catch {
        return 'unknown';
      }
    },
  },
  {
    name: 'Spotify',
    checkUrl: 'https://spclient.wg.spotify.com/signup/public/v1/account',
    method: 'GET',
    checkResponse: (res, text) => {
      try {
        const data = JSON.parse(text);
        return data.status === 20;
      } catch {
        return 'unknown';
      }
    },
  },
  {
    name: 'Pinterest',
    checkUrl: 'https://www.pinterest.com/resource/EmailExistsResource/get/',
    method: 'GET',
    checkResponse: (res, text) => {
      return text.includes('"email_exists": true') || text.includes('"email_exists":true');
    },
  },
  {
    name: 'GitHub',
    checkUrl: 'https://github.com/signup_check/email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: (email) => `value=${encodeURIComponent(email)}`,
    checkResponse: (res, text) => {
      // GitHub returns 422 if email is taken
      return res.status === 422;
    },
  },
  {
    name: 'Adobe',
    checkUrl: 'https://auth.services.adobe.com/signin/v2/users/accounts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-IMS-CLIENTID': 'adobedotcom2',
    },
    body: (email) => JSON.stringify({ username: email }),
    checkResponse: (res, text) => {
      try {
        const data = JSON.parse(text);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return 'unknown';
      }
    },
  },
  {
    name: 'Discord',
    checkUrl: 'https://discord.com/api/v9/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: (email) => JSON.stringify({
      email,
      username: 'checkuser' + Math.random().toString(36).slice(2, 8),
      password: 'CheckPass123!',
      invite: null,
      consent: true,
      date_of_birth: '1990-01-01',
    }),
    checkResponse: (res, text) => {
      return text.includes('EMAIL_ALREADY_REGISTERED');
    },
  },
  {
    name: 'Duolingo',
    checkUrl: 'https://www.duolingo.com/2017-06-30/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: (email) => JSON.stringify({
      email,
      password: 'password123',
    }),
    checkResponse: (res, text) => {
      return text.includes('That email is taken');
    },
  },
  {
    name: 'Imgur',
    checkUrl: 'https://imgur.com/signin/ajax_email_available',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: (email) => `email=${encodeURIComponent(email)}`,
    checkResponse: (res, text) => {
      try {
        const data = JSON.parse(text);
        return data.data?.available === false;
      } catch {
        return 'unknown';
      }
    },
  },
  {
    name: 'WordPress',
    checkUrl: 'https://wordpress.com/wp-login.php?action=lostpassword',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: (email) => `user_login=${encodeURIComponent(email)}&redirect_to=&wp-submit=Get+New+Password`,
    checkResponse: (res, text) => {
      return text.includes('Check your email') || !text.includes('no user registered');
    },
  },
];

async function checkEmail(
  service: typeof EMAIL_SERVICES[0],
  email: string
): Promise<EmailCheckResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let url = service.checkUrl;
    if (service.method === 'GET' && !url.includes('?')) {
      url += `?email=${encodeURIComponent(email)}`;
    }

    const options: RequestInit = {
      method: service.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...service.headers,
      },
      signal: controller.signal,
    };

    if (service.method === 'POST' && service.body) {
      const body = service.body(email);
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, options);
    clearTimeout(timeout);

    const text = await response.text();
    const registered = service.checkResponse(response, text);

    return {
      service: service.name,
      registered,
      method: service.method,
    };

  } catch (error: any) {
    return {
      service: service.name,
      registered: 'unknown',
      method: service.method,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  }
}

// Additional email analysis
function analyzeEmail(email: string) {
  const [localPart, domain] = email.split('@');

  const analysis = {
    localPart,
    domain,
    isDisposable: false,
    isBusinessEmail: false,
    provider: 'unknown',
    possibleRealName: '',
  };

  // Check common providers
  const providers: Record<string, string> = {
    'gmail.com': 'Google',
    'googlemail.com': 'Google',
    'yahoo.com': 'Yahoo',
    'yahoo.co.uk': 'Yahoo',
    'hotmail.com': 'Microsoft',
    'outlook.com': 'Microsoft',
    'live.com': 'Microsoft',
    'icloud.com': 'Apple',
    'me.com': 'Apple',
    'mac.com': 'Apple',
    'aol.com': 'AOL',
    'protonmail.com': 'ProtonMail',
    'proton.me': 'ProtonMail',
    'zoho.com': 'Zoho',
  };

  analysis.provider = providers[domain.toLowerCase()] || 'Unknown/Custom';

  // Check disposable email domains
  const disposableDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
    'yopmail.com', 'throwaway.email', 'fakeinbox.com', 'temp-mail.org',
  ];
  analysis.isDisposable = disposableDomains.includes(domain.toLowerCase());

  // Check if business email
  analysis.isBusinessEmail = !Object.keys(providers).includes(domain.toLowerCase()) && !analysis.isDisposable;

  // Try to extract name from email
  const namePatterns = [
    /^([a-z]+)\.([a-z]+)@/i,  // john.smith@
    /^([a-z]+)_([a-z]+)@/i,  // john_smith@
    /^([a-z]+)([a-z]+)\d*@/i, // johnsmith@ or johnsmith123@
  ];

  for (const pattern of namePatterns) {
    const match = email.match(pattern);
    if (match) {
      const firstName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      const lastName = match[2] ? match[2].charAt(0).toUpperCase() + match[2].slice(1) : '';
      analysis.possibleRealName = `${firstName} ${lastName}`.trim();
      break;
    }
  }

  return analysis;
}

// Check email format validity
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Gravatar check (can reveal if email is used)
async function checkGravatar(email: string): Promise<{ exists: boolean; avatarUrl?: string }> {
  try {
    // Create MD5 hash of email
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

    const response = await fetch(`https://www.gravatar.com/avatar/${hash}?d=404`, {
      method: 'HEAD',
    });

    if (response.ok) {
      return {
        exists: true,
        avatarUrl: `https://www.gravatar.com/avatar/${hash}`,
      };
    }
    return { exists: false };
  } catch {
    return { exists: false };
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

  const email = (req.query.email as string) || (req.body?.email as string);
  const quick = req.query.quick === 'true' || req.body?.quick === true;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const startTime = Date.now();

  // Analyze email
  const analysis = analyzeEmail(email);

  // Check Gravatar
  const gravatar = await checkGravatar(email);

  // Check services
  let servicesToCheck = EMAIL_SERVICES;
  if (quick) {
    servicesToCheck = EMAIL_SERVICES.slice(0, 5);
  }

  const results: EmailCheckResult[] = [];

  // Check in batches
  const batchSize = 3;
  for (let i = 0; i < servicesToCheck.length; i += batchSize) {
    const batch = servicesToCheck.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(service => checkEmail(service, email))
    );
    results.push(...batchResults);
  }

  const totalTime = Date.now() - startTime;
  const registered = results.filter(r => r.registered === true);
  const notRegistered = results.filter(r => r.registered === false);

  return res.status(200).json({
    email,
    searchedAt: new Date().toISOString(),
    totalTime,
    analysis,
    gravatar,
    summary: {
      totalChecked: results.length,
      registered: registered.length,
      notRegistered: notRegistered.length,
    },
    registeredOn: registered.map(r => r.service),
    notRegisteredOn: notRegistered.map(r => r.service),
    allResults: results,
  });
}
