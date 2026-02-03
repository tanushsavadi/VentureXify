// ============================================
// DECISION CARD TYPES
// ============================================

export type DecisionCardType =
  | 'PORTAL_DIRECT'
  | 'PRICE_MATCH'
  | 'PRICE_DROP'
  | 'REDEEM_DECISION'
  | 'ERASER_ITEM'
  | 'THIS_WEEK'
  | 'CLAIM_KIT';

export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW';

export interface KeyNumber {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface DecisionCardAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  action: string; // Action identifier for handling
}

export interface DecisionCard {
  id: string;
  type: DecisionCardType;
  title: string;
  summary: string;
  keyNumbers: KeyNumber[];
  confidence: ConfidenceLevel;
  assumptions: string[];
  actions: DecisionCardAction[];
  createdAt: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// BOOKING & TRAVEL TYPES
// ============================================

export type BookingType = 'flight' | 'hotel' | 'rental' | 'vacation_rental' | 'other';

export interface PriceData {
  amount: number;
  currency: string;
  source: 'extracted' | 'manual';
  isTotal: boolean;
  perNightOrLeg?: boolean;
  confidence: ConfidenceLevel;
}

export interface SiteDetection {
  domain: string;
  siteName: string;
  bookingType: BookingType;
  isSupported: boolean;
  isPortal: boolean;
}

export interface PortalDirectComparison {
  directPrice: PriceData;
  portalPrice: PriceData;
  bookingType: BookingType;
  pointsEarnedDirect: number;
  pointsEarnedPortal: number;
  valueDirect: number;
  valuePortal: number;
  netDifference: number;
  winner: 'direct' | 'portal' | 'tie';
  breakEvenPremium: number;
}

// ============================================
// ERASER QUEUE TYPES
// ============================================

export type EraserItemStatus = 'pending' | 'erased' | 'not_eligible' | 'ignored' | 'expired';

export interface EraserItem {
  id: string;
  merchant: string;
  amount: number;
  purchaseDate: number; // timestamp
  expiryDate: number; // purchase date + 90 days
  status: EraserItemStatus;
  notes?: string;
  createdAt: number;
}

// ============================================
// PERKS & CREDITS TYPES
// ============================================

export interface TravelCredit {
  id: string;
  name: string;
  totalValue: number;
  usedValue: number;
  resetDate?: number;
  notes?: string;
}

export interface PerkItem {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  completedAt?: number;
  category: 'activation' | 'credit' | 'benefit' | 'status';
}

export interface PerksChecklist {
  priorityPassActivated: boolean;
  globalEntryUsed: boolean;
  partnerStatusEnrolled: boolean;
  travelCreditUsed: number; // amount used
  loungeVisitsYTD: number;
  customItems: PerkItem[];
}

// ============================================
// USER PREFERENCES (SYNC STORAGE)
// ============================================

export type TravelFrequency = 'rare' | 'occasional' | 'frequent' | 'very_frequent';

export type AIProvider = 'groq' | 'openai';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
}

export interface UserPreferences {
  milesValuationCents: number; // default 1.0
  caresAboutStatus: boolean;
  travelFrequency: TravelFrequency;
  renewalDate?: number;
  annualFeeOverride?: number;
  notificationPreferences: {
    eraserReminders: boolean;
    priceDropAlerts: boolean;
    weeklyDigest: boolean;
  };
  theme: 'light' | 'dark' | 'oled' | 'system';
  onboardingCompleted: boolean;
  widgetEnabled: boolean;
  ai: AISettings;
}

// ============================================
// LOCAL STORAGE TYPES
// ============================================

export interface Trip {
  id: string;
  name: string;
  startDate?: number;
  endDate?: number;
  decisions: string[]; // Decision card IDs
  notes?: string;
  createdAt: number;
}

export interface LocalStorageData {
  decisionHistory: DecisionCard[];
  eraserQueue: EraserItem[];
  perksChecklist: PerksChecklist;
  travelCreditWallet: TravelCredit[];
  trips: Trip[];
  priceDropTrackers: PriceDropTracker[];
  schemaVersion: number;
}

export interface PriceDropTracker {
  id: string;
  bookingDate: number;
  flightDetails: string;
  originalPrice: number;
  monitoringEndDate: number;
  status: 'active' | 'completed' | 'dropped';
  currentLowestPrice?: number;
  priceDropAmount?: number;
  createdAt: number;
}

