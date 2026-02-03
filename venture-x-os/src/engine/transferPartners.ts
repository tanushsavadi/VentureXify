// ============================================
// CAPITAL ONE TRANSFER PARTNERS DATA
// Version: 2024.01
// Source: https://www.capitalone.com/credit-cards/benefits/transfer-miles/
// ============================================

export interface TransferPartner {
  id: string;
  name: string;
  type: 'airline' | 'hotel';
  alliance?: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'None';
  ratio: {
    from: number; // Capital One miles
    to: number;   // Partner miles/points
  };
  transferTime: string; // typical transfer time
  regions: string[];    // regions where useful
  notes?: string;
}

// All Capital One transfer partners with current ratios
export const TRANSFER_PARTNERS: TransferPartner[] = [
  // ============================================
  // AIRLINE PARTNERS (1:1 ratio)
  // ============================================
  {
    id: 'aeroplan',
    name: 'Air Canada Aeroplan',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['North America', 'Europe', 'Asia'],
    notes: 'Great for Star Alliance awards, especially to Canada and transatlantic',
  },
  {
    id: 'aeromexico',
    name: 'Aeromexico Rewards',
    type: 'airline',
    alliance: 'SkyTeam',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Mexico', 'Latin America'],
    notes: 'Good for flights to Mexico and Central America',
  },
  {
    id: 'flyingblue',
    name: 'Air France-KLM Flying Blue',
    type: 'airline',
    alliance: 'SkyTeam',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Europe', 'Africa'],
    notes: 'Monthly promo rewards; good for transatlantic flights',
  },
  {
    id: 'lifemiles',
    name: 'Avianca LifeMiles',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 48 hours',
    regions: ['Latin America', 'Europe'],
    notes: 'Often has cheap Star Alliance business class awards; no fuel surcharges',
  },
  {
    id: 'avios',
    name: 'British Airways Executive Club',
    type: 'airline',
    alliance: 'Oneworld',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Europe', 'North America'],
    notes: 'Best for short-haul flights; distance-based pricing',
  },
  {
    id: 'cathay',
    name: 'Cathay',
    type: 'airline',
    alliance: 'Oneworld',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 48 hours',
    regions: ['Asia', 'Pacific'],
    notes: 'Great for premium cabin flights to/from Asia',
  },
  {
    id: 'connectmiles',
    name: 'Copa ConnectMiles',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Latin America', 'Central America'],
    notes: 'Hub in Panama; good for Latin America connections',
  },
  {
    id: 'emirates',
    name: 'Emirates Skywards',
    type: 'airline',
    alliance: 'None',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Middle East', 'Europe', 'Asia', 'Africa'],
    notes: 'Great for Emirates first/business class; no alliances',
  },
  {
    id: 'finnair',
    name: 'Finnair Plus',
    type: 'airline',
    alliance: 'Oneworld',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Europe', 'Asia'],
    notes: 'Good routing via Helsinki to Asia',
  },
  {
    id: 'trueblue',
    name: 'JetBlue TrueBlue',
    type: 'airline',
    alliance: 'None',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant',
    regions: ['North America', 'Caribbean'],
    notes: 'Good for domestic US and Caribbean; no blackout dates',
  },
  {
    id: 'qantas',
    name: 'Qantas Frequent Flyer',
    type: 'airline',
    alliance: 'Oneworld',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 48 hours',
    regions: ['Australia', 'Pacific', 'Asia'],
    notes: 'Great for flights to/from Australia',
  },
  {
    id: 'qatar',
    name: 'Qatar Airways Privilege Club',
    type: 'airline',
    alliance: 'Oneworld',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Middle East', 'Europe', 'Asia', 'Africa'],
    notes: 'Qatar QSuites business class is exceptional value',
  },
  {
    id: 'krisflyer',
    name: 'Singapore KrisFlyer',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 48 hours',
    regions: ['Asia', 'Pacific', 'Australia'],
    notes: 'Singapore Suites and business class are aspirational awards',
  },
  {
    id: 'tapmilesgo',
    name: 'TAP Miles&Go',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Europe', 'Africa', 'South America'],
    notes: 'Good for Portugal and transatlantic to South America',
  },
  {
    id: 'turkish',
    name: 'Turkish Airlines Miles&Smiles',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Europe', 'Middle East', 'Africa', 'Asia'],
    notes: 'AMAZING for Star Alliance business/first class; low fuel surcharges',
  },
  {
    id: 'virginred',
    name: 'Virgin Red',
    type: 'airline',
    alliance: 'None',
    ratio: { from: 1, to: 1 },
    transferTime: 'Instant to 24 hours',
    regions: ['Europe', 'Caribbean', 'North America'],
    notes: 'Virgin Atlantic Upper Class is great value',
  },

  // ============================================
  // AIRLINE PARTNERS (NOT 1:1 ratio)
  // ============================================
  {
    id: 'evaair',
    name: 'EVA Air Infinity MileageLands',
    type: 'airline',
    alliance: 'Star Alliance',
    ratio: { from: 2, to: 1.5 }, // 2:1.5 means you get 1.5 EVA miles per 2 C1 miles
    transferTime: '1-2 business days',
    regions: ['Asia', 'Taiwan'],
    notes: '2:1.5 ratio (0.75x); only use if no better options',
  },

  // ============================================
  // HOTEL PARTNERS
  // ============================================
  {
    id: 'accor',
    name: 'Accor Live Limitless',
    type: 'hotel',
    ratio: { from: 2, to: 1 }, // 2:1 means you get 1 Accor point per 2 C1 miles
    transferTime: '1-2 business days',
    regions: ['Global'],
    notes: '2:1 ratio; generally poor value vs airline transfers',
  },
  {
    id: 'iprefer',
    name: 'I Prefer Hotel Rewards',
    type: 'hotel',
    ratio: { from: 1, to: 2 }, // 1:2 means you get 2 I Prefer points per 1 C1 mile
    transferTime: '1-2 business days',
    regions: ['Global'],
    notes: '1:2 ratio; covers Preferred Hotels',
  },
  {
    id: 'choice',
    name: 'Choice Privileges',
    type: 'hotel',
    ratio: { from: 1, to: 1 },
    transferTime: '1-2 business days',
    regions: ['North America', 'Global'],
    notes: 'Budget hotels; 1:1 ratio',
  },
  {
    id: 'wyndham',
    name: 'Wyndham Rewards',
    type: 'hotel',
    ratio: { from: 1, to: 1 },
    transferTime: '1-2 business days',
    regions: ['North America', 'Global'],
    notes: 'Budget/midscale hotels; 1:1 ratio',
  },
];

