// ============================================
// AUTOPILOT CONTENT SCRIPT (v2.0)
// Minimal in-page UI: toasts only, side panel drives the journey
// Now with STAYS (Hotels) support!
// ============================================

import {
  detectPageContext,
  type PageData,
} from '../lib/autopilot';

import { capturePortalSnapshot } from './portalCapture';
import { setupDirectCaptureListeners, captureDirectSnapshot } from './directCapture';
import type { PortalSnapshot, DirectSnapshot } from '../lib/compareTypes';

// Import stays capture modules
import { captureStayFromPortal, startStayAutoCapture } from './staysCapture';
import { captureGoogleHotelsPrice, startGoogleHotelsAutoCapture, showGoogleHotelsHelper, updateGoogleHotelsHelperStatus } from './staysDirectCapture';
import { detectStayPageType, type StayPortalCapture } from '../lib/staysTypes';

// ============================================
// STATE
// ============================================

let currentPageData: PageData | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let toastElement: HTMLElement | null = null;
let lastCapturedHash = '';
let lastDirectPriceHash = ''; // Deduplication for direct captures
let directCaptureDebounce: ReturnType<typeof setTimeout> | null = null;

// Stays state
let staysInitialized = false;
let lastStaysCapturedHash = '';
let staysCleanup: (() => void) | null = null;

// ============================================
// TOAST SYSTEM (MINIMAL)
// ============================================

function injectToastStyles(): void {
  if (document.getElementById('vx-toast-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'vx-toast-styles';
  style.textContent = `
    @keyframes vx-toast-slide-in {
      0% {
        opacity: 0;
        transform: translateX(100%) scale(0.95);
      }
      60% {
        opacity: 1;
        transform: translateX(-8px) scale(1.02);
      }
      80% {
        transform: translateX(4px) scale(1);
      }
      100% {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
    
    @keyframes vx-toast-attention-pulse {
      0%, 100% {
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 0 rgba(99, 102, 241, 0);
      }
      50% {
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 20px 4px rgba(99, 102, 241, 0.4);
      }
    }
    
    @keyframes vx-toast-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
    
    /* P0 #6 FIX: Move toast to top-right to avoid overlapping booking buttons */
    .vx-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: rgba(0, 0, 0, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 14px 18px;
      color: white;
      font-size: 13px;
      max-width: 320px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      animation: vx-toast-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), vx-toast-attention-pulse 1.5s ease-in-out 0.4s 2;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    
    .vx-toast:hover {
      transform: translateY(-2px);
      box-shadow: 0 25px 70px rgba(0, 0, 0, 0.5);
    }
    
    .vx-toast.dismissing {
      animation: vx-toast-slide-out 0.25s ease-in forwards;
    }
    
    .vx-toast-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .vx-toast-icon svg {
      width: 18px;
      height: 18px;
      color: white;
    }
    
    .vx-toast-content {
      flex: 1;
      min-width: 0;
    }
    
    .vx-toast-title {
      font-weight: 600;
      font-size: 13px;
      color: white;
      margin-bottom: 2px;
    }
    
    .vx-toast-message {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.4;
    }
    
    .vx-toast-badge {
      background: rgba(74, 222, 128, 0.2);
      color: #4ade80;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      white-space: nowrap;
    }
    
    .vx-toast-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.15s;
    }
    
    .vx-toast:hover .vx-toast-close {
      opacity: 1;
    }
    
    .vx-toast-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .vx-toast-close svg {
      width: 10px;
      height: 10px;
      color: rgba(255, 255, 255, 0.6);
    }
    
    /* Minimal compare chip (optional - near price) */
    .vx-compare-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: #818cf8;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .vx-compare-chip:hover {
      background: rgba(99, 102, 241, 0.25);
      border-color: rgba(99, 102, 241, 0.5);
    }
    
    .vx-compare-chip svg {
      width: 14px;
      height: 14px;
    }
  `;
  document.head.appendChild(style);
}

function showToast(options: {
  title: string;
  message: string;
  badge?: string;
  onClick?: () => void;
  autoDismiss?: number;
}): void {
  // Remove existing toast
  dismissToast();
  injectToastStyles();
  
  const { title, message, badge, onClick, autoDismiss = 8000 } = options;
  
  toastElement = document.createElement('div');
  toastElement.className = 'vx-toast';
  
  toastElement.innerHTML = `
    <button class="vx-toast-close" title="Dismiss">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
    <div class="vx-toast-icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <div class="vx-toast-content">
      <div class="vx-toast-title">${title}</div>
      <div class="vx-toast-message">${message}</div>
    </div>
    ${badge ? `<span class="vx-toast-badge">${badge}</span>` : ''}
  `;
  
  // Click to open side panel
  toastElement.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.vx-toast-close')) {
      dismissToast();
      return;
    }
    if (onClick) {
      onClick();
    } else {
      // Default: open side panel
      chrome.runtime.sendMessage({ type: 'VX_OPEN_SIDE_PANEL' }).catch(() => {});
    }
    dismissToast();
  });
  
  // Close button
  const closeBtn = toastElement.querySelector('.vx-toast-close');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissToast();
  });
  
  document.body.appendChild(toastElement);
  
  // Auto-dismiss
  if (autoDismiss > 0) {
    setTimeout(() => {
      dismissToast();
    }, autoDismiss);
  }
}

