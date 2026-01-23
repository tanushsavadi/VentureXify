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
- Redeem miles for travel purchases at a rate of 1 cent per mile
- Apply miles to erase travel purchases made in the past 90 days
- Minimum redemption: 5,000 miles ($50)

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
    title: 'Capital One Transfer Partners - Complete List',
    content: `
Capital One Miles Transfer Partners

TRANSFER RATIO: 1:1 (1,000 Capital One miles = 1,000 partner miles)
TRANSFER TIME: Usually instant, some may take up to 2 business days

AIRLINE PARTNERS:
1. Turkish Miles&Smiles (Star Alliance) - Great for business/first class awards
2. Emirates Skywards - Emirates flights worldwide
3. British Airways Executive Club (Avios) - Distance-based pricing, good for short flights
4. Air France-KLM Flying Blue (SkyTeam) - Monthly Promo Rewards
5. Singapore Airlines KrisFlyer (Star Alliance) - Premium cabin awards
6. Avianca LifeMiles (Star Alliance) - Often cheapest awards, no fuel surcharges
7. TAP Air Portugal Miles&Go (Star Alliance) - Good for Europe
8. Finnair Plus (oneworld) - Europe and Asia routes
9. Etihad Guest - Middle East and beyond
10. Qantas Frequent Flyer (oneworld) - Australia and Pacific
11. Air Canada Aeroplan (Star Alliance) - North America

HOTEL PARTNERS:
1. Choice Privileges - Budget/midscale hotels
2. Accor Live Limitless - Global luxury brands
3. Wyndham Rewards - Global hotel chain

TRANSFER TIPS:
- Watch for transfer bonuses (typically 20-30% extra)
- Turkish and Emirates transfers are usually instant
- Never transfer speculatively - find award availability first
- Sweet spot: Turkish for Star Alliance business class to Europe
    `.trim(),
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2024-01-01',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
    },
  },
];

/**
 * Get Capital One content
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
