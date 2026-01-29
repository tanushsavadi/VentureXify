/**
 * Verdict Transformer
 * 
 * Transforms raw comparison data into the progressive verdict format
 * with proper labeling for "decision-first" UI pattern.
 * 
 * Key Features:
 * - Clear "Pay today" labeling (explains why portal OOP differs from sticker)
 * - Tab-specific content (Cheapest / Max Value / Easiest)
 * - Max 3 "why" bullets
 * - Max 1 warning (only if decision-relevant)
 */

import type { VerdictDataProgressive, RankingMode } from '../ui/components/glass/ProgressiveVerdictCard';

export interface ComparisonInput {
  portalPriceUSD: number;
  directPriceUSD: number;
  creditRemaining?: number;
  milesBalance?: number;
  directIsOTA?: boolean | 'unknown';
  mileValuationCpp?: number; // e.g., 0.018 for 1.8¢/mi
}

export interface ComparisonOutput {
  recommendation: 'portal' | 'direct' | 'tie';
  portalDetails: {
    price: number;
    outOfPocket: number;
    creditApplied: number;
    milesEarned: number;
    milesEarnedRange?: { min: number; max: number };
    netEffectiveCost: number;
  };
  directDetails: {
    price: number;
    outOfPocket: number;
    milesEarned: number;
    netEffectiveCost: number;
    isOTA?: boolean | 'unknown';
    sellerType?: 'airline' | 'ota' | 'unknown';
  };
  netSavings: number;
  deltas?: {
    stickerDiff: number;
    outOfPocketDiff: number;
    netEffectiveDiff: number;
    milesDiff: number;
  };
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons?: string[];
  whyThisWon?: {
    payToday: string;
    milesEarned: string;
    decisionTip: string;
  };
  assumptions?: {
    label: string;
    value: string;
    editable?: boolean;
  }[];
  couldFlipIf?: string[];
  explanation: string[];
}

/**
 * Transform comparison data into progressive verdict format
 */
