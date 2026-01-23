// ============================================
// PRICE HEURISTICS - Site-Agnostic Price Detection
// ============================================
// Robust heuristic-based price extraction that survives
// layout changes, A/B tests, and redesigns
// by scoring candidates on multiple signals

import {
  Confidence,
  ExtractionResult,
  Evidence,
  CandidateScore,
  Money,
  PriceBreakdown,
  PriceLabel,
  createSuccessResult,
  createFailedResult,
} from './types';
import { parseMoney, ParseMoneyResult, looksLikePrice } from './parseMoney';

// ============================================
// CONSTANTS
// ============================================

/** Minimum score to consider a candidate valid */
const MIN_CANDIDATE_SCORE = 20;

/** Maximum number of candidates to return in evidence */
const MAX_EVIDENCE_CANDIDATES = 5;

/** Maximum elements to scan for performance */
const MAX_ELEMENTS_TO_SCAN = 2000;

/** Words that strongly indicate a total price */
const TOTAL_KEYWORDS = [
  'total',
  'trip total',
  'grand total',
  'amount due',
  'pay now',
  'due today',
  'your total',
  'order total',
  'booking total',
  'reservation total',
  'final price',
  'final total',
  'total cost',
  'total price',
  'checkout total',
  'purchase total',
];

/** Words that indicate taxes/fees (not the total) */
const TAXES_FEES_KEYWORDS = [
  'tax',
  'taxes',
  'fee',
  'fees',
  'taxes & fees',
  'taxes and fees',
  'service fee',
  'booking fee',
  'resort fee',
  'cleaning fee',
];

/** Words that indicate per-night pricing (not total) */
const PER_NIGHT_KEYWORDS = [
  '/night',
  'per night',
  'nightly',
  'per n',
  '/ night',
  'night)',
  '/nt',
];

/** Words that indicate "from" pricing (not actual total) */
const FROM_KEYWORDS = [
  'from',
  'starting at',
  'starts at',
  'as low as',
  'base fare',
  'base rate',
];

/** Words that indicate per-person pricing */
const PER_PERSON_KEYWORDS = [
  '/person',
  'per person',
  '/pax',
  'per pax',
  'each',
  'per adult',
  'per traveler',
  'per guest',
];

/** Words that indicate strikethrough/original pricing (not current) */
const STRIKETHROUGH_KEYWORDS = [
  'was',
  'originally',
  'regular',
  'compare at',
  'list price',
];

/** Container selectors that typically contain checkout summaries */
const SUMMARY_CONTAINER_SELECTORS = [
  '[class*="summary"]',
  '[class*="Summary"]',
  '[class*="checkout"]',
  '[class*="Checkout"]',
  '[class*="total"]',
  '[class*="Total"]',
  '[class*="price-breakdown"]',
  '[class*="PriceBreakdown"]',
  '[class*="booking-info"]',
  '[class*="trip-cost"]',
  '[data-testid*="summary"]',
  '[data-testid*="total"]',
  '[data-testid*="checkout"]',
  '[role="complementary"]',
  'aside',
];

// ============================================
// TYPES
// ============================================

export interface HeuristicOptions {
  /** Context hint: what type of page are we on */
  pageType?: 'search' | 'details' | 'checkout' | 'booking' | 'availability' | 'unknown';
  
  /** Expected price range */
  priceRange?: {
    min?: number;
    max?: number;
  };
  
  /** Expected currency */
  expectedCurrency?: string;
  
  /** Container to search within (defaults to document.body) */
  container?: Element | Document;
  
  /** Whether to include candidates from outside viewport */
  includeOffscreen?: boolean;
  
  /** Maximum time for extraction (ms) */
  timeout?: number;
  
  /** Debug mode - more detailed logging */
  debug?: boolean;
  
  /**
   * Stability info from SPA watcher - allows confidence promotion
   * when price has been stable across multiple reads
   */
  stabilityInfo?: {
    /** Number of consecutive reads with same value */
    stableReadCount: number;
    /** Duration price has been stable (ms) */
    stableDurationMs: number;
    /** Whether price changed during observation window */
    priceWasUnstable?: boolean;
  };
}

