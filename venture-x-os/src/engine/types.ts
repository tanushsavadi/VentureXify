// ============================================
// STRATEGY ENGINE TYPES
// Defines the input/output structures for the deterministic strategy engine
// Supports both Flights and Stays (Hotels/Vacation Rentals)
// ============================================

import { TransferPartner } from './transferPartners';

// ============================================
// BOOKING TYPE
// ============================================

export type BookingType = 'flight' | 'stay';

export type AccommodationType = 'hotel' | 'vacation_rental' | 'unknown';

// ============================================
// INPUT TYPES - FLIGHTS
// ============================================

export interface FlightItinerary {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  passengers: number;
  isRoundTrip: boolean;
  airline?: string;
  stops?: number;
}

// ============================================
// INPUT TYPES - STAYS
// ============================================

export interface StayItinerary {
  location: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  rooms: number;
  children?: number;
  pets?: boolean;
  propertyName?: string;
  propertyType?: AccommodationType;
  roomType?: string;
  starRating?: number;
  refundable?: boolean;
  mealPlan?: string;
}

export interface PriceQuote {
  amount: number;
  currency: string;
  amountUSD: number;
}

export interface PortalQuote extends PriceQuote {
  milesRate: number;           // e.g., 5 for 5x
  priceProtectionAvailable?: boolean;
  priceProtectionDetails?: string;
}

export interface DirectQuote extends PriceQuote {
  siteName: string;            // e.g., "Airline Website", "Google Flights"
  fareClass?: string;          // e.g., "Basic Economy", "Main Cabin"
}

export interface AwardOption {
  partnerId: string;
  partnerName: string;
  milesRequired: number;       // miles needed for the award
  taxesAndFees: number;        // USD
  cabin: string;
  availability: 'available' | 'waitlist' | 'unknown';
  notes?: string;
}

// ============================================
// STAYS-SPECIFIC QUOTE TYPES
// ============================================

export interface StayPortalQuote extends PortalQuote {
  /** Tax amount if broken out */
  taxesFees?: number;
  /** Per-night rate if available */
  perNightRate?: number;
  /** Number of nights */
  nights?: number;
  /** Miles equivalent shown by portal (informational) */
  milesEquivalent?: number;
  /** Property type for rate determination */
  accommodationType?: AccommodationType;
}

export interface StayDirectQuote extends DirectQuote {
  /** Provider name (e.g., Booking.com, Marriott) */
  provider?: string;
  /** Per-night rate if available */
  perNightRate?: number;
  /** Tax amount if broken out */
  taxesFees?: number;
  /** Confidence level of the capture */
  confidence?: 'high' | 'medium' | 'low';
  /** Property name for matching */
  propertyName?: string;
}

// ============================================
// GENERIC QUOTES INPUT (supports both flights & stays)
// ============================================

export interface QuotesInput {
  portal?: PortalQuote;
  direct?: DirectQuote;
  awardOptions?: AwardOption[];
}

export interface StayQuotesInput {
  portal?: StayPortalQuote;
  direct?: StayDirectQuote;
}

export interface UserContext {
  milesBalance?: number;
  creditRemaining?: number;      // $300 travel credit
  wantsLowHassle?: boolean;
  prefersPremiumCabin?: boolean;
  flexibleDates?: boolean;
  savingMilesForTrip?: boolean;  // user wants to preserve miles
  /** Apply travel credit to this booking (default: true if credit available) */
  applyCredit?: boolean;
}

// ============================================
// STRATEGY INPUT (supports both flights & stays)
// ============================================

export interface StrategyInput {
  itinerary: FlightItinerary;
  quotes: QuotesInput;
  userContext: UserContext;
  bookingType?: BookingType;
}

export interface StayStrategyInput {
  itinerary: StayItinerary;
  quotes: StayQuotesInput;
  userContext: UserContext;
  bookingType: 'stay';
}

/** Unified input type for strategy engine */
export type UnifiedStrategyInput = StrategyInput | StayStrategyInput;

