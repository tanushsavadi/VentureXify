import {
  PortalDirectInput,
  PortalDirectComparison,
  RedemptionInput,
  RedemptionOutput,
  PriceMatchInput,
  PriceMatchOutput,
  DecisionCard,
  ConfidenceLevel,
  VENTURE_X_CONSTANTS,
  BookingType,
  getPortalMultiplier,
  getBaseMultiplier,
  getPortalMultiplierLabel,
} from './types';
import { generateId } from './storage';

// ============================================
// PORTAL VS DIRECT CALCULATOR
// ============================================

/**
 * Calculate points earned for a given purchase.
 *
 * IMPORTANT: This function now correctly uses booking type to determine
 * the portal multiplier (10x for hotels/cars, 5x for flights/vacation rentals).
 *
 * @param amount - The booking amount in dollars
 * @param isPortal - Whether booking through Capital One Travel portal
 * @param bookingType - The type of booking (hotel, flight, rental, other)
 * @returns The number of miles earned
 */
export function calculatePointsEarned(
  amount: number,
  isPortal: boolean,
  bookingType: BookingType
): number {
  // Use the single source of truth for multipliers
  const multiplier = isPortal
    ? getPortalMultiplier(bookingType)  // 10x for hotels/cars, 5x for flights
    : getBaseMultiplier();               // Always 2x for direct

  // Round to nearest dollar for points calculation
  return Math.floor(amount) * multiplier;
}

/**
 * Calculate the monetary value of points
 */
export function calculatePointsValue(points: number, valuationCents: number): number {
  return (points * valuationCents) / 100;
}

/**
 * Main Portal vs Direct comparison
 */
export function calculatePortalVsDirect(input: PortalDirectInput): PortalDirectComparison {
  const { directPrice, portalPrice, bookingType, milesValuation, caresAboutStatus } = input;

  // Calculate points earned each way
  const pointsEarnedDirect = calculatePointsEarned(directPrice, false, bookingType);
  const pointsEarnedPortal = calculatePointsEarned(portalPrice, true, bookingType);

  // Calculate value of points
  const valueDirect = calculatePointsValue(pointsEarnedDirect, milesValuation);
  const valuePortal = calculatePointsValue(pointsEarnedPortal, milesValuation);

  // Status adjustment: if user cares about status, add ~$10-30 value for direct booking
  // (airline/hotel status earning, elite nights, etc.)
  const statusAdjustment = caresAboutStatus && bookingType !== 'other' ? 15 : 0;

  // Net value calculation
  // Direct: pay directPrice, get valueDirect + statusAdjustment
  // Portal: pay portalPrice, get valuePortal
  const netDirect = valueDirect + statusAdjustment - directPrice;
  const netPortal = valuePortal - portalPrice;

  const netDifference = netDirect - netPortal;

  // Determine winner
  let winner: 'direct' | 'portal' | 'tie';
  if (Math.abs(netDifference) < 1) {
    winner = 'tie';
  } else if (netDifference > 0) {
    winner = 'direct';
  } else {
    winner = 'portal';
  }

  // Calculate break-even premium
  // How much more can portal cost before it's no longer worth it?
  // At break-even: netDirect = netPortal(breakEvenPrice)
  //
  // netDirect = directPrice * baseMultiplier * v - directPrice + statusAdjustment
  // netPortal(P) = P * portalMultiplier * v - P
  //
  // where v = milesValuation / 100
  //
  // Setting equal and solving for breakEvenPrice:
  // breakEvenPrice = (directPrice * (baseMultiplier * v - 1) + statusAdjustment) / (portalMultiplier * v - 1)
  //
  // breakEvenPremium = breakEvenPrice - directPrice
  const portalMultiplier = getPortalMultiplier(bookingType);
  const v = milesValuation / 100;
  const directNetPerDollar = VENTURE_X_CONSTANTS.BASE_MULTIPLIER * v - 1;
  const portalNetPerDollar = portalMultiplier * v - 1;
  
  // Calculate break-even portal price
  // Note: portalNetPerDollar is typically negative (e.g., 10 * 0.017 - 1 = -0.83)
  // This means higher prices result in lower net value, which is correct
  const breakEvenPrice = portalNetPerDollar !== 0
    ? (directPrice * directNetPerDollar + statusAdjustment) / portalNetPerDollar
    : directPrice; // Fallback if division would be by zero
  
  const breakEvenPremium = breakEvenPrice - directPrice;

  return {
    directPrice: {
      amount: directPrice,
      currency: 'USD',
      source: 'manual',
      isTotal: true,
      confidence: 'HIGH',
    },
    portalPrice: {
      amount: portalPrice,
      currency: 'USD',
      source: 'manual',
      isTotal: true,
      confidence: 'HIGH',
    },
    bookingType,
    pointsEarnedDirect,
    pointsEarnedPortal,
    valueDirect,
    valuePortal,
    netDifference: Math.abs(netDifference),
    winner,
    breakEvenPremium: Math.max(0, breakEvenPremium),
  };
}

