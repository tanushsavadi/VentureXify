// ============================================
// RECOMMENDATION ENGINE
// Wraps existing calculator functions for the new chat flow
// ============================================

import { PortalSnapshot, DirectSnapshot, ComparisonResult } from '../lib/compareTypes';
import { calculatePortalVsDirect, calculatePointsEarned, calculatePointsValue } from '../lib/calculators';
import { BookingType, VENTURE_X_CONSTANTS } from '../lib/types';
import type { Confidence } from '../lib/extraction/types';

// ============================================
// TYPES
// ============================================

export interface VerdictConfidence {
  overall: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  portalConfidence: Confidence;
  directConfidence: Confidence;
  warnings: string[];
}

export interface Verdict {
  winner: 'portal' | 'direct' | 'neutral' | 'insufficient_data';
  portalPrice: number;
  directPrice: number;
  portalPointsEarned: number;
  directPointsEarned: number;
  portalEffectiveValue: number;
  directEffectiveValue: number;
  netDifference: number;
  breakEvenPremium: number;
  creditApplied: number;
  reasons: string[];
  computedAt: number;
  confidence: VerdictConfidence;
}

export interface AIExplanation {
  headline: string;
  body: string[];
  proTip: string;
  caveats: string[];
}

// ============================================
// COMPUTE VERDICT
// ============================================

/**
 * Compute comparison verdict with STRICT confidence discipline:
 * - If either extraction has LOW or NONE confidence, verdict is 'insufficient_data'
 * - MEDIUM confidence produces warnings but allows computation
 * - Only HIGH confidence on both sides gives full trust
 *
 * This prevents wrong recommendations from bad extractions.
 */
export async function computeVerdict(
  portalCapture: PortalSnapshot,
  directCapture: DirectSnapshot
): Promise<Verdict> {
  // Get user preferences
  const prefs = await getStoredPreferences();
  
  // ============================================
  // CONFIDENCE DISCIPLINE - Check extraction quality FIRST
  // ============================================
  const portalConf: Confidence = (portalCapture.totalPrice as any)?.confidence ?? 'NONE';
  const directConf: Confidence = (directCapture.totalPrice as any)?.confidence ?? 'NONE';
  
  const confidenceWarnings: string[] = [];
  
  // CRITICAL: If EITHER price has LOW or NONE confidence, refuse to compute
  // This is the key safety gate that prevents wrong verdicts
  const isPortalUnreliable = portalConf === 'LOW' || portalConf === 'NONE';
  const isDirectUnreliable = directConf === 'LOW' || directConf === 'NONE';
  
  if (isPortalUnreliable || isDirectUnreliable) {
    // Build specific warning messages
    if (isPortalUnreliable) {
      confidenceWarnings.push(
        portalConf === 'NONE'
          ? 'Portal price could not be detected. Please verify manually.'
          : 'Portal price has low confidence. Please verify before booking.'
      );
    }
    if (isDirectUnreliable) {
      confidenceWarnings.push(
        directConf === 'NONE'
          ? 'Direct price could not be detected. Please verify manually.'
          : 'Direct price has low confidence. Please verify before booking.'
      );
    }
    
    // Return INSUFFICIENT_DATA verdict - do NOT compute with unreliable prices
    return {
      winner: 'insufficient_data',
      portalPrice: portalCapture.totalPrice?.amount ?? 0,
      directPrice: directCapture.totalPrice?.amount ?? 0,
      portalPointsEarned: 0,
      directPointsEarned: 0,
      portalEffectiveValue: 0,
      directEffectiveValue: 0,
      netDifference: 0,
      breakEvenPremium: 0,
      creditApplied: 0,
      reasons: ['Cannot compute recommendation: extraction confidence too low'],
      computedAt: Date.now(),
      confidence: {
        overall: 'INSUFFICIENT',
        portalConfidence: portalConf,
        directConfidence: directConf,
        warnings: confidenceWarnings,
      },
    };
  }
  
  // MEDIUM confidence: Allow computation but add warnings
  if (portalConf === 'MEDIUM') {
    confidenceWarnings.push('Portal price needs verification - detected with medium confidence.');
  }
  if (directConf === 'MEDIUM') {
    confidenceWarnings.push('Direct price needs verification - detected with medium confidence.');
  }
  
  // Determine overall confidence
  const overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    portalConf === 'HIGH' && directConf === 'HIGH' ? 'HIGH' :
    portalConf === 'MEDIUM' || directConf === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  
  // ============================================
  // PROCEED WITH COMPUTATION (prices are reliable enough)
  // ============================================
  
  const portalPrice = portalCapture.totalPrice?.amount ?? 0;
  const directPrice = directCapture.totalPrice?.amount ?? 0;
  const bookingType: BookingType = portalCapture.bookingType || 'flight';
  
  // Use the existing calculator
  const result = calculatePortalVsDirect({
    portalPrice,
    directPrice,
    bookingType,
    milesValuation: prefs.milesValuationCents,
    caresAboutStatus: false,
  });
  
  // Calculate miles earned
  const portalPointsEarned = result.pointsEarnedPortal;
  const directPointsEarned = result.pointsEarnedDirect;
  
  // Calculate effective values (price - points value)
  const milesValue = prefs.milesValuationCents / 100;
  const portalEffectiveValue = portalPrice - (portalPointsEarned * milesValue);
  const directEffectiveValue = directPrice - (directPointsEarned * milesValue);
  
  // Credit applied (if portal price covers credit)
  const creditApplied = Math.min(prefs.travelCreditRemaining, portalPrice);
  
  // Net difference
  const netDifference = Math.abs(directEffectiveValue - portalEffectiveValue);
  
  // Determine winner
  let winner: 'portal' | 'direct' | 'neutral' = 'neutral';
  if (result.winner === 'portal') {
    winner = 'portal';
  } else if (result.winner === 'direct') {
    winner = 'direct';
  } else {
    winner = 'neutral';
  }
  
  // Build reasons
  const reasons = buildReasons(
    winner,
    portalPrice,
    directPrice,
    portalPointsEarned,
    directPointsEarned,
    portalEffectiveValue,
    directEffectiveValue,
    result.breakEvenPremium,
    creditApplied
  );
  
  return {
    winner,
    portalPrice,
    directPrice,
    portalPointsEarned,
    directPointsEarned,
    portalEffectiveValue,
    directEffectiveValue,
    netDifference,
    breakEvenPremium: result.breakEvenPremium,
    creditApplied,
    reasons,
    computedAt: Date.now(),
    confidence: {
      overall: overallConfidence,
      portalConfidence: portalConf,
      directConfidence: directConf,
      warnings: confidenceWarnings,
    },
  };
}

