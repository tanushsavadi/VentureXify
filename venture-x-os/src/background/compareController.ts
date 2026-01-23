// ============================================
// COMPARE CONTROLLER - BACKGROUND ORCHESTRATOR
// ============================================

import {
  CompareSession,
  CompareSessionStatus,
  ComparisonResult,
  PortalCapturedPayload,
  DirectCapturedPayload,
  StatusUpdatePayload,
  ManualPricePayload,
  CompareMessage,
  getAirlineConfig,
  AIRLINE_CONFIGS,
  generateItinerarySummary,
  FlightFingerprint,
  sanitizeUrl,
} from '../lib/compareTypes';
import { convertToUSD } from '../lib/currencyConverter';
import {
  createCompareSession,
  saveCompareSession,
  getCompareSession,
  updateSessionStatus,
  getActiveSessionId,
  setActiveSessionId,
  clearActiveSessionId,
  saveComparisonResult,
  getActiveSession,
  clearCompareSessions,
} from '../lib/compareStorage';
import { getPreferences } from '../lib/storage';
import { VENTURE_X_CONSTANTS, ConfidenceLevel } from '../lib/types';

// ============================================
// CONSTANTS
// ============================================

const DIRECT_TAB_TIMEOUT = 60000; // 60 seconds to capture direct price
const PORTAL_CAPTURE_TIMEOUT = 10000; // 10 seconds for portal capture

// ============================================
// STATE
// ============================================

// Active sessions being processed
const activeSessions = new Map<string, {
  timeoutId: ReturnType<typeof setTimeout> | null;
  directTabId: number | null;
}>();

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate comparison result from session
 */
