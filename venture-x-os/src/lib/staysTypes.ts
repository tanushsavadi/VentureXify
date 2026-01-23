// ============================================
// STAYS/HOTELS TYPE DEFINITIONS
// Types for Capital One Travel Stays capture and comparison
// ============================================

import { ConfidenceLevel } from './types';

// ============================================
// CONSTANTS FOR STAYS
// ============================================

export const STAYS_CONSTANTS = {
  // Portal earn rates
  PORTAL_HOTELS_RATE: 10,           // 10x miles per $ for hotels
  PORTAL_VACATION_RENTALS_RATE: 5,  // 5x miles per $ for vacation rentals
  
  // Direct earn rate
  DIRECT_RATE: 2,                   // 2x miles per $ for direct bookings
  
  // URL patterns for Capital One Travel Stays
  // Note: Capital One uses complex nested paths like:
  //   - /stays/availability/
  //   - /stays/shop/
  //   - /hotels/book/
  //   - /premium-stays/vacation-rentals/shop/
  //   - /premium-stays/vacation-rentals/book/
  URL_PATTERNS: {
    // Match availability pages (search results)
    AVAILABILITY: /travel\.capitalone\.com\/(?:premium-stays\/)?(?:stays|hotels|vacation-rentals)\/availability/i,
    // Match shop pages (room selection)
    SHOP: /travel\.capitalone\.com\/(?:premium-stays\/)?(?:stays|hotels|vacation-rentals)\/(?:shop|[^\/]+\/shop)/i,
    // Match customize/book pages (checkout flow)
    CUSTOMIZE: /travel\.capitalone\.com\/(?:premium-stays\/)?(?:stays|hotels|vacation-rentals)\/(?:customize|book)/i,
    // Match checkout/book pages
    CHECKOUT: /travel\.capitalone\.com\/(?:premium-stays\/)?(?:stays|hotels|vacation-rentals)\/(?:checkout|book)/i,
    // Final booking page - any path containing /book
    BOOK: /travel\.capitalone\.com\/(?:premium-stays\/)?(?:stays|hotels|vacation-rentals)\/(?:[^\/]*\/)?book/i,
  },
  
  // Google Hotels URL patterns
  GOOGLE_HOTELS_PATTERNS: {
    SEARCH: /google\.com\/travel\/hotels/i,
    ENTITY: /google\.com\/travel\/hotels\/entity/i,
    SEARCH_RESULTS: /google\.com\/travel\/search.*Hotels/i,
  },
} as const;

// ============================================
// STAY PAGE TYPE DETECTION
// ============================================

export type StayPageType = 
  | 'availability'   // Search results page
  | 'shop'          // Property page (Choose Room)
  | 'customize'     // Checkout breakdown page
  | 'checkout'      // Final checkout
  | 'unknown';

export type StayAccommodationType = 
  | 'hotel'
  | 'vacation_rental'
  | 'unknown';

// ============================================
// SEARCH CONTEXT
// ============================================

export interface StaySearchContext {
  place: string;                    // e.g., "Springfield, MA"
  placeId?: string;                 // If available from URL params
  checkIn: string;                  // ISO date YYYY-MM-DD
  checkOut: string;                 // ISO date YYYY-MM-DD
  nights: number;                   // Computed from dates
  adults: number;
  children?: number;
  rooms: number;
  pets?: boolean;
  extractedAt: number;
  source: 'url' | 'dom' | 'manual';
}

// ============================================
// ROOM SELECTION
// ============================================

export interface StayRoomSelection {
  roomName: string;                 // e.g., "Studio, 1 King Bed and 1 Sofa Bed, Accessible"
  roomType?: string;                // e.g., "Studio", "Suite"
  bedConfiguration?: string;        // e.g., "1 King Bed and 1 Sofa Bed"
  refundableLabel?: string;         // e.g., "Fully refundable before Jan 25"
  isRefundable?: boolean;
  cancellationDeadline?: string;    // ISO date
  mealPlan?: string;                // e.g., "Free breakfast", "Breakfast included"
  amenities?: string[];             // e.g., ["WiFi", "Parking", "Pool"]
  perNight?: number;                // e.g., 382
  totalCash?: number;               // e.g., 1301
  totalMiles?: number;              // e.g., 130127
  currency?: string;                // e.g., "USD"
  confidence: ConfidenceLevel;
  extractedAt: number;
}

// ============================================
// CHECKOUT BREAKDOWN
// ============================================

