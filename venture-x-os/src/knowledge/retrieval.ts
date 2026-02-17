// ============================================
// KNOWLEDGE RETRIEVAL SYSTEM (SUPABASE)
// Uses Supabase pgvector for semantic search
// Supports hybrid search (dense + sparse) with RRF fusion
// ============================================

import { ScrapedDocument, fullRedditScrape } from './scrapers/reddit';
import { getCapitalOneContent } from './scrapers/capitalOne';
import {
  sendChatMessage,
  searchKnowledge as supabaseSearch,
  generateEmbeddings,
  upsertDocuments,
  buildRAGContext,
  checkSupabaseStatus,
  type SearchResult,
  type ChatContext,
} from './vectorStore/supabase';
import { isSupabaseConfigured } from '../config/supabase';
import { contentSanitizer, type SanitizeResult } from '../security/contentSanitizer';
import {
  hybridSearch,
  textOnlySearch,
  type HybridSearchConfig,
  type HybridSearchResponse,
} from './retrieval/hybridSearch';
import {
  ChunkWithProvenance,
  SourceMetadata,
  sourceFreshnessManager,
} from './sourceMetadata';

// Storage keys
const KNOWLEDGE_CACHE_KEY = 'vx_knowledge_cache';
const KNOWLEDGE_LAST_UPDATE_KEY = 'vx_knowledge_last_update';

export interface CitedSource {
  title: string;
  url: string;
  source: 'reddit-post' | 'reddit-comment' | 'capitalone' | 'custom';
  author?: string;
  relevanceScore: number;
  // Trust and sanitization metadata
  trustTier?: 1 | 2 | 3 | 4;
  wasSanitized?: boolean;
  freshnessStatus?: 'fresh' | 'stale' | 'expired' | 'unknown';
}

export interface RetrievalResult {
  query: string;
  context: string;
  sources: CitedSource[];
  retrievedAt: string;
}

/**
 * Extended retrieval result with provenance and hybrid search metadata
 */
export interface EnhancedRetrievalResult extends RetrievalResult {
  /** Chunks with full provenance metadata */
  chunks: ChunkWithProvenance[];
  
  /** Search method used */
  searchMethod: 'hybrid' | 'dense' | 'sparse' | 'keyword' | 'cache';
  
  /** Hybrid search metrics (if applicable) */
  hybridMetrics?: {
    denseResultCount: number;
    sparseResultCount: number;
    fusedResultCount: number;
    sparseSearchAvailable: boolean;
  };
}

/**
 * Initialize/update the knowledge base
 * Scrapes Reddit and Capital One, generates embeddings, stores in Supabase
 */
