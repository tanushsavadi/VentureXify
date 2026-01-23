// ============================================
// EXTRACTION PIPELINE - Tiered Extraction Orchestrator
// ============================================
// Implements the multi-tier extraction strategy:
// Tier 1: Site-specific selectors (fast, best when valid)
// Tier 2: Semantic selectors (aria-label, role, data-testid)
// Tier 3: Heuristic candidate scoring (site-agnostic)
// Tier 4: User-assisted correction (element picker)
// Tier 5: LLM fallback (opt-in only)

import {
  Confidence,
  ExtractionMethod,
  ExtractionResult,
  Evidence,
  PriceBreakdown,
  ExtractionOptions,
  createSuccessResult,
  createFailedResult,
  meetsConfidence,
} from './types';
import { parseMoney, ParseMoneyResult } from './parseMoney';
import { extractPriceHeuristically, HeuristicOptions } from './priceHeuristics';
import {
  getSelectorConfig,
  getEffectiveSelectors,
  getGenericSelectors,
  SiteSelectorConfig,
} from '../../config/selectorsRegistry';

// ============================================
// PIPELINE TYPES
// ============================================

export interface PipelineOptions extends ExtractionOptions {
  /** Site key override (if not auto-detecting from hostname) */
  siteKey?: string;
  
  /** Skip specific tiers */
  skipTiers?: number[];
  
  /** Force a specific tier only */
  forceTier?: 1 | 2 | 3 | 4 | 5;
  
  /** Callback when extraction completes at each tier */
  onTierComplete?: (tier: number, result: ExtractionResult<PriceBreakdown>) => void;
  
  /** User overrides to apply */
  userOverrides?: string[];
}

export interface PipelineResult extends ExtractionResult<PriceBreakdown> {
  /** Which tiers were attempted */
  tiersAttempted: number[];
  
  /** Which tier succeeded */
  successfulTier?: number;
  
  /** Results from each tier attempted */
  tierResults: Map<number, ExtractionResult<PriceBreakdown>>;
  
  /** Site config that was used */
  siteConfig?: SiteSelectorConfig;
}

// ============================================
// MAIN PIPELINE FUNCTION
// ============================================

/**
 * Run the full extraction pipeline
 * Returns the best result from all attempted tiers
 */