function dismissToast(): void {
  if (toastElement) {
    toastElement.classList.add('dismissing');
    setTimeout(() => {
      toastElement?.remove();
      toastElement = null;
    }, 250);
  }
}

// ============================================
// HASH FOR DEDUPLICATION
// ============================================

// Session-persistent hash to track what's been captured across page navigations
let sessionCapturedItineraryHash = '';

function hashCapture(snapshot: PortalSnapshot | DirectSnapshot | null): string {
  if (!snapshot) return '';
  return JSON.stringify({
    price: snapshot.totalPrice?.amount,
    provider: (snapshot as PortalSnapshot).providerCode || '',
  });
}

// More comprehensive hash for itinerary to prevent re-nudging across pages
function hashItinerary(snapshot: PortalSnapshot | null): string {
  if (!snapshot) return '';
  const itinerary = snapshot.itinerary as { origin?: string; destination?: string; departDate?: string } | undefined;
  const price = snapshot.totalPrice?.amount;
  // Hash includes flight details AND price - if same itinerary+price, don't re-nudge
  return JSON.stringify({
    origin: itinerary?.origin || '',
    destination: itinerary?.destination || '',
    departDate: itinerary?.departDate || '',
    price: price || 0,
  });
}

function hashStayCapture(capture: StayPortalCapture | null): string {
  if (!capture) return '';
  return JSON.stringify({
    propertyName: capture.property.propertyName,
    totalPrice: capture.totalPrice?.amount,
    checkIn: capture.searchContext.checkIn,
  });
}

// ============================================
// STAYS PAGE DETECTION
// ============================================

function isCapitalOneStaysPage(): boolean {
  const url = window.location.href.toLowerCase();
  return url.includes('capitalone.com') &&
    (url.includes('/stays/') ||
     url.includes('/hotels/') ||
     url.includes('lodgings') ||
     url.includes('/vacation-rentals/') ||
     url.includes('/premium-stays/'));
}

function isGoogleHotelsPage(): boolean {
  const hostname = window.location.hostname;
  const url = window.location.href;
  return hostname.includes('google.com') &&
    (url.includes('/travel/hotels') || url.includes('/hotels'));
}

// ============================================
// STAYS ANALYSIS & CAPTURE
// ============================================

