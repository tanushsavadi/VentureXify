// ============================================
// GOOGLE HOTELS DIRECT CAPTURE
// Content script for capturing hotel prices from Google Hotels
// for comparison with Capital One Travel portal
// ============================================

import {
  DirectStayCapture,
  StayMatchResult,
  StayPortalCapture,
  fuzzyMatchPropertyName,
  generateCaptureId,
  STAYS_CONSTANTS,
} from '../lib/staysTypes';
import { ConfidenceLevel } from '../lib/types';

// ============================================
// PRICE EXTRACTION FOR GOOGLE HOTELS
// ============================================

/**
 * Parse price from Google Hotels format
 * Handles: $123, $1,234, €99, £150, etc.
 */
function parseGooglePrice(text: string): { amount: number; currency: string } | null {
  if (!text) return null;
  
  const cleaned = text.trim();
  
  // Determine currency
  let currency = 'USD';
  if (cleaned.startsWith('€')) currency = 'EUR';
  else if (cleaned.startsWith('£')) currency = 'GBP';
  else if (cleaned.startsWith('$')) currency = 'USD';
  else if (/\bUSD\b/i.test(cleaned)) currency = 'USD';
  else if (/\bEUR\b/i.test(cleaned)) currency = 'EUR';
  else if (/\bGBP\b/i.test(cleaned)) currency = 'GBP';
  
  // Extract numeric value
  const numericMatch = cleaned.match(/[\d,]+\.?\d*/);
  if (!numericMatch) return null;
  
  const numericStr = numericMatch[0].replace(/,/g, '');
  const amount = parseFloat(numericStr);
  
  if (isNaN(amount) || amount <= 0) return null;
  
  return { amount, currency };
}

/**
 * Extract dates from Google Hotels URL or page
 */
function extractDatesFromGoogle(): { checkIn: string; checkOut: string; nights: number } | null {
  const url = window.location.href;
  
  // Try URL params first
  const urlObj = new URL(url);
  const params = urlObj.searchParams;
  
  let checkIn = params.get('checkin') || params.get('check_in') || '';
  let checkOut = params.get('checkout') || params.get('check_out') || '';
  
  // Google sometimes uses different date format in URL
  if (!checkIn || !checkOut) {
    const datePattern = /(\d{4}-\d{2}-\d{2})/g;
    const matches = url.match(datePattern);
    if (matches && matches.length >= 2) {
      checkIn = matches[0];
      checkOut = matches[1];
    }
  }
  
  // Try to extract from visible date elements
  if (!checkIn || !checkOut) {
    const dateElements = document.querySelectorAll('[data-date], [aria-label*="date"], [class*="date"]');
    for (const el of dateElements) {
      const dateAttr = el.getAttribute('data-date') || el.getAttribute('aria-label') || '';
      const dateMatch = dateAttr.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        if (!checkIn) checkIn = dateMatch[1];
        else if (!checkOut) checkOut = dateMatch[1];
      }
    }
  }
  
  if (!checkIn || !checkOut) {
    return null;
  }
  
  // Calculate nights
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = end.getTime() - start.getTime();
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      checkIn,
      checkOut,
      nights: Math.max(1, nights),
    };
  } catch {
    return null;
  }
}

/**
 * Extract occupancy from Google Hotels
 */
function extractOccupancy(): { guests: number; rooms: number } {
  const url = window.location.href;
  const params = new URL(url).searchParams;
  
  let guests = parseInt(params.get('guests') || params.get('adults') || '2', 10);
  let rooms = parseInt(params.get('rooms') || '1', 10);
  
  // Try to find in page content
  const guestEl = document.querySelector('[aria-label*="guest"], [data-guests], [class*="guests"]');
  if (guestEl) {
    const guestText = guestEl.textContent || '';
    const guestMatch = guestText.match(/(\d+)\s*(?:guest|adult)/i);
    if (guestMatch) {
      guests = parseInt(guestMatch[1], 10);
    }
  }
  
  return { guests: guests || 2, rooms: rooms || 1 };
}

// ============================================
// HOTEL PROPERTY EXTRACTION
// ============================================

/**
 * Extract hotel name from Google Hotels page
 */