async function calculateComparisonResult(
  session: CompareSession
): Promise<ComparisonResult | null> {
  if (!session.portalSnapshot || !session.directSnapshot) {
    return null;
  }
  
  const prefs = await getPreferences();
  const milesValuation = prefs.milesValuationCents;
  const caresAboutStatus = prefs.caresAboutStatus;
  
  // Portal price is always in USD
  const portalPrice = session.portalSnapshot.totalPrice.amount;
  
  // Direct price may be in foreign currency - convert to USD
  const directCurrency = session.directSnapshot.totalPrice.currency || 'USD';
  const directPriceOriginal = session.directSnapshot.totalPrice.amount;
  const directPrice = directCurrency !== 'USD'
    ? convertToUSD(directPriceOriginal, directCurrency)
    : directPriceOriginal;
  
  console.log('[CompareController] Price comparison:', {
    portalPrice,
    directCurrency,
    directPriceOriginal,
    directPriceUSD: directPrice,
  });
  
  const delta = portalPrice - directPrice;
  const deltaPercent = directPrice > 0 ? (delta / directPrice) * 100 : 0;
  
  // Points calculation
  const portalPointsEarned = Math.floor(portalPrice) * VENTURE_X_CONSTANTS.PORTAL_MULTIPLIER;
  const directPointsEarned = Math.floor(directPrice) * VENTURE_X_CONSTANTS.BASE_MULTIPLIER;
  
  const portalPointsValue = (portalPointsEarned * milesValuation) / 100;
  const directPointsValue = (directPointsEarned * milesValuation) / 100;
  
  // Status adjustment
  const statusAdjustment = caresAboutStatus && session.portalSnapshot.bookingType === 'flight' ? 15 : 0;
  
  // Net value calculation
  const netPortal = portalPointsValue - portalPrice;
  const netDirect = directPointsValue + statusAdjustment - directPrice;
  
  const netDifference = Math.abs(netDirect - netPortal);
  
  // Determine winner
  let winner: 'portal' | 'direct' | 'tie';
  if (Math.abs(netDirect - netPortal) < 1) {
    winner = 'tie';
  } else if (netDirect > netPortal) {
    winner = 'direct';
  } else {
    winner = 'portal';
  }
  
  // Break-even premium calculation
  const extraPointsPerDollarPortal =
    VENTURE_X_CONSTANTS.PORTAL_MULTIPLIER - VENTURE_X_CONSTANTS.BASE_MULTIPLIER;
  const valuePerDollarDifference = (extraPointsPerDollarPortal * milesValuation) / 100;
  const breakEvenPremium = Math.max(
    0,
    (directPointsValue + statusAdjustment - portalPointsValue + portalPrice - directPrice) /
      (1 - valuePerDollarDifference) - directPrice
  );
  
  // Determine overall confidence
  const portalConf = session.portalSnapshot.totalPrice.confidence;
  const directConf = session.directSnapshot.totalPrice.confidence;
  let confidence: ConfidenceLevel;
  if (portalConf === 'HIGH' && directConf === 'HIGH') {
    confidence = 'HIGH';
  } else if (portalConf === 'LOW' || directConf === 'LOW') {
    confidence = 'LOW';
  } else {
    confidence = 'MED';
  }
  
  // Add manual entry note
  if (session.manualPriceEntry) {
    confidence = 'LOW';
  }
  
  // Build notes and assumptions
  const notes: string[] = [];
  const assumptions: string[] = [];
  
  assumptions.push(`Miles valued at ${milesValuation}¢ each`);
  assumptions.push(`Portal earns ${VENTURE_X_CONSTANTS.PORTAL_MULTIPLIER}x, Direct earns ${VENTURE_X_CONSTANTS.BASE_MULTIPLIER}x`);
  
  if (caresAboutStatus) {
    assumptions.push('Added ~$15 value for status/elite credit earning');
  }
  
  if (session.manualPriceEntry) {
    notes.push('⚠️ Contains manually entered price');
  }
  
  if (session.portalSnapshot.totalPrice.label !== 'total') {
    notes.push('⚠️ Portal price may not be the total');
  }
  
  if (session.directSnapshot.totalPrice.label !== 'total') {
    notes.push('⚠️ Direct price may not be the total');
  }
  
  // Add currency conversion note
  if (directCurrency !== 'USD') {
    notes.push(`💱 Direct price converted from ${directCurrency} ${directPriceOriginal.toLocaleString()} to USD`);
    assumptions.push(`Exchange rate for ${directCurrency}→USD may vary`);
  }
  
  // Add delta commentary
  if (delta > 50) {
    notes.push(`Portal is $${delta.toFixed(0)} more expensive`);
  } else if (delta < -50) {
    notes.push(`Direct is $${Math.abs(delta).toFixed(0)} more expensive`);
  } else {
    notes.push('Prices are within $50 of each other');
  }
  
  // Generate itinerary summary
  const itinerarySummary = session.portalSnapshot.itinerary
    ? generateItinerarySummary(session.portalSnapshot.itinerary)
    : undefined;
  
  return {
    sessionId: session.id,
    portalPrice,
    directPrice,
    delta,
    deltaPercent,
    breakEvenPremium,
    portalPointsEarned,
    directPointsEarned,
    portalPointsValue,
    directPointsValue,
    winner,
    netDifference,
    confidence,
    notes,
    assumptions,
    createdAt: Date.now(),
    portalCapturedAt: session.portalSnapshot.capturedAt,
    directCapturedAt: session.directSnapshot.capturedAt,
    itinerarySummary,
    providerName: session.portalSnapshot.providerName,
  };
}

/**
 * Build direct URL for an airline
 */