async function analyzeStaysPage(): Promise<void> {
  console.log('[VX Content] 🏨 Analyzing Capital One STAYS page...');
  
  // Detect page type
  const pageType = detectStayPageType(window.location.href);
  console.log('[VX Content] Stays page type:', pageType);
  
  if (pageType === 'unknown') {
    console.log('[VX Content] Not a recognized stays page type');
    return;
  }
  
  // Only auto-capture on shop/customize pages where we have useful data
  if (pageType === 'availability') {
    console.log('[VX Content] On stays search results - waiting for property selection');
    return;
  }
  
  // Capture stay data
  const capture = captureStayFromPortal();
  
  if (!capture || !capture.totalPrice?.amount) {
    console.log('[VX Content] No valid stay capture');
    return;
  }
  
  // Deduplicate
  const hash = hashStayCapture(capture);
  if (hash === lastStaysCapturedHash) {
    console.log('[VX Content] Same stay data already captured, skipping');
    return;
  }
  
  lastStaysCapturedHash = hash;
  console.log('[VX Content] 🏨 Stay captured:', capture);
  
  // Also save to storage for reliability (side panel can read from storage)
  try {
    await chrome.storage.local.set({ vx_stay_portal_snapshot: capture });
    console.log('[VX Content] Stay snapshot saved to storage');
  } catch (storageErr) {
    console.warn('[VX Content] Could not save stay to storage:', storageErr);
  }
  
  // Send to background/side panel
  try {
    await chrome.runtime.sendMessage({
      type: 'VX_STAY_PORTAL_CAPTURED',
      payload: { stayCapture: capture },
    });
    
    // Show toast
    const propertyName = capture.property.propertyName || 'Hotel';
    const location = capture.property.city || capture.searchContext.place || '';
    const dates = `${capture.searchContext.checkIn} - ${capture.searchContext.checkOut}`;
    
    showToast({
      title: '🏨 Stay Captured',
      message: `${propertyName}${location ? ` • ${location}` : ''}\n${dates}`,
      badge: `$${capture.totalPrice.amount.toLocaleString()}`,
    });
  } catch (e) {
    const error = e as Error;
    console.error('[VX Content] Failed to send stay capture:', error.message);
    
    // If extension context invalidated, show helpful toast
    if (error.message?.includes('Extension context invalidated')) {
      showToast({
        title: '⚠️ Extension Updated',
        message: 'Please refresh this page to continue capturing',
        autoDismiss: 10000,
      });
    } else {
      // Still show capture toast even if message failed (data is in storage)
      const propertyName = capture.property.propertyName || 'Hotel';
      const location = capture.property.city || capture.searchContext.place || '';
      const dates = `${capture.searchContext.checkIn} - ${capture.searchContext.checkOut}`;
      
      showToast({
        title: '🏨 Stay Captured',
        message: `${propertyName}${location ? ` • ${location}` : ''}\n${dates}`,
        badge: `$${capture.totalPrice.amount.toLocaleString()}`,
      });
    }
  }
}

async function analyzeGoogleHotelsPage(): Promise<void> {
  console.log('[VX Content] 🏨 On Google Hotels - direct stay capture mode');
  
  // Capture price from Google Hotels
  const capture = captureGoogleHotelsPrice();
  
  if (capture && capture.totalPrice?.amount > 0) {
    // Deduplicate
    const hash = `hotel-${capture.totalPrice.amount}-${capture.provider}`;
    if (hash === lastDirectPriceHash) {
      console.log('[VX Content] Same hotel price already captured');
      return;
    }
    
    lastDirectPriceHash = hash;
    console.log('[VX Content] 🏨 Google Hotels price captured:', capture);
    
    try {
      await chrome.runtime.sendMessage({
        type: 'VX_STAY_DIRECT_CAPTURED',
        payload: { directCapture: capture },
      });
      
      const currency = capture.totalPrice.currency || 'USD';
      const amount = capture.totalPrice.amount;
      showToast({
        title: '🏨 Direct Price Found',
        message: `${capture.provider || 'Hotel'} • ${currency} ${amount.toLocaleString()}`,
        badge: capture.matchConfidence,
        autoDismiss: 5000,
      });
    } catch (e) {
      console.error('[VX Content] Failed to send Google Hotels capture:', e);
    }
  } else {
    // Show helper if no price found yet
    console.log('[VX Content] Google Hotels - no price captured yet');
  }
}

