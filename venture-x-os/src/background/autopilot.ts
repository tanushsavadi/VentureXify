// ============================================
// AUTOPILOT BACKGROUND SERVICE WORKER
// Orchestrates page analysis and tip delivery
// ============================================

import {
  type PageData,
  type AutopilotTip,
  type UserFinancialContext,
  type StrategyAnalysis,
  runAutopilot,
  generateFallbackTip,
  analyzeStrategies
} from '../lib/autopilot';

// Import compare controller for Capture & Compare feature
import './compareController';

// Import currency converter for live exchange rates
import { initCurrencyConverter } from '../lib/currencyConverter';

// Import knowledge base updater for automatic silent updates
import { updateKnowledgeBase, getKnowledgeStatus } from '../knowledge/main';

// ============================================
// CONSTANTS
// ============================================

const KB_UPDATE_ALARM_NAME = 'venturexify-kb-update';
const KB_UPDATE_INTERVAL_DAYS = 7; // Update weekly

// ============================================
// STATE
// ============================================

interface AutopilotState {
  enabled: boolean;
  userContext: UserFinancialContext;
  tipHistory: AutopilotTip[];
  currentTip: AutopilotTip | null;
  strategyAnalysis: StrategyAnalysis | null;
  lastAnalysis: number;
  analysisCount: number;
}

const state: AutopilotState = {
  enabled: true,
  userContext: {
    milesBalance: null,
    travelCredits: null,
    annualFeeDate: null,
    eraserEligibleTransactions: [],
    recentBookings: [],
  },
  tipHistory: [],
  currentTip: null,
  strategyAnalysis: null,
  lastAnalysis: 0,
  analysisCount: 0,
};

// Cooldown to prevent too many analyses
const ANALYSIS_COOLDOWN = 10000; // 10 seconds
const MAX_TIPS_PER_PAGE = 3;

// ============================================
// INITIALIZATION
// ============================================

async function initializeState(): Promise<void> {
  // Load saved settings
  const result = await chrome.storage.sync.get([
    'autopilotEnabled',
    'userContext',
  ]);
  
  state.enabled = result.autopilotEnabled !== false;
  
  // Load local data
  const localData = await chrome.storage.local.get([
    'tipHistory',
    'eraserQueue',
    'userFinancialContext',
  ]);
  
  state.tipHistory = localData.tipHistory || [];
  
  // Build user context from stored data
  if (localData.userFinancialContext) {
    state.userContext = localData.userFinancialContext;
  }
  
  if (localData.eraserQueue) {
    state.userContext.eraserEligibleTransactions = localData.eraserQueue
      .filter((item: { status: string; expiryDate: number }) => 
        item.status === 'pending' && item.expiryDate > Date.now()
      )
      .map((item: { merchant: string; amount: number; purchaseDate: number; expiryDate: number }) => ({
        merchant: item.merchant,
        amount: item.amount,
        date: new Date(item.purchaseDate).toISOString().split('T')[0],
        daysLeft: Math.ceil((item.expiryDate - Date.now()) / (1000 * 60 * 60 * 24)),
      }));
  }
  
  console.log('[Autopilot] Initialized:', { enabled: state.enabled });
}

// Initialize on load
initializeState();

// Initialize currency converter with live exchange rates
initCurrencyConverter().catch(e => {
  console.log('[Autopilot] Currency converter init failed:', e);
});

// ============================================
// PAGE ANALYSIS HANDLER
// ============================================

