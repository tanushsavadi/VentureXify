/**
 * Capital One Transfer Partners as of January 2026
 *
 * This file is the **single source of truth** for every Capital One
 * Venture X transfer partner.  It has zero internal dependencies and
 * is designed to be imported by any module that needs partner data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistryPartner {
  /** Internal slug (e.g., 'turkish', 'emirates') */
  id: string;
  /** Display name (e.g., 'Turkish Airlines Miles&Smiles') */
  name: string;
  /** IATA airline code or custom hotel code (e.g., 'TK', 'EK') */
  iata: string;
  /** Whether this partner is an airline or hotel program */
  type: 'airline' | 'hotel';
  /** Airline alliance membership */
  alliance: 'Star Alliance' | 'Oneworld' | 'SkyTeam' | 'none';
  /** Human-readable transfer ratio (e.g., '1:1', '2:1.5') */
  c1Ratio: string;
  /** Partner miles received per 1 Capital One mile */
  effectiveRate: number;
  /** 0-100 difficulty of redemption (higher = harder) */
  frictionScore: number;
  /** Optional notes about the program */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Complete list of Capital One Venture X transfer partners.
 *
 * Grouped conceptually:
 *   1. Airlines with 1:1 ratio
 *   2. Airlines with non-1:1 ratio
 *   3. Hotels
 */
