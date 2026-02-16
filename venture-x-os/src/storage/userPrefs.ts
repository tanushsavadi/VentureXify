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
 *
 * P0 Fixes Applied:
 * - Storage versioning for migrations
 * - Debounced saves to prevent quota exceeded errors
 * - Retry logic with exponential backoff
 */

// ============================================
// STORAGE VERSION & MIGRATION
// ============================================

const STORAGE_VERSION = 3;
const SAVE_DEBOUNCE_MS = 500;
const MAX_RETRIES = 3;

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

  // Display preference: show effective cost after miles value
  showEffectiveCost: boolean;        // true = show effective cost, false = OOP only

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

/**
 * Single source of truth for default mile valuation - 1.0¢ conservative
 *
 * Using 1.0¢ (Travel Eraser floor) as default because:
 * 1. It's the GUARANTEED minimum value (Eraser always gives 1¢/mile)
 * 2. It doesn't "juice" portal to look artificially better
 * 3. Users who get more value can adjust upward in settings
 *
 * References:
 * - Travel Eraser: 1.0¢ floor (guaranteed)
 * - Frequent Miler RRV: 1.45¢ (typical)
 * - The Points Guy: ~1.85¢ (optimistic)
 */
export const DEFAULT_MILE_VALUATION_CPP = 0.01;

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
  mileValuationCpp: DEFAULT_MILE_VALUATION_CPP,  // Use single source of truth
  customMileValuation: false,

  // PointsYeah
  enableAwardSearch: false,
  autoPrefillPointsYeah: true,

  // UI Preferences
  defaultOpenTab: 'auto',  // Auto-select based on page context

  // Display preference — default to true for best card optimization
  showEffectiveCost: true,

  // Advanced
  showConfidenceLabels: true,
  showWhatCouldChange: true,
  assumeDirectIsAirline: false,
  portalMilesBasis: 'range',
  pricePremiumThreshold: 0.07,
};

export const CURRENT_ONBOARDING_VERSION = 1;

// ============================================
// STORAGE KEY & VERSIONED FORMAT
// ============================================

const STORAGE_KEY = 'vx_user_prefs';

