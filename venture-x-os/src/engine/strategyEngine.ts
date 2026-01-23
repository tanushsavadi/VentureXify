// ============================================
// DETERMINISTIC STRATEGY ENGINE
// Computes all 6 strategies and ranks them by mode
// LLM does NOT do math - this is the single source of truth
//
// Updated with research findings:
// - CPM thresholds (1.0¢ floor, 1.3¢ good, 1.5¢+ excellent)
// - Friction scoring for each strategy
// - Award guardrails (warn if below Travel Eraser baseline)
// - Double-dip Travel Eraser recommendation
//
// Extended for Stays (Hotels/Vacation Rentals):
// - Hotels: 10x miles via portal vs 2x direct
// - Vacation Rentals: 5x miles via portal vs 2x direct
// ============================================

import {
  StrategyInput,
  StrategyResult,
  StrategyEngineOutput,
  RankingMode,
  VENTURE_X_CONSTANTS,
  AwardOption,
  calculateFrictionScore,
  assessAwardValue,
  BookingType,
  AccommodationType,
  StayStrategyInput,
  StayItinerary,
  StayPortalQuote,
  StayDirectQuote,
  isStayInput,
  UnifiedStrategyInput,
} from './types';

import {
  suggestPartnersForRoute,
  calculateDoubleDipRecommendation,
} from './transferPartners';

const C = VENTURE_X_CONSTANTS;

// ============================================
// STAY RATE HELPERS
// ============================================

/**
 * Get the portal earn rate for a stay based on accommodation type
 */
export function getStayPortalRate(accommodationType?: AccommodationType): number {
  if (accommodationType === 'vacation_rental') {
    return C.PORTAL_VACATION_RENTALS_RATE; // 5x
  }
  return C.PORTAL_HOTELS_RATE; // 10x (default for hotels or unknown)
}

// ============================================
// STRATEGY CALCULATORS
// ============================================

/**
 * Strategy A: Portal at Parity
 * Book through Capital One Travel portal when price is similar to direct
 */
function calculatePortalParity(input: StrategyInput): StrategyResult {
  const { quotes, userContext } = input;
  
  if (!quotes.portal) {
    return {
      id: 'PORTAL_PARITY',
      name: 'Portal Booking',
      description: 'Book through Capital One Travel portal',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: 'No portal price captured',
    };
  }
  
  const portalPrice = quotes.portal.amountUSD;
  const milesRate = quotes.portal.milesRate || C.PORTAL_FLIGHTS_RATE;
  
  // Calculate credit applied (if any remaining)
  const creditApplied = Math.min(userContext.creditRemaining || 0, portalPrice);
  const netCash = portalPrice - creditApplied;
  
  // Miles earned
  const milesEarned = Math.round(portalPrice * milesRate);
  
  // Check if portal is at parity with direct
  const directPrice = quotes.direct?.amountUSD;
  const isParity = !directPrice || (portalPrice <= directPrice * (1 + C.PORTAL_PREMIUM_THRESHOLD));
  
  const pros: string[] = [
    `Earn ${milesEarned.toLocaleString()} miles (${milesRate}x)`,
    'Simple booking process',
  ];
  
  if (creditApplied > 0) {
    pros.push(`$${creditApplied} travel credit applied`);
  }
  
  const cons: string[] = [];
  
  if (directPrice && portalPrice > directPrice) {
    const premium = portalPrice - directPrice;
    cons.push(`$${premium.toFixed(0)} more than direct price`);
  }
  
  if (!isParity && directPrice) {
    cons.push('Portal price exceeds 7% threshold vs direct');
  }
  
  return {
    id: 'PORTAL_PARITY',
    name: 'Portal Booking',
    description: `Book via Capital One Travel for ${milesRate}x miles`,
    netCashCost: netCash,
    milesEarned,
    milesSpent: 0,
    cppRealized: 0,
    pros,
    cons,
    score: 0, // Will be calculated by ranking function
    available: true,
  };
}

/**
 * Strategy B: Portal with Price Protection
 * Book through portal when price protection is available
 */
function calculatePortalProtected(input: StrategyInput): StrategyResult {
  const { quotes, userContext } = input;
  
  if (!quotes.portal || !quotes.portal.priceProtectionAvailable) {
    return {
      id: 'PORTAL_PROTECTED',
      name: 'Portal + Price Protection',
      description: 'Book through portal with price protection',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: 'Price protection not detected on this booking',
    };
  }
  
  const portalPrice = quotes.portal.amountUSD;
  const milesRate = quotes.portal.milesRate || C.PORTAL_FLIGHTS_RATE;
  
  const creditApplied = Math.min(userContext.creditRemaining || 0, portalPrice);
  const netCash = portalPrice - creditApplied;
  const milesEarned = Math.round(portalPrice * milesRate);
  
  return {
    id: 'PORTAL_PROTECTED',
    name: 'Portal + Price Protection',
    description: 'Book via portal with price drop/match protection',
    netCashCost: netCash,
    milesEarned,
    milesSpent: 0,
    cppRealized: 0,
    pros: [
      `Earn ${milesEarned.toLocaleString()} miles (${milesRate}x)`,
      'Price protection available',
      quotes.portal.priceProtectionDetails || 'May get refund if price drops',
    ],
    cons: [
      'Protection terms may have limitations',
      'Must follow portal process for claims',
    ],
    score: 0,
    available: true,
  };
}

/**
 * Strategy C: Direct Cash Booking
 * Book directly with the airline (or OTA if detected)
 * IMPORTANT: Pros/cons are now conditional on seller type
 */
function calculateDirectCash(input: StrategyInput): StrategyResult {
  const { quotes, userContext } = input;
  
  if (!quotes.direct) {
    return {
      id: 'DIRECT_CASH',
      name: 'Book Direct (Cash)',
      description: 'Book directly with the airline',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: 'No direct price captured',
    };
  }
  
  const directPrice = quotes.direct.amountUSD;
  const siteName = quotes.direct.siteName || 'Google Flights';
  
  // Detect if this is an OTA based on site name
  // Common OTAs: Expedia, Booking.com, MakeMyTrip, Wego, Kayak, etc.
  const otaPatterns = /expedia|booking\.com|makemytrip|wego|kayak|priceline|orbitz|travelocity|hotwire|cheaptickets|edreams|lastminute|trip\.com|agoda|skyscanner/i;
  const isLikelyOTA = otaPatterns.test(siteName);
  const isAirlineDirect = /airline|airways|airlines|united|delta|american|southwest|jetblue|alaska|spirit|frontier|qatar|emirates|lufthansa|british|virgin|air france|klm/i.test(siteName);
  
  // IMPORTANT: $300 travel credit does NOT apply to direct bookings!
  // The Capital One Travel Credit is PORTAL ONLY.
  // Do NOT subtract credit from direct price.
  const netCash = directPrice;
  
  // Earn base rate (2x) on direct bookings
  const milesEarned = Math.round(directPrice * C.BASE_RATE);
  
  // Build pros CONDITIONALLY based on seller type
  const pros: string[] = [];
  
  if (isAirlineDirect) {
    // Confirmed airline - full benefits
    pros.push('✓ Airline-managed booking');
    pros.push('✓ Direct customer support');
    pros.push('✓ Easier changes/cancellations');
  } else if (isLikelyOTA) {
    // Detected OTA - limited benefits
    pros.push('Third-party (OTA) booking');
    // Don't claim airline benefits for OTA
  } else {
    // Unknown - hedge the language
    pros.push('⚠️ Verify: airline checkout or OTA?');
    pros.push('If airline: easier changes/cancellations');
  }
  
  pros.push(`Earn ${milesEarned.toLocaleString()} miles (${C.BASE_RATE}x)`);
  
  // Build cons CONDITIONALLY
  const cons: string[] = [
    `Lower earn rate (${C.BASE_RATE}x vs ${C.PORTAL_FLIGHTS_RATE}x portal)`,
    '$300 travel credit not applicable (portal only)',
  ];
  
  if (isLikelyOTA) {
    cons.push('⚠️ OTA booking: changes/IRROPS may be harder');
    cons.push('May need to contact OTA, not airline, for issues');
  }
  
  // Calculate price difference vs portal (use consistent definition)
  const portalPrice = quotes.portal?.amountUSD;
  const creditRemaining = userContext?.creditRemaining ?? 0;
  
  if (portalPrice) {
    // Show BOTH sticker and out-of-pocket differences for clarity
    const stickerDiff = directPrice - portalPrice;
    const portalOutOfPocket = Math.max(0, portalPrice - Math.min(creditRemaining, portalPrice));
    const outOfPocketDiff = directPrice - portalOutOfPocket;
    
    if (stickerDiff > 0) {
      cons.push(`Sticker: $${stickerDiff.toFixed(0)} more than portal`);
    }
    if (outOfPocketDiff > 0 && creditRemaining > 0) {
      cons.push(`Out-of-pocket: $${outOfPocketDiff.toFixed(0)} more than portal (after credit)`);
    }
  }
  
  return {
    id: 'DIRECT_CASH',
    name: 'Book Direct (Cash)',
    description: isLikelyOTA
      ? `Book via ${siteName} (OTA)`
      : isAirlineDirect
      ? `Book directly with ${siteName}`
      : `Book via ${siteName}`,
    netCashCost: netCash,
    milesEarned,
    milesSpent: 0,
    cppRealized: 0,
    pros,
    cons,
    score: 0,
    available: true,
  };
}

/**
 * Strategy D: Direct + Travel Eraser
 * Book direct, then use miles to erase the charge
 */