// Helper functions
export function getPartnerById(id: string): TransferPartner | undefined {
  return TRANSFER_PARTNERS.find(p => p.id === id);
}

export function getAirlinePartners(): TransferPartner[] {
  return TRANSFER_PARTNERS.filter(p => p.type === 'airline');
}

export function getHotelPartners(): TransferPartner[] {
  return TRANSFER_PARTNERS.filter(p => p.type === 'hotel');
}

export function getPartnersByAlliance(alliance: string): TransferPartner[] {
  return TRANSFER_PARTNERS.filter(p => p.alliance === alliance);
}

export function getPartnersByRegion(region: string): TransferPartner[] {
  return TRANSFER_PARTNERS.filter(p => p.regions.includes(region));
}

// Calculate effective transfer ratio
export function calculateTransferRatio(partner: TransferPartner): number {
  return partner.ratio.to / partner.ratio.from;
}

// Calculate how many partner miles you get from Capital One miles
export function calculatePartnerMiles(c1Miles: number, partner: TransferPartner): number {
  return Math.floor((c1Miles / partner.ratio.from) * partner.ratio.to);
}

// Calculate how many Capital One miles needed for target partner miles
export function calculateRequiredC1Miles(targetPartnerMiles: number, partner: TransferPartner): number {
  return Math.ceil((targetPartnerMiles / partner.ratio.to) * partner.ratio.from);
}

