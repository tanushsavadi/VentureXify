// ============================================
// VENTUREX SEED - Supabase Edge Function
// Scrapes Reddit r/VentureX and populates knowledge base
// ============================================
// 
// Deploy with: supabase functions deploy venturex-seed
//
// Trigger options:
// 1. HTTP POST (manual): curl -X POST https://<project>.functions.supabase.co/venturex-seed
// 2. Scheduled (cron): Set up in Supabase Dashboard > Database > Scheduled Functions
// 3. GitHub Action: Call on push to main
//
// Environment variables needed:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - HF_API_KEY (optional but recommended)
//
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// CONFIGURATION
// ============================================

// Date cutoffs for content freshness
// Relaxed: Accept content from 2023+ (most r/VentureX posts are from card launch in late 2021)
const POLICY_CUTOFF_DATE = new Date('2023-06-01').getTime() / 1000 // Unix timestamp
const QA_CUTOFF_DATE = new Date('2022-01-01').getTime() / 1000

// Policy-related keywords (require recent content)
const POLICY_KEYWORDS = [
  'minimum', 'miles required', 'redemption', 'eraser', 
  'annual fee', 'bonus', 'credit', 'transfer', 'partner',
  'lounge', 'priority pass', 'tsa precheck', 'global entry'
]

// Embedding model
const HF_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5'
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}`

// ============================================
// TYPES
// ============================================

interface RedditPost {
  id: string
  title: string
  selftext: string
  author: string
  score: number
  num_comments: number
  created_utc: number
  permalink: string
}

interface ScrapedDoc {
  id: string
  title: string
  content: string
  source: string
  url: string
  author: string
  score: number
  createdAt: number
  freshnessScore: number
  source_tier: number // 0=Official, 1=Guide, 2=Community
}

// ============================================
// FRESHNESS SCORING
// ============================================

function calculateFreshnessScore(createdUtc: number): number {
  const now = Date.now() / 1000
  const ageInDays = (now - createdUtc) / (60 * 60 * 24)
  
  if (ageInDays <= 90) return 1.0      // Last 3 months
  if (ageInDays <= 365) return 0.7     // 3-12 months
  if (ageInDays <= 730) return 0.4     // 1-2 years
  return 0.2                            // 2+ years
}

function isPolicyContent(text: string): boolean {
  const lower = text.toLowerCase()
  return POLICY_KEYWORDS.some(kw => lower.includes(kw))
}

function shouldIncludeContent(doc: ScrapedDoc): boolean {
  // Policy content needs to be from 2024+
  if (isPolicyContent(doc.content) || isPolicyContent(doc.title)) {
    return doc.createdAt >= POLICY_CUTOFF_DATE
  }
  // General content from 2023+
  return doc.createdAt >= QA_CUTOFF_DATE
}

// ============================================
// REDDIT SCRAPING (Server-side, no CORS issues)
// ============================================

async function scrapeReddit(maxPosts: number = 50): Promise<ScrapedDoc[]> {
  console.log('[Seed] Scraping Reddit r/Venturex...')
  const docs: ScrapedDoc[] = []
  
  // Fetch hot, top (month), and top (all time)
  // Note: Subreddit is "Venturex" (lowercase x) per Reddit API
  const endpoints = [
    `https://www.reddit.com/r/Venturex/hot.json?limit=${Math.ceil(maxPosts / 3)}`,
    `https://www.reddit.com/r/Venturex/top.json?limit=${Math.ceil(maxPosts / 3)}&t=month`,
    `https://www.reddit.com/r/Venturex/top.json?limit=${Math.ceil(maxPosts / 3)}&t=all`,
  ]
  
  const seenIds = new Set<string>()
  
  for (const url of endpoints) {
    try {
      console.log(`[Seed] Fetching: ${url}`)
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VentureXOS/1.0)' }
      })
      
      console.log(`[Seed] Response status: ${response.status}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Seed] Reddit API error: ${response.status} - ${errorText.slice(0, 200)}`)
        continue
      }
      
      const data = await response.json()
      
      for (const child of data.data?.children || []) {
        const post: RedditPost = child.data
        
        // Skip duplicates
        if (seenIds.has(post.id)) continue
        seenIds.add(post.id)
        
        // Skip if content is too short (relaxed: title-only posts are OK)
        if ((post.selftext?.length || 0) < 10 && post.title.length < 10) continue
        
        const freshnessScore = calculateFreshnessScore(post.created_utc)
        
        const doc: ScrapedDoc = {
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
        }
        
        // For now, include all posts to debug (no date filtering)
        docs.push(doc)
      }
    } catch (err) {
      console.error(`[Seed] Error fetching ${url}:`, err)
    }
  }
  
  console.log(`[Seed] Scraped ${docs.length} posts from Reddit`)
  return docs
}

// ============================================
// STATIC CONTENT (Official Capital One info)
// ============================================