function calculateDirectEraser(input: StrategyInput): StrategyResult {
  const { quotes, userContext } = input;
  
  if (!quotes.direct) {
    return {
      id: 'DIRECT_ERASER',
      name: 'Direct + Travel Eraser',
      description: 'Book direct, erase with miles',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: 'No direct price captured',
    };
  }
  
  const directPrice = quotes.direct.amountUSD;
  const milesBalance = userContext.milesBalance || 0;
  
  // Calculate max miles that can be used (user's balance or price equivalent)
  const maxMilesToUse = Math.floor(directPrice / C.ERASER_CPP);
  const milesToUse = Math.min(maxMilesToUse, milesBalance);
  
  // Can't use less than minimum
  if (milesToUse < C.ERASER_MIN_MILES && milesToUse < maxMilesToUse) {
    return {
      id: 'DIRECT_ERASER',
      name: 'Direct + Travel Eraser',
      description: 'Book direct, erase with miles',
      netCashCost: directPrice,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: `Need at least ${C.ERASER_MIN_MILES.toLocaleString()} miles (have ${milesBalance.toLocaleString()})`,
    };
  }
  
  // Calculate eraser value
  const eraserValue = milesToUse * C.ERASER_CPP;
  const netCash = Math.max(0, directPrice - eraserValue);
  
  // You don't earn miles on the portion you erase
  // (technically you earn then spend, but net effect is you pay less cash)
  const milesEarned = Math.round(directPrice * C.BASE_RATE);
  
  // Opportunity cost: those miles could be worth more via transfer
  const opportunityCost = milesToUse * (C.TRANSFER_CPP_TARGET - C.ERASER_CPP);
  
  return {
    id: 'DIRECT_ERASER',
    name: 'Direct + Travel Eraser',
    description: `Book direct, erase ${milesToUse.toLocaleString()} miles for $${eraserValue.toFixed(0)}`,
    netCashCost: netCash,
    milesEarned,
    milesSpent: milesToUse,
    cppRealized: C.ERASER_CPP * 100, // 1.0 cpp
    pros: [
      `Reduces cash cost by $${eraserValue.toFixed(0)}`,
      'Guaranteed 1¢/mile value',
      'Simple redemption process',
      'Direct airline support',
    ],
    cons: [
      `Uses ${milesToUse.toLocaleString()} miles at floor value (1¢)`,
      `Opportunity cost: ~$${opportunityCost.toFixed(0)} vs transfer partners`,
    ],
    score: 0,
    available: true,
  };
}

/**
 * Strategy E: Transfer to Partner (Award Booking)
 * Transfer miles to airline partner for award flight
 */
function calculateTransferAward(input: StrategyInput, awardOption?: AwardOption): StrategyResult {
  const { quotes, userContext } = input;
  
  if (!awardOption) {
    // No award options provided
    return {
      id: 'TRANSFER_AWARD',
      name: 'Transfer Partners (Award)',
      description: 'Transfer miles to airline partner',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: 'No award availability data (check airline partners for availability)',
    };
  }
  
  const milesRequired = awardOption.milesRequired;
  const taxesAndFees = awardOption.taxesAndFees;
  const milesBalance = userContext.milesBalance || 0;
  
  if (milesBalance < milesRequired) {
    return {
      id: 'TRANSFER_AWARD',
      name: `${awardOption.partnerName} Award`,
      description: `Transfer miles to ${awardOption.partnerName}`,
      netCashCost: taxesAndFees,
      milesEarned: 0,
      milesSpent: milesRequired,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: `Need ${milesRequired.toLocaleString()} miles (have ${milesBalance.toLocaleString()})`,
    };
  }
  
  // Calculate cpp using direct price as cash equivalent
  const directPrice = quotes.direct?.amountUSD || quotes.portal?.amountUSD || 0;
  const cashEquivalent = directPrice - taxesAndFees;
  const cpp = cashEquivalent > 0 ? (cashEquivalent / milesRequired) * 100 : 0;
  
  const isGoodValue = cpp >= C.TRANSFER_CPP_TARGET * 100;
  const isExcellentValue = cpp >= C.TRANSFER_CPP_EXCELLENT * 100;
  
  return {
    id: 'TRANSFER_AWARD',
    name: `${awardOption.partnerName} Award`,
    description: `Transfer ${milesRequired.toLocaleString()} miles for ${awardOption.cabin} award`,
    netCashCost: taxesAndFees,
    milesEarned: 0,
    milesSpent: milesRequired,
    cppRealized: cpp,
    partnerUsed: awardOption.partnerId,
    awardTaxes: taxesAndFees,
    pros: [
      `Only $${taxesAndFees.toFixed(0)} out of pocket`,
      `${cpp.toFixed(1)}¢/mile value${isExcellentValue ? ' (excellent!)' : isGoodValue ? ' (good)' : ''}`,
      awardOption.cabin !== 'economy' ? `${awardOption.cabin} class` : 'Award booking',
    ],
    cons: [
      `Uses ${milesRequired.toLocaleString()} miles`,
      'Transfer is one-way/irreversible',
      'Award availability required',
      awardOption.availability === 'waitlist' ? 'Currently on waitlist' : '',
    ].filter(Boolean),
    score: 0,
    available: awardOption.availability !== 'waitlist',
  };
}

/**
 * Strategy F: Hybrid Award + Erase Taxes
 * Book award flight, then erase the taxes/fees with miles
 */
function calculateHybridAwardEraser(input: StrategyInput, awardOption?: AwardOption): StrategyResult {
  const { userContext } = input;
  
  if (!awardOption) {
    return {
      id: 'HYBRID_AWARD_ERASER',
      name: 'Award + Erase Taxes',
      description: 'Book award, erase taxes with more miles',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: 0,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: 'No award availability data',
    };
  }
  
  const milesForAward = awardOption.milesRequired;
  const taxesAndFees = awardOption.taxesAndFees;
  const milesForEraser = Math.ceil(taxesAndFees / C.ERASER_CPP);
  const totalMilesNeeded = milesForAward + milesForEraser;
  const milesBalance = userContext.milesBalance || 0;
  
  if (milesBalance < totalMilesNeeded) {
    return {
      id: 'HYBRID_AWARD_ERASER',
      name: 'Award + Erase Taxes',
      description: 'Book award, erase taxes with miles',
      netCashCost: 0,
      milesEarned: 0,
      milesSpent: totalMilesNeeded,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: `Need ${totalMilesNeeded.toLocaleString()} total miles (have ${milesBalance.toLocaleString()})`,
    };
  }
  
  // If taxes are too low to erase, this strategy doesn't make sense
  if (milesForEraser < C.ERASER_MIN_MILES) {
    return {
      id: 'HYBRID_AWARD_ERASER',
      name: 'Award + Erase Taxes',
      description: 'Book award, erase taxes with miles',
      netCashCost: taxesAndFees,
      milesEarned: 0,
      milesSpent: milesForAward,
      cppRealized: 0,
      pros: [],
      cons: [],
      score: 0,
      available: false,
      unavailableReason: `Taxes too low to erase (min ${C.ERASER_MIN_MILES.toLocaleString()} miles = $${(C.ERASER_MIN_MILES * C.ERASER_CPP).toFixed(0)})`,
    };
  }
  
  return {
    id: 'HYBRID_AWARD_ERASER',
    name: 'Award + Erase Taxes',
    description: `${awardOption.partnerName} award + erase $${taxesAndFees.toFixed(0)} taxes`,
    netCashCost: 0,
    milesEarned: 0,
    milesSpent: totalMilesNeeded,
    cppRealized: 0, // Complex to calculate for hybrid
    partnerUsed: awardOption.partnerId,
    awardTaxes: 0,
    pros: [
      '$0 out of pocket!',
      'Completely "free" flight',
      awardOption.cabin !== 'economy' ? `${awardOption.cabin} class` : '',
    ].filter(Boolean),
    cons: [
      `Uses ${totalMilesNeeded.toLocaleString()} total miles`,
      `Award: ${milesForAward.toLocaleString()} + Eraser: ${milesForEraser.toLocaleString()}`,
      'Eraser portion at floor value (1¢/mile)',
    ],
    score: 0,
    available: awardOption.availability !== 'waitlist',
  };
}

// ============================================
// RANKING FUNCTIONS
// ============================================

function scoreForCheapestCash(strategy: StrategyResult): number {
  if (!strategy.available) return -Infinity;
  // Lower cash cost = higher score (invert)
  // Also factor in miles spent (opportunity cost)
  const opportunityCost = strategy.milesSpent * C.TRANSFER_CPP_TARGET;
  return -(strategy.netCashCost + opportunityCost);
}

function scoreForMaxValue(strategy: StrategyResult): number {
  if (!strategy.available) return -Infinity;
  
  // If spending miles, score by cpp
  if (strategy.milesSpent > 0 && strategy.cppRealized > 0) {
    // Award booking cpp
    return strategy.cppRealized;
  }
  
  // If earning miles, score by effective return rate
  if (strategy.milesEarned > 0 && strategy.netCashCost > 0) {
    const milesValue = strategy.milesEarned * C.TRANSFER_CPP_TARGET;
    const effectiveReturn = (milesValue / strategy.netCashCost) * 100;
    return effectiveReturn;
  }
  
  // Eraser at 1cpp is the floor
  if (strategy.id === 'DIRECT_ERASER') {
    return 1.0;
  }
  
  return 0;
}

