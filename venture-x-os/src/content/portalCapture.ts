// ============================================
// PORTAL CAPTURE - CAPITAL ONE TRAVEL EXTRACTOR
// ============================================

import {
  PortalSnapshot,
  PriceSnapshot,
  FlightFingerprint,
  HotelFingerprint,
  PortalCapturedPayload,
} from '../lib/compareTypes';
import { BookingType, ConfidenceLevel } from '../lib/types';
import {
  getSelectorConfig,
  getEffectiveSelectors,
  getTotalPriceSelectors,
} from '../config/selectorsRegistry';

// ============================================
// CONSTANTS
// ============================================

const CAPITAL_ONE_TRAVEL_PATTERNS = [
  /travel\.capitalone\.com/i,
  /capitalone\.com\/travel/i,
];

const PRICE_REGEX = /\$[\d,]+(?:\.\d{2})?/g;
const IATA_CODE_REGEX = /\b([A-Z]{3})\b/g;
const DATE_REGEX = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\w{3}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi;
const FLIGHT_NUMBER_REGEX = /\b([A-Z]{2})\s*(\d{1,4})\b/g;

// ============================================
// PAGE TYPE DETECTION
// ============================================

type PageType = 'search' | 'details' | 'checkout' | 'unknown';

function detectPageType(): PageType {
  const url = window.location.href.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  
  // Check URL patterns
  if (url.includes('checkout') || url.includes('payment') || url.includes('review')) {
    return 'checkout';
  }
  if (url.includes('details') || url.includes('itinerary') || url.includes('/flight/')) {
    return 'details';
  }
  if (url.includes('search') || url.includes('results') || url.includes('flights')) {
    return 'search';
  }
  
  // Check page content hints
  const pageText = document.body.innerText.toLowerCase();
  if (pageText.includes('complete your booking') || pageText.includes('payment information')) {
    return 'checkout';
  }
  if (pageText.includes('trip summary') || pageText.includes('flight details')) {
    return 'details';
  }
  if (pageText.includes('select a flight') || pageText.includes('choose your flight')) {
    return 'search';
  }
  
  return 'unknown';
}

// ============================================
// BOOKING TYPE DETECTION
// ============================================

function detectBookingType(): BookingType {
  const url = window.location.href.toLowerCase();
  const pageText = document.body.innerText.toLowerCase();
  
  // URL-based detection
  if (url.includes('/flight') || url.includes('flights')) return 'flight';
  if (url.includes('/hotel') || url.includes('hotels')) return 'hotel';
  if (url.includes('/car') || url.includes('rental')) return 'rental';
  
  // Content-based detection
  if (pageText.includes('departure') && pageText.includes('arrival')) return 'flight';
  if (pageText.includes('check-in') && pageText.includes('check-out')) return 'hotel';
  if (pageText.includes('pick-up') && pageText.includes('drop-off') && pageText.includes('car')) return 'rental';
  
  return 'other';
}

// ============================================
// PRICE EXTRACTION
// ============================================

interface PriceCandidate {
  amount: number;
  element: Element;
  context: string;
  confidence: ConfidenceLevel;
  isTotal: boolean;
}

