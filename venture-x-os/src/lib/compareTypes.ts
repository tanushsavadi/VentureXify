// ============================================
// CAPTURE & COMPARE TYPES
// ============================================

import { ConfidenceLevel, BookingType } from './types';

// ============================================
// COMPARE SESSION STATUS
// ============================================

export type CompareSessionStatus =
  | 'INIT'
  | 'PORTAL_CAPTURED'
  | 'DIRECT_OPENED'
  | 'DIRECT_CAPTURED'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED';

// ============================================
// PRICE SNAPSHOT
// ============================================

export type PriceLabel = 'total' | 'perNight' | 'perPerson' | 'unknown';

export interface PriceSnapshot {
  amount: number;
  currency: string;
  confidence: ConfidenceLevel;
  label: PriceLabel;
  extractedAt: number;
  source: 'auto' | 'manual';
}

// ============================================
// ITINERARY FINGERPRINT
// ============================================

export interface FlightFingerprint {
  type: 'flight';
  origin?: string; // IATA code
  destination?: string; // IATA code
  departDate?: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD (optional for one-way)
  cabin?: 'economy' | 'premium' | 'business' | 'first' | 'unknown';
  cabinFull?: string; // Full fare class name e.g., "Economy Convenience", "Business Class"
  paxCount?: number;
  flightNumbers?: string[]; // e.g., ['DL123', 'DL456']
  operatingCarrier?: string; // Airline code
  operatingCarrierName?: string; // e.g., 'Delta Air Lines'
  
  // Detailed OUTBOUND flight info for matching on Google Flights
  departureTime?: string; // HH:MM (24h format)
  arrivalTime?: string; // HH:MM (24h format)
  arrivalNextDay?: number; // +1 or +2 if arrives next day(s), 0 or undefined if same day
  departureTimezone?: string; // Timezone of departure airport (e.g., 'Asia/Dubai')
  arrivalTimezone?: string; // Timezone of arrival airport (e.g., 'America/New_York')
  duration?: string; // e.g., "18hr 20min"
  stops?: number; // 0 = nonstop, 1 = 1 stop, etc.
  stopAirports?: string[]; // e.g., ['LHR'] for layover airports
  airlines?: string[]; // All airline names involved (for codeshares)
  layoverDurations?: string[]; // e.g., ['2h 30m', '1h 15m'] for each layover
  totalLayoverTime?: string; // e.g., "3h 45m" total layover time
  
  // RETURN flight details (for round trips)
  returnDepartureTime?: string; // HH:MM (24h format)
  returnArrivalTime?: string; // HH:MM (24h format)
  returnArrivalNextDay?: number; // +1 or +2 if arrives next day(s), 0 or undefined if same day
  returnDepartureTimezone?: string; // Timezone of return departure (destination airport)
  returnArrivalTimezone?: string; // Timezone of return arrival (origin airport)
  returnDuration?: string; // e.g., "17h 30m"
  returnStops?: number; // 0 = nonstop, 1 = 1 stop, etc.
  returnStopAirports?: string[]; // e.g., ['DOH'] for layover airports
  returnLayoverDurations?: string[]; // e.g., ['4h 0m'] for each layover
  returnTotalLayoverTime?: string; // e.g., "4h 0m" total layover time
  returnAirlines?: string[]; // Airlines for return leg
}

export interface HotelFingerprint {
  type: 'hotel';
  hotelName?: string;
  city?: string;
  checkinDate?: string; // YYYY-MM-DD
  checkoutDate?: string; // YYYY-MM-DD
  nights?: number;
  roomCount?: number;
  guestCount?: number;
  brandCode?: string; // e.g., 'marriott', 'hilton'
}

export interface RentalFingerprint {
  type: 'rental';
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string; // YYYY-MM-DD
  dropoffDate?: string; // YYYY-MM-DD
  carClass?: string;
  company?: string;
}

export type ItineraryFingerprint = FlightFingerprint | HotelFingerprint | RentalFingerprint;

// ============================================
// PORTAL & DIRECT SNAPSHOTS
// ============================================

export interface PortalSnapshot {
  bookingType: BookingType;
  totalPrice: PriceSnapshot;
  itinerary?: ItineraryFingerprint;
  providerName?: string; // e.g., 'Delta Air Lines'
  providerCode?: string; // e.g., 'DL'
  providerLogoUrl?: string;
  pageType: 'search' | 'details' | 'checkout' | 'unknown';
  capturedAt: number;
}

