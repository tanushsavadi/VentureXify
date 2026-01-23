/**
 * PointsYeah Integration Service
 * 
 * Handles:
 * - Deep link URL building for PointsYeah flight search
 * - Award option types and implied CPP calculation
 * - Message passing for result parsing (optional import)
 */

// ============================================
// TYPES
// ============================================

export interface AwardSearchParams {
  departure: string;      // IATA code (e.g., "AUH")
  arrival: string;        // IATA code (e.g., "DEL")
  departDate: string;     // YYYY-MM-DD
  returnDate?: string;    // YYYY-MM-DD (optional for one-way)
  adults?: number;        // Default 1
  children?: number;      // Default 0
  cabin?: 'economy' | 'premium' | 'business' | 'first' | '';  // Empty = all
  tripType?: 1 | 2;       // 1 = one-way, 2 = round-trip
}

export interface AwardOption {
  program: string;        // e.g., "Air Canada Aeroplan"
  programCode?: string;   // e.g., "AC"
  miles: number;          // Miles required
  feesCash: number;       // Taxes and fees in USD
  cabin: string;          // e.g., "Business"
  link?: string;          // Booking/details link
  impliedCpp?: number;    // Calculated: ((cashPrice - feesCash) / miles) * 100
}

export interface PointsYeahParseResult {
  success: boolean;
  options: AwardOption[];
  error?: string;
}

// ============================================
// CONSTANTS - Known PointsYeah URL params
// ============================================

// Capital One transfer partners (airline programs)
const CAPITAL_ONE_PARTNERS = [
  'AR', // Aeromexico
  'AC', // Air Canada Aeroplan
  'AV', // Avianca LifeMiles
  'BA', // British Airways (via TAP)
  'EK', // Emirates Skywards
  'EY', // Etihad Guest
  'AY', // Finnair Plus
  'B6', // JetBlue TrueBlue
  'QF', // Qantas Frequent Flyer
  'SQ', // Singapore KrisFlyer
  'TK', // Turkish Miles&Smiles
  'VS', // Virgin Atlantic Flying Club
  'VA', // Virgin Australia Velocity
];

// All airline programs for broader search
const ALL_AIRLINE_PROGRAMS = [
  'AR', 'AM', 'AC', 'KL', 'AS', 'AA', 'AV', 'DL', 'EK', 'EY',
  'AY', 'B6', 'LH', 'QF', 'SK', 'SQ', 'NK', 'TK', 'UA', 'VS', 'VA',
];

// ============================================
// URL BUILDER
// ============================================

/**
 * Build a PointsYeah deep link URL for award flight search
 * 
 * @param params - Search parameters from itinerary
 * @param options - Additional options
 * @returns Full PointsYeah search URL
 */
export function buildPointsYeahUrl(
  params: AwardSearchParams,
  options: {
    capitalOneOnly?: boolean;  // Filter to Capital One partners only
  } = {}
): string {
  const baseUrl = 'https://www.pointsyeah.com/search';
  
  // Determine trip type
  const tripType = params.returnDate ? 2 : (params.tripType || 1);
  
  // Build airline programs filter
  const programs = options.capitalOneOnly 
    ? CAPITAL_ONE_PARTNERS 
    : ALL_AIRLINE_PROGRAMS;
  
  // Build query params
  const queryParams = new URLSearchParams({
    departure: params.departure.toUpperCase(),
    arrival: params.arrival.toUpperCase(),
    departDate: params.departDate,
    departDateSec: params.departDate, // Mirror
    tripType: String(tripType),
    adults: String(params.adults || 1),
    children: String(params.children || 0),
    cabins: params.cabin || '',
    banks: 'Capital One', // Focus on Capital One
    airlineProgram: programs.join(','),
    multiday: 'false',
  });
  
  // Add return date if round-trip
  if (params.returnDate && tripType === 2) {
    queryParams.set('returnDate', params.returnDate);
    queryParams.set('returnDateSec', params.returnDate);
  }
  
  return `${baseUrl}?${queryParams.toString()}`;
}

