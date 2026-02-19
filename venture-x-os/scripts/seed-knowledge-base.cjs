#!/usr/bin/env node
// ============================================
// KNOWLEDGE BASE SEEDER
// Scrapes Reddit r/VentureX and populates Supabase
// ============================================
//
// Run locally: npm run seed
// Run with Playwright: npm run seed:playwright
// Run via GitHub Action: .github/workflows/seed-knowledge-base.yml
//
// Environment variables:
// - SUPABASE_URL or VITE_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY
// - HF_API_KEY (optional but recommended)
// - USE_PLAYWRIGHT=true (optional, enables headless browser scraping)
// - PLAYWRIGHT_HEADLESS=true/false (optional, show browser for debugging)
// - REDDIT_CLIENT_ID (optional, for OAuth - more reliable)
// - REDDIT_CLIENT_SECRET (optional, for OAuth - more reliable)
//

// Load .env file if present (for local development)
try {
  const path = require('path');
  const dotenv = require('dotenv');
  
  // Try multiple paths to find .env
  const possiblePaths = [
    path.resolve(__dirname, '../.env'),  // From scripts/ to venture-x-os/
    path.resolve(__dirname, '.env'),      // Same directory
    path.resolve(process.cwd(), '.env'),  // Current working directory
  ];
  
  let loaded = false;
  for (const envPath of possiblePaths) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`[Seed] Loaded .env from: ${envPath}`);
      loaded = true;
      break;
    }
  }
  
  if (!loaded) {
    console.log('[Seed] No .env file found, using environment variables directly');
  }
} catch (err) {
  console.log('[Seed] dotenv not available:', err.message);
}

const crypto = require('crypto');

const HF_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5';
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}`;

// Date cutoffs
const POLICY_CUTOFF_DATE = new Date('2023-06-01').getTime() / 1000;
const QA_CUTOFF_DATE = new Date('2022-01-01').getTime() / 1000;

const POLICY_KEYWORDS = [
  'minimum', 'miles required', 'redemption', 'eraser',
  'annual fee', 'bonus', 'credit', 'transfer', 'partner',
  'lounge', 'priority pass', 'tsa precheck', 'global entry'
];

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const MAX_POSTS = parseInt(process.env.MAX_POSTS || '50');
const INCLUDE_REDDIT = process.env.INCLUDE_REDDIT !== 'false';
const INCLUDE_CAPITALONE = process.env.INCLUDE_CAPITALONE !== 'false';

// Reddit OAuth (optional but more reliable)
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

// Playwright scraping (USE_PLAYWRIGHT=true enables headless browser scraping)
const USE_PLAYWRIGHT = process.env.USE_PLAYWRIGHT === 'true';

// ============================================
// HELPERS
// ============================================

function calculateFreshnessScore(createdUtc) {
  const now = Date.now() / 1000;
  const ageInDays = (now - createdUtc) / (60 * 60 * 24);
  
  if (ageInDays <= 90) return 1.0;
  if (ageInDays <= 365) return 0.7;
  if (ageInDays <= 730) return 0.4;
  return 0.2;
}

function isPolicyContent(text) {
  const lower = text.toLowerCase();
  return POLICY_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================
// REDDIT SCRAPING (with optional OAuth support)
// ============================================

// Cache OAuth token to avoid multiple requests
let redditOAuthToken = null;
let redditOAuthExpiry = 0;

async function getRedditOAuthToken() {
  // If no credentials, return null (will use public .json API)
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    return null;
  }
  
  // Return cached token if not expired
  if (redditOAuthToken && Date.now() < redditOAuthExpiry) {
    return redditOAuthToken;
  }
  
  try {
    console.log('[Seed] Fetching Reddit OAuth token...');
    
    // Reddit application-only OAuth (no user context needed)
    const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VentureXOS/1.0 (https://github.com/venturexos)',
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!response.ok) {
      console.error(`[Seed] Reddit OAuth failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    redditOAuthToken = data.access_token;
    // Token typically expires in 1 hour, refresh 5 min before
    redditOAuthExpiry = Date.now() + ((data.expires_in - 300) * 1000);
    
    console.log('[Seed] Reddit OAuth token obtained');
    return redditOAuthToken;
  } catch (err) {
    console.error('[Seed] Reddit OAuth error:', err.message);
    return null;
  }
}