function extractHotelName(): string | null {
  // Property detail page selectors
  const nameSelectors = [
    'h1[data-hotel-name]',
    'h1[class*="hotel-name"]',
    'h1[class*="property-name"]',
    '[data-hotel-name]',
    '.hotel-header h1',
    '[role="heading"][aria-level="1"]',
    'h1',
  ];
  
  for (const selector of nameSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const name = el.textContent?.trim();
      // Validate it looks like a hotel name (not navigation or breadcrumb)
      if (name && name.length > 3 && name.length < 200) {
        // Avoid common non-hotel text
        if (!/^(hotels?|search|book|travel|google)/i.test(name)) {
          return name;
        }
      }
    }
  }
  
  // Try extracting from URL
  const url = window.location.href;
  const entityMatch = url.match(/\/entity\/([^\/\?]+)/);
  if (entityMatch) {
    return decodeURIComponent(entityMatch[1]).replace(/_/g, ' ');
  }
  
  return null;
}

/**
 * Extract city/location from Google Hotels
 */
function extractLocation(): string | null {
  const locationSelectors = [
    '[data-location]',
    '[class*="location"]',
    '[class*="address"]',
    '.hotel-location',
  ];
  
  for (const selector of locationSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const location = el.textContent?.trim();
      if (location && location.length < 100) {
        return location;
      }
    }
  }
  
  // Try from URL query
  const url = window.location.href;
  const params = new URL(url).searchParams;
  const query = params.get('q') || params.get('destination') || '';
  
  if (query) {
    // Split to get just location part
    const parts = query.split(',');
    if (parts.length > 0) {
      return parts[0].trim();
    }
  }
  
  return null;
}

// ============================================
// PRICE EXTRACTION FROM GOOGLE HOTELS
// ============================================

interface GooglePriceResult {
  totalPrice: number;
  nightlyRate: number | null;
  nights: number;
  currency: string;
  provider: string | null;
  taxesIncluded: boolean;
  taxesFees: number | null;
  confidence: ConfidenceLevel;
}

/**
 * Extract the best price from Google Hotels page
 */
function extractGoogleHotelsPrice(): GooglePriceResult | null {
  let totalPrice = 0;
  let nightlyRate: number | null = null;
  let nights = 1;
  let currency = 'USD';
  let provider: string | null = null;
  let taxesIncluded = false;
  let taxesFees: number | null = null;
  let confidence: ConfidenceLevel = 'LOW';
  
  // Try to get nights from URL/page
  const dateInfo = extractDatesFromGoogle();
  if (dateInfo) {
    nights = dateInfo.nights;
  }
  
  // ============================================
  // Strategy 1: Deal card / highlighted price
  // ============================================
  
  const dealSelectors = [
    '[data-deal-price]',
    '[class*="deal-price"]',
    '[class*="best-price"]',
    '[class*="highlighted-price"]',
    '[data-price][data-featured]',
  ];
  
  for (const selector of dealSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const priceText = el.textContent || '';
      const parsed = parseGooglePrice(priceText);
      if (parsed) {
        totalPrice = parsed.amount;
        currency = parsed.currency;
        confidence = 'HIGH';
        
        // Check if this is per night
        const parentText = el.parentElement?.textContent || '';
        if (/per\s*night/i.test(parentText)) {
          nightlyRate = totalPrice;
          totalPrice = nightlyRate * nights;
          confidence = 'MED';
        }
        break;
      }
    }
  }
  
  // ============================================
  // Strategy 2: Price list from providers
  // ============================================
  
  if (!totalPrice) {
    // Look for provider price cards
    const priceCards = document.querySelectorAll([
      '[data-provider]',
      '[class*="provider-card"]',
      '[class*="booking-option"]',
      '[class*="price-option"]',
    ].join(','));
    
    let lowestPrice = Infinity;
    
    for (const card of priceCards) {
      // Get provider name
      const providerEl = card.querySelector('[class*="provider"], [data-provider-name]');
      const providerName = providerEl?.textContent?.trim() || 
        card.getAttribute('data-provider') || '';
      
      // Get price
      const priceEl = card.querySelector('[class*="price"], [data-price]');
      if (priceEl) {
        const priceText = priceEl.textContent || '';
        const parsed = parseGooglePrice(priceText);
        
        if (parsed && parsed.amount < lowestPrice) {
          lowestPrice = parsed.amount;
          totalPrice = parsed.amount;
          currency = parsed.currency;
          provider = providerName || null;
          confidence = 'MED';
          
          // Check if per night
          const cardText = card.textContent || '';
          if (/per\s*night/i.test(cardText)) {
            nightlyRate = totalPrice;
            totalPrice = nightlyRate * nights;
          }
        }
      }
    }
  }
  
  // ============================================
  // Strategy 3: Generic price search
  // ============================================
  
  if (!totalPrice) {
    // Find all price-like elements
    const allPriceElements = document.querySelectorAll([
      '[data-price]',
      '[class*="price"]',
      '[class*="rate"]',
      '[class*="cost"]',
    ].join(','));
    
    let bestPrice = Infinity;
    
    for (const el of allPriceElements) {
      const text = el.textContent || '';
      const parsed = parseGooglePrice(text);
      
      // Validate reasonable hotel price range
      if (parsed && parsed.amount > 20 && parsed.amount < 50000) {
        if (parsed.amount < bestPrice) {
          bestPrice = parsed.amount;
          totalPrice = parsed.amount;
          currency = parsed.currency;
          confidence = 'LOW';
          
          // Try to determine if per night or total
          const parentText = el.parentElement?.textContent || '';
          if (/per\s*night/i.test(parentText) || /\/\s*night/i.test(parentText)) {
            nightlyRate = totalPrice;
            totalPrice = nightlyRate * nights;
          }
        }
      }
    }
  }
  
  // ============================================
  // Check for taxes info
  // ============================================
  
  const taxTexts = [
    'taxes included',
    'includes taxes',
    'incl. taxes',
    'total',
  ];
  
  const pageText = document.body.innerText.toLowerCase();
  for (const taxText of taxTexts) {
    if (pageText.includes(taxText)) {
      taxesIncluded = true;
      break;
    }
  }
  
  // Try to find separate taxes/fees amount
  const taxEl = document.querySelector('[class*="tax"], [class*="fee"]');
  if (taxEl) {
    const taxText = taxEl.textContent || '';
    const taxMatch = taxText.match(/\$?([\d,]+\.?\d*)/);
    if (taxMatch) {
      taxesFees = parseFloat(taxMatch[1].replace(/,/g, ''));
    }
  }
  
  if (!totalPrice) {
    return null;
  }
  
  return {
    totalPrice,
    nightlyRate,
    nights,
    currency,
    provider,
    taxesIncluded,
    taxesFees,
    confidence,
  };
}

