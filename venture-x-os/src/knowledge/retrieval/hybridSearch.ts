// ============================================
// HYBRID SEARCH MODULE
// Combines dense (vector) and sparse (BM25) search
// Uses Reciprocal Rank Fusion for result merging
// ============================================

import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  ENDPOINTS, 
  isSupabaseConfigured, 
  getSupabaseHeaders 
} from '../../config/supabase';
import { 
  searchKnowledge as denseSearch, 
  generateEmbeddings,
  type SearchResult 
} from '../vectorStore/supabase';

// ============================================
// HYBRID SEARCH CONFIGURATION
// ============================================

export interface HybridSearchConfig {
  /** Weight for dense (vector) results (0-1) */
  denseWeight: number;
  /** Weight for sparse (BM25) results (0-1) */
  sparseWeight: number;
  /** RRF constant k (higher = more even distribution) */
  rrf_k: number;
  /** Number of dense results to fetch before fusion */
  topK_dense: number;
  /** Number of sparse results to fetch before fusion */
  topK_sparse: number;
  /** Final number of results to return after fusion */
  finalTopK: number;
  /** Minimum similarity threshold for dense search */
  similarityThreshold: number;
  /** Whether to use server-side hybrid function */
  useServerSideHybrid: boolean;
}

export const DEFAULT_HYBRID_CONFIG: HybridSearchConfig = {
  denseWeight: 0.5,
  sparseWeight: 0.5,
  rrf_k: 60,
  topK_dense: 30,
  topK_sparse: 30,
  finalTopK: 10,
  similarityThreshold: 0.3,
  useServerSideHybrid: false, // Start with client-side fusion for safety
};

// ============================================
// HYBRID SEARCH RESULT TYPES
// ============================================

export interface HybridSearchResult extends SearchResult {
  /** Score from dense (vector) search */
  denseScore: number;
  /** Score from sparse (BM25) search */
  sparseScore: number;
  /** Final fused score after RRF */
  fusedScore: number;
  /** Source of this result */
  searchType: 'dense' | 'sparse' | 'both';
}

export interface HybridSearchResponse {
  success: boolean;
  results: HybridSearchResult[];
  meta: {
    denseCount: number;
    sparseCount: number;
    fusedCount: number;
    denseWeight: number;
    sparseWeight: number;
    searchTimeMs: number;
  };
  error?: string;
}

// ============================================
// CLIENT-SIDE HYBRID SEARCH
// Runs both searches in parallel and fuses on client
// ============================================

