// ============================================
// TRANSFER PARTNERS KNOWLEDGE BASE
// Capital One Venture X transfer partners
// ============================================

export interface TransferPartner {
  name: string;
  code: string;
  type: 'airline' | 'hotel';
  ratio: string;
  sweetSpot: string;
  avgCpp: number; // Average cents per point value
}

export const TRANSFER_PARTNERS: TransferPartner[] = [
  // Airlines
  {
    name: 'Air France/KLM Flying Blue',
    code: 'AF',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Europe Business Class 70k one-way',
    avgCpp: 1.7,
  },
  {
    name: 'British Airways Avios',
    code: 'BA',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Short-haul flights 7.5k-12.5k',
    avgCpp: 1.5,
  },
  {
    name: 'Emirates Skywards',
    code: 'EK',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'First Class upgrades, partner awards',
    avgCpp: 1.4,
  },
  {
    name: 'Singapore KrisFlyer',
    code: 'SQ',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Asia Business Class 60-80k',
    avgCpp: 1.8,
  },
  {
    name: 'Turkish Miles&Smiles',
    code: 'TK',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Star Alliance Business awards',
    avgCpp: 1.9,
  },
  {
    name: 'Avianca LifeMiles',
    code: 'AV',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Partner awards, no fuel surcharges',
    avgCpp: 1.6,
  },
  {
    name: 'Air Canada Aeroplan',
    code: 'AC',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Stopover routes, Star Alliance',
    avgCpp: 1.7,
  },
  {
    name: 'Cathay Pacific Asia Miles',
    code: 'CX',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Asia First Class',
    avgCpp: 1.5,
  },
  {
    name: 'Qantas Frequent Flyer',
    code: 'QF',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Australia/New Zealand routes',
    avgCpp: 1.4,
  },
  {
    name: 'Finnair Plus',
    code: 'AY',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Nordic Europe, Asia via Helsinki',
    avgCpp: 1.5,
  },
  {
    name: 'TAP Air Portugal',
    code: 'TP',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Portugal connections, Star Alliance',
    avgCpp: 1.4,
  },
  {
    name: 'Etihad Guest',
    code: 'EY',
    type: 'airline',
    ratio: '1:1',
    sweetSpot: 'Middle East Business Class',
    avgCpp: 1.5,
  },
  
  // Hotels
  {
    name: 'Wyndham Rewards',
    code: 'WH',
    type: 'hotel',
    ratio: '1:1',
    sweetSpot: 'Budget redemptions 7.5k-15k/night',
    avgCpp: 0.8,
  },
  {
    name: 'Choice Privileges',
    code: 'CH',
    type: 'hotel',
    ratio: '1:1',
    sweetSpot: 'Budget redemptions',
    avgCpp: 0.7,
  },
];

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
