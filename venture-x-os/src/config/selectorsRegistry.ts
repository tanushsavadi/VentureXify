// ============================================
// SELECTOR REGISTRY - Centralized Site Selectors
// ============================================
// One place for all selectors, patterns, and site metadata
// Allows easy updates without hunting across 1400-line files

// ============================================
// TYPES
// ============================================

/**
 * Feature flags for site-specific behaviors
 */
export interface SiteFeatureFlags {
  /** Site uses Shadow DOM for some components */
  usesShadowDom?: boolean;
  
  /** Site is an SPA (needs mutation observer) */
  isSPA?: boolean;
  
  /** Site uses obfuscated class names (need heuristics) */
  obfuscatedClassesLikely?: boolean;
  
  /** Site lazy-loads checkout summary */
  lazyLoadsCheckout?: boolean;
  
  /** Site uses iframes for price display */
  usesIframes?: boolean;
  
  /** Site has aggressive A/B testing */
  frequentABTests?: boolean;
  
  /** Price displayed in different currency than booking */
  multiCurrencyDisplay?: boolean;
}

/**
 * Price selector configuration
 */
export interface PriceSelectorConfig {
  /** Primary selectors - most reliable when valid */
  primary: string[];
  
  /** Fallback selectors - try if primary fails */
  fallback?: string[];
  
  /** Semantic selectors - aria-label, role patterns */
  semantic?: string[];
  
  /** Container selectors - narrow search scope */
  container?: string[];
}

/**
 * Regex patterns for extraction
 */
export interface SiteRegexPatterns {
  /** Pattern to match total price labels */
  totalLabelRegex?: RegExp;
  
  /** Pattern to match price values */
  priceRegex?: RegExp;
  
  /** Pattern to match taxes/fees */
  taxesRegex?: RegExp;
  
  /** Pattern to match per-night labels */
  perNightRegex?: RegExp;
  
  /** Pattern to match "from" prices */
  fromPriceRegex?: RegExp;
}

/**
 * Complete site selector configuration
 */
export interface SiteSelectorConfig {
  /** Unique identifier for the site (hostname or pattern) */
  siteKey: string;
  
  /** Display name for the site */
  siteName: string;
  
  /** Version of this config (for cache invalidation) */
  version: string;
  
  /** Last updated timestamp */
  lastUpdated: string;
  
  /** Site type */
  siteType: 'airline' | 'portal' | 'hotel' | 'metasearch' | 'ota';
  
  /** Booking type this site handles */
  bookingType: 'flight' | 'stay' | 'rental' | 'multi';
  
  /** Price selectors */
  selectors: {
    totalPrice: PriceSelectorConfig;
    taxesFees?: PriceSelectorConfig;
    perNight?: PriceSelectorConfig;
    basePrice?: PriceSelectorConfig;
    checkoutContainer?: string[];
    
    // Entity selectors
    airlineName?: string[];
    flightTimes?: string[];
    flightDuration?: string[];
    stops?: string[];
    
    propertyName?: string[];
    roomType?: string[];
    cancellationPolicy?: string[];
    checkInOut?: string[];
    guestCount?: string[];
    starRating?: string[];
  };
  
  /** Regex patterns */
  regex?: SiteRegexPatterns;
  
  /** Feature flags */
  featureFlags?: SiteFeatureFlags;
  
  /** Notes for maintainers */
  notes?: string;
  
  /** Known issues */
  knownIssues?: string[];
  
  /** Confidence modifier (-20 to +20) for this site's extraction */
  confidenceModifier?: number;
}

/**
 * User override for a specific site/field
 */
export interface UserSelectorOverride {
  siteKey: string;
  field: keyof SiteSelectorConfig['selectors'];
  selectors: string[];
  createdAt: number;
  successCount: number;
  failCount: number;
  lastUsedAt?: number;
  source: 'user_pick' | 'manual' | 'auto_learned';
}

// ============================================
// BUILT-IN REGISTRY
// ============================================

/**
 * Built-in selector registry for supported sites
 */
