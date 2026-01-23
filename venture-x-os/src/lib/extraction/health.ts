// ============================================
// EXTRACTION HEALTH - Monitoring & Reporting
// ============================================
// Track extraction success/failure rates per site
// Surface degradation indicators to users
// Provide debug payloads for issue reporting

import { Confidence, ExtractionResult, ExtractionHealth } from './types';
import { PipelineResult } from './pipeline';

// ============================================
// CONSTANTS
// ============================================

const HEALTH_STORAGE_KEY = 'vx_extraction_health';
const MAX_EVENTS_PER_SITE = 200;
const DEGRADED_THRESHOLD = 0.5; // Below 50% success = degraded

// ============================================
// TYPES
// ============================================

export interface ExtractionEvent {
  timestamp: number;
  hostname: string;
  success: boolean;
  confidence: Confidence;
  method: string;
  tier?: number;
  latencyMs: number;
  errors?: string[];
}

interface HealthStore {
  events: ExtractionEvent[];
  lastUpdated: number;
  version: number;
}

interface DebugPayload {
  timestamp: string;
  hostname: string;
  urlPattern: string;
  registryVersion?: string;
  tiersAttempted: number[];
  successfulTier?: number;
  confidence: Confidence;
  selectorAttempts: string[];
  topCandidates: Array<{
    text: string;
    score: number;
    reasons: string[];
  }>;
  warnings: string[];
  latencyMs: number;
  health: {
    successRate: number;
    recentFailures: number;
    isDegraded: boolean;
  };
}

// ============================================
// HEALTH STORE
// ============================================

let healthStore: HealthStore | null = null;

/**
 * Load health store from storage
 */
async function loadHealthStore(): Promise<HealthStore> {
  if (healthStore) return healthStore;
  
  const defaultStore: HealthStore = { events: [], lastUpdated: Date.now(), version: 1 };
  
  if (typeof chrome === 'undefined' || !chrome.storage) {
    healthStore = defaultStore;
    return defaultStore;
  }
  
  try {
    const result = await chrome.storage.local.get(HEALTH_STORAGE_KEY);
    const loaded = result[HEALTH_STORAGE_KEY] || defaultStore;
    healthStore = loaded;
    return loaded;
  } catch {
    healthStore = defaultStore;
    return defaultStore;
  }
}

/**
 * Save health store to storage
 */