export async function updateKnowledgeBase(
  options: {
    includeReddit?: boolean;
    includeCapitalOne?: boolean;
    maxRedditPosts?: number;
    forceRefresh?: boolean;
    onProgress?: (step: string, progress: number) => void;
  } = {}
): Promise<{ success: boolean; documentCount: number; error?: string }> {
  const {
    includeReddit = true,
    includeCapitalOne = true,
    maxRedditPosts = 30,
    forceRefresh = false,
    onProgress,
  } = options;
  
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.log('[Knowledge] Supabase not configured, using local cache only');
    }
    
    // Check if we need to update
    const storage = await chrome.storage.local.get([KNOWLEDGE_LAST_UPDATE_KEY]);
    const lastUpdate = storage[KNOWLEDGE_LAST_UPDATE_KEY] || 0;
    const hoursSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60);
    
    if (!forceRefresh && hoursSinceUpdate < 24) {
      console.log('[Knowledge] Using cached knowledge (updated', hoursSinceUpdate.toFixed(1), 'hours ago)');
      return { success: true, documentCount: 0 };
    }
    
    onProgress?.('Collecting documents...', 0);
    
    const allDocuments: ScrapedDocument[] = [];
    
    // Scrape Reddit
    if (includeReddit) {
      onProgress?.('Scraping r/VentureX...', 10);
      console.log('[Knowledge] Scraping Reddit...');
      
      const redditDocs = await fullRedditScrape(maxRedditPosts, true, 15);
      allDocuments.push(...redditDocs);
    }
    
    // Scrape/load Capital One
    if (includeCapitalOne) {
      onProgress?.('Loading Capital One content...', 30);
      console.log('[Knowledge] Getting Capital One content...');
      
      const c1Docs = await getCapitalOneContent();
      allDocuments.push(...c1Docs);
    }
    
    if (allDocuments.length === 0) {
      return { success: false, documentCount: 0, error: 'No documents scraped' };
    }
    
    console.log(`[Knowledge] Total documents: ${allDocuments.length}`);
    
    // Store locally for offline access
    onProgress?.('Caching locally...', 40);
    await chrome.storage.local.set({
      [KNOWLEDGE_CACHE_KEY]: allDocuments,
      [KNOWLEDGE_LAST_UPDATE_KEY]: Date.now(),
    });
    
    // If Supabase is configured, upload to pgvector
    if (isSupabaseConfigured()) {
      onProgress?.('Generating embeddings...', 50);
      console.log('[Knowledge] Generating embeddings via Supabase...');
      
      const texts = allDocuments.map(doc => 
        `${doc.title}\n${doc.content}`.slice(0, 500)
      );
      
      // Generate embeddings in batches
      const batchSize = 10;
      const allEmbeddings: (number[] | null)[] = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const result = await generateEmbeddings(batch);
        
        if (result.success && result.embeddings) {
          allEmbeddings.push(...result.embeddings);
        } else {
          // Fill with nulls for failed batch
          allEmbeddings.push(...batch.map(() => null));
        }
        
        const progress = 50 + ((i + batchSize) / texts.length) * 30;
        onProgress?.(`Embedding ${Math.min(i + batchSize, texts.length)}/${texts.length}...`, progress);
      }
      
      // Prepare documents with embeddings for upsert
      onProgress?.('Uploading to Supabase...', 85);
      console.log('[Knowledge] Uploading to Supabase pgvector...');
      
      const docsWithEmbeddings = allDocuments
        .map((doc, idx) => ({
          id: doc.id,
          embedding: allEmbeddings[idx],
          content: doc.content,
          title: doc.title,
          source: doc.source,
          url: doc.url,
          author: doc.author,
          score: doc.score,
        }))
        .filter((doc): doc is typeof doc & { embedding: number[] } => 
          doc.embedding !== null && doc.embedding.length === 384
        );
      
      if (docsWithEmbeddings.length > 0) {
        const upsertResult = await upsertDocuments(docsWithEmbeddings);
        
        if (upsertResult.success) {
          console.log(`[Knowledge] Uploaded ${upsertResult.upserted} documents to Supabase`);
        } else {
          console.error('[Knowledge] Supabase upload failed:', upsertResult.error);
        }
      }
    }
    
    onProgress?.('Complete!', 100);
    
    return { success: true, documentCount: allDocuments.length };
    
  } catch (error) {
    console.error('[Knowledge] Update failed:', error);
    return { 
      success: false, 
      documentCount: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Search the knowledge base using Supabase pgvector
 * Now includes content sanitization for prompt injection defense
 */
export async function searchKnowledge(
  query: string,
  topK: number = 5,
  options: { sanitize?: boolean; filterExpired?: boolean } = {}
): Promise<RetrievalResult> {
  const { sanitize = true, filterExpired = true } = options;
  
  const result: RetrievalResult = {
    query,
    context: '',
    sources: [],
    retrievedAt: new Date().toISOString(),
  };
  
  try {
    // Try Supabase first
    if (isSupabaseConfigured()) {
      console.log('[Knowledge] Searching Supabase pgvector...');
      
      const searchResult = await supabaseSearch(query, topK, 0.3);
      
      if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
        const { context, sources } = buildRAGContext(searchResult.results);
        
        // Sanitize sources for prompt injection defense
        const sanitizedSources: CitedSource[] = [];
        const sanitizedContextParts: string[] = [];
        
        for (const s of sources) {
          // Get original content from the results
          const originalResult = searchResult.results.find(r => r.url === s.url);
          const content = originalResult?.content || '';
          
          // Sanitize content based on source trust tier
          let sanitizedContent = content;
          let wasSanitized = false;
          
          if (sanitize) {
            const sanitizeResult: SanitizeResult = contentSanitizer.sanitize(content, s.source);
            sanitizedContent = sanitizeResult.sanitized;
            wasSanitized = sanitizeResult.wasModified;
            
            // Log injection attempts
            if (sanitizeResult.injectionDetected) {
              contentSanitizer.logInjectionAttempt(content, s.source);
            }
          }
          
          // Build sanitized context part
          const sourceIdx = sanitizedSources.length + 1;
          sanitizedContextParts.push(`[${sourceIdx}] ${s.title}: ${sanitizedContent.slice(0, 300)}...`);
          
          sanitizedSources.push({
            title: s.title,
            url: s.url,
            source: s.source as CitedSource['source'],
            author: s.author,
            relevanceScore: s.relevanceScore,
            trustTier: getTrustTierForSource(s.source),
            wasSanitized,
          });
        }
        
        return {
          query,
          context: sanitize ? sanitizedContextParts.join('\n\n') : context,
          sources: sanitizedSources,
          retrievedAt: new Date().toISOString(),
        };
      }
    }
    
    // Fallback to local cache
    console.log('[Knowledge] Falling back to local cache...');
    const storage = await chrome.storage.local.get([KNOWLEDGE_CACHE_KEY]);
    const cachedDocs = storage[KNOWLEDGE_CACHE_KEY] as ScrapedDocument[] | undefined;
    
    if (!cachedDocs || cachedDocs.length === 0) {
      console.log('[Knowledge] No cached knowledge found');
      return result;
    }
    
    // Simple keyword-based fallback search
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored = cachedDocs.map(doc => {
      const text = `${doc.title} ${doc.content}`.toLowerCase();
      const matches = queryTerms.filter(term => text.includes(term)).length;
      return { doc, score: matches / queryTerms.length };
    });
    
    const relevant = scored
      .filter(s => s.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    if (relevant.length > 0) {
      const contextParts: string[] = [];
      const sources: CitedSource[] = [];
      
      relevant.forEach((r, i) => {
        contextParts.push(`[${i + 1}] ${r.doc.title}: ${r.doc.content.slice(0, 300)}...`);
        sources.push({
          title: r.doc.title,
          url: r.doc.url,
          source: r.doc.source as CitedSource['source'],
          author: r.doc.author,
          relevanceScore: r.score,
        });
      });
      
      return {
        query,
        context: contextParts.join('\n\n'),
        sources,
        retrievedAt: new Date().toISOString(),
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('[Knowledge] Search failed:', error);
    return result;
  }
}

/**
 * Enhanced search using hybrid retrieval (dense + sparse)
 * Returns chunks with full provenance for span-level citations
 */
export async function searchKnowledgeHybrid(
  query: string,
  options: {
    topK?: number;
    sanitize?: boolean;
    filterExpired?: boolean;
    hybridConfig?: Partial<HybridSearchConfig>;
  } = {}
): Promise<EnhancedRetrievalResult> {
  const {
    topK = 10,
    sanitize = true,
    filterExpired = true,
    hybridConfig = {},
  } = options;
  
  const emptyResult: EnhancedRetrievalResult = {
    query,
    context: '',
    sources: [],
    retrievedAt: new Date().toISOString(),
    chunks: [],
    searchMethod: 'hybrid',
  };
  
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.log('[Knowledge] Supabase not configured, using local cache');
      return await searchLocalCacheEnhanced(query, topK, sanitize);
    }
    
    console.log('[Knowledge] Performing hybrid search...');
    
    // Perform hybrid search
    const hybridResult = await hybridSearch(query, {
      finalTopK: topK,
      ...hybridConfig,
    });
    
    if (!hybridResult.success || hybridResult.results.length === 0) {
      console.log('[Knowledge] Hybrid search returned no results, trying text-only...');
      
      // Fallback to text-only search (returns SearchResult[], not HybridSearchResponse)
      const textResults = await textOnlySearch(query, topK);
      
      if (textResults.length > 0) {
        // Convert SearchResult[] to HybridSearchResponse format
        const textResponse: HybridSearchResponse = {
          success: true,
          results: textResults.map(r => ({
            ...r,
            denseScore: 0,
            sparseScore: r.score,
            fusedScore: r.score,
            searchType: 'sparse' as const,
          })),
          meta: {
            denseCount: 0,
            sparseCount: textResults.length,
            fusedCount: textResults.length,
            denseWeight: 0,
            sparseWeight: 1,
            searchTimeMs: 0,
          },
        };
        return processHybridResults(query, textResponse, sanitize, filterExpired, 'sparse');
      }
      
      // Final fallback to local cache
      return await searchLocalCacheEnhanced(query, topK, sanitize);
    }
    
    return processHybridResults(query, hybridResult, sanitize, filterExpired, 'hybrid');
    
  } catch (error) {
    console.error('[Knowledge] Hybrid search failed:', error);
    
    // Fallback to regular search
    const fallbackResult = await searchKnowledge(query, topK, { sanitize, filterExpired });
    
    return {
      ...fallbackResult,
      chunks: [],
      searchMethod: 'dense',
    };
  }
}

/**
 * Process hybrid search results into EnhancedRetrievalResult
 */
function processHybridResults(
  query: string,
  hybridResult: HybridSearchResponse,
  sanitize: boolean,
  filterExpired: boolean,
  searchMethod: 'hybrid' | 'sparse'
): EnhancedRetrievalResult {
  const chunks: ChunkWithProvenance[] = [];
  const sources: CitedSource[] = [];
  const contextParts: string[] = [];
  
  // Filter to only include sufficiently relevant chunks in the RAG context
  // This prevents low-quality results from polluting the LLM's context window
  const MIN_HYBRID_CONTEXT_THRESHOLD = 0.4;
  const filteredResults = hybridResult.results.filter(r => {
    const score = r.fusedScore || r.denseScore || r.sparseScore || 0;
    return score >= MIN_HYBRID_CONTEXT_THRESHOLD;
  });
  
  // Fall back to top result if nothing passes threshold
  const resultsToProcess = filteredResults.length > 0
    ? filteredResults
    : hybridResult.results.slice(0, 1);
  
  for (const result of resultsToProcess) {
    // Get trust tier
    const trustTier = getTrustTierForSource(result.source);
    
    // Build source metadata
    const metadata: SourceMetadata = {
      id: result.id,
      source: result.source,
      url: result.url,
      title: result.title,
      retrievedAt: new Date().toISOString(),
      trustTier,
      contentHash: '',
      version: 1,
      isActive: true,
    };
    
    // Calculate freshness
    const freshnessResult = sourceFreshnessManager.calculateFreshness(metadata);
    
    // Skip expired content if filtering is enabled
    if (filterExpired && freshnessResult.status === 'expired') {
      console.log(`[Knowledge] Skipping expired content: ${result.title}`);
      continue;
    }
    
    // Sanitize content if enabled
    let content = result.content;
    let wasSanitized = false;
    
    if (sanitize) {
      const sanitizeResult = contentSanitizer.sanitize(content, result.source);
      content = sanitizeResult.sanitized;
      wasSanitized = sanitizeResult.wasModified;
      
      if (sanitizeResult.injectionDetected) {
        contentSanitizer.logInjectionAttempt(result.content, result.source);
      }
    }
    
    // Build chunk with provenance
    const chunk: ChunkWithProvenance = {
      id: result.id,
      content,
      metadata,
      score: result.fusedScore || result.denseScore || result.sparseScore || 0,
      rankPosition: chunks.length + 1,
      freshnessStatus: freshnessResult.status,
      daysOld: freshnessResult.daysOld,
    };
    
    chunks.push(chunk);
    
    // Build context part
    const sourceIdx = sources.length + 1;
    contextParts.push(`[${sourceIdx}] ${result.title}: ${content.slice(0, 300)}...`);
    
    // Build cited source
    sources.push({
      title: result.title,
      url: result.url || '',
      source: mapSourceType(result.source),
      author: result.author,
      relevanceScore: result.fusedScore || result.denseScore || 0,
      trustTier,
      wasSanitized,
      freshnessStatus: freshnessResult.status,
    });
  }
  
  return {
    query,
    context: contextParts.join('\n\n'),
    sources,
    retrievedAt: new Date().toISOString(),
    chunks,
    searchMethod,
    hybridMetrics: {
      denseResultCount: hybridResult.meta.denseCount,
      sparseResultCount: hybridResult.meta.sparseCount,
      fusedResultCount: hybridResult.meta.fusedCount,
      sparseSearchAvailable: hybridResult.meta.sparseCount > 0,
    },
  };
}

/**
 * Search local cache with enhanced result format
 */
async function searchLocalCacheEnhanced(
  query: string,
  topK: number,
  sanitize: boolean
): Promise<EnhancedRetrievalResult> {
  const storage = await chrome.storage.local.get([KNOWLEDGE_CACHE_KEY]);
  const cachedDocs = storage[KNOWLEDGE_CACHE_KEY] as ScrapedDocument[] | undefined;
  
  const emptyResult: EnhancedRetrievalResult = {
    query,
    context: '',
    sources: [],
    retrievedAt: new Date().toISOString(),
    chunks: [],
    searchMethod: 'cache',
  };
  
  if (!cachedDocs || cachedDocs.length === 0) {
    return emptyResult;
  }
  
  // Simple keyword-based search
  const queryTerms = query.toLowerCase().split(/\s+/);
  const scored = cachedDocs.map(doc => {
    const text = `${doc.title} ${doc.content}`.toLowerCase();
    const matches = queryTerms.filter(term => text.includes(term)).length;
    return { doc, score: matches / queryTerms.length };
  });
  
  const relevant = scored
    .filter(s => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  if (relevant.length === 0) {
    return emptyResult;
  }
  
  const chunks: ChunkWithProvenance[] = [];
  const sources: CitedSource[] = [];
  const contextParts: string[] = [];
  
  for (const r of relevant) {
    const trustTier = getTrustTierForSource(r.doc.source);
    
    const metadata: SourceMetadata = {
      id: r.doc.id,
      source: r.doc.source,
      url: r.doc.url,
      title: r.doc.title,
      retrievedAt: new Date().toISOString(),
      trustTier,
      contentHash: '',
      version: 1,
      isActive: true,
    };
    
    let content = r.doc.content;
    let wasSanitized = false;
    
    if (sanitize) {
      const sanitizeResult = contentSanitizer.sanitize(content, r.doc.source);
      content = sanitizeResult.sanitized;
      wasSanitized = sanitizeResult.wasModified;
    }
    
    const chunk: ChunkWithProvenance = {
      id: r.doc.id,
      content,
      metadata,
      score: r.score,
      rankPosition: chunks.length + 1,
      freshnessStatus: 'unknown',
    };
    
    chunks.push(chunk);
    
    const sourceIdx = sources.length + 1;
    contextParts.push(`[${sourceIdx}] ${r.doc.title}: ${content.slice(0, 300)}...`);
    
    sources.push({
      title: r.doc.title,
      url: r.doc.url,
      source: mapSourceType(r.doc.source),
      author: r.doc.author,
      relevanceScore: r.score,
      trustTier,
      wasSanitized,
    });
  }
  
  return {
    query,
    context: contextParts.join('\n\n'),
    sources,
    retrievedAt: new Date().toISOString(),
    chunks,
    searchMethod: 'cache',
  };
}

/**
 * Map source string to CitedSource source type
 */
function mapSourceType(source: string): CitedSource['source'] {
  const normalized = source.toLowerCase();
  
  if (normalized.includes('capitalone') || normalized === 'official') {
    return 'capitalone';
  }
  if (normalized.includes('comment')) {
    return 'reddit-comment';
  }
  if (normalized.includes('reddit') || normalized.includes('post')) {
    return 'reddit-post';
  }
  
  return 'custom';
}

/**
 * Get knowledge status
 */
export async function getKnowledgeStatus(): Promise<{
  localDocuments: number;
  supabaseHealthy: boolean;
  lastUpdated: Date | null;
  needsUpdate: boolean;
}> {
  const storage = await chrome.storage.local.get([KNOWLEDGE_CACHE_KEY, KNOWLEDGE_LAST_UPDATE_KEY]);
  const cachedDocs = storage[KNOWLEDGE_CACHE_KEY] as ScrapedDocument[] | undefined;
  const lastUpdate = storage[KNOWLEDGE_LAST_UPDATE_KEY] as number | undefined;
  
  let supabaseHealthy = false;
  if (isSupabaseConfigured()) {
    const status = await checkSupabaseStatus();
    supabaseHealthy = status.healthy;
  }
  
  const hoursSinceUpdate = lastUpdate 
    ? (Date.now() - lastUpdate) / (1000 * 60 * 60)
    : Infinity;
  
  return {
    localDocuments: cachedDocs?.length || 0,
    supabaseHealthy,
    lastUpdated: lastUpdate ? new Date(lastUpdate) : null,
    needsUpdate: hoursSinceUpdate > 24,
  };
}

/**
 * Send chat message via Supabase Edge Function
 * This hides the Groq API key on the server
 */
export async function sendChatViaSupabase(
  message: string,
  context?: ChatContext,
  ragContext?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ success: boolean; response?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  return sendChatMessage(message, context, ragContext, conversationHistory);
}

/**
 * Build system prompt with retrieved knowledge and citation instructions
 */
export function buildRAGSystemPrompt(
  basePrompt: string,
  retrievalResult: RetrievalResult
): string {
  if (retrievalResult.sources.length === 0) {
    return basePrompt;
  }
  
  return `${basePrompt}

RETRIEVED KNOWLEDGE (use this to answer, cite sources using [1], [2], etc.):
${retrievalResult.context}

AVAILABLE SOURCES:
${retrievalResult.sources.map((s, i) => 
  `[${i + 1}] ${s.title} (${s.source}) - ${s.url}`
).join('\n')}

CITATION INSTRUCTIONS:
- Use inline citations like [1], [2] when referencing information from the knowledge base
- Only cite sources that you actually use in your answer
- If you're not sure, say so rather than making up information
- Prioritize information from official Capital One sources`;
}

/**
 * Format citations for display
 */
export function formatCitationsForDisplay(sources: CitedSource[]): string {
  if (sources.length === 0) return '';
  
  return '\n\n**Sources:**\n' + sources.map((s, i) => 
    `[${i + 1}] [${s.title}](${s.url}) - ${getSourceLabel(s.source)}`
  ).join('\n');
}

function getSourceLabel(source: CitedSource['source']): string {
  switch (source) {
    case 'reddit-post': return '📝 Reddit Post';
    case 'reddit-comment': return '💬 Reddit Comment';
    case 'capitalone': return '🏦 Capital One';
    case 'custom': return '📌 Custom';
    default: return '📄 Source';
  }
}

/**
 * Map source type to trust tier
 * Tier 1: Official sources (highest trust)
 * Tier 2: Editorial sources
 * Tier 3: Structured community content
 * Tier 4: Unstructured user content (lowest trust)
 */
function getTrustTierForSource(source: string): 1 | 2 | 3 | 4 {
  const normalized = source.toLowerCase();
  
  // Tier 1: Official sources
  if (normalized.includes('capitalone') || normalized === 'official') {
    return 1;
  }
  
  // Tier 2: Editorial sources
  if (['tpg', 'nerdwallet', 'doctorofcredit', 'editorial'].some(s => normalized.includes(s))) {
    return 2;
  }
  
  // Tier 3: Structured community content
  if (['flyertalk', 'churning'].some(s => normalized.includes(s))) {
    return 3;
  }
  
  // Tier 4: Unstructured user content (Reddit, custom, unknown)
  return 4;
}

// Re-export for convenience
export type { ScrapedDocument } from './scrapers/reddit';
export type { SearchResult };