function buildDirectUrl(session: CompareSession): string {
  const snapshot = session.portalSnapshot;
  if (!snapshot) {
    return 'https://www.google.com'; // Fallback
  }
  
  const providerCode = snapshot.providerCode;
  const itinerary = snapshot.itinerary as FlightFingerprint | undefined;
  
  // Try to find airline config
  let airlineConfig = providerCode ? getAirlineConfig(providerCode) : undefined;
  
  // Fallback: try to match by name
  if (!airlineConfig && snapshot.providerName) {
    const nameLower = snapshot.providerName.toLowerCase();
    airlineConfig = AIRLINE_CONFIGS.find((c) =>
      nameLower.includes(c.name.toLowerCase().split(' ')[0])
    );
  }
  
  if (!airlineConfig) {
    // Default to Delta for MVP
    airlineConfig = AIRLINE_CONFIGS[0];
  }
  
  // For now, just return the search URL
  // In a more advanced version, we could construct deep links with query params
  let url = airlineConfig.searchUrl;
  
  // Try to add origin/destination if available (airline-specific)
  if (itinerary?.origin && itinerary?.destination && itinerary?.departDate) {
    // Note: This is a simplified example. Real deep links vary by airline.
    // Most airlines don't support reliable deep linking, so we default to search page.
    console.log('[CompareController] Itinerary available:', {
      origin: itinerary.origin,
      destination: itinerary.destination,
      departDate: itinerary.departDate,
    });
  }
  
  return url;
}

/**
 * Broadcast status update to all interested parties
 */
async function broadcastStatusUpdate(
  sessionId: string,
  status: CompareSessionStatus,
  message?: string,
  progress?: number
): Promise<void> {
  const payload: StatusUpdatePayload = {
    status,
    message,
    progress,
  };
  
  // Send to all extension contexts
  chrome.runtime.sendMessage({
    type: 'VX_COMPARE_STATUS_UPDATE',
    sessionId,
    payload,
  }).catch(() => {
    // Ignore if no listeners
  });
}

/**
 * Complete the comparison and send results
 */
async function completeComparison(sessionId: string): Promise<void> {
  const session = await getCompareSession(sessionId);
  if (!session) return;
  
  // Calculate result
  const result = await calculateComparisonResult(session);
  
  if (result) {
    // Save result
    await saveComparisonResult(result);
    
    // Update session status
    await updateSessionStatus(sessionId, 'DONE', 'Comparison complete');
    
    // Broadcast result
    chrome.runtime.sendMessage({
      type: 'VX_COMPARE_RESULT',
      sessionId,
      payload: result,
    }).catch(() => {});
    
    console.log('[CompareController] Comparison complete:', result);
  } else {
    await updateSessionStatus(sessionId, 'FAILED', 'Could not calculate comparison');
  }
  
  // Cleanup
  cleanupSession(sessionId);
}

/**
 * Cleanup session tracking
 */
function cleanupSession(sessionId: string): void {
  const state = activeSessions.get(sessionId);
  if (state) {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    activeSessions.delete(sessionId);
  }
}

// ============================================
// MAIN FLOW HANDLERS
// ============================================

/**
 * Start a new comparison
 */
export async function startComparison(portalTabId: number): Promise<CompareSession> {
  // Get portal tab info
  const tab = await chrome.tabs.get(portalTabId);
  if (!tab.url) {
    throw new Error('Cannot get portal tab URL');
  }
  
  // Create session
  const session = await createCompareSession(portalTabId, tab.url);
  
  console.log('[CompareController] Started comparison:', session.id);
  
  // Initialize tracking state
  activeSessions.set(session.id, {
    timeoutId: null,
    directTabId: null,
  });
  
  // Broadcast initial status
  await broadcastStatusUpdate(session.id, 'INIT', 'Starting comparison...', 0);
  
  // Request portal capture
  await capturePortalPrice(session);
  
  return session;
}

/**
 * Capture portal price
 */
async function capturePortalPrice(session: CompareSession): Promise<void> {
  await broadcastStatusUpdate(session.id, 'INIT', 'Capturing portal price...', 10);
  
  try {
    // Set timeout for portal capture
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), PORTAL_CAPTURE_TIMEOUT);
    });
    
    // Request capture from content script
    const capturePromise = chrome.tabs.sendMessage(session.portalTabId, {
      type: 'VX_COMPARE_CAPTURE_PORTAL',
      sessionId: session.id,
    });
    
    const response = await Promise.race([capturePromise, timeoutPromise]);
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Portal capture failed');
    }
    
    // Portal snapshot will be received via message handler
    console.log('[CompareController] Portal capture requested');
    
  } catch (error) {
    console.error('[CompareController] Portal capture error:', error);
    await updateSessionStatus(
      session.id,
      'FAILED',
      'Could not capture portal price. Please try again.'
    );
    cleanupSession(session.id);
  }
}

