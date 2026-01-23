// ============================================
// BACKGROUND ROUTER - Central Message Handler
// Routes messages between content scripts, UI, and background
// Supports both Flights and Stays (Hotels/Vacation Rentals)
// ============================================

import {
  VXMessage,
  PortalCapturePayload,
  DirectCapturePayload,
  GoogleFlightsPrefillPayload,
  AIExplanationRequestPayload,
  ChatMessagePayload,
} from '../shared/messages';
import { FlowContext, initFlowFSM, getFlowFSM } from '../flow/fsm';
import { calculatePortalVsDirect } from '../lib/calculators';
import { generateAIExplanation, buildDeterministicExplanation } from '../ai/explainer';
import { getPreferences } from '../lib/storage';
import { PortalSnapshot, DirectSnapshot, ComparisonResult } from '../lib/compareTypes';
import { VENTURE_X_CONSTANTS, ConfidenceLevel } from '../lib/types';
import {
  StayPortalCapture,
  DirectStayCapture,
  StayComparisonResult,
  buildGoogleHotelsUrl,
  getPortalEarnRate,
  detectAccommodationType,
} from '../lib/staysTypes';
import { simpleStayCompare, StayCompareInput, StayCompareOutput } from '../engine/strategyEngine';

// ============================================
// STATE
// ============================================

let fsmInitialized = false;

// ============================================
// INITIALIZE ROUTER
// ============================================

export async function initRouter(): Promise<void> {
  console.log('[Router] Initializing...');
  
  // Initialize FSM
  if (!fsmInitialized) {
    await initFlowFSM();
    fsmInitialized = true;
  }

  // Setup message listener
  chrome.runtime.onMessage.addListener(handleMessage);

  // Setup tab change listener for context detection
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onActivated.addListener(handleTabActivated);

  console.log('[Router] Initialized');
}

// ============================================
// MESSAGE HANDLER
// ============================================

function handleMessage(
  message: VXMessage & { type: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  // Log for debugging
  console.log('[Router] Received:', message.type, message);

  // Handle async
  handleMessageAsync(message, sender)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      console.error('[Router] Error handling message:', error);
      sendResponse({ success: false, error: String(error) });
    });

  return true; // Keep channel open for async response
}

