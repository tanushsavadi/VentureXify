// ============================================
// GOOGLE FLIGHTS EXTRACTOR
// ============================================
// Site-specific extractor for Google Flights
// Uses the new extraction pipeline with custom logic

import {
  ExtractionResult,
  Evidence,
  PriceBreakdown,
  FlightCapture,
  ExtractedFlightItinerary,
  createSuccessResult,
  createFailedResult,
  Confidence,
} from '../../../lib/extraction/types';
import { runExtractionPipeline } from '../../../lib/extraction/pipeline';
import { recordExtractionEvent } from '../../../lib/extraction/health';
import {
  isVisible,
  isVentureXWidget,
  getTextContent,
} from '../../../lib/extraction/domUtils';

// ============================================
// CONSTANTS
// ============================================

const SITE_KEY = 'google.com/flights';

/** Currency code patterns to detect */
const CURRENCY_PATTERNS = [
  // Currency code + amount
  /(AED|EUR|GBP|CAD|AUD|INR|JPY|CHF|CNY|MXN|SGD|HKD|KRW|NZD|SEK|NOK|DKK|PLN|THB|MYR|IDR|PHP|VND|ZAR|BRL|TRY|RUB|SAR|QAR|BHD|KWD|OMR|JOD|USD)\s*([\d,]+(?:\.\d{2})?)/gi,
  // Symbol + amount
  /(\$|£|€|¥|₹)\s*([\d,]+(?:\.\d{2})?)/g,
];

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  '$': 'USD',
  '£': 'GBP', 
  '€': 'EUR',
  '¥': 'JPY',
  '₹': 'INR'
};

// ============================================
// GOOGLE FLIGHTS SPECIFIC EXTRACTION
// ============================================

interface GFPriceCandidate {
  amount: number;
  currency: string;
  confidence: Confidence;
  context: string;
  source: 'lowestTotal' | 'header' | 'bookWith' | 'dom' | 'generic';
}

/**
 * Get clean page text excluding VentureX widgets
 */
function getCleanPageText(): string {
  const vxElements = document.querySelectorAll(
    '#vx-direct-helper, #vx-auto-compare-widget, [id^="vx-"], [class*="vx-helper"], [class*="vx-widget"]'
  );
  
  const originalDisplays: string[] = [];
  vxElements.forEach((el, idx) => {
    const htmlEl = el as HTMLElement;
    originalDisplays[idx] = htmlEl.style.display;
    htmlEl.style.display = 'none';
  });
  
  const pageText = document.body.innerText || '';
  
  vxElements.forEach((el, idx) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.display = originalDisplays[idx];
  });
  
  return pageText;
}

/**
 * Check if we're on a Google Flights page
 */
export function isGoogleFlightsPage(): boolean {
  const url = window.location.href;
  return url.includes('google.com') && 
         (url.includes('/travel/flights') || url.includes('/flights'));
}

/**
 * Detect if on booking page vs search results
 */
export function detectGoogleFlightsPageType(): 'search' | 'booking' | 'details' | 'unknown' {
  const url = window.location.href;
  
  if (url.includes('/booking')) return 'booking';
  if (url.includes('tfs=')) return 'booking'; // Token flight search = booking page
  if (url.includes('/search')) return 'search';
  if (url.includes('explore')) return 'search';
  
  // Check page content
  const pageText = document.body.innerText.toLowerCase();
  if (pageText.includes('book with') || pageText.includes('lowest total price')) {
    return 'booking';
  }
  if (pageText.includes('select a flight') || pageText.includes('flights from')) {
    return 'search';
  }
  
  return 'unknown';
}

/**
 * Extract price from "Lowest total price" section
 */
function extractLowestTotalPrice(pageText: string): GFPriceCandidate | null {
  const lowestIdx = pageText.toLowerCase().indexOf('lowest total price');
  
  if (lowestIdx === -1) return null;
  
  // Get text around "Lowest total price" - price is usually just before
  const textAround = pageText.substring(Math.max(0, lowestIdx - 100), lowestIdx + 30);
  
  for (const pattern of CURRENCY_PATTERNS) {
    pattern.lastIndex = 0;
    const matches: { currency: string; amount: number; index: number }[] = [];
    let match;
    
    while ((match = pattern.exec(textAround)) !== null) {
      const currency = SYMBOL_TO_CURRENCY[match[1]] || match[1].toUpperCase();
      const amount = parseFloat(match[2].replace(/,/g, ''));
      
      // Reasonable flight price range
      if (amount > 100 && amount < 500000) {
        matches.push({ currency, amount, index: match.index });
      }
    }
    
    if (matches.length > 0) {
      // Last match is closest to "Lowest total price"
      const best = matches[matches.length - 1];
      return {
        amount: best.amount,
        currency: best.currency,
        confidence: 'HIGH',
        context: `${best.currency} ${best.amount} (Lowest total price)`,
        source: 'lowestTotal',
      };
    }
  }
  
  return null;
}

