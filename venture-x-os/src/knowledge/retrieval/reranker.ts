/**
 * Lightweight Re-ranker for RAG Pipeline
 *
 * Uses cross-encoder model to re-rank retrieved documents for better relevance.
 * Implements timeout fallback to avoid blocking on slow API responses.
 *
 * NEW: Tier-based filtering for policy vs optimization queries
 * - Policy queries: Only Tier 0 (official Capital One) sources
 * - Optimization queries: Tier 0 + Tier 1 (trusted guides)
 * - General queries: All tiers with proper labeling
 *
 * @module knowledge/retrieval/reranker
 */

import type { ChunkWithProvenance } from '../sourceMetadata';
import {
  type SourceTier,
  type QueryIntent,
  detectQueryIntent,
  getAllowedTiersForIntent,
  extractEffectiveDates,
  type ExtractedDate,
} from '../sources/venturexSources';

/**
 * Configuration for the reranker
 */
export interface RerankerConfig {
  /** Maximum number of documents to rerank (avoid rate limits) */
  maxDocs: number;
  /** Timeout in milliseconds before falling back to original order */
  timeoutMs: number;
  /** HuggingFace API endpoint for cross-encoder model */
  apiEndpoint: string;
  /** Maximum content length to send per document */
  maxContentLength: number;
  /** Minimum score threshold for inclusion */
  minScore: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RerankerConfig = {
  maxDocs: 20,
  timeoutMs: 2000,
  apiEndpoint: 'https://api-inference.huggingface.co/models/cross-encoder/ms-marco-MiniLM-L-6-v2',
  maxContentLength: 300,
  minScore: 0.0,
};

/**
 * Result from reranking operation
 */
export interface RerankedResult {
  /** Original document with provenance */
  document: ChunkWithProvenance;
  /** Original rank before reranking */
  originalRank: number;
  /** New rank after reranking */
  newRank: number;
  /** Reranker score (0-1) */
  rerankScore: number;
  /** Whether reranking was applied (vs fallback) */
  wasReranked: boolean;
}

/**
 * Statistics from reranking operation
 */
export interface RerankerStats {
  /** Total documents received */
  inputCount: number;
  /** Documents sent to reranker */
  rerankedCount: number;
  /** Time taken in milliseconds */
  latencyMs: number;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Reason for fallback if applicable */
  fallbackReason?: string;
}

/**
 * Lightweight cross-encoder reranker
 * 
 * Optimized for production use with:
 * - Strict document limits to avoid rate limiting
 * - Timeout fallback for reliability
 * - Graceful degradation on errors
 */
export class LightweightReranker {
  private readonly config: RerankerConfig;
  private apiKey: string | null = null;

  constructor(config: Partial<RerankerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set API key for HuggingFace
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Get API key from storage or config
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    // Try to get from Chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const storage = await chrome.storage.local.get(['hf_api_key']);
        if (storage.hf_api_key) {
          return storage.hf_api_key;
        }
      } catch {
        // Ignore storage errors
      }
    }