export interface StayCheckoutBreakdown {
  roomSubtotal: number;             // Room cost before taxes
  roomNights?: string;              // e.g., "3 nights"
  taxesFees: number;                // Taxes & fees amount
  taxesFeesLabel?: string;          // e.g., "Taxes & fees"
  dueTodayCash: number;             // Total due today BEFORE credits (the base price!)
  dueTodayMiles?: number;           // Miles equivalent if shown
  amountDueAfterCredit?: number;    // Final amount AFTER travel credit applied
  payAtProperty?: number;           // Additional service fee due at check-in (resort fee, etc.)
  payAtPropertyLabel?: string;      // e.g., "Additional Service Fee (Due at check-in)"
  totalAllIn?: number;              // Total all-in cost (dueTodayCash + payAtProperty)
  discounts?: {                     // Any discounts applied
    label: string;
    amount: number;
  }[];
  creditApplied?: number;           // Travel credit if applied by portal (already deducted!)
  creditAlreadyApplied: boolean;    // TRUE if portal already applied credit
  currency: string;
  confidence: ConfidenceLevel;
  extractedAt: number;
}

// ============================================
// PROPERTY DETAILS
// ============================================

export interface StayPropertyDetails {
  propertyName: string;             // e.g., "Residence Inn Springfield Chicopee"
  propertySlug?: string;            // From URL
  propertyId?: string;              // UUID from URL if available
  brandName?: string;               // e.g., "Marriott", "Hilton"
  starRating?: number;              // 1-5 stars
  guestRating?: number;             // e.g., 4.5
  guestRatingLabel?: string;        // e.g., "Excellent"
  reviewCount?: number;
  city?: string;                    // e.g., "Chicopee"
  address?: string;
  neighborhood?: string;
  accommodationType: StayAccommodationType;
  propertyAmenities?: string[];     // e.g., ["Pool", "Gym", "Free WiFi"]
  imageUrl?: string;
  confidence: ConfidenceLevel;
  extractedAt: number;
}

// ============================================
// PORTAL STAY CAPTURE (Complete)
// ============================================

export interface StayPortalCapture {
  // Identifiers
  captureId: string;
  bookingType: 'stay';
  accommodationType: StayAccommodationType;
  pageType: StayPageType;
  
  // Context
  searchContext: StaySearchContext;
  
  // Property
  property: StayPropertyDetails;
  
  // Selection
  selectedRoom?: StayRoomSelection;
  
  // Pricing
  checkoutBreakdown?: StayCheckoutBreakdown;
  
  // Summary pricing (best available)
  totalPrice: {
    amount: number;
    currency: string;
    confidence: ConfidenceLevel;
    label: 'perNight' | 'total' | 'dueToday';
    source: 'dom' | 'url' | 'computed' | 'manual';
    extractedAt: number;
  };
  
  // Miles shown by portal
  portalMilesEquivalent?: number;   // Miles option if displayed
  portalEarnRate: number;           // 10x for hotels, 5x for VR
  milesEarned: number;              // Computed: totalPrice * earnRate
  
  // Capture metadata
  portalUrl: string;
  capturedAt: number;
  lastUpdatedAt: number;
  version: number;                  // For cache invalidation
}

// ============================================
// DIRECT STAY CAPTURE (Google Hotels, etc.)
// ============================================

export interface DirectStayCapture {
  // Identifiers
  captureId: string;
  bookingType: 'stay';
  
  // Source
  siteName: string;                 // e.g., "Google Hotels", "Booking.com"
  siteUrl: string;
  provider?: string;                // e.g., "Booking.com", "Expedia" (if shown)
  
  // Property (for matching)
  propertyName?: string;
  city?: string;
  
  // Pricing
  totalPrice: {
    amount: number;
    currency: string;
    confidence: ConfidenceLevel;
    label: 'perNight' | 'total';
    source: 'dom' | 'manual';
    extractedAt: number;
  };
  
  nightlyRate?: number;
  nights?: number;
  taxesFees?: number;               // If separately shown
  taxesIncluded?: boolean;          // Whether taxes are included in total
  
  // Matching heuristics
  matchConfidence: ConfidenceLevel;
  matchDetails?: {
    nameMatch: boolean;
    datesMatch: boolean;
    occupancyMatch: boolean;
    locationMatch: boolean;
    notes?: string[];
  };
  
  // Capture metadata
  capturedAt: number;
}

// ============================================
// STAY COMPARISON RESULT
// ============================================

export interface StayComparisonResult {
  sessionId: string;
  
  // Input captures
  portalCapture: StayPortalCapture;
  directCapture: DirectStayCapture;
  
  // Pricing comparison
  portalPrice: number;              // USD
  directPrice: number;              // USD
  priceDelta: number;               // portal - direct
  priceDeltaPercent: number;        // percentage difference
  
  // Miles comparison
  portalMilesEarned: number;        // 10x or 5x
  directMilesEarned: number;        // 2x
  milesValuePortal: number;         // portalMiles * valuation
  milesValueDirect: number;         // directMiles * valuation
  