function parsePrice(priceStr: string): number | null {
  const clean = priceStr.replace(/[$,]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function extractPriceCandidates(): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  const hostname = window.location.hostname;
  const bodyText = document.body.innerText;
  
  console.log('[PortalCapture] Extracting prices from:', hostname);
  console.log('[PortalCapture] Body text length:', bodyText.length);
  
  // Strategy 0: Capital One Travel specific extraction
  // Look for their specific price patterns FIRST before trying generic selectors
  const isCapitalOne = hostname.includes('capitalone');
  
  if (isCapitalOne) {
    console.log('[PortalCapture] ✅ Capital One Travel detected, using specialized extraction');
    
    // Debug: Show what we're searching in
    const textSample = bodyText.substring(0, 2000);
    console.log('[PortalCapture] Text sample:', textSample);
    
    // Pattern 1: Look for "$XXX per traveler" in buttons or text
    // This is the main pattern on the review itinerary page
    const perTravelerPattern = /\$[\d,]+(?:\.\d{2})?\s*per\s*traveler/gi;
    console.log('[PortalCapture] Looking for per-traveler pattern...');
    let match;
    while ((match = perTravelerPattern.exec(bodyText)) !== null) {
      console.log('[PortalCapture] Found per-traveler match:', match[0]);
      const priceMatch = match[0].match(PRICE_REGEX);
      if (priceMatch) {
        const price = parsePrice(priceMatch[0]);
        if (price && price > 50 && price < 50000) {
          candidates.push({
            amount: price,
            element: document.body,
            context: `[C1 PerTraveler] ${match[0]}`,
            confidence: 'HIGH',
            isTotal: true,
          });
          console.log('[PortalCapture] Found per-traveler price:', price);
        }
      }
    }
    
    // Pattern 2: Look for "Continue | $XXX per traveler" button pattern (exact Capital One format)
    const continueButtonPattern = /Continue\s*\|\s*\$[\d,]+(?:\.\d{2})?\s*per\s*traveler/gi;
    console.log('[PortalCapture] Looking for Continue button pattern...');
    while ((match = continueButtonPattern.exec(bodyText)) !== null) {
      console.log('[PortalCapture] Found Continue button match:', match[0]);
      const priceMatch = match[0].match(PRICE_REGEX);
      if (priceMatch) {
        const price = parsePrice(priceMatch[0]);
        if (price && price > 50 && price < 50000) {
          // Check if already added
          const isDuplicate = candidates.some(c => Math.abs(c.amount - price) < 0.01);
          if (!isDuplicate) {
            candidates.push({
              amount: price,
              element: document.body,
              context: `[C1 ContinueBtn] ${match[0]}`,
              confidence: 'HIGH',
              isTotal: true,
            });
            console.log('[PortalCapture] Found continue button price:', price);
          }
        }
      }
    }
    
    // Pattern 3: Look for "$XXX / XXX,XXX Miles" pattern (price with miles alternative)
    const priceWithMilesPattern = /\$[\d,]+(?:\.\d{2})?\s*\/\s*[\d,]+\s*Miles/gi;
    while ((match = priceWithMilesPattern.exec(bodyText)) !== null) {
      const priceMatch = match[0].match(PRICE_REGEX);
      if (priceMatch) {
        const price = parsePrice(priceMatch[0]);
        if (price && price > 50 && price < 50000) {
          const isDuplicate = candidates.some(c => Math.abs(c.amount - price) < 0.01);
          if (!isDuplicate) {
            candidates.push({
              amount: price,
              element: document.body,
              context: `[C1 WithMiles] ${match[0]}`,
              confidence: 'HIGH',
              isTotal: true,
            });
            console.log('[PortalCapture] Found price with miles:', price);
          }
        }
      }
    }
    
    // Pattern 4: Look for "Round trip, per traveler" price
    const roundTripPattern = /Round\s*trip[,\s]*per\s*traveler/gi;
    if (roundTripPattern.test(bodyText)) {
      // Find the price near this text
      const allPrices = bodyText.match(PRICE_REGEX) || [];
      for (const priceStr of allPrices) {
        const price = parsePrice(priceStr);
        if (price && price > 100 && price < 50000) {
          const isDuplicate = candidates.some(c => Math.abs(c.amount - price) < 0.01);
          if (!isDuplicate) {
            candidates.push({
              amount: price,
              element: document.body,
              context: `[C1 RoundTrip] ${priceStr}`,
              confidence: 'MED',
              isTotal: true,
            });
          }
        }
      }
    }
    
    // Pattern 5: Look specifically in "Free price drop protection included" section
    // This section shows the total: "$896 / 89,633 Miles Round trip, per traveler"
    const priceProtectionElements = document.querySelectorAll('[class*="price"], [class*="Price"], [class*="protection"], [class*="Protection"]');
    for (const el of priceProtectionElements) {
      const text = el.textContent || '';
      if (text.length < 500) {
        const matches = text.match(PRICE_REGEX);
        if (matches) {
          for (const priceStr of matches) {
            const price = parsePrice(priceStr);
            if (price && price > 100 && price < 50000) {
              const isDuplicate = candidates.some(c => Math.abs(c.amount - price) < 0.01);
              if (!isDuplicate) {
                candidates.push({
                  amount: price,
                  element: el,
                  context: `[C1 PriceSection] ${text.substring(0, 100)}`,
                  confidence: 'HIGH',
                  isTotal: true,
                });
                console.log('[PortalCapture] Found price in price section:', price);
              }
            }
          }
        }
      }
    }
    
    // If we found candidates from Capital One specific patterns, log it
    if (candidates.length > 0) {
      console.log('[PortalCapture] Found', candidates.length, 'candidates from Capital One patterns');
    }
  }
  
  // Strategy 0.5: Use Selector Registry for all supported sites
  // This uses the centralized selector registry for consistent extraction
  const siteConfig = getSelectorConfig(hostname);
  
  if (siteConfig && candidates.length === 0) {
    console.log('[PortalCapture] Using selector registry for price extraction');
    const registrySelectors = getTotalPriceSelectors(hostname);
    
    for (const selector of registrySelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent || '';
          const matches = text.match(PRICE_REGEX);
          if (matches) {
            for (const priceMatch of matches) {
              const price = parsePrice(priceMatch);
              if (price && price > 50 && price < 50000) {
                const isDuplicate = candidates.some(c => Math.abs(c.amount - price) < 0.01);
                if (!isDuplicate) {
                  candidates.push({
                    amount: price,
                    element,
                    context: `[Registry] ${text.substring(0, 100)}`,
                    confidence: 'HIGH',
                    isTotal: true,
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignore selector errors
      }
    }
    
    // If we found candidates from registry, prioritize them
    if (candidates.length > 0) {
      console.log('[PortalCapture] Found', candidates.length, 'candidates from selector registry');
    }
  }
  
  // Strategy 1: Look for "Total" label with nearby price
  // bodyText is declared at top of function
  const totalPatterns = [
    /Total[:\s]*(\$[\d,]+(?:\.\d{2})?)/gi,
    /Amount\s*due[:\s]*(\$[\d,]+(?:\.\d{2})?)/gi,
    /Trip\s*total[:\s]*(\$[\d,]+(?:\.\d{2})?)/gi,
    /Grand\s*total[:\s]*(\$[\d,]+(?:\.\d{2})?)/gi,
  ];
  
  for (const pattern of totalPatterns) {
    let match;
    while ((match = pattern.exec(bodyText)) !== null) {
      const price = parsePrice(match[1]);
      if (price && price > 50 && price < 50000) {
        candidates.push({
          amount: price,
          element: document.body,
          context: match[0],
          confidence: 'HIGH',
          isTotal: true,
        });
      }
    }
  }
  
  // Strategy 2: Look for specific selectors (fallback to hardcoded if registry fails)
  // These are kept as fallback for cases where registry selectors might fail
  const totalSelectors = siteConfig ? [] : [
    // Only use hardcoded selectors if no site config found
    '[data-testid*="total"]',
    '[data-testid*="price"]',
    '[class*="total-price"]',
    '[class*="totalPrice"]',
    '[class*="TotalPrice"]',
    '[class*="trip-total"]',
    '[class*="tripTotal"]',
    '[class*="grand-total"]',
    '[class*="summary"] [class*="price"]',
    '[class*="checkout"] [class*="total"]',
  ];
  
  for (const selector of totalSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || '';
        const matches = text.match(PRICE_REGEX);
        if (matches) {
          for (const priceMatch of matches) {
            const price = parsePrice(priceMatch);
            if (price && price > 50 && price < 50000) {
              candidates.push({
                amount: price,
                element,
                context: text.substring(0, 100),
                confidence: 'MED',
                isTotal: true,
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
  }
  
  // Strategy 3: Look for elements containing "Total" text
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    // Skip if it's a child of an already found element
    const text = element.textContent?.trim() || '';
    if (text.length > 500) continue; // Skip large containers
    
    if (/\btotal\b/i.test(text)) {
      const matches = text.match(PRICE_REGEX);
      if (matches) {
        for (const priceMatch of matches) {
          const price = parsePrice(priceMatch);
          if (price && price > 50 && price < 50000) {
            // Check if already in candidates
            const isDuplicate = candidates.some((c) => Math.abs(c.amount - price) < 0.01);
            if (!isDuplicate) {
              candidates.push({
                amount: price,
                element,
                context: text.substring(0, 100),
                confidence: 'LOW',
                isTotal: /total/i.test(text),
              });
            }
          }
        }
      }
    }
  }
  
  // Sort by confidence and amount (higher amount likely total)
  candidates.sort((a, b) => {
    const confOrder = { HIGH: 0, MED: 1, LOW: 2 };
    if (confOrder[a.confidence] !== confOrder[b.confidence]) {
      return confOrder[a.confidence] - confOrder[b.confidence];
    }
    return b.amount - a.amount; // Prefer higher amount
  });
  
  return candidates;
}

function extractBestPrice(): PriceSnapshot | null {
  const candidates = extractPriceCandidates();
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Take the best candidate
  const best = candidates[0];
  
  return {
    amount: best.amount,
    currency: 'USD',
    confidence: best.confidence,
    label: best.isTotal ? 'total' : 'unknown',
    extractedAt: Date.now(),
    source: 'auto',
  };
}

// ============================================
// ITINERARY EXTRACTION
// ============================================

function extractFlightFingerprint(): FlightFingerprint | null {
  const pageText = document.body.innerText;
  
  let origin: string | undefined;
  let destination: string | undefined;
  let departDate: string | undefined;
  let returnDate: string | undefined;
  let isRoundTrip = false;
  
  console.log('[PortalCapture] Extracting flight fingerprint...');
  
  // ============================================
  // CAPITAL ONE TRAVEL SPECIFIC EXTRACTION
  // ============================================
  
  // Known valid IATA airport codes (common ones to prefer)
  const commonAirports = [
    'JFK', 'LAX', 'ORD', 'DFW', 'DEN', 'ATL', 'SFO', 'SEA', 'MIA', 'BOS', 'EWR', 'IAH', 'PHX', 'LAS', 'MCO', 'MSP', 'DTW', 'PHL', 'CLT', 'LGA',
    'AUH', 'DXB', 'DOH', 'SIN', 'HKG', 'NRT', 'ICN', 'BKK', 'KUL', 'DEL', 'BOM', 'PEK', 'PVG', 'HND', 'TPE',
    'LHR', 'CDG', 'AMS', 'FRA', 'MAD', 'BCN', 'FCO', 'MUC', 'ZRH', 'VIE', 'CPH', 'OSL', 'ARN', 'HEL',
    'SYD', 'MEL', 'AKL', 'BNE', 'PER', 'ADL',
    'YYZ', 'YVR', 'YUL', 'YYC', 'YOW',
    'MEX', 'CUN', 'GDL', 'SJD', 'PTY', 'LIM', 'BOG', 'SCL', 'GRU', 'EZE', 'GIG',
    // Middle East hub airports
    'RUH', 'JED', 'DMM', 'AMM', 'CAI', 'CMN', 'IST', 'SAW', 'TLV', 'MCT', 'BAH', 'KWI'
  ];
  
  // More non-airport codes to filter
  const nonAirportCodes = [
    'USD', 'USA', 'THE', 'AND', 'FOR', 'NON', 'ONE', 'TWO', 'DAY',
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
    'ADY', 'BOO', 'BAD', 'BIG', 'CAR', 'CAT', 'DOG', 'FAT', 'FLY', 'GET', 'GOT', 'HAS', 'HAD', 'HIT', 'HOT', 'JOB', 'KEY', 'LET', 'LOT', 'MAN', 'NEW', 'NOT', 'NOW', 'OLD', 'OUT', 'OUR', 'PUT', 'RAN', 'RUN', 'SAY', 'SEE', 'SET', 'SIT', 'TAX', 'TIP', 'TOP', 'TRY', 'USE', 'VIA', 'WAS', 'WAY', 'WHO', 'WHY', 'WIN', 'WON', 'YES', 'YET', 'YOU',
    'AIR', 'ALL', 'ANY', 'ARE', 'BUT', 'CAN', 'DID', 'END', 'FEW', 'GOT', 'HER', 'HIM', 'HIS', 'HOW', 'ITS', 'OWN', 'SAW', 'TOO'
  ];
  
  // Strategy 1: Look for specific flight route elements first (DOM-based)
  // Capital One Travel typically shows routes in specific elements
  const routeSelectors = [
    '[class*="route"]',
    '[class*="flight-info"]',
    '[class*="itinerary"]',
    '[class*="segment"]',
    '[data-testid*="route"]',
    '[data-testid*="flight"]',
  ];
  
  const routeMatches: Array<{origin: string; dest: string; priority: number}> = [];
  
  // Try DOM-based extraction first (higher priority)
  for (const selector of routeSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent || '';
        const pattern = /\b([A-Z]{3})\s*[-–—→]\s*([A-Z]{3})\b/g;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const o = match[1];
          const d = match[2];
          if (!nonAirportCodes.includes(o) && !nonAirportCodes.includes(d)) {
            const priority = commonAirports.includes(o) && commonAirports.includes(d) ? 1 : 2;
            routeMatches.push({ origin: o, dest: d, priority });
            console.log('[PortalCapture] DOM route found:', o, '->', d, '(priority:', priority, ')');
          }
        }
      }
    } catch (e) {
      // Ignore selector errors
    }
  }
  
  // Strategy 2: Look for "XXX - YYY" pattern in page text (lower priority)
  const routeDisplayPattern = /\b([A-Z]{3})\s*[-–—→]\s*([A-Z]{3})\b/g;
  let routeMatch;
  
  while ((routeMatch = routeDisplayPattern.exec(pageText)) !== null) {
    const o = routeMatch[1];
    const d = routeMatch[2];
    if (!nonAirportCodes.includes(o) && !nonAirportCodes.includes(d)) {
      // Check if already found
      const exists = routeMatches.some(r => r.origin === o && r.dest === d);
      if (!exists) {
        const priority = commonAirports.includes(o) && commonAirports.includes(d) ? 3 : 4;
        routeMatches.push({ origin: o, dest: d, priority });
        console.log('[PortalCapture] Text route found:', o, '->', d, '(priority:', priority, ')');
      }
    }
  }
  
  // Sort by priority and use best match
  routeMatches.sort((a, b) => a.priority - b.priority);
  
  if (routeMatches.length > 0) {
    origin = routeMatches[0].origin;
    destination = routeMatches[0].dest;
    console.log('[PortalCapture] Selected route:', origin, '->', destination);
    
    // Check for round trip: if we see reverse route (dest -> origin), it's round trip
    const hasReturnLeg = routeMatches.some(r => r.origin === destination && r.dest === origin);
    isRoundTrip = hasReturnLeg;
    console.log('[PortalCapture] Return leg found:', hasReturnLeg);
  } else {
    // ============================================
    // FALLBACK: New Capital One layout detection
    // The "Confirm and Book" page shows airport codes in specific elements
    // Look for pattern: "AUH - JFK" or codes near departure/arrival times
    // ============================================
    console.log('[PortalCapture] No route matches found via standard patterns, trying fallback...');
    
    // Try to find airport codes near time patterns (12:20 PM)
    const timeWithAirportPattern = /(\d{1,2}:\d{2}\s*[APap][Mm])[\s\S]{0,200}?([A-Z]{3})\s*[-–—]\s*([A-Z]{3})/;
    const fallbackMatch = pageText.match(timeWithAirportPattern);
    
    if (fallbackMatch) {
      const code1 = fallbackMatch[2];
      const code2 = fallbackMatch[3];
      if (!nonAirportCodes.includes(code1) && !nonAirportCodes.includes(code2)) {
        origin = code1;
        destination = code2;
        console.log('[PortalCapture] Fallback route extraction:', origin, '->', destination);
      }
    }
    
    // Also try extracting from outbound/return sections directly
    if (!origin || !destination) {
      // Look for "AUH" and "JFK" separately in common airport list
      const foundCodes: string[] = [];
      for (const airport of commonAirports) {
        // Use word boundary to avoid partial matches
        const regex = new RegExp(`\\b${airport}\\b`, 'g');
        if (regex.test(pageText)) {
          foundCodes.push(airport);
          if (foundCodes.length >= 2) break;
        }
      }
      if (foundCodes.length >= 2) {
        origin = foundCodes[0];
        destination = foundCodes[1];
        console.log('[PortalCapture] Extracted codes from common airports:', origin, '->', destination);
      }
    }
  }
  
  // Strategy 3: Check for "Outbound" and "Return" sections (Capital One Travel specific)
  if (pageText.includes('Outbound') && pageText.includes('Return')) {
    isRoundTrip = true;
    console.log('[PortalCapture] Round trip confirmed via Outbound/Return sections');
  }
  
  // Also check for "Round Trip" or "Roundtrip" text
  if (/round\s*trip|roundtrip/i.test(pageText)) {
    isRoundTrip = true;
    console.log('[PortalCapture] Round trip confirmed via text');
  }
  
  // ============================================
  // DATE EXTRACTION - Capital One Travel Format
  // ============================================
  
  // Capital One shows dates like "Tue, Jan 13" or "Fri, Jan 16"
  // We need to add year context
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const nextYear = currentYear + 1;
  
  // Helper to format date as YYYY-MM-DD without timezone conversion
  const formatDateLocal = (year: number, month: number, day: number): string => {
    const y = String(year);
    const m = String(month + 1).padStart(2, '0'); // month is 0-indexed
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  // Pattern: "on Tue, Jan 13" or "on Fri, Jan 16"
  const datePatternWithDay = /on\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/gi;
  const foundDates: { year: number; month: number; day: number; sortKey: number }[] = [];
  
  const monthMap: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  
  let dateMatch;
  while ((dateMatch = datePatternWithDay.exec(pageText)) !== null) {
    const monthStr = dateMatch[1];
    const day = parseInt(dateMatch[2], 10);
    const month = monthMap[monthStr.toLowerCase()];
    
    if (month !== undefined && day >= 1 && day <= 31) {
      // Determine year: if the month/day is in the past, assume next year
      let year = currentYear;
      
      // Create a simple comparison without timezone issues
      // If we're past this month/day in the current year, use next year
      if (month < currentMonth || (month === currentMonth && day < now.getDate())) {
        year = nextYear;
      }
      
      const dateStr = formatDateLocal(year, month, day);
      const sortKey = year * 10000 + month * 100 + day; // For sorting
      
      // Avoid duplicates
      if (!foundDates.some(d => d.sortKey === sortKey)) {
        foundDates.push({ year, month, day, sortKey });
        console.log('[PortalCapture] Found date:', dateStr, '(from:', dateMatch[0], ')');
      }
    }
  }
  
  // Sort dates chronologically
  foundDates.sort((a, b) => a.sortKey - b.sortKey);
  
  if (foundDates.length > 0) {
    const first = foundDates[0];
    departDate = formatDateLocal(first.year, first.month, first.day);
    console.log('[PortalCapture] Depart date:', departDate);
  }
  if (foundDates.length > 1 && isRoundTrip) {
    const second = foundDates[1];
    returnDate = formatDateLocal(second.year, second.month, second.day);
    console.log('[PortalCapture] Return date:', returnDate);
  }
  
  // ============================================
  // FLIGHT NUMBER EXTRACTION
  // ============================================
  
  const flightNumbers: string[] = [];
  // Pattern for flight numbers like "AA7" or "AM8" or "DL1234"
  const flightNumPattern = /\b([A-Z]{2})\s?(\d{1,4})\b/g;
  let flightMatch;
  
  while ((flightMatch = flightNumPattern.exec(pageText)) !== null) {
    const flightNum = `${flightMatch[1]}${flightMatch[2]}`;
    // Filter common false positives
    if (!flightNumbers.includes(flightNum) && !['PM8', 'AM7', 'AM8', 'PM7'].includes(flightNum)) {
      // Only add if it looks like a real flight number
      const prefix = flightMatch[1];
      const validPrefixes = ['AA', 'DL', 'UA', 'WN', 'B6', 'AS', 'NK', 'F9', 'AC', 'BA', 'LH', 'AF', 'KL', 'EK', 'QR', 'SQ', 'CX', 'NH', 'JL', 'QF', 'VA'];
      if (validPrefixes.includes(prefix)) {
        flightNumbers.push(flightNum);
        console.log('[PortalCapture] Found flight number:', flightNum);
      }
    }
  }
  
  // ============================================
  // CABIN CLASS EXTRACTION
  // Enhanced to capture full fare class names (e.g., "Economy Convenience", "Basic Economy")
  // ============================================
  
  let cabin: FlightFingerprint['cabin'] = 'economy';
  let cabinFull: string | undefined; // Full fare class name
  
  // Capital One Travel shows fare classes like:
  // "Qatar Airways - Economy Convenience"
  // "JetBlue - Economy Cabin"
  // "Economy Basic", "Economy Comfort", "Economy Standard", etc.
  
  // Pattern 1: Look for "Airline - Fare Class" pattern (e.g., "Qatar Airways - Economy Convenience")
  const fareClassPatterns = [
    /(?:airways?|airlines?|air|jet\s*blue)\s*[-–—]\s*((?:economy|business|first|premium)\s*(?:basic|standard|comfort|convenience|plus|classic|flex|semi\s*flex|semiflex|cabin)?)/gi,
    /((?:economy|business|first|premium)\s*(?:basic|standard|comfort|convenience|plus|classic|flex|semi\s*flex|semiflex|cabin)?)\s*class/gi,
    /(basic|standard|enhanced|premium|luxury)\s*(?:economy)?/gi,
  ];
  
  for (const pattern of fareClassPatterns) {
    const match = pageText.match(pattern);
    if (match && match[1]) {
      cabinFull = match[1].trim();
      console.log('[PortalCapture] Found fare class:', cabinFull);
      break;
    }
  }
  
  // If no fare class found from patterns, try to extract from capital one's class selection tabs
  // Look for patterns like "Basic", "Standard", "Enhanced", "Premium", "Luxury" which are C1's fare names
  if (!cabinFull) {
    const c1FarePatterns = [
      /(basic|standard|enhanced|premium|luxury)\s*$/im,
      /(?:Main|Economy)\s+(Basic|Standard|Comfort|Convenience|Plus|Flexible|Flex|Semiflexible|Semi\s*Flexible|Classic)/gi,
      /(Economy\s+(?:Basic|Standard|Comfort|Convenience|Plus|Flexible|Flex|Semiflexible|Semi\s*Flexible|Classic|Cabin))/gi,
      /(Business\s+(?:Basic|Standard|Comfort|Plus|Flexible|Flex|Class))/gi,
      /(First\s+(?:Basic|Standard|Flexible|Flex|Class))/gi,
      /(Premium\s+Economy(?:\s+(?:Basic|Standard|Comfort|Plus|Flexible|Flex))?)/gi,
    ];
    
    for (const pattern of c1FarePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        cabinFull = match[1] || match[0];
        cabinFull = cabinFull.trim();
        console.log('[PortalCapture] Found C1 fare class:', cabinFull);
        break;
      }
    }
  }
  
  // Map full fare class to base cabin type
  const cabinTextLower = (cabinFull || pageText).toLowerCase();
  
  if (cabinTextLower.includes('first')) {
    cabin = 'first';
  } else if (cabinTextLower.includes('business')) {
    cabin = 'business';
  } else if (cabinTextLower.includes('premium')) {
    cabin = 'premium';
  } else {
    cabin = 'economy';
  }
  
  console.log('[PortalCapture] Cabin class:', cabin, cabinFull ? `(${cabinFull})` : '');
  
  // ============================================
  // PASSENGER COUNT
  // ============================================
  
  let paxCount: number = 1; // Default to 1
  const paxPatterns = [
    /(\d+)\s*(?:passenger|traveler|adult|person)/i,
    /(?:passenger|traveler|adult|person)s?[:\s]+(\d+)/i,
  ];
  for (const pattern of paxPatterns) {
    const paxMatch = pageText.match(pattern);
    if (paxMatch) {
      paxCount = parseInt(paxMatch[1], 10);
      break;
    }
  }
  
  // ============================================
  // TIME & DURATION EXTRACTION
  // ============================================
  
  let departureTime: string | undefined;
  let arrivalTime: string | undefined;
  let arrivalNextDay: number | undefined; // +1 or +2 for next day arrivals
  let departureTimezone: string | undefined;
  let arrivalTimezone: string | undefined;
  let duration: string | undefined;
  let stops: number | undefined; // undefined means unknown, 0 means nonstop
  let stopAirports: string[] = [];
  let airlines: string[] = [];
  let layoverDurations: string[] = []; // Moved here to capture from "7h 20m DOH" pattern
  let totalLayoverTime: string | undefined;
  
  // RETURN flight variables
  let returnDepartureTime: string | undefined;
  let returnArrivalTime: string | undefined;
  let returnArrivalNextDay: number | undefined; // +1 or +2 for next day arrivals
  let returnDepartureTimezone: string | undefined;
  let returnArrivalTimezone: string | undefined;
  let returnDuration: string | undefined;
  let returnStops: number | undefined;
  let returnStopAirports: string[] = [];
  let returnLayoverDurations: string[] = [];
  let returnTotalLayoverTime: string | undefined;
  let returnAirlines: string[] = [];
  
  // Airport timezone mapping (common airports)
  const airportTimezones: Record<string, string> = {
    // Middle East
    'AUH': 'Asia/Dubai', 'DXB': 'Asia/Dubai', 'DOH': 'Asia/Qatar', 'RUH': 'Asia/Riyadh',
    'JED': 'Asia/Riyadh', 'BAH': 'Asia/Bahrain', 'KWI': 'Asia/Kuwait', 'MCT': 'Asia/Muscat',
    'AMM': 'Asia/Amman', 'TLV': 'Asia/Jerusalem', 'CAI': 'Africa/Cairo',
    // US East
    'JFK': 'America/New_York', 'EWR': 'America/New_York', 'LGA': 'America/New_York',
    'BOS': 'America/New_York', 'PHL': 'America/New_York', 'IAD': 'America/New_York',
    'DCA': 'America/New_York', 'MIA': 'America/New_York', 'FLL': 'America/New_York',
    'ATL': 'America/New_York', 'CLT': 'America/New_York', 'MCO': 'America/New_York',
    // US Central
    'ORD': 'America/Chicago', 'DFW': 'America/Chicago', 'IAH': 'America/Chicago',
    'MSP': 'America/Chicago', 'STL': 'America/Chicago', 'AUS': 'America/Chicago',
    // US Mountain
    'DEN': 'America/Denver', 'PHX': 'America/Phoenix', 'SLC': 'America/Denver',
    // US West
    'LAX': 'America/Los_Angeles', 'SFO': 'America/Los_Angeles', 'SEA': 'America/Los_Angeles',
    'SAN': 'America/Los_Angeles', 'LAS': 'America/Los_Angeles', 'PDX': 'America/Los_Angeles',
    // Europe
    'LHR': 'Europe/London', 'LGW': 'Europe/London', 'CDG': 'Europe/Paris', 'ORY': 'Europe/Paris',
    'AMS': 'Europe/Amsterdam', 'FRA': 'Europe/Berlin', 'MUC': 'Europe/Berlin',
    'MAD': 'Europe/Madrid', 'BCN': 'Europe/Madrid', 'FCO': 'Europe/Rome',
    'ZRH': 'Europe/Zurich', 'VIE': 'Europe/Vienna', 'IST': 'Europe/Istanbul',
    // Asia
    'SIN': 'Asia/Singapore', 'HKG': 'Asia/Hong_Kong', 'BKK': 'Asia/Bangkok',
    'NRT': 'Asia/Tokyo', 'HND': 'Asia/Tokyo', 'ICN': 'Asia/Seoul',
    'PEK': 'Asia/Shanghai', 'PVG': 'Asia/Shanghai', 'DEL': 'Asia/Kolkata',
    'BOM': 'Asia/Kolkata', 'KUL': 'Asia/Kuala_Lumpur', 'TPE': 'Asia/Taipei',
    // Australia
    'SYD': 'Australia/Sydney', 'MEL': 'Australia/Melbourne', 'BNE': 'Australia/Brisbane',
    // Canada
    'YYZ': 'America/Toronto', 'YVR': 'America/Vancouver', 'YUL': 'America/Montreal',
  };
  
  // Helper to get timezone offset in hours
  const getTimezoneOffset = (tz: string): number => {
    // Approximate UTC offsets (summer time not accounted for)
    const offsets: Record<string, number> = {
      'Asia/Dubai': 4, 'Asia/Qatar': 3, 'Asia/Riyadh': 3, 'Asia/Bahrain': 3,
      'Asia/Kuwait': 3, 'Asia/Muscat': 4, 'Asia/Amman': 2, 'Asia/Jerusalem': 2,
      'Africa/Cairo': 2, 'America/New_York': -5, 'America/Chicago': -6,
      'America/Denver': -7, 'America/Phoenix': -7, 'America/Los_Angeles': -8,
      'Europe/London': 0, 'Europe/Paris': 1, 'Europe/Amsterdam': 1, 'Europe/Berlin': 1,
      'Europe/Madrid': 1, 'Europe/Rome': 1, 'Europe/Zurich': 1, 'Europe/Vienna': 1,
      'Europe/Istanbul': 3, 'Asia/Singapore': 8, 'Asia/Hong_Kong': 8, 'Asia/Bangkok': 7,
      'Asia/Tokyo': 9, 'Asia/Seoul': 9, 'Asia/Shanghai': 8, 'Asia/Kolkata': 5.5,
      'Asia/Kuala_Lumpur': 8, 'Asia/Taipei': 8, 'Australia/Sydney': 10,
      'Australia/Melbourne': 10, 'Australia/Brisbane': 10, 'America/Toronto': -5,
      'America/Vancouver': -8, 'America/Montreal': -5,
    };
    return offsets[tz] ?? 0;
  };
  
  // Time extraction patterns - Capital One shows times like "10:45 AM" or "8:05 PM"
  // Look in the outbound flight section specifically
  // Capital One format: "Outbound to New York City on Tue, Feb 3" ... flight details ... "Return to Abu Dhabi"
  // We need to get text BETWEEN "Outbound" and "Return to" (not just "Return")
  
  let outboundSection = pageText;
  let returnSection = '';
  
  // Try to isolate the outbound section more precisely
  const outboundStart = pageText.search(/outbound\s+to/i);
  const returnStart = pageText.search(/return\s+to/i);
  
  if (outboundStart !== -1 && returnStart !== -1 && returnStart > outboundStart) {
    // Get section between "Outbound to" and "Return to"
    outboundSection = pageText.substring(outboundStart, returnStart);
    // Get return section from "Return to" onwards
    returnSection = pageText.substring(returnStart);
    console.log('[PortalCapture] Isolated outbound section length:', outboundSection.length);
    console.log('[PortalCapture] Isolated return section length:', returnSection.length);
  } else if (outboundStart !== -1) {
    // Only have outbound, take from there
    outboundSection = pageText.substring(outboundStart);
  }
  
  // Debug: Log first 500 chars of outbound section
  console.log('[PortalCapture] Outbound section preview:', outboundSection.substring(0, 500));
  if (returnSection) {
    console.log('[PortalCapture] Return section preview:', returnSection.substring(0, 500));
  }
  
  // Pattern: "10:45 AM" or "8:05pm" or "11:40 PM" - optionally followed by "+1" or "+2"
  // Enhanced pattern to capture next-day indicator
  const timeWithNextDayPattern = /(\d{1,2}:\d{2}\s*[APap][Mm])(?:\s*\+(\d))?/g;
  const timePattern = /(\d{1,2}:\d{2}\s*[APap][Mm])/g;
  
  // Extract times with next-day info from outbound section
  const extractTimesWithNextDay = (section: string): { time: string; nextDay: number }[] => {
    const results: { time: string; nextDay: number }[] = [];
    let match;
    const pattern = /(\d{1,2}:\d{2}\s*[APap][Mm])(?:\s*\+(\d))?/g;
    while ((match = pattern.exec(section)) !== null) {
      results.push({
        time: match[1],
        nextDay: match[2] ? parseInt(match[2], 10) : 0,
      });
    }
    return results;
  };
  
  const outboundTimes = extractTimesWithNextDay(outboundSection);
  console.log('[PortalCapture] Found times in outbound section:', outboundTimes);
  
  if (outboundTimes.length >= 2 && outboundTimes[0] && outboundTimes[1]) {
    // First time is departure, second is arrival for outbound leg
    departureTime = convertTo24Hour(outboundTimes[0].time);
    arrivalTime = convertTo24Hour(outboundTimes[1].time);
    arrivalNextDay = outboundTimes[1].nextDay || undefined;
    
    // Set timezones based on origin/destination
    if (origin && airportTimezones[origin]) {
      departureTimezone = airportTimezones[origin];
    }
    if (destination && airportTimezones[destination]) {
      arrivalTimezone = airportTimezones[destination];
    }
    
    console.log('[PortalCapture] Extracted outbound times:', departureTime, '->', arrivalTime,
      arrivalNextDay ? `(+${arrivalNextDay})` : '',
      departureTimezone ? `[${departureTimezone}]` : '',
      arrivalTimezone ? `-> [${arrivalTimezone}]` : '');
  }
  
  // Extract RETURN flight times
  if (returnSection && isRoundTrip) {
    const returnTimes = extractTimesWithNextDay(returnSection);
    console.log('[PortalCapture] Found times in return section:', returnTimes);
    
    if (returnTimes.length >= 2 && returnTimes[0] && returnTimes[1]) {
      returnDepartureTime = convertTo24Hour(returnTimes[0].time);
      returnArrivalTime = convertTo24Hour(returnTimes[1].time);
      returnArrivalNextDay = returnTimes[1].nextDay || undefined;
      
      // For return, destination becomes departure and origin becomes arrival
      if (destination && airportTimezones[destination]) {
        returnDepartureTimezone = airportTimezones[destination];
      }
      if (origin && airportTimezones[origin]) {
        returnArrivalTimezone = airportTimezones[origin];
      }
      
      console.log('[PortalCapture] Extracted return times:', returnDepartureTime, '->', returnArrivalTime,
        returnArrivalNextDay ? `(+${returnArrivalNextDay})` : '',
        returnDepartureTimezone ? `[${returnDepartureTimezone}]` : '',
        returnArrivalTimezone ? `-> [${returnArrivalTimezone}]` : '');
    }
  }
  
  // Duration extraction - patterns like "18hr 20min", "18h 20m", "5h", "3h 45m", "17h 20m"
  const durationPatterns = [
    /(\d+)h\s*(\d+)m/i,                    // "17h 20m" - most common Capital One format
    /(\d+)\s*hr?\s*(\d+)?\s*m(?:in)?/i,
    /(\d+)\s*h(?:our)?s?\s*(\d+)?\s*m(?:in)?/i,
    /duration[:\s]*(\d+)\s*h(?:our)?s?\s*(\d+)?\s*m(?:in)?/i,
    /flight\s+time[:\s]*(\d+)\s*h(?:our)?s?\s*(\d+)?\s*m(?:in)?/i,
    /(\d+)\s*hours?\s*(?:and\s*)?(\d+)?\s*min(?:ute)?s?/i,
  ];
  
  for (const pattern of durationPatterns) {
    const match = outboundSection.match(pattern);
    if (match) {
      const hours = match[1];
      const mins = match[2] || '0';
      duration = `${hours}h ${mins}m`;
      console.log('[PortalCapture] Extracted outbound duration:', duration);
      break;
    }
  }
  
  // Extract RETURN duration
  if (returnSection && isRoundTrip) {
    for (const pattern of durationPatterns) {
      const match = returnSection.match(pattern);
      if (match) {
        const hours = match[1];
        const mins = match[2] || '0';
        returnDuration = `${hours}h ${mins}m`;
        console.log('[PortalCapture] Extracted return duration:', returnDuration);
        break;
      }
    }
  }
  
  // If no duration found from text, try to calculate from times
  if (!duration && departureTime && arrivalTime) {
    const durationMins = calculateDurationMinutes(departureTime, arrivalTime);
    if (durationMins > 0) {
      const hrs = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      duration = `${hrs}h ${mins}m`;
      console.log('[PortalCapture] Calculated outbound duration from times:', duration);
    }
  }
  
  // Calculate return duration from times if needed
  if (!returnDuration && returnDepartureTime && returnArrivalTime) {
    const durationMins = calculateDurationMinutes(returnDepartureTime, returnArrivalTime);
    if (durationMins > 0) {
      const hrs = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      returnDuration = `${hrs}h ${mins}m`;
      console.log('[PortalCapture] Calculated return duration from times:', returnDuration);
    }
  }
  
  // Stops extraction - check SPECIFICALLY for "1 stop", "2 stops" etc first
  // Capital One shows "1 stop" or "Nonstop" prominently
  const stopsMatch = outboundSection.match(/(\d+)\s*stop/i);
  if (stopsMatch) {
    stops = parseInt(stopsMatch[1], 10);
    console.log('[PortalCapture] Outbound stops:', stops);
    
    // Extract layover info - Capital One shows "7h 20m DOH" format
    // Pattern: time duration followed by 3-letter airport code
    const layoverWithTimePattern = /(\d+h\s*\d*m?)\s+([A-Z]{3})/g;
    let layoverMatch;
    while ((layoverMatch = layoverWithTimePattern.exec(outboundSection)) !== null) {
      const layoverTime = layoverMatch[1];
      const airport = layoverMatch[2];
      if (!nonAirportCodes.includes(airport) && airport !== origin && airport !== destination) {
        if (!stopAirports.includes(airport)) {
          stopAirports.push(airport);
          // Also capture the layover duration (this was missing before!)
          layoverDurations.push(layoverTime);
          console.log('[PortalCapture] Found outbound layover:', layoverTime, 'in', airport);
        }
      }
    }
    
    // Also try other layover patterns
    const layoverPatterns = [
      /stop\s+in\s+([A-Z]{3})/gi,
      /via\s+([A-Z]{3})/gi,
      /layover\s+(?:in|at)\s+([A-Z]{3})/gi,
      /through\s+([A-Z]{3})/gi,
      /connecting\s+(?:in|at|through)\s+([A-Z]{3})/gi,
    ];
    
    for (const pattern of layoverPatterns) {
      let match;
      while ((match = pattern.exec(outboundSection)) !== null) {
        const airport = match[1];
        if (!stopAirports.includes(airport) && !nonAirportCodes.includes(airport)) {
          stopAirports.push(airport);
        }
      }
    }
  } else if (/nonstop|non-stop|direct\s+flight/i.test(outboundSection)) {
    // Only mark as nonstop if we explicitly see the word
    stops = 0;
    console.log('[PortalCapture] Outbound nonstop flight detected');
  } else {
    // Could not determine stops - leave as undefined
    console.log('[PortalCapture] Could not determine outbound stops count');
  }
  
  // Extract RETURN stops and layover info
  if (returnSection && isRoundTrip) {
    const returnStopsMatch = returnSection.match(/(\d+)\s*stop/i);
    if (returnStopsMatch) {
      returnStops = parseInt(returnStopsMatch[1], 10);
      console.log('[PortalCapture] Return stops:', returnStops);
      
      // Extract return layover airports and durations - "7h 35m DOH" format
      const layoverWithTimePattern = /(\d+h\s*\d*m?)\s+([A-Z]{3})/g;
      let layoverMatch;
      while ((layoverMatch = layoverWithTimePattern.exec(returnSection)) !== null) {
        const layoverTime = layoverMatch[1];
        const airport = layoverMatch[2];
        if (!nonAirportCodes.includes(airport) && airport !== origin && airport !== destination) {
          if (!returnStopAirports.includes(airport)) {
            returnStopAirports.push(airport);
            // Also capture the return layover duration
            returnLayoverDurations.push(layoverTime);
            console.log('[PortalCapture] Found return layover:', layoverTime, 'in', airport);
          }
        }
      }
    } else if (/nonstop|non-stop|direct\s+flight/i.test(returnSection)) {
      returnStops = 0;
      console.log('[PortalCapture] Return nonstop flight detected');
    }
  }
  
  console.log('[PortalCapture] Outbound layover airports:', stopAirports);
  console.log('[PortalCapture] Return layover airports:', returnStopAirports);
  
  // ============================================
  // LAYOVER TIME EXTRACTION
  // ============================================
  
  // Patterns for layover/connection times
  // Common patterns: "2h 30m layover", "Connection: 1hr 45min", "Layover in LHR: 3h"
  const layoverTimePatterns = [
    /(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m(?:in)?(?:ute)?s?\s*(?:layover|connection|stopover)/gi,
    /(?:layover|connection|stopover)[:\s]+(?:in\s+[A-Z]{3}[:\s]+)?(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m(?:in)?/gi,
    /(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m(?:in)?\s+(?:in|at)\s+[A-Z]{3}/gi,
    /(?:wait|waiting)[:\s]+(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m(?:in)?/gi,
  ];
  
  for (const pattern of layoverTimePatterns) {
    let layoverMatch;
    while ((layoverMatch = pattern.exec(outboundSection)) !== null) {
      const hours = layoverMatch[1];
      const mins = layoverMatch[2] || '0';
      const layoverStr = `${hours}h ${mins}m`;
      if (!layoverDurations.includes(layoverStr)) {
        layoverDurations.push(layoverStr);
        console.log('[PortalCapture] Found outbound layover duration:', layoverStr);
      }
    }
  }
  
  // Extract RETURN layover durations
  if (returnSection && isRoundTrip) {
    for (const pattern of layoverTimePatterns) {
      let layoverMatch;
      while ((layoverMatch = pattern.exec(returnSection)) !== null) {
        const hours = layoverMatch[1];
        const mins = layoverMatch[2] || '0';
        const layoverStr = `${hours}h ${mins}m`;
        if (!returnLayoverDurations.includes(layoverStr)) {
          returnLayoverDurations.push(layoverStr);
          console.log('[PortalCapture] Found return layover duration:', layoverStr);
        }
      }
    }
  }
  
  // Try to extract total layover time if specified
  const totalLayoverPatterns = [
    /total\s+(?:layover|connection)[:\s]+(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m(?:in)?/i,
    /(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m(?:in)?\s+total\s+(?:layover|connection)/i,
  ];
  
  for (const pattern of totalLayoverPatterns) {
    const match = outboundSection.match(pattern);
    if (match) {
      const hours = match[1];
      const mins = match[2] || '0';
      totalLayoverTime = `${hours}h ${mins}m`;
      console.log('[PortalCapture] Outbound total layover time:', totalLayoverTime);
      break;
    }
  }
  
  // Extract return total layover time
  if (returnSection && isRoundTrip) {
    for (const pattern of totalLayoverPatterns) {
      const match = returnSection.match(pattern);
      if (match) {
        const hours = match[1];
        const mins = match[2] || '0';
        returnTotalLayoverTime = `${hours}h ${mins}m`;
        console.log('[PortalCapture] Return total layover time:', returnTotalLayoverTime);
        break;
      }
    }
  }
  
  // If we have layover durations but no total, calculate it
  if (layoverDurations.length > 0 && !totalLayoverTime) {
    let totalMins = 0;
    for (const dur of layoverDurations) {
      const match = dur.match(/(\d+)\s*h\s*(\d+)?\s*m?/);
      if (match) {
        totalMins += parseInt(match[1], 10) * 60 + (match[2] ? parseInt(match[2], 10) : 0);
      }
    }
    if (totalMins > 0) {
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      totalLayoverTime = `${hrs}h ${mins}m`;
      console.log('[PortalCapture] Calculated outbound total layover:', totalLayoverTime);
    }
  }
  
  // Calculate return total layover
  if (returnLayoverDurations.length > 0 && !returnTotalLayoverTime) {
    let totalMins = 0;
    for (const dur of returnLayoverDurations) {
      const match = dur.match(/(\d+)\s*h\s*(\d+)?\s*m?/);
      if (match) {
        totalMins += parseInt(match[1], 10) * 60 + (match[2] ? parseInt(match[2], 10) : 0);
      }
    }
    if (totalMins > 0) {
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      returnTotalLayoverTime = `${hrs}h ${mins}m`;
      console.log('[PortalCapture] Calculated return total layover:', returnTotalLayoverTime);
    }
  }
  
  // Airlines extraction - look for airline names
  const airlineNames = [
    'American Airlines', 'American',
    'Delta Air Lines', 'Delta',
    'United Airlines', 'United',
    'Southwest Airlines', 'Southwest',
    'JetBlue Airways', 'JetBlue',
    'Alaska Airlines', 'Alaska',
    'Spirit Airlines', 'Spirit',
    'Frontier Airlines', 'Frontier',
    'British Airways',
    'Qatar Airways', 'Qatar',
    'Emirates',
    'Lufthansa',
    'Air France',
    'KLM',
    'Singapore Airlines',
    'Cathay Pacific',
    'ANA', 'All Nippon',
    'Japan Airlines', 'JAL',
    'Etihad Airways', 'Etihad',
    'Air Canada',
    'Aeromexico',
    // Middle Eastern & Asian carriers
    'Saudia', 'Saudi Arabian Airlines',
    'Royal Jordanian',
    'Gulf Air',
    'Oman Air',
    'Kuwait Airways',
    'EgyptAir', 'Egypt Air',
    'Turkish Airlines', 'Turkish',
    'El Al',
    'Air India',
    'IndiGo',
    'Cebu Pacific',
    'AirAsia',
    'Scoot',
    'Philippine Airlines',
    'Thai Airways', 'Thai',
    'Vietnam Airlines',
    'China Eastern',
    'China Southern',
    'Air China',
    'Hainan Airlines',
    'Korean Air',
    'Asiana Airlines', 'Asiana',
    'EVA Air',
    'China Airlines',
    // European
    'Iberia',
    'Swiss', 'SWISS',
    'Austrian',
    'Brussels Airlines',
    'SAS', 'Scandinavian',
    'Finnair',
    'LOT Polish',
    'TAP Portugal', 'TAP',
    'Aer Lingus',
    'Norwegian',
    'Icelandair',
    'Ryanair',
    'easyJet',
    'Vueling',
    // Others
    'Qantas',
    'Air New Zealand',
    'Virgin Atlantic',
    'Virgin Australia',
    'LATAM',
    'Avianca',
    'Copa Airlines', 'Copa',
  ];
  
  // Helper function to extract airlines from a section of text
  const extractAirlinesFromSection = (sectionText: string): string[] => {
    const foundAirlines: string[] = [];
    
    for (const airlineName of airlineNames) {
      if (sectionText.toLowerCase().includes(airlineName.toLowerCase())) {
        const normalizedName = normalizeAirlineName(airlineName);
        if (normalizedName && !foundAirlines.includes(normalizedName)) {
          foundAirlines.push(normalizedName);
        }
      }
    }
    
    // Also try to extract airline from "Airline - Class" format (e.g., "Qatar Airways - Economy Cabin")
    const airlineClassPattern = /(?<![:\d]\s*)(?<!\d\s*)\b([A-Za-z][A-Za-z\s]{2,}?)\s*[-–—]\s*(?:Basic|Main|Economy|Business|First|Premium|Comfort|Plus|Select|Flex|Cabin)/gi;
    let airlineClassMatch;
    while ((airlineClassMatch = airlineClassPattern.exec(sectionText)) !== null) {
      const possibleAirline = airlineClassMatch[1].trim();
      const invalidAirlines = ['AM', 'PM', 'am', 'pm', 'A', 'P', 'The', 'For', 'And', 'Or', 'In', 'On', 'At', 'To', 'Of'];
      if (invalidAirlines.includes(possibleAirline) || possibleAirline.length < 3) {
        continue;
      }
      const normalizedAirline = normalizeAirlineName(possibleAirline);
      if (normalizedAirline && normalizedAirline.length >= 3 && !foundAirlines.includes(normalizedAirline)) {
        foundAirlines.push(normalizedAirline);
      }
    }
    
    // Also extract from "Operated by" text
    const operatedMatch = sectionText.match(/operated\s+by\s+([^,\n]+)/i);
    if (operatedMatch) {
      const operatedBy = operatedMatch[1].trim();
      const normalizedOp = normalizeAirlineName(operatedBy);
      if (normalizedOp && !foundAirlines.includes(normalizedOp)) {
        foundAirlines.push(normalizedOp);
      }
    }
    
    return foundAirlines;
  };
  
  // Extract OUTBOUND airlines from outbound section
  airlines = extractAirlinesFromSection(outboundSection);
  console.log('[PortalCapture] Outbound airlines:', airlines);
  
  // Extract RETURN airlines from return section
  if (returnSection && isRoundTrip) {
    returnAirlines = extractAirlinesFromSection(returnSection);
    console.log('[PortalCapture] Return airlines:', returnAirlines);
  }
  
  // Fallback: if we didn't find airlines in sections, search full page
  if (airlines.length === 0) {
    airlines = extractAirlinesFromSection(pageText);
    console.log('[PortalCapture] Fallback - found airlines from full page:', airlines);
  }
  
  // ============================================
  // FINAL RESULT
  // ============================================
  
  // Only return if we have at least origin/destination
  if (!origin || !destination) {
    console.log('[PortalCapture] Could not extract origin/destination');
    return null;
  }
  
  // Infer next-day arrival if not explicitly detected but duration suggests it
  if (!arrivalNextDay && duration && departureTime && arrivalTime && departureTimezone && arrivalTimezone) {
    const depTzOffset = getTimezoneOffset(departureTimezone);
    const arrTzOffset = getTimezoneOffset(arrivalTimezone);
    const inferredNextDay = inferNextDayArrival(departureTime, arrivalTime, duration, depTzOffset, arrTzOffset);
    if (inferredNextDay > 0) {
      arrivalNextDay = inferredNextDay;
      console.log('[PortalCapture] Inferred outbound next-day arrival:', arrivalNextDay);
    }
  }
  
  // Infer return next-day arrival
  if (!returnArrivalNextDay && returnDuration && returnDepartureTime && returnArrivalTime && returnDepartureTimezone && returnArrivalTimezone) {
    const depTzOffset = getTimezoneOffset(returnDepartureTimezone);
    const arrTzOffset = getTimezoneOffset(returnArrivalTimezone);
    const inferredNextDay = inferNextDayArrival(returnDepartureTime, returnArrivalTime, returnDuration, depTzOffset, arrTzOffset);
    if (inferredNextDay > 0) {
      returnArrivalNextDay = inferredNextDay;
      console.log('[PortalCapture] Inferred return next-day arrival:', returnArrivalNextDay);
    }
  }
  
  const result: FlightFingerprint = {
    type: 'flight',
    origin,
    destination,
    departDate,
    returnDate: isRoundTrip ? returnDate : undefined,
    cabin,
    cabinFull,
    paxCount,
    flightNumbers: flightNumbers.length > 0 ? flightNumbers : undefined,
    operatingCarrier: flightNumbers[0]?.substring(0, 2),
    // Outbound flight details
    departureTime,
    arrivalTime,
    arrivalNextDay,
    departureTimezone,
    arrivalTimezone,
    duration,
    stops,
    stopAirports: stopAirports.length > 0 ? stopAirports : undefined,
    airlines: airlines.length > 0 ? airlines : undefined,
    layoverDurations: layoverDurations.length > 0 ? layoverDurations : undefined,
    totalLayoverTime,
    // Return flight details (for round trips)
    returnDepartureTime: isRoundTrip ? returnDepartureTime : undefined,
    returnArrivalTime: isRoundTrip ? returnArrivalTime : undefined,
    returnArrivalNextDay: isRoundTrip ? returnArrivalNextDay : undefined,
    returnDepartureTimezone: isRoundTrip ? returnDepartureTimezone : undefined,
    returnArrivalTimezone: isRoundTrip ? returnArrivalTimezone : undefined,
    returnDuration: isRoundTrip ? returnDuration : undefined,
    returnStops: isRoundTrip ? returnStops : undefined,
    returnStopAirports: isRoundTrip && returnStopAirports.length > 0 ? returnStopAirports : undefined,
    returnLayoverDurations: isRoundTrip && returnLayoverDurations.length > 0 ? returnLayoverDurations : undefined,
    returnTotalLayoverTime: isRoundTrip ? returnTotalLayoverTime : undefined,
    returnAirlines: isRoundTrip && returnAirlines.length > 0 ? returnAirlines : undefined,
  };
  
  console.log('[PortalCapture] Flight fingerprint:', result);
  
  return result;
}

// Helper function to convert 12-hour time to 24-hour format
function convertTo24Hour(time12h: string): string {
  const match = time12h.match(/(\d{1,2}):(\d{2})\s*([APap][Mm])/);
  if (!match) return time12h;
  
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${String(hours).padStart(2, '0')}:${mins}`;
}

/**
 * Calculate duration in minutes from departure to arrival time
 * Accounts for:
 * - Simple overnight flights (arrival time < departure time)
 * - Multi-day flights (nextDayOffset of +1, +2, etc.)
 * - Timezone differences between departure and arrival airports
 *
 * @param departure - Departure time in HH:MM format (24h)
 * @param arrival - Arrival time in HH:MM format (24h)
 * @param nextDayOffset - Number of days the arrival is after departure (0, 1, 2)
 * @param depTzOffset - Departure timezone offset from UTC in hours (e.g., 4 for Dubai)
 * @param arrTzOffset - Arrival timezone offset from UTC in hours (e.g., -5 for NYC)
 */
function calculateDurationMinutes(
  departure: string,
  arrival: string,
  nextDayOffset: number = 0,
  depTzOffset?: number,
  arrTzOffset?: number
): number {
  const depMatch = departure.match(/(\d{1,2}):(\d{2})/);
  const arrMatch = arrival.match(/(\d{1,2}):(\d{2})/);
  
  if (!depMatch || !arrMatch) return 0;
  
  // Get times in minutes since midnight (in local time)
  const depMins = parseInt(depMatch[1], 10) * 60 + parseInt(depMatch[2], 10);
  let arrMins = parseInt(arrMatch[1], 10) * 60 + parseInt(arrMatch[2], 10);
  
  // Apply explicit next-day offset if provided
  if (nextDayOffset > 0) {
    arrMins += nextDayOffset * 24 * 60;
  } else if (arrMins < depMins) {
    // Fallback: If no explicit offset but arrival < departure, assume next day
    arrMins += 24 * 60;
  }
  
  // Calculate timezone adjustment if both offsets are provided
  // Example: AUH (UTC+4) to JFK (UTC-5) = 9 hours difference
  // A flight departing at 09:00 AUH (05:00 UTC) arriving at 14:00 JFK (19:00 UTC)
  // Actual duration = 19:00 - 05:00 = 14 hours
  // Without TZ adjustment: 14:00 - 09:00 = 5 hours (wrong!)
  // TZ adjustment: (4 - (-5)) * 60 = 540 minutes = 9 hours added to arrival
  // With adjustment: 14:00 + 9h - 09:00 = 14 hours (correct!)
  if (depTzOffset !== undefined && arrTzOffset !== undefined) {
    const tzDiffMins = (depTzOffset - arrTzOffset) * 60;
    arrMins += tzDiffMins;
  }
  
  const duration = arrMins - depMins;
  
  // Sanity check: duration should be positive and reasonable (0-40 hours)
  if (duration <= 0 || duration > 40 * 60) {
    console.log('[PortalCapture] Warning: Calculated duration seems off:', duration, 'minutes');
    // Return without timezone adjustment as fallback
    const basicDuration = arrMins - depMins - ((depTzOffset !== undefined && arrTzOffset !== undefined)
      ? (depTzOffset - arrTzOffset) * 60 : 0);
    return basicDuration > 0 ? basicDuration : 0;
  }
  
  return duration;
}

/**
 * Infer if a flight is likely a next-day arrival based on:
 * - Flight duration (extracted from page)
 * - Timezone difference
 * - Time comparison
 */
function inferNextDayArrival(
  depTime: string,
  arrTime: string,
  durationStr?: string,
  depTzOffset?: number,
  arrTzOffset?: number
): number {
  const depMatch = depTime.match(/(\d{1,2}):(\d{2})/);
  const arrMatch = arrTime.match(/(\d{1,2}):(\d{2})/);
  
  if (!depMatch || !arrMatch) return 0;
  
  const depMins = parseInt(depMatch[1], 10) * 60 + parseInt(depMatch[2], 10);
  const arrMins = parseInt(arrMatch[1], 10) * 60 + parseInt(arrMatch[2], 10);
  
  // If we have explicit duration from page, use that to infer
  if (durationStr) {
    const durMatch = durationStr.match(/(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m?/i);
    if (durMatch) {
      const durationMins = parseInt(durMatch[1], 10) * 60 + (durMatch[2] ? parseInt(durMatch[2], 10) : 0);
      
      // Calculate expected arrival time based on departure + duration - timezone difference
      let expectedArrMins = depMins + durationMins;
      if (depTzOffset !== undefined && arrTzOffset !== undefined) {
        // Adjust for timezone: going west adds hours to local arrival time
        expectedArrMins -= (depTzOffset - arrTzOffset) * 60;
      }
      
      // How many days would that be?
      const daysOffset = Math.floor(expectedArrMins / (24 * 60));
      if (daysOffset > 0) {
        console.log('[PortalCapture] Inferred next-day arrival:', daysOffset, 'based on duration:', durationStr);
        return daysOffset;
      }
    }
  }
  
  // Fallback: if arrival time is significantly earlier than departure AND we're flying east-to-west
  // (crossing many time zones), likely a next-day arrival
  if (arrMins < depMins) {
    // Without other info, assume +1 day
    return 1;
  }
  
  return 0;
}

// Helper to normalize airline names
function normalizeAirlineName(name: string): string {
  const normalizations: Record<string, string> = {
    'american': 'American Airlines',
    'american airlines': 'American Airlines',
    'delta': 'Delta Air Lines',
    'delta air lines': 'Delta Air Lines',
    'united': 'United Airlines',
    'united airlines': 'United Airlines',
    'southwest': 'Southwest Airlines',
    'southwest airlines': 'Southwest Airlines',
    'jetblue': 'JetBlue Airways',
    'jetblue airways': 'JetBlue Airways',
    'alaska': 'Alaska Airlines',
    'alaska airlines': 'Alaska Airlines',
    'spirit': 'Spirit Airlines',
    'spirit airlines': 'Spirit Airlines',
    'frontier': 'Frontier Airlines',
    'frontier airlines': 'Frontier Airlines',
    'british airways': 'British Airways',
    'qatar': 'Qatar Airways',
    'qatar airways': 'Qatar Airways',
    'emirates': 'Emirates',
    'lufthansa': 'Lufthansa',
    'air france': 'Air France',
    'klm': 'KLM',
    'singapore airlines': 'Singapore Airlines',
    'singapore': 'Singapore Airlines',
    'cathay pacific': 'Cathay Pacific',
    'cathay': 'Cathay Pacific',
    'ana': 'ANA',
    'all nippon': 'ANA',
    'all nippon airways': 'ANA',
    'japan airlines': 'Japan Airlines',
    'jal': 'Japan Airlines',
    'etihad': 'Etihad Airways',
    'etihad airways': 'Etihad Airways',
    'air canada': 'Air Canada',
    'aeromexico': 'Aeromexico',
    // Middle Eastern & Asian carriers
    'saudia': 'Saudia',
    'saudi arabian airlines': 'Saudia',
    'saudi arabian': 'Saudia',
    'saudi': 'Saudia',
    'royal jordanian': 'Royal Jordanian',
    'gulf air': 'Gulf Air',
    'oman air': 'Oman Air',
    'kuwait airways': 'Kuwait Airways',
    'egyptair': 'EgyptAir',
    'egypt air': 'EgyptAir',
    'turkish airlines': 'Turkish Airlines',
    'turkish': 'Turkish Airlines',
    'el al': 'El Al',
    'air india': 'Air India',
    'indigo': 'IndiGo',
    'cebu pacific': 'Cebu Pacific',
    'airasia': 'AirAsia',
    'scoot': 'Scoot',
    'philippine airlines': 'Philippine Airlines',
    'thai airways': 'Thai Airways',
    'thai': 'Thai Airways',
    'vietnam airlines': 'Vietnam Airlines',
    'china eastern': 'China Eastern',
    'china southern': 'China Southern',
    'air china': 'Air China',
    'hainan airlines': 'Hainan Airlines',
    'korean air': 'Korean Air',
    'asiana airlines': 'Asiana Airlines',
    'asiana': 'Asiana Airlines',
    'eva air': 'EVA Air',
    'china airlines': 'China Airlines',
    // European
    'iberia': 'Iberia',
    'swiss': 'Swiss',
    'austrian': 'Austrian',
    'brussels airlines': 'Brussels Airlines',
    'sas': 'SAS',
    'scandinavian': 'SAS',
    'finnair': 'Finnair',
    'lot polish': 'LOT Polish',
    'tap portugal': 'TAP Portugal',
    'tap': 'TAP Portugal',
    'aer lingus': 'Aer Lingus',
    'norwegian': 'Norwegian',
    'icelandair': 'Icelandair',
    'ryanair': 'Ryanair',
    'easyjet': 'easyJet',
    'vueling': 'Vueling',
    // Others
    'qantas': 'Qantas',
    'air new zealand': 'Air New Zealand',
    'virgin atlantic': 'Virgin Atlantic',
    'virgin australia': 'Virgin Australia',
    'latam': 'LATAM',
    'avianca': 'Avianca',
    'copa airlines': 'Copa Airlines',
    'copa': 'Copa Airlines',
  };
  
  const lower = name.toLowerCase().trim();
  return normalizations[lower] || name;
}

function extractHotelFingerprint(): HotelFingerprint | null {
  const pageText = document.body.innerText;
  
  // Extract hotel name
  let hotelName: string | undefined;
  const hotelSelectors = [
    '[data-testid*="hotel-name"]',
    '[class*="hotel-name"]',
    '[class*="hotelName"]',
    '[class*="property-name"]',
    'h1',
    'h2',
  ];
  
  for (const selector of hotelSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        const text = element.textContent.trim();
        if (text.length > 3 && text.length < 200 && !text.includes('\n')) {
          hotelName = text;
          break;
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Extract dates
  const checkinPatterns = [
    /check[- ]?in[:\s]+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /arrival[:\s]+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];
  const checkoutPatterns = [
    /check[- ]?out[:\s]+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /departure[:\s]+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];
  
  let checkinDate: string | undefined;
  let checkoutDate: string | undefined;
  
  for (const pattern of checkinPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          checkinDate = parsed.toISOString().split('T')[0];
          break;
        }
      } catch (e) {
        // Skip
      }
    }
  }
  
  for (const pattern of checkoutPatterns) {
    const match = pageText.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          checkoutDate = parsed.toISOString().split('T')[0];
          break;
        }
      } catch (e) {
        // Skip
      }
    }
  }
  
  // Calculate nights
  let nights: number | undefined;
  if (checkinDate && checkoutDate) {
    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);
    nights = Math.round((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // Extract from page text
  const nightsMatch = pageText.match(/(\d+)\s*night/i);
  if (!nights && nightsMatch) {
    nights = parseInt(nightsMatch[1], 10);
  }
  
  if (!hotelName && !checkinDate) {
    return null;
  }
  
  return {
    type: 'hotel',
    hotelName,
    checkinDate,
    checkoutDate,
    nights,
  };
}

// ============================================
// PROVIDER EXTRACTION
// ============================================

interface ProviderInfo {
  name?: string;
  code?: string;
  logoUrl?: string;
}

const AIRLINE_MAPPINGS: Record<string, { code: string; name: string }> = {
  'delta': { code: 'DL', name: 'Delta Air Lines' },
  'united': { code: 'UA', name: 'United Airlines' },
  'american': { code: 'AA', name: 'American Airlines' },
  'southwest': { code: 'WN', name: 'Southwest Airlines' },
  'jetblue': { code: 'B6', name: 'JetBlue Airways' },
  'alaska': { code: 'AS', name: 'Alaska Airlines' },
  'spirit': { code: 'NK', name: 'Spirit Airlines' },
  'frontier': { code: 'F9', name: 'Frontier Airlines' },
  // Middle Eastern & Asian carriers
  'saudia': { code: 'SV', name: 'Saudia' },
  'saudi arabian': { code: 'SV', name: 'Saudia' },
  'emirates': { code: 'EK', name: 'Emirates' },
  'etihad': { code: 'EY', name: 'Etihad Airways' },
  'qatar': { code: 'QR', name: 'Qatar Airways' },
  'gulf air': { code: 'GF', name: 'Gulf Air' },
  'royal jordanian': { code: 'RJ', name: 'Royal Jordanian' },
  'oman air': { code: 'WY', name: 'Oman Air' },
  'kuwait airways': { code: 'KU', name: 'Kuwait Airways' },
  'egyptair': { code: 'MS', name: 'EgyptAir' },
  'turkish': { code: 'TK', name: 'Turkish Airlines' },
  'air india': { code: 'AI', name: 'Air India' },
  // European carriers
  'british airways': { code: 'BA', name: 'British Airways' },
  'lufthansa': { code: 'LH', name: 'Lufthansa' },
  'air france': { code: 'AF', name: 'Air France' },
  'klm': { code: 'KL', name: 'KLM' },
  // Asian carriers
  'singapore': { code: 'SQ', name: 'Singapore Airlines' },
  'cathay': { code: 'CX', name: 'Cathay Pacific' },
  'ana': { code: 'NH', name: 'ANA' },
  'jal': { code: 'JL', name: 'Japan Airlines' },
  'korean': { code: 'KE', name: 'Korean Air' },
  // Others
  'qantas': { code: 'QF', name: 'Qantas' },
  'air canada': { code: 'AC', name: 'Air Canada' },
};

function extractProviderInfo(): ProviderInfo {
  const pageText = document.body.innerText.toLowerCase();
  const result: ProviderInfo = {};
  
  // Check for airline names
  for (const [keyword, info] of Object.entries(AIRLINE_MAPPINGS)) {
    if (pageText.includes(keyword)) {
      result.name = info.name;
      result.code = info.code;
      break;
    }
  }
  
  // Try to extract from operated by text
  const operatedByMatch = pageText.match(/operated\s+by\s+(\w+(?:\s+\w+)?)/i);
  if (operatedByMatch && !result.name) {
    const operatedBy = operatedByMatch[1].toLowerCase();
    for (const [keyword, info] of Object.entries(AIRLINE_MAPPINGS)) {
      if (operatedBy.includes(keyword)) {
        result.name = info.name;
        result.code = info.code;
        break;
      }
    }
  }
  
  // Try to find airline logo
  const logoSelectors = [
    'img[alt*="airline"]',
    'img[alt*="logo"]',
    'img[src*="airline"]',
    'img[src*="logo"]',
  ];
  
  for (const selector of logoSelectors) {
    try {
      const img = document.querySelector(selector) as HTMLImageElement;
      if (img?.src) {
        result.logoUrl = img.src;
        
        // Try to extract airline from logo alt text
        if (img.alt && !result.name) {
          const altLower = img.alt.toLowerCase();
          for (const [keyword, info] of Object.entries(AIRLINE_MAPPINGS)) {
            if (altLower.includes(keyword)) {
              result.name = info.name;
              result.code = info.code;
              break;
            }
          }
        }
        break;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return result;
}

// ============================================
// MAIN CAPTURE FUNCTION
// ============================================

export function capturePortalSnapshot(): PortalSnapshot | null {
  // Check if we're on Capital One Travel
  const isCapitalOneTravel = CAPITAL_ONE_TRAVEL_PATTERNS.some((pattern) =>
    pattern.test(window.location.href)
  );
  
  if (!isCapitalOneTravel) {
    console.log('[PortalCapture] Not on Capital One Travel');
    return null;
  }
  
  const pageType = detectPageType();
  const bookingType = detectBookingType();
  const priceSnapshot = extractBestPrice();
  
  if (!priceSnapshot) {
    console.log('[PortalCapture] Could not extract price');
    return null;
  }
  
  // Extract itinerary based on booking type
  let itinerary;
  if (bookingType === 'flight') {
    itinerary = extractFlightFingerprint() ?? undefined;
  } else if (bookingType === 'hotel') {
    itinerary = extractHotelFingerprint() ?? undefined;
  }
  
  // Extract provider info
  const providerInfo = extractProviderInfo();
  
  const snapshot: PortalSnapshot = {
    bookingType,
    totalPrice: priceSnapshot,
    itinerary,
    providerName: providerInfo.name,
    providerCode: providerInfo.code,
    providerLogoUrl: providerInfo.logoUrl,
    pageType,
    capturedAt: Date.now(),
  };
  
  console.log('[PortalCapture] Captured snapshot:', snapshot);
  
  return snapshot;
}

// ============================================
// MESSAGE HANDLERS
// ============================================

export function setupPortalCaptureListeners(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VX_COMPARE_CAPTURE_PORTAL') {
      console.log('[PortalCapture] Received capture request');
      
      const snapshot = capturePortalSnapshot();
      
      if (snapshot) {
        const payload: PortalCapturedPayload = {
          portalSnapshot: snapshot,
          tabId: 0, // Will be filled by background
          url: window.location.href,
        };
        
        // Also send to background
        chrome.runtime.sendMessage({
          type: 'VX_COMPARE_PORTAL_CAPTURED',
          sessionId: message.sessionId,
          payload,
        });
        
        sendResponse({ success: true, snapshot });
      } else {
        sendResponse({ success: false, error: 'Could not capture portal snapshot' });
      }
      
      return true;
    }
    
    if (message.type === 'VX_GET_PORTAL_PREVIEW') {
      // Quick preview without full capture
      const pageType = detectPageType();
      const bookingType = detectBookingType();
      const priceSnapshot = extractBestPrice();
      const providerInfo = extractProviderInfo();
      
      sendResponse({
        isCapitalOneTravel: CAPITAL_ONE_TRAVEL_PATTERNS.some((p) => p.test(window.location.href)),
        pageType,
        bookingType,
        hasPrice: !!priceSnapshot,
        price: priceSnapshot?.amount,
        providerName: providerInfo.name,
        providerCode: providerInfo.code,
      });
      
      return true;
    }
    
    return false;
  });
}

// Auto-initialize if on Capital One Travel
if (
  CAPITAL_ONE_TRAVEL_PATTERNS.some((pattern) => pattern.test(window.location.href))
) {
  setupPortalCaptureListeners();
  console.log('[PortalCapture] Initialized for Capital One Travel');
}
