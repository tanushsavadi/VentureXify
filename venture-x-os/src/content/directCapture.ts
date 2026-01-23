// ============================================
// DIRECT CAPTURE - AIRLINE PRICE EXTRACTORS
// Smart detection based on trip type (round trip, one way, multi-city)
// ============================================

import {
  DirectSnapshot,
  PriceSnapshot,
  DirectCapturedPayload,
  AirlineConfig,
  AIRLINE_CONFIGS,
  getAirlineByDomain,
  FlightFingerprint,
  PortalSnapshot,
} from '../lib/compareTypes';
import { ConfidenceLevel } from '../lib/types';

// ============================================
// CONSTANTS
// ============================================

// Price regex for USD
const PRICE_REGEX_USD = /\$[\d,]+(?:\.\d{2})?/g;
// Price regex for multiple currencies (AED, EUR, GBP, etc.)
const PRICE_REGEX_MULTI = /(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)\s*[\d,]+(?:\.\d{2})?/gi;
// Generic number extraction for prices
const PRICE_NUMBER_REGEX = /[\d,]+(?:\.\d{2})?/g;

const EXTRACTION_TIMEOUT = 45000; // 45 seconds (more time for round trips)
const DEBOUNCE_DELAY = 2000; // 2 seconds (wait for user to complete selection)
const MIN_PRICE_STABILITY_TIME = 1500; // Price must be stable for 1.5s before capture

// ============================================
// BASE PRICE EXTRACTION
// ============================================

interface ExtractionCandidate {
  amount: number;
  confidence: ConfidenceLevel;
  context: string;
  isTotal: boolean;
}