// ============================================
// PAGE ANALYSIS & CAPTURE (FLIGHTS)
// ============================================

async function analyzePortalPage(): Promise<void> {
  console.log('[VX Content] Analyzing portal page...');
  
  const url = window.location.href.toLowerCase();
  
  // Only skip the "Customize your trip" page - it's upsells only, no booking info
  // Check page content: look for "Customize your trip" heading specifically
  const mainHeading = document.querySelector('h1, h2, [class*="heading"], [class*="title"]')?.textContent?.toLowerCase() || '';
  const heroText = document.querySelector('[class*="hero"], [class*="banner"]')?.textContent?.toLowerCase() || '';
  
  // Only skip if this is specifically the "Customize your trip" upsell page
  const isCustomizePage = (mainHeading.includes('customize your trip') || heroText.includes('customize your trip'));
  
  if (isCustomizePage) {
    console.log('[VX Content] Skipping Customize page - upsells only');
    return;
  }
  
  const snapshot = capturePortalSnapshot();
  if (!snapshot || !snapshot.totalPrice?.amount) {
    console.log('[VX Content] No valid snapshot captured');
    return;
  }
  
  const hash = hashCapture(snapshot);
  if (hash === lastCapturedHash) {
    console.log('[VX Content] Same data, skipping...');
    return;
  }
  
  lastCapturedHash = hash;
  
  console.log('[VX Content] Portal snapshot captured:', snapshot);
  
  // Also save to storage for reliability (side panel can read from storage)
  try {
    await chrome.storage.local.set({ vx_portal_snapshot: snapshot });
    console.log('[VX Content] Snapshot saved to storage');
  } catch (storageErr) {
    console.warn('[VX Content] Could not save to storage:', storageErr);
  }
  
  // Send to background/side panel
  try {
    await chrome.runtime.sendMessage({
      type: 'PORTAL_CAPTURE',
      payload: { snapshot },
    });
    
    // Always show toast for new captures
    // (deduplication is handled by hashCapture above)
    const flight = snapshot.itinerary as { origin?: string; destination?: string } | undefined;
    const route = flight?.origin && flight?.destination
      ? `${flight.origin} → ${flight.destination}`
      : 'Flight';
    
    showToast({
      title: 'Itinerary Captured',
      message: `${route} — Open side panel to continue`,
      badge: `$${snapshot.totalPrice.amount}`,
    });
  } catch (e) {
    const error = e as Error;
    console.error('[VX Content] Failed to send portal capture:', error.message);
    
    // If extension context invalidated, show helpful toast
    if (error.message?.includes('Extension context invalidated')) {
      showToast({
        title: '⚠️ Extension Updated',
        message: 'Please refresh this page to continue capturing',
        autoDismiss: 10000,
      });
    } else {
      // Still show capture toast even if message failed (data is in storage)
      const flight = snapshot.itinerary as { origin?: string; destination?: string } | undefined;
      const route = flight?.origin && flight?.destination
        ? `${flight.origin} → ${flight.destination}`
        : 'Flight';
      
      showToast({
        title: 'Itinerary Captured',
        message: `${route} — Open side panel to continue`,
        badge: `$${snapshot.totalPrice.amount}`,
      });
    }
  }
}