async function handleMessageAsync(
  message: VXMessage & { type: string },
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const fsm = getFlowFSM();

  switch (message.type) {
    // ============================================
    // Content Script -> Background
    // ============================================

    case 'PAGE_CONTEXT': {
      const payload = (message as { payload: unknown }).payload;
      await fsm.send({ type: 'PAGE_CONTEXT_UPDATED', payload: payload as any });
      
      // Broadcast to UI
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
      
      return { success: true };
    }

    case 'PORTAL_CAPTURE': {
      const payload = (message as { payload: PortalCapturePayload }).payload;
      await fsm.send({ type: 'PORTAL_CAPTURE_RECEIVED', payload: payload.snapshot });
      
      // Broadcast to UI
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
      broadcastToUI({ 
        type: 'CAPTURE_RESULT', 
        payload: { success: true, target: 'portal', snapshot: payload.snapshot } 
      });
      
      return { success: true };
    }

    case 'DIRECT_CAPTURE': {
      const payload = (message as { payload: DirectCapturePayload }).payload;
      await fsm.send({ type: 'DIRECT_CAPTURE_RECEIVED', payload: payload.snapshot });
      
      // Broadcast to UI
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
      broadcastToUI({ 
        type: 'CAPTURE_RESULT', 
        payload: { success: true, target: 'direct', snapshot: payload.snapshot } 
      });
      
      return { success: true };
    }

    // ============================================
    // UI -> Background
    // ============================================

    case 'GET_FLOW_STATE': {
      return { success: true, context: fsm.getContext() };
    }

    case 'CONFIRM_PORTAL': {
      await fsm.send({ type: 'PORTAL_CONFIRMED' });
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
      return { success: true };
    }

    case 'CONFIRM_DIRECT': {
      const ctx = fsm.getContext();
      await fsm.send({ type: 'DIRECT_CONFIRMED' });
      
      // Compute verdict
      if (ctx.portalCapture && ctx.directCapture) {
        try {
          const prefs = await getPreferences();
          const verdict = computeVerdictFromCaptures(
            ctx.portalCapture,
            ctx.directCapture,
            prefs.milesValuationCents || 1.7
          );
          await fsm.send({ type: 'VERDICT_COMPUTED', payload: verdict });
          
          broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
          broadcastToUI({ type: 'VX_COMPARE_RESULT', payload: verdict } as any);
        } catch (e) {
          console.error('[Router] Error computing verdict:', e);
          await fsm.send({
            type: 'ERROR_OCCURRED',
            payload: { message: 'Failed to compute verdict', recoverable: true }
          });
        }
      }
      
      return { success: true };
    }

    case 'REQUEST_RECAPTURE': {
      const target = ((message as any).payload as { target: string }).target;
      if (target === 'portal') {
        await fsm.send({ type: 'RECAPTURE_PORTAL' });
      } else {
        await fsm.send({ type: 'RECAPTURE_DIRECT' });
      }
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
      return { success: true };
    }

    case 'RESET_FLOW': {
      await fsm.reset();
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
      return { success: true };
    }

    case 'OPEN_GOOGLE_FLIGHTS_PREFILL': {
      const payload = (message as { payload: GoogleFlightsPrefillPayload }).payload;
      const url = buildGoogleFlightsUrl(payload);
      
      // Open in new tab
      const tab = await chrome.tabs.create({ url, active: true });
      
      // Store pending comparison info for the content script
      await chrome.storage.local.set({
        vx_pending_comparison: {
          sessionId: fsm.getContext().sessionId,
          portalSnapshot: fsm.getContext().portalCapture,
          targetTabId: tab.id,
        },
      });
      
      return { success: true, tabId: tab.id };
    }

    case 'REQUEST_AI_EXPLANATION': {
      const payload = (message as { payload: AIExplanationRequestPayload }).payload;
      const prefs = await getPreferences();
      
      if (!prefs.ai.enabled || !prefs.ai.apiKey) {
        // Return deterministic explanation
        const explanation = buildDeterministicExplanation(payload.verdict);
        return {
          success: true,
          explanation,
          fromCache: false,
        };
      }
      
      try {
        const explanation = await generateAIExplanation(
          payload.verdict,
          payload.portalSnapshot,
          payload.directSnapshot,
          prefs.ai.apiKey
        );
        return { success: true, explanation, fromCache: false };
      } catch (e) {
        console.error('[Router] AI explanation error:', e);
        // Fallback to deterministic
        const explanation = buildDeterministicExplanation(payload.verdict);
        return { success: true, explanation, fromCache: false };
      }
    }

    case 'SEND_CHAT_MESSAGE': {
      const payload = (message as { payload: ChatMessagePayload }).payload;
      const prefs = await getPreferences();
      const ctx = fsm.getContext();
      
      // For now, generate deterministic response
      // AI chat would be implemented similarly to AI explanation
      const response = generateChatResponse(payload.content, ctx, prefs);
      return { success: true, content: response };
    }

    default: {
      // ============================================
      // STAYS MESSAGE HANDLERS (as string comparisons to avoid type issues)
      // ============================================
      const msgType = message.type as string;
      
      if (msgType === 'VX_STAY_PORTAL_CAPTURED') {
        const payload = (message as any).payload;
        const stayCapture = payload?.stayCapture as StayPortalCapture | undefined;
        
        if (stayCapture) {
          console.log('[Router] Stay portal captured:', stayCapture.property?.propertyName);
          
          // Store stay capture
          await chrome.storage.local.set({
            vx_stay_portal_snapshot: stayCapture,
            vx_stay_capture_timestamp: Date.now(),
          });
          
          // Broadcast to UI
          broadcastToUI({
            type: 'STAY_PORTAL_CAPTURED',
            payload: { stayCapture, bookingType: 'stay' }
          });
          
          // Update FSM with stay context
          await fsm.send({
            type: 'PAGE_CONTEXT_UPDATED',
            payload: {
              site: 'capital-one-portal',
              url: stayCapture.portalUrl,
              isReviewPage: true,
              hasItinerary: true,
              bookingType: 'stay',
            } as any
          });
          broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
        }
        
        return { success: !!stayCapture };
      }

      if (msgType === 'VX_STAY_DIRECT_CAPTURED') {
        const payload = (message as any).payload;
        const directCapture = payload?.directCapture as DirectStayCapture | undefined;
        
        if (directCapture) {
          console.log('[Router] Stay direct captured:', directCapture.totalPrice?.amount);
          
          // Store direct capture
          await chrome.storage.local.set({
            vx_stay_direct_snapshot: directCapture,
            vx_stay_direct_capture_timestamp: Date.now(),
          });
          
          // Get portal capture for comparison
          const data = await chrome.storage.local.get(['vx_stay_portal_snapshot']);
          const portalCapture = data.vx_stay_portal_snapshot as StayPortalCapture | undefined;
          
          // Broadcast to UI
          broadcastToUI({
            type: 'STAY_DIRECT_CAPTURED',
            payload: { directCapture, bookingType: 'stay' }
          });
          
          // If we have both portal and direct, compute verdict
          if (portalCapture) {
            try {
              const prefs = await getPreferences();
              const verdict = computeStayVerdictFromCaptures(
                portalCapture,
                directCapture,
                prefs.milesValuationCents || 1.8
              );
              
              // Store verdict
              await chrome.storage.local.set({ vx_stay_verdict: verdict });
              
              // Broadcast verdict
              broadcastToUI({
                type: 'STAY_VERDICT_COMPUTED',
                payload: { verdict, bookingType: 'stay' }
              });
            } catch (e) {
              console.error('[Router] Error computing stay verdict:', e);
            }
          }
        }
        
        return { success: !!directCapture };
      }

      if (msgType === 'VX_MANUAL_STAY_PRICE') {
        const payload = (message as any).payload;
        const { price, currency = 'USD', isPortal = false } = payload || {};
        
        if (typeof price === 'number' && price > 0) {
          console.log('[Router] Manual stay price:', price, currency, isPortal ? 'portal' : 'direct');
          
          if (isPortal) {
            // Update portal price - update the totalPrice
            const data = await chrome.storage.local.get(['vx_stay_portal_snapshot']);
            const portalCapture = data.vx_stay_portal_snapshot as StayPortalCapture | undefined;
            
            if (portalCapture) {
              portalCapture.totalPrice = {
                ...portalCapture.totalPrice,
                amount: price,
                source: 'manual',
                extractedAt: Date.now(),
              };
              if (portalCapture.checkoutBreakdown) {
                portalCapture.checkoutBreakdown.dueTodayCash = price;
              }
              await chrome.storage.local.set({ vx_stay_portal_snapshot: portalCapture });
              broadcastToUI({ type: 'STAY_PORTAL_UPDATED', payload: { portalCapture } });
            }
          } else {
            // Create/update direct capture with proper structure
            const directCapture: DirectStayCapture = {
              captureId: `stay_direct_${Date.now()}`,
              bookingType: 'stay',
              siteName: 'Manual Entry',
              siteUrl: 'manual',
              totalPrice: {
                amount: price,
                currency,
                confidence: 'MED',
                label: 'total',
                source: 'manual',
                extractedAt: Date.now(),
              },
              matchConfidence: 'MED',
              capturedAt: Date.now(),
            };
            await chrome.storage.local.set({ vx_stay_direct_snapshot: directCapture });
            broadcastToUI({ type: 'STAY_DIRECT_CAPTURED', payload: { directCapture } });
          }
          
          // Try to compute verdict
          const data = await chrome.storage.local.get(['vx_stay_portal_snapshot', 'vx_stay_direct_snapshot']);
          if (data.vx_stay_portal_snapshot && data.vx_stay_direct_snapshot) {
            const prefs = await getPreferences();
            const verdict = computeStayVerdictFromCaptures(
              data.vx_stay_portal_snapshot,
              data.vx_stay_direct_snapshot,
              prefs.milesValuationCents || 1.8
            );
            await chrome.storage.local.set({ vx_stay_verdict: verdict });
            broadcastToUI({ type: 'STAY_VERDICT_COMPUTED', payload: { verdict } });
          }
        }
        
        return { success: true };
      }

      if (msgType === 'VX_GET_STAY_CAPTURES') {
        const data = await chrome.storage.local.get([
          'vx_stay_portal_snapshot',
          'vx_stay_direct_snapshot',
          'vx_stay_verdict',
          'vx_stay_capture_timestamp',
        ]);
        
        return {
          success: true,
          portalCapture: data.vx_stay_portal_snapshot,
          directCapture: data.vx_stay_direct_snapshot,
          verdict: data.vx_stay_verdict,
          timestamp: data.vx_stay_capture_timestamp,
        };
      }

      if (msgType === 'VX_COMPARE_STAY_REQUEST') {
        // User requested to compare current stay on Google Hotels
        const data = await chrome.storage.local.get(['vx_stay_portal_snapshot']);
        const portalCapture = data.vx_stay_portal_snapshot as StayPortalCapture | undefined;
        
        if (portalCapture?.searchContext) {
          const { place, checkIn, checkOut, adults, rooms } = portalCapture.searchContext;
          const propertyName = portalCapture.property?.propertyName;
          
          // Build Google Hotels URL using the type from staysTypes.ts
          const url = buildGoogleHotelsUrl(portalCapture.searchContext, propertyName);
          
          // Open in new tab
          const tab = await chrome.tabs.create({ url, active: true });
          
          // Store pending comparison
          await chrome.storage.local.set({
            vx_pending_stay_comparison: {
              portalCapture,
              targetTabId: tab.id,
              timestamp: Date.now(),
            },
          });
          
          return { success: true, tabId: tab.id, url };
        }
        
        return { success: false, error: 'No stay capture available' };
      }

      if (msgType === 'VX_RESET_STAY_FLOW') {
        // Clear all stay-related storage
        await chrome.storage.local.remove([
          'vx_stay_portal_snapshot',
          'vx_stay_direct_snapshot',
          'vx_stay_verdict',
          'vx_stay_capture_timestamp',
          'vx_stay_direct_capture_timestamp',
          'vx_pending_stay_comparison',
        ]);
        
        broadcastToUI({ type: 'STAY_FLOW_RESET' });
        return { success: true };
      }

      // ============================================
      // Handle legacy message types for backwards compatibility
      // ============================================
      if (msgType === 'VX_COMPARE_PORTAL_CAPTURED') {
        const legacyPayload = (message as any).payload;
        if (legacyPayload?.portalSnapshot) {
          await fsm.send({ type: 'PORTAL_CAPTURE_RECEIVED', payload: legacyPayload.portalSnapshot });
          broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
        }
        return { success: true };
      }
      
      if (msgType === 'VX_COMPARE_DIRECT_CAPTURED') {
        const legacyPayload = (message as any).payload;
        if (legacyPayload?.directSnapshot) {
          await fsm.send({ type: 'DIRECT_CAPTURE_RECEIVED', payload: legacyPayload.directSnapshot });
          broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
        }
        return { success: true };
      }
      
      // Not handled by router
      return { success: false, error: 'Unknown message type' };
    }
  }
}

