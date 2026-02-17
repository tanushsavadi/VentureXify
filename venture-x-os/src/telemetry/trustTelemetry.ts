/**
 * Trust Telemetry Service
 * 
 * Logs anonymized user feedback events for improving RAG quality.
 * All data is sanitized for PII before sending to telemetry endpoint.
 * 
 * @module telemetry/trustTelemetry
 */

import { redactPII, hashText, sanitizeUserInput } from '../privacy/logRedaction';
import type { ChunkWithProvenance } from '../knowledge/sourceMetadata';
import type { CitedSpan } from '../response/spanLevelCitation';

/**
 * Types of trust-related events
 */
export type TrustEventType = 
  | 'feedback_negative'      // User indicated response was wrong
  | 'feedback_positive'      // User indicated response was helpful
  | 'claim_disputed'         // User disputed a specific claim
  | 'source_questioned'      // User questioned a source's accuracy
  | 'missing_info'           // User indicated info was incomplete
  | 'stale_content'          // User reported outdated information
  | 'injection_blocked';     // Potential prompt injection was blocked

/**
 * Trust telemetry event structure
 */
export interface TrustEvent {
  /** Type of event */
  eventType: TrustEventType;
  
  /** ISO timestamp */
  timestamp: string;
  
  /** Anonymous session ID */
  sessionId: string;
  
  /** Hash of the user's query (not the query itself) */
  queryHash: string;
  
  /** First 100 chars of response (redacted) */
  responsePreview: string;
  
  /** IDs of chunks retrieved for this response */
  retrievalIds: string[];
  
  /** Scores of retrieved chunks */
  retrievalScores: number[];
  
  /** Trust tiers of retrieved sources */
  retrievalTrustTiers: number[];
  
  /** Optional user feedback text (redacted) */
  feedbackText?: string;
  
  /** Which claim was disputed (if applicable) */
  disputedClaim?: string;
  
  /** Intent classification used */
  intentClassification: string;
  
  /** Whether compute engine was used */
  computeIntentUsed: boolean;
  
  /** Number of citations in response */
  citationCount: number;
  
  /** Extension version */
  extensionVersion: string;
  
  /** Browser type */
  browserType: string;
}

/**
 * Configuration for telemetry service
 */
export interface TelemetryConfig {
  /** Telemetry endpoint URL */
  endpoint: string;
  
  /** Whether telemetry is enabled */
  enabled: boolean;
  
  /** Maximum events to queue before forcing send */
  maxQueueSize: number;
  
  /** Interval in ms to flush queue */
  flushInterval: number;
  
  /** Extension version */
  extensionVersion: string;
}

/**
 * Default telemetry configuration
 */
const DEFAULT_CONFIG: TelemetryConfig = {
  endpoint: '', // Must be set by caller
  enabled: false, // Disabled by default until endpoint is configured
  maxQueueSize: 10,
  flushInterval: 30000, // 30 seconds
  extensionVersion: '0.0.0',
};

/**
 * Trust Telemetry Service
 * 
 * Collects anonymized feedback events for improving RAG quality.
 * All personal data is stripped before transmission.
 */
export class TrustTelemetryService {
  private config: TelemetryConfig;
  private eventQueue: TrustEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start flush timer if enabled
    if (this.config.enabled && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Update configuration
   */
  configure(config: Partial<TelemetryConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...config };
    
    // Handle enable/disable changes
    if (this.config.enabled && !wasEnabled) {
      this.startFlushTimer();
    } else if (!this.config.enabled && wasEnabled) {
      this.stopFlushTimer();
    }
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.endpoint.length > 0;
  }