// Best partners for premium cabin awards (sorted by typical value)
export const PREMIUM_CABIN_PARTNERS = [
  'turkish',    // Often best cpp for Star Alliance business/first
  'lifemiles',  // No fuel surcharges on Star Alliance
  'aeroplan',   // Great for transatlantic business
  'emirates',   // Emirates first class
  'qatar',      // QSuites business
  'cathay',     // CX business to Asia
  'krisflyer',  // Singapore Suites
  'virginred',  // Virgin Upper Class
];

// ============================================
// DOMESTIC AIRLINE ALLIANCE MAPPING
// Maps US domestic airlines to alliance partners for award bookings
// Source: Research on booking domestic flights via transfer partners
// ============================================

export interface AlliancePartnerMapping {
  /** The airline operating the flight (e.g., "United") */
  operatingAirline: string;
  /** IATA code for the operating airline */
  iataCode: string;
  /** Alliance membership */
  alliance: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'None';
  /** Capital One transfer partners that can book this airline */
  bookableVia: Array<{
    partnerId: string;
    partnerName: string;
    /** Typical CPM range for this route combination */
    typicalCpmRange: { min: number; max: number };
    /** Best for these route types */
    bestFor: string[];
    /** Known quirks or issues */
    notes?: string;
  }>;
  /** If not in an alliance, any special partnerships */
  specialPartnerships?: string[];
}

/**
 * Comprehensive mapping of US domestic airlines to Capital One transfer partners
 * This enables the "book Airline X via Program Y" optimization
 */