// ============================================
// TAB HANDLERS
// ============================================

async function handleTabUpdate(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Detect page context
  const context = detectPageContext(tab.url);
  
  if (context.site !== 'unknown') {
    const fsm = getFlowFSM();
    await fsm.send({ type: 'PAGE_CONTEXT_UPDATED', payload: context });
    broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
  }
}

async function handleTabActivated(
  activeInfo: chrome.tabs.TabActiveInfo
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const context = detectPageContext(tab.url);
      const fsm = getFlowFSM();
      await fsm.send({ type: 'PAGE_CONTEXT_UPDATED', payload: context });
      broadcastToUI({ type: 'FLOW_STATE_UPDATE', payload: fsm.getContext() });
    }
  } catch (e) {
    // Tab may not exist
  }
}

// ============================================
// VERDICT COMPUTATION
// ============================================

function computeVerdictFromCaptures(
  portalCapture: PortalSnapshot,
  directCapture: DirectSnapshot,
  milesValuation: number
): ComparisonResult {
  const portalPrice = portalCapture.totalPrice?.amount ?? 0;
  const directPrice = directCapture.totalPrice?.amount ?? 0;
  
  // Use the existing calculator
  const result = calculatePortalVsDirect({
    portalPrice,
    directPrice,
    bookingType: portalCapture.bookingType || 'flight',
    milesValuation,
    caresAboutStatus: false,
  });
  
  // Build comparison result
  const delta = portalPrice - directPrice;
  const deltaPercent = directPrice > 0 ? (delta / directPrice) * 100 : 0;
  
  return {
    sessionId: `cmp_${Date.now()}`,
    portalPrice,
    directPrice,
    delta,
    deltaPercent,
    breakEvenPremium: result.breakEvenPremium,
    portalPointsEarned: result.pointsEarnedPortal,
    directPointsEarned: result.pointsEarnedDirect,
    portalPointsValue: result.valuePortal,
    directPointsValue: result.valueDirect,
    winner: result.winner,
    netDifference: result.netDifference,
    confidence: 'HIGH',
    notes: [],
    assumptions: [
      `Miles valued at ${milesValuation}¢ each`,
      `Portal earns ${VENTURE_X_CONSTANTS.PORTAL_MULTIPLIER}x, Direct earns ${VENTURE_X_CONSTANTS.BASE_MULTIPLIER}x`,
    ],
    createdAt: Date.now(),
    portalCapturedAt: portalCapture.capturedAt,
    directCapturedAt: directCapture.capturedAt,
    itinerarySummary: portalCapture.itinerary
      ? generateItinerarySummary(portalCapture.itinerary)
      : undefined,
    providerName: portalCapture.providerName,
  };
}

