#!/usr/bin/env node
// ============================================
// KNOWLEDGE BASE SEEDER
// Scrapes Reddit r/VentureX and populates Supabase
// ============================================
//
// Run locally: npm run seed
// Run via GitHub Action: .github/workflows/seed-knowledge-base.yml
//
// Environment variables:
// - SUPABASE_URL or VITE_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY
// - HF_API_KEY (optional but recommended)
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
          id: `capitalone-${page.url.replace(/[^a-z0-9]/gi, '-').slice(0, 50)}`,
          title: page.title,
          content: content.slice(0, 10000), // Limit content length
          source: 'capitalone', // Must match DB constraint: 'reddit-post', 'reddit-comment', 'capitalone'
          url: page.url,
          author: 'Capital One',
          score: 100,
          createdAt: now,
          freshnessScore: 1.0,
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
- 5X miles on flights booked through Capital One Travel
- 2X miles on every other purchase, every day

ANNUAL FEE: $395

TRAVEL CREDITS:
- $300 annual travel credit for bookings through Capital One Travel, automatically applied
- Up to $100 credit for Global Entry or TSA PreCheck (every 4 years)

LOUNGE ACCESS:
- Unlimited access to 1,400+ Priority Pass lounges worldwide
- Unlimited access to Capital One Lounges
- 2 free guests per Priority Pass visit

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
    },
    {
      id: 'capitalone-static-travel-portal',
      title: 'Capital One Travel Portal - How It Works (Static)',
      content: `Capital One Travel Portal

EARNING ON TRAVEL BOOKINGS:
- Flights: Earn 5X miles per dollar spent
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
    
    // Only add static content if scraping failed or returned < 2 docs
    if (capitalOneDocs.length < 2) {
      console.log('[Seed] Capital One scraping returned few results, adding static fallback...');
      const staticDocs = getStaticContent();
      allDocs.push(...staticDocs);
    }
  } else {
    // No scraping, use static content
    const staticDocs = getStaticContent();
    allDocs.push(...staticDocs);
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