interface ScoredCandidate {
  element: Element;
  text: string;
  parsedMoney: ParseMoneyResult;
  score: number;
  reasons: string[];
  penalties: string[];
  label: PriceLabel;
  isInSummaryContainer: boolean;
  
  // Anchor evidence tracking (for improved confidence discipline)
  hasTotalKeywordNearby: boolean;
  hasTotalKeywordInText: boolean;
  hasAriaTotal: boolean;
  hasTestIdTotal: boolean;
  isNearCheckoutButton: boolean;
  
  // Disqualifying qualifiers
  isPerNight: boolean;
  isFromPrice: boolean;
  isPerPerson: boolean;
  
  // Multi-price detection (price grids/lists are not totals)
  containsMultiplePrices: boolean;
  priceCountInElement: number;
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

/**
 * Extract the total price using heuristic scoring
 * This is the main entry point for site-agnostic price extraction
 */
export function extractPriceHeuristically(
  options: HeuristicOptions = {}
): ExtractionResult<PriceBreakdown> {
  const startTime = performance.now();
  
  const {
    pageType = 'unknown',
    priceRange = { min: 50, max: 100000 },
    expectedCurrency = 'USD',
    container = document.body,
    includeOffscreen = false,
    debug = false,
  } = options;
  
  const evidence: Evidence = {
    matchedText: '',
    url: window.location.href,
    hostname: window.location.hostname,
    labelsNearby: [],
    candidateScores: [],
    warnings: [],
  };
  
  try {
    // Step 1: Find all potential price elements
    const candidates = findPriceCandidates(container, priceRange, expectedCurrency, includeOffscreen);
    
    if (debug) {
      console.log('[PriceHeuristics] Found candidates:', candidates.length);
    }
    
    if (candidates.length === 0) {
      return createFailedResult<PriceBreakdown>(
        ['No price candidates found on page'],
        evidence,
        performance.now() - startTime,
        {
          confidenceReasons: ['No elements containing price patterns found'],
          missingSignals: ['Price-like text content'],
        }
      );
    }
    
    // Step 2: Score each candidate
    const scoredCandidates = candidates.map(c => scoreCandidate(c, pageType, debug));
    
    // Step 3: Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // Step 4: Build evidence with top candidates
    evidence.candidateScores = scoredCandidates.slice(0, MAX_EVIDENCE_CANDIDATES).map(c => ({
      text: c.text.substring(0, 100),
      value: c.parsedMoney.money?.amount ?? 0,
      score: c.score,
      reasons: c.reasons,
      penalties: c.penalties,
    }));
    
    // Step 5: Select best candidate
    const best = scoredCandidates[0];
    
    if (!best || best.score < MIN_CANDIDATE_SCORE || !best.parsedMoney.money) {
      return createFailedResult<PriceBreakdown>(
        ['No candidate met minimum score threshold'],
        evidence,
        performance.now() - startTime,
        {
          confidenceReasons: ['Best candidate score too low'],
          missingSignals: ['Strong total price indicators'],
        }
      );
    }
    
    // Step 6: Extract additional breakdown info from nearby elements
    const breakdown = extractBreakdownFromContext(best, scoredCandidates);
    
    // Step 7: Determine confidence based on score and signals (with anchor evidence + ambiguity check)
    const secondBest = scoredCandidates.length > 1 ? scoredCandidates[1] : undefined;
    const confidence = determineConfidence(best, scoredCandidates.length, secondBest, {
      pageType,
      expectedCurrency,
      detectedCurrency: best.parsedMoney.money?.currency,
      stabilityInfo: options.stabilityInfo,
    });
    
    // Build final evidence
    evidence.matchedText = best.text;
    evidence.normalizedValue = best.parsedMoney.money.amount;
    evidence.currency = best.parsedMoney.money.currency;
    evidence.domPath = getDomPath(best.element);
    evidence.labelsNearby = best.reasons.filter(r => r.startsWith('Label:'));
    
    if (best.parsedMoney.isFromPrice) {
      evidence.warnings = evidence.warnings || [];
      evidence.warnings.push('Detected as "from" price - may not be final total');
    }
    
    if (best.parsedMoney.isPerNight) {
      evidence.warnings = evidence.warnings || [];
      evidence.warnings.push('Detected as per-night price');
    }
    
    return createSuccessResult<PriceBreakdown>(
      breakdown,
      confidence,
      'HEURISTIC',
      evidence,
      performance.now() - startTime,
      {
        successfulTier: 3,
        tiersAttempted: [3],
      }
    );
    
  } catch (error) {
    return createFailedResult<PriceBreakdown>(
      [`Heuristic extraction error: ${error instanceof Error ? error.message : String(error)}`],
      evidence,
      performance.now() - startTime
    );
  }
}

// ============================================
// CANDIDATE FINDING
// ============================================

interface RawCandidate {
  element: Element;
  text: string;
  parsedMoney: ParseMoneyResult;
  isInSummaryContainer: boolean;
  isVisible: boolean;
  rect: DOMRect | null;
}

/**
 * Find all elements that potentially contain prices
 */
function findPriceCandidates(
  container: Element | Document,
  priceRange: { min?: number; max?: number },
  expectedCurrency: string,
  includeOffscreen: boolean
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const seen = new Set<string>();
  
  // Find summary containers first (prices here are more likely to be totals)
  const summaryContainers = new Set<Element>();
  for (const selector of SUMMARY_CONTAINER_SELECTORS) {
    try {
      container.querySelectorAll(selector).forEach(el => summaryContainers.add(el));
    } catch {
      // Invalid selector - skip
    }
  }
  
  // Get all elements with text content
  const walker = document.createTreeWalker(
    container instanceof Document ? container.body : container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const text = node.textContent?.trim() || '';
        // Quick filter: must have digits and be reasonable length
        if (text.length < 2 || text.length > 200 || !/\d/.test(text)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let nodeCount = 0;
  let textNode: Text | null;
  
  while ((textNode = walker.nextNode() as Text | null) && nodeCount < MAX_ELEMENTS_TO_SCAN) {
    nodeCount++;
    
    const element = textNode.parentElement;
    if (!element) continue;
    
    const text = textNode.textContent?.trim() || '';
    
    // Skip if already seen this exact text
    if (seen.has(text)) continue;
    seen.add(text);
    
    // Quick check: does this look like a price?
    if (!looksLikePrice(text)) continue;
    
    // Parse the money
    const parsedMoney = parseMoney(text, {
      defaultCurrency: expectedCurrency,
      minAmount: priceRange.min ?? 0,
      maxAmount: priceRange.max ?? Infinity,
    });
    
    if (!parsedMoney.money) continue;
    
    // Check if in valid range
    const amount = parsedMoney.money.amount;
    if ((priceRange.min && amount < priceRange.min) ||
        (priceRange.max && amount > priceRange.max)) {
      continue;
    }
    
    // Check visibility
    const rect = element.getBoundingClientRect();
    const isVisible = isElementVisible(element, rect);
    
    // Skip offscreen if requested
    if (!includeOffscreen && !isInViewport(rect)) {
      continue;
    }
    
    // Check if in summary container
    let isInSummaryContainer = false;
    for (const sc of summaryContainers) {
      if (sc.contains(element)) {
        isInSummaryContainer = true;
        break;
      }
    }
    
    candidates.push({
      element,
      text,
      parsedMoney,
      isInSummaryContainer,
      isVisible,
      rect,
    });
  }
  
  return candidates;
}

// ============================================
// SCORING
// ============================================

/**
 * Score a candidate based on multiple signals
 * Now also tracks anchor evidence for confidence discipline
 */
function scoreCandidate(
  candidate: RawCandidate,
  pageType: string,
  debug: boolean
): ScoredCandidate {
  let score = 50; // Base score
  const reasons: string[] = [];
  const penalties: string[] = [];
  let label: PriceLabel = 'unknown';
  
  // Anchor evidence tracking
  let hasTotalKeywordNearby = false;
  let hasTotalKeywordInText = false;
  let hasAriaTotal = false;
  let hasTestIdTotal = false;
  let isNearCheckoutButton = false;
  
  // Disqualifying qualifiers
  let isPerNight = false;
  let isFromPrice = false;
  let isPerPerson = false;
  
  const text = candidate.text.toLowerCase();
  const element = candidate.element;
  
  // ========== POSITIVE SIGNALS ==========
  
  // In summary container - strong signal for total
  if (candidate.isInSummaryContainer) {
    score += 25;
    reasons.push('+25: In summary/checkout container');
  }
  
  // Check for "total" keywords in nearby context
  const nearbyText = getNearbyText(element, 3);
  const nearbyLower = nearbyText.toLowerCase();
  
  for (const keyword of TOTAL_KEYWORDS) {
    if (nearbyLower.includes(keyword)) {
      score += 30;
      reasons.push(`+30: Label "${keyword}" nearby`);
      label = 'total';
      hasTotalKeywordNearby = true;
      break;
    }
  }
  
  // Check element's own text/attributes for "total"
  if (/total/i.test(text)) {
    score += 20;
    reasons.push('+20: Contains "total" text');
    label = 'total';
    hasTotalKeywordInText = true;
  }
  
  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
  if (ariaLabel.includes('total')) {
    score += 20;
    reasons.push('+20: aria-label contains "total"');
    label = 'total';
    hasAriaTotal = true;
  }
  
  // Check data-testid
  const testId = element.getAttribute('data-testid')?.toLowerCase() || '';
  if (testId.includes('total') || testId.includes('price')) {
    score += 15;
    reasons.push(`+15: data-testid "${testId}"`);
    if (testId.includes('total')) {
      hasTestIdTotal = true;
    }
  }
  
  // Larger font size - totals are often emphasized
  const computedStyle = window.getComputedStyle(element);
  const fontSize = parseFloat(computedStyle.fontSize);
  if (fontSize >= 18) {
    score += 10;
    reasons.push(`+10: Large font (${fontSize}px)`);
  }
  if (fontSize >= 24) {
    score += 5;
    reasons.push('+5: Extra large font');
  }
  
  // Bold text - totals are often bold
  const fontWeight = parseInt(computedStyle.fontWeight, 10);
  if (fontWeight >= 600 || computedStyle.fontWeight === 'bold') {
    score += 8;
    reasons.push('+8: Bold text');
  }
  
  // Higher amount often indicates total (but not always)
  const amount = candidate.parsedMoney.money?.amount ?? 0;
  if (amount > 200) {
    score += 5;
    reasons.push(`+5: Higher amount ($${amount.toFixed(0)})`);
  }
  if (amount > 500) {
    score += 3;
    reasons.push('+3: Substantial amount');
  }
  
  // On checkout page, more confident in totals
  if (pageType === 'checkout' && candidate.isInSummaryContainer) {
    score += 15;
    reasons.push('+15: Checkout page + summary container');
  }
  
  // Near a button (likely confirmation/checkout button)
  const nearbyButton = element.closest('button, [role="button"]') ||
    element.parentElement?.querySelector('button, [role="button"]');
  if (nearbyButton) {
    const buttonText = nearbyButton.textContent?.toLowerCase() || '';
    if (/book|checkout|continue|pay|confirm|complete/i.test(buttonText)) {
      score += 12;
      reasons.push('+12: Near checkout button');
      isNearCheckoutButton = true;
    }
  }
  
  // ========== NEGATIVE SIGNALS ==========
  
  // Per-night pricing
  for (const keyword of PER_NIGHT_KEYWORDS) {
    if (text.includes(keyword) || nearbyLower.includes(keyword)) {
      score -= 35;
      penalties.push(`-35: Per-night indicator "${keyword}"`);
      label = 'perNight';
      isPerNight = true;
      break;
    }
  }
  
  // "From" pricing
  for (const keyword of FROM_KEYWORDS) {
    if (text.includes(keyword) || nearbyLower.includes(keyword)) {
      score -= 30;
      penalties.push(`-30: "From" price indicator "${keyword}"`);
      label = 'from';
      isFromPrice = true;
      break;
    }
  }
  
  // Per-person pricing
  for (const keyword of PER_PERSON_KEYWORDS) {
    if (text.includes(keyword) || nearbyLower.includes(keyword)) {
      score -= 25;
      penalties.push(`-25: Per-person indicator "${keyword}"`);
      label = 'perPerson';
      isPerPerson = true;
      break;
    }
  }
  
  // Taxes/fees only (not total)
  for (const keyword of TAXES_FEES_KEYWORDS) {
    if (nearbyLower.includes(keyword) && !nearbyLower.includes('total')) {
      score -= 20;
      penalties.push(`-20: Taxes/fees indicator "${keyword}"`);
      label = 'taxesFees';
      break;
    }
  }
  
  // Strikethrough/original price
  for (const keyword of STRIKETHROUGH_KEYWORDS) {
    if (nearbyLower.includes(keyword)) {
      score -= 40;
      penalties.push(`-40: Strikethrough indicator "${keyword}"`);
      break;
    }
  }
  
  // Visual strikethrough
  if (computedStyle.textDecoration.includes('line-through')) {
    score -= 45;
    penalties.push('-45: Has strikethrough style');
  }
  
  // Very small font - probably not the main total
  if (fontSize < 12) {
    score -= 10;
    penalties.push(`-10: Small font (${fontSize}px)`);
  }
  
  // Faded/low opacity
  const opacity = parseFloat(computedStyle.opacity);
  if (opacity < 0.7) {
    score -= 15;
    penalties.push(`-15: Low opacity (${opacity})`);
  }
  
  // Multiple prices in same element (likely a list, not a total)
  const priceMatches = text.match(/[\$€£¥₹]\s*[\d,]+/g) || [];
  const priceCountInElement = priceMatches.length;
  const containsMultiplePrices = priceCountInElement > 1;
  if (containsMultiplePrices) {
    score -= 20;
    penalties.push(`-20: Multiple prices in element (${priceCountInElement})`);
  }
  
  // Too many child elements (probably a container)
  const childCount = element.children.length;
  if (childCount > 5) {
    score -= 15;
    penalties.push(`-15: Too many children (${childCount})`);
  }
  
  // Not visible
  if (!candidate.isVisible) {
    score -= 30;
    penalties.push('-30: Element not visible');
  }
  
  // Low parse confidence
  if (candidate.parsedMoney.confidence < 70) {
    score -= 10;
    penalties.push(`-10: Low parse confidence (${candidate.parsedMoney.confidence})`);
  }
  
  if (debug) {
    console.log('[PriceHeuristics] Scored candidate:', {
      text: text.substring(0, 50),
      amount,
      score,
      reasons,
      penalties,
    });
  }
  
  return {
    element,
    text: candidate.text,
    parsedMoney: candidate.parsedMoney,
    score: Math.max(0, score),
    reasons,
    penalties,
    label,
    isInSummaryContainer: candidate.isInSummaryContainer,
    // Anchor evidence
    hasTotalKeywordNearby,
    hasTotalKeywordInText,
    hasAriaTotal,
    hasTestIdTotal,
    isNearCheckoutButton,
    // Disqualifying qualifiers
    isPerNight: isPerNight || candidate.parsedMoney.isPerNight,
    isFromPrice: isFromPrice || candidate.parsedMoney.isFromPrice,
    isPerPerson: isPerPerson || candidate.parsedMoney.isPerPerson,
    // Multi-price detection
    containsMultiplePrices,
    priceCountInElement,
  };
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Try to extract a full price breakdown from the winning candidate's context
 */
function extractBreakdownFromContext(
  best: ScoredCandidate,
  allCandidates: ScoredCandidate[]
): PriceBreakdown {
  const breakdown: PriceBreakdown = {};
  
  // Set the total from the best candidate
  if (best.parsedMoney.money) {
    if (best.label === 'total' || best.label === 'unknown') {
      breakdown.total = best.parsedMoney.money;
    } else if (best.label === 'perNight') {
      breakdown.perNight = best.parsedMoney.money;
    }
  }
  
  // Try to find taxes/fees from other candidates
  for (const candidate of allCandidates) {
    if (candidate === best) continue;
    if (!candidate.parsedMoney.money) continue;
    
    // Found taxes/fees
    if (candidate.label === 'taxesFees') {
      breakdown.taxesFees = candidate.parsedMoney.money;
      
      // If we have taxes and a total, calculate base
      if (breakdown.total && !breakdown.base) {
        breakdown.base = {
          amount: breakdown.total.amount - candidate.parsedMoney.money.amount,
          currency: breakdown.total.currency,
        };
      }
    }
    
    // Found per-night rate
    if (candidate.label === 'perNight' && !breakdown.perNight) {
      breakdown.perNight = candidate.parsedMoney.money;
    }
  }
  
  // Flag "from" prices
  if (best.parsedMoney.isFromPrice) {
    breakdown.isFromPrice = true;
  }
  
  // Flag per-person prices
  if (best.parsedMoney.isPerPerson) {
    breakdown.perPerson = true;
  }
  
  return breakdown;
}

/**
 * Determine confidence level based on score, signals, and anchor evidence
 *
 * TIGHTENED THRESHOLDS (per confidence discipline):
 * - MEDIUM requires ≥1 anchor signal (no more "bare number => MEDIUM")
 * - HIGH requires ≥2 anchors OR 1 strong anchor + context
 * - Gap from runner-up affects confidence (ambiguity penalty)
 * - Disqualifying qualifiers (perNight, from, perPerson) cap at LOW
 *
 * ADDITIONAL GATES (v2):
 * 1. Page intent: search/availability restricts HIGH unless explicit "total for X nights"
 * 2. Currency consistency: mismatch caps confidence unless conversion context
 * 3. Multi-price grid penalty: cap at MEDIUM unless strong total + checkout
 * 4. Stability promotion: stable reads can bump confidence when anchors exist
 */
function determineConfidence(
  best: ScoredCandidate,
  totalCandidates: number,
  secondBest?: ScoredCandidate,
  context?: {
    pageType?: string;
    expectedCurrency?: string;
    detectedCurrency?: string;
    stabilityInfo?: {
      stableReadCount: number;
      stableDurationMs: number;
      priceWasUnstable?: boolean;
    };
  }
): Confidence {
  const score = best.score;
  const gap = secondBest ? (best.score - secondBest.score) : 999;
  
  // ========== ANCHOR EVIDENCE COUNT ==========
  // Signals that this is truly a TOTAL (not just any price)
  const hasTotalLabel = best.label === 'total' || best.hasTotalKeywordNearby || best.hasTotalKeywordInText;
  const hasSemanticTotal = best.hasAriaTotal || best.hasTestIdTotal;
  const inSummary = best.isInSummaryContainer;
  const nearCheckout = best.isNearCheckoutButton;
  const isCheckoutish = context?.pageType === 'checkout' || context?.pageType === 'booking';
  const isSearchOrAvailability = context?.pageType === 'search' || context?.pageType === 'availability';
  
  const anchorCount =
    (hasTotalLabel ? 1 : 0) +
    (hasSemanticTotal ? 1 : 0) +
    (inSummary ? 1 : 0) +
    (nearCheckout ? 1 : 0) +
    (isCheckoutish ? 1 : 0);
  
  // ========== DISQUALIFYING QUALIFIERS ==========
  // If it looks like /night, "from", or per-person, it's NOT a total
  const hasBadQualifier = best.isPerNight || best.isFromPrice || best.isPerPerson;
  
  // ========== AMBIGUITY CHECK ==========
  // Many candidates with small gaps = "not sure which one"
  const ambiguous = (totalCandidates >= 3 && gap < 10) || (totalCandidates >= 6 && gap < 15);
  
  // ========== GATE 1: CURRENCY CONSISTENCY ==========
  // If currency mismatch and no conversion context, cap at MEDIUM
  let currencyMismatch = false;
  if (
    context?.expectedCurrency &&
    context?.detectedCurrency &&
    context.expectedCurrency !== context.detectedCurrency
  ) {
    // Check if there's conversion context in the text (e.g., "≈ USD", "converted", "approx")
    const textLower = best.text.toLowerCase();
    const hasConversionContext = /converted|approx|≈|\~|usd|eur|gbp|in your currency/i.test(textLower);
    
    if (!hasConversionContext) {
      currencyMismatch = true;
    }
  }
  
  // ========== GATE 2: MULTI-PRICE GRID PENALTY ==========
  // Elements with multiple prices are typically lists/grids, not totals
  const isMultiPriceGrid = best.containsMultiplePrices && best.priceCountInElement >= 2;
  const multiPriceGridCanOverride = isMultiPriceGrid && hasTotalLabel && (inSummary || isCheckoutish);
  
  // ========== GATE 3: PAGE INTENT HARD-GATE ==========
  // On search/availability pages, require explicit "total for X nights" patterns for HIGH
  let pageIntentBlocksHigh = false;
  if (isSearchOrAvailability) {
    // On search pages, only allow HIGH if we have very explicit total evidence
    // Look for patterns like "total for 3 nights", "total before taxes"
    const textLower = best.text.toLowerCase();
    const nearbyLower = getNearbyText(best.element, 2).toLowerCase();
    const hasExplicitTotalPattern =
      /total\s+for\s+\d+\s*(night|day)/i.test(nearbyLower) ||
      /total\s+(before|including)\s+tax/i.test(nearbyLower) ||
      /\d+\s*night.*total/i.test(nearbyLower);
    
    if (!hasExplicitTotalPattern) {
      pageIntentBlocksHigh = true;
    }
  }
  
  // ========== GATE 4: STABILITY-BASED PROMOTION ==========
  // If price has been stable, we can promote confidence (only when anchors exist)
  let stabilityPromotion = 0;
  if (context?.stabilityInfo) {
    const { stableReadCount, stableDurationMs, priceWasUnstable } = context.stabilityInfo;
    
    // Stability promotes confidence when:
    // - Same value seen 2+ times over 700ms+
    // - AND not previously unstable
    // - AND has at least one anchor
    if (stableReadCount >= 2 && stableDurationMs >= 700 && !priceWasUnstable && anchorCount >= 1) {
      stabilityPromotion = 1; // Can bump LOW→MEDIUM or MEDIUM→HIGH
    }
    
    // Stronger promotion for very stable (3+ reads, 1s+)
    if (stableReadCount >= 3 && stableDurationMs >= 1000 && !priceWasUnstable && anchorCount >= 2) {
      stabilityPromotion = 2;
    }
    
    // If price was unstable (changed during observation), demote
    if (priceWasUnstable) {
      stabilityPromotion = -1; // Can demote HIGH→MEDIUM
    }
  }
  
  // ========== HARD FLOOR: Bad qualifiers cap at LOW ==========
  if (hasBadQualifier) {
    // Only allow MEDIUM if strong total evidence overrides the qualifier
    if (score >= 70 && hasTotalLabel && (inSummary || hasSemanticTotal) && !ambiguous && gap >= 15) {
      return 'MEDIUM';
    }
    // Otherwise, cap at LOW
    return score >= 35 ? 'LOW' : 'NONE';
  }
  
  // ========== HARD CAP: Multi-price grid without override ==========
  if (isMultiPriceGrid && !multiPriceGridCanOverride) {
    // Cap at MEDIUM even with good score
    const baseConf = score >= 60 && anchorCount >= 1 ? 'MEDIUM' : 'LOW';
    return baseConf;
  }
  
  // ========== COMPUTE BASE CONFIDENCE ==========
  let baseConfidence: Confidence = 'NONE';
  
  // HIGH: Requires strong anchors + clear separation from runner-up
  if (
    score >= 85 &&
    (
      // Very strong anchor stack (3+ anchors including total label)
      (anchorCount >= 3 && hasTotalLabel) ||
      // Explicit "total" plus reliable context
      (hasTotalLabel && (inSummary || hasSemanticTotal || isCheckoutish))
    ) &&
    gap >= 12 &&
    !ambiguous &&
    !pageIntentBlocksHigh // Page intent gate
  ) {
    baseConfidence = 'HIGH';
  }
  // MEDIUM: MUST have at least one anchor signal (NO more "bare 50 => MEDIUM")
  else if (score >= 65 && anchorCount >= 2 && gap >= 8 && !ambiguous) {
    baseConfidence = 'MEDIUM';
  }
  else if (score >= 60 && hasTotalLabel && (inSummary || hasSemanticTotal || nearCheckout)) {
    baseConfidence = 'MEDIUM';
  }
  else if (score >= 55 && hasSemanticTotal) {
    baseConfidence = 'MEDIUM';
  }
  // LOW: Plausible number but not confidently a "total"
  else if (score >= 40) {
    baseConfidence = 'LOW';
  }
  
  // ========== APPLY CURRENCY MISMATCH CAP ==========
  if (currencyMismatch && baseConfidence === 'HIGH') {
    baseConfidence = 'MEDIUM';
  }
  
  // ========== APPLY STABILITY PROMOTION/DEMOTION ==========
  if (stabilityPromotion > 0 && baseConfidence !== 'HIGH') {
    // Promote LOW→MEDIUM or MEDIUM→HIGH
    if (baseConfidence === 'LOW' && stabilityPromotion >= 1) {
      baseConfidence = 'MEDIUM';
    } else if (baseConfidence === 'MEDIUM' && stabilityPromotion >= 2) {
      baseConfidence = 'HIGH';
    }
  } else if (stabilityPromotion < 0 && baseConfidence === 'HIGH') {
    // Demote if unstable
    baseConfidence = 'MEDIUM';
  }
  
  return baseConfidence;
}

// ============================================
// DOM UTILITIES
// ============================================

/**
 * Check if an element is visible (not hidden by CSS)
 */
function isElementVisible(element: Element, rect?: DOMRect | null): boolean {
  const style = window.getComputedStyle(element);
  
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;
  
  // Check dimensions
  const r = rect ?? element.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  
  return true;
}

/**
 * Check if a rect is within the viewport (or near it)
 */
function isInViewport(rect: DOMRect | null): boolean {
  if (!rect) return false;
  
  const margin = 100; // Allow some margin outside viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  return (
    rect.bottom >= -margin &&
    rect.top <= vh + margin &&
    rect.right >= -margin &&
    rect.left <= vw + margin
  );
}

/**
 * Get text from nearby elements for context
 */
function getNearbyText(element: Element, depth: number = 2): string {
  const texts: string[] = [];
  
  // Get text from parent chain
  let current: Element | null = element;
  for (let i = 0; i < depth && current; i++) {
    const parentEl: Element | null = current.parentElement;
    if (parentEl) {
      // Get sibling text
      for (const child of parentEl.children) {
        const text = child.textContent?.trim();
        if (text && text.length < 100) {
          texts.push(text);
        }
      }
      current = parentEl;
    } else {
      break;
    }
  }
  
  // Get text from siblings
  if (element.previousElementSibling) {
    texts.push(element.previousElementSibling.textContent?.trim() || '');
  }
  if (element.nextElementSibling) {
    texts.push(element.nextElementSibling.textContent?.trim() || '');
  }
  
  // Get aria-label and data attributes
  texts.push(element.getAttribute('aria-label') || '');
  texts.push(element.getAttribute('data-testid') || '');
  
  return texts.filter(Boolean).join(' ');
}

/**
 * Get a human-readable DOM path
 */
function getDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.body && parts.length < 5) {
    let selector = current.tagName.toLowerCase();
    
    // Add id if present
    if (current.id) {
      selector += `#${current.id}`;
    }
    // Add most relevant class
    else if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ')
        .filter(c => c && !c.match(/^[a-z]{20,}$/)) // Filter out obfuscated classes
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

// ============================================
// SPECIALIZED EXTRACTORS
// ============================================

/**
 * Extract price specifically for flights
 */
export function extractFlightPrice(
  options: HeuristicOptions = {}
): ExtractionResult<PriceBreakdown> {
  return extractPriceHeuristically({
    ...options,
    priceRange: { min: 50, max: 50000 },
  });
}

/**
 * Extract price specifically for hotels/stays
 */
export function extractStayPrice(
  options: HeuristicOptions = {}
): ExtractionResult<PriceBreakdown> {
  return extractPriceHeuristically({
    ...options,
    priceRange: { min: 50, max: 100000 },
  });
}

/**
 * Quick check: is there any extractable price on the page?
 */
export function hasExtractablePrice(
  options: HeuristicOptions = {}
): boolean {
  const result = extractPriceHeuristically(options);
  return result.ok && result.confidence !== 'NONE';
}

/**
 * Get all price candidates with scores (for debugging/UI)
 */
export function getAllPriceCandidates(
  options: HeuristicOptions = {}
): CandidateScore[] {
  const result = extractPriceHeuristically({ ...options, debug: false });
  return result.evidence.candidateScores || [];
}