async function saveHealthStore(): Promise<void> {
  if (!healthStore) return;
  
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }
  
  try {
    healthStore.lastUpdated = Date.now();
    await chrome.storage.local.set({ [HEALTH_STORAGE_KEY]: healthStore });
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// EVENT RECORDING
// ============================================

/**
 * Record an extraction event
 */
export async function recordExtractionEvent(
  result: PipelineResult | ExtractionResult<unknown>
): Promise<void> {
  const store = await loadHealthStore();
  
  const event: ExtractionEvent = {
    timestamp: Date.now(),
    hostname: window.location.hostname,
    success: result.ok,
    confidence: result.confidence,
    method: result.method,
    tier: (result as PipelineResult).successfulTier,
    latencyMs: result.latencyMs,
    errors: result.errors,
  };
  
  // Add to events
  store.events.push(event);
  
  // Prune old events per site
  pruneEvents(store);
  
  await saveHealthStore();
  
  // Log if degraded
  const health = calculateSiteHealth(window.location.hostname, store.events);
  if (health.isDegraded) {
    console.warn('[Extraction Health] Site extraction is degraded:', {
      hostname: window.location.hostname,
      successRate: health.successRate,
      recentFailures: health.failures,
    });
  }
}

/**
 * Prune events to keep within limits
 */
function pruneEvents(store: HealthStore): void {
  // Group by hostname
  const byHost = new Map<string, ExtractionEvent[]>();
  
  for (const event of store.events) {
    const existing = byHost.get(event.hostname) || [];
    existing.push(event);
    byHost.set(event.hostname, existing);
  }
  
  // Keep only recent events per host
  store.events = [];
  for (const [_hostname, events] of byHost) {
    const sorted = events.sort((a, b) => b.timestamp - a.timestamp);
    const kept = sorted.slice(0, MAX_EVENTS_PER_SITE);
    store.events.push(...kept);
  }
}

// ============================================
// HEALTH CALCULATION
// ============================================

/**
 * Calculate health for a specific site
 */
function calculateSiteHealth(
  hostname: string,
  events: ExtractionEvent[]
): ExtractionHealth {
  const siteEvents = events.filter(e => e.hostname === hostname);
  
  const successHigh = siteEvents.filter(e => e.success && e.confidence === 'HIGH').length;
  const successMed = siteEvents.filter(e => e.success && e.confidence === 'MEDIUM').length;
  const successLow = siteEvents.filter(e => e.success && e.confidence === 'LOW').length;
  const failures = siteEvents.filter(e => !e.success).length;
  
  const total = siteEvents.length;
  const successes = successHigh + successMed + successLow;
  const successRate = total > 0 ? successes / total : 1;
  
  const successEvents = siteEvents.filter(e => e.success);
  const failureEvents = siteEvents.filter(e => !e.success);
  
  return {
    siteKey: hostname,
    attempts: total,
    successHigh,
    successMed,
    successLow,
    failures,
    lastSuccessAt: successEvents.length > 0 
      ? Math.max(...successEvents.map(e => e.timestamp)) 
      : undefined,
    lastFailureAt: failureEvents.length > 0 
      ? Math.max(...failureEvents.map(e => e.timestamp)) 
      : undefined,
    successRate,
    isDegraded: total >= 3 && successRate < DEGRADED_THRESHOLD,
  };
}

/**
 * Get health for a site
 */
export async function getSiteHealth(hostname: string): Promise<ExtractionHealth> {
  const store = await loadHealthStore();
  return calculateSiteHealth(hostname, store.events);
}

/**
 * Get health for current site
 */
export async function getCurrentSiteHealth(): Promise<ExtractionHealth> {
  return getSiteHealth(window.location.hostname);
}

/**
 * Get health for all tracked sites
 */
export async function getAllSiteHealth(): Promise<ExtractionHealth[]> {
  const store = await loadHealthStore();
  
  // Get unique hostnames
  const hostnames = new Set(store.events.map(e => e.hostname));
  
  return Array.from(hostnames).map(hostname => 
    calculateSiteHealth(hostname, store.events)
  );
}

/**
 * Check if current site is degraded
 */
export async function isSiteDegraded(hostname?: string): Promise<boolean> {
  const health = await getSiteHealth(hostname || window.location.hostname);
  return health.isDegraded;
}

// ============================================
// DEBUG PAYLOAD GENERATION
// ============================================

/**
 * Generate a sanitized debug payload for issue reporting
 */
export function generateDebugPayload(result: PipelineResult): DebugPayload {
  const health = {
    successRate: 0,
    recentFailures: 0,
    isDegraded: false,
  };
  
  // Calculate health synchronously from result if possible
  if (result.diagnostics) {
    health.successRate = result.ok ? 1 : 0;
  }
  
  // Sanitize URL - remove sensitive params
  const urlPattern = sanitizeUrl(window.location.href);
  
  // Get selector attempts from evidence
  const selectorAttempts: string[] = [];
  if (result.evidence.selector) {
    selectorAttempts.push(result.evidence.selector);
  }
  
  // Get top candidates
  const topCandidates = (result.evidence.candidateScores || []).slice(0, 5).map(c => ({
    text: truncateText(c.text, 50),
    score: c.score,
    reasons: c.reasons.slice(0, 3),
  }));
  
  return {
    timestamp: new Date().toISOString(),
    hostname: window.location.hostname,
    urlPattern,
    registryVersion: result.diagnostics?.registryVersion,
    tiersAttempted: result.tiersAttempted,
    successfulTier: result.successfulTier,
    confidence: result.confidence,
    selectorAttempts,
    topCandidates,
    warnings: result.evidence.warnings || [],
    latencyMs: result.latencyMs,
    health,
  };
}

/**
 * Generate debug payload as copyable string
 */
export function getDebugPayloadString(result: PipelineResult): string {
  const payload = generateDebugPayload(result);
  return JSON.stringify(payload, null, 2);
}

/**
 * Copy debug payload to clipboard
 */
export async function copyDebugPayload(result: PipelineResult): Promise<boolean> {
  try {
    const payload = getDebugPayloadString(result);
    await navigator.clipboard.writeText(payload);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// LOGGING
// ============================================

/**
 * Log extraction result (privacy-safe)
 */
export function logExtractionResult(
  result: PipelineResult,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const log = level === 'error' ? console.error 
    : level === 'warn' ? console.warn 
    : console.log;
  
  const summary = {
    success: result.ok,
    confidence: result.confidence,
    method: result.method,
    tier: result.successfulTier,
    amount: result.value?.total?.amount ? `$${result.value.total.amount.toFixed(2)}` : 'N/A',
    latency: `${result.latencyMs.toFixed(0)}ms`,
    warnings: result.evidence.warnings?.length || 0,
  };
  
  log('[Extraction]', summary);
  
  // Log errors if any
  if (result.errors && result.errors.length > 0) {
    console.error('[Extraction] Errors:', result.errors);
  }
}

/**
 * Log failure with attempted selectors (for debugging)
 */
export function logExtractionFailure(result: PipelineResult): void {
  console.group('[Extraction] Failed to extract price');
  
  console.log('URL:', sanitizeUrl(window.location.href));
  console.log('Tiers attempted:', result.tiersAttempted);
  console.log('Errors:', result.errors);
  
  // Log best candidates if available
  if (result.evidence.candidateScores && result.evidence.candidateScores.length > 0) {
    console.log('Best candidates:');
    result.evidence.candidateScores.slice(0, 3).forEach((c, i) => {
      console.log(`  ${i + 1}. "${truncateText(c.text, 40)}" (score: ${c.score})`);
    });
  } else {
    console.log('No candidates found');
  }
  
  console.groupEnd();
}

// ============================================
// UTILITIES
// ============================================

/**
 * Sanitize URL by removing sensitive parameters
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove sensitive params
    const sensitiveParams = [
      'token', 'auth', 'session', 'key', 'secret', 'password',
      'api_key', 'apikey', 'access_token', 'email', 'phone',
      'name', 'address', 'card', 'cc', 'cvv', 'exp',
    ];
    
    sensitiveParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    
    // Truncate remaining params to avoid PII in long values
    const truncatedSearch: string[] = [];
    parsed.searchParams.forEach((value, key) => {
      if (value.length > 50) {
        truncatedSearch.push(`${key}=[truncated]`);
      } else {
        truncatedSearch.push(`${key}=${value}`);
      }
    });
    
    return `${parsed.origin}${parsed.pathname}${truncatedSearch.length > 0 ? '?' + truncatedSearch.join('&') : ''}`;
  } catch {
    // Return just the hostname if URL parsing fails
    return new URL(url).hostname;
  }
}

/**
 * Truncate text safely
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Redact potential PII from text
 */
export function redactPII(text: string): string {
  return text
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Phone numbers (various formats)
    .replace(/\+?[\d\s\-().]{10,}/g, (match) => {
      // Only redact if it looks like a phone number (mostly digits)
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 ? '[PHONE]' : match;
    })
    // Credit card numbers
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    // Names (very basic - titles followed by capitalized words)
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]');
}

// ============================================
// HEALTH UI HELPERS
// ============================================

/**
 * Get health status indicator for UI
 */
export function getHealthStatusIndicator(health: ExtractionHealth): {
  status: 'good' | 'warning' | 'degraded';
  message: string;
  color: string;
} {
  if (health.isDegraded) {
    return {
      status: 'degraded',
      message: 'Extraction reliability is degraded. Some features may not work correctly.',
      color: '#ef4444', // red
    };
  }
  
  if (health.successRate < 0.8 && health.attempts >= 3) {
    return {
      status: 'warning',
      message: 'Some extractions are failing. Results may be incomplete.',
      color: '#f59e0b', // amber
    };
  }
  
  return {
    status: 'good',
    message: 'Extraction is working normally.',
    color: '#22c55e', // green
  };
}

/**
 * Get confidence badge color
 */
export function getConfidenceBadgeColor(confidence: Confidence): string {
  switch (confidence) {
    case 'HIGH':
      return '#22c55e'; // green
    case 'MEDIUM':
      return '#f59e0b'; // amber
    case 'LOW':
      return '#ef4444'; // red
    case 'NONE':
      return '#6b7280'; // gray
  }
}

/**
 * Get confidence badge text
 */
export function getConfidenceBadgeText(confidence: Confidence): string {
  switch (confidence) {
    case 'HIGH':
      return 'High confidence';
    case 'MEDIUM':
      return 'Medium confidence';
    case 'LOW':
      return 'Low confidence';
    case 'NONE':
      return 'Not detected';
  }
}

// ============================================
// RESET/CLEAR
// ============================================

/**
 * Clear health data for a site
 */
export async function clearSiteHealth(hostname: string): Promise<void> {
  const store = await loadHealthStore();
  store.events = store.events.filter(e => e.hostname !== hostname);
  await saveHealthStore();
}

/**
 * Clear all health data
 */
export async function clearAllHealth(): Promise<void> {
  healthStore = { events: [], lastUpdated: Date.now(), version: 1 };
  await saveHealthStore();
}
