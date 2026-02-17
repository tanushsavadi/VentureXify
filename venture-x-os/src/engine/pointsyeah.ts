/**
 * PointsYeah Integration Service
 *
 * Handles:
 * - Deep link URL building for PointsYeah flight search
 * - Award option types and implied CPP calculation
 * - Buy-miles vs. transfer comparison engine
 * - Portal-cheaper callout engine
 * - Message passing for result parsing (optional import)
 */

import { getAllAirlineIataCodes, getPartnerById, getBuyMilesData } from './transferPartnerRegistry';

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

// Legacy IATA codes that were in the original list but are NOT in the
// unified transfer partner registry.  Kept as a fallback for compatibility.
//   AR – possibly a legacy Aeromexico code (registry uses AM)
//   VA – Virgin Australia Velocity (no longer a Capital One partner)
const LEGACY_PARTNER_CODES = ['AR', 'VA'];

// Capital One transfer partners (airline programs)
// Derived from the unified transfer partner registry, supplemented with
// legacy codes for backward compatibility.
const CAPITAL_ONE_PARTNERS = [
  ...getAllAirlineIataCodes(),
  ...LEGACY_PARTNER_CODES.filter((c) => !getAllAirlineIataCodes().includes(c)),
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
// BUY-MILES COMPARISON ENGINE
// ============================================

export interface BuyMilesComparison {
  programName: string;
  milesRequired: number;
  baseBuyCostUSD: number;
  baseCostPerMileCents: number;
  bestBonusBuyCostUSD: number;
  bestBonusPercent: number;
  hasFrequentPromos: boolean;
  c1MilesNeeded: number;
  c1TransferValueUSD: number;
  transferSavingsUSD: number;
  buyIsCheaperWithBonus: boolean;
}

/**
 * Compare the cost of buying miles directly from an airline program
 * versus transferring Capital One miles.
 *
 * @param partnerId   - Registry partner slug (e.g., `'lifemiles'`).
 * @param milesRequired - Number of airline miles needed for the award.
 * @param c1MilesNeeded - Number of Capital One miles required for the transfer.
 * @param mileValuationCents - Assumed value of one C1 mile in cents (default 1.85).
 * @returns A comparison object, or `null` if the partner has no buy-miles data.
 */
export function computeBuyMilesComparison(
  partnerId: string,
  milesRequired: number,
  c1MilesNeeded: number,
  mileValuationCents: number = 1.85
): BuyMilesComparison | null {
  const buyData = getBuyMilesData(partnerId);
  if (!buyData) return null;

  const partner = getPartnerById(partnerId);
  const programName = partner?.name ?? partnerId;

  // Base cost: buy miles at face rate (no bonus)
  const baseBuyCostUSD = (milesRequired * buyData.baseCostCentsPerMile) / 100;

  // Best-bonus effective cost: with the highest typical bonus, you receive
  // (1 + bestBonus/100)× the miles you pay for, so you only need to purchase
  // milesRequired / (1 + bestBonus/100) miles.
  const bestBonusPercent = buyData.typicalBonusRange[1];
  const bestBonusBuyCostUSD =
    (milesRequired * buyData.baseCostCentsPerMile) / (100 + bestBonusPercent);

  // Value of the C1 miles you would transfer instead
  const c1TransferValueUSD = (c1MilesNeeded * mileValuationCents) / 100;

  // Savings from transferring versus buying at base rate
  const transferSavingsUSD = baseBuyCostUSD - c1TransferValueUSD;

  // Is buying cheaper even at the best bonus?
  const buyIsCheaperWithBonus = bestBonusBuyCostUSD < c1TransferValueUSD;

  return {
    programName,
    milesRequired,
    baseBuyCostUSD: Math.round(baseBuyCostUSD * 100) / 100,
    baseCostPerMileCents: buyData.baseCostCentsPerMile,
    bestBonusBuyCostUSD: Math.round(bestBonusBuyCostUSD * 100) / 100,
    bestBonusPercent,
    hasFrequentPromos: buyData.frequentPromotions,
    c1MilesNeeded,
    c1TransferValueUSD: Math.round(c1TransferValueUSD * 100) / 100,
    transferSavingsUSD: Math.round(transferSavingsUSD * 100) / 100,
    buyIsCheaperWithBonus,
  };
}

// ============================================
// PORTAL-CHEAPER CALLOUT ENGINE
// ============================================

export interface PortalCheaperResult {
  isPortalCheaper: boolean;
  portalCostMiles: number;
  portalEarnedMiles: number;
  portalNetCostMiles: number;
  portalNetCostUSD: number;
  awardCostC1Miles: number;
  awardTaxesFees: number;
  awardTotalValueUSD: number;
  savingsIfPortal: number;
  awardCPP: number;
  threshold: number;
  reason: string;
}

/**
 * Determine whether booking through the Capital One travel portal
 * (pay cash, earn miles) is cheaper than transferring miles for an
 * award redemption.
 *
 * @param params.cashPrice            - Flight cash price in USD.
 * @param params.awardC1Miles         - C1 miles needed for the award transfer.
 * @param params.awardTaxesFees       - Award taxes/fees in USD.
 * @param params.mileValuationCents   - Value of one C1 mile in cents (default 1.85).
 * @param params.portalMultiplier     - Miles earned per dollar in portal (default 5).
 * @param params.travelCreditRemaining - Remaining $300 travel credit (default 0).
 * @returns A `PortalCheaperResult` with the verdict and supporting numbers.
 */
export function computePortalCheaperCallout(params: {
  cashPrice: number;
  awardC1Miles: number;
  awardTaxesFees: number;
  mileValuationCents?: number;
  portalMultiplier?: number;
  travelCreditRemaining?: number;
}): PortalCheaperResult {
  const {
    cashPrice,
    awardC1Miles,
    awardTaxesFees,
    mileValuationCents = 1.85,
    portalMultiplier = 5,
    travelCreditRemaining = 0,
  } = params;

  const threshold = 1.5; // CPP threshold below which award is flagged

  // Portal: cost in miles if paying with miles via Erase (1 cpp)
  const portalCostMiles = Math.round(cashPrice * 100);

  // Portal: pay cash, earn miles
  const portalOutOfPocket = Math.max(0, cashPrice - travelCreditRemaining);
  const portalEarnedMiles = Math.round(cashPrice * portalMultiplier);
  const portalNetCostUSD =
    portalOutOfPocket - (portalEarnedMiles * mileValuationCents) / 100;

  // Net miles impact — miles-equivalent of the net USD cost
  const portalNetCostMiles =
    mileValuationCents > 0
      ? Math.round((portalNetCostUSD / mileValuationCents) * 100)
      : portalCostMiles;

  // Award: total effective cost (taxes + value of miles transferred)
  const awardTotalValueUSD =
    awardTaxesFees + (awardC1Miles * mileValuationCents) / 100;

  // Is portal cheaper?
  const isPortalCheaper = portalNetCostUSD < awardTotalValueUSD;

  // Savings if portal is chosen (positive = portal saves money)
  const savingsIfPortal = awardTotalValueUSD - portalNetCostUSD;

  // Award CPP: value extracted per mile
  const awardCPP =
    awardC1Miles > 0
      ? ((cashPrice - awardTaxesFees) / awardC1Miles) * 100
      : 0;

  // Build reason string
  let reason: string;
  if (isPortalCheaper) {
    reason =
      `Portal booking is cheaper by $${Math.abs(savingsIfPortal).toFixed(2)}. ` +
      `You pay $${portalOutOfPocket.toFixed(2)} cash and earn ${portalEarnedMiles.toLocaleString()} miles back.`;
  } else if (awardCPP < threshold) {
    reason =
      `Award CPP is ${awardCPP.toFixed(2)}¢ — below the ${threshold}¢ threshold. ` +
      `Consider the portal for better value.`;
  } else {
    reason =
      `Transferring miles yields ${awardCPP.toFixed(2)}¢ per point — ` +
      `above the ${threshold}¢ threshold. Award is the better deal.`;
  }

  return {
    isPortalCheaper,
    portalCostMiles,
    portalEarnedMiles,
    portalNetCostMiles,
    portalNetCostUSD: Math.round(portalNetCostUSD * 100) / 100,
    awardCostC1Miles: awardC1Miles,
    awardTaxesFees,
    awardTotalValueUSD: Math.round(awardTotalValueUSD * 100) / 100,
    savingsIfPortal: Math.round(savingsIfPortal * 100) / 100,
    awardCPP: Math.round(awardCPP * 100) / 100,
    threshold,
    reason,
  };
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
    text: 'PointsYeah shows 3 "ways to book" — focus on the first one: "Book directly with airline program."',
    important: true,
  },
  {
    number: 2,
    text: 'Copy the program name, miles required, and taxes/fees. We handle the Capital One conversion.',
  },
  {
    number: 3,
    text: 'Quick alternative: find "Capital One" under "Transfer from credit card" and enter that number directly.',
  },
  {
    number: 4,
    text: 'We compare buy-points pricing against your C1 transfer value — check the comparison below your verdict.',
    important: true,
  },
  {
    number: 5,
    text: 'PointsYeah shows one-way results. Search outbound and return separately, then enter both legs.',
  },
];

export default {
  buildPointsYeahUrl,
  calculateImpliedCpp,
  enrichAwardOptions,
  findBestAward,
  isGoodAwardValue,
  computeBuyMilesComparison,
  computePortalCheaperCallout,
  requestPointsYeahParse,
  POINTSYEAH_TIPS,
  POINTSYEAH_MESSAGE_TYPES,
  CAPITAL_ONE_PARTNERS,
};