/**
 * Extract price from DOM elements
 */
function extractFromDOMElements(): GFPriceCandidate[] {
  const candidates: GFPriceCandidate[] = [];
  
  const priceSelectors = [
    '[aria-label*="price"]',
    '[aria-label*="Price"]',
    '[aria-label*="total"]',
    '[aria-label*="Total"]',
    '[class*="FpEdX"]',
    '[class*="YMlIz"]',
    '[class*="jBp0Xe"]',
    '[class*="gOatQ"]',
    '[class*="u3FI0d"]',
  ];
  
  for (const selector of priceSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      
      for (const el of elements) {
        if (isVentureXWidget(el)) continue;
        if (!isVisible(el)) continue;
        
        const text = getTextContent(el);
        
        for (const pattern of CURRENCY_PATTERNS) {
          pattern.lastIndex = 0;
          const match = pattern.exec(text);
          
          if (match) {
            const currency = SYMBOL_TO_CURRENCY[match[1]] || match[1].toUpperCase();
            const amount = parseFloat(match[2].replace(/,/g, ''));
            
            // Filter reasonable prices
            const minPrice = ['AED', 'JPY', 'INR', 'KRW'].includes(currency) ? 500 : 100;
            const maxPrice = ['AED', 'JPY', 'INR', 'KRW'].includes(currency) ? 500000 : 50000;
            
            if (amount >= minPrice && amount <= maxPrice) {
              candidates.push({
                amount,
                currency,
                confidence: 'MEDIUM',
                context: text.substring(0, 100),
                source: 'dom',
              });
            }
          }
        }
      }
    } catch {
      // Skip invalid selectors
    }
  }
  
  return candidates;
}

/**
 * Extract price from header/summary area
 */
function extractHeaderPrice(pageText: string): GFPriceCandidate | null {
  // Look for price before "Round trip" or "Economy" labels
  const headerMatch = pageText.match(
    /(AED|USD|EUR|GBP|\$|€|£)\s*([\d,]+(?:\.\d{2})?)\s*(?:\n|\s)*(?:Lowest|Round\s+trip|Economy|per\s+person)/i
  );
  
  if (!headerMatch) return null;
  
  const currency = SYMBOL_TO_CURRENCY[headerMatch[1]] || headerMatch[1].toUpperCase();
  const amount = parseFloat(headerMatch[2].replace(/,/g, ''));
  
  if (amount > 100 && amount < 100000) {
    return {
      amount,
      currency,
      confidence: 'HIGH',
      context: `${currency} ${amount} (header)`,
      source: 'header',
    };
  }
  
  return null;
}

/**
 * Main Google Flights price extraction
 */