export async function runExtractionPipeline(
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = performance.now();
  
  const {
    enableHeuristics = true,
    enableLLMFallback = false,
    minConfidence = 'LOW',
    skipTiers = [],
    forceTier,
    onTierComplete,
    debug = false,
  } = options;
  
  // Initialize result
  const hostname = window.location.hostname;
  const tiersAttempted: number[] = [];
  const tierResults = new Map<number, ExtractionResult<PriceBreakdown>>();
  
  // Get site configuration
  const siteConfig = getSelectorConfig(options.siteKey || hostname);
  
  const baseEvidence: Partial<Evidence> = {
    url: window.location.href,
    hostname,
  };
  
  if (debug) {
    console.log('[Pipeline] Starting extraction', {
      hostname,
      siteConfig: siteConfig?.siteKey,
      options,
    });
  }
  
  // Determine which tiers to run
  const tiersToRun = forceTier 
    ? [forceTier] 
    : [1, 2, 3, 4, 5].filter(t => !skipTiers.includes(t));
  
  let bestResult: ExtractionResult<PriceBreakdown> | null = null;
  
  // ========================================
  // TIER 1: Site-specific selectors
  // ========================================
  if (tiersToRun.includes(1) && siteConfig) {
    tiersAttempted.push(1);
    
    const tier1Result = await runTier1(siteConfig, options, baseEvidence);
    tierResults.set(1, tier1Result);
    
    if (debug) {
      console.log('[Pipeline] Tier 1 result:', tier1Result.ok, tier1Result.confidence);
    }
    
    onTierComplete?.(1, tier1Result);
    
    if (tier1Result.ok && meetsConfidence(tier1Result.confidence, minConfidence)) {
      if (!bestResult || tier1Result.confidence === 'HIGH') {
        bestResult = tier1Result;
        if (tier1Result.confidence === 'HIGH') {
          // HIGH confidence from Tier 1 - no need to continue
          return buildPipelineResult(bestResult, tiersAttempted, 1, tierResults, siteConfig ?? undefined, startTime);
        }
      }
    }
  }
  
  // ========================================
  // TIER 2: Semantic selectors
  // ========================================
  if (tiersToRun.includes(2)) {
    tiersAttempted.push(2);
    
    const tier2Result = await runTier2(siteConfig, options, baseEvidence);
    tierResults.set(2, tier2Result);
    
    if (debug) {
      console.log('[Pipeline] Tier 2 result:', tier2Result.ok, tier2Result.confidence);
    }
    
    onTierComplete?.(2, tier2Result);
    
    if (tier2Result.ok && meetsConfidence(tier2Result.confidence, minConfidence)) {
      if (!bestResult || compareResults(tier2Result, bestResult) > 0) {
        bestResult = tier2Result;
        if (tier2Result.confidence === 'HIGH') {
          return buildPipelineResult(bestResult, tiersAttempted, 2, tierResults, siteConfig ?? undefined, startTime);
        }
      }
    }
  }
  
  // ========================================
  // TIER 3: Heuristic extraction
  // ========================================
  if (tiersToRun.includes(3) && enableHeuristics) {
    tiersAttempted.push(3);
    
    const tier3Result = await runTier3(options, baseEvidence);
    tierResults.set(3, tier3Result);
    
    if (debug) {
      console.log('[Pipeline] Tier 3 result:', tier3Result.ok, tier3Result.confidence);
    }
    
    onTierComplete?.(3, tier3Result);
    
    if (tier3Result.ok && meetsConfidence(tier3Result.confidence, minConfidence)) {
      if (!bestResult || compareResults(tier3Result, bestResult) > 0) {
        bestResult = tier3Result;
        // Even HIGH from heuristics is good enough to return
        if (tier3Result.confidence === 'HIGH') {
          return buildPipelineResult(bestResult, tiersAttempted, 3, tierResults, siteConfig ?? undefined, startTime);
        }
      }
    }
  }
  
  // ========================================
  // TIER 4: User-assisted (if needed)
  // ========================================
  // Tier 4 is triggered externally via user interaction
  // We don't run it automatically here, but we note that it's available
  if (tiersToRun.includes(4) && !bestResult) {
    // Mark that user assistance is needed
    // This is handled by the UI layer
  }
  
  // ========================================
  // TIER 5: LLM fallback (opt-in)
  // ========================================
  if (tiersToRun.includes(5) && enableLLMFallback && !bestResult) {
    tiersAttempted.push(5);
    
    const tier5Result = await runTier5(options, baseEvidence);
    tierResults.set(5, tier5Result);
    
    if (debug) {
      console.log('[Pipeline] Tier 5 result:', tier5Result.ok, tier5Result.confidence);
    }
    
    onTierComplete?.(5, tier5Result);
    
    if (tier5Result.ok && meetsConfidence(tier5Result.confidence, minConfidence)) {
      bestResult = tier5Result;
    }
  }
  
  // ========================================
  // RETURN BEST RESULT
  // ========================================
  if (bestResult) {
    const successfulTier = findSuccessfulTier(tierResults);
    return buildPipelineResult(bestResult, tiersAttempted, successfulTier, tierResults, siteConfig ?? undefined, startTime);
  }
  
  // No successful extraction
  return buildPipelineResult(
    createFailedResult<PriceBreakdown>(
      ['All extraction tiers failed'],
      baseEvidence,
      performance.now() - startTime,
      {
        tiersAttempted,
        missingSignals: ['No valid price found on page'],
      }
    ),
    tiersAttempted,
    undefined,
    tierResults,
    siteConfig ?? undefined,
    startTime
  );
}

// ============================================
// TIER IMPLEMENTATIONS
// ============================================

/**
 * Tier 1: Site-specific selectors
 * Uses centralized registry + user overrides via getEffectiveSelectors
 */