/**
 * Handle portal captured event
 */
async function handlePortalCaptured(
  sessionId: string,
  payload: PortalCapturedPayload
): Promise<void> {
  const session = await getCompareSession(sessionId);
  if (!session) {
    console.error('[CompareController] Session not found:', sessionId);
    return;
  }
  
  // Update session with portal snapshot
  session.portalSnapshot = payload.portalSnapshot;
  session.status = 'PORTAL_CAPTURED';
  await saveCompareSession(session);
  
  await broadcastStatusUpdate(
    sessionId,
    'PORTAL_CAPTURED',
    `Captured: $${payload.portalSnapshot.totalPrice.amount.toFixed(2)}`,
    30
  );
  
  console.log('[CompareController] Portal captured:', payload.portalSnapshot);
  
  // Open direct tab
  await openDirectTab(session);
}

/**
 * Open the direct airline tab
 */
async function openDirectTab(session: CompareSession): Promise<void> {
  await broadcastStatusUpdate(session.id, 'PORTAL_CAPTURED', 'Opening direct site...', 40);
  
  try {
    const directUrl = buildDirectUrl(session);
    
    // Create new tab
    const tab = await chrome.tabs.create({
      url: directUrl,
      active: true,
    });
    
    if (!tab.id) {
      throw new Error('Could not create direct tab');
    }
    
    // Update session
    session.directTabId = tab.id;
    session.directUrl = sanitizeUrl(directUrl);
    session.status = 'DIRECT_OPENED';
    await saveCompareSession(session);
    
    // Track the tab
    const state = activeSessions.get(session.id);
    if (state) {
      state.directTabId = tab.id;
      
      // Set timeout for direct capture
      state.timeoutId = setTimeout(async () => {
        console.log('[CompareController] Direct capture timeout');
        await updateSessionStatus(
          session.id,
          'FAILED',
          'Timeout waiting for direct price. Enter manually?'
        );
        await broadcastStatusUpdate(
          session.id,
          'FAILED',
          'Could not detect direct price. Click to enter manually.',
          100
        );
      }, DIRECT_TAB_TIMEOUT);
    }
    
    // Wait for tab to load, then request capture
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        
        // Give page time to render
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id!, {
            type: 'VX_COMPARE_CAPTURE_DIRECT',
            sessionId: session.id,
          }).catch((err) => {
            console.log('[CompareController] Direct capture message failed:', err);
          });
        }, 2000);
      }
    });
    
    await broadcastStatusUpdate(
      session.id,
      'DIRECT_OPENED',
      'Looking for direct price...',
      50
    );
    
    console.log('[CompareController] Direct tab opened:', tab.id);
    
  } catch (error) {
    console.error('[CompareController] Error opening direct tab:', error);
    await updateSessionStatus(session.id, 'FAILED', 'Could not open direct site');
    cleanupSession(session.id);
  }
}

/**
 * Handle direct captured event
 */
async function handleDirectCaptured(
  sessionId: string,
  payload: DirectCapturedPayload
): Promise<void> {
  const session = await getCompareSession(sessionId);
  if (!session) {
    console.error('[CompareController] Session not found:', sessionId);
    return;
  }
  
  // Update session with direct snapshot
  session.directSnapshot = payload.directSnapshot;
  session.status = 'DIRECT_CAPTURED';
  await saveCompareSession(session);
  
  const priceAmount = payload.directSnapshot.totalPrice.amount;
  const currency = payload.directSnapshot.totalPrice.currency || 'USD';
  
  await broadcastStatusUpdate(
    sessionId,
    'DIRECT_CAPTURED',
    `Direct: ${currency} ${priceAmount.toFixed(2)}`,
    80
  );
  
  console.log('[CompareController] Direct captured:', payload.directSnapshot);
  
  // Notify the direct site helper that price was captured (with currency info for conversion)
  if (session.directTabId) {
    try {
      await chrome.tabs.sendMessage(session.directTabId, {
        type: 'VX_DIRECT_PRICE_CAPTURED',
        payload: {
          price: priceAmount,
          currency: currency,
          originalAmount: priceAmount,
          sessionId,
        },
      });
    } catch (e) {
      // Helper may not be present or tab may be closed
    }
  }
  
  // Complete the comparison
  await completeComparison(sessionId);
}