export function extractGoogleFlightsPrice(): ExtractionResult<PriceBreakdown> {
  const startTime = performance.now();
  const pageText = getCleanPageText();
  const pageType = detectGoogleFlightsPageType();
  
  const evidence: Evidence = {
    matchedText: '',
    url: window.location.href,
    hostname: window.location.hostname,
    candidateScores: [],
    warnings: [],
  };
  
  console.log('[GF Extractor] Page type:', pageType, 'Text length:', pageText.length);
  
  // Strategy 1: Lowest total price (highest priority on booking page)
  if (pageType === 'booking') {
    const lowestPrice = extractLowestTotalPrice(pageText);
    if (lowestPrice) {
      console.log('[GF Extractor] Found lowest total price:', lowestPrice);
      
      evidence.matchedText = lowestPrice.context;
      evidence.normalizedValue = lowestPrice.amount;
      evidence.currency = lowestPrice.currency;
      
      const breakdown: PriceBreakdown = {
        total: {
          amount: lowestPrice.amount,
          currency: lowestPrice.currency,
          rawText: lowestPrice.context,
        },
      };
      
      return createSuccessResult(
        breakdown,
        lowestPrice.confidence,
        'SELECTOR_PRIMARY',
        evidence,
        performance.now() - startTime,
        { successfulTier: 1 }
      );
    }
  }
  
  // Strategy 2: Header price
  const headerPrice = extractHeaderPrice(pageText);
  if (headerPrice) {
    console.log('[GF Extractor] Found header price:', headerPrice);
    
    evidence.matchedText = headerPrice.context;
    evidence.normalizedValue = headerPrice.amount;
    evidence.currency = headerPrice.currency;
    
    const breakdown: PriceBreakdown = {
      total: {
        amount: headerPrice.amount,
        currency: headerPrice.currency,
        rawText: headerPrice.context,
      },
    };
    
    return createSuccessResult(
      breakdown,
      headerPrice.confidence,
      'SELECTOR_FALLBACK',
      evidence,
      performance.now() - startTime,
      { successfulTier: 1 }
    );
  }
  
  // Strategy 3: DOM elements
  const domCandidates = extractFromDOMElements();
  
  if (domCandidates.length > 0) {
    // Sort by confidence and prefer lower prices (better for user)
    domCandidates.sort((a, b) => {
      const confOrder: Record<Confidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
      const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      return a.amount - b.amount;
    });
    
    const best = domCandidates[0];
    console.log('[GF Extractor] Best DOM candidate:', best);
    
    evidence.matchedText = best.context;
    evidence.normalizedValue = best.amount;
    evidence.currency = best.currency;
    evidence.candidateScores = domCandidates.slice(0, 5).map((c, i) => ({
      text: c.context,
      value: c.amount,
      score: 100 - i * 10,
      reasons: [`Source: ${c.source}`],
    }));
    
    const breakdown: PriceBreakdown = {
      total: {
        amount: best.amount,
        currency: best.currency,
        rawText: best.context,
      },
    };
    
    return createSuccessResult(
      breakdown,
      best.confidence,
      'SEMANTIC',
      evidence,
      performance.now() - startTime,
      { successfulTier: 2 }
    );
  }
  
  // Strategy 4: Failed to extract
  console.log('[GF Extractor] No price found with site-specific strategies');
  
  return createFailedResult<PriceBreakdown>(
    ['Google Flights: No price found with site-specific extraction'],
    evidence,
    performance.now() - startTime,
    {
      tiersAttempted: [1, 2],
      suggestions: ['Try the heuristic pipeline or user-assisted capture']
    }
  );
}

/**
 * Extract Google Flights price using full pipeline (async)
 */
export async function extractGoogleFlightsPriceAsync(): Promise<ExtractionResult<PriceBreakdown>> {
  // First try site-specific extraction
  const siteSpecificResult = extractGoogleFlightsPrice();
  
  if (siteSpecificResult.ok && siteSpecificResult.confidence !== 'NONE') {
    return siteSpecificResult;
  }
  
  // Fall back to heuristic pipeline
  console.log('[GF Extractor] Falling back to heuristic pipeline');
  
  const pipelineResult = await runExtractionPipeline({
    contextHints: {
      pageType: detectGoogleFlightsPageType(),
      bookingType: 'flight',
    },
    priceRange: { min: 50, max: 50000 },
    debug: true,
  });
  
  return pipelineResult;
}

/**
 * Extract full flight capture with itinerary
 */
export async function captureGoogleFlight(): Promise<FlightCapture> {
  const startTime = performance.now();
  
  // Extract price
  const priceResult = await Promise.resolve(extractGoogleFlightsPrice());
  
  // Record health event
  await recordExtractionEvent(priceResult);
  
  // Try to extract itinerary (simplified for now)
  const itinerary: ExtractedFlightItinerary = {};
  
  try {
    // Extract origin/destination from page
    const pageText = getCleanPageText();
    
    // Look for route pattern (e.g., "JFK → LHR")
    const routeMatch = pageText.match(/([A-Z]{3})\s*[→→\->]\s*([A-Z]{3})/);
    if (routeMatch) {
      itinerary.outbound = {
        origin: routeMatch[1],
        destination: routeMatch[2],
      };
    }
    
    // Look for dates
    const dateMatch = pageText.match(/(\w{3}\s+\d{1,2})[,\s]+(\d{4})?/);
    if (dateMatch) {
      // Parse date (simplified)
      itinerary.departDate = dateMatch[0];
    }
    
    // Check for round trip
    if (pageText.toLowerCase().includes('round trip')) {
      itinerary.tripType = 'roundTrip';
    } else if (pageText.toLowerCase().includes('one way')) {
      itinerary.tripType = 'oneWay';
    }
    
  } catch (e) {
    console.warn('[GF Extractor] Could not extract itinerary:', e);
  }
  
  return {
    price: priceResult,
    itinerary: itinerary.outbound ? createSuccessResult(
      itinerary,
      'LOW',
      'HEURISTIC',
      {
        matchedText: '',
        url: window.location.href,
        hostname: window.location.hostname,
      },
      performance.now() - startTime
    ) : undefined,
    siteName: 'Google Flights',
    pageUrl: window.location.href,
    pageType: detectGoogleFlightsPageType() as FlightCapture['pageType'],
    capturedAt: Date.now(),
  };
}