async function runTier1(
  config: SiteSelectorConfig,
  options: PipelineOptions,
  baseEvidence: Partial<Evidence>
): Promise<ExtractionResult<PriceBreakdown>> {
  const startTime = performance.now();
  const hostname = window.location.hostname;
  
  try {
    // Get effective selectors (registry + user overrides, prioritized by success rate)
    const effectiveSelectors = await getEffectiveSelectors(hostname, 'totalPrice');
    
    // If no effective selectors, fall back to config directly
    const selectorsToTry = effectiveSelectors.length > 0
      ? effectiveSelectors
      : [
          ...config.selectors.totalPrice.primary,
          ...(config.selectors.totalPrice.fallback || []),
        ];
    
    // Try each selector
    for (const selector of selectorsToTry) {
      const isPrimary = config.selectors.totalPrice.primary.includes(selector);
      const method: ExtractionMethod = isPrimary ? 'SELECTOR_PRIMARY' : 'SELECTOR_FALLBACK';
      
      const result = trySelector(selector, method, options);
      if (result && result.ok) {
        return {
          ...result,
          method,
          confidence: isPrimary ? result.confidence : downgradeConfidence(result.confidence),
          latencyMs: performance.now() - startTime,
          diagnostics: {
            ...result.diagnostics,
            successfulTier: 1,
            registryVersion: config.version,
            usedSelector: selector,
            confidenceReasons: isPrimary ? undefined : ['Using fallback selector'],
          },
        };
      }
    }
    
    return createFailedResult<PriceBreakdown>(
      ['No site-specific selectors matched'],
      baseEvidence,
      performance.now() - startTime,
      { successfulTier: undefined, tiersAttempted: [1] }
    );
    
  } catch (error) {
    return createFailedResult<PriceBreakdown>(
      [`Tier 1 error: ${error instanceof Error ? error.message : String(error)}`],
      baseEvidence,
      performance.now() - startTime
    );
  }
}

/**
 * Tier 2: Semantic selectors
 * Uses generic selectors from registry + site-specific semantic hints
 */
async function runTier2(
  config: SiteSelectorConfig | null,
  options: PipelineOptions,
  baseEvidence: Partial<Evidence>
): Promise<ExtractionResult<PriceBreakdown>> {
  const startTime = performance.now();
  
  try {
    // Get generic semantic selectors from registry
    const genericConfig = getGenericSelectors();
    
    // Build semantic selector list: site-specific first, then generic
    const semanticSelectors: string[] = [];
    
    // From site config (highest priority)
    if (config?.selectors.totalPrice.semantic) {
      semanticSelectors.push(...config.selectors.totalPrice.semantic);
    }
    
    // From generic config
    if (genericConfig.semantic) {
      semanticSelectors.push(...genericConfig.semantic);
    }
    
    // Also try generic primary/fallback if not already in site config
    if (genericConfig.primary) {
      for (const sel of genericConfig.primary) {
        if (!semanticSelectors.includes(sel)) {
          semanticSelectors.push(sel);
        }
      }
    }
    if (genericConfig.fallback) {
      for (const sel of genericConfig.fallback) {
        if (!semanticSelectors.includes(sel)) {
          semanticSelectors.push(sel);
        }
      }
    }
    
    for (const selector of semanticSelectors) {
      const result = trySelector(selector, 'SEMANTIC', options);
      if (result && result.ok) {
        return {
          ...result,
          method: 'SEMANTIC',
          latencyMs: performance.now() - startTime,
          diagnostics: {
            ...result.diagnostics,
            successfulTier: 2,
            usedSelector: selector,
          },
        };
      }
    }
    
    return createFailedResult<PriceBreakdown>(
      ['No semantic selectors matched'],
      baseEvidence,
      performance.now() - startTime,
      { successfulTier: undefined, tiersAttempted: [2] }
    );
    
  } catch (error) {
    return createFailedResult<PriceBreakdown>(
      [`Tier 2 error: ${error instanceof Error ? error.message : String(error)}`],
      baseEvidence,
      performance.now() - startTime
    );
  }
}

/**
 * Tier 3: Heuristic extraction
 */
async function runTier3(
  options: PipelineOptions,
  baseEvidence: Partial<Evidence>
): Promise<ExtractionResult<PriceBreakdown>> {
  const startTime = performance.now();
  
  try {
    const heuristicOptions: HeuristicOptions = {
      pageType: options.contextHints?.pageType as HeuristicOptions['pageType'],
      priceRange: options.priceRange,
      expectedCurrency: options.expectedCurrency,
      debug: options.debug,
    };
    
    const result = extractPriceHeuristically(heuristicOptions);
    
    return {
      ...result,
      latencyMs: performance.now() - startTime,
      diagnostics: {
        ...result.diagnostics,
        successfulTier: result.ok ? 3 : undefined,
        tiersAttempted: [3],
      },
    };
    
  } catch (error) {
    return createFailedResult<PriceBreakdown>(
      [`Tier 3 error: ${error instanceof Error ? error.message : String(error)}`],
      baseEvidence,
      performance.now() - startTime
    );
  }
}