export const DOMESTIC_AIRLINE_MAPPING: AlliancePartnerMapping[] = [
  // ============================================
  // STAR ALLIANCE AIRLINES
  // ============================================
  {
    operatingAirline: 'United Airlines',
    iataCode: 'UA',
    alliance: 'Star Alliance',
    bookableVia: [
      {
        partnerId: 'aeroplan',
        partnerName: 'Air Canada Aeroplan',
        typicalCpmRange: { min: 0.012, max: 0.025 },
        bestFor: ['Domestic US', 'Transatlantic', 'Complex itineraries'],
        notes: 'Allows stopovers; great for multi-city trips',
      },
      {
        partnerId: 'lifemiles',
        partnerName: 'Avianca LifeMiles',
        typicalCpmRange: { min: 0.013, max: 0.028 },
        bestFor: ['Star Alliance business/first', 'One-way awards'],
        notes: 'No fuel surcharges; website can be quirky',
      },
      {
        partnerId: 'turkish',
        partnerName: 'Turkish Miles&Smiles',
        typicalCpmRange: { min: 0.015, max: 0.04 },
        bestFor: ['Short domestic hops', 'Premium cabins'],
        notes: 'Distance-based; historically cheap US domestic awards',
      },
      {
        partnerId: 'krisflyer',
        partnerName: 'Singapore KrisFlyer',
        typicalCpmRange: { min: 0.012, max: 0.022 },
        bestFor: ['United premium cabins'],
        notes: 'Good for United Polaris',
      },
      {
        partnerId: 'connectmiles',
        partnerName: 'Copa ConnectMiles',
        typicalCpmRange: { min: 0.01, max: 0.018 },
        bestFor: ['Latin America connections'],
      },
      {
        partnerId: 'tapmilesgo',
        partnerName: 'TAP Miles&Go',
        typicalCpmRange: { min: 0.011, max: 0.02 },
        bestFor: ['Star Alliance economy'],
      },
    ],
  },
  
  // ============================================
  // ONEWORLD AIRLINES
  // ============================================
  {
    operatingAirline: 'American Airlines',
    iataCode: 'AA',
    alliance: 'Oneworld',
    bookableVia: [
      {
        partnerId: 'avios',
        partnerName: 'British Airways Executive Club',
        typicalCpmRange: { min: 0.012, max: 0.025 },
        bestFor: ['Short-haul flights', 'Off-peak routes'],
        notes: 'Distance-based pricing; can have high fees on BA metal',
      },
      {
        partnerId: 'qatar',
        partnerName: 'Qatar Airways Privilege Club',
        typicalCpmRange: { min: 0.013, max: 0.03 },
        bestFor: ['AA business/first class'],
        notes: 'QR website can be challenging for AA bookings',
      },
      {
        partnerId: 'cathay',
        partnerName: 'Cathay',
        typicalCpmRange: { min: 0.012, max: 0.022 },
        bestFor: ['Oneworld awards to Asia'],
      },
      {
        partnerId: 'finnair',
        partnerName: 'Finnair Plus',
        typicalCpmRange: { min: 0.011, max: 0.02 },
        bestFor: ['Oneworld economy'],
      },
      {
        partnerId: 'qantas',
        partnerName: 'Qantas Frequent Flyer',
        typicalCpmRange: { min: 0.01, max: 0.02 },
        bestFor: ['AA to Australia routes'],
      },
    ],
  },
  {
    operatingAirline: 'Alaska Airlines',
    iataCode: 'AS',
    alliance: 'Oneworld', // Joined Oneworld in 2021
    bookableVia: [
      {
        partnerId: 'avios',
        partnerName: 'British Airways Executive Club',
        typicalCpmRange: { min: 0.012, max: 0.022 },
        bestFor: ['West Coast routes', 'Short hops'],
        notes: 'Distance-based; Alaska joined Oneworld in 2021',
      },
      {
        partnerId: 'cathay',
        partnerName: 'Cathay',
        typicalCpmRange: { min: 0.011, max: 0.02 },
        bestFor: ['Alaska premium cabins'],
      },
      {
        partnerId: 'qatar',
        partnerName: 'Qatar Airways Privilege Club',
        typicalCpmRange: { min: 0.012, max: 0.025 },
        bestFor: ['Alaska first class'],
      },
    ],
  },
  
  // ============================================
  // SKYTEAM AIRLINES
  // ============================================
  {
    operatingAirline: 'Delta Air Lines',
    iataCode: 'DL',
    alliance: 'SkyTeam',
    bookableVia: [
      {
        partnerId: 'flyingblue',
        partnerName: 'Air France-KLM Flying Blue',
        typicalCpmRange: { min: 0.012, max: 0.028 },
        bestFor: ['Delta domestic', 'Promo Rewards months'],
        notes: 'Monthly Promo Rewards can offer great value; dynamic pricing',
      },
      {
        partnerId: 'virginred',
        partnerName: 'Virgin Red',
        typicalCpmRange: { min: 0.012, max: 0.025 },
        bestFor: ['Delta premium cabins', 'Transatlantic'],
        notes: 'Can book Delta via Virgin Atlantic partnership',
      },
      {
        partnerId: 'aeromexico',
        partnerName: 'Aeromexico Rewards',
        typicalCpmRange: { min: 0.01, max: 0.018 },
        bestFor: ['US to Mexico', 'Latin America'],
      },
    ],
  },
  
  // ============================================
  // NON-ALLIANCE AIRLINES (with transfer partner options)
  // ============================================
  {
    operatingAirline: 'JetBlue Airways',
    iataCode: 'B6',
    alliance: 'None',
    bookableVia: [
      {
        partnerId: 'trueblue',
        partnerName: 'JetBlue TrueBlue',
        typicalCpmRange: { min: 0.012, max: 0.02 },
        bestFor: ['JetBlue routes', 'Caribbean', 'Mint class'],
        notes: 'Direct transfer partner - best for JetBlue flights',
      },
      {
        partnerId: 'emirates',
        partnerName: 'Emirates Skywards',
        typicalCpmRange: { min: 0.01, max: 0.018 },
        bestFor: ['JetBlue Mint'],
        notes: 'JetBlue-Emirates partnership; limited availability',
      },
    ],
    specialPartnerships: ['Emirates (codeshare)', 'American Airlines (Northeast Alliance)'],
  },
  {
    operatingAirline: 'Southwest Airlines',
    iataCode: 'WN',
    alliance: 'None',
    bookableVia: [],
    specialPartnerships: [],
    // Note: Southwest Rapid Rewards is NOT a Capital One transfer partner
  },
  {
    operatingAirline: 'Spirit Airlines',
    iataCode: 'NK',
    alliance: 'None',
    bookableVia: [],
    specialPartnerships: [],
  },
  {
    operatingAirline: 'Frontier Airlines',
    iataCode: 'F9',
    alliance: 'None',
    bookableVia: [],
    specialPartnerships: [],
  },
  {
    operatingAirline: 'Hawaiian Airlines',
    iataCode: 'HA',
    alliance: 'None', // Joining Oneworld in 2026 after Alaska merger
    bookableVia: [],
    specialPartnerships: ['Alaska Airlines (merger pending)'],
    // Note: Expected to join Oneworld in 2026
  },
];

