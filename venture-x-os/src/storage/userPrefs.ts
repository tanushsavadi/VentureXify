/**
 * User Preferences Storage Module
 *
 * Manages onboarding state and user preferences for VentureXify.
 * Stores to chrome.storage.sync with fallback to localStorage.
 * 
 * This is the single source of truth for:
 * - Credit remaining (no longer hardcoded!)
 * - Default decision mode (Cheapest/Max Value/Easiest)
 * - Miles balance and valuation
 * - PointsYeah toggle
 */

// ============================================
// TYPES
// ============================================

export type DefaultMode = 'cheapest' | 'max_value' | 'easiest';

export type PortalMilesBasis = 'sticker' | 'post_credit' | 'range';

export type DefaultOpenTab = 'auto' | 'chat' | 'compare';

export interface UserPrefs {
  // Onboarding state
  onboardingCompleted: boolean;
  onboardingVersion: number;

  // Step 1: Credit status (most important!)
  creditRemaining: number;           // 0-300, no longer hardcoded!
  creditAlreadyUsed: boolean;        // derived: creditRemaining < 300

  // Step 2: Decision style
  defaultMode: DefaultMode;
  wantsLowHassle: boolean;

  // Step 3: Miles preferences
  milesBalance?: number;             // Optional, >= 0
  mileValuationCpp: number;          // 0.005-0.05 (0.5¢ to 5¢)
  customMileValuation: boolean;      // Whether user set their own valuation

  // Step 4: PointsYeah / Award Search
  enableAwardSearch: boolean;
  autoPrefillPointsYeah: boolean;

  // UI Preferences
  defaultOpenTab: DefaultOpenTab;    // 'auto' | 'chat' | 'compare'

  // Advanced settings (collapsed by default)
  showConfidenceLabels: boolean;
  showWhatCouldChange: boolean;
  assumeDirectIsAirline: boolean;
  portalMilesBasis: PortalMilesBasis;
  pricePremiumThreshold: number;     // Default 0.07 (7%)
}

// ============================================
// DEFAULTS
// ============================================

export const DEFAULT_USER_PREFS: UserPrefs = {
  // Onboarding
  onboardingCompleted: false,
  onboardingVersion: 1,

  // Credit - NOW USER-CONFIGURABLE!
  creditRemaining: 300,
  creditAlreadyUsed: false,

  // Mode - Default to max_value for best card optimization
  defaultMode: 'max_value',
  wantsLowHassle: false,

  // Miles
  milesBalance: undefined,
  mileValuationCpp: 0.018,  // 1.8¢ conservative default
  customMileValuation: false,

  // PointsYeah
  enableAwardSearch: false,
  autoPrefillPointsYeah: true,

  // UI Preferences
  defaultOpenTab: 'auto',  // Auto-select based on page context

  // Advanced
  showConfidenceLabels: true,
  showWhatCouldChange: true,
  assumeDirectIsAirline: false,
  portalMilesBasis: 'range',
  pricePremiumThreshold: 0.07,
};

export const CURRENT_ONBOARDING_VERSION = 1;

// ============================================
// STORAGE KEY
// ============================================

const STORAGE_KEY = 'vx_user_prefs';

// ============================================
// VALIDATION HELPERS
// ============================================

export function clampCreditRemaining(value: number): number {
  return Math.max(0, Math.min(300, Math.round(value)));
}

export function clampMileValuation(value: number): number {
  return Math.max(0.005, Math.min(0.05, value));
}

export function clampMilesBalance(value: number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  return Math.max(0, Math.round(value));
}

export function clampPremiumThreshold(value: number): number {
  return Math.max(0, Math.min(0.5, value));
}

/**
 * Validate and sanitize user prefs
 */