export const PARTNER_REGISTRY: readonly RegistryPartner[] = [
  // ── Airlines (1:1) ──────────────────────────────────────────────────────
  {
    id: 'aeromexico',
    name: 'Aeromexico Rewards',
    iata: 'AM',
    type: 'airline',
    alliance: 'SkyTeam',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 40,
  },
  {
    id: 'aeroplan',
    name: 'Air Canada Aeroplan',
    iata: 'AC',
    type: 'airline',
    alliance: 'Star Alliance',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 25,
  },
  {
    id: 'lifemiles',
    name: 'Avianca LifeMiles',
    iata: 'AV',
    type: 'airline',
    alliance: 'Star Alliance',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 30,
  },
  {
    id: 'avios',
    name: 'British Airways Executive Club',
    iata: 'BA',
    type: 'airline',
    alliance: 'Oneworld',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 35,
  },
  {
    id: 'cathay',
    name: 'Cathay Pacific Asia Miles',
    iata: 'CX',
    type: 'airline',
    alliance: 'Oneworld',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 30,
  },
  {
    id: 'etihad',
    name: 'Etihad Guest',
    iata: 'EY',
    type: 'airline',
    alliance: 'none',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 35,
  },
  {
    id: 'finnair',
    name: 'Finnair Plus',
    iata: 'AY',
    type: 'airline',
    alliance: 'Oneworld',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 30,
  },
  {
    id: 'flyingblue',
    name: 'Air France-KLM Flying Blue',
    iata: 'AF',
    type: 'airline',
    alliance: 'SkyTeam',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 25,
  },
  {
    id: 'qantas',
    name: 'Qantas Frequent Flyer',
    iata: 'QF',
    type: 'airline',
    alliance: 'Oneworld',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 35,
  },
  {
    id: 'qatar',
    name: 'Qatar Airways Privilege Club',
    iata: 'QR',
    type: 'airline',
    alliance: 'Oneworld',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 30,
  },
  {
    id: 'krisflyer',
    name: 'Singapore Airlines KrisFlyer',
    iata: 'SQ',
    type: 'airline',
    alliance: 'Star Alliance',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 30,
  },
  {
    id: 'tapmilesgo',
    name: 'TAP Miles&Go',
    iata: 'TP',
    type: 'airline',
    alliance: 'Star Alliance',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 35,
  },
  {
    id: 'turkish',
    name: 'Turkish Airlines Miles&Smiles',
    iata: 'TK',
    type: 'airline',
    alliance: 'Star Alliance',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 25,
  },
  {
    id: 'virginred',
    name: 'Virgin Red',
    iata: 'VS',
    type: 'airline',
    alliance: 'none',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 40,
  },

  // ── Airlines (non-1:1) ──────────────────────────────────────────────────
  {
    id: 'emirates',
    name: 'Emirates Skywards',
    iata: 'EK',
    type: 'airline',
    alliance: 'none',
    c1Ratio: '2:1.5',
    effectiveRate: 0.75,
    frictionScore: 40,
  },
  {
    id: 'evaair',
    name: 'EVA Air Infinity MileageLands',
    iata: 'BR',
    type: 'airline',
    alliance: 'Star Alliance',
    c1Ratio: '2:1.5',
    effectiveRate: 0.75,
    frictionScore: 40,
  },
  {
    id: 'jal',
    name: 'Japan Airlines Mileage Bank',
    iata: 'JL',
    type: 'airline',
    alliance: 'Oneworld',
    c1Ratio: '2:1.5',
    effectiveRate: 0.75,
    frictionScore: 35,
  },
  {
    id: 'trueblue',
    name: 'JetBlue TrueBlue',
    iata: 'B6',
    type: 'airline',
    alliance: 'none',
    c1Ratio: '5:3',
    effectiveRate: 0.6,
    frictionScore: 45,
  },

  // ── Hotels ──────────────────────────────────────────────────────────────
  {
    id: 'choice',
    name: 'Choice Privileges',
    iata: 'CH',
    type: 'hotel',
    alliance: 'none',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 20,
  },
  {
    id: 'wyndham',
    name: 'Wyndham Rewards',
    iata: 'WY',
    type: 'hotel',
    alliance: 'none',
    c1Ratio: '1:1',
    effectiveRate: 1.0,
    frictionScore: 20,
  },
  {
    id: 'iprefer',
    name: 'I Prefer Hotel Rewards',
    iata: 'IP',
    type: 'hotel',
    alliance: 'none',
    c1Ratio: '1:2',
    effectiveRate: 2.0,
    frictionScore: 25,
  },
  {
    id: 'accor',
    name: 'Accor Live Limitless',
    iata: 'AL',
    type: 'hotel',
    alliance: 'none',
    c1Ratio: '2:1',
    effectiveRate: 0.5,
    frictionScore: 30,
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup Maps
// ---------------------------------------------------------------------------

/** Fast lookup by partner `id` slug. */
export const PARTNER_BY_ID: Map<string, RegistryPartner> = new Map(
  PARTNER_REGISTRY.map((p) => [p.id, p]),
);

/** Fast lookup by IATA code. */
export const PARTNER_BY_IATA: Map<string, RegistryPartner> = new Map(
  PARTNER_REGISTRY.map((p) => [p.iata, p]),
);

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Returns every partner in the registry.
 */
export function getAllPartners(): RegistryPartner[] {
  return [...PARTNER_REGISTRY];
}

/**
 * Returns all **airline** partners (type === 'airline').
 */
export function getAirlinePartners(): RegistryPartner[] {
  return PARTNER_REGISTRY.filter((p) => p.type === 'airline');
}

/**
 * Returns all **hotel** partners (type === 'hotel').
 */
export function getHotelPartners(): RegistryPartner[] {
  return PARTNER_REGISTRY.filter((p) => p.type === 'hotel');
}

/**
 * Look up a partner by its internal `id` slug.
 *
 * @param id - The partner slug (e.g., `'turkish'`, `'emirates'`).
 * @returns The matching `RegistryPartner`, or `undefined` if not found.
 */
export function getPartnerById(id: string): RegistryPartner | undefined {
  return PARTNER_BY_ID.get(id);
}

/**
 * Look up a partner by its IATA code.
 *
 * @param iata - The IATA airline code or custom hotel code (e.g., `'TK'`, `'EK'`).
 * @returns The matching `RegistryPartner`, or `undefined` if not found.
 */
export function getPartnerByIata(iata: string): RegistryPartner | undefined {
  return PARTNER_BY_IATA.get(iata);
}

/**
 * Calculate how many Capital One miles are needed to obtain a given number
 * of partner miles.
 *
 * Formula: `Math.ceil(partnerMiles / effectiveRate)`
 *
 * @param partnerId - The partner slug (e.g., `'emirates'`).
 * @param partnerMiles - The desired number of partner miles.
 * @returns The number of Capital One miles required, or `NaN` if the
 *          partner is not found.
 */
export function c1MilesNeeded(partnerId: string, partnerMiles: number): number {
  const partner = PARTNER_BY_ID.get(partnerId);
  if (!partner) return NaN;
  return Math.ceil(partnerMiles / partner.effectiveRate);
}

/**
 * Calculate how many partner miles you receive from a given number of
 * Capital One miles.
 *
 * Formula: `Math.floor(c1Miles * effectiveRate)`
 *
 * @param partnerId - The partner slug (e.g., `'turkish'`).
 * @param c1Miles - The number of Capital One miles to transfer.
 * @returns The number of partner miles received, or `NaN` if the
 *          partner is not found.
 */
export function partnerMilesFromC1(partnerId: string, c1Miles: number): number {
  const partner = PARTNER_BY_ID.get(partnerId);
  if (!partner) return NaN;
  return Math.floor(c1Miles * partner.effectiveRate);
}

/**
 * Returns all IATA codes for airline partners.
 * Useful for building PointsYeah search URLs.
 */
export function getAllAirlineIataCodes(): string[] {
  return PARTNER_REGISTRY
    .filter((p) => p.type === 'airline')
    .map((p) => p.iata);
}

/**
 * Returns partners grouped into three categories for UI dropdowns
 * and display components.
 *
 * - `airlines1to1`    – Airlines with a 1:1 transfer ratio
 * - `airlinesNon1to1` – Airlines with a non-1:1 transfer ratio
 * - `hotels`          – Hotel loyalty programs
 */
export function getPartnersGrouped(): {
  airlines1to1: RegistryPartner[];
  airlinesNon1to1: RegistryPartner[];
  hotels: RegistryPartner[];
} {
  const airlines1to1: RegistryPartner[] = [];
  const airlinesNon1to1: RegistryPartner[] = [];
  const hotels: RegistryPartner[] = [];

  for (const p of PARTNER_REGISTRY) {
    if (p.type === 'hotel') {
      hotels.push(p);
    } else if (p.effectiveRate === 1.0) {
      airlines1to1.push(p);
    } else {
      airlinesNon1to1.push(p);
    }
  }

  return { airlines1to1, airlinesNon1to1, hotels };
}