export const SELECTOR_REGISTRY: SiteSelectorConfig[] = [
  // ==========================================
  // GOOGLE FLIGHTS
  // ==========================================
  {
    siteKey: 'google.com/travel/flights',
    siteName: 'Google Flights',
    version: '2026-01-21',
    lastUpdated: '2026-01-21',
    siteType: 'metasearch',
    bookingType: 'flight',
    selectors: {
      totalPrice: {
        primary: [
          '[class*="FpEdX"] span', // Main price display
          '[class*="YMlIz"]', // Total price container
          '[class*="gOatQ"]', // Search result price
          '[class*="u3FI0d"]', // Flight price
          '[class*="jBp0Xe"]', // Booking price
        ],
        fallback: [
          '[aria-label*="total" i]',
          '[aria-label*="price" i]',
          '[data-gs="CgZyZXN1bHQ"]',
        ],
        semantic: [
          '[role="heading"] + div [class*="price"]',
          'button[class*="continue"] span',
        ],
        container: [
          '[class*="booking-options"]',
          '.gws-flights-book__booking-option',
          '[class*="gws-flights-book"]',
        ],
      },
    },
    regex: {
      totalLabelRegex: /(?:Total|Lowest\s+total\s+price)/i,
      priceRegex: /(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)\s*[\d,]+(?:\.\d{2})?/gi,
    },
    featureFlags: {
      isSPA: true,
      obfuscatedClassesLikely: true,
      frequentABTests: true,
    },
    notes: 'Google Flights uses heavily obfuscated classes. Heuristics work better.',
    knownIssues: [
      'Class names change frequently',
      'Multi-currency display can confuse extraction',
      'Booking page vs search page have different structures',
    ],
    confidenceModifier: -5, // Less confident due to obfuscation
  },
  
  // ==========================================
  // CAPITAL ONE TRAVEL (PORTAL)
  // ==========================================
  {
    siteKey: 'travel.capitalone.com',
    siteName: 'Capital One Travel',
    version: '2026-01-22',
    lastUpdated: '2026-01-22',
    siteType: 'portal',
    bookingType: 'multi',
    selectors: {
      totalPrice: {
        primary: [
          '[data-testid*="total"]',
          '[data-testid*="price"]',
          '[class*="total-price"]',
          '[class*="totalPrice"]',
          '[class*="TotalPrice"]',
        ],
        fallback: [
          '[class*="trip-total"]',
          '[class*="tripTotal"]',
          '[class*="grand-total"]',
          '[class*="checkout"] [class*="total"]',
        ],
        semantic: [
          '[aria-label*="total" i]',
          '[aria-label*="due today" i]',
        ],
        container: [
          '[class*="summary"]',
          '[class*="Summary"]',
          '[class*="checkout-breakdown"]',
          '[class*="price-breakdown"]',
        ],
      },
      taxesFees: {
        primary: [
          '[data-testid*="taxes"]',
          '[data-testid*="fees"]',
        ],
        fallback: [
          '[class*="taxes"]',
          '[class*="fees"]',
        ],
      },
      propertyName: [
        // Data attributes (highest reliability)
        '[data-testid="property-name"]',
        '[data-testid="hotel-name"]',
        '[data-testid="lodging-name"]',
        '[data-testid="lodging-title"]',
        // Checkout page summary panel - hotel name near star rating
        // The hotel name is typically in the left sidebar summary card
        '[class*="booking-summary"] h1',
        '[class*="booking-summary"] h2',
        '[class*="BookingSummary"] h1',
        '[class*="BookingSummary"] h2',
        '[class*="trip-summary"] h1',
        '[class*="trip-summary"] h2',
        '[class*="TripSummary"] h1',
        '[class*="TripSummary"] h2',
        // Property/hotel specific containers
        '[class*="property-card"] h1',
        '[class*="property-card"] h2',
        '[class*="PropertyCard"] h1',
        '[class*="PropertyCard"] h2',
        '[class*="property-header"] h1',
        '[class*="PropertyHeader"] h1',
        '[class*="hotel-card"] h2',
        '[class*="HotelCard"] h2',
        // Lodging-specific selectors
        '[class*="lodging-header"] h1',
        '[class*="lodging-header"] h2',
        '[class*="LodgingHeader"] h1',
        '[class*="LodgingHeader"] h2',
        '[class*="lodging-name"]',
        '[class*="LodgingName"]',
        // Generic but scoped selectors
        '[class*="property-name"]',
        '[class*="PropertyName"]',
        // Main page title (last resort)
        'main h1:first-of-type',
        '[role="main"] h1:first-of-type',
      ],
      roomType: [
        '[data-testid="selected-room-name"]',
        '[data-testid="room-type"]',
        '[class*="room-name"]',
        '[class*="RoomName"]',
        '[class*="room-type"]',
        '[class*="RoomType"]',
      ],
      // Star rating selectors
      starRating: [
        '[class*="star-rating"]',
        '[class*="StarRating"]',
        '[aria-label*="star"]',
        '[class*="stars"]',
      ],
    },
    regex: {
      totalLabelRegex: /(?:Total|Trip\s*total|Due\s*Today|Amount\s*due)/i,
      priceRegex: /\$[\d,]+(?:\.\d{2})?/g,
      taxesRegex: /(?:Taxes?\s*(?:&|and)?\s*fees?)[:\s]*\$?([\d,]+\.?\d*)/i,
    },
    featureFlags: {
      isSPA: true,
      lazyLoadsCheckout: true,
    },
    notes: 'Capital One Travel portal. Supports flights, hotels, and vacation rentals.',
  },
  
  // ==========================================
  // DELTA AIR LINES
  // ==========================================
  {
    siteKey: 'delta.com',
    siteName: 'Delta Air Lines',
    version: '2026-01-21',
    lastUpdated: '2026-01-21',
    siteType: 'airline',
    bookingType: 'flight',
    selectors: {
      totalPrice: {
        primary: [
          '[data-testid="totalPrice"]',
          '[data-testid="fare-price"]',
          '[data-testid="trip-cost-total"]',
        ],
        fallback: [
          '.total-amount',
          '.fare-price',
          '.price-summary-total',
          '[class*="totalPrice"]',
          '[class*="total-price"]',
          '[class*="TripTotal"]',
        ],
        semantic: [
          '[aria-label*="total price" i]',
          '[aria-label*="trip total" i]',
        ],
        container: [
          '[class*="price-summary"]',
          '[class*="booking-summary"]',
          '[class*="trip-cost"]',
        ],
      },
      airlineName: [
        '[data-testid="airline-name"]',
        '[class*="airline-name"]',
      ],
      flightTimes: [
        '[data-testid="departure-time"]',
        '[data-testid="arrival-time"]',
        '[class*="flight-time"]',
      ],
    },
    regex: {
      totalLabelRegex: /(?:Trip\s*)?Total[:\s]*\$[\d,]+(?:\.\d{2})?/i,
      priceRegex: /\$[\d,]+(?:\.\d{2})?/g,
    },
    featureFlags: {
      isSPA: true,
    },
    notes: 'Delta Air Lines direct booking site',
  },
  
  // ==========================================
  // UNITED AIRLINES
  // ==========================================
  {
    siteKey: 'united.com',
    siteName: 'United Airlines',
    version: '2026-01-21',
    lastUpdated: '2026-01-21',
    siteType: 'airline',
    bookingType: 'flight',
    selectors: {
      totalPrice: {
        primary: [
          '[data-testid="price-summary-total"]',
          '[data-testid="total-price"]',
        ],
        fallback: [
          '.atm-c-price--total',
          '.booking-total',
          '.flight-total',
          '[class*="TotalPrice"]',
          '[class*="total-price"]',
          '[class*="totalAmount"]',
        ],
        semantic: [
          '[aria-label*="total" i]',
        ],
        container: [
          '[class*="price-summary"]',
          '[class*="trip-total"]',
        ],
      },
    },
    regex: {
      totalLabelRegex: /(?:Trip\s*)?Total[:\s]*\$[\d,]+(?:\.\d{2})?/i,
    },
    featureFlags: {
      isSPA: true,
    },
    notes: 'United Airlines direct booking site',
  },
  
  // ==========================================
  // AMERICAN AIRLINES
  // ==========================================
  {
    siteKey: 'aa.com',
    siteName: 'American Airlines',
    version: '2026-01-21',
    lastUpdated: '2026-01-21',
    siteType: 'airline',
    bookingType: 'flight',
    selectors: {
      totalPrice: {
        primary: [
          '[data-testid="trip-total"]',
          '[data-testid="total-price"]',
        ],
        fallback: [
          '.trip-total',
          '.aa-price--total',
          '.price-total',
          '[class*="tripTotal"]',
          '[class*="total-price"]',
          '[class*="TotalPrice"]',
        ],
        semantic: [
          '[aria-label*="trip total" i]',
        ],
        container: [
          '[class*="price-summary"]',
          '[class*="trip-summary"]',
        ],
      },
    },
    regex: {
      totalLabelRegex: /(?:Trip\s*)?Total[:\s]*\$[\d,]+(?:\.\d{2})?/i,
    },
    featureFlags: {
      isSPA: true,
    },
    notes: 'American Airlines direct booking site',
  },
  
  // ==========================================
  // GOOGLE HOTELS
  // ==========================================
  {
    siteKey: 'google.com/travel/hotels',
    siteName: 'Google Hotels',
    version: '2026-01-21',
    lastUpdated: '2026-01-21',
    siteType: 'metasearch',
    bookingType: 'stay',
    selectors: {
      totalPrice: {
        primary: [
          '[class*="price"]',
          '[class*="total"]',
        ],
        fallback: [
          '[aria-label*="price" i]',
          '[aria-label*="total" i]',
        ],
        container: [
          '[class*="booking-summary"]',
          '[class*="price-summary"]',
        ],
      },
      perNight: {
        primary: [
          '[class*="nightly"]',
          '[class*="per-night"]',
        ],
      },
      propertyName: [
        'h1',
        '[class*="hotel-name"]',
        '[class*="property-name"]',
      ],
    },
    regex: {
      priceRegex: /(?:AED|USD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{2})?/gi,
      perNightRegex: /(?:\/night|per\s*night)/i,
    },
    featureFlags: {
      isSPA: true,
      obfuscatedClassesLikely: true,
    },
    notes: 'Google Hotels search and booking',
    confidenceModifier: -5,
  },
];