// ============================================
// MATCHING HEURISTICS
// ============================================

/**
 * Compare a direct capture with portal capture to determine match confidence
 */
export function matchStayCaptures(
  portalCapture: StayPortalCapture,
  directName: string | null,
  directCity: string | null,
  directDates: { checkIn: string; checkOut: string } | null,
  directOccupancy: { guests: number; rooms: number }
): StayMatchResult {
  const warnings: string[] = [];
  let score = 0;
  
  // ============================================
  // Name matching (0-40 points)
  // ============================================
  
  let nameScore = 0;
  if (directName && portalCapture.property.propertyName) {
    nameScore = fuzzyMatchPropertyName(directName, portalCapture.property.propertyName);
  } else {
    warnings.push('Could not verify property name match');
  }
  score += Math.round(nameScore * 0.4);
  
  // ============================================
  // Date matching (0-30 points)
  // ============================================
  
  let datesMatch = false;
  if (directDates && portalCapture.searchContext.checkIn && portalCapture.searchContext.checkOut) {
    datesMatch = 
      directDates.checkIn === portalCapture.searchContext.checkIn &&
      directDates.checkOut === portalCapture.searchContext.checkOut;
    
    if (datesMatch) {
      score += 30;
    } else {
      warnings.push(`Dates may not match: Direct ${directDates.checkIn}-${directDates.checkOut} vs Portal ${portalCapture.searchContext.checkIn}-${portalCapture.searchContext.checkOut}`);
    }
  } else {
    warnings.push('Could not verify date match');
  }
  
  // ============================================
  // Occupancy matching (0-15 points)
  // ============================================
  
  let occupancyMatch = false;
  if (directOccupancy) {
    const portalGuests = portalCapture.searchContext.adults + (portalCapture.searchContext.children || 0);
    occupancyMatch = 
      directOccupancy.guests === portalGuests &&
      directOccupancy.rooms === portalCapture.searchContext.rooms;
    
    if (occupancyMatch) {
      score += 15;
    } else {
      warnings.push(`Occupancy may differ: Direct ${directOccupancy.guests} guests, ${directOccupancy.rooms} rooms`);
    }
  }
  
  // ============================================
  // Location matching (0-15 points)
  // ============================================
  
  let locationScore = 0;
  if (directCity && portalCapture.property.city) {
    const cityMatch = directCity.toLowerCase().includes(portalCapture.property.city.toLowerCase()) ||
      portalCapture.property.city.toLowerCase().includes(directCity.toLowerCase());
    locationScore = cityMatch ? 100 : 0;
  } else if (directCity && portalCapture.searchContext.place) {
    const placeMatch = directCity.toLowerCase().includes(portalCapture.searchContext.place.toLowerCase()) ||
      portalCapture.searchContext.place.toLowerCase().includes(directCity.toLowerCase());
    locationScore = placeMatch ? 80 : 0;
  }
  score += Math.round(locationScore * 0.15);
  
  // ============================================
  // Price reasonableness check (bonus/penalty)
  // ============================================
  
  let priceReasonable = true;
  // This will be checked by the caller with actual prices
  
  // ============================================
  // Determine overall confidence
  // ============================================
  
  let confidence: ConfidenceLevel;
  let isMatch: boolean;
  
  if (score >= 80) {
    confidence = 'HIGH';
    isMatch = true;
  } else if (score >= 50) {
    confidence = 'MED';
    isMatch = true;
  } else if (score >= 30) {
    confidence = 'LOW';
    isMatch = true;
    warnings.push('Low confidence match - please verify this is the same property');
  } else {
    confidence = 'LOW';
    isMatch = false;
    warnings.push('Could not confidently match this hotel to your portal booking');
  }
  
  return {
    isMatch,
    confidence,
    score,
    details: {
      nameScore,
      datesMatch,
      occupancyMatch,
      locationScore,
      priceReasonable,
    },
    warnings,
  };
}