/** Versioned storage wrapper for migration support */
interface StoredPrefsWrapper {
  version: number;
  lastModified: number;
  data: UserPrefs;
}

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
  if (typeof prefs.showEffectiveCost === 'boolean') {
    base.showEffectiveCost = prefs.showEffectiveCost;
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
// MIGRATION FUNCTIONS
// ============================================

/**
 * Migrate stored data to latest version
 */
function migrateStoredData(stored: unknown): StoredPrefsWrapper {
  // Handle legacy format (no version wrapper)
  if (stored && typeof stored === 'object' && !('version' in stored)) {
    // Legacy format: direct UserPrefs object
    console.log('[UserPrefs] Migrating from legacy format to v2');
    return {
      version: STORAGE_VERSION,
      lastModified: Date.now(),
      data: sanitizePrefs(stored as Partial<UserPrefs>),
    };
  }
  
  const wrapper = stored as StoredPrefsWrapper;
  
  // Already at current version
  if (wrapper.version === STORAGE_VERSION) {
    return {
      ...wrapper,
      data: sanitizePrefs(wrapper.data),
    };
  }
  
  // Version-specific migrations
  if (wrapper.version === 2) {
    // v2→v3: Seed showEffectiveCost from defaultMode
    const data = wrapper.data as Partial<UserPrefs> & Record<string, unknown>;
    data.showEffectiveCost = data.defaultMode === 'max_value' ? true : true;
    wrapper.version = 3;
    console.log('[UserPrefs] Migrated from v2 to v3: seeded showEffectiveCost');
  }
  
  console.log(`[UserPrefs] Migrated to v${STORAGE_VERSION}`);
  return {
    version: STORAGE_VERSION,
    lastModified: Date.now(),
    data: sanitizePrefs(wrapper.data),
  };
}

// ============================================
// DEBOUNCING INFRASTRUCTURE
// ============================================

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingPrefs: Partial<UserPrefs> | null = null;
let saveResolvers: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

/**
 * Flush pending saves immediately
 */
async function flushPendingUpdates(): Promise<void> {
  if (!pendingPrefs) return;
  
  const prefsToSave = { ...pendingPrefs };
  const resolversToNotify = [...saveResolvers];
  
  pendingPrefs = null;
  saveResolvers = [];
  
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  
  try {
    await savePrefsImmediately(prefsToSave);
    resolversToNotify.forEach(r => r.resolve());
  } catch (error) {
    resolversToNotify.forEach(r => r.reject(error as Error));
    throw error;
  }
}

/**
 * Save with retry and exponential backoff
 */
async function saveWithRetry(wrapper: StoredPrefsWrapper, attempt = 1): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: wrapper });
    }
  } catch (error) {
    const isQuotaError = (error as Error)?.message?.includes('QUOTA') ||
                         (error as Error)?.message?.includes('quota');
    
    if (attempt < MAX_RETRIES && !isQuotaError) {
      const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
      console.warn(`[UserPrefs] Retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return saveWithRetry(wrapper, attempt + 1);
    }
    
    if (isQuotaError) {
      console.error('[UserPrefs] Storage quota exceeded. Try reducing saved data.');
    }
    
    throw error;
  }
}

/**
 * Internal: Save preferences immediately (no debouncing)
 */
async function savePrefsImmediately(prefs: Partial<UserPrefs>): Promise<void> {
  const current = await getUserPrefs();
  const updated = sanitizePrefs({ ...current, ...prefs });
  
  const wrapper: StoredPrefsWrapper = {
    version: STORAGE_VERSION,
    lastModified: Date.now(),
    data: updated,
  };
  
  // Try chrome.storage.sync with retry
  await saveWithRetry(wrapper);
  
  // Also save to localStorage as backup (always succeeds)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
  } catch {
    console.warn('[UserPrefs] localStorage backup failed (quota?)');
  }
  
  // Emit change event for reactive updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vx-prefs-changed', { detail: updated }));
  }
  
  // Also notify via chrome.storage.onChanged for service workers
  // (This happens automatically via chrome.storage.sync.set)
}

// ============================================
// STORAGE FUNCTIONS (Public API)
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
        const migrated = migrateStoredData(result[STORAGE_KEY]);
        return migrated.data;
      }
    }
    
    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        const migrated = migrateStoredData(parsed);
        return migrated.data;
      }
    }
  } catch (error) {
    console.error('[UserPrefs] Error loading preferences:', error);
  }
  
  return { ...DEFAULT_USER_PREFS };
}

/**
 * Set user preferences to storage (debounced)
 *
 * Multiple rapid calls will be batched into a single write.
 * Returns a promise that resolves when the save is complete.
 */
export function setUserPrefs(prefs: Partial<UserPrefs>): Promise<void> {
  return new Promise((resolve, reject) => {
    // Merge with any pending updates
    pendingPrefs = { ...pendingPrefs, ...prefs };
    saveResolvers.push({ resolve, reject });
    
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Schedule debounced save
    saveTimeout = setTimeout(() => {
      flushPendingUpdates().catch(console.error);
    }, SAVE_DEBOUNCE_MS);
  });
}

/**
 * Set user preferences immediately (no debouncing)
 * Use sparingly - only for critical saves like onboarding completion
 */
export async function setUserPrefsImmediate(prefs: Partial<UserPrefs>): Promise<void> {
  // Flush any pending updates first
  await flushPendingUpdates();
  // Then save immediately
  await savePrefsImmediately(prefs);
}

/**
 * Reset preferences to defaults
 */
export async function resetUserPrefs(): Promise<void> {
  // Cancel any pending saves
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingPrefs = null;
  saveResolvers.forEach(r => r.reject(new Error('Reset cancelled pending save')));
  saveResolvers = [];
  
  const wrapper: StoredPrefsWrapper = {
    version: STORAGE_VERSION,
    lastModified: Date.now(),
    data: { ...DEFAULT_USER_PREFS },
  };
  
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: wrapper });
    }
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
    }
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vx-prefs-changed', { detail: wrapper.data }));
    }
  } catch (error) {
    console.error('[UserPrefs] Error resetting preferences:', error);
    throw error;
  }
}

/**
 * Mark onboarding as completed
 * Uses immediate save since this is a critical action
 */
export async function completeOnboarding(prefs: Partial<UserPrefs>): Promise<void> {
  await setUserPrefsImmediate({
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