async function scrapeReddit(maxPosts = 50) {
  console.log('[Seed] Scraping Reddit r/Venturex...');
  
  // ============================================
  // FALLBACK CHAIN:
  // 1. Playwright (headless browser) — if USE_PLAYWRIGHT=true
  // 2. Reddit OAuth API — if REDDIT_CLIENT_ID is set
  // 3. Reddit public JSON API — always available but rate-limited
  // ============================================

  // OPTION 1: Playwright scraping (most reliable, no API keys needed)
  if (USE_PLAYWRIGHT) {
    try {
      console.log('[Seed] Using Playwright headless browser scraper...');
      const { scrapeRedditWithPlaywright } = require('./playwright-reddit-scraper.cjs');
      
      const playwrightDocs = await scrapeRedditWithPlaywright({
        maxPosts,
        includeComments: true,
        onProgress: (msg, pct) => {
          process.stdout.write(`\r  [Playwright ${pct}%] ${msg}                    `);
        },
      });
      
      console.log(''); // Clear progress line
      
      if (playwrightDocs.length > 0) {
        console.log(`[Seed] Playwright scraper returned ${playwrightDocs.length} documents`);
        return playwrightDocs;
      }
      
      console.log('[Seed] Playwright scraper returned no results, falling back to JSON API...');
    } catch (err) {
      console.error('[Seed] Playwright scraper failed:', err.message);
      console.log('[Seed] Falling back to JSON API...');
    }
  }

  // OPTION 2 & 3: Reddit JSON API (OAuth or public)
  const docs = [];
  
  // Try to get OAuth token for more reliable access
  const oauthToken = await getRedditOAuthToken();
  const useOAuth = !!oauthToken;
  
  const baseUrl = useOAuth
    ? 'https://oauth.reddit.com'
    : 'https://www.reddit.com';
  
  const endpoints = [
    `${baseUrl}/r/Venturex/hot${useOAuth ? '' : '.json'}?limit=${Math.ceil(maxPosts / 3)}&raw_json=1`,
    `${baseUrl}/r/Venturex/top${useOAuth ? '' : '.json'}?limit=${Math.ceil(maxPosts / 3)}&t=month&raw_json=1`,
    `${baseUrl}/r/Venturex/top${useOAuth ? '' : '.json'}?limit=${Math.ceil(maxPosts / 3)}&t=all&raw_json=1`,
  ];
  
  const headers = {
    'User-Agent': 'VentureXOS/1.0 (https://github.com/venturexos)',
  };
  
  if (useOAuth) {
    headers['Authorization'] = `Bearer ${oauthToken}`;
    console.log('[Seed] Using OAuth for Reddit API');
  } else {
    console.log('[Seed] Using public .json API (may be rate limited)');
  }
  
  const seenIds = new Set();
  
  for (const url of endpoints) {
    try {
      console.log(`[Seed] Fetching: ${url}`);
      const response = await fetch(url, { headers });
      
      console.log(`[Seed] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Seed] Reddit API error: ${response.status} - ${errorText.slice(0, 200)}`);
        continue;
      }
      
      const data = await response.json();
      
      for (const child of data.data?.children || []) {
        const post = child.data;
        
        if (seenIds.has(post.id)) continue;
        seenIds.add(post.id);
        
        if ((post.selftext?.length || 0) < 10 && post.title.length < 10) continue;
        
        const freshnessScore = calculateFreshnessScore(post.created_utc);
        
        docs.push({
          id: `reddit-post-${post.id}`,
          title: post.title,
          content: post.selftext || post.title,
          source: 'reddit-post',
          url: `https://www.reddit.com${post.permalink}`,
          author: post.author,
          score: post.score,
          createdAt: post.created_utc,
          freshnessScore,
          source_tier: 2, // Community tier
        });
      }
      
      // Respect rate limits - 60 requests/min for OAuth, much less for public
      await new Promise(resolve => setTimeout(resolve, useOAuth ? 100 : 2000));
    } catch (err) {
      console.error(`[Seed] Error fetching ${url}:`, err.message);
    }
  }
  
  console.log(`[Seed] Scraped ${docs.length} posts from Reddit`);
  return docs;
}

// ============================================
// CAPITAL ONE WEBSITE SCRAPING
// No CORS issues in Node.js - can scrape directly!
// ============================================