function scoreForLeastHassle(strategy: StrategyResult): number {
  if (!strategy.available) return -Infinity;
  
  // Hassle scores (higher = less hassle)
  const hassleScores: Record<string, number> = {
    'DIRECT_CASH': 100,           // Simplest
    'DIRECT_ERASER': 80,          // Extra step to erase
    'PORTAL_PARITY': 70,          // Portal can be finicky
    'PORTAL_PROTECTED': 60,       // Need to track price drops
    'TRANSFER_AWARD': 30,         // Most steps, availability constraints
    'HYBRID_AWARD_ERASER': 10,    // Most complex
  };
  
  return hassleScores[strategy.id] || 0;
}

// ============================================
// MAIN ENGINE
// ============================================

export function computeStrategies(
  input: StrategyInput,
  mode: RankingMode = 'cheapest_cash'
): StrategyEngineOutput {
  // Calculate all strategies
  const portalParity = calculatePortalParity(input);
  const portalProtected = calculatePortalProtected(input);
  const directCash = calculateDirectCash(input);
  const directEraser = calculateDirectEraser(input);
  
  // Award strategies (use first award option if available)
  const firstAward = input.quotes.awardOptions?.[0];
  const transferAward = calculateTransferAward(input, firstAward);
  const hybridAward = calculateHybridAwardEraser(input, firstAward);
  
  // Collect all strategies
  let allStrategies: StrategyResult[] = [
    portalParity,
    portalProtected,
    directCash,
    directEraser,
    transferAward,
    hybridAward,
  ];
  
  // Apply scoring based on mode
  const scoreFn = {
    cheapest_cash: scoreForCheapestCash,
    max_value: scoreForMaxValue,
    least_hassle: scoreForLeastHassle,
  }[mode];
  
  allStrategies = allStrategies.map(s => ({
    ...s,
    score: scoreFn(s),
  }));
  
  // Sort by score (descending)
  allStrategies.sort((a, b) => b.score - a.score);
  
  // Get top available strategy
  const topStrategy = allStrategies.find(s => s.available) || allStrategies[0];
  
  // Calculate summary
  const availableStrategies = allStrategies.filter(s => s.available);
  const worstCost = Math.max(...availableStrategies.map(s => s.netCashCost));
  const savingsVsWorst = worstCost - topStrategy.netCashCost;
  
  // Generate key insight
  let keyInsight = '';
  if (mode === 'cheapest_cash') {
    keyInsight = `${topStrategy.name} is cheapest at $${topStrategy.netCashCost.toFixed(0)} out of pocket`;
  } else if (mode === 'max_value') {
    if (topStrategy.cppRealized > 0) {
      keyInsight = `${topStrategy.name} gives ${topStrategy.cppRealized.toFixed(1)}¢/mile value`;
    } else if (topStrategy.milesEarned > 0) {
      keyInsight = `${topStrategy.name} earns ${topStrategy.milesEarned.toLocaleString()} miles`;
    }
  } else {
    keyInsight = `${topStrategy.name} is the simplest option`;
  }
  
  // Suggested questions for LLM to ask
  const suggestedQuestions: string[] = [];
  
  if (input.userContext.milesBalance === undefined) {
    suggestedQuestions.push('How many Capital One miles do you currently have?');
  }
  
  if (!input.quotes.awardOptions || input.quotes.awardOptions.length === 0) {
    suggestedQuestions.push('Would you like me to suggest transfer partners to check for award availability?');
  }
  
  if (input.userContext.wantsLowHassle === undefined) {
    suggestedQuestions.push('Do you prefer a simpler booking process or maximum value?');
  }
  
  return {
    rankingMode: mode,
    topStrategy,
    allStrategies,
    summary: {
      winner: topStrategy.name,
      savingsVsWorst,
      keyInsight,
    },
    suggestedQuestions,
  };
}

// ============================================
// SIMPLIFIED INTERFACE FOR CURRENT UI
// (Used when we only have portal + direct prices)
// DecisionFacts approach: conservative, range-aware, auditable
// ============================================

export interface SimpleCompareInput {
  portalPriceUSD: number;
  directPriceUSD: number;
  milesBalance?: number;
  creditRemaining?: number;
  mileValuationCpp?: number; // User's mile valuation in cpp (e.g., 0.018 for 1.8¢)
  // Extended fields for better accuracy
  creditDetectedInPrice?: boolean;   // true if portal UI shows credit already applied in price
  creditBehavior?: CreditBehavior;   // unknown by default
  directIsOTA?: boolean | 'unknown'; // true if MakeMyTrip/Expedia/etc, false if airline direct
  itineraryMatch?: number | 'unknown'; // 0..1 confidence that portal/direct are same itinerary
  objective?: 'cheapest_cash' | 'max_value' | 'easiest';
  // Booking type for correct earn rate (10x hotels, 5x flights/vacation rentals)
  bookingType?: 'flight' | 'hotel' | 'rental' | 'vacation_rental' | 'other';
  // Pay-at-property fee (resort fee, etc.) - shown separately but included in total
  payAtPropertyFee?: number;
}

export type CreditBehavior = 'reduces_charge' | 'posts_later' | 'unknown';

export interface SimpleCompareOutput {
  recommendation: 'portal' | 'direct' | 'eraser';
  netSavings: number;
  portalDetails: {
    price: number;              // Sticker price
    creditApplied: number;      // $300 credit (portal only!)
    outOfPocket: number;        // price - credit
    milesEarned: number;        // Conservative (min) for safety
    milesValue: number;         // At user's valuation (conservative)
    netEffectiveCost: number;   // outOfPocket - milesValue (worst-case)
    // Optional range fields for richer UI
    milesEarnedRange?: { min: number; max: number };
    milesValueRange?: { min: number; max: number };
    netEffectiveCostRange?: { min: number; max: number };
  };
  directDetails: {
    price: number;              // Sticker price
    creditApplied: number;      // Always 0 (credit is portal only)
    outOfPocket: number;        // Same as price (no credit)
    milesEarned: number;
    milesValue: number;
    netEffectiveCost: number;
    // OTA detection for conditional pros/cons
    isOTA: boolean | 'unknown';
    sellerType: 'airline' | 'ota' | 'unknown';
  };
  eraserDetails?: {
    milesToSpend: number;
    cashSaved: number;
    outOfPocket: number;
    netCost?: number;           // Includes opportunity cost of miles
  };
  explanation: string[];
  allStrategies: StrategyResult[];
  breakEvenCpp: number; // CPP at which portal and direct are equal
  
  // ============================================
  // NEW: Decision-grade context for better UX
  // ============================================
  
  /** "Why this won" - 3 bullet points explaining the decision */
  whyThisWon: {
    payToday: string;           // e.g., "$521 vs $1,208 (save $687 today)"
    milesEarned: string;        // e.g., "+2,605 more miles on portal" or range
    decisionTip: string;        // e.g., "Only choose Direct if: you need airline checkout"
  };
  
  /** Explicit assumptions used in the calculation */
  assumptions: {
    label: string;
    value: string;
    editable?: boolean;         // If true, UI can show "tap to change"
  }[];
  
  /** What could change the answer - decision flip conditions */
  couldFlipIf: string[];
  
  /** Confidence level based on known vs unknown inputs */
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  
  /** Difference metrics (consistent definitions) */
  deltas: {
    stickerDiff: number;        // portalPrice - directPrice (can be negative)
    outOfPocketDiff: number;    // portalOutOfPocket - directOutOfPocket
    netEffectiveDiff: number;   // portalNet - directNet (conservative)
    milesDiff: number;          // portalMiles - directMiles (conservative)
  };
  
  // ============================================
  // NEW: Research-based enhancements
  // ============================================
  
  /** Double-dip Travel Eraser recommendation */
  doubleDipRecommendation?: {
    recommended: boolean;
    strategy: 'portal_then_erase' | 'direct_then_erase' | 'portal_pay_cash' | 'direct_pay_cash';
    explanation: string;
    breakdown: {
      payToday: number;
      milesEarned: number;
      milesValue: number;
      eraseLater: number;
      effectiveCost: number;
    };
  };
  
  /** Alliance partner suggestions (if airline detected) */
  partnerSuggestions?: Array<{
    partnerId: string;
    partnerName: string;
    alliance?: string;
    rationale: string;
    typicalValue: string;
    transferRatio: string;
  }>;
  
  /** Friction scores for each option */
  frictionScores: {
    portal: number;
    direct: number;
    award?: number;
  };
  
  /** Award value assessment (if award option provided) */
  awardAssessment?: {
    cpm: number;
    tier: 'below_floor' | 'floor_to_good' | 'good' | 'excellent' | 'outstanding';
    label: string;
    color: string;
    worthTransferring: boolean;
    warningMessage?: string;
  };
  
  /** Key thresholds from research */
  thresholds: {
    eraserFloor: number;        // 1.0¢ - Travel Eraser baseline
    goodDeal: number;           // 1.3¢ - worth transferring
    excellent: number;          // 1.8¢+ - great value
  };
}