export interface BookingOption {
  provider: string;         // e.g., "KLM", "Delta", "Booking.com"
  providerType: 'airline' | 'ota' | 'metasearch' | 'unknown';
  price: number;
  currency: string;
  isLowest: boolean;
}

export interface DirectSnapshot {
  totalPrice: PriceSnapshot;
  siteName: string;
  siteUrl: string;
  pageType: 'search' | 'details' | 'checkout' | 'unknown';
  capturedAt: number;
  // NEW: Seller information extracted from Google Flights booking page
  sellerType?: 'airline' | 'ota' | 'metasearch' | 'unknown';
  sellerName?: string;         // e.g., "KLM", "Delta", "Booking.com"
  bookingOptions?: BookingOption[];  // All available booking options
  lowestPriceProvider?: string;      // Which provider has the lowest price
}

// ============================================
// COMPARE SESSION
// ============================================

export interface CompareSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  
  // Portal tab info
  portalTabId: number;
  portalUrl: string;
  portalSnapshot?: PortalSnapshot;
  
  // Direct tab info
  directTabId?: number;
  directUrl?: string;
  directSnapshot?: DirectSnapshot;
  
  // Status tracking
  status: CompareSessionStatus;
  statusMessage?: string;
  failureReason?: string;
  
  // Final result
  confidence: ConfidenceLevel;
  
  // User actions
  userCancelled?: boolean;
  manualPriceEntry?: boolean;
}

// ============================================
// COMPARISON RESULT (for Decision Card)
// ============================================

export interface ComparisonResult {
  sessionId: string;
  
  // Prices
  portalPrice: number;
  directPrice: number;
  delta: number; // portal - direct (positive = portal more expensive)
  deltaPercent: number;
  
  // Break-even calculation
  breakEvenPremium: number;
  portalPointsEarned: number;
  directPointsEarned: number;
  portalPointsValue: number;
  directPointsValue: number;
  
  // Winner determination
  winner: 'portal' | 'direct' | 'tie';
  netDifference: number; // absolute value accounting for points
  
  // Metadata
  confidence: ConfidenceLevel;
  notes: string[];
  assumptions: string[];
  
  // Timestamps
  createdAt: number;
  portalCapturedAt: number;
  directCapturedAt: number;
  
  // For display
  itinerarySummary?: string;
  providerName?: string;
}

// ============================================
// MESSAGE TYPES FOR COMPARE FLOW
// ============================================

export type CompareMessageType =
  | 'VX_COMPARE_START'
  | 'VX_COMPARE_CAPTURE_PORTAL'
  | 'VX_COMPARE_PORTAL_CAPTURED'
  | 'VX_COMPARE_CAPTURE_DIRECT'
  | 'VX_COMPARE_DIRECT_CAPTURED'
  | 'VX_COMPARE_OPEN_DIRECT'
  | 'VX_COMPARE_STATUS_UPDATE'
  | 'VX_COMPARE_RESULT'
  | 'VX_COMPARE_CANCEL'
  | 'VX_COMPARE_MANUAL_PRICE'
  | 'VX_COMPARE_GET_SESSION'
  | 'VX_COMPARE_GET_ACTIVE'
  | 'VX_COMPARE_CLEAR_HISTORY'
  | 'VX_AUTO_COMPARE_START'
  | 'VX_TRIP_DETECTED'
  | 'VX_COMPARE_ERROR'
  | 'VX_GET_CURRENT_TAB_ID'
  | 'VX_RETURN_TO_PORTAL'
  | 'VX_DIRECT_HELPER_CLOSED'
  | 'VX_SHOW_DIRECT_HELPER'
  | 'VX_DIRECT_HELPER_STATUS'
  | 'VX_HIDE_DIRECT_HELPER'
  | 'VX_DIRECT_PRICE_CAPTURED';

export interface CompareMessage<T = unknown> {
  type: CompareMessageType;
  sessionId?: string;
  payload?: T;
  error?: string;
}

export interface PortalCapturedPayload {
  portalSnapshot: PortalSnapshot;
  tabId: number;
  url: string;
}

export interface DirectCapturedPayload {
  directSnapshot: DirectSnapshot;
  tabId: number;
  url: string;
}

export interface StatusUpdatePayload {
  status: CompareSessionStatus;
  message?: string;
  progress?: number; // 0-100
}

