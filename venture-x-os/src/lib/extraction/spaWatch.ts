// ============================================
// SPA WATCH - SPA & Lazy-Load Reliability
// ============================================
// Handles SPAs, lazy-loaded content, and price stability
// - Hooks history.pushState + replaceState
// - MutationObserver for DOM changes
// - Debounced triggers with adaptive backoff
// - Stability windows for price confirmation

import { runExtractionPipeline, PipelineResult } from './pipeline';

// ============================================
// TYPES
// ============================================

export interface SPAWatchOptions {
  /** Debounce delay for extraction triggers (ms) */
  debounceDelay?: number;
  
  /** Number of stable observations required */
  stabilityCount?: number;
  
  /** Time window for stability check (ms) */
  stabilityWindow?: number;
  
  /** Maximum time to wait for any result (ms) */
  maxWaitTime?: number;
  
  /** Selectors for containers to watch (narrows scope) */
  watchContainers?: string[];
  
  /** Callback when a new extraction is available */
  onExtraction?: (result: PipelineResult) => void;
  
  /** Callback when price stabilizes */
  onStable?: (result: PipelineResult) => void;
  
  /** Callback when navigation detected */
  onNavigation?: (url: string) => void;
  
  /** Callback on extraction errors */
  onError?: (error: Error) => void;
  
  /** Enable debug logging */
  debug?: boolean;
}

interface StabilityObservation {
  amount: number;
  currency: string;
  timestamp: number;
  confidence: string;
}

/**
 * Stability info exposed to heuristics for confidence promotion/demotion
 */
export interface StabilityInfo {
  /** Number of consecutive reads with same value */
  stableReadCount: number;
  /** Duration price has been stable (ms) */
  stableDurationMs: number;
  /** Whether price changed during observation window */
  priceWasUnstable: boolean;
  /** First observation timestamp */
  firstObservationAt?: number;
  /** Last observation timestamp */
  lastObservationAt?: number;
}

// ============================================
// SPA WATCHER CLASS
// ============================================

export class SPAWatcher {
  private options: Required<SPAWatchOptions>;
  private observer: MutationObserver | null = null;
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private stabilityTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimeout: ReturnType<typeof setTimeout> | null = null;
  private observations: StabilityObservation[] = [];
  private lastUrl: string;
  private lastResult: PipelineResult | null = null;
  private isActive: boolean = false;
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  
  // Stability tracking for confidence promotion
  private stabilityInfo: StabilityInfo = {
    stableReadCount: 0,
    stableDurationMs: 0,
    priceWasUnstable: false,
  };
  
  constructor(options: SPAWatchOptions = {}) {
    this.options = {
      debounceDelay: options.debounceDelay ?? 500,
      stabilityCount: options.stabilityCount ?? 2,
      stabilityWindow: options.stabilityWindow ?? 1000,
      maxWaitTime: options.maxWaitTime ?? 30000,
      watchContainers: options.watchContainers ?? [],
      onExtraction: options.onExtraction ?? (() => {}),
      onStable: options.onStable ?? (() => {}),
      onNavigation: options.onNavigation ?? (() => {}),
      onError: options.onError ?? (() => {}),
      debug: options.debug ?? false,
    };
    
    this.lastUrl = window.location.href;
  }
  
  /**
   * Start watching for changes
   */
  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    
    this.log('Starting SPA watcher');
    
    // Hook history API
    this.hookHistory();
    
    // Set up popstate listener
    window.addEventListener('popstate', this.handleNavigation);
    
    // Set up mutation observer
    this.startMutationObserver();
    
    // Start max wait timer
    this.startMaxWaitTimer();
    
