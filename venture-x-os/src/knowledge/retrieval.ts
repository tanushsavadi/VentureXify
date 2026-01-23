// ============================================
// KNOWLEDGE RETRIEVAL SYSTEM (SUPABASE)
// Uses Supabase pgvector for semantic search
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

// Storage keys
const KNOWLEDGE_CACHE_KEY = 'vx_knowledge_cache';
const KNOWLEDGE_LAST_UPDATE_KEY = 'vx_knowledge_last_update';

export interface CitedSource {
  title: string;
  url: string;
  source: 'reddit-post' | 'reddit-comment' | 'capitalone' | 'custom';
  author?: string;
  relevanceScore: number;
}

export interface RetrievalResult {
  query: string;
  context: string;
  sources: CitedSource[];
  retrievedAt: string;
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
 */
export async function searchKnowledge(
  query: string,
  topK: number = 5
): Promise<RetrievalResult> {
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
        
        return {
          query,
          context,
          sources: sources.map(s => ({
            title: s.title,
            url: s.url,
            source: s.source as CitedSource['source'],
            author: s.author,
            relevanceScore: s.relevanceScore,
          })),
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

// Re-export for convenience
export type { ScrapedDocument } from './scrapers/reddit';
export type { SearchResult };