// ============================================
// COMPUTE BREAK-EVEN PREMIUM
// ============================================

export function computeBreakEvenPremium(
  directPrice: number,
  milesValuationCents: number = 1.7
): number {
  // Break-even = direct price * (portal multiplier - direct multiplier) * miles value / 100
  // Portal: 5x, Direct: 2x
  // Premium you can pay on portal before direct becomes better
  const multiplierDiff = VENTURE_X_CONSTANTS.PORTAL_MULTIPLIER - VENTURE_X_CONSTANTS.BASE_MULTIPLIER;
  const milesValue = milesValuationCents / 100;
  return directPrice * multiplierDiff * milesValue;
}

// ============================================
// FORMAT DETERMINISTIC EXPLANATION
// ============================================

export function formatDeterministicExplanation(verdict: Verdict): AIExplanation {
  const {
    winner,
    portalPrice,
    directPrice,
    portalPointsEarned,
    directPointsEarned,
    netDifference,
    breakEvenPremium,
    creditApplied,
    confidence,
  } = verdict;
  
  let headline: string;
  let body: string[];
  let proTip: string;
  const caveats: string[] = [];
  
  // INSUFFICIENT DATA - Confidence discipline kicks in
  if (winner === 'insufficient_data') {
    headline = '⚠️ Price verification needed';
    body = [
      'We couldn\'t reliably detect the prices on these pages.',
      ...confidence.warnings,
      'Please verify the prices manually before making a decision.',
    ];
    proTip = 'Use the "Fix Capture" button to help us identify the correct price elements.';
    caveats.push('Do NOT book based on uncertain price data.');
    return { headline, body, proTip, caveats };
  }
  
  if (winner === 'portal') {
    headline = `Portal wins by ~$${netDifference.toFixed(0)}`;
    body = [
      `Portal: $${portalPrice.toLocaleString()} → ${portalPointsEarned.toLocaleString()} miles (5x)`,
      `Direct: $${directPrice.toLocaleString()} → ${directPointsEarned.toLocaleString()} miles (2x)`,
      `The extra ${(portalPointsEarned - directPointsEarned).toLocaleString()} miles from Portal are worth more than the ${portalPrice > directPrice ? `$${(portalPrice - directPrice).toFixed(0)} premium` : 'savings'}.`,
    ];
    proTip = creditApplied > 0
      ? `Apply your $${creditApplied} travel credit to reduce the portal price further.`
      : `You can pay up to $${breakEvenPremium.toFixed(0)} more on Portal before Direct becomes better.`;
  } else if (winner === 'direct') {
    headline = `Direct wins by ~$${netDifference.toFixed(0)}`;
    body = [
      `Direct: $${directPrice.toLocaleString()} → ${directPointsEarned.toLocaleString()} miles (2x)`,
      `Portal: $${portalPrice.toLocaleString()} → ${portalPointsEarned.toLocaleString()} miles (5x)`,
      `The $${(portalPrice - directPrice).toFixed(0)} Portal premium exceeds the ${(portalPointsEarned - directPointsEarned).toLocaleString()} extra miles value.`,
    ];
    proTip = `Book direct and consider Travel Eraser for 1¢/mile redemption if needed.`;
  } else {
    headline = `It's a wash — pick based on preference`;
    body = [
      `Portal: $${portalPrice.toLocaleString()} → ${portalPointsEarned.toLocaleString()} miles`,
      `Direct: $${directPrice.toLocaleString()} → ${directPointsEarned.toLocaleString()} miles`,
      `Net difference is under $5 — not material.`,
    ];
    proTip = creditApplied > 0
      ? `Slight edge to Portal if you want to use your $${creditApplied} credit.`
      : `Portal gives better points; Direct may have better policies.`;
  }
  
  // Add confidence warnings to caveats
  if (confidence.warnings.length > 0) {
    caveats.push(...confidence.warnings);
  }
  
  // Add confidence badge caveat for MEDIUM
  if (confidence.overall === 'MEDIUM') {
    caveats.push('⚠️ One or both prices detected with medium confidence. Verify before booking.');
  }
  
  // Add standard caveats
  if (Math.abs(portalPrice - directPrice) < 10) {
    caveats.push('Prices are very close — double-check both before booking.');
  }
  if (portalPrice > directPrice * 1.3) {
    caveats.push('Portal premium is high (>30%). Verify pricing is current.');
  }
  if (creditApplied > 0 && winner !== 'portal') {
    caveats.push(`You have $${creditApplied} credit that only applies to Portal bookings.`);
  }
  
  return { headline, body, proTip, caveats };
}