// ============================================
// MAIN CAPTURE FUNCTION
// ============================================

/**
 * Capture hotel price from Google Hotels
 */
export function captureGoogleHotelsPrice(
  portalCapture?: StayPortalCapture
): DirectStayCapture | null {
  console.log('[GoogleHotelsCapture] Starting capture...');
  
  // Check if we're on a Google Hotels page
  const url = window.location.href;
  const isGoogleHotels = STAYS_CONSTANTS.GOOGLE_HOTELS_PATTERNS.SEARCH.test(url) ||
    STAYS_CONSTANTS.GOOGLE_HOTELS_PATTERNS.ENTITY.test(url) ||
    STAYS_CONSTANTS.GOOGLE_HOTELS_PATTERNS.SEARCH_RESULTS.test(url);
  
  if (!isGoogleHotels) {
    console.log('[GoogleHotelsCapture] Not a Google Hotels page');
    return null;
  }
  
  // Extract price
  const priceResult = extractGoogleHotelsPrice();
  if (!priceResult) {
    console.log('[GoogleHotelsCapture] Could not extract price');
    return null;
  }
  
  console.log('[GoogleHotelsCapture] Price extracted:', priceResult);
  
  // Extract property info for matching
  const propertyName = extractHotelName();
  const city = extractLocation();
  const dateInfo = extractDatesFromGoogle();
  const occupancy = extractOccupancy();
  
  console.log('[GoogleHotelsCapture] Property info:', { propertyName, city, dateInfo, occupancy });
  
  // Determine match confidence if we have portal capture to compare
  let matchConfidence: ConfidenceLevel = 'LOW';
  let matchDetails: DirectStayCapture['matchDetails'];
  
  if (portalCapture) {
    const matchResult = matchStayCaptures(
      portalCapture,
      propertyName,
      city,
      dateInfo,
      occupancy
    );
    
    matchConfidence = matchResult.confidence;
    matchDetails = {
      nameMatch: matchResult.details.nameScore >= 70,
      datesMatch: matchResult.details.datesMatch,
      occupancyMatch: matchResult.details.occupancyMatch,
      locationMatch: matchResult.details.locationScore >= 70,
      notes: matchResult.warnings,
    };
    
    console.log('[GoogleHotelsCapture] Match result:', matchResult);
  }
  
  // Build capture object
  const capture: DirectStayCapture = {
    captureId: generateCaptureId(),
    bookingType: 'stay',
    
    siteName: 'Google Hotels',
    siteUrl: url,
    provider: priceResult.provider || undefined,
    
    propertyName: propertyName || undefined,
    city: city || undefined,
    
    totalPrice: {
      amount: priceResult.totalPrice,
      currency: priceResult.currency,
      confidence: priceResult.confidence,
      label: priceResult.nightlyRate ? 'total' : 'total',
      source: 'dom',
      extractedAt: Date.now(),
    },
    
    nightlyRate: priceResult.nightlyRate || undefined,
    nights: priceResult.nights,
    taxesFees: priceResult.taxesFees || undefined,
    taxesIncluded: priceResult.taxesIncluded,
    
    matchConfidence,
    matchDetails,
    
    capturedAt: Date.now(),
  };
  
  console.log('[GoogleHotelsCapture] Complete capture:', capture);
  
  return capture;
}