export function sanitizePrefs(prefs: Partial<UserPrefs>): UserPrefs {
  const base = { ...DEFAULT_USER_PREFS };
  
  // Apply provided values with validation
  if (typeof prefs.onboardingCompleted === 'boolean') {
    base.onboardingCompleted = prefs.onboardingCompleted;
  }
  if (typeof prefs.onboardingVersion === 'number') {
    base.onboardingVersion = prefs.onboardingVersion;
  }
  
  if (typeof prefs.creditRemaining === 'number') {
    base.creditRemaining = clampCreditRemaining(prefs.creditRemaining);
  }
  base.creditAlreadyUsed = base.creditRemaining < 300;
  
  if (prefs.defaultMode && ['cheapest', 'max_value', 'easiest'].includes(prefs.defaultMode)) {
    base.defaultMode = prefs.defaultMode;
  }
  if (typeof prefs.wantsLowHassle === 'boolean') {
    base.wantsLowHassle = prefs.wantsLowHassle;
  }
  
  if (prefs.milesBalance !== undefined) {
    base.milesBalance = clampMilesBalance(prefs.milesBalance);
  }
  if (typeof prefs.mileValuationCpp === 'number') {
    base.mileValuationCpp = clampMileValuation(prefs.mileValuationCpp);
  }
  if (typeof prefs.customMileValuation === 'boolean') {
    base.customMileValuation = prefs.customMileValuation;
  }
  
  if (typeof prefs.enableAwardSearch === 'boolean') {
    base.enableAwardSearch = prefs.enableAwardSearch;
  }
  if (typeof prefs.autoPrefillPointsYeah === 'boolean') {
    base.autoPrefillPointsYeah = prefs.autoPrefillPointsYeah;
  }
  
  // UI Preferences
  if (prefs.defaultOpenTab && ['auto', 'chat', 'compare'].includes(prefs.defaultOpenTab)) {
    base.defaultOpenTab = prefs.defaultOpenTab;
  }

  // Advanced
  if (typeof prefs.showConfidenceLabels === 'boolean') {
    base.showConfidenceLabels = prefs.showConfidenceLabels;
  }
  if (typeof prefs.showWhatCouldChange === 'boolean') {
    base.showWhatCouldChange = prefs.showWhatCouldChange;
  }
  if (typeof prefs.assumeDirectIsAirline === 'boolean') {
    base.assumeDirectIsAirline = prefs.assumeDirectIsAirline;
  }
  if (prefs.portalMilesBasis && ['sticker', 'post_credit', 'range'].includes(prefs.portalMilesBasis)) {
    base.portalMilesBasis = prefs.portalMilesBasis;
  }
  if (typeof prefs.pricePremiumThreshold === 'number') {
    base.pricePremiumThreshold = clampPremiumThreshold(prefs.pricePremiumThreshold);
  }
  
  return base;
}

// ============================================
// STORAGE FUNCTIONS
// ============================================

/**
 * Get user preferences from storage
 */
export async function getUserPrefs(): Promise<UserPrefs> {
  try {
    // Try chrome.storage.sync first
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        return sanitizePrefs(result[STORAGE_KEY]);
      }
    }
    
    // Fallback to localStorage
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return sanitizePrefs(JSON.parse(local));
    }
  } catch (error) {
    console.error('[UserPrefs] Error loading preferences:', error);
  }
  
  return { ...DEFAULT_USER_PREFS };
}

/**
 * Set user preferences to storage
 */
export async function setUserPrefs(prefs: Partial<UserPrefs>): Promise<void> {
  try {
    const current = await getUserPrefs();
    const updated = sanitizePrefs({ ...current, ...prefs });
    
    // Try chrome.storage.sync first
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: updated });
    }
    
    // Also save to localStorage as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Emit change event for reactive updates
    window.dispatchEvent(new CustomEvent('vx-prefs-changed', { detail: updated }));
  } catch (error) {
    console.error('[UserPrefs] Error saving preferences:', error);
    throw error;
  }
}

/**
 * Reset preferences to defaults
 */
