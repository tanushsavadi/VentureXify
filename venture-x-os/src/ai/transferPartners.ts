// ============================================
// TRANSFER PARTNERS KNOWLEDGE BASE
// Capital One Venture X transfer partners
// Derived from the unified transfer partner registry
// ============================================

import { getAllPartners, type RegistryPartner } from '../engine/transferPartnerRegistry';

export interface TransferPartner {
  name: string;
  code: string;
  type: 'airline' | 'hotel';
  ratio: string;
  sweetSpot: string;
  avgCpp: number; // Average cents per point value
}

// ---------------------------------------------------------------------------
// Supplementary AI-context data not present in the registry
// ---------------------------------------------------------------------------

const AI_SUPPLEMENT: Record<string, { sweetSpot: string; avgCpp: number }> = {
  // Airlines
  aeroplan:   { sweetSpot: 'Stopover routes, Star Alliance', avgCpp: 1.7 },
  aeromexico: { sweetSpot: 'Mexico & Central America flights', avgCpp: 1.3 },
  flyingblue: { sweetSpot: 'Europe Business Class 70k one-way', avgCpp: 1.7 },
  lifemiles:  { sweetSpot: 'Partner awards, no fuel surcharges', avgCpp: 1.6 },
  avios:      { sweetSpot: 'Short-haul flights 7.5k-12.5k', avgCpp: 1.5 },
  cathay:     { sweetSpot: 'Asia First Class', avgCpp: 1.5 },
  emirates:   { sweetSpot: 'First Class upgrades, partner awards', avgCpp: 1.4 },
  etihad:     { sweetSpot: 'Middle East Business Class', avgCpp: 1.5 },
  finnair:    { sweetSpot: 'Nordic Europe, Asia via Helsinki', avgCpp: 1.5 },
  qantas:     { sweetSpot: 'Australia/New Zealand routes', avgCpp: 1.4 },
  qatar:      { sweetSpot: 'QSuites Business Class', avgCpp: 1.8 },
  krisflyer:  { sweetSpot: 'Asia Business Class 60-80k', avgCpp: 1.8 },
  tapmilesgo: { sweetSpot: 'Portugal connections, Star Alliance', avgCpp: 1.4 },
  turkish:    { sweetSpot: 'Star Alliance Business awards', avgCpp: 1.9 },
  virginred:  { sweetSpot: 'Virgin Atlantic Upper Class', avgCpp: 1.5 },
  evaair:     { sweetSpot: 'EVA premium cabins to Taiwan/Asia', avgCpp: 1.2 },
  jal:        { sweetSpot: 'Japan Airlines premium cabins', avgCpp: 1.4 },
  trueblue:   { sweetSpot: 'JetBlue Mint, Caribbean', avgCpp: 1.3 },
  // Hotels
  choice:     { sweetSpot: 'Budget redemptions', avgCpp: 0.7 },
  wyndham:    { sweetSpot: 'Budget redemptions 7.5k-15k/night', avgCpp: 0.8 },
  iprefer:    { sweetSpot: 'Preferred Hotels, 1:2 bonus ratio', avgCpp: 0.9 },
  accor:      { sweetSpot: 'Global hotel coverage (poor ratio)', avgCpp: 0.5 },
};

const DEFAULT_AI_SUPP = { sweetSpot: 'General redemptions', avgCpp: 1.0 };

/** Map a RegistryPartner to the AI TransferPartner interface */
function mapToAIPartner(rp: RegistryPartner): TransferPartner {
  const supp = AI_SUPPLEMENT[rp.id] ?? DEFAULT_AI_SUPP;
  return {
    name: rp.name,
    code: rp.iata,
    type: rp.type,
    ratio: rp.c1Ratio,
    sweetSpot: supp.sweetSpot,
    avgCpp: supp.avgCpp,
  };
}

/**
 * All 22 Capital One Venture X transfer partners for AI context.
 *
 * @deprecated Prefer importing directly from `../../engine/transferPartnerRegistry`
 * for new code. This array is maintained for backward compatibility.
 */
export const TRANSFER_PARTNERS: TransferPartner[] = getAllPartners().map(mapToAIPartner);

/**
 * Get redemption suggestions based on miles balance
 */
export function getRedemptionSuggestions(
  milesBalance: number,
  destination?: string
): string[] {
  const suggestions: string[] = [];
  
  // Premium cabin thresholds
  if (milesBalance >= 70000) {
    suggestions.push('Flying Blue Europe Business (70k one-way)');
  }
  if (milesBalance >= 60000) {
    suggestions.push('Singapore Business to Asia (60-80k)');
  }
  if (milesBalance >= 50000) {
    suggestions.push('Turkish Miles&Smiles Business (50-60k)');
  }
  if (milesBalance >= 30000) {
    suggestions.push('Avianca LifeMiles short-haul Business');
  }
  if (milesBalance >= 15000) {
    suggestions.push('British Airways Avios short-haul (7.5k-12.5k)');
  }
  
  // Destination-specific
  if (destination) {
    const destLower = destination.toLowerCase();
    if (destLower.includes('europe') || destLower.includes('paris') || destLower.includes('rome')) {
      suggestions.unshift('Flying Blue is ideal for Europe');
    }
    if (destLower.includes('asia') || destLower.includes('tokyo') || destLower.includes('singapore')) {
      suggestions.unshift('Singapore KrisFlyer or Cathay for Asia');
    }
    if (destLower.includes('australia') || destLower.includes('sydney')) {
      suggestions.unshift('Qantas for Australia routes');
    }
  }
  
  return suggestions.slice(0, 3);
}

/**
 * Calculate how close user is to a redemption goal
 */
export function calculateRedemptionProgress(milesBalance: number): {
  nextGoal: string;
  milesNeeded: number;
  milesAway: number;
  percentComplete: number;
} | null {
  const goals = [
    { name: 'British Airways short-haul', miles: 12500 },
    { name: 'Avianca short-haul Business', miles: 30000 },
    { name: 'Turkish Business Europe', miles: 55000 },
    { name: 'Flying Blue Business Europe', miles: 70000 },
    { name: 'Singapore Business Asia', miles: 80000 },
  ];
  
  for (const goal of goals) {
    if (milesBalance < goal.miles) {
      const milesAway = goal.miles - milesBalance;
      return {
        nextGoal: goal.name,
        milesNeeded: goal.miles,
        milesAway,
        percentComplete: Math.round((milesBalance / goal.miles) * 100),
      };
    }
  }
  
  // User has lots of miles
  return {
    nextGoal: 'Multiple premium redemptions available',
    milesNeeded: 0,
    milesAway: 0,
    percentComplete: 100,
  };
}