// ============================================
// HELPERS
// ============================================

function buildReasons(
  winner: 'portal' | 'direct' | 'neutral',
  portalPrice: number,
  directPrice: number,
  portalPoints: number,
  directPoints: number,
  portalEffective: number,
  directEffective: number,
  breakEven: number,
  creditApplied: number
): string[] {
  const reasons: string[] = [];
  
  const priceDiff = portalPrice - directPrice;
  const pointsDiff = portalPoints - directPoints;
  
  if (winner === 'portal') {
    if (portalPrice <= directPrice) {
      reasons.push(`Portal is cheaper by $${Math.abs(priceDiff).toFixed(0)}`);
    }
    reasons.push(`Earn ${pointsDiff.toLocaleString()} extra miles on Portal`);
    reasons.push(`Effective cost: $${portalEffective.toFixed(0)} vs $${directEffective.toFixed(0)}`);
    if (creditApplied > 0) {
      reasons.push(`$${creditApplied} travel credit applies`);
    }
  } else if (winner === 'direct') {
    reasons.push(`Direct is $${priceDiff.toFixed(0)} cheaper`);
    reasons.push(`Portal premium exceeds break-even of $${breakEven.toFixed(0)}`);
    reasons.push(`Effective cost: $${directEffective.toFixed(0)} vs $${portalEffective.toFixed(0)}`);
  } else {
    reasons.push('Prices are effectively equal after points');
    reasons.push(`Break-even premium: $${breakEven.toFixed(0)}`);
    reasons.push('Choose based on booking flexibility preference');
  }
  
  return reasons;
}

async function getStoredPreferences(): Promise<{
  milesValuationCents: number;
  travelCreditRemaining: number;
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vx_preferences'], (result) => {
      const prefs = result.vx_preferences || {};
      resolve({
        milesValuationCents: prefs.milesValuationCents ?? 1.7,
        travelCreditRemaining: prefs.travelCreditRemaining ?? 300,
      });
    });
  });
}