export async function resetUserPrefs(): Promise<void> {
  try {
    const defaults = { ...DEFAULT_USER_PREFS };
    
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: defaults });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    window.dispatchEvent(new CustomEvent('vx-prefs-changed', { detail: defaults }));
  } catch (error) {
    console.error('[UserPrefs] Error resetting preferences:', error);
    throw error;
  }
}

/**
 * Mark onboarding as completed
 */
export async function completeOnboarding(prefs: Partial<UserPrefs>): Promise<void> {
  await setUserPrefs({
    ...prefs,
    onboardingCompleted: true,
    onboardingVersion: CURRENT_ONBOARDING_VERSION,
  });
}

/**
 * Check if onboarding needs to run
 */
export async function needsOnboarding(): Promise<boolean> {
  const prefs = await getUserPrefs();
  
  // Never completed
  if (!prefs.onboardingCompleted) return true;
  
  // Version upgrade - show lightweight "new question" prompt
  if (prefs.onboardingVersion < CURRENT_ONBOARDING_VERSION) return true;
  
  return false;
}

/**
 * Quick credit remaining check (for verdict display)
 */
export async function getCreditRemaining(): Promise<number> {
  const prefs = await getUserPrefs();
  return prefs.creditRemaining;
}

// ============================================
// DERIVED VALUES FOR ENGINE
// ============================================

export interface EngineInputOverrides {
  creditRemaining: number;
  milesBalance?: number;
  mileValuationCpp: number;
}

/**
 * Get values needed for engine calculations
 */
export async function getEngineInputs(): Promise<EngineInputOverrides> {
  const prefs = await getUserPrefs();
  
  return {
    creditRemaining: prefs.creditRemaining,
    milesBalance: prefs.milesBalance,
    mileValuationCpp: prefs.mileValuationCpp,
  };
}

// ============================================
// ASSUMPTION LABELS (for UI transparency)
// ============================================

export interface AssumptionLabel {
  key: string;
  label: string;
  value: string;
  isDefault: boolean;
}

/**
 * Get assumption labels for Math & Assumptions section
 */
export function getAssumptionLabels(prefs: UserPrefs): AssumptionLabel[] {
  const labels: AssumptionLabel[] = [];
  
  // Credit
  labels.push({
    key: 'credit',
    label: 'Travel credit remaining',
    value: `$${prefs.creditRemaining}`,
    isDefault: prefs.creditRemaining === 300,
  });
  
  // Mile valuation
  labels.push({
    key: 'mileValue',
    label: 'Mile valuation',
    value: `${(prefs.mileValuationCpp * 100).toFixed(1)}¢`,
    isDefault: !prefs.customMileValuation,
  });
  
  // Miles balance
  if (prefs.milesBalance !== undefined) {
    labels.push({
      key: 'balance',
      label: 'Miles balance',
      value: prefs.milesBalance.toLocaleString(),
      isDefault: false,
    });
  }
  
  // Premium threshold
  if (prefs.pricePremiumThreshold !== 0.07) {
    labels.push({
      key: 'threshold',
      label: 'Premium threshold',
      value: `${(prefs.pricePremiumThreshold * 100).toFixed(0)}%`,
      isDefault: false,
    });
  }
  
  return labels;
}

// ============================================
// CHANGE LISTENERS
// ============================================

type PrefsChangeCallback = (prefs: UserPrefs) => void;
const listeners: PrefsChangeCallback[] = [];

export function onPrefsChange(callback: PrefsChangeCallback): () => void {
  listeners.push(callback);
  
  // Also listen to custom event
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    callback(detail);
  };
  window.addEventListener('vx-prefs-changed', handler);
  
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx > -1) listeners.splice(idx, 1);
    window.removeEventListener('vx-prefs-changed', handler);
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  getUserPrefs,
  setUserPrefs,
  resetUserPrefs,
  completeOnboarding,
  needsOnboarding,
  getCreditRemaining,
  getEngineInputs,
  getAssumptionLabels,
  onPrefsChange,
  DEFAULT_USER_PREFS,
  CURRENT_ONBOARDING_VERSION,
};