/**
 * Handle manual price entry
 */
async function handleManualPrice(
  sessionId: string,
  payload: ManualPricePayload
): Promise<void> {
  const session = await getCompareSession(sessionId);
  if (!session) return;
  
  session.manualPriceEntry = true;
  
  if (payload.isPortal) {
    // Manual portal price
    session.portalSnapshot = {
      bookingType: 'flight',
      totalPrice: {
        amount: payload.price,
        currency: payload.currency || 'USD',
        confidence: 'LOW',
        label: 'total',
        extractedAt: Date.now(),
        source: 'manual',
      },
      pageType: 'unknown',
      capturedAt: Date.now(),
    };
    session.status = 'PORTAL_CAPTURED';
    await saveCompareSession(session);
    
    // If we already have direct, complete
    if (session.directSnapshot) {
      await completeComparison(sessionId);
    } else {
      // Open direct tab
      await openDirectTab(session);
    }
  } else {
    // Manual direct price
    session.directSnapshot = {
      totalPrice: {
        amount: payload.price,
        currency: payload.currency || 'USD',
        confidence: 'LOW',
        label: 'total',
        extractedAt: Date.now(),
        source: 'manual',
      },
      siteName: 'Manual Entry',
      siteUrl: session.directUrl || '',
      pageType: 'unknown',
      capturedAt: Date.now(),
    };
    session.status = 'DIRECT_CAPTURED';
    await saveCompareSession(session);
    
    // Complete if we have portal
    if (session.portalSnapshot) {
      await completeComparison(sessionId);
    }
  }
}

/**
 * Cancel an active comparison
 */
async function cancelComparison(sessionId: string): Promise<void> {
  const session = await getCompareSession(sessionId);
  if (!session) return;
  
  session.status = 'CANCELLED';
  session.userCancelled = true;
  await saveCompareSession(session);
  
  // Close direct tab if open
  const state = activeSessions.get(sessionId);
  if (state?.directTabId) {
    try {
      await chrome.tabs.remove(state.directTabId);
    } catch (e) {
      // Tab may already be closed
    }
  }
  
  cleanupSession(sessionId);
  await clearActiveSessionId();
  
  await broadcastStatusUpdate(sessionId, 'CANCELLED', 'Comparison cancelled');
  
  console.log('[CompareController] Comparison cancelled:', sessionId);
}

// ============================================
// MESSAGE HANDLER
// ============================================

export function setupCompareMessageHandlers(): void {
  chrome.runtime.onMessage.addListener(
    (message: CompareMessage, sender, sendResponse) => {
      handleCompareMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    }
  );
  
  // Handle tab closure
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    // Check if this was a direct tab
    for (const [sessionId, state] of activeSessions.entries()) {
      if (state.directTabId === tabId) {
        const session = await getCompareSession(sessionId);
        if (session && session.status === 'DIRECT_OPENED') {
          // Direct tab was closed before capture
          await updateSessionStatus(
            sessionId,
            'FAILED',
            'Direct tab was closed before price capture'
          );
          cleanupSession(sessionId);
        }
        break;
      }
    }
  });
}