    // Initial extraction
    this.triggerExtraction();
  }
  
  /**
   * Stop watching
   */
  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    
    this.log('Stopping SPA watcher');
    
    // Clear timers
    this.clearDebounce();
    this.clearStabilityTimeout();
    this.clearMaxWaitTimer();
    
    // Stop mutation observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Restore history API
    this.unhookHistory();
    
    // Remove popstate listener
    window.removeEventListener('popstate', this.handleNavigation);
    
    // Clear observations
    this.observations = [];
  }
  
  /**
   * Get current result
   */
  getLastResult(): PipelineResult | null {
    return this.lastResult;
  }
  
  /**
   * Force a new extraction
   */
  async forceExtraction(): Promise<PipelineResult> {
    this.observations = [];
    return this.runExtraction();
  }
  
  /**
   * Check if price is stable
   */
  isStable(): boolean {
    return this.checkStability() !== null;
  }
  
  /**
   * Get current stability info (for passing to heuristics)
   */
  getStabilityInfo(): StabilityInfo {
    return { ...this.stabilityInfo };
  }
  
  // ==========================================
  // PRIVATE METHODS
  // ==========================================
  
  private log(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[SPAWatcher] ${message}`, ...args);
    }
  }
  
  private hookHistory(): void {
    // Save originals
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);
    
    // Hook pushState
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      this.originalPushState?.(...args);
      this.handleNavigation();
    };
    
    // Hook replaceState
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      this.originalReplaceState?.(...args);
      this.handleNavigation();
    };
  }
  
  private unhookHistory(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
  }
  
  private handleNavigation = (): void => {
    const currentUrl = window.location.href;
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      this.log('Navigation detected:', currentUrl);
      
      // Clear previous observations and stability info
      this.observations = [];
      this.resetStabilityInfo();
      
      // Notify
      this.options.onNavigation(currentUrl);
      
      // Trigger extraction after short delay
      setTimeout(() => {
        this.triggerExtraction();
      }, 300);
    }
  };
  
  private startMutationObserver(): void {
    // Determine what to observe
    let targetNode: Node = document.body;
    
    // Try to narrow scope to specific containers
    if (this.options.watchContainers.length > 0) {
      for (const selector of this.options.watchContainers) {
        const container = document.querySelector(selector);
        if (container) {
          targetNode = container;
          this.log('Watching container:', selector);
          break;
        }
      }
    }
    
    this.observer = new MutationObserver((mutations) => {
      // Filter for meaningful mutations
      const meaningfulMutation = mutations.some(m => {
        // Ignore our own widget changes
        if (m.target instanceof Element && this.isOurWidget(m.target)) {
          return false;
        }
        
        // Check for price-related changes
        if (m.type === 'characterData') {
          const text = m.target.textContent || '';
          return /[\$€£¥₹]\d|total|price/i.test(text);
        }
        
        if (m.type === 'childList') {
          return m.addedNodes.length > 0 || m.removedNodes.length > 0;
        }
        
        return false;
      });
      
      if (meaningfulMutation) {
        this.triggerExtraction();
      }
    });
    
    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false, // Skip attribute changes (less important)
    });
  }
  
  private isOurWidget(element: Element): boolean {
    return !!(
      element.closest('#vx-direct-helper') ||
      element.closest('#vx-auto-compare-widget') ||
      element.closest('[class*="vx-"]') ||
      element.closest('[id^="vx-"]')
    );
  }
  
  private triggerExtraction(): void {
    this.clearDebounce();
    
    this.debounceTimeout = setTimeout(async () => {
      await this.runExtraction();
    }, this.options.debounceDelay);
  }
  
  private async runExtraction(): Promise<PipelineResult> {
    try {
      const result = await runExtractionPipeline({
        debug: this.options.debug,
      });
      
      this.lastResult = result;
      this.log('Extraction complete:', result.ok, result.confidence);
      
      // Notify of extraction
      this.options.onExtraction(result);
      
      // Record observation for stability
      if (result.ok && result.value?.total) {
        this.recordObservation(result);
      }
      
      // Check stability
      const stablePrice = this.checkStability();
      if (stablePrice !== null) {
        this.log('Price stable:', stablePrice);
        this.options.onStable(result);
        this.clearMaxWaitTimer();
      }
      
      return result;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('Extraction error:', err);
      this.options.onError(err);
      throw err;
    }
  }
  
  private recordObservation(result: PipelineResult): void {
    if (!result.value?.total) return;
    
    const now = Date.now();
    const observation: StabilityObservation = {
      amount: result.value.total.amount,
      currency: result.value.total.currency,
      timestamp: now,
      confidence: result.confidence,
    };
    
    // Track stability info before adding new observation
    this.updateStabilityInfo(observation);
    
    this.observations.push(observation);
    
    // Keep only recent observations
    const cutoff = now - this.options.stabilityWindow * 2;
    this.observations = this.observations.filter(o => o.timestamp > cutoff);
  }
  
  /**
   * Update stability tracking info for confidence promotion/demotion
   */
  private updateStabilityInfo(newObservation: StabilityObservation): void {
    const now = newObservation.timestamp;
    
    if (this.observations.length === 0) {
      // First observation
      this.stabilityInfo = {
        stableReadCount: 1,
        stableDurationMs: 0,
        priceWasUnstable: false,
        firstObservationAt: now,
        lastObservationAt: now,
      };
      return;
    }
    
    // Get the last observation
    const lastObs = this.observations[this.observations.length - 1];
    const isSameValue = Math.abs(lastObs.amount - newObservation.amount) < 0.01;
    
    if (isSameValue) {
      // Price is stable - increment count and duration
      this.stabilityInfo.stableReadCount++;
      this.stabilityInfo.stableDurationMs = now - (this.stabilityInfo.firstObservationAt ?? now);
      this.stabilityInfo.lastObservationAt = now;
    } else {
      // Price changed - reset stability, mark as was unstable
      this.stabilityInfo = {
        stableReadCount: 1,
        stableDurationMs: 0,
        priceWasUnstable: true, // Mark that we've seen instability
        firstObservationAt: now,
        lastObservationAt: now,
      };
    }
  }
  
  /**
   * Reset stability info (call on navigation)
   */
  private resetStabilityInfo(): void {
    this.stabilityInfo = {
      stableReadCount: 0,
      stableDurationMs: 0,
      priceWasUnstable: false,
    };
  }
  
  private checkStability(): number | null {
    const { stabilityCount, stabilityWindow } = this.options;
    const now = Date.now();
    
    // Get recent observations
    const recent = this.observations.filter(
      o => now - o.timestamp < stabilityWindow
    );
    
    if (recent.length < stabilityCount) {
      return null;
    }
    
    // Check if all recent observations have the same amount
    const amounts = recent.map(o => o.amount);
    const allSame = amounts.every(a => Math.abs(a - amounts[0]) < 0.01);
    
    if (allSame) {
      return amounts[0];
    }
    
    return null;
  }
  
  private clearDebounce(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  }
  
  private clearStabilityTimeout(): void {
    if (this.stabilityTimeout) {
      clearTimeout(this.stabilityTimeout);
      this.stabilityTimeout = null;
    }
  }
  
  private startMaxWaitTimer(): void {
    this.clearMaxWaitTimer();
    
    this.maxWaitTimeout = setTimeout(() => {
      this.log('Max wait time reached');
      
      // Return best result so far
      if (this.lastResult && this.lastResult.ok) {
        this.options.onStable(this.lastResult);
      }
    }, this.options.maxWaitTime);
  }
  
  private clearMaxWaitTimer(): void {
    if (this.maxWaitTimeout) {
      clearTimeout(this.maxWaitTimeout);
      this.maxWaitTimeout = null;
    }
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Create and start a watcher with common options
 */
export function watchForPrice(
  onStable: (result: PipelineResult) => void,
  options?: Partial<SPAWatchOptions>
): SPAWatcher {
  const watcher = new SPAWatcher({
    ...options,
    onStable,
  });
  watcher.start();
  return watcher;
}

/**
 * Wait for a stable price extraction
 */
export function waitForStablePrice(
  timeout: number = 15000
): Promise<PipelineResult> {
  return new Promise((resolve, reject) => {
    const watcher = new SPAWatcher({
      maxWaitTime: timeout,
      onStable: (result) => {
        watcher.stop();
        resolve(result);
      },
      onError: (error) => {
        watcher.stop();
        reject(error);
      },
    });
    
    watcher.start();
    
    // Fallback timeout
    setTimeout(() => {
      const result = watcher.getLastResult();
      watcher.stop();
      
      if (result) {
        resolve(result);
      } else {
        reject(new Error('No price found within timeout'));
      }
    }, timeout);
  });
}

/**
 * Watch for URL changes only (no DOM observation)
 */
export function watchNavigation(
  onNavigate: (url: string) => void
): () => void {
  let lastUrl = window.location.href;
  
  // Hook history
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  
  const checkUrl = (): void => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      onNavigate(currentUrl);
    }
  };
  
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    checkUrl();
  };
  
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    checkUrl();
  };
  
  const handlePopState = (): void => checkUrl();
  window.addEventListener('popstate', handlePopState);
  
  // Cleanup function
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', handlePopState);
  };
}

// ============================================
// SHADOW DOM UTILITIES
// ============================================

/**
 * Traverse all roots including open shadow DOMs
 */
export function* traverseAllRoots(
  root: Document | ShadowRoot = document
): Generator<Document | ShadowRoot> {
  yield root;
  
  // Find elements with shadow roots
  const walker = document.createTreeWalker(
    root instanceof Document ? root.body : root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node instanceof Element && node.shadowRoot) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node instanceof Element && node.shadowRoot) {
      yield* traverseAllRoots(node.shadowRoot);
    }
  }
}

/**
 * Query selector across all shadow roots
 */
export function querySelectorAllRoots(
  selector: string,
  root: Document | ShadowRoot = document
): Element[] {
  const results: Element[] = [];
  
  for (const r of traverseAllRoots(root)) {
    try {
      const elements = r.querySelectorAll(selector);
      results.push(...Array.from(elements));
    } catch {
      // Invalid selector or access error
    }
  }
  
  return results;
}

/**
 * Find first element across all shadow roots
 */
export function querySelectorInAllRoots(
  selector: string,
  root: Document | ShadowRoot = document
): Element | null {
  for (const r of traverseAllRoots(root)) {
    try {
      const element = r.querySelector(selector);
      if (element) return element;
    } catch {
      // Invalid selector or access error
    }
  }
  
  return null;
}