/**
 * Generate a Portal vs Direct decision card
 */
export function createPortalDirectDecisionCard(
  comparison: PortalDirectComparison,
  milesValuation: number,
  caresAboutStatus: boolean
): DecisionCard {
  const { winner, netDifference, breakEvenPremium, pointsEarnedDirect, pointsEarnedPortal, bookingType } =
    comparison;

  const winnerLabel = winner === 'direct' ? 'Book Direct' : winner === 'portal' ? 'Use Portal' : 'Either Works';
  const summary =
    winner === 'tie'
      ? 'Both options are roughly equal'
      : `${winnerLabel} wins by ~$${netDifference.toFixed(0)} net`;

  // Use booking-type-aware multiplier label
  const portalMultiplier = getPortalMultiplier(bookingType);
  const baseMultiplier = getBaseMultiplier();
  
  const assumptions: string[] = [
    `Miles valued at ${milesValuation}¢ each`,
    `Portal earns ${portalMultiplier}x (${getPortalMultiplierLabel(bookingType)}), Direct earns ${baseMultiplier}x`,
  ];

  if (caresAboutStatus) {
    assumptions.push('Added ~$15 value for status/elite credit earning');
  }

  const confidence: ConfidenceLevel = 'HIGH';

  return {
    id: generateId(),
    type: 'PORTAL_DIRECT',
    title: winnerLabel,
    summary,
    keyNumbers: [
      { label: 'Direct Price', value: `$${comparison.directPrice.amount.toFixed(2)}` },
      { label: 'Portal Price', value: `$${comparison.portalPrice.amount.toFixed(2)}` },
      { label: 'Direct Points', value: pointsEarnedDirect.toLocaleString() },
      { label: 'Portal Points', value: pointsEarnedPortal.toLocaleString() },
      { label: 'Break-even Premium', value: `$${breakEvenPremium.toFixed(0)}`, highlight: true },
    ],
    confidence,
    assumptions,
    actions: [
      { id: 'save', label: 'Save', action: 'save', variant: 'primary' },
      { id: 'share', label: 'Share', action: 'share', variant: 'secondary' },
    ],
    createdAt: Date.now(),
    metadata: { comparison },
  };
}

// ============================================
// REDEMPTION CALCULATOR
// ============================================

/**
 * Calculate Travel Eraser redemption value
 */
export function calculateEraserValue(amount: number): { points: number; cpm: number } {
  // Eraser: 1 cent per mile (0.01 per point)
  const points = Math.ceil(amount * 100); // 100 points = $1
  return {
    points,
    cpm: VENTURE_X_CONSTANTS.ERASER_CPM,
  };
}

/**
 * Main redemption decision calculator
 */
export function calculateRedemption(input: RedemptionInput): RedemptionOutput {
  const { cashPrice, milesBalance, targetCPM, isEraserEligible } = input;

  const eraserData = calculateEraserValue(cashPrice);
  const eraserValue = cashPrice; // What you get in statement credit
  const eraserCPM = VENTURE_X_CONSTANTS.ERASER_CPM;

  const reasoning: string[] = [];

  // Check if user has enough points for eraser
  const canUseEraser =
    isEraserEligible &&
    milesBalance >= VENTURE_X_CONSTANTS.ERASER_MIN_REDEMPTION &&
    milesBalance >= eraserData.points;

  // Determine if transfer is better
  const transferRecommended = targetCPM > eraserCPM;
  const portalRecommended = false; // Only if rebooking makes sense

  let recommendation: 'eraser' | 'transfer' | 'portal' | 'cash';

  // First check eligibility - if not eligible for eraser, recommend cash
  // (Transfer only makes sense for eraser-eligible travel purchases)
  if (!isEraserEligible) {
    recommendation = 'cash';
    reasoning.push('Purchase not eligible for Travel Eraser (not a travel expense or outside 90-day window)');
  } else if (milesBalance < eraserData.points) {
    // Insufficient balance for any redemption
    recommendation = 'cash';
    reasoning.push('Insufficient miles balance for redemption');
  } else if (transferRecommended) {
    // User has enough miles and transfer offers better value
    recommendation = 'transfer';
    reasoning.push(
      `Transfer partners offer ${targetCPM.toFixed(1)}¢/mile vs Eraser's ${eraserCPM.toFixed(1)}¢/mile`
    );
    reasoning.push('Consider transferring to airline partners for better value');
  } else if (canUseEraser) {
    // Eraser is the best option
    recommendation = 'eraser';
    reasoning.push(`Eraser gives ${eraserCPM.toFixed(1)}¢/mile - solid baseline value`);
    reasoning.push(`Would use ${eraserData.points.toLocaleString()} miles`);
  } else {
    // Fallback
    recommendation = 'cash';
    reasoning.push('Cash payment recommended');
  }

  return {
    eraserValue,
    eraserCPM,
    transferRecommended,
    transferThreshold: targetCPM,
    portalRecommended,
    recommendation,
    reasoning,
  };
}