export function transformToProgressiveVerdict(
  comparison: ComparisonOutput,
  tabMode: RankingMode = 'cheapest'
): VerdictDataProgressive {
  const { recommendation, portalDetails, directDetails, deltas, confidence, confidenceReasons } = comparison;
  
  const isPortal = recommendation === 'portal';
  const isTie = recommendation === 'tie';
  
  // ============================================
  // HERO SECTION (Level 0)
  // ============================================
  
  // Winner info
  const winnerOOP = isPortal || isTie ? portalDetails.outOfPocket : directDetails.outOfPocket;
  const winnerLabel = isTie ? 'Either Works' : (isPortal ? 'Portal Booking' : 'Direct Booking');
  
  // Build "Pay today" label with context
  let payTodayLabel: string;
  if (isPortal && portalDetails.creditApplied > 0) {
    payTodayLabel = `Pay $${winnerOOP.toLocaleString()} today`;
  } else {
    payTodayLabel = `Pay $${winnerOOP.toLocaleString()} today`;
  }
  
  // Primary delta chip
  const outOfPocketDiff = Math.abs(portalDetails.outOfPocket - directDetails.outOfPocket);
  const portalCheaper = portalDetails.outOfPocket < directDetails.outOfPocket;
  
  let primaryDelta: VerdictDataProgressive['primaryDelta'];
  if (outOfPocketDiff > 5) {
    if (isPortal && portalCheaper) {
      primaryDelta = {
        type: 'savings',
        amount: outOfPocketDiff,
        label: `Save $${outOfPocketDiff.toLocaleString()} vs direct`,
      };
    } else if (!isPortal && !portalCheaper) {
      primaryDelta = {
        type: 'savings',
        amount: outOfPocketDiff,
        label: `Save $${outOfPocketDiff.toLocaleString()} vs portal`,
      };
    } else {
      // Winner costs more upfront but wins on value
      const costMore = isPortal ? portalDetails.outOfPocket - directDetails.outOfPocket : directDetails.outOfPocket - portalDetails.outOfPocket;
      primaryDelta = {
        type: 'cost',
        amount: Math.abs(costMore),
        label: costMore > 0 ? `$${costMore.toLocaleString()} more but better value` : `Save $${Math.abs(costMore).toLocaleString()}`,
      };
    }
  } else {
    primaryDelta = {
      type: 'savings',
      amount: 0,
      label: 'Similar out-of-pocket',
    };
  }
  
  // Secondary perk chip (optional)
  let secondaryPerk: VerdictDataProgressive['secondaryPerk'] | undefined;
  const milesDiff = deltas?.milesDiff || (portalDetails.milesEarned - directDetails.milesEarned);
  
  if (tabMode !== 'easiest' && Math.abs(milesDiff) > 100) {
    const portalWinsMiles = milesDiff > 0;
    secondaryPerk = {
      icon: 'miles',
      label: portalWinsMiles 
        ? `+${Math.abs(milesDiff).toLocaleString()} more miles via portal`
        : `+${Math.abs(milesDiff).toLocaleString()} more miles via direct`,
    };
  } else if (tabMode === 'easiest') {
    secondaryPerk = {
      icon: 'flexibility',
      label: isPortal ? 'Portal: may have different change rules' : 'Direct: standard airline policies',
    };
  }
  
  // Warning chip (max 1, only if relevant)
  let warning: VerdictDataProgressive['warning'] | undefined;
  
  // Only show warning for confirmed OTA (not for unknown seller type)
  if (directDetails.isOTA === true && !isPortal) {
    warning = {
      severity: 'critical',
      label: '⚠️ OTA detected – no airline miles',
    };
  } else if (portalDetails.creditApplied === 0 && isPortal && portalDetails.outOfPocket > directDetails.outOfPocket) {
    // Portal wins but credit not applied? That's unusual
    warning = {
      severity: 'info',
      label: 'No travel credit applied',
    };
  }
  
  // ============================================
  // WHY BULLETS (Level 1) - max 3
  // ============================================
  
  const whyBullets: VerdictDataProgressive['whyBullets'] = [];
  
  // Bullet 1: Cash savings (always relevant)
  if (portalDetails.creditApplied > 0 && isPortal) {
    whyBullets.push({
      icon: '💰',
      text: `Pay today: $${portalDetails.outOfPocket.toLocaleString()} (after $${portalDetails.creditApplied} credit) vs $${directDetails.outOfPocket.toLocaleString()} direct`,
    });
  } else if (outOfPocketDiff > 5) {
    const cheaper = portalDetails.outOfPocket < directDetails.outOfPocket ? 'Portal' : 'Direct';
    whyBullets.push({
      icon: '💰',
      text: `${cheaper} is $${outOfPocketDiff.toLocaleString()} cheaper out of pocket`,
    });
  }
  
  // Bullet 2: Miles (for cheapest/max_value tabs)
  if (tabMode !== 'easiest' && Math.abs(milesDiff) > 100) {
    const milesWinner = milesDiff > 0 ? 'Portal' : 'Direct';
    
    // Show clearer miles breakdown instead of confusing range notation
    let milesExplanation: string;
    if (portalDetails.milesEarnedRange && portalDetails.milesEarnedRange.min !== portalDetails.milesEarnedRange.max) {
      // Show clearer range explanation: "Portal earns X–Y mi (5x on $Z)"
      milesExplanation = `Portal: ${portalDetails.milesEarnedRange.min.toLocaleString()}–${portalDetails.milesEarnedRange.max.toLocaleString()} mi (5x), Direct: ${directDetails.milesEarned.toLocaleString()} mi (2x)`;
    } else {
      // Simple case: no range
      milesExplanation = `Portal: ${portalDetails.milesEarned.toLocaleString()} mi (5x), Direct: ${directDetails.milesEarned.toLocaleString()} mi (2x)`;
    }
    
    whyBullets.push({
      icon: '✈️',
      text: `${milesWinner} earns +${Math.abs(milesDiff).toLocaleString()} more miles (${milesExplanation})`,
    });
  }
  
  // Bullet 3: Decision tip or risk note
  if (tabMode === 'easiest') {
    whyBullets.push({
      icon: '💡',
      text: isPortal 
        ? 'Portal bookings may have different change/cancel policies than airline direct'
        : 'Direct booking: changes handled by airline, easier for IRROPS',
    });
  } else if (confidence !== 'high' && confidenceReasons && confidenceReasons.length > 0) {
    whyBullets.push({
      icon: '⚠️',
      text: confidenceReasons[0],
    });
  } else if (comparison.whyThisWon?.decisionTip) {
    whyBullets.push({
      icon: '💡',
      text: comparison.whyThisWon.decisionTip,
    });
  }
  
  // ============================================
  // AUDIT TRAIL (Level 2)
  // ============================================
  
  // Calculate portal premium percentage
  const portalPremiumPercent = directDetails.price > 0 
    ? ((portalDetails.price - directDetails.price) / directDetails.price) * 100 
    : 0;
  
  // Calculate break-even CPP (at what valuation does portal beat direct?)
  // Portal effective cost = OOP - (miles_earned × cpp)
  // Direct effective cost = OOP - (miles_earned × cpp)
  // Portal wins when: portal_oop - portal_miles*cpp < direct_oop - direct_miles*cpp
  // Solving: cpp > (portal_oop - direct_oop) / (portal_miles - direct_miles)
  let breakEvenCpp: number | undefined;
  if (milesDiff !== 0) {
    breakEvenCpp = (portalDetails.outOfPocket - directDetails.outOfPocket) / milesDiff * 100;
    // Only show if positive and reasonable
    if (breakEvenCpp <= 0 || breakEvenCpp > 5) {
      breakEvenCpp = undefined;
    }
  }
  
  const auditTrail: VerdictDataProgressive['auditTrail'] = {
    assumptions: comparison.assumptions || [
      { label: 'Mile value', value: '1.8¢/mi', editable: true },
      { label: 'Portal multiplier', value: '5x', editable: false },
      { label: 'Direct multiplier', value: '2x', editable: false },
      { label: 'Travel credit', value: `$${portalDetails.creditApplied}`, editable: true },
    ],
    couldFlipIf: comparison.couldFlipIf || generateCouldFlipIf(comparison, tabMode),
    fullBreakdown: {
      portalSticker: portalDetails.price,
      portalOutOfPocket: portalDetails.outOfPocket,
      portalMilesEarned: portalDetails.milesEarnedRange 
        ? `${portalDetails.milesEarnedRange.min.toLocaleString()}–${portalDetails.milesEarnedRange.max.toLocaleString()}`
        : `+${portalDetails.milesEarned.toLocaleString()}`,
      directSticker: directDetails.price,
      directOutOfPocket: directDetails.outOfPocket,
      directMilesEarned: directDetails.milesEarned,
      creditApplied: portalDetails.creditApplied,
      breakEvenCpp,
      portalPremiumPercent: portalPremiumPercent > 0.5 ? portalPremiumPercent : undefined,
    },
    notes: generateNotes(comparison, tabMode),
  };
  
  return {
    recommendation,
    winner: {
      label: winnerLabel,
      payToday: winnerOOP,
      payTodayLabel,
    },
    primaryDelta,
    secondaryPerk,
    warning,
    whyBullets,
    auditTrail,
    confidence,
    tabMode,
  };
}