function getStaticContent(): ScrapedDoc[] {
  const now = Date.now() / 1000
  
  return [
    {
      id: 'capitalone-static-overview',
      title: 'Capital One Venture X - Official Overview',
      content: `Capital One Venture X Rewards Credit Card

EARNING RATES:
- 10X miles on hotels and rental cars booked through Capital One Travel
- 5X miles on flights and vacation rentals booked through Capital One Travel
- 2X miles on every other purchase, every day

ANNUAL FEE: $395

TRAVEL CREDITS:
- $300 annual travel credit for bookings through Capital One Travel, automatically applied
- Up to $120 credit for Global Entry or TSA PreCheck (every 4 years)

LOUNGE ACCESS (updated February 1, 2026):
- Unlimited access to 1,300+ Priority Pass lounges worldwide (enrollment required)
- Unlimited access to Capital One Lounges and Landings (DFW, DEN, IAD, DCA)
- Primary cardholder can bring up to 2 complimentary guests per Priority Pass visit
- Capital One Lounge guests: $45/visit (18+), $25/visit (17 and under), free under 2
- Authorized users do NOT have complimentary lounge access; lounge access costs $125/year per additional cardholder
- Up to 4 authorized users can be added at no additional card fee

ANNIVERSARY BONUS: 10,000 bonus miles on each account anniversary

TRAVEL ERASER:
- Redeem miles for travel purchases at 1 cent per mile (1cpp)
- NO minimum redemption - erase any amount, even $0.01
- Apply miles to erase travel purchases made in the past 90 days

TRANSFER PARTNERS: Transfer miles 1:1 to 15+ airline and hotel partners`,
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0, // Official Capital One
    },
    {
      id: 'capitalone-static-travel-portal',
      title: 'Capital One Travel Portal - How It Works',
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
      source: 'capitalone',
      url: 'https://travel.capitalone.com',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0, // Official Capital One
    },
    {
      id: 'capitalone-static-transfer-partners',
      title: 'Capital One Transfer Partners - Complete List',
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
      source: 'capitalone',
      url: 'https://www.capitalone.com/credit-cards/venture-x/',
      author: 'Capital One',
      score: 100,
      createdAt: now,
      freshnessScore: 1.0,
      source_tier: 0, // Official Capital One
    },
  ]
}

// ============================================
// EMBEDDING GENERATION
// ============================================

async function generateEmbedding(text: string, hfApiKey: string | undefined): Promise<number[] | null> {
  const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 500)
  
  try {
    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(hfApiKey ? { 'Authorization': `Bearer ${hfApiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: cleanText,
        options: { wait_for_model: true },
      }),
    })
    
    if (!response.ok) {
      console.error(`[Seed] Embedding error: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    const embedding = Array.isArray(data[0]) ? data[0] : data
    
    if (embedding.length === 384) {
      return embedding
    }
    return null
  } catch (err) {
    console.error('[Seed] Embedding exception:', err)
    return null
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const HF_API_KEY = Deno.env.get('HF_API_KEY')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    console.log('[Seed] Starting knowledge base seed...')
    
    // Parse options from request body (if any)
    let options = { maxPosts: 50, includeReddit: true, includeStatic: true }
    try {
      const body = await req.json()
      options = { ...options, ...body }
    } catch {
      // No body, use defaults
    }
    
    // ============================================
    // PHASE 1: COLLECT DOCUMENTS
    // ============================================
    const allDocs: ScrapedDoc[] = []
    
    if (options.includeReddit) {
      const redditDocs = await scrapeReddit(options.maxPosts)
      allDocs.push(...redditDocs)
    }
    
    // ALWAYS include static Capital One content to ensure Tier 0 sources
    // are present in the knowledge base, regardless of other options.
    {
      const staticDocs = getStaticContent()
      // Deduplicate: skip static docs already present from other sources
      const existingIds = new Set(allDocs.map(d => d.id))
      const newStaticDocs = staticDocs.filter(d => !existingIds.has(d.id))
      allDocs.push(...newStaticDocs)
      console.log(`[Seed] Added ${newStaticDocs.length} static Capital One docs (Tier 0)`)
    }
    
    console.log(`[Seed] Total documents to index: ${allDocs.length}`)
    
    if (allDocs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No documents to index' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // ============================================
    // PHASE 2: GENERATE EMBEDDINGS & UPSERT
    // ============================================
    let successCount = 0
    let errorCount = 0
    
    for (const doc of allDocs) {
      // Generate embedding
      const textForEmbedding = `${doc.title}. ${doc.content}`.slice(0, 500)
      const embedding = await generateEmbedding(textForEmbedding, HF_API_KEY)
      
      if (!embedding) {
        errorCount++
        continue
      }
      
      // Add date context to content for AI
      const dateStr = new Date(doc.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const enhancedContent = doc.source.startsWith('reddit') 
        ? `[From ${dateStr}] ${doc.content}` 
        : doc.content
      
      // Upsert to database
      try {
        const { error } = await supabase.rpc('upsert_knowledge', {
          p_id: doc.id,
          p_embedding: embedding,
          p_content: enhancedContent.slice(0, 10000),
          p_title: doc.title.slice(0, 500),
          p_source: doc.source,
          p_url: doc.url,
          p_author: doc.author,
          p_score: doc.score,
          p_source_tier: doc.source_tier ?? (doc.source === 'capitalone' ? 0 : 2),
        })
        
        if (error) {
          console.error(`[Seed] Upsert error for ${doc.id}:`, error)
          errorCount++
        } else {
          successCount++
        }
      } catch (e) {
        console.error(`[Seed] Exception upserting ${doc.id}:`, e)
        errorCount++
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    
    console.log(`[Seed] Complete! ${successCount} indexed, ${errorCount} errors`)
    
    return new Response(
      JSON.stringify({
        success: true,
        indexed: successCount,
        errors: errorCount,
        total: allDocs.length,
        message: `Knowledge base seeded: ${successCount}/${allDocs.length} documents indexed`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Seed] Fatal error:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
