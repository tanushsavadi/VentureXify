// ============================================
// CAPITAL ONE WEBSITE SCRAPER
// Extracts official documentation from Capital One pages
// ============================================

import { ScrapedDocument } from './reddit';

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
- 5X miles on flights and vacation rentals booked through Capital One Travel
- 2X miles on every other purchase, every day

ANNUAL FEE: $395

WELCOME BONUS: Earn up to 75,000 bonus miles when you spend $4,000 on purchases within the first 3 months

TRAVEL CREDITS:
- $300 annual travel credit for bookings through Capital One Travel, automatically applied
- Up to $120 credit for Global Entry or TSA PreCheck (every 4 years)

LOUNGE ACCESS:
- Unlimited access to 1,300+ Priority Pass lounges worldwide (enrollment required)
- Unlimited access to Capital One Lounges and Landings (DFW, DEN, IAD, DCA)
- PRIORITY PASS GUEST POLICY (as of February 1, 2026): Primary cardholders can NO LONGER bring complimentary guests to Priority Pass lounges. Guest access at Priority Pass lounges now costs $35 per guest per visit.
- CAPITAL ONE LOUNGE GUEST POLICY: Primary cardholders can bring up to 2 complimentary guests. Additional guests cost $45/visit (ages 18+), $25/visit (ages 2-17), free under 2.
- Authorized users receive their own Priority Pass membership (no guest access privileges)

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
      source_tier: 0,
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
- Vacation Rentals: Earn 5X miles per dollar spent
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
      source_tier: 0,
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
      source_tier: 0,
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
- Travel accident insurance — up to $250,000 coverage for accidental death or dismemberment while traveling on a common carrier (airline, train, bus, cruise ship) when the fare is charged to the Venture X card. NOTE: This is NOT travel medical insurance — the Venture X does NOT include primary travel medical insurance for illness or injury while traveling.
- Trip delay reimbursement — up to $500 per ticket for meals, lodging, and essential expenses after a delay of 6 or more hours
- Lost luggage reimbursement — up to $3,000 per passenger for checked or carry-on luggage lost by the carrier
- Baggage delay insurance — up to $500 for essential purchases (clothing, toiletries) after luggage is delayed 6 or more hours
- Travel and emergency assistance services — 24/7 hotline for emergency travel assistance including medical referrals, legal referrals, emergency transportation, and translation services while traveling abroad

PURCHASE PROTECTION:
- Extended warranty — extends the original manufacturer's warranty by up to 1 additional year on eligible items valued up to $10,000
- Purchase security — covers eligible new purchases against damage or theft for 120 days from the date of purchase, up to $10,000 per claim and $50,000 per year
- Note: Price protection was a previous benefit but has been discontinued on most Capital One cards as of recent policy updates

LOUNGE ACCESS (COMPREHENSIVE) — Updated February 1, 2026:
- Priority Pass Select membership (enrollment required) — access to 1,300+ airport lounges worldwide
- Capital One Lounges and Landings — premium owned-and-operated lounges at DFW (Dallas-Fort Worth), DEN (Denver), IAD (Washington Dulles), and DCA (Ronald Reagan Washington National)
- PRIMARY CARDHOLDER: Complimentary lounge access to both Capital One Lounges/Landings and Priority Pass lounges
- AUTHORIZED USERS / ADDITIONAL CARDHOLDERS: Authorized users receive their own Priority Pass membership with no guest access privileges. Authorized users also have access to Capital One Lounges and Landings.
- PRIORITY PASS GUEST POLICY (Updated February 1, 2026): Primary cardholders can NO LONGER bring complimentary guests to Priority Pass lounges. Guest access at Priority Pass lounges now costs $35 per guest per visit. This is a change from the previous policy that allowed 2 complimentary guests. Authorized users have their own Priority Pass membership but cannot bring guests.
- CAPITAL ONE LOUNGE GUEST POLICY: Primary cardholders can bring up to 2 complimentary guests. Additional guests cost $45/visit (ages 18+), $25/visit (ages 2-17), free under 2. NOTE: This is different from Priority Pass lounges — Capital One's own lounges still allow 2 complimentary guests for the primary cardholder.
- Capital One Lounge amenities: hot meals, craft cocktails and premium beverages, shower suites, relaxation rooms, nursing/mother's rooms, high-speed Wi-Fi, and premium workspaces