function generateItinerarySummary(itinerary: PortalSnapshot['itinerary']): string {
  if (!itinerary) return '';
  if (itinerary.type === 'flight') {
    return `${itinerary.origin || '?'} → ${itinerary.destination || '?'}`;
  }
  if (itinerary.type === 'hotel') {
    return itinerary.hotelName || itinerary.city || 'Hotel';
  }
  if (itinerary.type === 'rental') {
    return itinerary.pickupLocation || 'Car Rental';
  }
  return '';
}

// ============================================
// STAYS VERDICT COMPUTATION
// ============================================

/**
 * Convert ConfidenceLevel (uppercase) to lowercase confidence string
 */
function confidenceLevelToLower(level: ConfidenceLevel): 'high' | 'medium' | 'low' {
  switch (level) {
    case 'HIGH': return 'high';
    case 'MED': return 'medium';
    case 'LOW': return 'low';
    default: return 'low';
  }
}

function computeStayVerdictFromCaptures(
  portalCapture: StayPortalCapture,
  directCapture: DirectStayCapture,
  mileValuationCents: number
): StayCompareOutput {
  // Convert to cpp for consistency with engine (0.018 = 1.8 cents)
  const mileValueCpp = mileValuationCents / 100;
  
  // Convert match confidence from ConfidenceLevel to lowercase
  const directConfidence = confidenceLevelToLower(directCapture.matchConfidence);
  
  // Build input for strategy engine
  const input: StayCompareInput = {
    portalPriceUSD: portalCapture.totalPrice?.amount ?? 0,
    directPriceUSD: directCapture.totalPrice?.amount ?? 0,
    portalTaxesFees: portalCapture.checkoutBreakdown?.taxesFees,
    directTaxesFees: directCapture.taxesFees,
    accommodationType: portalCapture.accommodationType === 'hotel' ? 'hotel' :
                       portalCapture.accommodationType === 'vacation_rental' ? 'vacation_rental' : 'unknown',
    mileValuationCpp: mileValueCpp,
    nights: portalCapture.searchContext?.nights,
    propertyName: portalCapture.property?.propertyName,
    location: portalCapture.searchContext?.place,
    checkIn: portalCapture.searchContext?.checkIn,
    checkOut: portalCapture.searchContext?.checkOut,
    directConfidence,
  };
  
  // Use the strategy engine to compute verdict
  return simpleStayCompare(input);
}