/**
 * Tier 5: LLM fallback (placeholder - actual implementation would need API)
 */
async function runTier5(
  options: PipelineOptions,
  baseEvidence: Partial<Evidence>
): Promise<ExtractionResult<PriceBreakdown>> {
  const startTime = performance.now();
  
  // This is a placeholder - actual LLM extraction would:
  // 1. Get a minimal, redacted snapshot of the checkout area
  // 2. Send to LLM with strict JSON schema
  // 3. Validate response against parseMoney
  // 4. Return with appropriate confidence
  
  return createFailedResult<PriceBreakdown>(
    ['LLM extraction not implemented'],
    baseEvidence,
    performance.now() - startTime,
    {
      suggestions: ['Enable AI extraction in settings to use LLM fallback'],
    }
  );
}

// ============================================
// SELECTOR EXECUTION
// ============================================

/**
 * Try a single selector and return result
 */
function trySelector(
  selector: string,
  method: ExtractionMethod,
  options: PipelineOptions
): ExtractionResult<PriceBreakdown> | null {
  try {
    const elements = document.querySelectorAll(selector);
    
    for (const element of elements) {
      // Skip hidden elements
      if (!isElementVisible(element)) continue;
      
      // Skip elements inside our own widget
      if (isInsideVentureXWidget(element)) continue;
      
      const text = element.textContent?.trim();
      if (!text) continue;
      
      // Try to parse as money
      const parseResult = parseMoney(text, {
        expectedCurrency: options.expectedCurrency,
        minAmount: options.priceRange?.min,
        maxAmount: options.priceRange?.max,
      });
      
      if (parseResult.money) {
        const confidence = determineConfidenceFromParse(parseResult, element, selector);
        
        const breakdown: PriceBreakdown = {
          total: parseResult.money,
          isFromPrice: parseResult.isFromPrice,
          perPerson: parseResult.isPerPerson,
        };
        
        if (parseResult.isPerNight) {
          breakdown.perNight = parseResult.money;
          breakdown.total = undefined;
        }
        
        const evidence: Evidence = {
          matchedText: text,
          normalizedValue: parseResult.money.amount,
          selector,
          url: window.location.href,
          hostname: window.location.hostname,
          domPath: getDomPath(element),
          currency: parseResult.money.currency,
          warnings: parseResult.warnings,
        };
        
        return createSuccessResult(
          breakdown,
          confidence,
          method,
          evidence,
          0 // Latency calculated by caller
        );
      }
    }
    
    return null;
    
  } catch {
    return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if element is visible
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;
  
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  
  return true;
}

/**
 * Check if element is inside VentureX widget
 */
function isInsideVentureXWidget(element: Element): boolean {
  return !!(
    element.closest('#vx-direct-helper') ||
    element.closest('#vx-auto-compare-widget') ||
    element.closest('[class*="vx-"]') ||
    element.closest('[id^="vx-"]')
  );
}

/**
 * Get human-readable DOM path
 */
function getDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body && parts.length < 5) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ')
        .filter(c => c && !c.match(/^[a-z]{20,}$/))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    parts.unshift(selector);
    current = current.parentElement;
  }
  
  return parts.join(' > ');
}

/**
 * Determine confidence from parse result and element context
 */
function determineConfidenceFromParse(
  parseResult: ParseMoneyResult,
  element: Element,
  selector: string
): Confidence {
  let confidence: Confidence = 'MEDIUM';
  
  // High parse confidence + good selector = HIGH
  if (parseResult.confidence >= 80 && selector.includes('total')) {
    confidence = 'HIGH';
  }
  
  // Check for "total" in nearby text
  const nearbyText = element.parentElement?.textContent?.toLowerCase() || '';
  if (nearbyText.includes('total') || nearbyText.includes('due today')) {
    confidence = 'HIGH';
  }
  
  // Downgrade for "from" prices
  if (parseResult.isFromPrice) {
    confidence = 'LOW';
  }
  
  // Downgrade for per-night prices
  if (parseResult.isPerNight) {
    confidence = 'LOW';
  }
  
  // Downgrade for low parse confidence
  if (parseResult.confidence < 50) {
    confidence = 'LOW';
  }
  
  return confidence;
}