export async function hybridSearch(
  query: string,
  config: Partial<HybridSearchConfig> = {}
): Promise<HybridSearchResponse> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_HYBRID_CONFIG, ...config };
  
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      results: [],
      meta: {
        denseCount: 0,
        sparseCount: 0,
        fusedCount: 0,
        denseWeight: cfg.denseWeight,
        sparseWeight: cfg.sparseWeight,
        searchTimeMs: 0,
      },
      error: 'Supabase not configured',
    };
  }
  
  try {
    // Run dense and sparse searches in parallel
    const [denseResults, sparseResults] = await Promise.all([
      executeDenseSearch(query, cfg.topK_dense, cfg.similarityThreshold),
      executeSparseSearch(query, cfg.topK_sparse),
    ]);
    
    // Apply Reciprocal Rank Fusion
    const fusedResults = reciprocalRankFusion(denseResults, sparseResults, cfg);
    
    const searchTimeMs = Date.now() - startTime;
    console.log(`[HybridSearch] Completed in ${searchTimeMs}ms: dense=${denseResults.length}, sparse=${sparseResults.length}, fused=${fusedResults.length}`);
    
    return {
      success: true,
      results: fusedResults,
      meta: {
        denseCount: denseResults.length,
        sparseCount: sparseResults.length,
        fusedCount: fusedResults.length,
        denseWeight: cfg.denseWeight,
        sparseWeight: cfg.sparseWeight,
        searchTimeMs,
      },
    };
    
  } catch (error) {
    console.error('[HybridSearch] Error:', error);
    return {
      success: false,
      results: [],
      meta: {
        denseCount: 0,
        sparseCount: 0,
        fusedCount: 0,
        denseWeight: cfg.denseWeight,
        sparseWeight: cfg.sparseWeight,
        searchTimeMs: Date.now() - startTime,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// DENSE (VECTOR) SEARCH
// Uses existing pgvector search via Edge Function
// ============================================

async function executeDenseSearch(
  query: string,
  topK: number,
  threshold: number
): Promise<SearchResult[]> {
  try {
    const result = await denseSearch(query, topK, threshold);
    
    if (!result.success || !result.results) {
      console.warn('[HybridSearch] Dense search failed or returned no results');
      return [];
    }
    
    return result.results;
  } catch (error) {
    console.error('[HybridSearch] Dense search error:', error);
    return [];
  }
}

// ============================================
// SPARSE (BM25) SEARCH
// Calls the new search_knowledge_bm25 function via RPC
// ============================================

async function executeSparseSearch(
  query: string,
  topK: number
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }
  
  try {
    // Call the BM25 search function via Supabase RPC
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge_bm25`, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        query_text: query,
        match_count: topK,
      }),
    });
    
    if (!response.ok) {
      // BM25 function might not be deployed yet - gracefully degrade
      console.warn('[HybridSearch] BM25 search unavailable:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.warn('[HybridSearch] BM25 returned non-array:', typeof data);
      return [];
    }
    
    // Map RPC results to SearchResult format
    return data.map((row: {
      id: string;
      title: string;
      content: string;
      source: string;
      url: string;
      author?: string;
      bm25_rank: number;
    }) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      source: row.source,
      url: row.url,
      author: row.author,
      score: row.bm25_rank,
    }));
    
  } catch (error) {
    // Log but don't fail - sparse search is optional enhancement
    console.warn('[HybridSearch] Sparse search error (non-fatal):', error);
    return [];
  }
}

// ============================================
// RECIPROCAL RANK FUSION (RRF)
// Merges results from multiple retrieval systems
// Formula: score = sum(weight * (1 / (k + rank)))
// ============================================

function reciprocalRankFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  config: HybridSearchConfig
): HybridSearchResult[] {
  // Build a map of all documents with their ranks from each source
  const scoreMap = new Map<string, {
    doc: SearchResult;
    denseRank: number | null;
    sparseRank: number | null;
    denseScore: number;
    sparseScore: number;
  }>();
  
  // Add dense results with their ranks
  denseResults.forEach((doc, idx) => {
    scoreMap.set(doc.id, {
      doc,
      denseRank: idx + 1,
      sparseRank: null,
      denseScore: doc.score,
      sparseScore: 0,
    });
  });
  
  // Add or update with sparse results
  sparseResults.forEach((doc, idx) => {
    const existing = scoreMap.get(doc.id);
    if (existing) {
      existing.sparseRank = idx + 1;
      existing.sparseScore = doc.score;
    } else {
      scoreMap.set(doc.id, {
        doc,
        denseRank: null,
        sparseRank: idx + 1,
        denseScore: 0,
        sparseScore: doc.score,
      });
    }
  });
  
  // Calculate fused scores using RRF formula
  const results: HybridSearchResult[] = [];
  
  for (const [id, entry] of scoreMap) {
    const { doc, denseRank, sparseRank, denseScore, sparseScore } = entry;
    
    // RRF formula: score = weight * (1 / (k + rank))
    // For missing ranks, use a very large rank (effectively 0 contribution)
    const denseContrib = denseRank !== null 
      ? config.denseWeight * (1 / (config.rrf_k + denseRank))
      : 0;
    const sparseContrib = sparseRank !== null
      ? config.sparseWeight * (1 / (config.rrf_k + sparseRank))
      : 0;
    
    const fusedScore = denseContrib + sparseContrib;
    
    // Determine search type
    let searchType: 'dense' | 'sparse' | 'both';
    if (denseRank !== null && sparseRank !== null) {
      searchType = 'both';
    } else if (denseRank !== null) {
      searchType = 'dense';
    } else {
      searchType = 'sparse';
    }
    
    results.push({
      ...doc,
      denseScore,
      sparseScore,
      fusedScore,
      searchType,
    });
  }
  
  // Sort by fused score descending and limit
  return results
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, config.finalTopK);
}

// ============================================
// TEXT-ONLY SEARCH FALLBACK
// Used when embedding generation fails
// ============================================

export async function textOnlySearch(
  query: string,
  topK: number = 10
): Promise<SearchResult[]> {
  if (!isSupabaseConfigured() || !query.trim()) {
    return [];
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge_text_only`, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        query_text: query,
        match_count: topK,
      }),
    });
    
    if (!response.ok) {
      console.warn('[HybridSearch] Text-only search unavailable:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    return Array.isArray(data) ? data.map((row: {
      id: string;
      title: string;
      content: string;
      source: string;
      url: string;
      author?: string;
      score: number;
    }) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      source: row.source,
      url: row.url,
      author: row.author,
      score: row.score,
    })) : [];
    
  } catch (error) {
    console.warn('[HybridSearch] Text-only search error:', error);
    return [];
  }
}