// ============================================
// HELPERS
// ============================================

function detectPageContext(url: string): {
  site: 'capital-one-portal' | 'google-flights' | 'other' | 'unknown';
  url: string;
  isReviewPage: boolean;
  hasItinerary: boolean;
} {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('travel.capitalone.com') || urlLower.includes('capitalone.com/travel')) {
    const isReview = urlLower.includes('review') || urlLower.includes('checkout') || urlLower.includes('itinerary');
    return {
      site: 'capital-one-portal',
      url,
      isReviewPage: isReview,
      hasItinerary: isReview,
    };
  }
  
  if (urlLower.includes('google.com/travel/flights') || urlLower.includes('google.com/flights')) {
    const isBooking = urlLower.includes('booking') || urlLower.includes('tfs=');
    return {
      site: 'google-flights',
      url,
      isReviewPage: isBooking,
      hasItinerary: isBooking,
    };
  }
  
  // Check for airline sites
  const airlineDomains = ['delta.com', 'united.com', 'aa.com', 'southwest.com'];
  const isAirline = airlineDomains.some((d) => urlLower.includes(d));
  
  if (isAirline) {
    return {
      site: 'other',
      url,
      isReviewPage: false,
      hasItinerary: false,
    };
  }
  
  return {
    site: 'unknown',
    url,
    isReviewPage: false,
    hasItinerary: false,
  };
}