/**
 * Downgrade confidence by one level
 */
function downgradeConfidence(confidence: Confidence): Confidence {
  const map: Record<Confidence, Confidence> = {
    'HIGH': 'MEDIUM',
    'MEDIUM': 'LOW',
    'LOW': 'LOW',
    'NONE': 'NONE',
  };
  return map[confidence];
}

/**
 * Compare two results (positive = a is better)
 */
function compareResults(
  a: ExtractionResult<PriceBreakdown>,
  b: ExtractionResult<PriceBreakdown>
): number {
  const confOrder: Record<Confidence, number> = {
    'HIGH': 4,
    'MEDIUM': 3,
    'LOW': 2,
    'NONE': 1,
  };
  
  // Compare confidence
  const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
  if (confDiff !== 0) return confDiff;
  
  // Compare latency (faster is better)
  return b.latencyMs - a.latencyMs;
}

/**
 * Find which tier produced the best result
 */
function findSuccessfulTier(
  tierResults: Map<number, ExtractionResult<PriceBreakdown>>
): number | undefined {
  let bestTier: number | undefined;
  let bestConfidence = -1;
  
  const confOrder: Record<Confidence, number> = {
    'HIGH': 4,
    'MEDIUM': 3,
    'LOW': 2,
    'NONE': 1,
  };
  
  for (const [tier, result] of tierResults) {
    if (result.ok) {
      const conf = confOrder[result.confidence];
      if (conf > bestConfidence) {
        bestConfidence = conf;
        bestTier = tier;
      }
    }
  }
  
  return bestTier;
}

/**
 * Build final pipeline result
 */
function buildPipelineResult(
  result: ExtractionResult<PriceBreakdown>,
  tiersAttempted: number[],
  successfulTier: number | undefined,
  tierResults: Map<number, ExtractionResult<PriceBreakdown>>,
  siteConfig: SiteSelectorConfig | undefined,
  startTime: number
): PipelineResult {
  return {
    ...result,
    tiersAttempted,
    successfulTier,
    tierResults,
    siteConfig,
    latencyMs: performance.now() - startTime,
    diagnostics: {
      ...result.diagnostics,
      successfulTier,
      tiersAttempted,
      registryVersion: siteConfig?.version,
    },
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick extraction with default options
 */
export async function extractPrice(): Promise<PipelineResult> {
  return runExtractionPipeline();
}

/**
 * Extract price for flights
 */
export async function extractFlightPrice(): Promise<PipelineResult> {
  return runExtractionPipeline({
    priceRange: { min: 50, max: 50000 },
    contextHints: {
      bookingType: 'flight',
    },
  });
}

/**
 * Extract price for stays
 */
export async function extractStayPrice(): Promise<PipelineResult> {
  return runExtractionPipeline({
    priceRange: { min: 50, max: 100000 },
    contextHints: {
      bookingType: 'stay',
    },
  });
}

/**
 * Check if extraction is needed (no cached valid result)
 */
export function needsExtraction(lastResult?: PipelineResult): boolean {
  if (!lastResult) return true;
  if (!lastResult.ok) return true;
  if (lastResult.confidence === 'NONE') return true;
  
  // Re-extract if result is older than 30 seconds
  const age = Date.now() - (lastResult.diagnostics?.successfulTier ?? 0);
  if (age > 30000) return true;
  
  return false;
}

/**
 * Get extraction summary for UI
 */
export function getExtractionSummary(result: PipelineResult): {
  success: boolean;
  confidence: Confidence;
  amount: number | null;
  currency: string | null;
  method: string;
  tier: number | null;
  warnings: string[];
} {
  return {
    success: result.ok,
    confidence: result.confidence,
    amount: result.value?.total?.amount ?? result.value?.perNight?.amount ?? null,
    currency: result.value?.total?.currency ?? result.value?.perNight?.currency ?? null,
    method: result.method,
    tier: result.successfulTier ?? null,
    warnings: result.evidence.warnings || [],
  };
}