/**
 * Generate a Redemption decision card
 */
export function createRedemptionDecisionCard(
  output: RedemptionOutput,
  cashPrice: number,
  milesBalance: number
): DecisionCard {
  const { recommendation, reasoning, eraserValue, eraserCPM, transferThreshold } = output;

  const titleMap = {
    eraser: 'Use Travel Eraser',
    transfer: 'Consider Transfer Partners',
    portal: 'Book via Portal',
    cash: 'Pay Cash',
  };

  const summaryMap = {
    eraser: `Erase $${eraserValue.toFixed(0)} at ${eraserCPM.toFixed(1)}¢/mile`,
    transfer: `Transfer for ${transferThreshold.toFixed(1)}¢/mile or better`,
    portal: 'Rebook through Capital One Travel',
    cash: 'Cash payment recommended',
  };

  return {
    id: generateId(),
    type: 'REDEEM_DECISION',
    title: titleMap[recommendation],
    summary: summaryMap[recommendation],
    keyNumbers: [
      { label: 'Purchase', value: `$${cashPrice.toFixed(2)}` },
      { label: 'Miles Balance', value: milesBalance.toLocaleString() },
      { label: 'Eraser CPM', value: `${eraserCPM.toFixed(1)}¢` },
      { label: 'Target CPM', value: `${transferThreshold.toFixed(1)}¢`, highlight: recommendation === 'transfer' },
    ],
    confidence: 'HIGH',
    assumptions: reasoning,
    actions: [
      { id: 'save', label: 'Save', action: 'save', variant: 'primary' },
      ...(recommendation === 'eraser'
        ? [{ id: 'add-eraser', label: 'Add to Queue', action: 'add-eraser', variant: 'secondary' as const }]
        : []),
    ],
    createdAt: Date.now(),
    metadata: { output, cashPrice, milesBalance },
  };
}

// ============================================
// PRICE MATCH CALCULATOR
// ============================================

const PRICE_MATCH_WINDOW_HOURS = 24;

/**
 * Calculate price match eligibility
 */
export function calculatePriceMatch(input: PriceMatchInput): PriceMatchOutput {
  const {
    isConfirmed,
    hoursSinceBooking,
    competitorPrice,
    originalPrice,
    sameDates,
    sameRoomType,
    sameCancellation,
    sameOccupancy,
  } = input;

  const checklist = [
    { item: 'Booking confirmed', passed: isConfirmed },
    { item: 'Within 24-hour claim window', passed: hoursSinceBooking <= PRICE_MATCH_WINDOW_HOURS },
    { item: 'Same travel dates', passed: sameDates },
    { item: 'Same room type/fare class', passed: sameRoomType },
    { item: 'Same cancellation policy', passed: sameCancellation },
    { item: 'Same occupancy/passengers', passed: sameOccupancy },
    { item: 'Lower competitor price', passed: competitorPrice < originalPrice },
  ];

  const passedCount = checklist.filter((c) => c.passed).length;
  const totalCount = checklist.length;

  let eligible = passedCount === totalCount;
  let confidence: ConfidenceLevel;

  if (passedCount === totalCount) {
    confidence = 'HIGH';
  } else if (passedCount >= totalCount - 1) {
    confidence = 'MED';
  } else {
    confidence = 'LOW';
  }

  const savings = Math.max(0, originalPrice - competitorPrice);
  const claimDeadline = Date.now() + (PRICE_MATCH_WINDOW_HOURS - hoursSinceBooking) * 60 * 60 * 1000;

  const scriptTemplate = `Hi, I recently booked through Capital One Travel and found a lower price for the same itinerary.

Booking Details:
- Original Price: $${originalPrice.toFixed(2)}
- Competitor Price: $${competitorPrice.toFixed(2)}
- Price Difference: $${savings.toFixed(2)}

I'd like to request a price match as per the Capital One Travel price match policy. I have screenshots of the competitor rate showing the same dates, room type, and cancellation policy.

Thank you!`;

  return {
    eligible,
    confidence,
    savings,
    checklist,
    claimDeadline,
    scriptTemplate,
  };
}