function buildGoogleFlightsUrl(params: GoogleFlightsPrefillPayload): string {
  const { origin, destination, departDate, returnDate, cabin, passengers } = params;
  
  // Build Google Flights search URL
  let url = 'https://www.google.com/travel/flights';
  
  const searchParams = new URLSearchParams();
  
  if (origin && destination) {
    // Google Flights format: /flights/origin-destination/date
    url = `https://www.google.com/travel/flights/search`;
    
    // Build query params
    const parts: string[] = [];
    
    // Departure
    if (departDate) {
      parts.push(`tfs=m/${departDate}`);
    }
    
    // Return
    if (returnDate) {
      parts.push(`tfs=m/${returnDate}`);
    }
    
    searchParams.set('f', `${origin}-${destination}`);
    
    if (cabin) {
      const cabinMap: Record<string, string> = {
        economy: 'e',
        premium: 'p',
        business: 'b',
        first: 'f',
      };
      searchParams.set('c', cabinMap[cabin] || 'e');
    }
    
    if (passengers && passengers > 1) {
      searchParams.set('px', String(passengers));
    }
  }
  
  // Simplified URL - Google Flights is hard to deep link
  // Just open with basic search params
  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function broadcastToUI(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // UI may not be open
  });
}

function generateChatResponse(
  question: string,
  context: FlowContext,
  prefs: any
): string {
  const q = question.toLowerCase();
  
  // Portal vs Direct question
  if (q.includes('portal') && q.includes('direct')) {
    if (context.verdict) {
      const v = context.verdict;
      const winner = v.winner === 'portal' ? 'Portal' : v.winner === 'direct' ? 'Direct' : 'Either';
      return `Based on my analysis, ${winner} wins by ~$${v.netDifference.toFixed(0)}. Portal earns ${v.portalPointsEarned.toLocaleString()} miles (5x) vs Direct's ${v.directPointsEarned.toLocaleString()} miles (2x). The break-even premium is $${v.breakEvenPremium.toFixed(0)}.`;
    }
    return 'Complete a price comparison first to get my recommendation. Start by navigating to a Capital One Travel review page.';
  }
  
  // Eraser question
  if (q.includes('eraser')) {
    return 'Travel Eraser lets you redeem Capital One miles at 1¢ each for travel purchases made in the last 90 days. Minimum redemption is 5,000 miles ($50). Best used for smaller purchases when you can\'t find better transfer partner value.';
  }
  
  // Transfer question
  if (q.includes('transfer')) {
    return 'Capital One miles transfer 1:1 to partners like Turkish Miles&Smiles, Emirates Skywards, Avianca LifeMiles, and Air Canada Aeroplan. For premium cabin awards, transfers often yield 1.5-3+ cents per mile. Turkish is excellent for Star Alliance awards, Emirates for their own flights.';
  }
  
  // Miles valuation
  if (q.includes('value') || q.includes('worth')) {
    const valuation = prefs?.milesValuationCents || 1.7;
    return `Your miles are currently valued at ${valuation}¢ each. This affects the Portal vs Direct calculation. Portal earns 5x (${(5 * valuation).toFixed(1)}¢ back per dollar) while Direct earns 2x (${(2 * valuation).toFixed(1)}¢ back per dollar).`;
  }
  
  // Default response
  return 'I can help you compare portal vs direct prices, explain Travel Eraser, or suggest transfer partners. What would you like to know?';
}

// Initialize on load
initRouter();