  // Net effective cost
  portalNetCost: number;            // price - milesValue - creditApplied
  directNetCost: number;            // price - milesValue
  
  // Winner determination
  winner: 'portal' | 'direct' | 'tie';
  netSavings: number;               // How much winner saves
  
  // Taxes/fees clarity
  portalTaxesFees?: number;
  directTaxesFees?: number;
  
  // Travel credit
  creditApplied: number;
  creditRemaining: number;
  
  // Confidence
  overallConfidence: ConfidenceLevel;
  confidenceNotes: string[];
  
  // Verdict details
  explanation: string[];
  flipConditions?: string[];        // What would change the winner
  
  // Metadata
  mileValuationCpp: number;         // User's valuation
  computedAt: number;
}

// ============================================
// MATCH HEURISTICS
// ============================================

export interface StayMatchResult {
  isMatch: boolean;
  confidence: ConfidenceLevel;
  score: number;                    // 0-100
  details: {
    nameScore: number;              // 0-100 fuzzy match
    datesMatch: boolean;
    occupancyMatch: boolean;
    locationScore: number;          // 0-100
    priceReasonable: boolean;       // Within 50% of portal
  };
  warnings: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Detect stay page type from URL
 */
export function detectStayPageType(url: string): StayPageType {
  const urlLower = url.toLowerCase();
  
  // Simple path-based detection first (most reliable)
  // Check for /book in the path - this is the checkout/booking page
  if (urlLower.includes('/book')) {
    return 'checkout';
  }
  
  // Check for /customize in the path
  if (urlLower.includes('/customize')) {
    return 'customize';
  }
  
  // Check for /checkout in the path
  if (urlLower.includes('/checkout')) {
    return 'checkout';
  }
  
  // Check for /shop in the path - this is the room selection page
  if (urlLower.includes('/shop')) {
    return 'shop';
  }
  
  // Check for /availability in the path - this is search results
  if (urlLower.includes('/availability')) {
    return 'availability';
  }
  
  // Fallback: Check with regex patterns for more complex cases
  const { URL_PATTERNS } = STAYS_CONSTANTS;
  if (URL_PATTERNS.BOOK.test(url)) return 'checkout';
  if (URL_PATTERNS.CUSTOMIZE.test(url)) return 'customize';
  if (URL_PATTERNS.CHECKOUT.test(url)) return 'checkout';
  if (URL_PATTERNS.SHOP.test(url)) return 'shop';
  if (URL_PATTERNS.AVAILABILITY.test(url)) return 'availability';
  
  // Also check if URL contains lodgingS parameter (booking flow indicator)
  if (urlLower.includes('lodgings')) return 'checkout';
  
  return 'unknown';
}

/**
 * Detect accommodation type from page content
 */
export function detectAccommodationType(
  url: string,
  pageText: string
): StayAccommodationType {
  const urlLower = url.toLowerCase();
  const textLower = pageText.toLowerCase();
  
  // Check URL first
  if (urlLower.includes('vacation-rental') || urlLower.includes('vrbo')) {
    return 'vacation_rental';
  }
  
  // Check page content
  if (
    textLower.includes('vacation rental') ||
    textLower.includes('entire home') ||
    textLower.includes('entire apartment') ||
    textLower.includes('private home')
  ) {
    return 'vacation_rental';
  }
  
  // Default to hotel if not clearly VR
  if (
    textLower.includes('hotel') ||
    textLower.includes('resort') ||
    textLower.includes('inn') ||
    textLower.includes('suites')
  ) {
    return 'hotel';
  }
  
  return 'unknown';
}

/**
 * Get portal earn rate based on accommodation type
 */
export function getPortalEarnRate(type: StayAccommodationType): number {
  switch (type) {
    case 'hotel':
      return STAYS_CONSTANTS.PORTAL_HOTELS_RATE;
    case 'vacation_rental':
      return STAYS_CONSTANTS.PORTAL_VACATION_RENTALS_RATE;
    default:
      return STAYS_CONSTANTS.PORTAL_HOTELS_RATE; // Default to hotel rate
  }
}

/**
 * Calculate nights between two dates
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  } catch {
    return 1;
  }
}

/**
 * Parse search context from URL parameters
 */
export function parseStaySearchContextFromUrl(url: string): Partial<StaySearchContext> {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    const checkIn = params.get('fromDate') || params.get('checkIn') || '';
    const checkOut = params.get('untilDate') || params.get('checkOut') || '';
    const adults = parseInt(params.get('adultsCount') || params.get('adults') || '2', 10);
    const rooms = parseInt(params.get('roomsCount') || params.get('rooms') || '1', 10);
    const children = parseInt(params.get('childrenCount') || params.get('children') || '0', 10);
    
    // Extract place from URL path - support both /stays/ and /hotels/ patterns
    let place = '';
    
    // Try /stays/availability/PLACE pattern
    const staysMatch = url.match(/\/stays\/availability\/([^\/\?]+)/);
    if (staysMatch) {
      place = decodeURIComponent(staysMatch[1]).replace(/-/g, ' ');
    }
    
    // Try /hotels/book/ or /hotels/shop/ patterns - extract from lodgingSelection
    if (!place) {
      const hotelsMatch = url.match(/\/hotels\/(book|shop)/);
      if (hotelsMatch) {
        // For hotels booking flow, place will come from lodgingSelection or page content
        place = ''; // Will be filled from DOM or lodgingSelection
      }
    }
    
    // Try lodgingSelection JSON if present (common on shop/checkout pages)
    const lodgingSelection = params.get('lodgingSelection');
    if (lodgingSelection) {
      try {
        const selection = JSON.parse(lodgingSelection);
        // Priority: searchTerm > city > name > location
        if (selection.searchTerm && !place) place = selection.searchTerm;
        if (selection.city && !place) place = selection.city;
        if (selection.name && !place) place = selection.name;
        if (selection.location && !place) place = selection.location;
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    // Also check lodgingS param (shorthand version used in some URLs)
    const lodgingS = params.get('lodgingS');
    if (lodgingS && !place) {
      try {
        const selection = JSON.parse(lodgingS);
        if (selection.city) place = selection.city;
        if (selection.name) place = selection.name;
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;
    
    return {
      place: place || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      nights: nights || undefined,
      adults: adults || 2,
      children: children > 0 ? children : undefined,
      rooms: rooms || 1,
      source: 'url',
      extractedAt: Date.now(),
    };
  } catch {
    return {};
  }
}

/**
 * Build Google Hotels search URL from stay context
 *
 * Google Hotels uses a specific URL format:
 * - Base: https://www.google.com/travel/hotels
 * - Dates: Combined `dates=YYYY-MM-DD_YYYY-MM-DD` format (underscore-separated)
 * - Guests: `adults=N` and `rooms=N` params
 */
export function buildGoogleHotelsUrl(
  context: StaySearchContext,
  propertyName?: string
): string {
  const baseUrl = 'https://www.google.com/travel/hotels';
  
  // Build search query
  const searchTerms: string[] = [];
  
  if (propertyName) {
    searchTerms.push(propertyName);
  }
  if (context.place) {
    searchTerms.push(context.place);
  }
  
  const params = new URLSearchParams();
  
  if (searchTerms.length > 0) {
    params.set('q', searchTerms.join(' '));
  }
  
  // Add dates in Google Hotels format: dates=YYYY-MM-DD_YYYY-MM-DD
  // This combined format is what Google Hotels actually uses to populate the date fields
  if (context.checkIn && context.checkOut) {
    params.set('dates', `${context.checkIn}_${context.checkOut}`);
  } else if (context.checkIn) {
    // Fallback: if only checkIn, estimate checkout as checkIn + nights or +1
    const nights = context.nights || 1;
    const checkInDate = new Date(context.checkIn);
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + nights);
    const checkOut = checkOutDate.toISOString().split('T')[0];
    params.set('dates', `${context.checkIn}_${checkOut}`);
  }
  
  // Add occupancy - Google Hotels uses "adults" and "rooms" params
  params.set('adults', String(context.adults || 2));
  params.set('rooms', String(context.rooms || 1));
  
  // Add children if present
  if (context.children && context.children > 0) {
    params.set('children', String(context.children));
  }
  
  // Add language/country for consistency
  params.set('hl', 'en');
  params.set('gl', 'us');
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Fuzzy match property names (simple Levenshtein-based)
 */
export function fuzzyMatchPropertyName(name1: string, name2: string): number {
  const normalize = (s: string) => 
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  // Exact match
  if (n1 === n2) return 100;
  
  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 90;
  
  // Word overlap
  const words1 = new Set(n1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(n2.split(' ').filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  const jaccard = intersection.size / union.size;
  
  // Penalize if key words are different
  const keyWords = ['hilton', 'marriott', 'hyatt', 'inn', 'hotel', 'resort', 'suites'];
  const hasConflictingBrand = keyWords.some(kw => 
    (n1.includes(kw) || n2.includes(kw)) && 
    !([...intersection].some(w => w.includes(kw)))
  );
  
  if (hasConflictingBrand) {
    return Math.min(40, jaccard * 100);
  }
  
  return Math.round(jaccard * 100);
}

/**
 * Generate unique capture ID
 */
export function generateCaptureId(): string {
  return `stay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format price for display
 */
export function formatStayPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date range for display
 */
export function formatDateRange(checkIn: string, checkOut: string): string {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  } catch {
    return `${checkIn} - ${checkOut}`;
  }
}