// ============================================
// REGISTRY ACCESS FUNCTIONS
// ============================================

// Create a Map for fast lookup
const registryMap = new Map<string, SiteSelectorConfig>();
for (const config of SELECTOR_REGISTRY) {
  registryMap.set(config.siteKey, config);
}

/**
 * Get selector config for a hostname
 */
export function getSelectorConfig(hostname: string): SiteSelectorConfig | null {
  // Direct match
  if (registryMap.has(hostname)) {
    return registryMap.get(hostname) || null;
  }
  
  // Check full URL patterns
  const fullUrl = typeof window !== 'undefined' ? window.location.href : '';
  for (const [key, config] of registryMap) {
    if (fullUrl.includes(key) || hostname.includes(key.split('/')[0])) {
      return config;
    }
  }
  
  // Partial hostname match
  for (const [key, config] of registryMap) {
    const baseHostname = key.split('/')[0];
    if (hostname.includes(baseHostname)) {
      return config;
    }
  }
  
  return null;
}

/**
 * Get all selector configs for a booking type
 */
export function getSelectorConfigsByType(
  bookingType: 'flight' | 'stay' | 'rental' | 'multi'
): SiteSelectorConfig[] {
  return SELECTOR_REGISTRY.filter(
    c => c.bookingType === bookingType || c.bookingType === 'multi'
  );
}