export interface ManualPricePayload {
  price: number;
  isPortal: boolean;
  currency?: string;
}

// ============================================
// AIRLINE DIRECT LINK CONFIG
// ============================================

export interface AirlineConfig {
  code: string; // IATA code
  name: string;
  domain: string;
  searchUrl: string;
  supportsDeepLink: boolean;
  priceSelectors: string[];
  totalPricePattern?: RegExp;
}

export const AIRLINE_CONFIGS: AirlineConfig[] = [
  {
    code: 'DL',
    name: 'Delta Air Lines',
    domain: 'delta.com',
    searchUrl: 'https://www.delta.com/flight-search/book-a-flight',
    supportsDeepLink: false,
    priceSelectors: [
      '[data-testid="totalPrice"]',
      '[data-testid="fare-price"]',
      '.fare-price',
      '.total-amount',
      '[class*="totalPrice"]',
      '[class*="price"]',
    ],
    totalPricePattern: /Total[:\s]*\$[\d,]+(\.\d{2})?/i,
  },
  {
    code: 'UA',
    name: 'United Airlines',
    domain: 'united.com',
    searchUrl: 'https://www.united.com/en/us/book-flight/united-airlines',
    supportsDeepLink: false,
    priceSelectors: [
      '[data-testid="price-summary-total"]',
      '.atm-c-price',
      '.booking-total',
      '[class*="TotalPrice"]',
      '[class*="price"]',
    ],
    totalPricePattern: /Total[:\s]*\$[\d,]+(\.\d{2})?/i,
  },
  {
    code: 'AA',
    name: 'American Airlines',
    domain: 'aa.com',
    searchUrl: 'https://www.aa.com/booking/find-flights',
    supportsDeepLink: false,
    priceSelectors: [
      '[data-testid="trip-total"]',
      '.trip-total',
      '.aa-price',
      '[class*="totalPrice"]',
      '[class*="price"]',
    ],
    totalPricePattern: /Total[:\s]*\$[\d,]+(\.\d{2})?/i,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAirlineConfig(code: string): AirlineConfig | undefined {
  return AIRLINE_CONFIGS.find(
    (c) => c.code.toLowerCase() === code.toLowerCase()
  );
}

export function getAirlineByDomain(domain: string): AirlineConfig | undefined {
  return AIRLINE_CONFIGS.find((c) => domain.includes(c.domain));
}

export function createEmptySession(portalTabId: number, portalUrl: string): CompareSession {
  const now = Date.now();
  return {
    id: `cmp_${now}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    portalTabId,
    portalUrl: sanitizeUrl(portalUrl),
    status: 'INIT',
    confidence: 'LOW',
  };
}

/**
 * Sanitize URL by removing sensitive query parameters
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove potentially sensitive params
    const sensitiveParams = ['token', 'auth', 'session', 'key', 'secret', 'password'];
    sensitiveParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate time ago string
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 120) return '1 minute ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 7200) return '1 hour ago';
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

/**
 * Generate itinerary summary string
 */
export function generateItinerarySummary(fingerprint?: ItineraryFingerprint): string {
  if (!fingerprint) return 'Unknown itinerary';
  
  switch (fingerprint.type) {
    case 'flight': {
      const { origin, destination, departDate, returnDate } = fingerprint;
      const route = origin && destination ? `${origin} → ${destination}` : 'Unknown route';
      const dates = departDate ? (returnDate ? `${departDate} - ${returnDate}` : departDate) : '';
      return `${route}${dates ? ` • ${dates}` : ''}`;
    }
    case 'hotel': {
      const { hotelName, city, checkinDate, checkoutDate, nights } = fingerprint;
      const location = hotelName || city || 'Unknown hotel';
      const duration = nights ? `${nights} nights` : (checkinDate && checkoutDate ? `${checkinDate} - ${checkoutDate}` : '');
      return `${location}${duration ? ` • ${duration}` : ''}`;
    }
    case 'rental': {
      const { pickupLocation, pickupDate, dropoffDate } = fingerprint;
      const location = pickupLocation || 'Unknown location';
      const dates = pickupDate ? (dropoffDate ? `${pickupDate} - ${dropoffDate}` : pickupDate) : '';
      return `${location}${dates ? ` • ${dates}` : ''}`;
    }
    default:
      return 'Unknown itinerary';
  }
}
