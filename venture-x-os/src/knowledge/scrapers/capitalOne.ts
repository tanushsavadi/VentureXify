// ============================================
// CAPITAL ONE WEBSITE SCRAPER
// Extracts official documentation from Capital One pages
// ============================================

import { ScrapedDocument } from './reddit';

// Known Capital One Venture X page (only the main page exists)
const CAPITAL_ONE_PAGES = [
  {
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    title: 'Capital One Venture X Card - Overview',
    section: 'overview'
  },
];

// CORS proxies disabled - they are unreliable and cause errors
// The static content fallback is more reliable for production use
const CORS_PROXIES: string[] = [];

/**
 * Extract text content from HTML
 * Simple extraction without DOM parsing (works in service worker)
 */
function extractTextFromHTML(html: string): string {
  // Remove script and style content
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
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
  
  // Clean up whitespace
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

/**
 * Extract specific content sections from Capital One page
 */
function extractCapitalOneContent(html: string, url: string): string {
  // Try to find main content areas
  const contentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return extractTextFromHTML(match[1]);
    }
  }
  
  // Fallback to body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return extractTextFromHTML(bodyMatch[1]);
  }
  
  return extractTextFromHTML(html);
}

/**
 * Fetch a Capital One page
 * Note: This will typically fail due to CORS in extension context.
 * That's expected - we fall back to static content.
 */
async function fetchCapitalOnePage(url: string): Promise<string | null> {
  // In extension context, direct fetches to Capital One will fail due to CORS
  // This is expected behavior - we have static fallback content
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; VentureXOS/1.0)',
      },
    });
    
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Expected to fail in extension context - silently continue
  }
  
  // Try CORS proxies (if any configured)
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        headers: {
          'Accept': 'text/html',
        },
      });
      
      if (response.ok) {
        return await response.text();
      }
    } catch {
      continue;
    }
  }
  
  // This is expected - we have static fallback content
  // Don't log as error since it's normal behavior
  return null;
}

/**
 * Scrape a single Capital One page
 */
export async function scrapeCapitalOnePage(
  url: string,
  title: string
): Promise<ScrapedDocument | null> {
  console.log(`[CapitalOneScraper] Scraping ${url}`);
  
  const html = await fetchCapitalOnePage(url);
  if (!html) {
    return null;
  }
  
  const content = extractCapitalOneContent(html, url);
  
  if (content.length < 100) {
    console.log(`[CapitalOneScraper] Insufficient content from ${url}`);
    return null;
  }
  
  return {
    id: `capitalone-${url.replace(/[^a-z0-9]/gi, '-')}`,
    source: 'capitalone',
    title,
    content: content.slice(0, 10000), // Limit content length
    url,
    scrapedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    metadata: {
      domain: 'capitalone.com',
      type: 'official',
    },
  };
}

/**
 * Full scrape of known Capital One Venture X pages
 * Note: In extension context, this will typically fail due to CORS
 * and fall back to static content. That's expected behavior.
 */
