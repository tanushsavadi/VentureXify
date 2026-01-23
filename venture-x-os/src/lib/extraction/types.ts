// ============================================
// EXTRACTION TYPES - Engineering-Grade Extraction Pipeline
// ============================================
// Core types for resilient, observable price extraction
// with confidence tracking and evidence collection

/**
 * Confidence levels for extracted values
 * HIGH: Multiple strong signals agree, explicit labels found
 * MEDIUM: Good signals but some ambiguity
 * LOW: Weak signals, potential conflicts, needs verification
 * NONE: No valid extraction possible
 */
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/**
 * Methods used to extract a value
 * Ordered by reliability (higher = more reliable when working)
 */
export type ExtractionMethod =
  | 'SELECTOR_PRIMARY'    // Site-specific selectors (most reliable when valid)
  | 'SELECTOR_FALLBACK'   // Backup selectors
  | 'SEMANTIC'            // aria-label, role, data-testid patterns
  | 'HEURISTIC'           // Pattern-based scoring (site-agnostic)
  | 'USER_CONFIRMED'      // User clicked/confirmed element
  | 'LLM'                 // AI-assisted extraction (opt-in)
  | 'MANUAL';             // User manually entered value

/**
 * Evidence collected during extraction
 * Provides transparency and debugging capability
 */
export interface Evidence {
  /** The raw text that was matched */
  matchedText: string;
  
  /** Normalized numeric value (if applicable) */
  normalizedValue?: number;
  
  /** CSS selector used (if selector-based) */
  selector?: string;
  
  /** Full URL where extraction occurred */
  url: string;
  
  /** Hostname for grouping */
  hostname: string;
  
  /** Human-readable DOM path (e.g., "body > main > div.checkout > span.total") */
  domPath?: string;
  
  /** Text labels found near the extracted element */
  labelsNearby?: string[];
  
  /** Top candidate scores when heuristic extraction used */
  candidateScores?: CandidateScore[];
  
  /** Detected or inferred currency */
  currency?: string;
  
  /** Warning messages about potential issues */
  warnings?: string[];
  
  /** Additional context for debugging */
  debugInfo?: Record<string, unknown>;
}

/**
 * Candidate score entry for heuristic extraction
 */
export interface CandidateScore {
  /** Raw text of the candidate */
  text: string;
  
  /** Parsed numeric value */
  value: number;
  
  /** Total confidence score (0-100) */
  score: number;
  
  /** Reasons contributing to the score */
  reasons: string[];
  
  /** Penalty reasons (negative factors) */
  penalties?: string[];
}

/**
 * Diagnostics about extraction quality
 */
export interface ExtractionDiagnostics {
  /** Why confidence is lower than ideal */
  confidenceReasons?: string[];
  
  /** Signals that were expected but not found */
  missingSignals?: string[];
  
  /** Conflicting information detected */
  conflicts?: string[];
  
  /** Suggested actions to improve extraction */
  suggestions?: string[];
  
  /** Site registry version used */
  registryVersion?: string;
  
  /** Tier that succeeded (1-5) */
  successfulTier?: number;
  
  /** Tiers that were attempted */
  tiersAttempted?: number[];
  
  /** The selector that was used (for debugging) */
  usedSelector?: string;
}

/**
 * Generic extraction result wrapper
 * Every extraction returns this structure for consistency
 */
export interface ExtractionResult<T> {
  /** Whether extraction succeeded */
  ok: boolean;
  
  /** Extracted value (undefined if ok=false) */
  value?: T;
  
  /** Confidence in the extraction */
  confidence: Confidence;
  
  /** Method used to extract */
  method: ExtractionMethod;
  
  /** Evidence supporting the extraction */
  evidence: Evidence;
  
  /** Error messages if extraction failed */
  errors?: string[];
  
  /** Time taken for extraction (ms) */
  latencyMs: number;
  
  /** Detailed diagnostics */
  diagnostics?: ExtractionDiagnostics;
}

// ============================================
// MONEY & PRICE TYPES
// ============================================

/**
 * Represents a monetary amount with currency
 */
export interface Money {
  /** Numeric amount */
  amount: number;
  
  /** ISO 4217 currency code */
  currency: string;
  
  /** Original text before parsing */
  rawText?: string;
}

/**
 * Breakdown of a price into components
 */
export interface PriceBreakdown {
  /** Base price (before taxes/fees) */
  base?: Money;
  
  /** Taxes and fees */
  taxesFees?: Money;
  
  /** Total price (base + taxes/fees) */
  total?: Money;
  
  /** Per-night price (for hotels) */
  perNight?: Money;
  
  /** Number of nights (for hotels) */
  nights?: number;
  
  /** Whether this is a "from" or "starting at" price */
  isFromPrice?: boolean;
  
  /** Per-person indicator */
  perPerson?: boolean;
  
  /** Number of passengers/guests */
  guestCount?: number;
}

/**
 * Price label types for context
 */