    // Return empty string - will cause 401 but won't crash
    return '';
  }

  /**
   * Rerank documents based on relevance to query
   * 
   * @param query - User's search query
   * @param documents - Documents to rerank
   * @returns Reranked documents with scores
   */
  async rerank(
    query: string,
    documents: ChunkWithProvenance[]
  ): Promise<{ results: RerankedResult[]; stats: RerankerStats }> {
    const startTime = Date.now();
    
    // Initialize stats
    const stats: RerankerStats = {
      inputCount: documents.length,
      rerankedCount: 0,
      latencyMs: 0,
      usedFallback: false,
    };

    // Handle empty input
    if (documents.length === 0) {
      stats.latencyMs = Date.now() - startTime;
      return { results: [], stats };
    }

    // Limit documents to avoid rate limits
    const toRerank = documents.slice(0, this.config.maxDocs);
    const remaining = documents.slice(this.config.maxDocs);

    try {
      // Get API key
      const apiKey = await this.getApiKey();
      
      if (!apiKey) {
        console.warn('[Reranker] No API key available, using fallback order');
        stats.usedFallback = true;
        stats.fallbackReason = 'no_api_key';
        return this.createFallbackResult(documents, stats, startTime);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      // Prepare inputs for cross-encoder
      const inputs = toRerank.map(doc => [
        query,
        doc.content.slice(0, this.config.maxContentLength),
      ]);

      // Call HuggingFace API
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ inputs }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle API errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(`[Reranker] API error ${response.status}: ${errorText}`);
        stats.usedFallback = true;
        stats.fallbackReason = `api_error_${response.status}`;
        return this.createFallbackResult(documents, stats, startTime);
      }

      // Parse scores
      const scores = await response.json() as number[];
      
      if (!Array.isArray(scores) || scores.length !== toRerank.length) {
        console.warn('[Reranker] Invalid response format, using fallback');
        stats.usedFallback = true;
        stats.fallbackReason = 'invalid_response';
        return this.createFallbackResult(documents, stats, startTime);
      }

      // Apply scores and sort
      const scoredDocs: RerankedResult[] = toRerank.map((doc, idx) => ({
        document: doc,
        originalRank: idx,
        newRank: 0, // Will be set after sorting
        rerankScore: this.normalizeScore(scores[idx]),
        wasReranked: true,
      }));

      // Sort by rerank score descending
      scoredDocs.sort((a, b) => b.rerankScore - a.rerankScore);

      // Assign new ranks
      scoredDocs.forEach((doc, idx) => {
        doc.newRank = idx;
      });

      // Filter by minimum score
      const filteredDocs = scoredDocs.filter(doc => doc.rerankScore >= this.config.minScore);

      // Append remaining documents that weren't reranked
      const unrerankedDocs: RerankedResult[] = remaining.map((doc, idx) => ({
        document: doc,
        originalRank: this.config.maxDocs + idx,
        newRank: filteredDocs.length + idx,
        rerankScore: 0,
        wasReranked: false,
      }));

      // Combine results
      const results = [...filteredDocs, ...unrerankedDocs];

      // Update stats
      stats.rerankedCount = toRerank.length;
      stats.latencyMs = Date.now() - startTime;

      return { results, stats };

    } catch (error: unknown) {
      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[Reranker] Timeout exceeded, using fallback order');
        stats.usedFallback = true;
        stats.fallbackReason = 'timeout';
      } else {
        console.warn('[Reranker] Error during reranking:', error);
        stats.usedFallback = true;
        stats.fallbackReason = 'exception';
      }

      return this.createFallbackResult(documents, stats, startTime);
    }
  }

  /**
   * Create fallback result preserving original order
   */
  private createFallbackResult(
    documents: ChunkWithProvenance[],
    stats: RerankerStats,
    startTime: number
  ): { results: RerankedResult[]; stats: RerankerStats } {
    const results: RerankedResult[] = documents.map((doc, idx) => ({
      document: doc,
      originalRank: idx,
      newRank: idx,
      rerankScore: 0,
      wasReranked: false,
    }));

    stats.latencyMs = Date.now() - startTime;
    return { results, stats };
  }

  /**
   * Normalize score to 0-1 range
   * Cross-encoders typically output logits, we apply sigmoid
   */
  private normalizeScore(score: number): number {
    // Apply sigmoid to convert logit to probability
    const sigmoid = 1 / (1 + Math.exp(-score));
    // Clamp to valid range
    return Math.max(0, Math.min(1, sigmoid));
  }

  /**
   * Batch rerank multiple queries (for pre-warming cache)
   */
  async batchRerank(
    queries: Array<{ query: string; documents: ChunkWithProvenance[] }>
  ): Promise<Array<{ results: RerankedResult[]; stats: RerankerStats }>> {
    // Process sequentially to avoid rate limiting
    const results: Array<{ results: RerankedResult[]; stats: RerankerStats }> = [];
    
    for (const { query, documents } of queries) {
      const result = await this.rerank(query, documents);
      results.push(result);
      
      // Small delay between batches to avoid rate limiting
      if (queries.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Get configuration (for debugging/monitoring)
   */
  getConfig(): RerankerConfig {
    return { ...this.config };
  }

  /**
   * Check if reranker is available (has API key)
   */
  async isAvailable(): Promise<boolean> {
    const key = await this.getApiKey();
    return key.length > 0;
  }
}

/**
 * Create a pre-configured reranker instance
 */
export function createReranker(config?: Partial<RerankerConfig>): LightweightReranker {
  return new LightweightReranker(config);
}

/**
 * Default singleton reranker instance
 */
export const defaultReranker = new LightweightReranker();

// ============================================
// TIER-BASED FILTERING
// ============================================

/**
 * Extended chunk with tier information
 */
export interface TieredChunk extends ChunkWithProvenance {
  /** Source tier (0=official, 1=guide, 2=community) */
  tier?: SourceTier;
  /** Source category */
  category?: string;
  /** Effective dates extracted from content */
  effectiveDates?: ExtractedDate[];
}

/**
 * Result from tier-aware filtering
 */
export interface TierFilterResult {
  /** Documents that passed the tier filter */
  allowed: TieredChunk[];
  /** Documents that were filtered out */
  filtered: TieredChunk[];
  /** The detected query intent */
  intent: QueryIntent;
  /** Allowed tiers for this intent */
  allowedTiers: SourceTier[];
  /** Warning messages for the UI */
  warnings: string[];
}

/**
 * Map source string to tier number
 * Based on the source field in the document
 */
function inferTierFromSource(source: string): SourceTier {
  const sourceLower = source.toLowerCase();
  
  // Tier 0: Official Capital One
  if (sourceLower.includes('capitalone') && sourceLower.includes('scraped')) {
    return 0;
  }
  if (sourceLower.includes('capitalone') && sourceLower.includes('static')) {
    return 0;
  }
  if (sourceLower.includes('official')) {
    return 0;
  }
  
  // Tier 1: Trusted guides (TPG, OMAAT, etc.)
  if (sourceLower.includes('tpg') || sourceLower.includes('pointsguy')) {
    return 1;
  }
  if (sourceLower.includes('omaat') || sourceLower.includes('onemileatatime')) {
    return 1;
  }
  if (sourceLower.includes('nerdwallet')) {
    return 1;
  }
  if (sourceLower.includes('frequentmiler')) {
    return 1;
  }
  if (sourceLower.includes('doctorofcredit')) {
    return 1;
  }
  
  // Tier 2: Community (Reddit, FlyerTalk)
  if (sourceLower.includes('reddit')) {
    return 2;
  }
  if (sourceLower.includes('flyertalk')) {
    return 2;
  }
  
  // Default to Tier 1 for unknown sources (safer than Tier 0)
  return 1;
}

/**
 * Add tier information to chunks
 */
export function enrichWithTier(chunks: ChunkWithProvenance[]): TieredChunk[] {
  return chunks.map(chunk => {
    const tiered: TieredChunk = { ...chunk };
    
    // Infer tier from source if not already set
    if (tiered.tier === undefined) {
      tiered.tier = inferTierFromSource(chunk.metadata.source);
    }
    
    // Extract effective dates from content (for time-sensitive info)
    tiered.effectiveDates = extractEffectiveDates(chunk.content);
    
    return tiered;
  });
}

/**
 * Filter chunks by tier based on query intent
 *
 * CRITICAL: Policy questions MUST only use Tier 0 sources
 * to avoid spreading misinformation.
 */
export function filterByTier(
  query: string,
  chunks: TieredChunk[]
): TierFilterResult {
  const intent = detectQueryIntent(query);
  const allowedTiers = getAllowedTiersForIntent(intent);
  
  const allowed: TieredChunk[] = [];
  const filtered: TieredChunk[] = [];
  const warnings: string[] = [];
  
  for (const chunk of chunks) {
    const tier = chunk.tier ?? inferTierFromSource(chunk.metadata.source);
    
    if (allowedTiers.includes(tier)) {
      allowed.push(chunk);
    } else {
      filtered.push(chunk);
    }
  }
  
  // Add warnings
  if (intent === 'policy' && filtered.length > 0) {
    warnings.push(
      `${filtered.length} community/guide sources filtered out for policy question. ` +
      `Only official Capital One sources used.`
    );
  }
  
  if (intent === 'policy' && allowed.length === 0 && chunks.length > 0) {
    warnings.push(
      'No official Capital One sources found for this policy question. ' +
      'Showing community sources with disclaimer.'
    );
    // Fall back to showing all sources with warning
    return {
      allowed: chunks,
      filtered: [],
      intent,
      allowedTiers,
      warnings: [...warnings, '⚠️ No official sources available - verify this information with Capital One.'],
    };
  }
  
  // Add effective date warnings for time-sensitive content
  for (const chunk of allowed) {
    if (chunk.effectiveDates && chunk.effectiveDates.length > 0) {
      const futureDate = chunk.effectiveDates.find(d => {
        const dateObj = new Date(d.date);
        return d.type === 'effective_from' && dateObj > new Date();
      });
      
      if (futureDate) {
        warnings.push(
          `⚠️ Policy change effective ${futureDate.date}: ` +
          `"${futureDate.originalText}"`
        );
      }
    }
  }
  
  return {
    allowed,
    filtered,
    intent,
    allowedTiers,
    warnings,
  };
}

/**
 * Rerank with tier-aware filtering
 *
 * This is the main entry point for the RAG pipeline.
 * 1. Enrich chunks with tier info
 * 2. Filter by tier based on query intent
 * 3. Rerank remaining documents
 * 4. Return results with warnings
 */
export async function rerankWithTierFiltering(
  query: string,
  chunks: ChunkWithProvenance[],
  reranker: LightweightReranker = defaultReranker
): Promise<{
  results: RerankedResult[];
  stats: RerankerStats;
  tierFilter: TierFilterResult;
}> {
  // Step 1: Enrich with tier info
  const tieredChunks = enrichWithTier(chunks);
  
  // Step 2: Filter by tier
  const tierFilter = filterByTier(query, tieredChunks);
  
  // Step 3: Rerank allowed documents
  const { results, stats } = await reranker.rerank(query, tierFilter.allowed);
  
  return {
    results,
    stats,
    tierFilter,
  };
}

/**
 * Format tier label for display
 */
export function getTierLabel(tier: SourceTier): string {
  switch (tier) {
    case 0: return '🏛️ Official';
    case 1: return '📘 Guide';
    case 2: return '💬 Community';
    default: return '❓ Unknown';
  }
}

/**
 * Get tier description for citations
 */
export function getTierDescription(tier: SourceTier): string {
  switch (tier) {
    case 0: return 'Official Capital One source';
    case 1: return 'Trusted third-party guide';
    case 2: return 'Community data point';
    default: return 'Unknown source';
  }
}