function parsePrice(priceStr: string): number | null {
  // Remove currency symbols and commas
  const clean = priceStr.replace(/[AED|USD|EUR|GBP|CAD|AUD|INR|$|€|£,\s]/gi, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function detectCurrency(priceStr: string): string {
  if (/AED/i.test(priceStr)) return 'AED';
  if (/EUR|€/i.test(priceStr)) return 'EUR';
  if (/GBP|£/i.test(priceStr)) return 'GBP';
  if (/CAD/i.test(priceStr)) return 'CAD';
  if (/AUD/i.test(priceStr)) return 'AUD';
  if (/INR/i.test(priceStr)) return 'INR';
  if (/USD|\$/i.test(priceStr)) return 'USD';
  return 'USD'; // Default
}

function extractPricesFromSelectors(
  selectors: string[],
  totalPattern?: RegExp
): ExtractionCandidate[] {
  const candidates: ExtractionCandidate[] = [];
  
  // Strategy 1: Try specific selectors
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || '';
        const matches = text.match(PRICE_REGEX_MULTI);
        if (matches) {
          for (const priceMatch of matches) {
            const amount = parsePrice(priceMatch);
            if (amount && amount > 50 && amount < 50000) {
              // Check if this looks like a total
              const isTotal = /total|due|grand|final/i.test(text);
              candidates.push({
                amount,
                confidence: isTotal ? 'HIGH' : 'MED',
                context: text.substring(0, 100),
                isTotal,
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
  }
  
  // Strategy 2: Use total pattern on full page text
  if (totalPattern) {
    const pageText = document.body.innerText;
    const totalMatch = pageText.match(totalPattern);
    if (totalMatch) {
      const priceMatches = totalMatch[0].match(PRICE_REGEX_MULTI);
      if (priceMatches) {
        for (const priceMatch of priceMatches) {
          const amount = parsePrice(priceMatch);
          if (amount && amount > 50 && amount < 50000) {
            // Check for duplicates
            const isDuplicate = candidates.some(
              (c) => Math.abs(c.amount - amount) < 0.01
            );
            if (!isDuplicate) {
              candidates.push({
                amount,
                confidence: 'HIGH',
                context: totalMatch[0],
                isTotal: true,
              });
            }
          }
        }
      }
    }
  }
  
  // Strategy 3: Generic total search - support multiple currencies
  const genericPatterns = [
    /Total[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/gi,
    /Trip\s*total[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/gi,
    /Amount\s*due[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/gi,
    /Final\s*price[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/gi,
    /Your\s*total[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/gi,
    // For Google Flights - look for prices with "per person"
    /(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)\s*[\d,]+\s*(?:per\s*person)?/gi,
  ];
  
  const pageText = document.body.innerText;
  for (const pattern of genericPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(pageText)) !== null) {
      const priceMatches = match[0].match(PRICE_REGEX_MULTI);
      if (priceMatches) {
        for (const priceMatch of priceMatches) {
          const amount = parsePrice(priceMatch);
          if (amount && amount > 50 && amount < 50000) {
            const isDuplicate = candidates.some(
              (c) => Math.abs(c.amount - amount) < 0.01
            );
            if (!isDuplicate) {
              candidates.push({
                amount,
                confidence: 'MED',
                context: match[0],
                isTotal: true,
              });
            }
          }
        }
      }
    }
  }
  
  // Sort by confidence and whether it's a total
  candidates.sort((a, b) => {
    // Prioritize totals
    if (a.isTotal && !b.isTotal) return -1;
    if (!a.isTotal && b.isTotal) return 1;
    
    // Then by confidence
    const confOrder: Record<ConfidenceLevel, number> = { HIGH: 0, MED: 1, LOW: 2 };
    if (confOrder[a.confidence] !== confOrder[b.confidence]) {
      return confOrder[a.confidence] - confOrder[b.confidence];
    }
    
    // Then by amount (higher = likely total)
    return b.amount - a.amount;
  });
  
  return candidates;
}

// ============================================
// PAGE TYPE DETECTION
// ============================================

type DirectPageType = 'search' | 'details' | 'checkout' | 'unknown';

function detectDirectPageType(): DirectPageType {
  const url = window.location.href.toLowerCase();
  const pageText = document.body.innerText.toLowerCase();
  
  // Checkout indicators
  if (
    url.includes('checkout') ||
    url.includes('payment') ||
    url.includes('purchase') ||
    url.includes('book') ||
    pageText.includes('enter payment') ||
    pageText.includes('credit card') ||
    pageText.includes('complete booking') ||
    pageText.includes('complete purchase')
  ) {
    return 'checkout';
  }
  
  // Details/review indicators
  if (
    url.includes('review') ||
    url.includes('trip-summary') ||
    url.includes('details') ||
    pageText.includes('trip summary') ||
    pageText.includes('review your trip') ||
    pageText.includes('flight details')
  ) {
    return 'details';
  }
  
  // Search/results indicators
  if (
    url.includes('search') ||
    url.includes('results') ||
    url.includes('flights') ||
    pageText.includes('select a flight') ||
    pageText.includes('choose your flight')
  ) {
    return 'search';
  }
  
  return 'unknown';
}

// ============================================
// AIRLINE-SPECIFIC EXTRACTORS
// ============================================

// Delta Air Lines
const deltaExtractor = {
  selectors: [
    '[data-testid="totalPrice"]',
    '[data-testid="fare-price"]',
    '[data-testid="trip-cost-total"]',
    '.total-amount',
    '.fare-price',
    '.price-summary-total',
    '[class*="totalPrice"]',
    '[class*="total-price"]',
    '[class*="TripTotal"]',
  ],
  totalPattern: /(?:Trip\s*)?Total[:\s]*\$[\d,]+(?:\.\d{2})?/i,
};

// United Airlines
const unitedExtractor = {
  selectors: [
    '[data-testid="price-summary-total"]',
    '[data-testid="total-price"]',
    '.atm-c-price--total',
    '.booking-total',
    '.flight-total',
    '[class*="TotalPrice"]',
    '[class*="total-price"]',
    '[class*="totalAmount"]',
  ],
  totalPattern: /(?:Trip\s*)?Total[:\s]*\$[\d,]+(?:\.\d{2})?/i,
};

// American Airlines
const americanExtractor = {
  selectors: [
    '[data-testid="trip-total"]',
    '[data-testid="total-price"]',
    '.trip-total',
    '.aa-price--total',
    '.price-total',
    '[class*="tripTotal"]',
    '[class*="total-price"]',
    '[class*="TotalPrice"]',
  ],
  totalPattern: /(?:Trip\s*)?Total[:\s]*\$[\d,]+(?:\.\d{2})?/i,
};

// Google Flights - specialized for search results AND booking pages
const googleFlightsExtractor = {
  selectors: [
    // BOOKING PAGE - Booking options section (most reliable)
    '[class*="booking-options"] [class*="price"]',
    '.gws-flights-book__booking-option [class*="price"]',
    // Continue button area with price
    '[class*="Continue"] [class*="price"]',
    'button[class*="continue"] span',
    // Main booking total
    '[class*="gws-flights-book"]',
    // Price next to airline booking
    '[class*="carrier-price"]',
    '[class*="booking-price"]',
    // Header price display
    '[role="heading"] + div [class*="price"]',
    // SEARCH RESULTS page selectors
    '[class*="YMlIz"]', // Total price container
    '[class*="pQvwEc"]', // Price text
    '[class*="gOatQ"]', // Fare total
    '[class*="price-text"]',
    '[data-gs="CgZyZXN1bHQ"]', // Result price
    '.YMlIz', // Common price class
    '[aria-label*="total"]',
    '[aria-label*="Total"]',
    '[aria-label*="price"]',
    '[aria-label*="Price"]',
    // Flight result price selectors
    '[jscontroller] [class*="u3FI0d"]',
    '[jscontroller] .gOatQ',
    // Per-person price
    '[class*="FpEdX"] span',
    // Booking total
    '[class*="jBp0Xe"]',
    // Itinerary price
    '.gws-flights-book__itinerary-price',
    '.gws-flights-book__total-price',
  ],
  // Multi-currency total patterns
  totalPattern: /(?:Total|total|price|AED|USD|EUR|GBP)[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/gi,
};

const AIRLINE_EXTRACTORS: Record<
  string,
  { selectors: string[]; totalPattern: RegExp }
> = {
  'delta.com': deltaExtractor,
  'united.com': unitedExtractor,
  'aa.com': americanExtractor,
  'google.com/travel/flights': googleFlightsExtractor,
  'google.com/flights': googleFlightsExtractor,
};

function getExtractorForDomain(
  domain: string
): { selectors: string[]; totalPattern?: RegExp } {
  const fullUrl = window.location.href;
  
  // Check for Google Flights first (needs path check)
  if (domain.includes('google.com') && (fullUrl.includes('/travel/flights') || fullUrl.includes('/flights'))) {
    return googleFlightsExtractor;
  }
  
  for (const [key, extractor] of Object.entries(AIRLINE_EXTRACTORS)) {
    if (domain.includes(key)) {
      return extractor;
    }
  }
  
  // Fallback to airline config if available
  const airlineConfig = getAirlineByDomain(domain);
  if (airlineConfig) {
    return {
      selectors: airlineConfig.priceSelectors,
      totalPattern: airlineConfig.totalPricePattern,
    };
  }
  
  // Generic fallback
  return {
    selectors: [
      '[class*="total"]',
      '[class*="Total"]',
      '[class*="price"]',
      '[class*="Price"]',
      '[data-testid*="price"]',
      '[data-testid*="total"]',
    ],
    totalPattern: /(?:Total|total)[:\s]*(?:AED|USD|EUR|GBP|CAD|AUD|INR|\$|€|£)?\s*[\d,]+(?:\.\d{2})?/i,
  };
}

// ============================================
// GOOGLE FLIGHTS BOOKING PAGE EXTRACTOR
// ============================================

/**
 * Check if an element is inside a VentureX widget (exclude our own UI from scraping)
 */
function isInsideVentureXWidget(element: Element): boolean {
  return !!(
    element.closest('#vx-direct-helper') ||
    element.closest('#vx-auto-compare-widget') ||
    element.closest('[class*="vx-"]') ||
    element.id?.startsWith('vx-')
  );
}

/**
 * Get page text excluding VentureX widgets
 * NOTE: Using document.body.innerText directly because cloning doesn't work properly
 * for innerText (it includes script content when element is not attached to DOM)
 */
function getCleanPageText(): string {
  // Get all VentureX widget elements
  const vxElements = document.querySelectorAll('#vx-direct-helper, #vx-auto-compare-widget, [id^="vx-"], [class*="vx-helper"], [class*="vx-widget"]');
  
  // Temporarily hide VentureX elements
  const originalDisplays: string[] = [];
  vxElements.forEach((el, idx) => {
    const htmlEl = el as HTMLElement;
    originalDisplays[idx] = htmlEl.style.display;
    htmlEl.style.display = 'none';
  });
  
  // Get the page text (now excluding hidden VentureX elements)
  const pageText = document.body.innerText || '';
  
  // Restore VentureX elements
  vxElements.forEach((el, idx) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.display = originalDisplays[idx];
  });
  
  return pageText;
}

/**
 * Special extraction for Google Flights booking pages
 * The booking page has a different structure - price appears in:
 * 1. "Lowest total price" header (AED 5,401) - MOST IMPORTANT since all options can be price matched
 * 2. "Book with [Airline]" buttons (e.g., "AED 5,600")
 * 3. The header summary area
 *
 * IMPORTANT: Excludes VentureX extension widgets from scraping to avoid reading our own "Portal: $884" display
 */
function extractGoogleFlightsBookingPrice(): ExtractionCandidate | null {
  // Use clean page text (without VentureX widgets)
  const pageText = getCleanPageText();
  const url = window.location.href;
  
  // Check if we're on a booking page
  const isBookingPage = url.includes('/booking') || url.includes('tfs=');
  
  console.log('[DirectCapture] Google Flights page type:', isBookingPage ? 'BOOKING' : 'SEARCH');
  console.log('[DirectCapture] Clean page text length:', pageText.length);
  console.log('[DirectCapture] Page text sample (first 500 chars):', pageText.substring(0, 500));
  
  const candidates: ExtractionCandidate[] = [];
  
  // STRATEGY 0 (HIGHEST PRIORITY): Look for foreign currency prices near "Lowest total price"
  // Google Flights shows prices in local currency with "Lowest total price" label below
  // Support ALL major currencies
  
  // First, try to find the "Lowest total price" section and extract the price above it
  const lowestIdx = pageText.toLowerCase().indexOf('lowest total price');
  console.log('[DirectCapture] "Lowest total price" index:', lowestIdx);
  
  if (lowestIdx !== -1) {
    // Get text around "Lowest total price" - price can be before OR after
    // Use a smaller window to get text closer to the label
    const textAroundLowest = pageText.substring(Math.max(0, lowestIdx - 100), lowestIdx + 30);
    console.log('[DirectCapture] Text around "Lowest total price":', textAroundLowest);
    
    // Pattern to match any currency code followed by amount (more flexible)
    // IMPORTANT: Don't use \b before currency code because Google Flights may have
    // text like "DoneCancelAED 2,816" with no space before currency
    // Supports: AED 2,816 | EUR 1,234 | £1,234 | $1,234 | ¥123,456 | ₹12,345 etc.
    const currencyPatterns = [
      // Currency code + amount - NO word boundary before, use negative lookbehind to avoid matching inside words
      // This handles cases like "CancelAED 2,816" where there's no space before AED
      /(AED|EUR|GBP|CAD|AUD|INR|JPY|CHF|CNY|MXN|SGD|HKD|KRW|NZD|SEK|NOK|DKK|PLN|THB|MYR|IDR|PHP|VND|ZAR|BRL|TRY|RUB|SAR|QAR|BHD|KWD|OMR|JOD)\s*([\d,]+(?:\.\d{2})?)/gi,
      // Symbol + amount ($1,234 | £1,234 | €1,234 | ¥12,345 | ₹12,345)
      /(\$|£|€|¥|₹)\s*([\d,]+(?:\.\d{2})?)/g,
    ];
    
    for (const pattern of currencyPatterns) {
      pattern.lastIndex = 0;
      // Find ALL matches in the text and pick the one closest to "lowest total price"
      const matches: { currency: string; amount: number; index: number }[] = [];
      let match;
      while ((match = pattern.exec(textAroundLowest)) !== null) {
        const symbolMap: Record<string, string> = {
          '$': 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', '₹': 'INR'
        };
        
        const currency = symbolMap[match[1]] || match[1].toUpperCase();
        const amount = parseFloat(match[2].replace(/,/g, ''));
        
        // Filter reasonable flight prices
        if (amount > 500 && amount < 500000) {
          matches.push({ currency, amount, index: match.index });
        }
      }
      
      // Pick the match closest to the end of the text (nearest to "Lowest total price")
      if (matches.length > 0) {
        const bestMatch = matches[matches.length - 1]; // Last match is closest to the label
        console.log('[DirectCapture] Found price near "Lowest total price":', bestMatch);
        return {
          amount: bestMatch.amount,
          confidence: 'HIGH',
          context: `${bestMatch.currency} ${bestMatch.amount} (Lowest total price)`,
          isTotal: true,
        };
      }
    }
  }
  
  // STRATEGY 0b: Look for any non-USD currency prices on the page
  // This prioritizes the local currency over USD (which might be shown as secondary)
  const foreignCurrencyPattern = /\b(AED|EUR|GBP|CAD|AUD|INR|JPY|CHF|CNY|MXN|SGD|HKD|KRW|NZD|SEK|NOK|DKK|PLN|THB|MYR|SAR|QAR|BHD|KWD|OMR|JOD)\s*([\d,]+(?:\.\d{2})?)/gi;
  const foreignMatches: { currency: string; amount: number; index: number }[] = [];
  let foreignMatch;
  
  foreignCurrencyPattern.lastIndex = 0;
  while ((foreignMatch = foreignCurrencyPattern.exec(pageText)) !== null) {
    const currency = foreignMatch[1].toUpperCase();
    const amount = parseFloat(foreignMatch[2].replace(/,/g, ''));
    // Filter out small numbers (likely not prices) and very large ones
    if (amount > 100 && amount < 500000) {
      foreignMatches.push({ currency, amount, index: foreignMatch.index });
    }
  }
  
  console.log('[DirectCapture] Foreign currency matches found:', foreignMatches.length, foreignMatches.slice(0, 5));
  
  // If we found foreign currency prices, prefer the one nearest to "Lowest" or first reasonable one
  if (foreignMatches.length > 0) {
    let bestPrice = foreignMatches[0]; // Default to first
    
    if (lowestIdx !== -1) {
      // Find foreign price closest to "lowest" text (usually just before it)
      for (const m of foreignMatches) {
        if (m.index < lowestIdx && lowestIdx - m.index < 150) {
          bestPrice = m;
          break;
        }
      }
    }
    
    console.log('[DirectCapture] Best foreign currency price:', { currency: bestPrice.currency, amount: bestPrice.amount, totalFound: foreignMatches.length });
    return {
      amount: bestPrice.amount,
      confidence: 'HIGH',
      context: `${bestPrice.currency} ${bestPrice.amount} (primary)`,
      isTotal: true,
    };
  }
  
  // STRATEGY 1 (HIGHEST PRIORITY): Look for "Lowest total price" header
  // This is the most important price on booking pages since ALL booking options can be price matched
  // The page shows "AED 5,401" with "Lowest total price" label below it
  
  // First, try to find the "Lowest total price" text and extract nearby price
  const lowestPricePatterns = [
    // Pattern: "AED 5,401" followed by "Lowest total price"
    /(AED|USD|EUR|GBP|\$|€|£)\s*([\d,]+(?:\.\d{2})?)\s*(?:\n|\s)*Lowest\s+total\s+price/gi,
    // Pattern: price near "Lowest total price" text
    /Lowest\s+total\s+price[^]*?(AED|USD|EUR|GBP|\$|€|£)\s*([\d,]+)/gi,
  ];
  
  for (const pattern of lowestPricePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(pageText);
    if (match) {
      let currency: string;
      let amountStr: string;
      
      if (/^(AED|USD|EUR|GBP)$/i.test(match[1])) {
        currency = match[1].toUpperCase();
        amountStr = match[2];
      } else if (match[1] === '$') {
        currency = 'USD';
        amountStr = match[2];
      } else if (match[1] === '€') {
        currency = 'EUR';
        amountStr = match[2];
      } else if (match[1] === '£') {
        currency = 'GBP';
        amountStr = match[2];
      } else {
        continue;
      }
      
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      if (amount > 100 && amount < 100000) {
        console.log('[DirectCapture] Found LOWEST TOTAL PRICE:', { currency, amount });
        return {
          amount,
          confidence: 'HIGH',
          context: `${currency} ${amount} (Lowest total price)`,
          isTotal: true,
        };
      }
    }
  }
  
  // Strategy 1b: Try DOM-based approach - look for price elements with ARIA labels or specific patterns
  // IMPORTANT: Skip VentureX widgets
  
  // First, look for elements containing currency codes/symbols directly
  const priceSelectors = [
    // Elements that contain currency text
    '[aria-label*="price"]',
    '[aria-label*="Price"]',
    '[aria-label*="total"]',
    '[aria-label*="Total"]',
    // Google Flights specific classes (reverse engineered)
    '[class*="FpEdX"]', // Price container
    '[class*="YMlIz"]', // Price display
    '[class*="jBp0Xe"]', // Booking price
    '[class*="gOatQ"]', // Search result price
    '[class*="u3FI0d"]', // Flight price
    // Any span/div that looks like it might contain a price
    'span[jsname]',
    'div[jsname]',
  ];
  
  // Collect all potential price elements
  const priceElements: Element[] = [];
  for (const selector of priceSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (!isInsideVentureXWidget(el)) {
          priceElements.push(el);
        }
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }
  
  console.log('[DirectCapture] Found potential price elements:', priceElements.length);
  
  // Now search these elements for currency patterns
  for (const el of priceElements) {
    const text = el.textContent?.trim() || '';
    
    // Look for currency + amount pattern
    const priceMatch = text.match(/\b(AED|EUR|GBP|CAD|AUD|INR|JPY|CHF|SAR|QAR|USD)\s*([\d,]+(?:\.\d{2})?)\b/i) ||
                       text.match(/(\$|£|€|¥|₹)\s*([\d,]+(?:\.\d{2})?)/);
    
    if (priceMatch) {
      let currency: string;
      let amountStr: string;
      
      const symbolMap: Record<string, string> = {
        '$': 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', '₹': 'INR'
      };
      
      if (symbolMap[priceMatch[1]]) {
        currency = symbolMap[priceMatch[1]];
        amountStr = priceMatch[2];
      } else {
        currency = priceMatch[1].toUpperCase();
        amountStr = priceMatch[2];
      }
      
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      // Filter: reasonable flight prices (AED 1000-50000, USD 100-10000)
      const minPrice = currency === 'AED' || currency === 'JPY' || currency === 'INR' ? 500 : 100;
      const maxPrice = currency === 'AED' || currency === 'JPY' || currency === 'INR' ? 500000 : 50000;
      
      if (amount >= minPrice && amount <= maxPrice) {
        console.log('[DirectCapture] Found price in DOM element:', { currency, amount, text: text.substring(0, 50) });
        candidates.push({
          amount,
          confidence: 'MED',
          context: `${currency} ${amount} (DOM)`,
          isTotal: true,
        });
      }
    }
  }
  
  // Also try walking the DOM to find "Lowest total price" text and its siblings
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    // Skip VentureX widgets
    if (isInsideVentureXWidget(el)) continue;
    
    const text = el.textContent?.trim() || '';
    if (text === 'Lowest total price' || text.toLowerCase() === 'lowest total price') {
      console.log('[DirectCapture] Found "Lowest total price" element, checking parents/siblings');
      
      // Found the label, now find the price near it (likely in parent or sibling)
      const parent = el.parentElement?.parentElement || el.parentElement;
      if (parent && !isInsideVentureXWidget(parent)) {
        const parentText = parent.textContent || '';
        console.log('[DirectCapture] Parent text:', parentText.substring(0, 200));
        
        const priceMatch = parentText.match(/(AED|USD|EUR|GBP|\$|€|£)\s*([\d,]+)/i);
        if (priceMatch) {
          let currency: string;
          let amountStr: string;
          
          if (/^(AED|USD|EUR|GBP)$/i.test(priceMatch[1])) {
            currency = priceMatch[1].toUpperCase();
            amountStr = priceMatch[2];
          } else {
            currency = priceMatch[1] === '$' ? 'USD' : priceMatch[1] === '€' ? 'EUR' : priceMatch[1] === '£' ? 'GBP' : 'USD';
            amountStr = priceMatch[2];
          }
          
          const amount = parseFloat(amountStr.replace(/,/g, ''));
          if (amount > 100 && amount < 500000) {
            console.log('[DirectCapture] Found lowest price via DOM:', { currency, amount });
            return {
              amount,
              confidence: 'HIGH',
              context: `${currency} ${amount} (Lowest total price)`,
              isTotal: true,
            };
          }
        }
      }
    }
  }
  
  // Strategy 1c: Look for large price display in header area
  // The booking page typically shows the main price prominently at the top
  // Look for price patterns that appear before "Round trip" or flight route info
  const headerMatch = pageText.match(/(AED|USD|EUR|GBP|\$|€|£)\s*([\d,]+(?:\.\d{2})?)\s*(?:\n|\s)*(?:Lowest|Round\s+trip|Economy|per\s+person)/i);
  if (headerMatch) {
    let currency: string;
    let amountStr: string;
    
    if (/^(AED|USD|EUR|GBP)$/i.test(headerMatch[1])) {
      currency = headerMatch[1].toUpperCase();
      amountStr = headerMatch[2];
    } else {
      currency = headerMatch[1] === '$' ? 'USD' : headerMatch[1] === '€' ? 'EUR' : headerMatch[1] === '£' ? 'GBP' : 'USD';
      amountStr = headerMatch[2];
    }
    
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (amount > 100 && amount < 100000) {
      console.log('[DirectCapture] Found header price:', { currency, amount });
      candidates.push({
        amount,
        confidence: 'HIGH',
        context: `${currency} ${amount} (header)`,
        isTotal: true,
      });
    }
  }
  
  // Strategy 2: Look for "Book with [Airline]" section prices (fallback)
  const bookingOptionsPatterns = [
    // Pattern: "AED 5,591" or "$1,523" near "Book with"
    /Book\s+with\s+\w+[^]*?(AED|USD|\$|EUR|£)\s*([\d,]+)/gi,
    // Price followed by airline
    /(AED|USD|\$|EUR|£)\s*([\d,]+)[^]*?(?:American|Delta|United|British|Airline)/gi,
  ];
  
  for (const pattern of bookingOptionsPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(pageText);
    if (match) {
      const currency = match[1] === '$' ? 'USD' : match[1];
      const amount = parseFloat(match[2].replace(/,/g, ''));
      if (amount > 100 && amount < 100000) {
        console.log('[DirectCapture] Found booking option price:', { currency, amount });
        candidates.push({
          amount,
          confidence: 'MED',
          context: match[0].substring(0, 100),
          isTotal: true,
        });
      }
    }
  }
  
  // Strategy 3: Look for price in the page header/summary
  // The booking page shows a large price display
  const headerPricePatterns = [
    // Large currency display: "AED 5,591" or "5591 aed"
    /\b(AED|USD|EUR|GBP)\s*([\d,]+(?:\.\d{2})?)\b/gi,
    /\b([\d,]+)\s*(AED|USD|EUR|GBP)\b/gi,
    // Dollar format
    /\$\s*([\d,]+(?:\.\d{2})?)/g,
  ];
  
  for (const pattern of headerPricePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(pageText)) !== null) {
      let currency: string;
      let amountStr: string;
      
      // Handle both "AED 5591" and "5591 AED" formats
      if (/^[A-Z]{3}$/i.test(match[1])) {
        currency = match[1].toUpperCase();
        amountStr = match[2];
      } else if (/^[A-Z]{3}$/i.test(match[2])) {
        currency = match[2].toUpperCase();
        amountStr = match[1];
      } else if (match[0].includes('$')) {
        currency = 'USD';
        amountStr = match[1];
      } else {
        continue;
      }
      
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      if (amount > 100 && amount < 100000) {
        candidates.push({
          amount,
          confidence: 'LOW',
          context: `${currency} ${amount}`,
          isTotal: true,
        });
      }
    }
  }
  
  // Strategy 4: Look for specific Google Flights DOM elements
  // IMPORTANT: Skip VentureX widgets to avoid reading our own "Portal: $884" display
  const domSelectors = [
    // Booking price in the booking options section
    '[class*="Bm0VXb"]', // Price container
    '[class*="booking"] [class*="price"]',
    '[class*="continue"] [class*="price"]',
    '.gws-flights-book__price',
    '[data-price]',
    // The "Continue" button often has the price
    'button[class*="continue"]',
    'button[class*="book"]',
  ];
  
  for (const selector of domSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Skip VentureX widgets
        if (isInsideVentureXWidget(el)) {
          console.log('[DirectCapture] Skipping VentureX widget element');
          continue;
        }
        
        const text = el.textContent || '';
        // Look for price patterns in this element
        const priceMatch = text.match(/(AED|USD|EUR|GBP|\$|€|£)\s*([\d,]+)/i) ||
                          text.match(/([\d,]+)\s*(AED|USD|EUR|GBP)/i);
        if (priceMatch) {
          let currency: string;
          let amountStr: string;
          
          if (/^[A-Z]{3}$/i.test(priceMatch[1])) {
            currency = priceMatch[1].toUpperCase();
            amountStr = priceMatch[2];
          } else if (/^[A-Z]{3}$/i.test(priceMatch[2])) {
            currency = priceMatch[2].toUpperCase();
            amountStr = priceMatch[1];
          } else {
            currency = priceMatch[1] === '$' ? 'USD' : priceMatch[1] === '€' ? 'EUR' : priceMatch[1] === '£' ? 'GBP' : 'USD';
            amountStr = priceMatch[2];
          }
          
          const amount = parseFloat(amountStr.replace(/,/g, ''));
          if (amount > 100 && amount < 100000) {
            console.log('[DirectCapture] Found DOM price:', { selector, currency, amount, text: text.substring(0, 50) });
            candidates.push({
              amount,
              confidence: 'MED',
              context: text.substring(0, 100),
              isTotal: true,
            });
          }
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
  }
  
  // Sort candidates: prefer lowest price (since all can be price matched) with high confidence
  // On booking pages, the lowest price is what matters since user can book with any provider
  candidates.sort((a, b) => {
    // Prefer higher confidence first
    const confOrder: Record<ConfidenceLevel, number> = { HIGH: 0, MED: 1, LOW: 2 };
    if (confOrder[a.confidence] !== confOrder[b.confidence]) {
      return confOrder[a.confidence] - confOrder[b.confidence];
    }
    // For same confidence, prefer LOWER price (better for user)
    return a.amount - b.amount;
  });
  
  if (candidates.length > 0) {
    console.log('[DirectCapture] Best Google Flights candidate:', candidates[0]);
    return candidates[0];
  }
  
  return null;
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

export function extractDirectPrice(): PriceSnapshot | null {
  const domain = window.location.hostname;
  const fullUrl = window.location.href;
  
  // Special handling for Google Flights
  if (domain.includes('google.com') && (fullUrl.includes('/travel/flights') || fullUrl.includes('/flights'))) {
    console.log('[DirectCapture] Using Google Flights extractor');
    
    const gfCandidate = extractGoogleFlightsBookingPrice();
    if (gfCandidate) {
      // Detect currency from context
      let currency = 'USD';
      if (/AED/i.test(gfCandidate.context)) currency = 'AED';
      else if (/EUR|€/i.test(gfCandidate.context)) currency = 'EUR';
      else if (/GBP|£/i.test(gfCandidate.context)) currency = 'GBP';
      else if (/\$/i.test(gfCandidate.context)) currency = 'USD';
      
      return {
        amount: gfCandidate.amount,
        currency,
        confidence: gfCandidate.confidence,
        label: 'total',
        extractedAt: Date.now(),
        source: 'auto',
      };
    }
  }
  
  // Default extraction for other sites
  const extractor = getExtractorForDomain(domain);
  
  const candidates = extractPricesFromSelectors(
    extractor.selectors,
    extractor.totalPattern
  );
  
  if (candidates.length === 0) {
    console.log('[DirectCapture] No price candidates found');
    return null;
  }
  
  // Take the best candidate
  const best = candidates[0];
  
  // Detect currency from the context
  const detectedCurrency = detectCurrency(best.context);
  
  console.log('[DirectCapture] Best candidate:', {
    amount: best.amount,
    currency: detectedCurrency,
    context: best.context.substring(0, 50),
    confidence: best.confidence,
  });
  
  return {
    amount: best.amount,
    currency: detectedCurrency,
    confidence: best.confidence,
    label: best.isTotal ? 'total' : 'unknown',
    extractedAt: Date.now(),
    source: 'auto',
  };
}

export function captureDirectSnapshot(): DirectSnapshot | null {
  const priceSnapshot = extractDirectPrice();
  
  if (!priceSnapshot) {
    return null;
  }
  
  const airlineConfig = getAirlineByDomain(window.location.hostname);
  
  return {
    totalPrice: priceSnapshot,
    siteName: airlineConfig?.name || window.location.hostname,
    siteUrl: window.location.href,
    pageType: detectDirectPageType(),
    capturedAt: Date.now(),
  };
}

// ============================================
// TRIP TYPE AWARE PRICE DETECTION
// ============================================

interface TripContext {
  tripType: 'roundTrip' | 'oneWay' | 'multiCity' | 'unknown';
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  expectedLegs: number;
  portalPrice?: number;
}

let tripContext: TripContext = {
  tripType: 'unknown',
  expectedLegs: 1,
};

/**
 * Detect the booking stage on airline site
 */
interface BookingStage {
  stage: 'search' | 'selectOutbound' | 'selectReturn' | 'review' | 'checkout' | 'unknown';
  outboundSelected: boolean;
  returnSelected: boolean;
  isComplete: boolean;
}

function detectBookingStage(): BookingStage {
  const pageText = document.body.innerText.toLowerCase();
  const url = window.location.href.toLowerCase();
  
  // Default
  const result: BookingStage = {
    stage: 'unknown',
    outboundSelected: false,
    returnSelected: false,
    isComplete: false,
  };
  
  // Check for checkout/review pages - these are complete
  if (
    url.includes('checkout') ||
    url.includes('payment') ||
    url.includes('purchase') ||
    url.includes('book') ||
    pageText.includes('complete booking') ||
    pageText.includes('complete purchase') ||
    pageText.includes('enter payment') ||
    pageText.includes('payment details')
  ) {
    result.stage = 'checkout';
    result.outboundSelected = true;
    result.returnSelected = tripContext.tripType === 'roundTrip';
    result.isComplete = true;
    return result;
  }
  
  // Check for review page
  if (
    url.includes('review') ||
    url.includes('trip-summary') ||
    url.includes('confirm') ||
    pageText.includes('review your trip') ||
    pageText.includes('trip summary') ||
    pageText.includes('your itinerary')
  ) {
    result.stage = 'review';
    result.outboundSelected = true;
    result.returnSelected = tripContext.tripType === 'roundTrip';
    result.isComplete = true;
    return result;
  }
  
  // Check for return flight selection
  if (
    pageText.includes('select return') ||
    pageText.includes('return flight') ||
    pageText.includes('select your return') ||
    pageText.includes('choose return') ||
    pageText.includes('returning flight') ||
    (pageText.includes('return') && pageText.includes('select'))
  ) {
    result.stage = 'selectReturn';
    result.outboundSelected = true;
    result.returnSelected = false;
    result.isComplete = false;
    return result;
  }
  
  // Check for outbound/departure selection
  if (
    pageText.includes('select departure') ||
    pageText.includes('outbound flight') ||
    pageText.includes('departing flight') ||
    pageText.includes('select your departure') ||
    pageText.includes('choose departure') ||
    pageText.includes('select a flight')
  ) {
    result.stage = 'selectOutbound';
    result.outboundSelected = false;
    result.returnSelected = false;
    result.isComplete = false;
    return result;
  }
  
  // Check for search page
  if (
    url.includes('search') ||
    url.includes('find-flights') ||
    url.includes('book-a-flight') ||
    pageText.includes('search flights') ||
    pageText.includes('find flights')
  ) {
    result.stage = 'search';
    result.outboundSelected = false;
    result.returnSelected = false;
    result.isComplete = false;
    return result;
  }
  
  // If there's a total price on page and it looks like a results/selection page
  // check if we have both flights selected by looking for flight details
  const hasTotal = /total[:\s]*\$[\d,]+/i.test(pageText);
  const hasDepartureDetails = pageText.includes('depart') || pageText.includes('outbound');
  const hasReturnDetails = pageText.includes('return') && tripContext.tripType === 'roundTrip';
  
  if (hasTotal) {
    if (tripContext.tripType === 'oneWay') {
      result.isComplete = true;
      result.outboundSelected = true;
    } else if (tripContext.tripType === 'roundTrip') {
      result.outboundSelected = hasDepartureDetails;
      result.returnSelected = hasReturnDetails;
      result.isComplete = result.outboundSelected && result.returnSelected;
    }
  }
  
  return result;
}

/**
 * Check if we're ready to capture the final price
 */
function isReadyToCapture(): { ready: boolean; reason: string } {
  const stage = detectBookingStage();
  
  console.log('[DirectCapture] Booking stage:', stage, 'Trip type:', tripContext.tripType);
  
  // For checkout/review pages, always ready
  if (stage.stage === 'checkout' || stage.stage === 'review') {
    return { ready: true, reason: 'On checkout/review page' };
  }
  
  // For one-way trips, just need departure selected
  if (tripContext.tripType === 'oneWay') {
    if (stage.outboundSelected || stage.isComplete) {
      return { ready: true, reason: 'One-way departure selected' };
    }
    return { ready: false, reason: 'Waiting for departure selection' };
  }
  
  // For round trips, need both legs
  if (tripContext.tripType === 'roundTrip') {
    if (stage.isComplete || (stage.outboundSelected && stage.returnSelected)) {
      return { ready: true, reason: 'Round trip both legs selected' };
    }
    if (stage.outboundSelected && !stage.returnSelected) {
      return { ready: false, reason: 'Waiting for return flight selection' };
    }
    return { ready: false, reason: 'Waiting for flight selection' };
  }
  
  // For multi-city, check if all legs are present
  if (tripContext.tripType === 'multiCity') {
    // Multi-city is complex, just check if we have a final total
    const pageText = document.body.innerText.toLowerCase();
    if (
      pageText.includes('total') &&
      (pageText.includes('all flights') || pageText.includes('trip total'))
    ) {
      return { ready: true, reason: 'Multi-city total found' };
    }
    return { ready: false, reason: 'Waiting for all segments' };
  }
  
  // Unknown trip type - use heuristics
  if (stage.isComplete) {
    return { ready: true, reason: 'Price appears complete' };
  }
  
  return { ready: false, reason: 'Still selecting flights' };
}

// ============================================
// MUTATION OBSERVER FOR SPA DETECTION
// ============================================

let extractionObserver: MutationObserver | null = null;
let extractionTimeout: ReturnType<typeof setTimeout> | null = null;
let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let stabilityTimeout: ReturnType<typeof setTimeout> | null = null;
let lastExtractedPrice: number | null = null;
let lastPriceTimestamp: number = 0;
let activeSessionId: string | null = null;

function notifyPriceFound(snapshot: DirectSnapshot): void {
  console.log('[DirectCapture] Price found:', snapshot);
  
  const payload: DirectCapturedPayload = {
    directSnapshot: snapshot,
    tabId: 0, // Will be filled by background
    url: window.location.href,
  };
  
  // Send to background for session handling
  chrome.runtime.sendMessage({
    type: 'VX_COMPARE_DIRECT_CAPTURED',
    sessionId: activeSessionId,
    payload,
  }).catch(() => {
    console.log('[DirectCapture] Background message failed, using local notification');
  });
  
  // ALSO directly notify the helper widget on this page
  // This ensures price is shown even if background session doesn't exist
  // (e.g., when tab was opened via window.open fallback)
  const priceAmount = snapshot.totalPrice.amount;
  const currency = snapshot.totalPrice.currency || 'USD';
  
  // Dispatch a custom event that the helper can listen for
  window.dispatchEvent(new CustomEvent('vx-direct-price-captured', {
    detail: {
      price: priceAmount,
      currency: currency,
      originalAmount: priceAmount,
      sessionId: activeSessionId,
    }
  }));
  
  console.log('[DirectCapture] Price notification dispatched:', { priceAmount, currency });
}

function updateHelperStatus(status: string, message: string): void {
  chrome.runtime.sendMessage({
    type: 'VX_DIRECT_HELPER_STATUS',
    payload: { status, message },
  }).catch(() => {});
}

function attemptExtraction(): void {
  const snapshot = captureDirectSnapshot();
  
  if (!snapshot) {
    return;
  }
  
  const currentPrice = snapshot.totalPrice.amount;
  
  // Check if ready to capture based on trip type
  const readiness = isReadyToCapture();
  console.log('[DirectCapture] Readiness:', readiness);
  
  if (!readiness.ready) {
    // Update helper with current status
    updateHelperStatus('filling', readiness.reason);
    return;
  }
  
  // Price changed - reset stability timer
  if (currentPrice !== lastExtractedPrice) {
    lastExtractedPrice = currentPrice;
    lastPriceTimestamp = Date.now();
    
    // Update helper to show we found a price but waiting for stability
    updateHelperStatus('ready', `Found $${currentPrice.toFixed(0)} - confirming...`);
    
    // Clear any existing stability timeout
    if (stabilityTimeout) {
      clearTimeout(stabilityTimeout);
    }
    
    // Wait for price to stabilize before capturing
    stabilityTimeout = setTimeout(() => {
      // Check if price is still the same
      if (lastExtractedPrice === currentPrice) {
        console.log('[DirectCapture] Price stabilized at:', currentPrice);
        notifyPriceFound(snapshot);
        stopPriceMonitoring();
      }
    }, MIN_PRICE_STABILITY_TIME);
    
    return;
  }
  
  // Same price - check if enough time has passed for stability
  const timeSinceLastChange = Date.now() - lastPriceTimestamp;
  if (timeSinceLastChange >= MIN_PRICE_STABILITY_TIME) {
    console.log('[DirectCapture] Price stable, capturing:', currentPrice);
    notifyPriceFound(snapshot);
    stopPriceMonitoring();
  }
}

function startPriceMonitoring(sessionId: string, portalSnapshot?: PortalSnapshot): void {
  activeSessionId = sessionId;
  lastExtractedPrice = null;
  lastPriceTimestamp = 0;
  
  // Extract trip context from portal snapshot
  if (portalSnapshot) {
    const flight = portalSnapshot.itinerary as FlightFingerprint | undefined;
    if (flight) {
      tripContext = {
        tripType: flight.returnDate ? 'roundTrip' : 'oneWay',
        origin: flight.origin,
        destination: flight.destination,
        departDate: flight.departDate,
        returnDate: flight.returnDate,
        expectedLegs: flight.returnDate ? 2 : 1,
        portalPrice: portalSnapshot.totalPrice.amount,
      };
    }
  }
  
  console.log('[DirectCapture] Starting monitoring:', {
    sessionId,
    tripContext,
  });
  
  // Stop any existing monitoring
  stopPriceMonitoring();
  
  // Initial status update
  if (tripContext.tripType === 'roundTrip') {
    updateHelperStatus('filling', 'Select departure and return flights');
  } else {
    updateHelperStatus('filling', 'Select your flight');
  }
  
  // Initial extraction attempt
  setTimeout(attemptExtraction, 1000);
  
  // Set up MutationObserver for SPA updates
  extractionObserver = new MutationObserver(() => {
    // Debounce mutations
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(attemptExtraction, DEBOUNCE_DELAY);
  });
  
  extractionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  
  // Also listen for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[DirectCapture] URL changed:', lastUrl);
      setTimeout(attemptExtraction, 1000);
    }
  }, 500);
  
  // Set overall timeout
  extractionTimeout = setTimeout(() => {
    console.log('[DirectCapture] Extraction timeout reached');
    clearInterval(urlCheckInterval);
    stopPriceMonitoring();
    
    // Notify of failure
    chrome.runtime.sendMessage({
      type: 'VX_COMPARE_STATUS_UPDATE',
      sessionId,
      payload: {
        status: 'FAILED',
        message: 'Could not detect total price. Please enter manually.',
      },
    });
    
    updateHelperStatus('error', 'Could not detect price. Enter manually?');
  }, EXTRACTION_TIMEOUT);
}

/**
 * Start price monitoring from helper (for fallback window.open flow)
 * Called when directSiteHelper detects a pending comparison
 */
export function startPriceMonitoringForHelper(sessionId: string, portalSnapshot?: PortalSnapshot): void {
  console.log('[DirectCapture] Starting monitoring from helper for session:', sessionId);
  startPriceMonitoring(sessionId, portalSnapshot);
}

function stopPriceMonitoring(): void {
  if (extractionObserver) {
    extractionObserver.disconnect();
    extractionObserver = null;
  }
  if (extractionTimeout) {
    clearTimeout(extractionTimeout);
    extractionTimeout = null;
  }
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
  if (stabilityTimeout) {
    clearTimeout(stabilityTimeout);
    stabilityTimeout = null;
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

export function setupDirectCaptureListeners(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VX_COMPARE_CAPTURE_DIRECT') {
      console.log('[DirectCapture] Received capture request');
      
      const sessionId = message.sessionId;
      const portalSnapshot = message.portalSnapshot as PortalSnapshot | undefined;
      
      // Start monitoring for price with trip context
      startPriceMonitoring(sessionId, portalSnapshot);
      
      // Also try immediate extraction
      const snapshot = captureDirectSnapshot();
      
      if (snapshot) {
        sendResponse({ success: true, snapshot });
      } else {
        sendResponse({
          success: false,
          message: 'Price not found yet. Monitoring for updates...',
        });
      }
      
      return true;
    }
    
    // Accept trip context from helper or portal
    if (message.type === 'VX_SET_TRIP_CONTEXT') {
      const payload = message.payload as {
        tripType: 'roundTrip' | 'oneWay' | 'multiCity';
        origin?: string;
        destination?: string;
        departDate?: string;
        returnDate?: string;
        portalPrice?: number;
      };
      
      tripContext = {
        tripType: payload.tripType,
        origin: payload.origin,
        destination: payload.destination,
        departDate: payload.departDate,
        returnDate: payload.returnDate,
        expectedLegs: payload.tripType === 'roundTrip' ? 2 : payload.tripType === 'multiCity' ? 3 : 1,
        portalPrice: payload.portalPrice,
      };
      
      console.log('[DirectCapture] Trip context set:', tripContext);
      sendResponse({ success: true });
      return true;
    }
    
    // Accept helper show message and extract trip context
    if (message.type === 'VX_SHOW_DIRECT_HELPER') {
      const payload = message.payload as {
        tripInfo: PortalSnapshot;
        portalPrice: number;
        sessionId: string;
      };
      
      if (payload.tripInfo) {
        const flight = payload.tripInfo.itinerary as FlightFingerprint | undefined;
        if (flight) {
          tripContext = {
            tripType: flight.returnDate ? 'roundTrip' : 'oneWay',
            origin: flight.origin,
            destination: flight.destination,
            departDate: flight.departDate,
            returnDate: flight.returnDate,
            expectedLegs: flight.returnDate ? 2 : 1,
            portalPrice: payload.portalPrice,
          };
          console.log('[DirectCapture] Trip context from helper:', tripContext);
        }
      }
      
      // Note: The actual helper UI is handled by directSiteHelper.ts
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'VX_COMPARE_CANCEL') {
      console.log('[DirectCapture] Received cancel request');
      stopPriceMonitoring();
      activeSessionId = null;
      tripContext = { tripType: 'unknown', expectedLegs: 1 };
      sendResponse({ success: true });
      return true;
    }
    
    if (message.type === 'VX_GET_DIRECT_PREVIEW') {
      const snapshot = captureDirectSnapshot();
      const airlineConfig = getAirlineByDomain(window.location.hostname);
      const readiness = isReadyToCapture();
      
      sendResponse({
        isSupportedAirline: !!airlineConfig,
        airlineName: airlineConfig?.name,
        airlineCode: airlineConfig?.code,
        hasPrice: !!snapshot,
        price: snapshot?.totalPrice.amount,
        pageType: detectDirectPageType(),
        tripContext,
        readiness,
      });
      
      return true;
    }
    
    return false;
  });
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

function shouldInitialize(): boolean {
  const hostname = window.location.hostname;
  const fullUrl = window.location.href;
  
  // Check for Google Flights
  if (hostname.includes('google.com') && (fullUrl.includes('/travel/flights') || fullUrl.includes('/flights'))) {
    return true;
  }
  
  // Check if this is a supported airline domain
  const supportedDomains = AIRLINE_CONFIGS.map((c) => c.domain);
  return supportedDomains.some((domain) => hostname.includes(domain));
}

if (shouldInitialize()) {
  setupDirectCaptureListeners();
  console.log('[DirectCapture] Initialized for:', window.location.hostname);
}