async function analyzeGoogleFlightsPage(): Promise<void> {
  console.log('[VX Content] On Google Flights - direct capture mode');
  
  // Setup direct capture listeners (click handling)
  setupDirectCaptureListeners();
  
  const url = window.location.href;
  // IMPORTANT: Only capture on the FINAL booking page (URL has /booking)
  // Search pages with tfs= are NOT booking pages - they show search results
  // The booking page is where user sees "Selected flights" and "Booking options"
  const isBookingPage = url.includes('/booking');
  const isSearchPage = url.includes('/search') || (url.includes('tfs=') && !url.includes('/booking'));
  
  console.log('[VX Content] Page type:', { isBookingPage, isSearchPage, url: url.substring(0, 100) });
  
  if (isBookingPage) {
    // Debounce: only capture once every 3 seconds to avoid spam
    if (directCaptureDebounce) {
      console.log('[VX Content] Debouncing direct capture...');
      return;
    }
    
    console.log('[VX Content] Google Flights BOOKING page - capturing lowest total price');
    
    // On Google Flights booking page, the "Lowest total price" is the direct price
    // All booking providers can match this price, so capture it directly
    const snapshot = captureDirectSnapshot();
    
    if (snapshot && snapshot.totalPrice?.amount) {
      // Deduplicate: check if this is the same price we already captured
      const priceHash = `${snapshot.totalPrice.amount}-${snapshot.totalPrice.currency}`;
      if (priceHash === lastDirectPriceHash) {
        console.log('[VX Content] Same price already captured, skipping');
        return;
      }
      
      // New price or first capture
      lastDirectPriceHash = priceHash;
      console.log('[VX Content] Google Flights price captured:', snapshot);
      
      // Set debounce timer
      directCaptureDebounce = setTimeout(() => {
        directCaptureDebounce = null;
      }, 3000);
      
      // Send to side panel
      try {
        await chrome.runtime.sendMessage({
          type: 'DIRECT_CAPTURE',
          payload: { snapshot },
        });
        
        // Show toast ONLY once
        const currency = snapshot.totalPrice.currency || 'USD';
        const amount = snapshot.totalPrice.amount;
        showToast({
          title: 'Google Flights Detected',
          message: `Direct price captured: ${currency} ${amount.toLocaleString()}`,
          badge: `${currency} ${amount.toLocaleString()}`,
          autoDismiss: 5000,
        });
      } catch (e) {
        console.error('[VX Content] Failed to send direct capture:', e);
      }
    }
    return;
  }
  
  if (isSearchPage) {
    // On search page - don't capture yet, don't show toast repeatedly
    console.log('[VX Content] Google Flights SEARCH page - user selecting flights');
    // Only show toast once when first landing on search
    if (!lastDirectPriceHash.includes('search-shown')) {
      lastDirectPriceHash = 'search-shown';
      showToast({
        title: 'Google Flights',
        message: 'Select flights and go to booking page',
        autoDismiss: 4000,
      });
    }
    return;
  }
  
  // Neither booking nor search - probably main page
  console.log('[VX Content] Google Flights main page');
}