// ============================================
// MESSAGE TYPES (Extension Communication)
// ============================================

export type MessageType =
  | 'GET_PRICE_DATA'
  | 'PRICE_DATA_RESPONSE'
  | 'OPEN_SIDE_PANEL'
  | 'VX_OPEN_SIDE_PANEL'
  | 'TOGGLE_WIDGET'
  | 'SITE_DETECTED'
  | 'SAVE_DECISION'
  | 'GET_DECISIONS'
  | 'UPDATE_PREFERENCES'
  | 'SCHEDULE_REMINDER'
  | 'GET_ERASER_QUEUE';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  tabId?: number;
}

export interface PriceDataPayload {
  price: PriceData | null;
  site: SiteDetection;
}

// ============================================
// CALCULATOR INPUT/OUTPUT TYPES
// ============================================

export interface PortalDirectInput {
  directPrice: number;
  portalPrice: number;
  bookingType: BookingType;
  milesValuation: number;
  caresAboutStatus: boolean;
}

export interface RedemptionInput {
  cashPrice: number;
  milesBalance: number;
  targetCPM: number;
  isEraserEligible: boolean;
}

export interface RedemptionOutput {
  eraserValue: number;
  eraserCPM: number;
  transferRecommended: boolean;
  transferThreshold: number;
  portalRecommended: boolean;
  recommendation: 'eraser' | 'transfer' | 'portal' | 'cash';
  reasoning: string[];
}

export interface PriceMatchInput {
  isConfirmed: boolean;
  hoursSinceBooking: number;
  competitorPrice: number;
  originalPrice: number;
  sameDates: boolean;
  sameRoomType: boolean;
  sameCancellation: boolean;
  sameOccupancy: boolean;
}

export interface PriceMatchOutput {
  eligible: boolean;
  confidence: ConfidenceLevel;
  savings: number;
  checklist: { item: string; passed: boolean }[];
  claimDeadline: number;
  scriptTemplate: string;
}

// ============================================
// UI STATE TYPES
// ============================================

export type TabId = 'book' | 'redeem' | 'perks';

export interface UIState {
  activeTab: TabId;
  isLoading: boolean;
  currentSite: SiteDetection | null;
  detectedPrice: PriceData | null;
  showSettings: boolean;
  showOnboarding: boolean;
}

// ============================================
// CONSTANTS
// ============================================

export const VENTURE_X_CONSTANTS = {
  ANNUAL_FEE: 395,
  
  // ============================================
  // EARN RATES - SINGLE SOURCE OF TRUTH
  // Capital One Venture X earn rates via portal
  // ============================================
  
  // Portal earn rates by booking type
  PORTAL_HOTELS_MULTIPLIER: 10,           // 10x on hotels via Capital One Travel
  PORTAL_RENTAL_CARS_MULTIPLIER: 10,      // 10x on rental cars via Capital One Travel
  PORTAL_FLIGHTS_MULTIPLIER: 5,           // 5x on flights via Capital One Travel
  PORTAL_VACATION_RENTALS_MULTIPLIER: 5,  // 5x on vacation rentals (Vrbo, etc.)
  PORTAL_OTHER_MULTIPLIER: 5,             // 5x on other portal bookings
  
  // Non-portal (direct) earn rate
  BASE_MULTIPLIER: 2,                     // 2x on everything outside portal
  
  // DEPRECATED: Use getPortalMultiplier() instead
  // Keeping for backwards compatibility but DO NOT USE for new code
  PORTAL_MULTIPLIER: 5,                   // @deprecated - use getPortalMultiplier()
  
  // Travel credit - PORTAL ONLY
  TRAVEL_CREDIT: 300,
  CREDIT_PORTAL_ONLY: true,               // CRITICAL: Credit only works for portal bookings
  
  // Eraser
  ERASER_WINDOW_DAYS: 90,
  ERASER_MIN_REDEMPTION: 0,               // NO MINIMUM - Capital One allows any amount
  ERASER_CPM: 1.0,                        // 1 cent per mile for eraser
  ERASER_MILES_PER_DOLLAR: 100,           // 100 miles = $1
  
  // Perks
  PRIORITY_PASS_VALUE: 32,                // per visit estimate
  GLOBAL_ENTRY_CREDIT: 100,
  ANNIVERSARY_MILES: 10000,               // 10,000 miles per year
  
  // Valuation defaults
  DEFAULT_MILES_VALUATION: 1.7,           // cents per mile (1.7¢)
  DEFAULT_MILES_VALUATION_CPP: 0.017,     // cpp format (0.017 = 1.7¢)
} as const;

