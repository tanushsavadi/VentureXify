// ============================================
// COMPARE SESSION STORAGE
// ============================================

import {
  CompareSession,
  ComparisonResult,
  createEmptySession,
} from './compareTypes';

const STORAGE_KEY_SESSIONS = 'compareSessions';
const STORAGE_KEY_RESULTS = 'compareResults';
const STORAGE_KEY_ACTIVE = 'activeCompareSessionId';
const MAX_SESSIONS = 30; // Ring buffer size

// ============================================
// SESSION STORAGE
// ============================================

/**
 * Get all compare sessions
 */
export async function getCompareSessions(): Promise<CompareSession[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_SESSIONS);
    return result[STORAGE_KEY_SESSIONS] || [];
  } catch (error) {
    console.error('[CompareStorage] Error getting sessions:', error);
    return [];
  }
}

/**
 * Get a specific session by ID
 */
export async function getCompareSession(sessionId: string): Promise<CompareSession | null> {
  const sessions = await getCompareSessions();
  return sessions.find((s) => s.id === sessionId) || null;
}

/**
 * Save a compare session (creates or updates)
 */
export async function saveCompareSession(session: CompareSession): Promise<void> {
  try {
    const sessions = await getCompareSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    
    // Update updatedAt timestamp
    session.updatedAt = Date.now();
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      // Add new session at the beginning
      sessions.unshift(session);
    }
    
    // Enforce ring buffer limit
    const trimmedSessions = sessions.slice(0, MAX_SESSIONS);
    
    await chrome.storage.local.set({ [STORAGE_KEY_SESSIONS]: trimmedSessions });
  } catch (error) {
    console.error('[CompareStorage] Error saving session:', error);
    throw error;
  }
}

/**
 * Create a new compare session
 */
export async function createCompareSession(
  portalTabId: number,
  portalUrl: string
): Promise<CompareSession> {
  const session = createEmptySession(portalTabId, portalUrl);
  await saveCompareSession(session);
  await setActiveSessionId(session.id);
  return session;
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: CompareSession['status'],
  message?: string,
  failureReason?: string
): Promise<CompareSession | null> {
  const session = await getCompareSession(sessionId);
  if (!session) return null;
  
  session.status = status;
  if (message) session.statusMessage = message;
  if (failureReason) session.failureReason = failureReason;
  
  await saveCompareSession(session);
  return session;
}

/**
 * Delete a compare session
 */
export async function deleteCompareSession(sessionId: string): Promise<void> {
  try {
    const sessions = await getCompareSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    await chrome.storage.local.set({ [STORAGE_KEY_SESSIONS]: filtered });
    
    // Also delete associated result
    await deleteComparisonResult(sessionId);
    
    // Clear active session if it was the deleted one
    const activeId = await getActiveSessionId();
    if (activeId === sessionId) {
      await clearActiveSessionId();
    }
  } catch (error) {
    console.error('[CompareStorage] Error deleting session:', error);
    throw error;
  }
}

/**
 * Clear all sessions
 */
export async function clearCompareSessions(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      STORAGE_KEY_SESSIONS,
      STORAGE_KEY_RESULTS,
      STORAGE_KEY_ACTIVE,
    ]);
  } catch (error) {
    console.error('[CompareStorage] Error clearing sessions:', error);
    throw error;
  }
}

// ============================================
// ACTIVE SESSION TRACKING
// ============================================

/**
 * Get the currently active session ID
 */
export async function getActiveSessionId(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_ACTIVE);
    return result[STORAGE_KEY_ACTIVE] || null;
  } catch (error) {
    console.error('[CompareStorage] Error getting active session:', error);
    return null;
  }
}

/**
 * Set the active session ID
 */
export async function setActiveSessionId(sessionId: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY_ACTIVE]: sessionId });
  } catch (error) {
    console.error('[CompareStorage] Error setting active session:', error);
    throw error;
  }
}

/**
 * Clear the active session ID
 */
export async function clearActiveSessionId(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY_ACTIVE);
  } catch (error) {
    console.error('[CompareStorage] Error clearing active session:', error);
    throw error;
  }
}