// ============================================
// AUTO-CAPTURE WITH OBSERVER
// ============================================

let captureTimeout: ReturnType<typeof setTimeout> | null = null;
let lastCapture: DirectStayCapture | null = null;
let portalContext: StayPortalCapture | null = null;

function debouncedCapture(callback: (capture: DirectStayCapture) => void): void {
  if (captureTimeout) {
    clearTimeout(captureTimeout);
  }
  
  captureTimeout = setTimeout(() => {
    const capture = captureGoogleHotelsPrice(portalContext || undefined);
    
    if (capture) {
      // Check if capture has meaningfully changed
      const hasChanged = !lastCapture || 
        lastCapture.totalPrice.amount !== capture.totalPrice.amount ||
        lastCapture.propertyName !== capture.propertyName;
      
      if (hasChanged) {
        lastCapture = capture;
        callback(capture);
      }
    }
  }, 750);
}

/**
 * Start auto-capturing Google Hotels prices
 */
export function startGoogleHotelsAutoCapture(
  onCapture: (capture: DirectStayCapture) => void,
  portalSnapshot?: StayPortalCapture
): () => void {
  console.log('[GoogleHotelsCapture] Starting auto-capture observer');
  
  // Store portal context for matching
  if (portalSnapshot) {
    portalContext = portalSnapshot;
  }
  
  // Initial capture
  debouncedCapture(onCapture);
  
  // Watch for DOM changes
  const observer = new MutationObserver(() => {
    debouncedCapture(onCapture);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  
  // Watch for URL changes
  let lastUrl = window.location.href;
  const urlChecker = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      lastCapture = null; // Reset on navigation
      debouncedCapture(onCapture);
    }
  }, 1000);
  
  // Return cleanup function
  return () => {
    observer.disconnect();
    clearInterval(urlChecker);
    if (captureTimeout) {
      clearTimeout(captureTimeout);
    }
    portalContext = null;
  };
}

// ============================================
// MESSAGE HANDLER
// ============================================

export function handleGoogleHotelsCaptureMessage(
  message: { type: string; sessionId?: string; portalSnapshot?: StayPortalCapture },
  sendResponse: (response: unknown) => void
): boolean {
  if (message.type === 'VX_COMPARE_CAPTURE_DIRECT_STAY') {
    console.log('[GoogleHotelsCapture] Received capture request');
    
    // Update portal context if provided
    if (message.portalSnapshot) {
      portalContext = message.portalSnapshot;
    }
    
    const capture = captureGoogleHotelsPrice(portalContext || undefined);
    
    if (capture) {
      // Send to background
      chrome.runtime.sendMessage({
        type: 'VX_STAY_DIRECT_CAPTURED',
        sessionId: message.sessionId,
        payload: {
          directCapture: capture,
        },
      });
      
      sendResponse({ success: true, capture });
    } else {
      sendResponse({ success: false, error: 'Could not capture hotel price' });
    }
    
    return true;
  }
  
  if (message.type === 'VX_SET_PORTAL_CONTEXT_STAY') {
    console.log('[GoogleHotelsCapture] Setting portal context');
    
    if (message.portalSnapshot) {
      portalContext = message.portalSnapshot;
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No portal snapshot provided' });
    }
    
    return true;
  }
  
  return false;
}

// ============================================
// HELPER WIDGET INJECTION
// ============================================

/**
 * Show a floating helper on Google Hotels indicating comparison status
 */