async function analyzePage(): Promise<void> {
  console.log('[VX Content] Analyzing page:', window.location.href);
  
  const pageData = detectPageContext(document, window.location.href);
  currentPageData = pageData;
  
  // Send page context to background
  try {
    await chrome.runtime.sendMessage({
      type: 'PAGE_CONTEXT',
      payload: {
        site: pageData.context,
        url: window.location.href,
        isPortal: pageData.isPortal,
      },
    });
  } catch (e) {
    // Extension context may be invalid
  }
  
  const hostname = window.location.hostname;
  const url = window.location.href;
  
  // ==============================
  // CRITICAL: Check STAYS first before flights!
  // Both are on capitalone.com, so stays detection must come first
  // ==============================
  
  // Check for Capital One STAYS pages (hotels)
  if (isCapitalOneStaysPage()) {
    console.log('[VX Content] 🏨 Detected Capital One STAYS page');
    await analyzeStaysPage();
    return; // Don't fall through to flight detection
  }
  
  // Check for Google Hotels pages
  if (isGoogleHotelsPage()) {
    console.log('[VX Content] 🏨 Detected Google Hotels page');
    await analyzeGoogleHotelsPage();
    return;
  }
  
  // Now check for FLIGHTS pages
  const isCapitalOne = hostname.includes('capitalone.com');
  const isGoogleFlights = hostname.includes('google.com') &&
    (url.includes('/travel/flights') || url.includes('/flights'));
  
  if (isCapitalOne) {
    // Check flightShopProgress parameter to determine page type
    // 1 = Departure selection (SEARCH - skip)
    // 2 = Return selection (SEARCH - skip)
    // 3 = Review itinerary (CAPTURE ✓)
    // 4+ = Customize/Book
    const flightProgressMatch = url.match(/flightShopProgress=(\d+)/i);
    const flightProgress = flightProgressMatch ? parseInt(flightProgressMatch[1], 10) : 0;
    
    // Also check for /flights/book URL (the actual booking page)
    const isBookPage = url.includes('/flights/book');
    
    // Only capture on:
    // 1. Review itinerary page (flightShopProgress=3)
    // 2. Confirm and Book page (/flights/book)
    const shouldCapture = (flightProgress === 3) || isBookPage;
    
    console.log('[VX Content] Capital One flights page - Progress:', flightProgress, ', isBookPage:', isBookPage, ', shouldCapture:', shouldCapture);
    
    if (shouldCapture) {
      console.log('[VX Content] Capital One flights Review/Book page detected - triggering capture');
      await analyzePortalPage();
    } else if (flightProgress === 1 || flightProgress === 2) {
      console.log('[VX Content] Capital One flights SEARCH page (progress=' + flightProgress + ') - skipping capture, user is selecting flights');
    } else {
      console.log('[VX Content] Capital One page - not a capture-worthy page:', url.substring(0, 100));
    }
  } else if (isGoogleFlights) {
    await analyzeGoogleFlightsPage();
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[VX Content] Message received:', message.type);
  
  switch (message.type) {
    case 'GET_PAGE_DATA':
      sendResponse({ pageData: currentPageData });
      break;
      
    case 'FORCE_CAPTURE_PORTAL':
      analyzePortalPage().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'FORCE_CAPTURE_DIRECT':
      analyzeGoogleFlightsPage().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    // Stays-specific message handlers
    case 'FORCE_CAPTURE_STAY':
      analyzeStaysPage().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'FORCE_CAPTURE_STAY_DIRECT':
      analyzeGoogleHotelsPage().then(() => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'GET_STAY_PAGE_TYPE':
      const pageType = detectStayPageType(window.location.href);
      sendResponse({ pageType, isStaysPage: isCapitalOneStaysPage() });
      break;
      
    case 'SHOW_TOAST':
      showToast({
        title: message.payload.title || 'VentureXify',
        message: message.payload.message || '',
        badge: message.payload.badge,
        autoDismiss: message.payload.autoDismiss,
      });
      sendResponse({ success: true });
      break;
      
    case 'DISMISS_TOAST':
      dismissToast();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
  
  return true;
});

// ============================================
// INITIALIZATION
// ============================================

async function init(): Promise<void> {
  console.log('[VX Content v2.1] 🚀 Initializing with STAYS support...');
  console.log('[VX Content] URL:', window.location.href);
  
  // Detect what type of page we're on for logging
  const isStays = isCapitalOneStaysPage();
  const isHotels = isGoogleHotelsPage();
  if (isStays) {
    console.log('[VX Content] 🏨 Detected Capital One STAYS page');
  }
  if (isHotels) {
    console.log('[VX Content] 🏨 Detected Google Hotels page');
  }
  
  // Check if autopilot is enabled
  try {
    const result = await chrome.storage.sync.get('autopilotEnabled');
    if (result.autopilotEnabled === false) {
      console.log('[VX Content] Autopilot disabled');
      return;
    }
  } catch (e) {
    // Continue anyway
  }
  
  // Initial analysis after page settles
  setTimeout(analyzePage, 1500);
  
  // Watch for DOM changes
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(analyzePage, 2000);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Watch for URL changes (SPAs)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Reset ALL dedup hashes on URL change
      lastCapturedHash = '';
      lastDirectPriceHash = '';
      lastStaysCapturedHash = '';
      console.log('[VX Content] URL changed, resetting capture hashes');
      setTimeout(analyzePage, 1000);
    }
  }, 500);
  
  console.log('[VX Content v2.1] ✅ Initialized');
}

// Run
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {};