CELL PHONE PROTECTION:
- Up to $800 per claim for cell phone damage or theft (subject to a $25 deductible)
- Up to 2 claims allowed per 12-month period
- Must pay your monthly cell phone bill with the Venture X card to be eligible
- Covers the primary account holder and any lines listed on the monthly bill

GLOBAL ENTRY / TSA PRECHECK CREDIT:
- Up to $120 statement credit every 4 years for Global Entry ($120) or TSA PreCheck (~$78) application fees
- Also covers NEXUS ($50) enrollment fees
- Statement credit applied automatically when the fee is charged to the card

OTHER KEY BENEFITS:
- No foreign transaction fees on any purchases made outside the United States
- Up to 4 authorized users at no additional annual fee — authorized users earn the same miles rates (2X/5X/10X) and receive their own Priority Pass membership (no guest access)
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
      source_tier: 0,
    },
  },

  // ============================================
  // FOCUSED CHUNK DOCUMENTS
  // Targeted ~200-word docs for high-similarity matching
  // on common questions about specific card features
  // ============================================

  {
    id: 'capitalone-chunk-annual-fee',
    source: 'capitalone',
    title: 'Capital One Venture X Annual Fee',
    content: `The Capital One Venture X Rewards Credit Card has an annual fee of $395. While this is a premium annual fee, the card provides significant value that can more than offset the cost. The effective annual fee after credits is only $95 (or even negative) when you factor in the $300 annual travel credit and the 10,000 anniversary bonus miles (worth ~$100 at 1 cent per point). This means the card effectively pays for itself. The $395 annual fee is charged on each account anniversary date. There is no introductory fee waiver — the full $395 is charged in the first year. However, you do receive the $300 travel credit and anniversary bonus starting from year one. Compared to competing premium travel cards like the Chase Sapphire Reserve ($550) or Amex Platinum ($695), the Venture X offers a lower annual fee with competitive benefits.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'annual-fee',
    },
  },
  {
    id: 'capitalone-chunk-travel-credit',
    source: 'capitalone',
    title: 'Capital One Venture X $300 Travel Credit',
    content: `The Capital One Venture X card provides a $300 annual travel credit that is automatically applied to bookings made through Capital One Travel (travel.capitalone.com). This credit resets each cardmember year (based on your account open date, not the calendar year). Key details: The $300 credit applies to flights, hotels, and rental cars booked through Capital One Travel. It is applied automatically — no enrollment or activation needed. There is no minimum purchase required. The credit can be used across multiple bookings until the $300 is exhausted. If your booking costs less than $300, the remaining balance rolls over for future Capital One Travel purchases within the same cardmember year. IMPORTANT: Per Capital One terms, rewards will NOT be earned on the portion of a purchase covered by the travel credit. For example, on a $500 flight booked through C1 Travel, the $300 credit applies, and you earn 5X miles only on the remaining $200 ($1,000 miles, not $2,500). The credit does NOT apply to purchases made directly with airlines or hotels.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'travel-credit',
    },
  },
  {
    id: 'capitalone-chunk-global-entry-tsa',
    source: 'capitalone',
    title: 'Capital One Venture X Global Entry / TSA PreCheck Credit',
    content: `The Capital One Venture X card provides a statement credit of up to $120 every 4 years for Global Entry or TSA PreCheck application fees. Global Entry costs $120 and includes TSA PreCheck. TSA PreCheck alone costs approximately $78. The credit also covers NEXUS enrollment ($50). To use this benefit, simply pay the Global Entry, TSA PreCheck, or NEXUS application fee with your Venture X card. The statement credit is applied automatically within 1-2 billing cycles — no need to call or enroll separately. The 4-year cycle resets after you receive the credit, so you can use it again when your membership is up for renewal. Global Entry provides expedited clearance for pre-approved, low-risk travelers upon arrival in the United States and includes TSA PreCheck for domestic flights. This benefit applies to the primary cardholder only; authorized users would need to pay with the primary card and would use the same $120 credit.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'global-entry-tsa-precheck',
    },
  },
  {
    id: 'capitalone-chunk-anniversary-bonus',
    source: 'capitalone',
    title: 'Capital One Venture X Anniversary Bonus Miles',
    content: `The Capital One Venture X card awards 10,000 bonus miles on each account anniversary. This anniversary bonus is automatic — you receive it simply by keeping the card open. At a minimum redemption value of 1 cent per mile (via Travel Eraser), these 10,000 miles are worth at least $100. When transferred to airline partners at optimal rates, they can be worth $150-$200 or more. The anniversary bonus posts to your account shortly after your account anniversary date (the date you originally opened the card). Combined with the $300 annual travel credit, the anniversary bonus effectively reduces the net annual fee from $395 to approximately $0 or even negative. Year 1 note: You DO receive the 10,000 anniversary bonus after your first year. The annual fee ($395) is charged on the anniversary date, but the 10,000 miles and $300 credit offset most of it.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'anniversary-bonus',
    },
  },
  {
    id: 'capitalone-chunk-foreign-transaction-fees',
    source: 'capitalone',
    title: 'Capital One Venture X Foreign Transaction Fees',
    content: `The Capital One Venture X card charges NO foreign transaction fees on any purchases made outside the United States or in a foreign currency. This makes it an excellent card for international travel. Whether you're purchasing items online from foreign merchants, paying at restaurants in Europe, or booking hotels in Asia, you will not incur any additional fees beyond the purchase amount. Many competing cards charge 2-3% foreign transaction fees, which can add up quickly on international trips. Capital One has a long-standing policy of not charging foreign transaction fees across most of their card products, and the Venture X is no exception. The card uses the Visa Infinite network, which provides excellent international acceptance. Additionally, you'll earn 2X miles on all international purchases (or 5X/10X if booked through Capital One Travel for flights/hotels respectively). There is no need to notify Capital One before traveling internationally — the card works globally without travel alerts.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'foreign-transaction-fees',
    },
  },
  {
    id: 'capitalone-chunk-lounge-access',
    source: 'capitalone',
    title: 'Capital One Venture X Lounge Access and Priority Pass',
    content: `The Capital One Venture X card provides premium airport lounge access through multiple programs. IMPORTANT: The rules for Priority Pass lounges and Capital One's own lounges are DIFFERENT — read carefully. PRIORITY PASS SELECT (updated February 1, 2026): Complimentary Priority Pass Select membership (enrollment required) with access to 1,300+ airport lounges worldwide. As of February 1, 2026, primary cardholders can NO LONGER bring complimentary guests to Priority Pass lounges. Guest access at Priority Pass lounges now costs $35 per guest per visit. This is a change from the previous policy that allowed 2 complimentary guests. CAPITAL ONE LOUNGES AND LANDINGS (separate from Priority Pass): Exclusive access to Capital One's own premium airport lounges at DFW (Dallas-Fort Worth), DEN (Denver), IAD (Washington Dulles), and DCA (Ronald Reagan Washington National). Capital One Lounges feature hot meals, craft cocktails and premium beverages, shower suites, relaxation rooms, nursing/mother's rooms, high-speed Wi-Fi, and premium workspaces. At Capital One's own lounges, primary cardholders can bring up to 2 complimentary guests. Additional guests cost $45/visit (ages 18+) and $25/visit (ages 2-17); children under 2 are free. AUTHORIZED USER LOUNGE ACCESS: Authorized users receive their own Priority Pass membership with no guest access privileges. To access lounges, present your physical Venture X card or digital lounge pass via the Capital One Mobile app.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'lounge-access',
    },
  },
  {
    id: 'capitalone-chunk-authorized-users',
    source: 'capitalone',
    title: 'Capital One Venture X Authorized Users',
    content: `The Capital One Venture X card allows you to add up to 4 authorized users at no additional annual fee for the card itself. Key details about authorized users: There is NO additional annual fee for adding authorized users to the Venture X card. You can add up to 4 authorized users on a Venture X account. Authorized users get their own physical card with their name on it. Authorized users earn miles on their purchases at the same rates as the primary cardholder: 2X miles on every purchase, 5X miles on flights and vacation rentals booked through Capital One Travel, and 10X miles on hotels and rental cars booked through Capital One Travel. All miles earned by authorized users accumulate in the primary cardholder's account. LOUNGE ACCESS (as of February 1, 2026): Authorized users receive their own Priority Pass Select membership, giving them personal access to 1,300+ Priority Pass lounges worldwide. However, authorized users CANNOT bring guests to Priority Pass lounges. Authorized users also have access to Capital One Lounges and Landings. IMPORTANT: The primary cardholder's Priority Pass guest policy also changed — as of February 2026, primary cardholders can no longer bring complimentary guests to Priority Pass lounges either; guest access costs $35 per guest per visit at Priority Pass locations.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'authorized-users',
    },
  },
  {
    id: 'capitalone-chunk-earn-rates',
    source: 'capitalone',
    title: 'Capital One Venture X Earning Rates and Miles Multipliers',
    content: `The Capital One Venture X card earns Capital One miles at the following rates: 10X MILES on hotels booked through Capital One Travel — this is one of the highest hotel earning rates of any credit card. 10X MILES on rental cars booked through Capital One Travel. 5X MILES on flights booked through Capital One Travel. 5X MILES on vacation rentals booked through Capital One Travel. 2X MILES on every other purchase, every day — this flat 2X rate applies to all non-bonus categories including groceries, dining, gas, utilities, and everything else. There are no rotating categories and no spending caps on any earning tier. IMPORTANT: The $300 travel credit portion of a Capital One Travel booking does NOT earn miles. Per Capital One's terms: "Rewards will not be earned on the Credit." So on a $500 hotel booking through Capital One Travel, you earn 10X on $200 (the amount after the credit), not on $500. Miles are posted to your account after each statement cycle. Capital One miles do not expire as long as your account remains open and in good standing. You can also earn miles through transfer partner bonuses and referral bonuses.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'earn-rates',
    },
  },
  {
    id: 'capitalone-chunk-sign-on-bonus',
    source: 'capitalone',
    title: 'Capital One Venture X Sign-On Bonus / Welcome Bonus Offer',
    content: `The Capital One Venture X Rewards Credit Card currently offers a sign-on bonus (also called a welcome bonus) of 75,000 bonus miles after you spend $4,000 on purchases within the first 3 months of account opening. This is a publicly listed offer on the Capital One website. At a minimum value of 1 cent per mile (via Travel Eraser), 75,000 miles are worth at least $750 in travel. When transferred to airline partners at optimal rates (1.5–2+ cents per mile), the sign-on bonus can be worth $1,125 to $1,500 or more. To earn the bonus: (1) Apply and be approved for the Venture X card. (2) Spend $4,000 on purchases within the first 3 months from account opening. (3) The 75,000 bonus miles will be credited to your account after meeting the minimum spend requirement. The $4,000 spend requirement includes all purchases but does NOT include balance transfers, cash advances, or fees. The $300 annual travel credit can help offset some of the spend. Note: The welcome bonus offer is subject to change — always verify the current offer on the Capital One website before applying.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'sign-on-bonus',
    },
  },
  {
    id: 'capitalone-chunk-travel-protections',
    source: 'capitalone',
    title: 'Capital One Venture X Travel Protections and Insurance Benefits',
    content: `The Capital One Venture X card includes the following confirmed travel protections and insurance benefits. Trip Cancellation/Interruption Insurance: covers up to $5,000 per trip and $10,000 per year per covered person for prepaid, non-refundable travel expenses if your trip is cancelled or interrupted for a covered reason. Travel Accident Insurance: provides up to $250,000 in coverage for accidental death or dismemberment while traveling on a common carrier (airline, train, bus, cruise ship) when the fare is charged to the Venture X card. IMPORTANT: This is NOT travel medical insurance — the Venture X does NOT include primary travel medical insurance for illness or injury while traveling abroad. Lost Luggage Reimbursement: up to $3,000 per passenger for checked or carry-on luggage lost by the carrier. Baggage Delay Insurance: up to $500 for essential purchases after luggage is delayed 6+ hours. Trip Delay Reimbursement: up to $500 per ticket for meals, lodging, and essentials after a 6+ hour delay. Travel and Emergency Assistance Services: 24/7 hotline for emergency assistance including medical referrals, legal referrals, emergency transportation, and translation services. Auto Rental Collision Damage Waiver (CDW): primary coverage for theft and collision damage on eligible rental vehicles when you decline the rental company's CDW. Extended Warranty Protection: extends manufacturer's warranty by up to 1 year. Purchase Security: covers new purchases against damage or theft for 120 days. Cell Phone Protection: up to $800 per claim ($25 deductible, max 2 claims/year) when you pay your monthly cell phone bill with the Venture X card.`,
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    scrapedAt: new Date().toISOString(),
    createdAt: '2026-02-17',
    metadata: {
      type: 'official-static',
      domain: 'capitalone.com',
      source_tier: 0,
      topic: 'travel-protections',
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

// ============================================
// PLAYWRIGHT-SCRAPED CONTENT INTEGRATION
// Merges pre-scraped Playwright data with static content
// Generated by: scripts/playwright-capitalone-scraper.cjs
// ============================================

/**
 * StaticDocument type alias for clarity
 * (matches ScrapedDocument from reddit.ts)
 */
type StaticDocument = ScrapedDocument;

/**
 * Load Playwright-scraped content if available, merge with static content.
 *
 * The Playwright scraper (scripts/playwright-capitalone-scraper.cjs) generates
 * a JSON file at data/capitalone-scraped.json with fully-rendered page content.
 * This function loads that data and merges it with the curated static content.
 *
 * Static content takes precedence (manually curated and verified).
 * Scraped content fills gaps with additional detail from the live pages.
 */
export async function getCapitalOneContentWithPlaywright(): Promise<StaticDocument[]> {
  const staticContent = getCapitalOneContent();

  try {
    // Try to load Playwright-scraped data (generated by scripts/playwright-capitalone-scraper.cjs)
    // In extension context, use chrome.runtime.getURL to access bundled data files
    const dataUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL('data/capitalone-scraped.json')
      : null;

    if (!dataUrl) {
      // Not in extension context — return static only
      return staticContent;
    }

    const response = await fetch(dataUrl);
    if (response.ok) {
      const scrapedContent: StaticDocument[] = await response.json();

      // Merge: static content takes precedence (manually curated), scraped content fills gaps
      const resolvedStatic = await staticContent;
      const staticIds = new Set(resolvedStatic.map(d => d.id));
      const newContent = scrapedContent.filter((d: StaticDocument) => !staticIds.has(d.id));

      console.log(
        `[CapitalOne] Merged ${resolvedStatic.length} static + ${newContent.length} scraped documents`
      );

      return [...resolvedStatic, ...newContent];
    }
  } catch {
    // Scraped data not available, fall back to static only
    // This is expected if the Playwright scraper hasn't been run yet
  }

  return staticContent;
}