// ============================================
// SERVER-SIDE HYBRID SEARCH (OPTIONAL)
// Calls the Postgres hybrid function directly
// More efficient but requires migration 005
// ============================================

export async function serverSideHybridSearch(
  query: string,
  config: Partial<HybridSearchConfig> = {}
): Promise<HybridSearchResponse> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_HYBRID_CONFIG, ...config };
  
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      results: [],
      meta: {
        denseCount: 0,
        sparseCount: 0,
        fusedCount: 0,
        denseWeight: cfg.denseWeight,
        sparseWeight: cfg.sparseWeight,
        searchTimeMs: 0,
      },
      error: 'Supabase not configured',
    };
  }
  
  try {
    // First, generate embedding for the query
    const embedResult = await generateEmbeddings([query]);
    
    if (!embedResult.success || !embedResult.embeddings?.[0]) {
      // Fall back to client-side search if embedding fails
      console.warn('[HybridSearch] Embedding failed, falling back to client-side');
      return hybridSearch(query, config);
    }
    
    const queryEmbedding = embedResult.embeddings[0];
    
    // Call the server-side hybrid function
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_knowledge_hybrid`, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        query_text: query,
        match_threshold: cfg.similarityThreshold,
        match_count: cfg.finalTopK,
        dense_weight: cfg.denseWeight,
        sparse_weight: cfg.sparseWeight,
        rrf_k: cfg.rrf_k,
      }),
    });
    
    if (!response.ok) {
      // Server-side function might not be available - fall back
      console.warn('[HybridSearch] Server-side hybrid unavailable, falling back');
      return hybridSearch(query, config);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.warn('[HybridSearch] Server hybrid returned non-array');
      return hybridSearch(query, config);
    }
    
    const searchTimeMs = Date.now() - startTime;
    
    // Map results to HybridSearchResult format
    const results: HybridSearchResult[] = data.map((row: {
      id: string;
      title: string;
      content: string;
      source: string;
      url: string;
      author?: string;
      dense_score: number;
      sparse_score: number;
      fused_score: number;
    }) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      source: row.source,
      url: row.url,
      author: row.author,
      score: row.fused_score,
      denseScore: row.dense_score,
      sparseScore: row.sparse_score,
      fusedScore: row.fused_score,
      searchType: (row.dense_score > 0 && row.sparse_score > 0 ? 'both' : 
        row.dense_score > 0 ? 'dense' : 'sparse') as 'dense' | 'sparse' | 'both',
    }));
    
    return {
      success: true,
      results,
      meta: {
        denseCount: results.filter(r => r.searchType === 'dense' || r.searchType === 'both').length,
        sparseCount: results.filter(r => r.searchType === 'sparse' || r.searchType === 'both').length,
        fusedCount: results.length,
        denseWeight: cfg.denseWeight,
        sparseWeight: cfg.sparseWeight,
        searchTimeMs,
      },
    };
    
  } catch (error) {
    console.error('[HybridSearch] Server-side error:', error);
    // Fall back to client-side
    return hybridSearch(query, config);
  }
}