export function simpleCompare(inputRaw: SimpleCompareInput): SimpleCompareOutput {
  // Cast to extended type for optional fields
  const input = inputRaw as SimpleCompareInput;

  // ----------------------------
  // Helpers
  // ----------------------------
  const usd0 = (n: number) => (Number.isFinite(n) ? n : 0);
  const clamp0 = (n: number) => Math.max(0, usd0(n));
  const roundMiles = (n: number) => Math.max(0, Math.round(usd0(n)));
  const fmtUSD = (n: number) => `$${usd0(n).toFixed(0)}`;
  const fmtMiles = (n: number) => roundMiles(n).toLocaleString();
  const fmtRange = (min: number, max: number, fmt: (x: number) => string) =>
    min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;

  // ----------------------------
  // Objective selection
  // ----------------------------
  const objective = input.objective ?? 'max_value';

  // ----------------------------
  // Core constants / valuation
  // ----------------------------
  const mileValueCpp = input.mileValuationCpp ?? C.DEFAULT_MILE_VALUE_CPP; // e.g. 0.018

  const portalSticker = clamp0(input.portalPriceUSD);
  const directSticker = clamp0(input.directPriceUSD);

  // ----------------------------
  // Credit interpretation
  // IMPORTANT: If creditRemaining is not known, treat as 0 (conservative).
  // ----------------------------
  const creditRemainingKnown = typeof input.creditRemaining === 'number';
  const creditRemaining = creditRemainingKnown ? clamp0(input.creditRemaining!) : 0;

  // If portal UI already shows credits applied in the displayed price, never apply again.
  const creditDetectedInPrice = input.creditDetectedInPrice ?? false;

  const creditEligible = !creditDetectedInPrice && creditRemaining > 0;
  const portalCreditApplied = creditEligible ? Math.min(creditRemaining, portalSticker) : 0;
  const portalOutOfPocket = clamp0(portalSticker - portalCreditApplied);

  const portalPremiumPct =
    directSticker > 0 ? (portalSticker - directSticker) / directSticker : 0;

  // ----------------------------
  // Miles earned (RANGE-aware)
  // ----------------------------
  const creditBehavior: CreditBehavior = input.creditBehavior ?? 'unknown';
  
  // ============================================
  // BOOKING-TYPE-AWARE PORTAL MULTIPLIER
  // Hotels/Rental Cars = 10x, Flights/Vacation Rentals = 5x
  // ============================================
  const bookingType = input.bookingType ?? 'flight';
  const getPortalRateForBookingType = (bt: typeof bookingType): number => {
    switch (bt) {
      case 'hotel':
        return C.PORTAL_HOTELS_RATE;           // 10x
      case 'rental':
        return C.PORTAL_CARS_RATE;             // 10x
      case 'flight':
        return C.PORTAL_FLIGHTS_RATE;          // 5x
      case 'vacation_rental':
        return C.PORTAL_VACATION_RENTALS_RATE; // 5x
      case 'other':
      default:
        return C.PORTAL_FLIGHTS_RATE;          // 5x default
    }
  };
  const portalEarnRate = getPortalRateForBookingType(bookingType);
  const portalEarnRateLabel = `${portalEarnRate}x`;

  // Portal miles can depend on how credit behaves:
  // - reduces_charge: earn on amount charged (portalOutOfPocket)
  // - posts_later: earn on sticker (portalSticker)
  // - unknown: show range
  const portalMilesEarnedMin =
    creditBehavior === 'posts_later'
      ? roundMiles(portalSticker * portalEarnRate)
      : roundMiles(portalOutOfPocket * portalEarnRate);

  const portalMilesEarnedMax =
    creditBehavior === 'reduces_charge'
      ? roundMiles(portalOutOfPocket * portalEarnRate)
      : roundMiles(portalSticker * portalEarnRate);

  const directMilesEarned = roundMiles(directSticker * C.BASE_RATE);

  // Miles value ranges
  const portalMilesValueMin = portalMilesEarnedMin * mileValueCpp;
  const portalMilesValueMax = portalMilesEarnedMax * mileValueCpp;

  const directMilesValue = directMilesEarned * mileValueCpp;

  // Net effective cost (range for portal)
  // Worst-case = fewer miles earned (higher net cost)
  const portalNetWorst = portalOutOfPocket - portalMilesValueMin;
  const portalNetBest = portalOutOfPocket - portalMilesValueMax;

  const directOutOfPocket = directSticker;
  const directNet = directOutOfPocket - directMilesValue;

  // ----------------------------
  // Eraser strategy (fixed comparison)
  // Eraser should be compared on the SAME basis (net cost), and include opp cost of miles spent.
  // Also: enforce min redemption.
  // ----------------------------
  const milesBalance = clamp0(input.milesBalance ?? 0);
  const eraserAvailable = milesBalance >= C.ERASER_MIN_MILES;

  type EraserCandidate = {
    label: 'direct' | 'portal';
    milesToSpend: number;
    cashSaved: number;
    outOfPocket: number;        // cash after eraser
    netCost: number;            // includes miles earned value AND miles spent opportunity cost
  };

  const buildEraserCandidate = (label: 'direct' | 'portal', baseOutOfPocket: number, earnMiles: number): EraserCandidate | null => {
    // miles needed to erase as much as possible (1cpp), capped by balance
    const milesNeeded = Math.floor(baseOutOfPocket / C.ERASER_CPP);
    const milesToSpend = Math.min(milesNeeded, milesBalance);

    // Enforce min redemption threshold
    if (milesToSpend < C.ERASER_MIN_MILES) return null;

    const cashSaved = milesToSpend * C.ERASER_CPP;
    const outOfPocket = clamp0(baseOutOfPocket - cashSaved);

    // Earned miles still have value; spent miles have opportunity cost at mileValueCpp
    const earnedValue = earnMiles * mileValueCpp;
    const spentOppCost = milesToSpend * mileValueCpp;

    const netCost = outOfPocket - earnedValue + spentOppCost;
    return { label, milesToSpend, cashSaved, outOfPocket, netCost };
  };

  // For portal-erasing, use worst-case miles earned (conservative)
  const eraserDirect = eraserAvailable
    ? buildEraserCandidate('direct', directOutOfPocket, directMilesEarned)
    : null;

  const eraserPortal = eraserAvailable
    ? buildEraserCandidate('portal', portalOutOfPocket, portalMilesEarnedMin)
    : null;

  const eraserCandidates = [eraserDirect, eraserPortal].filter(Boolean) as EraserCandidate[];
  const eraserBest = eraserCandidates.sort((a, b) => a.netCost - b.netCost)[0] ?? null;

  // ----------------------------
  // Break-even CPP (range-aware)
  // Solve portalOut - portalMiles*cpp = directOut - directMiles*cpp
  // cpp = (portalOut - directOut) / (portalMiles - directMiles)
  // ----------------------------
  const breakEvenForMiles = (portalMiles: number): number => {
    const denom = portalMiles - directMilesEarned;
    if (denom === 0) return Infinity;
    return (portalOutOfPocket - directOutOfPocket) / denom;
  };

  const breakEvenMin = breakEvenForMiles(portalMilesEarnedMax); // more miles -> smaller cpp needed
  const breakEvenMax = breakEvenForMiles(portalMilesEarnedMin); // fewer miles -> larger cpp needed
  const breakEvenCpp =
    Number.isFinite(breakEvenMin) && Number.isFinite(breakEvenMax)
      ? (Math.min(breakEvenMin, breakEvenMax) + Math.max(breakEvenMin, breakEvenMax)) / 2
      : 0;

  // ----------------------------
  // Choose winners by objective (more useful UX)
  // ----------------------------
  const cheapestCashWinner =
    portalOutOfPocket <= directOutOfPocket ? 'portal' : 'direct';

  // Max-value uses conservative portal net (worst-case) so it won't overpromise.
  const portalBeatsDirectRobustly = portalNetWorst < directNet;

  let maxValueWinner: 'portal' | 'direct' | 'eraser' = portalBeatsDirectRobustly ? 'portal' : 'direct';

  if (eraserBest) {
    const bestNonEraserNet = Math.min(portalNetWorst, directNet);
    if (eraserBest.netCost < bestNonEraserNet) maxValueWinner = 'eraser';
  }

  // Easiest heuristic: airline-direct is easiest; OTA is hardest
  const directIsOTA = input.directIsOTA ?? 'unknown';
  let easiestWinner: 'portal' | 'direct' = 'direct';
  if (directIsOTA === true) easiestWinner = 'portal';      // avoid OTA
  if (directIsOTA === 'unknown') easiestWinner = 'direct'; // default to direct, but warn

  const recommendation: 'portal' | 'direct' | 'eraser' =
    objective === 'cheapest_cash'
      ? cheapestCashWinner
      : objective === 'easiest'
      ? easiestWinner
      : maxValueWinner;

  // ----------------------------
  // netSavings should reflect chosen objective + second best
  // ----------------------------
  const candidates: Array<{ id: 'portal' | 'direct' | 'eraser'; metric: number }> = [];
  if (objective === 'cheapest_cash') {
    candidates.push({ id: 'portal', metric: portalOutOfPocket });
    candidates.push({ id: 'direct', metric: directOutOfPocket });
    if (eraserBest) candidates.push({ id: 'eraser', metric: eraserBest.outOfPocket });
  } else if (objective === 'easiest') {
    // Easiness isn't a numeric metric here; just set netSavings=0
  } else {
    candidates.push({ id: 'portal', metric: portalNetWorst });
    candidates.push({ id: 'direct', metric: directNet });
    if (eraserBest) candidates.push({ id: 'eraser', metric: eraserBest.netCost });
  }

  const sorted = candidates.sort((a, b) => a.metric - b.metric);
  const netSavings =
    sorted.length >= 2 ? Math.max(0, sorted[1].metric - sorted[0].metric) : 0;

  // ----------------------------
  // Build explanation (more audit-able)
  // ----------------------------
  const explanation: string[] = [];

  // Headline
  explanation.push(
    objective === 'cheapest_cash'
      ? `Cheapest cash today: ${cheapestCashWinner.toUpperCase()}`
      : objective === 'easiest'
      ? `Least hassle: ${easiestWinner.toUpperCase()}`
      : `Max value (conservative): ${maxValueWinner.toUpperCase()}`
  );

  // Numbers
  explanation.push(
    `Portal: ${fmtUSD(portalSticker)} − ${fmtUSD(portalCreditApplied)} credit = ${fmtUSD(portalOutOfPocket)} out of pocket`
  );
  explanation.push(`Direct: ${fmtUSD(directSticker)} out of pocket`);

  explanation.push(
    `Portal miles: ${fmtRange(portalMilesEarnedMin, portalMilesEarnedMax, (x) => fmtMiles(x))} (${portalEarnRateLabel}) | Direct miles: ${fmtMiles(directMilesEarned)} (2x)`
  );

  explanation.push(
    `At ${(mileValueCpp * 100).toFixed(1)}¢/mile → Portal net: ${fmtRange(portalNetBest, portalNetWorst, (x) => fmtUSD(x))} | Direct net: ${fmtUSD(directNet)}`
  );

  // Threshold insight
  if (directSticker > 0) {
    explanation.push(`Portal premium vs direct: ${portalPremiumPct >= 0 ? '+' : ''}${(portalPremiumPct * 100).toFixed(1)}%`);
    if (portalPremiumPct > 0.07) {
      explanation.push(`⚠️ Warning: portal price exceeds your 7% premium threshold`);
    }
  }

  // Eraser explanation (only if available)
  let eraserDetails: SimpleCompareOutput['eraserDetails'] | undefined;
  if (eraserBest) {
    eraserDetails = {
      milesToSpend: eraserBest.milesToSpend,
      cashSaved: eraserBest.cashSaved,
      outOfPocket: eraserBest.outOfPocket,
      netCost: eraserBest.netCost,
    };
    explanation.push(
      `Eraser (${eraserBest.label}): out-of-pocket ${fmtUSD(eraserBest.outOfPocket)} using ${fmtMiles(eraserBest.milesToSpend)} miles (1¢/mile)`
    );
    explanation.push(
      `Eraser net-cost includes opportunity cost at ${(mileValueCpp * 100).toFixed(1)}¢/mile`
    );
  } else if (milesBalance > 0 && milesBalance < C.ERASER_MIN_MILES) {
    explanation.push(`Eraser unavailable: need at least ${C.ERASER_MIN_MILES.toLocaleString()} miles`);
  }

  // Assumptions / warnings
  if (!creditRemainingKnown) {
    explanation.push(`⚠️ Assumption: creditRemaining is unknown → treated as $0 (set it in settings for accuracy)`);
  }
  if (creditDetectedInPrice) {
    explanation.push(`ℹ️ Credit detected in portal price → avoided double-counting`);
  }
  if (creditBehavior === 'unknown' && portalCreditApplied > 0) {
    explanation.push(`ℹ️ Portal miles shown as a range because credit may or may not reduce earning base`);
  }
  if (directIsOTA === 'unknown') {
    explanation.push(`💡 Tip: verify "direct" is airline checkout (not an OTA) for easier changes/refunds`);
  } else if (directIsOTA === true) {
    explanation.push(`⚠️ Warning: "direct" appears to be an OTA → airline changes/IRROPS can be harder`);
  }

  // Break-even insight (only if sensible)
  const beMin = Math.min(breakEvenMin, breakEvenMax);
  const beMax = Math.max(breakEvenMin, breakEvenMax);
  if (Number.isFinite(beMin) && beMin > 0 && beMin < 0.05) {
    explanation.push(
      `Break-even valuation: ${fmtRange(beMin, beMax, (x) => `${(x * 100).toFixed(2)}¢`)} per mile`
    );
  }

  // ----------------------------
  // Keep computeStrategies call (but don't lie about credit)
  // ----------------------------
  const fullInput: StrategyInput = {
    itinerary: {
      origin: 'XXX',
      destination: 'YYY',
      departDate: new Date().toISOString(),
      cabin: 'economy',
      passengers: 1,
      isRoundTrip: true,
    },
    quotes: {
      portal: {
        amount: portalSticker,
        currency: 'USD',
        amountUSD: portalSticker,
        milesRate: portalEarnRate, // Use booking-type-aware rate
      },
      direct: {
        amount: directSticker,
        currency: 'USD',
        amountUSD: directSticker,
        siteName: bookingType === 'hotel' || bookingType === 'rental' || bookingType === 'vacation_rental'
          ? 'Hotel Direct'
          : 'Google Flights',
      },
    },
    userContext: {
      milesBalance: input.milesBalance,
      // Conservative: if unknown, treat as 0 (don't silently assume $300)
      creditRemaining: creditRemainingKnown ? creditRemaining : 0,
    },
  };

  const engineResult = computeStrategies(fullInput, 'cheapest_cash');

  // ----------------------------
  // Calculate deltas (consistent definitions)
  // ----------------------------
  const stickerDiff = portalSticker - directSticker;
  const outOfPocketDiff = portalOutOfPocket - directOutOfPocket;
  const netEffectiveDiff = portalNetWorst - directNet;
  const milesDiffConservative = portalMilesEarnedMin - directMilesEarned;
  
  // ----------------------------
  // Build "Why this won" block
  // ----------------------------
  const savingsToday = Math.abs(outOfPocketDiff);
  const winnerPayTodayLabel = recommendation === 'portal'
    ? `Portal: ${fmtUSD(portalOutOfPocket)} vs Direct: ${fmtUSD(directOutOfPocket)}`
    : recommendation === 'direct'
    ? `Direct: ${fmtUSD(directOutOfPocket)} vs Portal: ${fmtUSD(portalOutOfPocket)}`
    : `Eraser: ${fmtUSD(eraserBest?.outOfPocket ?? 0)} out-of-pocket`;
  
  const payTodayDetail = outOfPocketDiff < 0
    ? `${winnerPayTodayLabel} (save ${fmtUSD(savingsToday)} today)`
    : outOfPocketDiff > 0
    ? `${winnerPayTodayLabel} (${fmtUSD(savingsToday)} more, but worth it for miles)`
    : `${winnerPayTodayLabel} (same out-of-pocket)`;
  
  const milesDiffAbs = Math.abs(milesDiffConservative);
  const milesEarnedDetail = milesDiffConservative > 0
    ? `+${fmtMiles(milesDiffAbs)} more miles on Portal (${fmtRange(portalMilesEarnedMin, portalMilesEarnedMax, fmtMiles)} vs ${fmtMiles(directMilesEarned)})`
    : milesDiffConservative < 0
    ? `+${fmtMiles(milesDiffAbs)} more miles on Direct`
    : `Same miles earned`;
  
  // Decision tip based on context
  let decisionTip: string;
  if (recommendation === 'portal') {
    if (directIsOTA === 'unknown') {
      decisionTip = 'Only choose Direct if: it\'s airline checkout AND you need flexible changes';
    } else if (directIsOTA === true) {
      decisionTip = 'Direct is an OTA—Portal likely has similar change policies';
    } else {
      decisionTip = 'Only choose Direct if: you value airline relationship over miles earned';
    }
  } else if (recommendation === 'direct') {
    decisionTip = 'Only choose Portal if: you have unused $300 credit AND price drops';
  } else {
    decisionTip = 'Consider: Eraser uses miles at 1¢—transfer partners often give 1.5-2¢+';
  }
  
  // ----------------------------
  // Build assumptions list (editable markers)
  // ----------------------------
  const assumptions: SimpleCompareOutput['assumptions'] = [];
  
  if (creditRemainingKnown) {
    assumptions.push({
      label: 'Travel credit remaining',
      value: `$${creditRemaining}`,
      editable: true,
    });
  } else {
    assumptions.push({
      label: 'Travel credit',
      value: 'Unknown (treated as $0)',
      editable: true,
    });
  }
  
  assumptions.push({
    label: 'Miles valued at',
    value: `${(mileValueCpp * 100).toFixed(1)}¢/mile`,
    editable: true,
  });
  
  if (directIsOTA === 'unknown') {
    assumptions.push({
      label: '"Direct" seller type',
      value: 'Unknown (verify if airline or OTA)',
      editable: false,
    });
  } else {
    assumptions.push({
      label: '"Direct" seller',
      value: directIsOTA ? 'OTA (third-party)' : 'Airline direct',
      editable: false,
    });
  }
  
  if (creditBehavior === 'unknown' && portalCreditApplied > 0) {
    assumptions.push({
      label: 'Portal miles basis',
      value: 'Range shown (credit behavior unclear)',
      editable: false,
    });
  }
  
  // Add portal multiplier assumption (booking-type-aware)
  assumptions.push({
    label: 'Portal multiplier',
    value: `${portalEarnRateLabel} (${bookingType === 'hotel' ? 'Hotels' : bookingType === 'rental' ? 'Rental Cars' : bookingType === 'vacation_rental' ? 'Vacation Rentals' : 'Flights'})`,
    editable: false,
  });
  
  // ----------------------------
  // Build "could flip if" conditions
  // ----------------------------
  const couldFlipIf: string[] = [];
  
  if (recommendation === 'portal' && creditRemainingKnown && creditRemaining > 0) {
    couldFlipIf.push(`If credit is already used → Direct likely wins (out-of-pocket: ${fmtUSD(portalSticker)} vs ${fmtUSD(directSticker)})`);
  }
  
  if (recommendation === 'portal' && portalSticker > directSticker) {
    couldFlipIf.push(`If you value miles below ${(breakEvenCpp * 100).toFixed(1)}¢ → Direct wins`);
  }
  
  if (directIsOTA === 'unknown') {
    couldFlipIf.push('If "Direct" is airline checkout → may be worth it for easier changes/IRROPS');
  }
  
  if (recommendation !== 'eraser' && eraserBest) {
    couldFlipIf.push(`If you want guaranteed redemption → Eraser gives ${fmtUSD(eraserBest.cashSaved)} back at 1¢/mile`);
  }
  
  if (mileValueCpp !== C.DEFAULT_MILE_VALUE_CPP) {
    couldFlipIf.push(`At different mile valuations, winner may change`);
  }
  
  // ----------------------------
  // Calculate confidence level
  // ----------------------------
  let confidence: 'high' | 'medium' | 'low' = 'high';
  const confidenceReasons: string[] = [];
  
  if (!creditRemainingKnown) {
    confidence = 'low';
    confidenceReasons.push('Credit balance unknown');
  }
  
  if (directIsOTA === 'unknown') {
    if (confidence === 'high') confidence = 'medium';
    confidenceReasons.push('Direct seller type unknown');
  }
  
  if (creditBehavior === 'unknown' && portalCreditApplied > 0) {
    if (confidence === 'high') confidence = 'medium';
    confidenceReasons.push('Portal miles earning basis uncertain');
  }
  
  if (Math.abs(netEffectiveDiff) < 20) {
    if (confidence === 'high') confidence = 'medium';
    confidenceReasons.push('Net costs are very close');
  }
  
  if (confidenceReasons.length === 0) {
    confidenceReasons.push('All key inputs known');
  }
  
  // ----------------------------
  // Return (schema-compatible with new decision-grade fields)
  // ----------------------------
  return {
    recommendation,
    netSavings,

    portalDetails: {
      price: portalSticker,
      creditApplied: portalCreditApplied,
      outOfPocket: portalOutOfPocket,

      // conservative single number (min) to avoid overpromising
      milesEarned: portalMilesEarnedMin,
      milesValue: portalMilesValueMin,
      netEffectiveCost: portalNetWorst,

      // Range fields for richer UI display
      milesEarnedRange: { min: portalMilesEarnedMin, max: portalMilesEarnedMax },
      milesValueRange: { min: portalMilesValueMin, max: portalMilesValueMax },
      netEffectiveCostRange: { min: portalNetBest, max: portalNetWorst },
    },

    directDetails: {
      price: directSticker,
      creditApplied: 0,
      outOfPocket: directOutOfPocket,
      milesEarned: directMilesEarned,
      milesValue: directMilesValue,
      netEffectiveCost: directNet,
      isOTA: directIsOTA,
      sellerType: directIsOTA === true ? 'ota' : directIsOTA === false ? 'airline' : 'unknown',
    },

    eraserDetails,
    explanation,
    allStrategies: engineResult.allStrategies,
    breakEvenCpp,
    
    // New decision-grade context
    whyThisWon: {
      payToday: payTodayDetail,
      milesEarned: milesEarnedDetail,
      decisionTip,
    },
    
    assumptions,
    couldFlipIf,
    confidence,
    confidenceReasons,
    
    deltas: {
      stickerDiff,
      outOfPocketDiff,
      netEffectiveDiff,
      milesDiff: milesDiffConservative,
    },
    
    // ============================================
    // NEW: Research-based enhancements
    // ============================================
    
    // Double-dip recommendation (pay cash + earn miles, then erase later)
    doubleDipRecommendation: calculateDoubleDipRecommendation(
      portalSticker,
      directSticker,
      creditRemaining,
      milesBalance,
      mileValueCpp
    ),
    
    // Friction scores for each option
    frictionScores: {
      portal: calculateFrictionScore('PORTAL_PARITY'),
      direct: directIsOTA === true
        ? C.FRICTION_SCORES.DIRECT_OTA
        : directIsOTA === false
        ? C.FRICTION_SCORES.DIRECT_AIRLINE
        : (C.FRICTION_SCORES.DIRECT_AIRLINE + C.FRICTION_SCORES.DIRECT_OTA) / 2, // unknown = average
    },
    
    // Key thresholds from research
    thresholds: {
      eraserFloor: C.CPM_FLOOR * 100,      // 1.0¢ - Travel Eraser baseline
      goodDeal: C.CPM_GOOD_DEAL * 100,     // 1.3¢ - worth transferring
      excellent: C.TRANSFER_CPP_TARGET * 100, // 1.8¢+ - great value
    },
  };
}