async function handleCompareMessage(
  message: CompareMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): Promise<void> {
  const { type, sessionId, payload } = message;
  
  try {
    switch (type) {
      case 'VX_COMPARE_START': {
        // Start new comparison from current tab
        const tabId = sender.tab?.id || (payload as { tabId?: number })?.tabId;
        if (!tabId) {
          sendResponse({ success: false, error: 'No tab ID' });
          return;
        }
        
        const session = await startComparison(tabId);
        sendResponse({ success: true, session });
        break;
      }
      
      case 'VX_COMPARE_PORTAL_CAPTURED': {
        if (sessionId && payload) {
          await handlePortalCaptured(sessionId, payload as PortalCapturedPayload);
          sendResponse({ success: true });
        }
        break;
      }
      
      case 'VX_COMPARE_DIRECT_CAPTURED': {
        if (sessionId && payload) {
          await handleDirectCaptured(sessionId, payload as DirectCapturedPayload);
          sendResponse({ success: true });
        }
        break;
      }
      
      case 'VX_COMPARE_MANUAL_PRICE': {
        if (sessionId && payload) {
          await handleManualPrice(sessionId, payload as ManualPricePayload);
          sendResponse({ success: true });
        }
        break;
      }
      
      case 'VX_COMPARE_CANCEL': {
        if (sessionId) {
          await cancelComparison(sessionId);
          sendResponse({ success: true });
        }
        break;
      }
      
      case 'VX_COMPARE_GET_SESSION': {
        if (sessionId) {
          const session = await getCompareSession(sessionId);
          sendResponse({ success: true, session });
        }
        break;
      }
      
      case 'VX_COMPARE_GET_ACTIVE': {
        const session = await getActiveSession();
        sendResponse({ success: true, session });
        break;
      }
      
      case 'VX_AUTO_COMPARE_START': {
        // Auto-compare from floating widget - portal snapshot already captured
        const autoPayload = payload as {
          portalSnapshot: PortalCapturedPayload['portalSnapshot'];
          portalUrl: string;
          directUrl: string;
          initiatedAt: number;
        };
        
        if (!autoPayload.portalSnapshot || !autoPayload.directUrl) {
          sendResponse({ success: false, error: 'Missing portal snapshot or direct URL' });
          return;
        }
        
        // Get current tab as portal tab
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!currentTab?.id) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        
        // Create session with portal data already populated
        const autoSession = await createCompareSession(currentTab.id, autoPayload.portalUrl);
        autoSession.portalSnapshot = autoPayload.portalSnapshot;
        autoSession.status = 'PORTAL_CAPTURED';
        await saveCompareSession(autoSession);
        
        activeSessions.set(autoSession.id, {
          timeoutId: null,
          directTabId: null,
        });
        
        await broadcastStatusUpdate(
          autoSession.id,
          'PORTAL_CAPTURED',
          `Portal: $${autoPayload.portalSnapshot.totalPrice.amount.toFixed(2)}`,
          30
        );
        
        // Open the pre-built direct URL
        try {
          const directTab = await chrome.tabs.create({
            url: autoPayload.directUrl,
            active: true,
          });
          
          if (!directTab.id) {
            throw new Error('Could not create direct tab');
          }
          
          autoSession.directTabId = directTab.id;
          autoSession.directUrl = sanitizeUrl(autoPayload.directUrl);
          autoSession.status = 'DIRECT_OPENED';
          await saveCompareSession(autoSession);
          
          const state = activeSessions.get(autoSession.id);
          if (state) {
            state.directTabId = directTab.id;
            
            // Set timeout for direct capture
            state.timeoutId = setTimeout(async () => {
              console.log('[CompareController] Auto-compare direct capture timeout');
              await updateSessionStatus(
                autoSession.id,
                'FAILED',
                'Timeout waiting for direct price. Enter manually?'
              );
              await broadcastStatusUpdate(
                autoSession.id,
                'FAILED',
                'Could not detect direct price. Click to enter manually.',
                100
              );
            }, DIRECT_TAB_TIMEOUT);
          }
          
          // Listen for tab load and request capture
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === directTab.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              
              // Give page time to render
              setTimeout(() => {
                // First, show the helper with trip info
                chrome.tabs.sendMessage(directTab.id!, {
                  type: 'VX_SHOW_DIRECT_HELPER',
                  payload: {
                    tripInfo: autoPayload.portalSnapshot,
                    portalPrice: autoPayload.portalSnapshot.totalPrice.amount,
                    sessionId: autoSession.id,
                  },
                }).catch((err) => {
                  console.log('[CompareController] Show helper message failed:', err);
                });
                
                // Then request direct capture with portal snapshot for trip context
                chrome.tabs.sendMessage(directTab.id!, {
                  type: 'VX_COMPARE_CAPTURE_DIRECT',
                  sessionId: autoSession.id,
                  portalSnapshot: autoPayload.portalSnapshot, // Pass trip context
                }).catch((err) => {
                  console.log('[CompareController] Direct capture message failed:', err);
                });
              }, 2000); // Wait for airline sites
            }
          });
          
          await broadcastStatusUpdate(
            autoSession.id,
            'DIRECT_OPENED',
            'Looking for direct price...',
            50
          );
          
          sendResponse({ success: true, session: autoSession });
          
        } catch (err) {
          console.error('[CompareController] Auto-compare error:', err);
          await updateSessionStatus(autoSession.id, 'FAILED', 'Could not open direct site');
          cleanupSession(autoSession.id);
          sendResponse({ success: false, error: String(err) });
        }
        break;
      }
      
      case 'VX_TRIP_DETECTED': {
        // Trip detected notification - just log for now
        console.log('[CompareController] Trip detected:', payload);
        sendResponse({ success: true });
        break;
      }
      
      case 'VX_COMPARE_CLEAR_HISTORY': {
        await clearCompareSessions();
        sendResponse({ success: true });
        break;
      }
      
      case 'VX_COMPARE_STATUS_UPDATE': {
        // Just forward to any listeners
        sendResponse({ success: true });
        break;
      }
      
      case 'VX_GET_CURRENT_TAB_ID': {
        // Return the sender's tab ID
        const tabId = sender.tab?.id || null;
        sendResponse({ success: true, tabId });
        break;
      }
      
      case 'VX_RETURN_TO_PORTAL': {
        // Return to portal tab with comparison results
        const returnPayload = payload as {
          portalTabId: number | null;
          portalUrl: string | null;
          comparisonData: unknown;
        };
        
        try {
          // Try to focus the portal tab
          if (returnPayload.portalTabId) {
            try {
              await chrome.tabs.update(returnPayload.portalTabId, { active: true });
              // Also focus the window containing the tab
              const tab = await chrome.tabs.get(returnPayload.portalTabId);
              if (tab.windowId) {
                await chrome.windows.update(tab.windowId, { focused: true });
              }
            } catch (e) {
              // Tab may have been closed, try to find by URL
              console.log('[CompareController] Portal tab not found by ID, searching by URL');
              if (returnPayload.portalUrl) {
                const tabs = await chrome.tabs.query({ url: '*://travel.capitalone.com/*' });
                if (tabs.length > 0 && tabs[0].id) {
                  await chrome.tabs.update(tabs[0].id, { active: true });
                  if (tabs[0].windowId) {
                    await chrome.windows.update(tabs[0].windowId, { focused: true });
                  }
                }
              }
            }
          }
          
          // Store comparison result for portal to display
          if (returnPayload.comparisonData) {
            await chrome.storage.local.set({
              vx_comparison_result: returnPayload.comparisonData
            });
          }
          
          // Close the sender tab (direct site)
          if (sender.tab?.id) {
            try {
              await chrome.tabs.remove(sender.tab.id);
            } catch (e) {
              // Tab may already be closed
            }
          }
          
          sendResponse({ success: true });
        } catch (e) {
          console.error('[CompareController] Error returning to portal:', e);
          sendResponse({ success: false, error: String(e) });
        }
        break;
      }
      
      case 'VX_DIRECT_HELPER_CLOSED': {
        // Helper was closed by user, cancel the comparison
        if (sessionId) {
          await cancelComparison(sessionId);
        }
        // Clear pending comparison
        await chrome.storage.local.remove('vx_pending_comparison');
        sendResponse({ success: true });
        break;
      }
      
      default:
        // Not a compare message, ignore
        break;
    }
  } catch (error) {
    console.error('[CompareController] Message handler error:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

// Initialize
setupCompareMessageHandlers();
console.log('[CompareController] Initialized');