export function showGoogleHotelsHelper(
  portalCapture: StayPortalCapture,
  onManualPrice: (price: number) => void
): () => void {
  // Remove existing helper if any
  const existing = document.getElementById('vx-google-hotels-helper');
  if (existing) {
    existing.remove();
  }
  
  const helper = document.createElement('div');
  helper.id = 'vx-google-hotels-helper';
  helper.innerHTML = `
    <style>
      #vx-google-hotels-helper {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 16px;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: white;
        z-index: 999999;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(20px);
      }
      #vx-google-hotels-helper .vx-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      #vx-google-hotels-helper .vx-logo {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05));
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
      }
      #vx-google-hotels-helper .vx-title {
        font-size: 14px;
        font-weight: 600;
      }
      #vx-google-hotels-helper .vx-subtitle {
        font-size: 11px;
        color: rgba(255,255,255,0.6);
      }
      #vx-google-hotels-helper .vx-close {
        margin-left: auto;
        background: none;
        border: none;
        color: rgba(255,255,255,0.5);
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
      }
      #vx-google-hotels-helper .vx-info {
        background: rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 12px;
      }
      #vx-google-hotels-helper .vx-info-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        margin-bottom: 6px;
      }
      #vx-google-hotels-helper .vx-info-row:last-child {
        margin-bottom: 0;
      }
      #vx-google-hotels-helper .vx-info-label {
        color: rgba(255,255,255,0.6);
      }
      #vx-google-hotels-helper .vx-info-value {
        color: white;
        font-weight: 500;
      }
      #vx-google-hotels-helper .vx-portal-price {
        font-size: 18px;
        font-weight: 700;
      }
      #vx-google-hotels-helper .vx-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        padding: 8px 12px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
      }
      #vx-google-hotels-helper .vx-status.looking {
        color: #fbbf24;
      }
      #vx-google-hotels-helper .vx-status.found {
        color: #34d399;
      }
      #vx-google-hotels-helper .vx-manual-btn {
        width: 100%;
        margin-top: 10px;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.08);
        color: white;
        font-size: 12px;
        cursor: pointer;
      }
      #vx-google-hotels-helper .vx-manual-btn:hover {
        background: rgba(255,255,255,0.12);
      }
    </style>
    <div class="vx-header">
      <div class="vx-logo">VX</div>
      <div>
        <div class="vx-title">Comparing Hotel</div>
        <div class="vx-subtitle">VentureXify</div>
      </div>
      <button class="vx-close" id="vx-helper-close">×</button>
    </div>
    <div class="vx-info">
      <div class="vx-info-row">
        <span class="vx-info-label">Property</span>
        <span class="vx-info-value">${portalCapture.property.propertyName.substring(0, 25)}${portalCapture.property.propertyName.length > 25 ? '...' : ''}</span>
      </div>
      <div class="vx-info-row">
        <span class="vx-info-label">Dates</span>
        <span class="vx-info-value">${portalCapture.searchContext.checkIn} - ${portalCapture.searchContext.checkOut}</span>
      </div>
      <div class="vx-info-row">
        <span class="vx-info-label">Portal Price</span>
        <span class="vx-info-value vx-portal-price">$${portalCapture.totalPrice.amount.toLocaleString()}</span>
      </div>
    </div>
    <div class="vx-status looking" id="vx-capture-status">
      <span>🔍</span>
      <span>Looking for direct price...</span>
    </div>
    <button class="vx-manual-btn" id="vx-manual-price-btn">
      Enter price manually
    </button>
  `;
  
  document.body.appendChild(helper);
  
  // Close button handler
  const closeBtn = document.getElementById('vx-helper-close');
  closeBtn?.addEventListener('click', () => {
    helper.remove();
    chrome.runtime.sendMessage({ type: 'VX_DIRECT_HELPER_CLOSED' });
  });
  
  // Manual price button handler
  const manualBtn = document.getElementById('vx-manual-price-btn');
  manualBtn?.addEventListener('click', () => {
    const priceStr = prompt('Enter the direct price (total):');
    if (priceStr) {
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
      if (!isNaN(price) && price > 0) {
        onManualPrice(price);
      }
    }
  });
  
  // Return cleanup function
  return () => {
    helper.remove();
  };
}

/**
 * Update the helper status when price is found
 */
export function updateGoogleHotelsHelperStatus(found: boolean, price?: number): void {
  const statusEl = document.getElementById('vx-capture-status');
  if (!statusEl) return;
  
  if (found && price) {
    statusEl.className = 'vx-status found';
    statusEl.innerHTML = `
      <span>✓</span>
      <span>Found: $${price.toLocaleString()}</span>
    `;
  } else {
    statusEl.className = 'vx-status looking';
    statusEl.innerHTML = `
      <span>🔍</span>
      <span>Looking for direct price...</span>
    `;
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  parseGooglePrice,
  extractDatesFromGoogle,
  extractOccupancy,
  extractHotelName,
  extractLocation,
  extractGoogleHotelsPrice,
};