/**
 * Get the currently active session
 */
export async function getActiveSession(): Promise<CompareSession | null> {
  const activeId = await getActiveSessionId();
  if (!activeId) return null;
  return getCompareSession(activeId);
}

// ============================================
// COMPARISON RESULTS STORAGE
// ============================================

/**
 * Get all comparison results
 */
export async function getComparisonResults(): Promise<ComparisonResult[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_RESULTS);
    return result[STORAGE_KEY_RESULTS] || [];
  } catch (error) {
    console.error('[CompareStorage] Error getting results:', error);
    return [];
  }
}

/**
 * Get a specific comparison result by session ID
 */
export async function getComparisonResult(sessionId: string): Promise<ComparisonResult | null> {
  const results = await getComparisonResults();
  return results.find((r) => r.sessionId === sessionId) || null;
}

/**
 * Save a comparison result
 */
export async function saveComparisonResult(result: ComparisonResult): Promise<void> {
  try {
    const results = await getComparisonResults();
    const existingIndex = results.findIndex((r) => r.sessionId === result.sessionId);
    
    if (existingIndex >= 0) {
      results[existingIndex] = result;
    } else {
      results.unshift(result);
    }
    
    // Enforce ring buffer limit
    const trimmedResults = results.slice(0, MAX_SESSIONS);
    
    await chrome.storage.local.set({ [STORAGE_KEY_RESULTS]: trimmedResults });
  } catch (error) {
    console.error('[CompareStorage] Error saving result:', error);
    throw error;
  }
}

/**
 * Delete a comparison result
 */
export async function deleteComparisonResult(sessionId: string): Promise<void> {
  try {
    const results = await getComparisonResults();
    const filtered = results.filter((r) => r.sessionId !== sessionId);
    await chrome.storage.local.set({ [STORAGE_KEY_RESULTS]: filtered });
  } catch (error) {
    console.error('[CompareStorage] Error deleting result:', error);
    throw error;
  }
}

// ============================================
// RECENT COMPARISONS
// ============================================

/**
 * Get recent completed comparisons (for history display)
 */
export async function getRecentComparisons(limit: number = 10): Promise<{
  session: CompareSession;
  result: ComparisonResult | null;
}[]> {
  const sessions = await getCompareSessions();
  const results = await getComparisonResults();
  
  // Filter to completed sessions
  const completedSessions = sessions.filter(
    (s) => s.status === 'DONE' || s.status === 'FAILED'
  );
  
  // Map to include results
  const comparisons = completedSessions.slice(0, limit).map((session) => ({
    session,
    result: results.find((r) => r.sessionId === session.id) || null,
  }));
  
  return comparisons;
}

// ============================================
// SESSION STATE CHANGE LISTENERS
// ============================================

type SessionChangeCallback = (session: CompareSession | null) => void;
const sessionChangeListeners: SessionChangeCallback[] = [];

/**
 * Subscribe to active session changes
 */
export function onActiveSessionChange(callback: SessionChangeCallback): () => void {
  sessionChangeListeners.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = sessionChangeListeners.indexOf(callback);
    if (index > -1) {
      sessionChangeListeners.splice(index, 1);
    }
  };
}

/**
 * Notify listeners of session change
 */
export function notifySessionChange(session: CompareSession | null): void {
  sessionChangeListeners.forEach((callback) => {
    try {
      callback(session);
    } catch (error) {
      console.error('[CompareStorage] Error in session change callback:', error);
    }
  });
}

// Listen for storage changes
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes[STORAGE_KEY_ACTIVE]) {
        const newSessionId = changes[STORAGE_KEY_ACTIVE].newValue;
        if (newSessionId) {
          getCompareSession(newSessionId).then((session) => {
            notifySessionChange(session);
          });
        } else {
          notifySessionChange(null);
        }
      } else if (changes[STORAGE_KEY_SESSIONS]) {
        // Session was updated, notify if it's the active one
        getActiveSession().then((session) => {
          if (session) {
            notifySessionChange(session);
          }
        });
      }
    }
  });
}