// ============================================
// HELPER FUNCTIONS FOR ALLIANCE MAPPING
// ============================================

/**
 * Get transfer partner options for a given airline
 */
export function getPartnerOptionsForAirline(airlineNameOrCode: string): AlliancePartnerMapping | undefined {
  const normalized = airlineNameOrCode.toLowerCase().trim();
  
  return DOMESTIC_AIRLINE_MAPPING.find(
    mapping =>
      mapping.operatingAirline.toLowerCase().includes(normalized) ||
      mapping.iataCode.toLowerCase() === normalized
  );
}

/**
 * Get all airlines bookable via a specific partner
 */
export function getAirlinesBookableViaPartner(partnerId: string): string[] {
  return DOMESTIC_AIRLINE_MAPPING
    .filter(mapping => mapping.bookableVia.some(p => p.partnerId === partnerId))
    .map(mapping => mapping.operatingAirline);
}

/**
 * Get best partner recommendations for a specific airline
 * Sorted by typical CPM (higher = better value)
 */
export function getBestPartnersForAirline(
  airlineNameOrCode: string,
  cabin: 'economy' | 'premium_economy' | 'business' | 'first' = 'economy'
): Array<{
  partnerId: string;
  partnerName: string;
  typicalCpm: number;
  notes?: string;
}> {
  const mapping = getPartnerOptionsForAirline(airlineNameOrCode);
  if (!mapping) return [];
  
  return mapping.bookableVia
    .map(partner => ({
      partnerId: partner.partnerId,
      partnerName: partner.partnerName,
      typicalCpm: (partner.typicalCpmRange.min + partner.typicalCpmRange.max) / 2,
      notes: partner.notes,
    }))
    .sort((a, b) => b.typicalCpm - a.typicalCpm);
}

/**
 * Suggest transfer partners based on detected airline
 * Returns actionable suggestions for the UI
 */
export interface PartnerSuggestion {
  partnerId: string;
  partnerName: string;
  alliance?: string;
  rationale: string;
  searchUrl?: string;
  typicalValue: string;
  transferRatio: string;
}

export function suggestPartnersForRoute(
  operatingAirline: string,
  origin?: string,
  destination?: string,
  cabin: 'economy' | 'premium_economy' | 'business' | 'first' = 'economy'
): PartnerSuggestion[] {
  const mapping = getPartnerOptionsForAirline(operatingAirline);
  if (!mapping || mapping.bookableVia.length === 0) {
    return [{
      partnerId: 'none',
      partnerName: 'No transfer partners available',
      rationale: `${operatingAirline} is not bookable via Capital One transfer partners. Consider booking direct or using Travel Eraser.`,
      typicalValue: 'N/A',
      transferRatio: 'N/A',
    }];
  }
  
  return mapping.bookableVia.slice(0, 3).map(partner => {
    const transferPartner = getPartnerById(partner.partnerId);
    const ratio = transferPartner
      ? `${transferPartner.ratio.from}:${transferPartner.ratio.to}`
      : '1:1';
    
    return {
      partnerId: partner.partnerId,
      partnerName: partner.partnerName,
      alliance: mapping.alliance !== 'None' ? mapping.alliance : undefined,
      rationale: `${partner.bestFor.join(', ')}${partner.notes ? ` — ${partner.notes}` : ''}`,
      typicalValue: `${(partner.typicalCpmRange.min * 100).toFixed(1)}–${(partner.typicalCpmRange.max * 100).toFixed(1)}¢/mile`,
      transferRatio: ratio,
    };
  });
}