// ============================================
// ENHANCED COMPARE WITH AWARD SUPPORT
// Extends simpleCompare with award option analysis
// ============================================

export interface EnhancedCompareInput extends SimpleCompareInput {
  /** Detected operating airline (for partner suggestions) */
  operatingAirline?: string;
  /** Award option if available */
  awardOption?: {
    partnerId: string;
    partnerName: string;
    milesRequired: number;
    taxesAndFees: number;
    cabin: string;
    availability: 'available' | 'waitlist' | 'unknown';
  };
}

export function enhancedCompare(input: EnhancedCompareInput): SimpleCompareOutput {
  // Get base comparison
  const baseResult = simpleCompare(input);
  
  // Add partner suggestions if airline is detected
  if (input.operatingAirline) {
    const suggestions = suggestPartnersForRoute(
      input.operatingAirline,
      undefined,
      undefined,
      'economy'
    );
    (baseResult as SimpleCompareOutput).partnerSuggestions = suggestions;
  }
  
  // Add award assessment if award option provided
  if (input.awardOption) {
    const { milesRequired, taxesAndFees } = input.awardOption;
    const cashPrice = input.directPriceUSD || input.portalPriceUSD;
    const cashEquivalent = cashPrice - taxesAndFees;
    const cpm = cashEquivalent > 0 ? cashEquivalent / milesRequired : 0;
    
    const frictionScore = calculateFrictionScore('TRANSFER_AWARD', {
      waitlist: input.awardOption.availability === 'waitlist',
    });
    
    const assessment = assessAwardValue(cpm, frictionScore);
    (baseResult as SimpleCompareOutput).awardAssessment = assessment;
    
    // Add award friction score
    baseResult.frictionScores.award = frictionScore;
    
    // Add award-specific warning to explanation
    if (assessment.warningMessage) {
      baseResult.explanation.push(assessment.warningMessage);
    }
    
    // Add to couldFlipIf
    if (!assessment.worthTransferring) {
      baseResult.couldFlipIf.push(
        `Award at ${(cpm * 100).toFixed(1)}¢/mile doesn't beat the friction. Consider Travel Eraser (1¢/mile) or portal instead.`
      );
    }
  }
  
  return baseResult;
}