  /**
   * Log when user indicates response was wrong
   */
  async logNegativeFeedback(
    query: string,
    response: string,
    retrievedChunks: ChunkWithProvenance[],
    userComment?: string,
    options: {
      intentClassification?: string;
      computeIntentUsed?: boolean;
      citationCount?: number;
    } = {}
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const event = await this.createBaseEvent('feedback_negative', query, response, retrievedChunks);
    
    event.feedbackText = userComment ? sanitizeUserInput(userComment, 500) : undefined;
    event.intentClassification = options.intentClassification || 'unknown';
    event.computeIntentUsed = options.computeIntentUsed || false;
    event.citationCount = options.citationCount || 0;
    
    await this.queueEvent(event);
  }

  /**
   * Log when user indicates response was helpful
   */
  async logPositiveFeedback(
    query: string,
    response: string,
    retrievedChunks: ChunkWithProvenance[],
    options: {
      intentClassification?: string;
      computeIntentUsed?: boolean;
      citationCount?: number;
    } = {}
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const event = await this.createBaseEvent('feedback_positive', query, response, retrievedChunks);
    
    event.intentClassification = options.intentClassification || 'unknown';
    event.computeIntentUsed = options.computeIntentUsed || false;
    event.citationCount = options.citationCount || 0;
    
    await this.queueEvent(event);
  }

  /**
   * Log when user disputes a specific claim
   */
  async logClaimDisputed(
    claim: string,
    supportingSpans: CitedSpan[],
    userCorrection?: string
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const event: TrustEvent = {
      eventType: 'claim_disputed',
      timestamp: new Date().toISOString(),
      sessionId: await this.getSessionId(),
      queryHash: '',
      responsePreview: '',
      retrievalIds: supportingSpans.map(s => s.docId),
      retrievalScores: [],
      retrievalTrustTiers: supportingSpans.map(s => s.trustTier),
      disputedClaim: sanitizeUserInput(claim, 200),
      feedbackText: userCorrection ? sanitizeUserInput(userCorrection, 500) : undefined,
      intentClassification: '',
      computeIntentUsed: false,
      citationCount: supportingSpans.length,
      extensionVersion: this.config.extensionVersion,
      browserType: this.getBrowserType(),
    };
    
    await this.queueEvent(event);
  }

  /**
   * Log when user questions a source's accuracy
   */
  async logSourceQuestioned(
    sourceId: string,
    sourceTrustTier: number,
    userComment?: string
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const event: TrustEvent = {
      eventType: 'source_questioned',
      timestamp: new Date().toISOString(),
      sessionId: await this.getSessionId(),
      queryHash: '',
      responsePreview: '',
      retrievalIds: [sourceId],
      retrievalScores: [],
      retrievalTrustTiers: [sourceTrustTier],
      feedbackText: userComment ? sanitizeUserInput(userComment, 500) : undefined,
      intentClassification: '',
      computeIntentUsed: false,
      citationCount: 0,
      extensionVersion: this.config.extensionVersion,
      browserType: this.getBrowserType(),
    };
    
    await this.queueEvent(event);
  }

  /**
   * Log when stale content is reported
   */
  async logStaleContent(
    sourceId: string,
    retrievedAt: string,
    userComment?: string
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const event: TrustEvent = {
      eventType: 'stale_content',
      timestamp: new Date().toISOString(),
      sessionId: await this.getSessionId(),
      queryHash: '',
      responsePreview: `Retrieved at: ${retrievedAt}`,
      retrievalIds: [sourceId],
      retrievalScores: [],
      retrievalTrustTiers: [],
      feedbackText: userComment ? sanitizeUserInput(userComment, 500) : undefined,
      intentClassification: '',
      computeIntentUsed: false,
      citationCount: 0,
      extensionVersion: this.config.extensionVersion,
      browserType: this.getBrowserType(),
    };
    
    await this.queueEvent(event);
  }

  /**
   * Log when prompt injection is blocked
   */
  async logInjectionBlocked(
    sourceId: string,
    sourceTrustTier: number,
    patternMatched: string
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const event: TrustEvent = {
      eventType: 'injection_blocked',
      timestamp: new Date().toISOString(),
      sessionId: await this.getSessionId(),
      queryHash: '',
      responsePreview: `Pattern: ${patternMatched}`,
      retrievalIds: [sourceId],
      retrievalScores: [],
      retrievalTrustTiers: [sourceTrustTier],
      intentClassification: '',
      computeIntentUsed: false,
      citationCount: 0,
      extensionVersion: this.config.extensionVersion,
      browserType: this.getBrowserType(),
    };
    
    await this.queueEvent(event);
  }