// ============================================
// EARN RATE HELPERS - SINGLE SOURCE OF TRUTH
// These functions ensure consistent multiplier usage across the codebase
// ============================================

/**
 * Get the portal earn multiplier for a given booking type.
 * THIS IS THE SINGLE SOURCE OF TRUTH for portal multipliers.
 *
 * @param bookingType - The type of booking ('flight', 'hotel', 'rental', 'vacation_rental', 'other')
 * @returns The portal multiplier (e.g., 10 for hotels, 5 for flights)
 */
export function getPortalMultiplier(bookingType: BookingType): number {
  switch (bookingType) {
    case 'hotel':
      return VENTURE_X_CONSTANTS.PORTAL_HOTELS_MULTIPLIER;    // 10x
    case 'rental':
      return VENTURE_X_CONSTANTS.PORTAL_RENTAL_CARS_MULTIPLIER; // 10x
    case 'flight':
      return VENTURE_X_CONSTANTS.PORTAL_FLIGHTS_MULTIPLIER;   // 5x
    case 'vacation_rental':
      return VENTURE_X_CONSTANTS.PORTAL_VACATION_RENTALS_MULTIPLIER; // 5x
    case 'other':
    default:
      return VENTURE_X_CONSTANTS.PORTAL_OTHER_MULTIPLIER;     // 5x
  }
}

/**
 * Get the multiplier label for display (e.g., "10x Hotels", "5x Flights")
 */
export function getPortalMultiplierLabel(bookingType: BookingType): string {
  const multiplier = getPortalMultiplier(bookingType);
  const typeLabels: Record<BookingType, string> = {
    hotel: 'Hotels',
    rental: 'Rental Cars',
    flight: 'Flights',
    vacation_rental: 'Vacation Rentals',
    other: 'Other',
  };
  return `${multiplier}x ${typeLabels[bookingType] || 'Portal'}`;
}

/**
 * Get the base (non-portal) earn rate. Always 2x for Venture X.
 */
export function getBaseMultiplier(): number {
  return VENTURE_X_CONSTANTS.BASE_MULTIPLIER; // 2x
}

export const SUPPORTED_SITES = [
  { domain: 'google.com/travel', name: 'Google Flights', type: 'flight' as BookingType, isPortal: false },
  { domain: 'delta.com', name: 'Delta', type: 'flight' as BookingType, isPortal: false },
  { domain: 'united.com', name: 'United', type: 'flight' as BookingType, isPortal: false },
  { domain: 'aa.com', name: 'American Airlines', type: 'flight' as BookingType, isPortal: false },
  { domain: 'southwest.com', name: 'Southwest', type: 'flight' as BookingType, isPortal: false },
  { domain: 'marriott.com', name: 'Marriott', type: 'hotel' as BookingType, isPortal: false },
  { domain: 'hilton.com', name: 'Hilton', type: 'hotel' as BookingType, isPortal: false },
  { domain: 'hyatt.com', name: 'Hyatt', type: 'hotel' as BookingType, isPortal: false },
  { domain: 'expedia.com', name: 'Expedia', type: 'other' as BookingType, isPortal: false },
  { domain: 'capitalone.com', name: 'Capital One Travel', type: 'flight' as BookingType, isPortal: true },
] as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  milesValuationCents: VENTURE_X_CONSTANTS.DEFAULT_MILES_VALUATION,
  caresAboutStatus: false,
  travelFrequency: 'occasional',
  notificationPreferences: {
    eraserReminders: true,
    priceDropAlerts: true,
    weeklyDigest: false,
  },
  theme: 'system',
  onboardingCompleted: false,
  widgetEnabled: true,
  ai: {
    enabled: false,
    provider: 'groq',
    apiKey: '',
  },
};

export const DEFAULT_LOCAL_DATA: LocalStorageData = {
  decisionHistory: [],
  eraserQueue: [],
  perksChecklist: {
    priorityPassActivated: false,
    globalEntryUsed: false,
    partnerStatusEnrolled: false,
    travelCreditUsed: 0,
    loungeVisitsYTD: 0,
    customItems: [],
  },
  travelCreditWallet: [],
  trips: [],
  priceDropTrackers: [],
  schemaVersion: 1,
};