// ============================================
// VERDICT WITH FRICTION-ADJUSTED SCORING
// Implements the "3-lane" decision framework from research
// ============================================

export type VerdictMode = 'cheapest' | 'max_value' | 'easiest';

export interface VerdictResult {
  winner: 'portal' | 'direct' | 'award' | 'eraser';
  mode: VerdictMode;
  score: number;
  frictionAdjustedScore: number;
  explanation: string;
  warnings: string[];
  
  // Per-option breakdown
  options: {
    portal?: {
      outOfPocket: number;
      milesEarned: number;
      effectiveCost: number;
      frictionScore: number;
    };
    direct?: {
      outOfPocket: number;
      milesEarned: number;
      effectiveCost: number;
      frictionScore: number;
    };
    award?: {
      taxes: number;
      milesRequired: number;
      cpm: number;
      frictionScore: number;
      assessment: ReturnType<typeof assessAwardValue>;
    };
    eraser?: {
      outOfPocket: number;
      milesUsed: number;
      frictionScore: number;
    };
  };
}

/**
 * Implements the "final verdict" principle from research:
 * 1. Portal is the default when user has credit and portal isn't much worse
 * 2. Award is only recommended when CPM > floor AND availability confirmed
 * 3. Direct is the "reliability play" for flexibility/IRROPS
 */