  /**
   * Flush all queued events immediately
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];
    
    await this.sendEvents(eventsToSend);
  }

  /**
   * Get aggregated statistics (for debugging/monitoring)
   */
  getStats(): {
    queueSize: number;
    enabled: boolean;
    hasEndpoint: boolean;
  } {
    return {
      queueSize: this.eventQueue.length,
      enabled: this.config.enabled,
      hasEndpoint: this.config.endpoint.length > 0,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopFlushTimer();
    this.eventQueue = [];
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Create base event with common fields
   */
  private async createBaseEvent(
    eventType: TrustEventType,
    query: string,
    response: string,
    retrievedChunks: ChunkWithProvenance[]
  ): Promise<TrustEvent> {
    return {
      eventType,
      timestamp: new Date().toISOString(),
      sessionId: await this.getSessionId(),
      queryHash: await hashText(query),
      responsePreview: redactPII(response.slice(0, 100)),
      retrievalIds: retrievedChunks.map(c => c.id),
      retrievalScores: retrievedChunks.map(c => c.score || 0),
      retrievalTrustTiers: retrievedChunks.map(c => c.metadata.trustTier),
      intentClassification: '',
      computeIntentUsed: false,
      citationCount: 0,
      extensionVersion: this.config.extensionVersion,
      browserType: this.getBrowserType(),
    };
  }

  /**
   * Queue an event for sending
   */
  private async queueEvent(event: TrustEvent): Promise<void> {
    this.eventQueue.push(event);
    
    // Flush if queue is full
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      await this.flush();
    }
  }

  /**
   * Send events to telemetry endpoint
   */
  private async sendEvents(events: TrustEvent[]): Promise<void> {
    if (!this.config.endpoint || events.length === 0) return;

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        console.warn(`[Telemetry] Failed to send events: ${response.status}`);
      }
    } catch (error) {
      // Fail silently - telemetry should never break the app
      console.warn('[Telemetry] Failed to send events:', error);
    }
  }

  /**
   * Get or create anonymous session ID
   */
  private async getSessionId(): Promise<string> {
    // Return cached session ID if available
    if (this.sessionId) {
      return this.sessionId;
    }

    // Try to get from Chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      try {
        const storage = await chrome.storage.session.get(['anonymousSessionId']);
        if (storage.anonymousSessionId) {
          this.sessionId = storage.anonymousSessionId;
          return storage.anonymousSessionId;
        }
        
        // Create new session ID
        const newId = crypto.randomUUID();
        await chrome.storage.session.set({ anonymousSessionId: newId });
        this.sessionId = newId;
        return newId;
      } catch {
        // Ignore storage errors
      }
    }

    // Fallback to in-memory session ID
    const fallbackId = crypto.randomUUID();
    this.sessionId = fallbackId;
    return fallbackId;
  }

  /**
   * Detect browser type
   */
  private getBrowserType(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('chrome') && !ua.includes('edg')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('edg')) return 'edge';
    if (ua.includes('opera') || ua.includes('opr')) return 'opera';
    
    return 'other';
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        console.warn('[Telemetry] Flush failed:', err);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop periodic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * Create a telemetry service instance
 */
export function createTelemetryService(config?: Partial<TelemetryConfig>): TrustTelemetryService {
  return new TrustTelemetryService(config);
}

/**
 * Default singleton instance (disabled until configured)
 */
export const defaultTelemetryService = new TrustTelemetryService();

/**
 * React hook for telemetry (to be used with context)
 */
export function useTrustTelemetry(): TrustTelemetryService {
  return defaultTelemetryService;
}