export type PriceLabel = 
  | 'total' 
  | 'perNight' 
  | 'perPerson' 
  | 'subtotal'
  | 'taxesFees'
  | 'dueToday'
  | 'from'
  | 'unknown';

// ============================================
// FLIGHT EXTRACTION TYPES
// ============================================

/**
 * Extracted flight segment information
 */
export interface FlightSegment {
  /** Origin airport IATA code */
  origin?: string;
  
  /** Destination airport IATA code */
  destination?: string;
  
  /** Departure time (HH:MM 24h format) */
  departureTime?: string;
  
  /** Arrival time (HH:MM 24h format) */
  arrivalTime?: string;
  
  /** Flight duration string (e.g., "5h 30m") */
  duration?: string;
  
  /** Flight duration in minutes */
  durationMinutes?: number;
  
  /** Number of stops */
  stops?: number;
  
  /** Layover airport codes */
  layoverAirports?: string[];
  
  /** Layover durations */
  layoverDurations?: string[];
  
  /** Operating airline name */
  airline?: string;
  
  /** Airline IATA code */
  airlineCode?: string;
  
  /** Flight numbers */
  flightNumbers?: string[];
  
  /** Cabin class */
  cabin?: 'economy' | 'premium' | 'business' | 'first';
}

/**
 * Complete extracted flight itinerary
 */
export interface ExtractedFlightItinerary {
  /** Outbound flight segment */
  outbound?: FlightSegment;
  
  /** Return flight segment (for round trips) */
  return?: FlightSegment;
  
  /** Departure date (YYYY-MM-DD) */
  departDate?: string;
  
  /** Return date (YYYY-MM-DD) */
  returnDate?: string;
  
  /** Number of passengers */
  passengers?: number;
  
  /** Trip type */
  tripType?: 'oneWay' | 'roundTrip' | 'multiCity';
}

/**
 * Full flight capture with price and itinerary
 */
export interface FlightCapture {
  /** Price extraction result */
  price: ExtractionResult<PriceBreakdown>;
  
  /** Itinerary extraction result */
  itinerary?: ExtractionResult<ExtractedFlightItinerary>;
  
  /** Site name (e.g., "Google Flights", "Delta") */
  siteName: string;
  
  /** Current page URL */
  pageUrl: string;
  
  /** Page type */
  pageType: 'search' | 'details' | 'checkout' | 'booking' | 'unknown';
  
  /** Timestamp */
  capturedAt: number;
}

// ============================================
// STAY/HOTEL EXTRACTION TYPES
// ============================================

/**
 * Extracted property/hotel information
 */
export interface ExtractedProperty {
  /** Property name */
  name?: string;
  
  /** Property ID (if available) */
  id?: string;
  
  /** City/location */
  city?: string;
  
  /** Full address */
  address?: string;
  
  /** Star rating (1-5) */
  starRating?: number;
  
  /** Guest rating (e.g., 8.5 out of 10) */
  guestRating?: number;
  
  /** Number of reviews */
  reviewCount?: number;
  
  /** Hotel brand (Marriott, Hilton, etc.) */
  brand?: string;
  
  /** Accommodation type */
  accommodationType?: 'hotel' | 'resort' | 'vacation_rental' | 'hostel' | 'other';
}

/**
 * Extracted room selection details
 */
export interface ExtractedRoom {
  /** Room type name */
  name?: string;
  
  /** Cancellation policy text */
  cancellationPolicy?: string;
  
  /** Whether refundable */
  isRefundable?: boolean;
  
  /** Meal plan (if any) */
  mealPlan?: string;
  
  /** Bed type */
  bedType?: string;
  
  /** Max occupancy */
  maxOccupancy?: number;
}

/**
 * Stay search context
 */
export interface StaySearchContext {
  /** Destination/place */
  destination?: string;
  
  /** Check-in date (YYYY-MM-DD) */
  checkIn?: string;
  
  /** Check-out date (YYYY-MM-DD) */
  checkOut?: string;
  
  /** Number of nights */
  nights?: number;
  
  /** Number of rooms */
  rooms?: number;
  
  /** Number of adults */
  adults?: number;
  
  /** Number of children */
  children?: number;
}

/**
 * Full stay capture with all details
 */
export interface StayCapture {
  /** Price extraction result */
  price: ExtractionResult<PriceBreakdown>;
  
  /** Property extraction result */
  property?: ExtractionResult<ExtractedProperty>;
  
  /** Room selection extraction result */
  room?: ExtractionResult<ExtractedRoom>;
  
  /** Search context extraction result */
  searchContext?: ExtractionResult<StaySearchContext>;
  
  /** Site name */
  siteName: string;
  
  /** Current page URL */
  pageUrl: string;
  
  /** Page type */
  pageType: 'search' | 'availability' | 'shop' | 'customize' | 'checkout' | 'unknown';
  
  /** Timestamp */
  capturedAt: number;
}

// ============================================
// EXTRACTION OPTIONS & CONFIG
// ============================================