export function computeFinalVerdict(
  input: EnhancedCompareInput,
  mode: VerdictMode = 'max_value'
): VerdictResult {
  const comparison = enhancedCompare(input);
  
  const warnings: string[] = [];
  let winner: VerdictResult['winner'] = 'portal';
  let explanation = '';
  
  const portalFriction = comparison.frictionScores.portal;
  const directFriction = comparison.frictionScores.direct;
  const awardFriction = comparison.frictionScores.award;
  
  // Build options object
  const options: VerdictResult['options'] = {
    portal: {
      outOfPocket: comparison.portalDetails.outOfPocket,
      milesEarned: comparison.portalDetails.milesEarned,
      effectiveCost: comparison.portalDetails.netEffectiveCost,
      frictionScore: portalFriction,
    },
    direct: {
      outOfPocket: comparison.directDetails.outOfPocket,
      milesEarned: comparison.directDetails.milesEarned,
      effectiveCost: comparison.directDetails.netEffectiveCost,
      frictionScore: directFriction,
    },
  };
  
  if (comparison.eraserDetails) {
    options.eraser = {
      outOfPocket: comparison.eraserDetails.outOfPocket,
      milesUsed: comparison.eraserDetails.milesToSpend,
      frictionScore: calculateFrictionScore('DIRECT_ERASER'),
    };
  }
  
  if (comparison.awardAssessment && awardFriction !== undefined) {
    options.award = {
      taxes: input.awardOption?.taxesAndFees || 0,
      milesRequired: input.awardOption?.milesRequired || 0,
      cpm: comparison.awardAssessment.cpm,
      frictionScore: awardFriction,
      assessment: comparison.awardAssessment,
    };
  }
  
  // Apply mode-specific logic
  if (mode === 'cheapest') {
    // Pure out-of-pocket comparison
    const candidates = [
      { id: 'portal' as const, cost: options.portal?.outOfPocket ?? Infinity },
      { id: 'direct' as const, cost: options.direct?.outOfPocket ?? Infinity },
      { id: 'eraser' as const, cost: options.eraser?.outOfPocket ?? Infinity },
      { id: 'award' as const, cost: options.award?.taxes ?? Infinity },
    ].filter(c => c.cost < Infinity);
    
    candidates.sort((a, b) => a.cost - b.cost);
    winner = candidates[0]?.id ?? 'portal';
    explanation = `Cheapest today: ${winner.toUpperCase()} at $${candidates[0]?.cost.toFixed(0)}`;
    
  } else if (mode === 'easiest') {
    // Lowest friction wins (but with guardrails)
    const candidates = [
      { id: 'portal' as const, friction: portalFriction, cost: options.portal?.outOfPocket ?? Infinity },
      { id: 'direct' as const, friction: directFriction, cost: options.direct?.outOfPocket ?? Infinity },
    ];
    
    candidates.sort((a, b) => a.friction - b.friction);
    winner = candidates[0]?.id ?? 'direct';
    explanation = `Easiest: ${winner.toUpperCase()} (friction score: ${candidates[0]?.friction})`;
    
    // Warn if easiest is significantly more expensive
    const cheapest = Math.min(options.portal?.outOfPocket ?? Infinity, options.direct?.outOfPocket ?? Infinity);
    const winnerCost = candidates[0]?.cost ?? 0;
    if (winnerCost > cheapest * 1.15) {
      warnings.push(`Warning: Easiest option is ${((winnerCost / cheapest - 1) * 100).toFixed(0)}% more expensive`);
    }
    
  } else {
    // Max value: friction-adjusted effective cost
    // From research: require higher CPM to justify higher friction
    
    // Check award first (if available and worth it)
    if (options.award && comparison.awardAssessment?.worthTransferring) {
      const awardEffectiveCost = options.award.taxes;
      const portalEffective = options.portal?.effectiveCost ?? Infinity;
      const directEffective = options.direct?.effectiveCost ?? Infinity;
      
      // Award wins if it has good CPM and beats cash options
      if (awardEffectiveCost < Math.min(portalEffective, directEffective)) {
        winner = 'award';
        explanation = `Award wins at ${(options.award.cpm * 100).toFixed(1)}¢/mile (${comparison.awardAssessment.label})`;
      }
    }
    
    // If award didn't win, compare portal vs direct vs eraser
    if (winner !== 'award') {
      const portalEffective = options.portal?.effectiveCost ?? Infinity;
      const directEffective = options.direct?.effectiveCost ?? Infinity;
      const eraserEffective = comparison.eraserDetails?.netCost ?? Infinity;
      
      const candidates = [
        { id: 'portal' as const, cost: portalEffective },
        { id: 'direct' as const, cost: directEffective },
        { id: 'eraser' as const, cost: eraserEffective },
      ].filter(c => c.cost < Infinity);
      
      candidates.sort((a, b) => a.cost - b.cost);
      winner = candidates[0]?.id ?? 'portal';
      explanation = `Max value: ${winner.toUpperCase()} (effective cost: $${candidates[0]?.cost.toFixed(0)})`;
    }
    
    // Add award warning if it exists but wasn't recommended
    if (options.award && !comparison.awardAssessment?.worthTransferring) {
      warnings.push(comparison.awardAssessment?.warningMessage || 'Award value below threshold');
    }
  }
  
  // Add double-dip recommendation
  if (comparison.doubleDipRecommendation?.recommended) {
    explanation += ` | 💡 Double-dip: ${comparison.doubleDipRecommendation.explanation}`;
  }
  
  return {
    winner,
    mode,
    score: 0, // Could calculate a normalized score
    frictionAdjustedScore: 0,
    explanation,
    warnings,
    options,
  };
}

// ============================================
// STAYS COMPARISON ENGINE
// Compares hotel/vacation rental bookings between portal and direct
// Uses 10x (hotels) or 5x (vacation rentals) vs 2x direct
// ============================================

export interface StayCompareInput {
  /** Portal total price in USD */
  portalPriceUSD: number;
  /** Direct total price in USD */
  directPriceUSD: number;
  /** Taxes/fees from portal (if broken out) */
  portalTaxesFees?: number;
  /** Taxes/fees from direct (if broken out) */
  directTaxesFees?: number;
  /** Type of accommodation (affects portal earn rate) */
  accommodationType?: AccommodationType;
  /** User's miles balance */
  milesBalance?: number;
  /** User's remaining $300 credit */
  creditRemaining?: number;
  /** User's mile valuation in cpp (e.g., 0.018 for 1.8¢) */
  mileValuationCpp?: number;
  /** Whether credit is already reflected in portal price */
  creditDetectedInPrice?: boolean;
  /** User's objective */
  objective?: 'cheapest_cash' | 'max_value' | 'easiest';
  /** Number of nights (for display) */
  nights?: number;
  /** Property name (for display) */
  propertyName?: string;
  /** Location (for display) */
  location?: string;
  /** Check-in date (for display) */
  checkIn?: string;
  /** Check-out date (for display) */
  checkOut?: string;
  /** Confidence in direct price match */
  directConfidence?: 'high' | 'medium' | 'low';
}

export interface StayCompareOutput {
  recommendation: 'portal' | 'direct' | 'eraser';
  netSavings: number;
  bookingType: 'stay';
  
  portalDetails: {
    price: number;
    taxesFees?: number;
    creditApplied: number;
    outOfPocket: number;
    milesEarned: number;
    milesValue: number;
    netEffectiveCost: number;
    earnRate: number;
    earnRateLabel: string;
  };
  
  directDetails: {
    price: number;
    taxesFees?: number;
    outOfPocket: number;
    milesEarned: number;
    milesValue: number;
    netEffectiveCost: number;
    confidence: 'high' | 'medium' | 'low';
  };
  
  eraserDetails?: {
    milesToSpend: number;
    cashSaved: number;
    outOfPocket: number;
    netCost: number;
  };
  
  /** "Why this won" - 3 bullet points explaining the decision */
  whyThisWon: {
    payToday: string;
    milesEarned: string;
    decisionTip: string;
  };
  
  /** Explicit assumptions used in the calculation */
  assumptions: {
    label: string;
    value: string;
    editable?: boolean;
  }[];
  
  /** What could change the answer - decision flip conditions */
  couldFlipIf: string[];
  
  /** Confidence level based on known vs unknown inputs */
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  
  /** Difference metrics */
  deltas: {
    stickerDiff: number;
    outOfPocketDiff: number;
    netEffectiveDiff: number;
    milesDiff: number;
  };
  
  /** Display context */
  displayContext: {
    propertyName?: string;
    location?: string;
    checkIn?: string;
    checkOut?: string;
    nights?: number;
    accommodationType: AccommodationType;
  };
  
  explanation: string[];
  
  /** Warning for stays: portal booking may not earn hotel elite benefits */
  staysWarnings: string[];
}

/**
 * Compare stay booking options: Portal (10x/5x) vs Direct (2x)
 *
 * Key differences from flight comparison:
 * - Hotels earn 10x, vacation rentals earn 5x on portal
 * - Direct always earns 2x (no airline benefits to consider)
 * - Portal bookings typically don't earn hotel loyalty points/status
 */