/**
 * Get all selector configs for a site type
 */
export function getSelectorConfigsBySiteType(
  siteType: 'airline' | 'portal' | 'hotel' | 'metasearch' | 'ota'
): SiteSelectorConfig[] {
  return SELECTOR_REGISTRY.filter(c => c.siteType === siteType);
}

/**
 * Check if a hostname is supported
 */
export function isSupportedSite(hostname: string): boolean {
  return getSelectorConfig(hostname) !== null;
}

/**
 * Get total price selectors for a hostname
 */
export function getTotalPriceSelectors(hostname: string): string[] {
  const config = getSelectorConfig(hostname);
  if (!config) return [];
  
  const selectors: string[] = [];
  const priceConfig = config.selectors.totalPrice;
  
  selectors.push(...priceConfig.primary);
  if (priceConfig.fallback) selectors.push(...priceConfig.fallback);
  if (priceConfig.semantic) selectors.push(...priceConfig.semantic);
  
  return selectors;
}

/**
 * Get checkout container selectors
 */
export function getCheckoutContainerSelectors(hostname: string): string[] {
  const config = getSelectorConfig(hostname);
  if (!config) return [];
  
  const containerSelectors: string[] = [];
  
  if (config.selectors.checkoutContainer) {
    containerSelectors.push(...config.selectors.checkoutContainer);
  }
  if (config.selectors.totalPrice.container) {
    containerSelectors.push(...config.selectors.totalPrice.container);
  }
  
  return containerSelectors;
}

// ============================================
// OVERRIDE MANAGEMENT
// ============================================

const OVERRIDE_STORAGE_KEY = 'vx_selector_overrides';

/**
 * Get user overrides from storage
 */
export async function getUserOverrides(): Promise<UserSelectorOverride[]> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return [];
  }
  
  try {
    const result = await chrome.storage.local.get(OVERRIDE_STORAGE_KEY);
    return result[OVERRIDE_STORAGE_KEY] || [];
  } catch {
    return [];
  }
}

/**
 * Save a user override
 */