// ============================================
// DOUBLE-DIP TRAVEL ERASER LOGIC
// From research: Pay cash + earn miles, THEN erase later
// ============================================

export interface DoubleDipRecommendation {
  recommended: boolean;
  strategy: 'portal_then_erase' | 'direct_then_erase' | 'portal_pay_cash' | 'direct_pay_cash';
  explanation: string;
  breakdown: {
    payToday: number;
    milesEarned: number;
    milesValue: number;
    eraseLater: number;
    milesUsedForErase: number; // How many miles used for erasing
    effectiveCost: number;
    totalMilesAfterBooking?: number; // Current balance + earned
  };
}

/**
 * Calculate the "double-dip" recommendation
 * Instead of paying with miles in portal, pay cash → earn miles → erase later
 * This gives you both the miles AND the 1¢/mile redemption
 */
export function calculateDoubleDipRecommendation(
  portalPrice: number,
  directPrice: number,
  creditRemaining: number,
  milesBalance: number,
  mileValueCpp: number = 0.018 // User's mile valuation
): DoubleDipRecommendation {
  // Portal route
  const portalCreditApplied = Math.min(creditRemaining, portalPrice);
  const portalOutOfPocket = portalPrice - portalCreditApplied;
  const portalMilesEarned = Math.round(portalOutOfPocket * 5); // 5x on portal flights
  const portalMilesValue = portalMilesEarned * mileValueCpp;
  
  // CRITICAL FIX: Calculate eraser potential using TOTAL miles available
  // (current balance + miles earned from this booking)
  // Travel Eraser has NO MINIMUM - user can erase ANY amount at 1¢/mile
  const portalTotalMilesAfterBooking = milesBalance + portalMilesEarned;
  const portalMaxEraseAtOneCent = portalTotalMilesAfterBooking / 100; // At 1¢/mile
  // Can erase up to the out-of-pocket amount (no need to erase more than paid)
  const portalEraseAmount = Math.min(portalOutOfPocket, portalMaxEraseAtOneCent);
  const portalMilesUsedForErase = Math.round(portalEraseAmount * 100);
  // CRITICAL FIX: Track miles remaining AFTER erasing to avoid double-counting
  const portalMilesKeptAfterErase = Math.max(0, portalTotalMilesAfterBooking - portalMilesUsedForErase);
  const portalKeptMilesValue = portalMilesKeptAfterErase * mileValueCpp;
  
  // Direct route
  const directMilesEarned = Math.round(directPrice * 2); // 2x on direct
  const directMilesValue = directMilesEarned * mileValueCpp;
  
  // Same for direct: total miles after booking
  const directTotalMilesAfterBooking = milesBalance + directMilesEarned;
  const directMaxEraseAtOneCent = directTotalMilesAfterBooking / 100;
  const directEraseAmount = Math.min(directPrice, directMaxEraseAtOneCent);
  const directMilesUsedForErase = Math.round(directEraseAmount * 100);
  // CRITICAL FIX: Track miles remaining AFTER erasing to avoid double-counting
  const directMilesKeptAfterErase = Math.max(0, directTotalMilesAfterBooking - directMilesUsedForErase);
  const directKeptMilesValue = directMilesKeptAfterErase * mileValueCpp;
  
  // Calculate effective costs for each strategy
  // CRITICAL FIX: Miles value and Travel Eraser are MUTUALLY EXCLUSIVE
  // You can either KEEP miles (value them at cpp) OR USE them for eraser (get 1¢/mile)
  // You cannot do BOTH with the same miles!
  
  // Portal + Erase: Pay cash, earn 5x, erase later using total miles
  // Effective = cash paid - cash recovered - value of REMAINING miles after erase
  const portalThenEraseEffective = portalOutOfPocket - portalEraseAmount - portalKeptMilesValue;
  
  // Direct + Erase: Pay cash, earn 2x, erase later using total miles
  const directThenEraseEffective = directPrice - directEraseAmount - directKeptMilesValue;
  
  // Portal pay cash (no erase): Just pay and keep ALL miles
  const portalPayCashEffective = portalOutOfPocket - portalMilesValue;
  
  // Direct pay cash (no erase): Just pay and keep ALL miles
  const directPayCashEffective = directPrice - directMilesValue;
  
  // Since Travel Eraser has NO MINIMUM, we can always erase SOME amount
  // The question is whether we have enough miles to make a meaningful dent
  const portalCanErase = portalEraseAmount > 0;
  const directCanErase = directEraseAmount > 0;
  
  // Find best strategy
  const strategies = [
    { strategy: 'portal_then_erase' as const, effective: portalThenEraseEffective, canDo: portalCanErase },
    { strategy: 'direct_then_erase' as const, effective: directThenEraseEffective, canDo: directCanErase },
    { strategy: 'portal_pay_cash' as const, effective: portalPayCashEffective, canDo: true },
    { strategy: 'direct_pay_cash' as const, effective: directPayCashEffective, canDo: true },
  ].filter(s => s.canDo);
  
  const best = strategies.sort((a, b) => a.effective - b.effective)[0];
  
  // Build recommendation
  let explanation: string;
  let breakdown: DoubleDipRecommendation['breakdown'];
  
  if (best.strategy === 'portal_then_erase') {
    explanation = `Best value: Book portal ($${portalOutOfPocket.toFixed(0)}), earn ${portalMilesEarned.toLocaleString()} miles, then erase within 90 days. This "double-dips" by earning AND redeeming.`;
    breakdown = {
      payToday: portalOutOfPocket,
      milesEarned: portalMilesEarned,
      milesValue: portalMilesValue,
      eraseLater: portalEraseAmount,
      milesUsedForErase: portalMilesUsedForErase,
      effectiveCost: portalThenEraseEffective,
      totalMilesAfterBooking: portalTotalMilesAfterBooking,
    };
  } else if (best.strategy === 'direct_then_erase') {
    explanation = `Book direct ($${directPrice.toFixed(0)}), earn ${directMilesEarned.toLocaleString()} miles, then erase within 90 days.`;
    breakdown = {
      payToday: directPrice,
      milesEarned: directMilesEarned,
      milesValue: directMilesValue,
      eraseLater: directEraseAmount,
      milesUsedForErase: directMilesUsedForErase,
      effectiveCost: directThenEraseEffective,
      totalMilesAfterBooking: directTotalMilesAfterBooking,
    };
  } else if (best.strategy === 'portal_pay_cash') {
    explanation = `Book portal ($${portalOutOfPocket.toFixed(0)}) and earn ${portalMilesEarned.toLocaleString()} miles at 5x rate.`;
    breakdown = {
      payToday: portalOutOfPocket,
      milesEarned: portalMilesEarned,
      milesValue: portalMilesValue,
      eraseLater: 0,
      milesUsedForErase: 0,
      effectiveCost: portalPayCashEffective,
      totalMilesAfterBooking: portalTotalMilesAfterBooking,
    };
  } else {
    explanation = `Book direct ($${directPrice.toFixed(0)}) and earn ${directMilesEarned.toLocaleString()} miles at 2x rate.`;
    breakdown = {
      payToday: directPrice,
      milesEarned: directMilesEarned,
      milesValue: directMilesValue,
      eraseLater: 0,
      milesUsedForErase: 0,
      effectiveCost: directPayCashEffective,
      totalMilesAfterBooking: directTotalMilesAfterBooking,
    };
  }
  
  // Recommend double-dip if it provides meaningful savings
  const recommended = best.strategy.includes('erase') &&
    (best.strategy === 'portal_then_erase' ? portalEraseAmount : directEraseAmount) > 50;
  
  return {
    recommended,
    strategy: best.strategy,
    explanation,
    breakdown,
  };
}