async function handlePageContextUpdate(pageData: PageData, tabId: number): Promise<void> {
  console.log('[Autopilot BG] ====== handlePageContextUpdate ======');
  console.log('[Autopilot BG] Tab ID:', tabId);
  console.log('[Autopilot BG] Page context:', pageData.context);
  console.log('[Autopilot BG] Total price:', pageData.totalPrice);
  console.log('[Autopilot BG] Is portal:', pageData.isPortal);
  console.log('[Autopilot BG] Miles visible:', pageData.milesVisible);
  console.log('[Autopilot BG] Enabled:', state.enabled);
  
  if (!state.enabled) {
    console.log('[Autopilot BG] Autopilot disabled, skipping...');
    return;
  }
  
  // Cooldown check
  const now = Date.now();
  if (now - state.lastAnalysis < ANALYSIS_COOLDOWN) {
    console.log('[Autopilot BG] Cooldown active, skipping... (last analysis', now - state.lastAnalysis, 'ms ago)');
    return;
  }
  state.lastAnalysis = now;
  
  // Check if we've shown enough tips for this URL
  const tipsForPage = state.tipHistory.filter(t => t.pageUrl === pageData.url);
  if (tipsForPage.length >= MAX_TIPS_PER_PAGE) {
    console.log('[Autopilot BG] Max tips shown for this page, skipping...');
    return;
  }
  
  console.log('[Autopilot BG] Proceeding with analysis...');
  
  try {
    // Always run strategy analysis for checkout pages
    if (pageData.context === 'checkout') {
      const strategies = analyzeStrategies(pageData, state.userContext);
      if (strategies) {
        state.strategyAnalysis = strategies;
        console.log('[Autopilot] Strategies computed:', strategies.strategies.length);
        
        // Save to storage
        await chrome.storage.local.set({
          strategyAnalysis: strategies,
        });
        
        // Send strategy update to side panel
        chrome.runtime.sendMessage({
          type: 'STRATEGY_UPDATE',
          payload: { strategies }
        }).catch(() => {});
      }
    }
    
    // Generate tip using deterministic strategy engine
    const tip = await runAutopilot(pageData, state.userContext);
    
    if (tip) {
      // Check if we've already shown this type of tip recently
      const recentSimilar = state.tipHistory.find(
        t => t.title === tip.title &&
        t.pageUrl === pageData.url &&
        now - t.timestamp < 60000 * 5 // 5 minutes
      );
      
      if (recentSimilar) {
        console.log('[Autopilot] Skipping similar recent tip');
        return;
      }
      
      // Store tip
      state.currentTip = tip;
      state.tipHistory.push(tip);
      
      // Save to storage
      await chrome.storage.local.set({
        tipHistory: state.tipHistory.slice(-100), // Keep last 100
        currentTip: tip,
      });
      
      // Send tip to content script
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_TIP',
        payload: { tip }
      }).catch(() => {
        // Tab may have closed
      });
      
      console.log('[Autopilot] Showing tip:', tip.title);
    }
  } catch (error) {
    console.error('[Autopilot] Analysis error:', error);
    
    // Fallback to rule-based
    const fallbackTip = generateFallbackTip(pageData, state.userContext);
    if (fallbackTip) {
      state.currentTip = fallbackTip;
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_TIP',
        payload: { tip: fallbackTip }
      }).catch(() => {});
    }
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      // ============================================
      // NEW CHAT FLOW MESSAGES
      // ============================================
      
      case 'PORTAL_CAPTURE':
        // Store portal snapshot for comparison
        if (message.payload?.snapshot) {
          await chrome.storage.local.set({
            vx_portal_snapshot: message.payload.snapshot,
            vx_portal_capture_time: Date.now(),
          });
          // Forward to side panel
          chrome.runtime.sendMessage({
            type: 'FLOW_STATE_UPDATE',
            payload: {
              state: 'PORTAL_CAPTURED',
              portalSnapshot: message.payload.snapshot,
            }
          }).catch(() => {});
          console.log('[Autopilot BG] Portal snapshot stored');
        }
        sendResponse({ success: true });
        break;
        
      case 'DIRECT_CAPTURE':
        // Store direct snapshot for comparison
        if (message.payload?.snapshot) {
          await chrome.storage.local.set({
            vx_direct_snapshot: message.payload.snapshot,
            vx_direct_capture_time: Date.now(),
          });
          // Forward to side panel
          chrome.runtime.sendMessage({
            type: 'FLOW_STATE_UPDATE',
            payload: {
              state: 'DIRECT_CAPTURED',
              directSnapshot: message.payload.snapshot,
            }
          }).catch(() => {});
          console.log('[Autopilot BG] Direct snapshot stored');
        }
        sendResponse({ success: true });
        break;
        
      case 'PAGE_CONTEXT':
        // Store current page context
        if (message.payload) {
          await chrome.storage.local.set({
            vx_page_context: message.payload,
          });
          // Forward to side panel
          chrome.runtime.sendMessage({
            type: 'PAGE_CONTEXT_UPDATE',
            payload: message.payload,
          }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
        
      case 'VX_OPEN_SIDE_PANEL':
      case 'OPEN_SIDE_PANEL':
      case 'OPEN_SIDE_PANEL_WITH_TIP':
        if (sender.tab?.id) {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
        } else {
          // Try to open on active tab
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await chrome.sidePanel.open({ tabId: tab.id });
          }
        }
        sendResponse({ success: true });
        break;
        
      case 'OPEN_GOOGLE_FLIGHTS_PREFILL':
        // Build Google Flights URL and open
        const { origin, destination, departDate, returnDate } = message.payload || {};
        let searchQuery = `flights from ${origin || 'NYC'} to ${destination || 'LAX'}`;
        if (departDate) searchQuery += ` on ${departDate}`;
        if (returnDate) searchQuery += ` returning ${returnDate}`;
        const gfUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}`;
        await chrome.tabs.create({ url: gfUrl });
        sendResponse({ success: true });
        break;
        
      case 'GET_FLOW_STATE':
        // Return current flow state from storage
        const flowData = await chrome.storage.local.get([
          'vx_portal_snapshot',
          'vx_direct_snapshot',
          'vx_page_context',
          'vx_portal_capture_time',
          'vx_direct_capture_time',
        ]);
        sendResponse({
          portalSnapshot: flowData.vx_portal_snapshot,
          directSnapshot: flowData.vx_direct_snapshot,
          pageContext: flowData.vx_page_context,
        });
        break;
        
      case 'RESET_FLOW':
        // Clear flow state
        await chrome.storage.local.remove([
          'vx_portal_snapshot',
          'vx_direct_snapshot',
          'vx_page_context',
          'vx_portal_capture_time',
          'vx_direct_capture_time',
          'vx_comparison_result',
        ]);
        sendResponse({ success: true });
        break;
      
      // ============================================
      // STAYS (HOTELS) MESSAGES - Store to local storage
      // ============================================
      
      case 'VX_STAY_PORTAL_CAPTURED':
        // Store stay capture - this is the critical path for side panel updates
        if (message.payload?.stayCapture) {
          console.log('[Autopilot BG] 🏨 Storing stay portal capture:', message.payload.stayCapture?.property?.propertyName);
          await chrome.storage.local.set({
            vx_stay_portal_snapshot: message.payload.stayCapture,
            vx_stay_capture_timestamp: Date.now(),
          });
          // Clear any old flight data to avoid confusion
          await chrome.storage.local.remove(['vx_portal_snapshot', 'vx_direct_snapshot']);
          // Forward to any open UI (side panel will pick up from storage.onChanged)
          chrome.runtime.sendMessage({
            type: 'STAY_PORTAL_CAPTURED',
            payload: { stayCapture: message.payload.stayCapture, bookingType: 'stay' }
          }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
        
      case 'VX_STAY_DIRECT_CAPTURED':
        // Store stay direct capture
        if (message.payload?.directCapture) {
          console.log('[Autopilot BG] 🏨 Storing stay direct capture:', message.payload.directCapture?.totalPrice?.amount);
          await chrome.storage.local.set({
            vx_stay_direct_snapshot: message.payload.directCapture,
            vx_stay_direct_capture_timestamp: Date.now(),
          });
          // Forward to UI
          chrome.runtime.sendMessage({
            type: 'STAY_DIRECT_CAPTURED',
            payload: { directCapture: message.payload.directCapture, bookingType: 'stay' }
          }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      
      // ============================================
      // LEGACY MESSAGES (keep for compatibility)
      // ============================================
      
      case 'PAGE_CONTEXT_UPDATE':
        if (sender.tab?.id && message.payload?.pageData) {
          await handlePageContextUpdate(message.payload.pageData, sender.tab.id);
        }
        sendResponse({ success: true });
        break;
        
      case 'GET_AUTOPILOT_STATE':
        sendResponse({
          enabled: state.enabled,
          tipHistory: state.tipHistory.slice(-20),
          currentTip: state.currentTip,
          userContext: state.userContext,
          strategyAnalysis: state.strategyAnalysis,
        });
        break;
        
      case 'TOGGLE_AUTOPILOT':
        state.enabled = message.payload?.enabled ?? !state.enabled;
        await chrome.storage.sync.set({ autopilotEnabled: state.enabled });
        sendResponse({ enabled: state.enabled });
        break;
        
      case 'UPDATE_USER_CONTEXT':
        state.userContext = { ...state.userContext, ...message.payload };
        await chrome.storage.local.set({ userFinancialContext: state.userContext });
        sendResponse({ success: true });
        break;
        
      case 'TIP_DISMISSED':
        const tipId = message.payload?.tipId;
        const tip = state.tipHistory.find(t => t.id === tipId);
        if (tip) {
          tip.dismissed = true;
        }
        sendResponse({ success: true });
        break;
        
      case 'TIP_ACTED_ON':
        const actedTipId = message.payload?.tipId;
        const actedTip = state.tipHistory.find(t => t.id === actedTipId);
        if (actedTip) {
          actedTip.actedOn = true;
        }
        sendResponse({ success: true });
        break;
        
      case 'CLEAR_TIP_HISTORY':
        state.tipHistory = [];
        await chrome.storage.local.set({ tipHistory: [] });
        sendResponse({ success: true });
        break;
        
      default:
        // Let compareController handle other messages
        sendResponse({ handled: false });
    }
  })();
  return true;
});

// ============================================
// EXTENSION ICON CLICK - OPEN SIDE PANEL
// ============================================

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ============================================
// AUTOMATIC KNOWLEDGE BASE UPDATES (Silent)
// ============================================

async function runSilentKBUpdate(): Promise<void> {
  console.log('[VentureXify] Starting silent knowledge base update...');
  
  try {
    // Check if we need to update (last update > 7 days ago)
    const status = await getKnowledgeStatus();
    const now = Date.now();
    const lastUpdate = status.lastUpdated ? status.lastUpdated.getTime() : 0;
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < KB_UPDATE_INTERVAL_DAYS && status.localDocuments > 0) {
      console.log(`[VentureXify] KB is recent (${daysSinceUpdate.toFixed(1)} days old), skipping update`);
      return;
    }
    
    // Run silent update
    const result = await updateKnowledgeBase({
      includeReddit: true,
      includeCapitalOne: true,
      forceRefresh: false, // Only update if needed
    });
    
    if (result.success) {
      console.log(`[VentureXify] KB updated silently: ${result.documentCount} documents`);
      await chrome.storage.local.set({
        vx_kb_last_silent_update: now,
        vx_kb_document_count: result.documentCount,
      });
    } else {
      console.log('[VentureXify] KB update failed silently:', result.error);
    }
  } catch (error) {
    // Fail silently - don't interrupt user experience
    console.log('[VentureXify] Silent KB update error:', error);
  }
}

// ============================================
// CONTEXT MENU & INSTALL HANDLER
// ============================================

chrome.runtime.onInstalled.addListener(async (details) => {
  // Create context menus
  chrome.contextMenus.create({
    id: 'vxos-analyze',
    title: 'Analyze this page with VentureXify',
    contexts: ['page'],
  });
  
  chrome.contextMenus.create({
    id: 'vxos-toggle-autopilot',
    title: 'Toggle Autopilot',
    contexts: ['action'],
  });
  
  // On install or update: run silent KB update and set up alarm
  if (details.reason === 'install' || details.reason === 'update') {
    console.log(`[VentureXify] Extension ${details.reason}ed - setting up auto KB updates`);
    
    // Set up weekly alarm for KB updates
    await chrome.alarms.create(KB_UPDATE_ALARM_NAME, {
      delayInMinutes: 60, // First update 1 hour after install
      periodInMinutes: KB_UPDATE_INTERVAL_DAYS * 24 * 60, // Weekly
    });
    
    // Run initial update after a short delay (don't block install)
    setTimeout(() => {
      runSilentKBUpdate();
    }, 30000); // 30 seconds after install
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'vxos-analyze' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'FORCE_ANALYZE' });
  }
  
  if (info.menuItemId === 'vxos-toggle-autopilot') {
    state.enabled = !state.enabled;
    await chrome.storage.sync.set({ autopilotEnabled: state.enabled });
    
    // Update badge
    chrome.action.setBadgeText({ text: state.enabled ? '' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
});

// ============================================
// ALARMS FOR REMINDERS & KB UPDATES
// ============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Knowledge base auto-update alarm
  if (alarm.name === KB_UPDATE_ALARM_NAME) {
    console.log('[VentureXify] Weekly KB update alarm triggered');
    await runSilentKBUpdate();
    return;
  }
  
  // Eraser reminders
  if (alarm.name.startsWith('eraser-reminder-')) {
    const itemId = alarm.name.replace('eraser-reminder-', '');
    const data = await chrome.storage.local.get('eraserQueue');
    const item = data.eraserQueue?.find((i: { id: string }) => i.id === itemId);
    
    if (item && item.status === 'pending') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Travel Eraser Reminder',
        message: `${item.merchant} - $${item.amount} is expiring soon! Use Travel Eraser to redeem miles.`,
        priority: 2,
      });
    }
  }
});

// ============================================
// SIDE PANEL CONFIGURATION
// ============================================

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

export {};