// ============================================
// IMPLIED CPP CALCULATOR
// ============================================

/**
 * Calculate implied cents-per-point value for an award option
 * 
 * Formula: ((cashPrice - feesCash) / miles) * 100
 * 
 * @param cashPrice - What the flight would cost in cash (USD)
 * @param award - The award option to evaluate
 * @returns CPP value (e.g., 1.8 means 1.8 cents per point)
 */
export function calculateImpliedCpp(cashPrice: number, award: AwardOption): number {
  if (award.miles <= 0) return 0;
  
  const cashEquivalent = cashPrice - award.feesCash;
  if (cashEquivalent <= 0) return 0;
  
  return (cashEquivalent / award.miles) * 100;
}

/**
 * Enrich award options with implied CPP values
 */
export function enrichAwardOptions(
  cashPrice: number,
  options: AwardOption[]
): AwardOption[] {
  return options.map(opt => ({
    ...opt,
    impliedCpp: calculateImpliedCpp(cashPrice, opt),
  }));
}

/**
 * Find the best award option based on implied CPP
 * (Higher CPP = better value for your points)
 */
export function findBestAward(options: AwardOption[]): AwardOption | null {
  if (options.length === 0) return null;
  
  return options.reduce((best, current) => {
    const currentCpp = current.impliedCpp || 0;
    const bestCpp = best.impliedCpp || 0;
    return currentCpp > bestCpp ? current : best;
  });
}

/**
 * Compare award option against user's mile valuation
 * Returns whether the award is a "good deal"
 */
export function isGoodAwardValue(
  award: AwardOption,
  userMileValueCpp: number = 1.8
): boolean {
  const impliedCpp = award.impliedCpp || 0;
  return impliedCpp >= userMileValueCpp;
}

// ============================================
// MESSAGE TYPES FOR CONTENT SCRIPT
// ============================================

export const POINTSYEAH_MESSAGE_TYPES = {
  PARSE_RESULTS: 'VX_POINTSYEAH_PARSE_RESULTS',
  PARSE_RESULTS_RESPONSE: 'VX_POINTSYEAH_PARSE_RESULTS_RESPONSE',
  CHECK_PAGE: 'VX_POINTSYEAH_CHECK_PAGE',
  CHECK_PAGE_RESPONSE: 'VX_POINTSYEAH_CHECK_PAGE_RESPONSE',
} as const;

/**
 * Send message to PointsYeah tab to parse results
 * (Used when user clicks "Import best award")
 */
export async function requestPointsYeahParse(tabId: number): Promise<PointsYeahParseResult> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: POINTSYEAH_MESSAGE_TYPES.PARSE_RESULTS,
    });
    
    return response as PointsYeahParseResult;
  } catch (error) {
    return {
      success: false,
      options: [],
      error: error instanceof Error ? error.message : 'Failed to parse PointsYeah results',
    };
  }
}

// ============================================
// TIPS CONTENT
// ============================================

export interface PointsYeahTip {
  number: number;
  text: string;
  important?: boolean;
}

export const POINTSYEAH_TIPS: PointsYeahTip[] = [
  {
    number: 1,
    text: 'Start with your exact date; if nothing shows, try ±1–2 days (free users can search multiple departure dates at once).',
  },
  {
    number: 2,
    text: 'Filter to your cabin, then sort by lowest points (or best value if shown).',
  },
  {
    number: 3,
    text: 'Expand a result to see all ways to book + change/cancel fees.',
  },
  {
    number: 4,
    text: 'Verify availability on the airline/program site before transferring points.',
    important: true,
  },
  {
    number: 5,
    text: 'If two programs show the same flight, pick the one with better fees/rules (programs price and refund differently).',
  },
];

export default {
  buildPointsYeahUrl,
  calculateImpliedCpp,
  enrichAwardOptions,
  findBestAward,
  isGoodAwardValue,
  requestPointsYeahParse,
  POINTSYEAH_TIPS,
  POINTSYEAH_MESSAGE_TYPES,
  CAPITAL_ONE_PARTNERS,
};