/**
 * Generate a Price Match decision card
 */
export function createPriceMatchDecisionCard(output: PriceMatchOutput): DecisionCard {
  const { eligible, confidence, savings, checklist, claimDeadline } = output;

  const title = eligible ? 'Likely Eligible for Price Match' : 'Price Match May Not Apply';
  const summary = eligible
    ? `Potential savings: $${savings.toFixed(0)}`
    : `${checklist.filter((c) => !c.passed).length} criteria not met`;

  const hoursRemaining = Math.max(0, (claimDeadline - Date.now()) / (1000 * 60 * 60));

  return {
    id: generateId(),
    type: 'PRICE_MATCH',
    title,
    summary,
    keyNumbers: [
      { label: 'Potential Savings', value: `$${savings.toFixed(0)}`, highlight: eligible },
      { label: 'Criteria Met', value: `${checklist.filter((c) => c.passed).length}/${checklist.length}` },
      { label: 'Time Remaining', value: `${hoursRemaining.toFixed(1)} hrs` },
    ],
    confidence,
    assumptions: checklist.map((c) => `${c.passed ? '✓' : '✗'} ${c.item}`),
    actions: [
      { id: 'claim-kit', label: 'Generate Claim Kit', action: 'claim-kit', variant: 'primary' },
      { id: 'save', label: 'Save', action: 'save', variant: 'secondary' },
    ],
    createdAt: Date.now(),
    metadata: { output },
  };
}

// ============================================
// VENTURE X SCORE CALCULATOR
// ============================================

interface VentureXScoreInput {
  travelCreditUsed: number;
  globalEntryUsed: boolean;
  priorityPassActivated: boolean;
  partnerStatusEnrolled: boolean;
  eraserItemsUsed: number;
  loungeVisits: number;
}

export function calculateVentureXScore(input: VentureXScoreInput): number {
  const {
    travelCreditUsed,
    globalEntryUsed,
    priorityPassActivated,
    partnerStatusEnrolled,
    eraserItemsUsed,
    loungeVisits,
  } = input;

  let score = 0;

  // Travel credit (30 points max)
  const creditPct = Math.min(travelCreditUsed / VENTURE_X_CONSTANTS.TRAVEL_CREDIT, 1);
  score += creditPct * 30;

  // Global Entry (15 points)
  if (globalEntryUsed) score += 15;

  // Priority Pass (15 points)
  if (priorityPassActivated) score += 15;

  // Partner status (10 points)
  if (partnerStatusEnrolled) score += 10;

  // Eraser usage (15 points max based on 3+ items)
  score += Math.min(eraserItemsUsed / 3, 1) * 15;

  // Lounge visits (15 points max based on 5+ visits)
  score += Math.min(loungeVisits / 5, 1) * 15;

  return Math.round(score);
}

/**
 * Calculate annual value captured
 */
export function calculateValueCaptured(input: VentureXScoreInput): number {
  const { travelCreditUsed, globalEntryUsed, loungeVisits } = input;

  let value = 0;

  // Travel credit
  value += travelCreditUsed;

  // Global Entry (one-time, but credit resets)
  if (globalEntryUsed) value += VENTURE_X_CONSTANTS.GLOBAL_ENTRY_CREDIT;

  // Lounge visits
  value += loungeVisits * VENTURE_X_CONSTANTS.PRIORITY_PASS_VALUE;

  return value;
}

/**
 * Calculate renewal ROI
 */
export function calculateRenewalROI(
  valueCaptured: number,
  annualFee: number = VENTURE_X_CONSTANTS.ANNUAL_FEE
): { roi: number; netValue: number; worthKeeping: boolean } {
  const netValue = valueCaptured - annualFee;
  const roi = (valueCaptured / annualFee) * 100;

  return {
    roi,
    netValue,
    worthKeeping: netValue >= 0,
  };
}