// ============================================
// TIER 0 - Official Capital One Sources (POLICY TRUTH)
// These are the ONLY sources for policy questions
// ============================================
const CAPITAL_ONE_TIER0_PAGES = [
  {
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    title: 'Venture X – Official Card Page',
    tier: 0,
    category: 'policy',
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/all-about-venture-x/',
    title: 'All About Venture X (Official explainer + lounge rule changes)',
    tier: 0,
    category: 'policy',
    notes: 'Contains Feb 1, 2026 lounge/guest/AU changes. CRITICAL for time-sensitive rules.',
  },
  {
    url: 'https://www.capitalone.com/credit-cards/disclosures/airport-lounge-terms/',
    title: 'Airport Lounge Terms & Conditions',
    tier: 0,
    category: 'policy',
  },
  // Note: how-to-enroll-priority-pass URL was 404 as of Jan 2026
  // This content is now covered by all-about-priority-pass-and-venture-x
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/all-about-priority-pass-and-venture-x/',
    title: 'Priority Pass for Venture X (Official)',
    tier: 0,
    category: 'policy',
  },
  {
    url: 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/',
    title: 'Venture Miles Transfer Partners (Official)',
    tier: 0,
    category: 'policy',
  },
  {
    url: 'https://www.capitalone.com/credit-cards/benefits-guide/',
    title: 'Network Benefits Guides (Visa Infinite guide)',
    tier: 0,
    category: 'policy',
  },
  {
    url: 'https://www.capitalone.com/help-center/credit-cards/manage-authorized-users/',
    title: 'Understanding Personal Credit Card User Roles',
    category: 'policy',
    tier: 0,
    priority: 'high',
  },
];

// ============================================
// TIER 1 - High-Quality Third-Party Guides
// Useful for optimization, but NOT for policy truth
// ============================================
const TIER1_GUIDE_PAGES = [
  {
    url: 'https://thepointsguy.com/credit-cards/capital-one-set-to-change-lounge-access/',
    title: 'TPG – Capital One Lounge Access Changes',
    tier: 1,
    category: 'guide',
    notes: 'Important lounge policy changes article',
  },
  {
    url: 'https://onemileatatime.com/guides/capital-one-venture-x/',
    title: 'OMAAT – Venture X Guide',
    tier: 1,
    category: 'guide',
  },
  {
    url: 'https://onemileatatime.com/reviews/credit-cards/capital-one/capital-one-venture-x-card/',
    title: 'OMAAT – Venture X Card Review',
    tier: 1,
    category: 'guide',
  },
  {
    url: 'https://www.nerdwallet.com/travel/learn/how-to-maximize-venture-x-card',
    title: 'NerdWallet – How to Maximize Venture X Card',
    tier: 1,
    category: 'guide',
  },
];

// Combined for scraping (Tier 0 first, then Tier 1)
const CAPITAL_ONE_PAGES = [...CAPITAL_ONE_TIER0_PAGES, ...TIER1_GUIDE_PAGES];

function extractTextFromHTML(html) {
  // Remove script and style content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  
  // Convert common HTML elements to readable format
  text = text
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<[^>]+>/g, ' '); // Remove remaining tags
  
  // Clean up entities and whitespace
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
  
  return text;
}