/** Helper to check if input is for stays */
export function isStayInput(input: UnifiedStrategyInput): input is StayStrategyInput {
  return input.bookingType === 'stay' || 'checkIn' in input.itinerary;
}

// ============================================
// OUTPUT TYPES
// ============================================

export type StrategyId = 
  | 'PORTAL_PARITY'           // Strategy A: Portal at parity
  | 'PORTAL_PROTECTED'        // Strategy B: Portal with price protection
  | 'DIRECT_CASH'             // Strategy C: Direct cash booking
  | 'DIRECT_ERASER'           // Strategy D: Direct + Travel Eraser
  | 'TRANSFER_AWARD'          // Strategy E: Transfer to partner (award)
  | 'HYBRID_AWARD_ERASER';    // Strategy F: Award + erase taxes

export type RankingMode = 
  | 'cheapest_cash'           // Minimize out-of-pocket today
  | 'max_value'               // Maximize cents per mile
  | 'least_hassle';           // Simplest booking process

export interface StrategyResult {
  id: StrategyId;
  name: string;
  description: string;
  
  // Financial outcomes
  netCashCost: number;         // Final out-of-pocket in USD
  milesEarned: number;         // Miles earned from this booking
  milesSpent: number;          // Miles used (Eraser or award)
  cppRealized: number;         // Cents per point realized (0 if no miles spent)
  
  // For award bookings
  partnerUsed?: string;
  awardTaxes?: number;
  
  // Evaluation
  pros: string[];
  cons: string[];
  
  // Ranking score (higher = better for the chosen mode)
  score: number;
  
  // Is this strategy available given inputs?
  available: boolean;
  unavailableReason?: string;
}

export interface StrategyEngineOutput {
  rankingMode: RankingMode;
  topStrategy: StrategyResult;
  allStrategies: StrategyResult[];
  
  // Summary for LLM
  summary: {
    winner: string;
    savingsVsWorst: number;
    keyInsight: string;
  };
  
  // Clarifying questions LLM should ask
  suggestedQuestions: string[];
}

// ============================================
// CONSTANTS
// ============================================