/**
 * Generate "could flip if" conditions based on comparison
 */
function generateCouldFlipIf(comparison: ComparisonOutput, tabMode: RankingMode): string[] {
  const conditions: string[] = [];
  const { recommendation, portalDetails, directDetails, deltas } = comparison;
  const isPortal = recommendation === 'portal';
  
  // Condition: Mile valuation changes
  const milesDiff = deltas?.milesDiff || (portalDetails.milesEarned - directDetails.milesEarned);
  if (Math.abs(milesDiff) > 500 && tabMode !== 'easiest') {
    if (isPortal && milesDiff > 0) {
      conditions.push('You value miles below ~1.0¢ each (conservative valuation)');
    } else if (!isPortal && milesDiff < 0) {
      conditions.push('You value miles above ~2.5¢ each (aggressive valuation)');
    }
  }
  
  // Condition: Direct is actually an OTA (only mention if it IS an OTA)
  if (comparison.directDetails.isOTA === true && !isPortal) {
    conditions.push('Direct is an OTA - no airline miles earned');
  }
  
  // Condition: Travel credit changes
  if (portalDetails.creditApplied > 0 && isPortal) {
    conditions.push(`You've already used your $${portalDetails.creditApplied} travel credit elsewhere`);
  } else if (portalDetails.creditApplied === 0 && !isPortal) {
    conditions.push('You have unused travel credit to apply in portal');
  }
  
  // Condition: Status matters
  if (tabMode === 'easiest') {
    conditions.push('Airline elite status qualification matters more than savings');
  }
  
  // Condition: Price changes
  const outOfPocketDiff = Math.abs(portalDetails.outOfPocket - directDetails.outOfPocket);
  if (outOfPocketDiff < 100) {
    conditions.push(`Prices shift by more than $${Math.round(outOfPocketDiff * 0.5)} either way`);
  }
  
  return conditions.slice(0, 4); // Max 4 conditions
}

/**
 * Generate notes for the audit trail
 */
function generateNotes(comparison: ComparisonOutput, tabMode: RankingMode): string[] {
  const notes: string[] = [];
  const { portalDetails, directDetails } = comparison;
  
  // Portal sticker vs direct explanation
  if (portalDetails.price > directDetails.price) {
    const premiumPct = ((portalDetails.price - directDetails.price) / directDetails.price * 100).toFixed(0);
    notes.push(`Portal sticker ($${portalDetails.price.toLocaleString()}) is ${premiumPct}% higher than direct ($${directDetails.price.toLocaleString()}) before credit.`);
  }
  
  // Credit explanation
  if (portalDetails.creditApplied > 0) {
    notes.push(`$${portalDetails.creditApplied} travel credit applies only to portal bookings.`);
  }
  
  // Miles earning explanation
  notes.push('Portal earns 5x miles on purchases. Direct earns 2x.');
  
  // Range explanation
  if (portalDetails.milesEarnedRange && portalDetails.milesEarnedRange.min !== portalDetails.milesEarnedRange.max) {
    notes.push('Miles range shown because credit may or may not reduce the earn base.');
  }
  
  return notes;
}

export default transformToProgressiveVerdict;