export async function fullCapitalOneScrape(): Promise<ScrapedDocument[]> {
  const docs: ScrapedDocument[] = [];
  
  for (const page of CAPITAL_ONE_PAGES) {
    try {
      const doc = await scrapeCapitalOnePage(page.url, page.title);
      if (doc) {
        docs.push(doc);
      }
    } catch {
      // Expected to fail in extension context - silently continue
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return docs;
}

// ============================================
// STATIC CAPITAL ONE KNOWLEDGE
// Fallback content if scraping fails
// This is manually curated from official sources
// ============================================

export const CAPITAL_ONE_STATIC_CONTENT: ScrapedDocument[] = [
  {
    id: 'capitalone-static-overview',
    source: 'capitalone',
    title: 'Capital One Venture X - Official Overview',
    content: `
Capital One Venture X Rewards Credit Card

EARNING RATES:
- 10X miles on hotels and rental cars booked through Capital One Travel
- 5X miles on flights booked through Capital One Travel
- 2X miles on every other purchase, every day

ANNUAL FEE: $395

WELCOME BONUS: Earn up to 75,000 bonus miles when you spend $4,000 on purchases within the first 3 months

TRAVEL CREDITS:
- $300 annual travel credit for bookings through Capital One Travel, automatically applied
- Up to $100 credit for Global Entry or TSA PreCheck (every 4 years)

LOUNGE ACCESS:
- Unlimited access to 1,400+ Priority Pass lounges worldwide
- Unlimited access to Capital One Lounges
- 2 free guests per Priority Pass visit

ANNIVERSARY BONUS:
- 10,000 bonus miles on each account anniversary

TRANSFER PARTNERS:
- Transfer miles 1:1 to 15+ airline and hotel partners
- Partners include: Turkish Miles&Smiles, Emirates Skywards, British Airways Avios, Air France-KLM Flying Blue, Singapore Airlines KrisFlyer, Avianca LifeMiles, TAP Miles&Go, Finnair Plus, Etihad Guest, Qantas Frequent Flyer, Air Canada Aeroplan, Choice Privileges, Accor Live Limitless, Wyndham Rewards

TRAVEL ERASER:
- Redeem miles for travel purchases at a rate of 1 cent per mile (1cpp)
- Apply miles to erase travel purchases made in the past 90 days
- NO minimum redemption - erase any amount, even $0.01
- Partial redemptions allowed - choose exactly how much to erase

ADDITIONAL BENEFITS:
- No foreign transaction fees
- Primary car rental coverage
- Trip cancellation/interruption insurance
- Lost luggage reimbursement
- Extended warranty protection
- Purchase protection
- Complimentary Hertz President's Circle status
- Visa Infinite benefits
    `.trim(),
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2024-01-01',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
    },
  },
  {
    id: 'capitalone-static-travel-portal',
    source: 'capitalone',
    title: 'Capital One Travel Portal - How It Works',
    content: `
Capital One Travel Portal

HOW TO ACCESS:
- Log in to your Capital One account
- Navigate to "Travel" section or visit travel.capitalone.com
- Search and book flights, hotels, and rental cars

EARNING ON TRAVEL BOOKINGS:
- Flights: Earn 5X miles per dollar spent
- Hotels: Earn 10X miles per dollar spent  
- Rental Cars: Earn 10X miles per dollar spent
- All other purchases: Earn 2X miles per dollar spent

$300 ANNUAL TRAVEL CREDIT:
- Automatically applied to Capital One Travel bookings
- Resets each cardmember year (not calendar year)
- No minimum purchase required
- Can be used for flights, hotels, or rental cars

PORTAL PRICING:
- Powered by Hopper technology
- Price match guarantee on flights
- Prices may differ from direct airline/hotel booking
- Always compare with direct prices to ensure best value

BOOKING FLEXIBILITY:
- Modify or cancel bookings through the portal
- Cancellation policies vary by airline/hotel
- Some bookings may be non-refundable

WHEN TO USE PORTAL VS DIRECT:
- Use portal if price is within ~7% of direct (5X vs 2X miles makes up the difference)
- Book direct if portal price is significantly higher
- Consider status earning - portal bookings may not earn airline status
    `.trim(),
    url: 'https://travel.capitalone.com',
    scrapedAt: new Date().toISOString(),
    createdAt: '2024-01-01',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
    },
  },
  {
    id: 'capitalone-static-transfer-partners',
    source: 'capitalone',
    title: 'Capital One Transfer Partners - Complete List (Official)',
    content: `
Capital One Miles Transfer Partners
Source: https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/
Last Updated: January 2026

TRANSFER REQUIREMENTS:
- Minimum transfer: 1,000 Capital One miles
- Name on Capital One account must match name on loyalty program
- Transfers are final and cannot be reversed

CONVERSION RATIOS EXPLAINED:
- 1:1 ratio: 1,000 C1 miles = 1,000 partner miles
- 1:2 ratio: 1,000 C1 miles = 2,000 partner miles
- 2:1.5 ratio: 1,000 C1 miles = 750 partner miles
- 5:3 ratio: 1,000 C1 miles = 600 partner miles
- 2:1 ratio: 1,000 C1 miles = 500 partner miles

AIRLINE PARTNERS (1:1 RATIO):
- Aeromexico Rewards
- Air Canada Aeroplan® (Star Alliance) - North America
- Avianca LifeMiles (Star Alliance) - Often cheapest, no fuel surcharges
- British Airways Avios (oneworld) - Distance-based pricing
- Cathay Pacific Asia Miles (oneworld)
- Etihad Guest - Middle East and beyond
- Finnair Plus (oneworld) - Europe and Asia
- Flying Blue (Air France-KLM, SkyTeam) - Monthly Promo Rewards
- Qantas Frequent Flyer (oneworld) - Australia/Pacific
- Qatar Airways Privilege Club (oneworld)
- Singapore Airlines KrisFlyer (Star Alliance) - Premium cabins
- TAP Miles&Go (Star Alliance) - Europe
- Turkish Airlines Miles&Smiles (Star Alliance) - SWEET SPOT for business class
- Virgin Red

AIRLINE PARTNERS (OTHER RATIOS):
- Emirates Skywards: 2:1.5 ratio (1,000 C1 miles = 750 Emirates miles)
- EVA Air: 2:1.5 ratio (1,000 C1 miles = 750 EVA miles)
- Japan Airlines Mileage Bank: 2:1.5 ratio (1,000 C1 miles = 750 JAL miles)
- JetBlue TrueBlue: 5:3 ratio (1,000 C1 miles = 600 JetBlue points)

HOTEL PARTNERS:
- Choice Privileges: 1:1 ratio (US accounts only)
- Wyndham Rewards: 1:1 ratio
- I Prefer Hotel Rewards: 1:2 ratio (BEST - 1,000 C1 miles = 2,000 points!)
- Accor Live Limitless: 2:1 ratio (1,000 C1 miles = 500 Accor points)

TRANSFER TIPS:
- Watch for transfer bonuses (typically 20-30% extra)
- Most transfers are instant; some may take up to 2 business days
- NEVER transfer speculatively - find award availability first
- Sweet spots:
  * Turkish for Star Alliance business class to Europe (low fuel surcharges)
  * Avianca LifeMiles for no-fuel-surcharge awards
  * British Airways Avios for short-haul domestic flights
  * I Prefer for 2x hotel value

HOW TO TRANSFER:
1. Sign in to Capital One account online or mobile app
2. Navigate to rewards section
3. Select "Transfer miles" and choose partner
4. Transfers are FINAL - cannot be reversed
    `.trim(),
    url: 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-01-29',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
    },
  },
  {
    id: 'capitalone-static-benefits-comprehensive',
    source: 'capitalone',
    title: 'Capital One Venture X - Comprehensive Benefits Guide',
    content: `
Capital One Venture X Rewards Credit Card — Comprehensive Benefits

VISA INFINITE BENEFITS:
- Visa Infinite Luxury Hotel Collection — automatic room upgrades when available, late checkout, complimentary breakfast for two, and a $25 food & beverage credit at 900+ luxury hotels worldwide
- Visa Infinite Concierge — 24/7 personal concierge service for travel bookings, dining reservations, entertainment tickets, and special requests
- Access to the Visa Infinite benefits portal for exclusive offers and experiences

RENTAL CAR BENEFITS:
- Primary auto rental collision damage waiver (CDW) — covers theft and collision damage on eligible rental vehicles when you decline the rental company's CDW
- Coverage for rentals up to 15 consecutive days in the US and most countries internationally
- Must decline the rental company's CDW/LDW to activate benefit
- Does NOT cover liability, personal injury, or personal belongings
- Complimentary Hertz President's Circle elite status — top-tier status with upgrades, preferred vehicles, and expedited service
- Preferred rental car programs with Avis, National, and other major providers

TRAVEL PROTECTION:
- Trip cancellation/interruption insurance — up to $5,000 per trip and $10,000 per year per covered person for prepaid, non-refundable travel expenses
- Trip delay reimbursement — up to $500 per ticket for meals, lodging, and essential expenses after a delay of 6 or more hours
- Lost luggage reimbursement — up to $3,000 per passenger for checked or carry-on luggage lost by the carrier
- Baggage delay insurance — up to $500 for essential purchases (clothing, toiletries) after luggage is delayed 6 or more hours

PURCHASE PROTECTION:
- Extended warranty — extends the original manufacturer's warranty by up to 1 additional year on eligible items valued up to $10,000
- Purchase security — covers eligible new purchases against damage or theft for 120 days from the date of purchase, up to $10,000 per claim and $50,000 per year
- Note: Price protection was a previous benefit but has been discontinued on most Capital One cards as of recent policy updates

LOUNGE ACCESS (COMPREHENSIVE):
- Priority Pass Select membership — access to 1,300+ airport lounges worldwide
- Capital One Lounges — premium owned-and-operated lounges at DFW (Dallas-Fort Worth), DEN (Denver), IAD (Washington Dulles), and DCA (Ronald Reagan Washington National)
- Plaza Premium Lounge access included
- Guest policy (as of February 2025): Primary cardholder + 2 guests admitted free; authorized users can enter themselves but no longer receive free guest access
- Capital One Lounge amenities: hot meals, craft cocktails and premium beverages, shower suites, relaxation rooms, nursing/mother's rooms, high-speed Wi-Fi, and premium workspaces

CELL PHONE PROTECTION:
- Up to $800 per claim for cell phone damage or theft (subject to a $25 deductible)
- Up to 2 claims allowed per 12-month period
- Must pay your monthly cell phone bill with the Venture X card to be eligible
- Covers the primary account holder and any lines listed on the monthly bill

GLOBAL ENTRY / TSA PRECHECK CREDIT:
- Up to $100 statement credit every 4 years for Global Entry ($100) or TSA PreCheck (~$78) application fees
- Also covers NEXUS ($50) enrollment fees
- Statement credit applied automatically when the fee is charged to the card

OTHER KEY BENEFITS:
- No foreign transaction fees on any purchases made outside the United States
- Complimentary authorized user cards — no additional annual fee for authorized users
- 10,000 anniversary bonus miles each year on account anniversary (worth approximately $100 at 1cpp via Travel Eraser, or ~$180 at average transfer partner value)
- $300 annual travel credit automatically applied to Capital One Travel bookings
- Welcome bonus of 75,000 miles after meeting minimum spend (offer subject to change; check Capital One for current terms)
    `.trim(),
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
    },
  },
];

/**
 * Get Capital One static content synchronously
 * Returns the manually curated content without attempting to scrape
 */
export function getCapitalOneStaticContent(): ScrapedDocument[] {
  return CAPITAL_ONE_STATIC_CONTENT;
}

/**
 * Get Capital One content (async version)
 *
 * Note: In browser extension context, CORS prevents scraping Capital One pages.
 * We use comprehensive static content that is manually curated from official sources.
 * This is actually more reliable than scraping since page structure can change.
 */
export async function getCapitalOneContent(): Promise<ScrapedDocument[]> {
  // Skip scraping - CORS prevents it in extension context
  // Static content is comprehensive and manually maintained
  return CAPITAL_ONE_STATIC_CONTENT;
}