export const VENTURE_X_CONSTANTS = {
  // Earn rates - Flights
  PORTAL_FLIGHTS_RATE: 5,          // 5x on flights via Capital One Travel
  
  // Earn rates - Stays (Hotels/Vacation Rentals)
  PORTAL_HOTELS_RATE: 10,          // 10x on hotels via Capital One Travel
  PORTAL_VACATION_RENTALS_RATE: 5, // 5x on vacation rentals via Capital One Travel
  
  // Earn rates - Other
  PORTAL_CARS_RATE: 10,            // 10x on rental cars via Capital One Travel
  BASE_RATE: 2,                    // 2x on everything else (including direct hotel bookings)
  
  // Travel credit - PORTAL ONLY! Do NOT apply to direct bookings.
  ANNUAL_TRAVEL_CREDIT: 300,       // $300 per year - ONLY for Capital One Travel portal
  CREDIT_PORTAL_ONLY: true,        // CRITICAL: Credit only works for portal bookings
  
  // Anniversary bonus
  ANNIVERSARY_MILES: 10000,        // 10,000 miles per year
  
  // Travel Eraser
  // Rate: 1 cent per mile = $0.01 per mile = 100 miles per $1
  ERASER_CPP: 0.01,                // 1 cent per mile
  ERASER_MILES_PER_DOLLAR: 100,    // 100 miles = $1 (e.g., $809 needs 80,900 miles)
  ERASER_MIN_MILES: 5000,          // Minimum 5,000 miles ($50)
  ERASER_WINDOW_DAYS: 90,          // 90 days to erase
  
  // ============================================
  // CPM THRESHOLDS (from research)
  // These define when award redemptions are "worth it"
  // ============================================
  
  // The baseline floor: Travel Eraser / portal redemption
  // Any transfer strategy should beat this or it's not worth the effort
  CPM_FLOOR: 0.01,                 // 1.0¢/mile - the "don't do worse than this" baseline
  
  // Good deal threshold: worth transferring for
  CPM_GOOD_DEAL: 0.013,            // 1.3¢/mile - minimum for "worth transferring"
  CPM_VERY_GOOD: 0.015,            // 1.5¢/mile - clearly worth the effort
  
  // Valuation benchmarks (existing, but contextualized)
  TRANSFER_CPP_TARGET: 0.018,      // 1.8¢/mile is a good transfer value
  TRANSFER_CPP_EXCELLENT: 0.025,   // 2.5¢/mile is excellent
  DEFAULT_MILE_VALUE_CPP: 0.018,   // Default valuation for miles (1.8¢)
  
  // Award value tiers for UI display
  AWARD_VALUE_TIERS: {
    BELOW_FLOOR: { max: 0.01, label: 'Below baseline', color: 'red' },
    FLOOR_TO_GOOD: { min: 0.01, max: 0.013, label: 'Meets baseline', color: 'yellow' },
    GOOD: { min: 0.013, max: 0.018, label: 'Good value', color: 'green' },
    EXCELLENT: { min: 0.018, max: 0.025, label: 'Great value', color: 'blue' },
    OUTSTANDING: { min: 0.025, label: 'Outstanding', color: 'purple' },
  },
  
  // Portal premium threshold
  PORTAL_PREMIUM_THRESHOLD: 0.07,  // Portal is worth it if within 7% of direct
  
  // ============================================
  // FRICTION SCORING (from research)
  // Higher score = more friction/hassle
  // Used to require higher CPM for higher friction options
  // ============================================
  
  FRICTION_SCORES: {
    // Direct airline booking = lowest friction
    DIRECT_AIRLINE: 10,            // Simple, airline handles IRROPS
    
    // Portal booking = medium friction
    PORTAL_BOOKING: 30,            // Extra layer for changes, but still manageable
    
    // OTA booking = higher friction
    DIRECT_OTA: 50,                // May need to contact OTA for issues
    
    // Award via transfer = highest friction
    TRANSFER_AWARD: 70,            // Transfer irreversible, award space can disappear
    
    // Hybrid strategies = very high friction
    HYBRID_AWARD_ERASER: 90,       // Most complex
  },
  
  // Friction modifiers (add to base score)
  FRICTION_MODIFIERS: {
    TRANSFER_TIME_UNKNOWN: 10,     // If transfer isn't instant
    PHONE_BOOKING_REQUIRED: 15,    // If you need to call to book
    CLOSE_IN_FEE: 5,               // Close-in booking fees
    WAITLIST: 20,                  // Award on waitlist
    COMPLEX_ROUTING: 10,           // Multi-stop itineraries
    PARTNER_BOOKING_UX: 10,        // Partner site reliability issues
  },
  
  // CPM premium required per friction point (above baseline)
  // e.g., if friction=70, require (70-10)*0.0001 = 0.006 cpp extra
  CPM_PER_FRICTION_POINT: 0.0001,  // 0.01¢ per friction point
  
  // Risk/hassle penalties for rankings (dollar amounts)
  PORTAL_CHANGE_RISK_PENALTY: 25,  // $25 hassle factor for OTA rebooking friction
  TRANSFER_IRREVERSIBILITY_PENALTY: 50, // $50 penalty for one-way transfers
};

// ============================================
// FRICTION CALCULATION HELPER
// ============================================