async function scrapeCapitalOne() {
  console.log('[Seed] Scraping Capital One website pages...');
  const docs = [];
  const now = Date.now() / 1000;
  
  for (const page of CAPITAL_ONE_PAGES) {
    try {
      console.log(`[Seed] Fetching: ${page.url}`);
      
      const response = await fetch(page.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      
      if (!response.ok) {
        console.log(`[Seed] Failed to fetch ${page.url}: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      const content = extractTextFromHTML(html);
      
      // Only add if we got meaningful content
      if (content.length > 200) {
        docs.push({
          id: `capitalone-${crypto.createHash('md5').update(page.url).digest('hex').slice(0, 16)}`,
          title: page.title,
          content: content.slice(0, 10000), // Limit content length
          source: 'capitalone', // Must match DB constraint: 'reddit-post', 'reddit-comment', 'capitalone'
          url: page.url,
          author: 'Capital One',
          score: 100,
          createdAt: now,
          freshnessScore: 1.0,
          source_tier: page.tier ?? 0, // Tier 0 for official, Tier 1 for guides
        });
        console.log(`[Seed] ✅ Scraped ${page.title} (${content.length} chars)`);
      } else {
        console.log(`[Seed] ⚠️ Insufficient content from ${page.url}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`[Seed] Error scraping ${page.url}:`, err.message);
    }
  }
  
  console.log(`[Seed] Scraped ${docs.length} Capital One pages`);
  return docs;
}

// ============================================
// STATIC CONTENT (Fallback if scraping fails)
// ============================================

function getStaticContent() {
  const now = Date.now() / 1000;
  
  return [
    {
      id: 'capitalone-static-overview',
      title: 'Capital One Venture X - Official Overview (Static)',
      content: `Capital One Venture X Rewards Credit Card

EARNING RATES:
- 10X miles on hotels and rental cars booked through Capital One Travel
- 5X miles on flights and vacation rentals booked through Capital One Travel
- 2X miles on every other purchase, every day

ANNUAL FEE: $395

TRAVEL CREDITS:
- $300 annual travel credit for bookings through Capital One Travel, automatically applied
- Up to $120 credit for Global Entry or TSA PreCheck (every 4 years)

LOUNGE ACCESS:
- Unlimited access to 1,300+ Priority Pass lounges worldwide (enrollment required)
- Unlimited access to Capital One Lounges and Landings (DFW, DEN, IAD, DCA)
- Primary cardholder can bring up to 2 complimentary guests per Priority Pass visit
- Authorized users do NOT have complimentary lounge access; lounge access costs $125/year per additional cardholder

ANNIVERSARY BONUS: 10,000 bonus miles on each account anniversary

TRAVEL ERASER:
- Redeem miles for travel purchases at 1 cent per mile (1cpp)
- NO minimum redemption - erase any amount, even $0.01
- Apply miles to erase travel purchases made in the past 90 days

TRANSFER PARTNERS: Transfer miles 1:1 to 15+ airline and hotel partners`,
      source: 'capitalone', // Must match DB constraint
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 90, // Lower score than scraped content
      createdAt: now,
      freshnessScore: 0.8, // Lower freshness since it's static
      source_tier: 0, // Tier 0: Official Capital One
    },
    {
      id: 'capitalone-static-travel-portal',
      title: 'Capital One Travel Portal - How It Works (Static)',
      content: `Capital One Travel Portal

EARNING ON TRAVEL BOOKINGS:
- Flights: Earn 5X miles per dollar spent
- Vacation Rentals: Earn 5X miles per dollar spent
- Hotels: Earn 10X miles per dollar spent
- Rental Cars: Earn 10X miles per dollar spent

$300 ANNUAL TRAVEL CREDIT:
- Automatically applied to Capital One Travel bookings
- Resets each cardmember year (not calendar year)
- No minimum purchase required
- Can be used for flights, hotels, or rental cars

PORTAL PRICING:
- Powered by Hopper technology
- Price match guarantee on flights
- Always compare with direct prices to ensure best value

WHEN TO USE PORTAL VS DIRECT:
- Use portal if price is within ~7% of direct (5X vs 2X miles makes up the difference)
- Book direct if portal price is significantly higher
- Consider: portal bookings may not earn airline status`,
      source: 'capitalone', // Must match DB constraint
      url: 'https://travel.capitalone.com',
      author: 'Capital One',
      score: 90,
      createdAt: now,
      freshnessScore: 0.8,
      source_tier: 0, // Tier 0: Official Capital One
    },
    {
      id: 'capitalone-static-transfer-partners',
      title: 'Capital One Transfer Partners - Complete List (Static)',
      content: `Capital One Miles Transfer Partners

TRANSFER RATIO: 1:1 (1,000 Capital One miles = 1,000 partner miles)
TRANSFER TIME: Usually instant, some may take up to 2 business days

AIRLINE PARTNERS:
- Turkish Miles&Smiles (Star Alliance) - Great for business/first class awards
- Emirates Skywards - Emirates flights worldwide
- British Airways Executive Club (Avios) - Distance-based pricing
- Air France-KLM Flying Blue (SkyTeam) - Monthly Promo Rewards
- Singapore Airlines KrisFlyer (Star Alliance) - Premium cabin awards
- Avianca LifeMiles (Star Alliance) - Often cheapest awards, no fuel surcharges
- TAP Air Portugal Miles&Go (Star Alliance)
- Finnair Plus (oneworld)
- Etihad Guest
- Qantas Frequent Flyer (oneworld)
- Air Canada Aeroplan (Star Alliance)

HOTEL PARTNERS:
- Choice Privileges
- Accor Live Limitless
- Wyndham Rewards

TRANSFER TIPS:
- Watch for transfer bonuses (typically 20-30% extra)
- Never transfer speculatively - find award availability first
- Sweet spot: Turkish for Star Alliance business class to Europe`,
      source: 'capitalone', // Must match DB constraint
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 90,
      createdAt: now,
      freshnessScore: 0.8,
      source_tier: 0, // Tier 0: Official Capital One
    },

    // ============================================
    // FOCUSED CHUNK DOCUMENTS
    // Targeted ~200-word docs for high-similarity matching
    // on common questions about specific card features
    // ============================================

    {
      id: 'capitalone-static-annual-fee',
      title: 'Capital One Venture X Annual Fee',
      content: `The Capital One Venture X Rewards Credit Card has an annual fee of $395. While this is a premium annual fee, the card provides significant value that can more than offset the cost. The effective annual fee after credits is only $95 (or even negative) when you factor in the $300 annual travel credit and the 10,000 anniversary bonus miles (worth ~$100 at 1 cent per point). This means the card effectively pays for itself. The $395 annual fee is charged on each account anniversary date. There is no introductory fee waiver — the full $395 is charged in the first year. However, you do receive the $300 travel credit and anniversary bonus starting from year one. Compared to competing premium travel cards like the Chase Sapphire Reserve ($550) or Amex Platinum ($695), the Venture X offers a lower annual fee with competitive benefits.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-travel-credit',
      title: 'Capital One Venture X $300 Travel Credit',
      content: `The Capital One Venture X card provides a $300 annual travel credit that is automatically applied to bookings made through Capital One Travel (travel.capitalone.com). This credit resets each cardmember year (based on your account open date, not the calendar year). Key details: The $300 credit applies to flights, hotels, and rental cars booked through Capital One Travel. It is applied automatically — no enrollment or activation needed. There is no minimum purchase required. The credit can be used across multiple bookings until the $300 is exhausted. If your booking costs less than $300, the remaining balance rolls over for future Capital One Travel purchases within the same cardmember year. IMPORTANT: Per Capital One terms, rewards will NOT be earned on the portion of a purchase covered by the travel credit. For example, on a $500 flight booked through C1 Travel, the $300 credit applies, and you earn 5X miles only on the remaining $200 ($1,000 miles, not $2,500). The credit does NOT apply to purchases made directly with airlines or hotels.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-global-entry-tsa',
      title: 'Capital One Venture X Global Entry / TSA PreCheck Credit',
      content: `The Capital One Venture X card provides a statement credit of up to $120 every 4 years for Global Entry or TSA PreCheck application fees. Global Entry costs $120 and includes TSA PreCheck. TSA PreCheck alone costs approximately $78. The credit also covers NEXUS enrollment ($50). To use this benefit, simply pay the Global Entry, TSA PreCheck, or NEXUS application fee with your Venture X card. The statement credit is applied automatically within 1-2 billing cycles — no need to call or enroll separately. The 4-year cycle resets after you receive the credit, so you can use it again when your membership is up for renewal. Global Entry provides expedited clearance for pre-approved, low-risk travelers upon arrival in the United States and includes TSA PreCheck for domestic flights. This benefit applies to the primary cardholder only; authorized users would need to pay with the primary card and would use the same $120 credit.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-anniversary-bonus',
      title: 'Capital One Venture X Anniversary Bonus Miles',
      content: `The Capital One Venture X card awards 10,000 bonus miles on each account anniversary. This anniversary bonus is automatic — you receive it simply by keeping the card open. At a minimum redemption value of 1 cent per mile (via Travel Eraser), these 10,000 miles are worth at least $100. When transferred to airline partners at optimal rates, they can be worth $150-$200 or more. The anniversary bonus posts to your account shortly after your account anniversary date (the date you originally opened the card). Combined with the $300 annual travel credit, the anniversary bonus effectively reduces the net annual fee from $395 to approximately $0 or even negative. Year 1 note: You DO receive the 10,000 anniversary bonus after your first year. The annual fee ($395) is charged on the anniversary date, but the 10,000 miles and $300 credit offset most of it.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-foreign-transaction-fees',
      title: 'Capital One Venture X Foreign Transaction Fees',
      content: `The Capital One Venture X card charges NO foreign transaction fees on any purchases made outside the United States or in a foreign currency. This makes it an excellent card for international travel. Whether you're purchasing items online from foreign merchants, paying at restaurants in Europe, or booking hotels in Asia, you will not incur any additional fees beyond the purchase amount. Many competing cards charge 2-3% foreign transaction fees, which can add up quickly on international trips. Capital One has a long-standing policy of not charging foreign transaction fees across most of their card products, and the Venture X is no exception. The card uses the Visa Infinite network, which provides excellent international acceptance. Additionally, you'll earn 2X miles on all international purchases (or 5X/10X if booked through Capital One Travel for flights/hotels respectively). There is no need to notify Capital One before traveling internationally — the card works globally without travel alerts.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-lounge-access',
      title: 'Capital One Venture X Lounge Access and Priority Pass',
      content: `The Capital One Venture X card provides premium airport lounge access through multiple programs (updated February 1, 2026). PRIORITY PASS SELECT: Complimentary membership (enrollment required) with access to 1,300+ airport lounges worldwide. Primary cardholder can bring up to 2 complimentary guests per visit to Priority Pass lounges. Additional guests cost $35 each per visit. CAPITAL ONE LOUNGES AND LANDINGS: Exclusive access to Capital One's own premium airport lounges at DFW (Dallas-Fort Worth), DEN (Denver), IAD (Washington Dulles), and DCA (Ronald Reagan Washington National). Capital One Lounges feature hot meals, craft cocktails and premium beverages, shower suites, relaxation rooms, nursing/mother's rooms, high-speed Wi-Fi, and premium workspaces. Capital One Lounge guests cost $45/visit (18+) and $25/visit (17 and under); children under 2 are free. Complimentary guests (2 at Lounges, 1 at Landings) are only available for cardholders who spend $75,000+ per year on their Venture X account. AUTHORIZED USER LOUNGE ACCESS: Authorized users do NOT have complimentary lounge access. Primary cardholders can purchase lounge access for authorized users at $125/year per additional cardholder. To access lounges, present your physical Venture X card or digital lounge pass via the Capital One Mobile app.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-authorized-users',
      title: 'Capital One Venture X Authorized Users',
      content: `The Capital One Venture X card allows you to add up to 4 authorized users at no additional annual fee for the card itself. Key details about authorized users: There is NO additional annual fee for adding authorized users to the card. You can add up to 4 authorized users on a Venture X account. Authorized users get their own card with their name. Authorized users earn miles on their purchases at the same rates as the primary cardholder (2X everyday, 5X flights and vacation rentals, 10X hotels/rental cars on Capital One Travel). All miles earned by authorized users accumulate in the primary cardholder's account. LOUNGE ACCESS (as of February 1, 2026): Authorized users do NOT have complimentary lounge access. Primary cardholders can purchase lounge access for authorized users at $125/year per additional cardholder, which grants access to Capital One Lounges, Landings, and Priority Pass lounges. Authorized users must be at least 18 years old and have a verified SSN to be eligible for lounge access. Authorized users who have paid lounge access can bring up to 2 complimentary guests to Priority Pass lounges.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-earn-rates',
      title: 'Capital One Venture X Earning Rates and Miles Multipliers',
      content: `The Capital One Venture X card earns Capital One miles at the following rates: 10X MILES on hotels booked through Capital One Travel — this is one of the highest hotel earning rates of any credit card. 10X MILES on rental cars booked through Capital One Travel. 5X MILES on flights booked through Capital One Travel. 5X MILES on vacation rentals booked through Capital One Travel. 2X MILES on every other purchase, every day — this flat 2X rate applies to all non-bonus categories including groceries, dining, gas, utilities, and everything else. There are no rotating categories and no spending caps on any earning tier. IMPORTANT: The $300 travel credit portion of a Capital One Travel booking does NOT earn miles. Per Capital One's terms: "Rewards will not be earned on the Credit." So on a $500 hotel booking through Capital One Travel, you earn 10X on $200 (the amount after the credit), not on $500. Miles are posted to your account after each statement cycle. Capital One miles do not expire as long as your account remains open and in good standing. You can also earn miles through transfer partner bonuses and referral bonuses.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-signup-bonus',
      title: 'Capital One Venture X Sign-Up Bonus',
      content: `The Capital One Venture X card currently offers a sign-up bonus of 75,000 bonus miles after spending $4,000 on purchases within the first 6 months of account opening. At a conservative 1 cent per mile (Travel Eraser), these 75,000 miles are worth $750 in travel. At 1.5 cents per mile via transfer partners, the bonus is worth approximately $1,125. This sign-up bonus alone more than offsets the $395 annual fee in the first year. To earn the bonus: (1) Apply and get approved for the Venture X card, (2) Spend $4,000 on any purchases within 6 months of account opening ($667/month average), (3) The 75,000 miles will post to your account within 1-2 billing cycles after meeting the spending requirement. Tips for meeting the minimum spend: Use the card for regular expenses (groceries, gas, bills), pay rent through a service that accepts credit cards, time large purchases to coincide with the bonus period. Note: Sign-up bonus offers may change over time. The miles from the sign-up bonus can be used for Travel Eraser, transferred to airline/hotel partners, or applied to Capital One Travel bookings.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-cell-phone-protection',
      title: 'Capital One Venture X Cell Phone Protection',
      content: `The Capital One Venture X card includes cell phone protection insurance. Key details: Coverage of up to $800 per claim with a $25 deductible. This benefit covers damage or theft of your cell phone when you pay your monthly cell phone bill with your Venture X card. Coverage applies to the primary cardholder and any lines on the same cell phone account. To be eligible, you must have paid your most recent monthly cell phone bill in full with your Venture X card BEFORE the damage or theft occurs. Claims must be filed within 90 days of the incident. This benefit covers smartphones and is secondary to any other insurance you may have. The maximum benefit is $800 per claim and up to $1,600 per 12-month period. Cell phone protection is a valuable benefit that can save you from expensive insurance plans offered by carriers. Simply pay your monthly phone bill with your Venture X card to activate this coverage.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-travel-protections',
      title: 'Capital One Venture X Travel Protections and Insurance',
      content: `The Capital One Venture X card includes comprehensive travel protection benefits. TRIP CANCELLATION/INTERRUPTION INSURANCE: Up to $5,000 per trip for prepaid, non-refundable travel expenses if your trip is cancelled or interrupted due to covered reasons (illness, severe weather, etc.). TRIP DELAY REIMBURSEMENT: Up to $500 per trip for expenses incurred due to a covered trip delay of 6 hours or more. Covers meals, lodging, and essential items during the delay. LOST LUGGAGE REIMBURSEMENT: Up to $3,000 for lost or damaged luggage when traveling on a common carrier (airline, train, etc.). BAGGAGE DELAY INSURANCE: Up to $500 for essential purchases if your checked baggage is delayed by 6 or more hours. Covers clothing, toiletries, and other necessities. PRIMARY AUTO RENTAL CDW (Collision Damage Waiver): The Venture X provides PRIMARY coverage for rental car damage or theft. This means it pays FIRST, before your personal auto insurance — a significant advantage over cards that only offer secondary coverage. Coverage applies when you decline the rental company's CDW and pay for the rental entirely with your Venture X card. HERTZ PRESIDENT'S CIRCLE: Complimentary Hertz President's Circle elite status, which includes vehicle upgrades, priority service, and other perks. To activate these benefits, simply pay for your travel with your Venture X card.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
    {
      id: 'capitalone-static-visa-infinite-benefits',
      title: 'Capital One Venture X Visa Infinite Benefits',
      content: `The Capital One Venture X card is issued on the Visa Infinite network, which provides additional premium benefits beyond the card's core features. LUXURY HOTEL COLLECTION: Access to Visa Infinite's curated collection of premium hotels worldwide. Benefits at participating properties typically include: complimentary room upgrade upon availability, free daily breakfast for two, guaranteed late checkout, and a special amenity (such as a spa credit or dining credit). CONCIERGE SERVICE: 24/7 Visa Infinite Concierge available by phone to assist with restaurant reservations, event tickets, travel planning, and other personal requests. VISA INFINITE PRIVILEGES: Access to exclusive experiences, events, and offers across dining, entertainment, and travel. PURCHASE PROTECTIONS: Extended warranty protection that extends the manufacturer's warranty on eligible purchases. Purchase security covering new purchases against damage or theft. NOTE: Visa Infinite is the highest tier of Visa cards, above Visa Signature. Not all benefits may be available in all regions. Contact Visa Infinite Concierge for details specific to your card.`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0,
    },
  ];
}

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateEmbedding(text) {
  const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 500);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (HF_API_KEY) {
      headers['Authorization'] = `Bearer ${HF_API_KEY}`;
    }
    
    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: cleanText,
        options: { wait_for_model: true },
      }),
    });
    
    if (!response.ok) {
      console.error(`[Seed] Embedding error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const embedding = Array.isArray(data[0]) ? data[0] : data;
    
    if (embedding.length === 384) {
      return embedding;
    }
    console.error(`[Seed] Unexpected embedding dimension: ${embedding.length}`);
    return null;
  } catch (err) {
    console.error('[Seed] Embedding exception:', err.message);
    return null;
  }
}

// ============================================
// SUPABASE UPSERT
// ============================================

async function upsertDocument(doc, embedding) {
  const dateStr = new Date(doc.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const enhancedContent = doc.source.startsWith('reddit')
    ? `[From ${dateStr}] ${doc.content}`
    : doc.content;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      p_id: doc.id,
      p_embedding: embedding,
      p_content: enhancedContent.slice(0, 10000),
      p_title: doc.title.slice(0, 500),
      p_source: doc.source,
      p_url: doc.url,
      p_author: doc.author,
      p_score: doc.score,
      p_source_tier: doc.source_tier ?? (doc.source === 'capitalone' ? 0 : 2),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upsert failed: ${response.status} - ${error}`);
  }
  
  return true;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     VentureXify Knowledge Base Seeder                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Validate config
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('   Required: SUPABASE_URL (or VITE_SUPABASE_URL)');
    console.error('   Required: SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   • Capital One scraping: ${INCLUDE_CAPITALONE ? 'ON' : 'OFF'}`);
  console.log(`   • Reddit scraping: ${INCLUDE_REDDIT ? 'ON' : 'OFF'}`);
  console.log(`   • Reddit method: ${USE_PLAYWRIGHT ? '🎭 Playwright (headless browser)' : REDDIT_CLIENT_ID ? '🔑 OAuth API' : '📡 Public JSON API'}`);
  console.log(`   • Max Reddit posts: ${MAX_POSTS}`);
  console.log(`   • Supabase URL: ${SUPABASE_URL.slice(0, 40)}...`);
  console.log(`   • HF API Key: ${HF_API_KEY ? 'SET' : 'NOT SET (may be rate limited)'}`);
  console.log('');

  // Collect documents
  const allDocs = [];

  // 1. Scrape Capital One website (most authoritative, freshest)
  if (INCLUDE_CAPITALONE) {
    const capitalOneDocs = await scrapeCapitalOne();
    allDocs.push(...capitalOneDocs);
  }
  
  // ALWAYS include static Capital One content regardless of scraping results.
  // Static content contains focused, high-quality chunks that ensure official
  // Tier 0 sources are always present in the knowledge base for common questions.
  {
    console.log('[Seed] Adding static Capital One content (always included)...');
    const staticDocs = getStaticContent();
    // Deduplicate: skip static docs whose IDs are already in allDocs from scraping
    const existingIds = new Set(allDocs.map(d => d.id));
    const newStaticDocs = staticDocs.filter(d => !existingIds.has(d.id));
    allDocs.push(...newStaticDocs);
    console.log(`[Seed] Added ${newStaticDocs.length} static Capital One docs (${staticDocs.length - newStaticDocs.length} duplicates skipped)`);
  }

  // 2. Scrape Reddit (community knowledge)
  if (INCLUDE_REDDIT) {
    const redditDocs = await scrapeReddit(MAX_POSTS);
    allDocs.push(...redditDocs);
  }

  console.log(`[Seed] Total documents to index: ${allDocs.length}`);

  if (allDocs.length === 0) {
    console.error('❌ No documents to index!');
    process.exit(1);
  }

  // Process documents
  let successCount = 0;
  let errorCount = 0;

  for (const doc of allDocs) {
    process.stdout.write(`[Seed] Processing: ${doc.id.slice(0, 40)}... `);
    
    const textForEmbedding = `${doc.title}. ${doc.content}`.slice(0, 500);
    const embedding = await generateEmbedding(textForEmbedding);
    
    if (!embedding) {
      console.log('❌ (embedding failed)');
      errorCount++;
      continue;
    }
    
    try {
      await upsertDocument(doc, embedding);
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log(`❌ (${err.message})`);
      errorCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`✅ Complete! ${successCount} indexed, ${errorCount} errors`);
  console.log('════════════════════════════════════════════════════════════');
  console.log('');

  if (errorCount > 0 && successCount === 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