export async function saveUserOverride(
  override: Omit<UserSelectorOverride, 'createdAt' | 'successCount' | 'failCount'>
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }
  
  const overrides = await getUserOverrides();
  
  // Remove existing override for same site/field
  const filtered = overrides.filter(
    o => !(o.siteKey === override.siteKey && o.field === override.field)
  );
  
  filtered.push({
    ...override,
    createdAt: Date.now(),
    successCount: 0,
    failCount: 0,
  });
  
  await chrome.storage.local.set({ [OVERRIDE_STORAGE_KEY]: filtered });
}

/**
 * Update override success/fail counts
 */
export async function updateOverrideStats(
  siteKey: string,
  field: string,
  success: boolean
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }
  
  const overrides = await getUserOverrides();
  const override = overrides.find(
    o => o.siteKey === siteKey && o.field === field
  );
  
  if (override) {
    if (success) {
      override.successCount++;
    } else {
      override.failCount++;
    }
    override.lastUsedAt = Date.now();
    
    await chrome.storage.local.set({ [OVERRIDE_STORAGE_KEY]: overrides });
  }
}

/**
 * Get effective selectors (registry + overrides)
 */
export async function getEffectiveSelectors(
  hostname: string,
  field: keyof SiteSelectorConfig['selectors']
): Promise<string[]> {
  const selectors: string[] = [];
  
  // Get user overrides first (highest priority)
  const overrides = await getUserOverrides();
  const override = overrides.find(
    o => hostname.includes(o.siteKey) && o.field === field
  );
  
  if (override && override.successCount > override.failCount) {
    selectors.push(...override.selectors);
  }
  
  // Get registry selectors
  const config = getSelectorConfig(hostname);
  if (config) {
    const fieldConfig = config.selectors[field];
    if (fieldConfig) {
      if (Array.isArray(fieldConfig)) {
        selectors.push(...fieldConfig);
      } else if ('primary' in fieldConfig) {
        selectors.push(...fieldConfig.primary);
        if (fieldConfig.fallback) selectors.push(...fieldConfig.fallback);
        if (fieldConfig.semantic) selectors.push(...fieldConfig.semantic);
      }
    }
  }
  
  return selectors;
}

// ============================================
// REGISTRY HEALTH
// ============================================

/**
 * Check if a site's selectors need updating
 */
export function needsUpdate(config: SiteSelectorConfig): boolean {
  const lastUpdated = new Date(config.lastUpdated);
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  
  // Suggest update if older than 90 days
  if (daysSinceUpdate > 90) return true;
  
  // Sites with known frequent changes need more frequent updates
  if (config.featureFlags?.frequentABTests && daysSinceUpdate > 30) return true;
  
  return false;
}

/**
 * Get registry stats
 */
export function getRegistryStats(): {
  totalSites: number;
  byType: Record<string, number>;
  needingUpdate: number;
} {
  const byType: Record<string, number> = {};
  let needingUpdate = 0;
  
  for (const config of SELECTOR_REGISTRY) {
    byType[config.siteType] = (byType[config.siteType] || 0) + 1;
    if (needsUpdate(config)) needingUpdate++;
  }
  
  return {
    totalSites: SELECTOR_REGISTRY.length,
    byType,
    needingUpdate,
  };
}

// ============================================
// GENERIC FALLBACK SELECTORS
// ============================================

/**
 * Generic selectors to try when site-specific ones fail
 */
export const GENERIC_PRICE_SELECTORS: PriceSelectorConfig = {
  primary: [
    '[data-testid*="total" i]',
    '[data-testid*="price" i]',
    '[data-testid*="amount" i]',
  ],
  fallback: [
    '[class*="total" i]:not([class*="subtotal" i])',
    '[class*="Total" i]:not([class*="Subtotal" i])',
    '[class*="price" i]',
    '[class*="Price" i]',
    '[class*="amount" i]',
    '[class*="Amount" i]',
  ],
  semantic: [
    '[aria-label*="total" i]',
    '[aria-label*="price" i]',
    '[role="status"][aria-live]',
  ],
  container: [
    '[class*="summary" i]',
    '[class*="Summary" i]',
    '[class*="checkout" i]',
    '[class*="Checkout" i]',
    '[class*="cart" i]',
    '[class*="Cart" i]',
    'aside',
    '[role="complementary"]',
  ],
};

/**
 * Get generic selectors for unsupported sites
 */
export function getGenericSelectors(): PriceSelectorConfig {
  return GENERIC_PRICE_SELECTORS;
}