export function calculateFrictionScore(
  strategy: StrategyId,
  modifiers: {
    transferTimeUnknown?: boolean;
    phoneBookingRequired?: boolean;
    closeInFee?: boolean;
    waitlist?: boolean;
    complexRouting?: boolean;
    partnerBookingUx?: boolean;
  } = {}
): number {
  const C = VENTURE_X_CONSTANTS;
  
  // Base friction by strategy
  const baseScores: Record<StrategyId, number> = {
    PORTAL_PARITY: C.FRICTION_SCORES.PORTAL_BOOKING,
    PORTAL_PROTECTED: C.FRICTION_SCORES.PORTAL_BOOKING,
    DIRECT_CASH: C.FRICTION_SCORES.DIRECT_AIRLINE, // Assume airline unless OTA detected
    DIRECT_ERASER: C.FRICTION_SCORES.DIRECT_AIRLINE + 10, // Extra step to erase
    TRANSFER_AWARD: C.FRICTION_SCORES.TRANSFER_AWARD,
    HYBRID_AWARD_ERASER: C.FRICTION_SCORES.HYBRID_AWARD_ERASER,
  };
  
  let score = baseScores[strategy] || 50;
  
  // Add modifiers
  if (modifiers.transferTimeUnknown) score += C.FRICTION_MODIFIERS.TRANSFER_TIME_UNKNOWN;
  if (modifiers.phoneBookingRequired) score += C.FRICTION_MODIFIERS.PHONE_BOOKING_REQUIRED;
  if (modifiers.closeInFee) score += C.FRICTION_MODIFIERS.CLOSE_IN_FEE;
  if (modifiers.waitlist) score += C.FRICTION_MODIFIERS.WAITLIST;
  if (modifiers.complexRouting) score += C.FRICTION_MODIFIERS.COMPLEX_ROUTING;
  if (modifiers.partnerBookingUx) score += C.FRICTION_MODIFIERS.PARTNER_BOOKING_UX;
  
  return score;
}

// ============================================
// CPM REQUIREMENT BASED ON FRICTION
// ============================================

export function getMinimumCpmForFriction(frictionScore: number): number {
  const C = VENTURE_X_CONSTANTS;
  
  // Base = floor (1.0¢)
  // Add premium based on friction above baseline (10)
  const frictionAboveBaseline = Math.max(0, frictionScore - C.FRICTION_SCORES.DIRECT_AIRLINE);
  const premium = frictionAboveBaseline * C.CPM_PER_FRICTION_POINT;
  
  return C.CPM_FLOOR + premium;
}

// ============================================
// AWARD VALUE ASSESSMENT
// ============================================

export interface AwardValueAssessment {
  cpm: number;
  tier: 'below_floor' | 'floor_to_good' | 'good' | 'excellent' | 'outstanding';
  label: string;
  color: string;
  worthTransferring: boolean;
  warningMessage?: string;
}

export function assessAwardValue(cpm: number, frictionScore: number = 70): AwardValueAssessment {
  const C = VENTURE_X_CONSTANTS;
  const minRequiredCpm = getMinimumCpmForFriction(frictionScore);
  
  let tier: AwardValueAssessment['tier'];
  let label: string;
  let color: string;
  
  if (cpm < C.CPM_FLOOR) {
    tier = 'below_floor';
    label = 'Below Travel Eraser baseline';
    color = 'red';
  } else if (cpm < C.CPM_GOOD_DEAL) {
    tier = 'floor_to_good';
    label = 'Meets baseline, marginal value';
    color = 'yellow';
  } else if (cpm < C.TRANSFER_CPP_TARGET) {
    tier = 'good';
    label = 'Good value';
    color = 'green';
  } else if (cpm < C.TRANSFER_CPP_EXCELLENT) {
    tier = 'excellent';
    label = 'Great value';
    color = 'blue';
  } else {
    tier = 'outstanding';
    label = 'Outstanding value';
    color = 'purple';
  }
  
  const worthTransferring = cpm >= minRequiredCpm;
  
  let warningMessage: string | undefined;
  if (cpm < C.CPM_FLOOR) {
    warningMessage = `⚠️ At ${(cpm * 100).toFixed(2)}¢/mile, you're getting less than Travel Eraser (1¢/mile). Just pay cash and erase later.`;
  } else if (!worthTransferring) {
    warningMessage = `⚠️ Value (${(cpm * 100).toFixed(2)}¢/mile) doesn't justify the friction. Need ≥${(minRequiredCpm * 100).toFixed(2)}¢/mile for this option.`;
  }
  
  return {
    cpm,
    tier,
    label,
    color,
    worthTransferring,
    warningMessage,
  };
}

// ============================================
// HELPER TYPES
// ============================================

export interface MilesCalculation {
  earned: number;
  spent: number;
  netChange: number;
  cpp?: number;
}

export interface CostBreakdown {
  basePrice: number;
  creditApplied: number;
  eraserApplied: number;
  netCash: number;
}