export function simpleStayCompare(input: StayCompareInput): StayCompareOutput {
  // Helpers
  const clamp0 = (n: number) => Math.max(0, Number.isFinite(n) ? n : 0);
  const roundMiles = (n: number) => Math.max(0, Math.round(n));
  const fmtUSD = (n: number) => `$${clamp0(n).toFixed(0)}`;
  const fmtMiles = (n: number) => roundMiles(n).toLocaleString();
  
  // Objective
  const objective = input.objective ?? 'max_value';
  
  // Core constants
  const mileValueCpp = input.mileValuationCpp ?? C.DEFAULT_MILE_VALUE_CPP;
  const accommodationType = input.accommodationType ?? 'hotel';
  
  // Determine portal earn rate based on accommodation type
  const portalEarnRate = getStayPortalRate(accommodationType);
  const portalEarnRateLabel = accommodationType === 'vacation_rental'
    ? '5x (Vacation Rental)'
    : '10x (Hotel)';
  
  // Prices
  const portalSticker = clamp0(input.portalPriceUSD);
  const directSticker = clamp0(input.directPriceUSD);
  
  // Credit
  const creditRemainingKnown = typeof input.creditRemaining === 'number';
  const creditRemaining = creditRemainingKnown ? clamp0(input.creditRemaining!) : 0;
  const creditDetectedInPrice = input.creditDetectedInPrice ?? false;
  const creditEligible = !creditDetectedInPrice && creditRemaining > 0;
  const portalCreditApplied = creditEligible ? Math.min(creditRemaining, portalSticker) : 0;
  const portalOutOfPocket = clamp0(portalSticker - portalCreditApplied);
  
  // Miles earned
  const portalMilesEarned = roundMiles(portalSticker * portalEarnRate);
  const directMilesEarned = roundMiles(directSticker * C.BASE_RATE);
  
  // Miles value
  const portalMilesValue = portalMilesEarned * mileValueCpp;
  const directMilesValue = directMilesEarned * mileValueCpp;
  
  // Net effective cost
  const portalNet = portalOutOfPocket - portalMilesValue;
  const directOutOfPocket = directSticker;
  const directNet = directOutOfPocket - directMilesValue;
  
  // Eraser strategy
  const milesBalance = clamp0(input.milesBalance ?? 0);
  const eraserAvailable = milesBalance >= C.ERASER_MIN_MILES;
  
  let eraserDetails: StayCompareOutput['eraserDetails'] | undefined;
  if (eraserAvailable) {
    const milesNeeded = Math.floor(directOutOfPocket / C.ERASER_CPP);
    const milesToSpend = Math.min(milesNeeded, milesBalance);
    
    if (milesToSpend >= C.ERASER_MIN_MILES) {
      const cashSaved = milesToSpend * C.ERASER_CPP;
      const eraserOutOfPocket = clamp0(directOutOfPocket - cashSaved);
      const earnedValue = directMilesEarned * mileValueCpp;
      const spentOppCost = milesToSpend * mileValueCpp;
      const eraserNetCost = eraserOutOfPocket - earnedValue + spentOppCost;
      
      eraserDetails = {
        milesToSpend,
        cashSaved,
        outOfPocket: eraserOutOfPocket,
        netCost: eraserNetCost,
      };
    }
  }
  
  // Determine winner
  const cheapestCashWinner = portalOutOfPocket <= directOutOfPocket ? 'portal' : 'direct';
  let maxValueWinner: 'portal' | 'direct' | 'eraser' = portalNet < directNet ? 'portal' : 'direct';
  
  if (eraserDetails && eraserDetails.netCost < Math.min(portalNet, directNet)) {
    maxValueWinner = 'eraser';
  }
  
  const recommendation: 'portal' | 'direct' | 'eraser' =
    objective === 'cheapest_cash' ? cheapestCashWinner :
    objective === 'easiest' ? 'direct' : // For stays, direct = hotel site is usually "easiest" for loyalty
    maxValueWinner;
  
  // Net savings
  const netSavings = Math.max(0, Math.abs(portalNet - directNet));
  
  // Deltas
  const stickerDiff = portalSticker - directSticker;
  const outOfPocketDiff = portalOutOfPocket - directOutOfPocket;
  const netEffectiveDiff = portalNet - directNet;
  const milesDiff = portalMilesEarned - directMilesEarned;
  
  // Why this won
  const savingsToday = Math.abs(outOfPocketDiff);
  const payTodayDetail = recommendation === 'portal'
    ? `Portal: ${fmtUSD(portalOutOfPocket)} vs Direct: ${fmtUSD(directOutOfPocket)}${outOfPocketDiff < 0 ? ` (save ${fmtUSD(savingsToday)} today)` : ''}`
    : recommendation === 'direct'
    ? `Direct: ${fmtUSD(directOutOfPocket)} vs Portal: ${fmtUSD(portalOutOfPocket)}${outOfPocketDiff > 0 ? ` (save ${fmtUSD(savingsToday)} today)` : ''}`
    : `Eraser: ${fmtUSD(eraserDetails?.outOfPocket ?? 0)} out-of-pocket`;
  
  const milesEarnedDetail = milesDiff > 0
    ? `+${fmtMiles(milesDiff)} more miles on Portal (${portalEarnRateLabel} vs 2x)`
    : milesDiff < 0
    ? `+${fmtMiles(Math.abs(milesDiff))} more miles on Direct`
    : `Same miles earned`;
  
  let decisionTip: string;
  if (recommendation === 'portal') {
    decisionTip = '⚠️ Note: Portal booking may not earn hotel loyalty points/elite nights';
  } else if (recommendation === 'direct') {
    decisionTip = '✓ Direct booking: earn hotel loyalty points + potential elite benefits';
  } else {
    decisionTip = 'Consider: Eraser uses miles at 1¢—transfer partners often give 1.5-2¢+';
  }
  
  // Assumptions
  const assumptions: StayCompareOutput['assumptions'] = [];
  
  if (creditRemainingKnown) {
    assumptions.push({
      label: 'Travel credit remaining',
      value: `$${creditRemaining}`,
      editable: true,
    });
  } else {
    assumptions.push({
      label: 'Travel credit',
      value: 'Unknown (treated as $0)',
      editable: true,
    });
  }
  
  assumptions.push({
    label: 'Miles valued at',
    value: `${(mileValueCpp * 100).toFixed(1)}¢/mile`,
    editable: true,
  });
  
  assumptions.push({
    label: 'Accommodation type',
    value: accommodationType === 'vacation_rental' ? 'Vacation Rental (5x)' : 'Hotel (10x)',
    editable: false,
  });
  
  // Could flip if
  const couldFlipIf: string[] = [];
  
  if (recommendation === 'portal' && creditRemainingKnown && creditRemaining > 0) {
    couldFlipIf.push(`If credit is already used → Direct likely wins`);
  }
  
  if (recommendation === 'portal') {
    couldFlipIf.push('If you value hotel loyalty/elite status → Direct wins');
  }
  
  if (recommendation === 'direct' && portalCreditApplied > 0) {
    couldFlipIf.push(`If you prioritize miles over hotel loyalty → Portal wins (+${fmtMiles(milesDiff)} more miles)`);
  }
  
  if (recommendation !== 'eraser' && eraserDetails) {
    couldFlipIf.push(`If you want to use existing miles → Eraser saves ${fmtUSD(eraserDetails.cashSaved)}`);
  }
  
  // Confidence
  let confidence: 'high' | 'medium' | 'low' = input.directConfidence ?? 'high';
  const confidenceReasons: string[] = [];
  
  if (!creditRemainingKnown) {
    confidence = 'low';
    confidenceReasons.push('Credit balance unknown');
  }
  
  if (input.directConfidence === 'low') {
    confidence = 'low';
    confidenceReasons.push('Direct price match confidence is low - verify property');
  } else if (input.directConfidence === 'medium') {
    if (confidence === 'high') confidence = 'medium';
    confidenceReasons.push('Direct price match should be verified');
  }
  
  if (Math.abs(netEffectiveDiff) < 20) {
    if (confidence === 'high') confidence = 'medium';
    confidenceReasons.push('Net costs are very close');
  }
  
  if (confidenceReasons.length === 0) {
    confidenceReasons.push('All key inputs known');
  }
  
  // Explanation
  const explanation: string[] = [];
  explanation.push(
    objective === 'cheapest_cash'
      ? `Cheapest cash today: ${cheapestCashWinner.toUpperCase()}`
      : objective === 'easiest'
      ? `Best for hotel loyalty: DIRECT`
      : `Max value (miles-adjusted): ${maxValueWinner.toUpperCase()}`
  );
  
  explanation.push(
    `Portal: ${fmtUSD(portalSticker)} − ${fmtUSD(portalCreditApplied)} credit = ${fmtUSD(portalOutOfPocket)} out of pocket`
  );
  explanation.push(`Direct: ${fmtUSD(directSticker)} out of pocket`);
  
  explanation.push(
    `Portal miles: ${fmtMiles(portalMilesEarned)} (${portalEarnRateLabel}) | Direct miles: ${fmtMiles(directMilesEarned)} (2x)`
  );
  
  explanation.push(
    `At ${(mileValueCpp * 100).toFixed(1)}¢/mile → Portal net: ${fmtUSD(portalNet)} | Direct net: ${fmtUSD(directNet)}`
  );
  
  // Stays-specific warnings
  const staysWarnings: string[] = [];
  
  staysWarnings.push('⚠️ Portal bookings may not earn hotel loyalty points or elite night credits');
  
  if (accommodationType === 'vacation_rental') {
    staysWarnings.push('ℹ️ Vacation rentals earn 5x miles (hotels earn 10x)');
  }
  
  if (recommendation === 'portal') {
    staysWarnings.push('💡 If hotel status matters, consider booking direct even at higher net cost');
  }
  
  return {
    recommendation,
    netSavings,
    bookingType: 'stay',
    
    portalDetails: {
      price: portalSticker,
      taxesFees: input.portalTaxesFees,
      creditApplied: portalCreditApplied,
      outOfPocket: portalOutOfPocket,
      milesEarned: portalMilesEarned,
      milesValue: portalMilesValue,
      netEffectiveCost: portalNet,
      earnRate: portalEarnRate,
      earnRateLabel: portalEarnRateLabel,
    },
    
    directDetails: {
      price: directSticker,
      taxesFees: input.directTaxesFees,
      outOfPocket: directOutOfPocket,
      milesEarned: directMilesEarned,
      milesValue: directMilesValue,
      netEffectiveCost: directNet,
      confidence: input.directConfidence ?? 'high',
    },
    
    eraserDetails,
    
    whyThisWon: {
      payToday: payTodayDetail,
      milesEarned: milesEarnedDetail,
      decisionTip,
    },
    
    assumptions,
    couldFlipIf,
    confidence,
    confidenceReasons,
    
    deltas: {
      stickerDiff,
      outOfPocketDiff,
      netEffectiveDiff,
      milesDiff,
    },
    
    displayContext: {
      propertyName: input.propertyName,
      location: input.location,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: input.nights,
      accommodationType,
    },
    
    explanation,
    staysWarnings,
  };
}

/**
 * Build a Google Hotels search URL from stay context
 */
export function buildGoogleHotelsSearchUrl(params: {
  location: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  rooms?: number;
  propertyName?: string;
}): string {
  const { location, checkIn, checkOut, adults = 2, rooms = 1, propertyName } = params;
  
  // Format dates as YYYY-MM-DD
  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  };
  
  // Build query - include property name if available for better matching
  const query = propertyName
    ? `${propertyName} ${location}`
    : location;
  
  const baseUrl = 'https://www.google.com/travel/hotels';
  const searchParams = new URLSearchParams({
    q: query,
    g2lb: '2502548', // Google's internal param for hotel search
    hl: 'en',
    gl: 'us',
    un: '1',
    ap: 'MABoAQ', // Always show availability
  });
  
  // Add dates
  // Google uses a specific format for dates in hotels
  const checkinFormatted = formatDate(checkIn);
  const checkoutFormatted = formatDate(checkOut);
  
  return `${baseUrl}?${searchParams.toString()}&dates=${checkinFormatted}_${checkoutFormatted}&adults=${adults}&rooms=${rooms}`;
}