/**
 * Options for extraction pipeline
 */
export interface ExtractionOptions {
  /** Maximum time to wait for extraction (ms) */
  timeout?: number;
  
  /** Whether to enable heuristic fallback */
  enableHeuristics?: boolean;
  
  /** Whether to enable LLM fallback (opt-in) */
  enableLLMFallback?: boolean;
  
  /** Minimum acceptable confidence */
  minConfidence?: Confidence;
  
  /** Price range filter */
  priceRange?: {
    min?: number;
    max?: number;
  };
  
  /** Expected currency */
  expectedCurrency?: string;
  
  /** Context hints for better extraction */
  contextHints?: {
    pageType?: string;
    bookingType?: 'flight' | 'stay' | 'rental';
    expectedTotal?: number;
  };
  
  /** Debug mode - collect extra diagnostics */
  debug?: boolean;
}

/**
 * Result of extraction health check
 */
export interface ExtractionHealth {
  /** Site key/hostname */
  siteKey: string;
  
  /** Number of extraction attempts */
  attempts: number;
  
  /** Successful extractions with HIGH confidence */
  successHigh: number;
  
  /** Successful extractions with MEDIUM confidence */
  successMed: number;
  
  /** Successful extractions with LOW confidence */
  successLow: number;
  
  /** Failed extractions */
  failures: number;
  
  /** Last successful extraction timestamp */
  lastSuccessAt?: number;
  
  /** Last failure timestamp */
  lastFailureAt?: number;
  
  /** Current registry version for this site */
  registryVersion?: string;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Whether site is in degraded mode */
  isDegraded: boolean;
}

// ============================================
// USER OVERRIDE TYPES
// ============================================

/**
 * User-provided selector override
 */
export interface SelectorOverride {
  /** Hostname pattern (can be regex-like) */
  hostname: string;
  
  /** Page type this override applies to */
  pageType?: string;
  
  /** Field being overridden */
  field: 'totalPrice' | 'taxesFees' | 'perNight' | 'propertyName' | 'roomName';
  
  /** Selector strategies (in priority order) */
  selectors: string[];
  
  /** When this override was created */
  createdAt: number;
  
  /** Number of times this override succeeded */
  successCount: number;
  
  /** Number of times this override failed */
  failCount: number;
  
  /** Last used timestamp */
  lastUsedAt?: number;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard to check if extraction succeeded with acceptable confidence
 */
export function isSuccessfulExtraction<T>(
  result: ExtractionResult<T>,
  minConfidence: Confidence = 'LOW'
): result is ExtractionResult<T> & { ok: true; value: T } {
  const confidenceOrder: Record<Confidence, number> = {
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1,
    'NONE': 0
  };
  
  return (
    result.ok &&
    result.value !== undefined &&
    confidenceOrder[result.confidence] >= confidenceOrder[minConfidence]
  );
}

/**
 * Check if a confidence level meets minimum requirement
 */
export function meetsConfidence(
  confidence: Confidence,
  minimum: Confidence
): boolean {
  const order: Record<Confidence, number> = {
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1,
    'NONE': 0
  };
  return order[confidence] >= order[minimum];
}

/**
 * Get numeric confidence value for sorting
 */
export function confidenceToNumber(confidence: Confidence): number {
  const map: Record<Confidence, number> = {
    'HIGH': 100,
    'MEDIUM': 66,
    'LOW': 33,
    'NONE': 0
  };
  return map[confidence];
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a failed extraction result
 */
export function createFailedResult<T>(
  errors: string[],
  evidence: Partial<Evidence>,
  latencyMs: number,
  diagnostics?: ExtractionDiagnostics
): ExtractionResult<T> {
  return {
    ok: false,
    confidence: 'NONE',
    method: 'HEURISTIC',
    evidence: {
      matchedText: '',
      url: evidence.url || window.location.href,
      hostname: evidence.hostname || window.location.hostname,
      ...evidence
    },
    errors,
    latencyMs,
    diagnostics
  };
}

/**
 * Create a successful extraction result
 */
export function createSuccessResult<T>(
  value: T,
  confidence: Confidence,
  method: ExtractionMethod,
  evidence: Evidence,
  latencyMs: number,
  diagnostics?: ExtractionDiagnostics
): ExtractionResult<T> {
  return {
    ok: true,
    value,
    confidence,
    method,
    evidence,
    latencyMs,
    diagnostics
  };
}

/**
 * Merge extraction results, preferring higher confidence
 */
export function mergeResults<T>(
  results: ExtractionResult<T>[]
): ExtractionResult<T> | null {
  if (results.length === 0) return null;
  
  // Sort by confidence (descending) then by latency (ascending)
  const sorted = [...results].sort((a, b) => {
    const confDiff = confidenceToNumber(b.confidence) - confidenceToNumber(a.confidence);
    if (confDiff !== 0) return confDiff;
    return a.latencyMs - b.latencyMs;
  });
  
  return sorted[0] ?? null;
}
