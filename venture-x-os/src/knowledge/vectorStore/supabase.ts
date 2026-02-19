// ============================================
// SUPABASE CLIENT FOR VENTUREX EXTENSION
// Calls Edge Functions instead of direct API calls
// With STRICT prompt system to prevent hallucinations
// ============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, ENDPOINTS, isSupabaseConfigured, getSupabaseHeaders } from '../../config/supabase';
import { validateResponse } from '../../ai/prompts/systemPrompt';

// ============================================
// TYPES
// ============================================

export interface TravelEraserContext {
  milesBalance?: number;
  portalEraserMilesNeeded?: number;
  portalEraserValue?: number;
  directEraserMilesNeeded?: number;
  directEraserValue?: number;
  portalNetAfterEraser?: number;
  directNetAfterEraser?: number;
  eraserOpportunityCost?: number;
}

export interface ChatContext {
  portalPrice?: number;
  directPrice?: number;
  route?: string;
  portalMiles?: number;
  directMiles?: number;
  portalNetCost?: number;
  directNetCost?: number;
  winner?: string;
  savings?: number;
  creditRemaining?: number;
  eraser?: TravelEraserContext;
  // Award-specific (only if user provides)
  awardMilesRequired?: number;
  awardTaxesFees?: number;
  awardPartner?: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  title: string;
  content: string;
  source: string;
  url: string;
  author?: string;
  /** Source tier from DB: 0=Official, 1=Guide, 2=Community */
  source_tier?: number;
}

export interface SearchResponse {
  success: boolean;
  results?: SearchResult[];
  error?: string;
}

export interface UpsertDocument {
  id: string;
  embedding: number[];
  content: string;
  title: string;
  source: string;
  url?: string;
  author?: string;
  score?: number;
}

export interface UpsertResponse {
  success: boolean;
  upserted?: number;
  errors?: number;
  error?: string;
}

export interface EmbedResponse {
  success: boolean;
  embeddings?: (number[] | null)[];
  error?: string;
}

// ============================================
// CHAT - Proxies to Groq via Edge Function
// Uses STRICT prompt system to prevent hallucinations
// ============================================

export async function sendChatMessage(
  message: string,
  context?: ChatContext,
  ragContext?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<ChatResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // FIX: Send the raw user message, context, and ragContext separately to the
    // Edge Function. Previously we embedded everything into a "strict prompt" and
    // sent it as the `message` with context/ragContext set to null. This caused
    // the Edge Function to build its OWN system prompt AND receive our strict
    // prompt as the "user" message — double-prompting the LLM and confusing it.
    // The Edge Function already knows how to build a proper system prompt when it
    // receives real context and ragContext values.
    
    // IMPORTANT: Do NOT inject citation instructions into the ragContext.
    // The UI renders sources in a separate dropdown — inline [1], [2] markers
    // in the LLM response create ugly "Sources:" lists that duplicate the dropdown.
    // Instead, we tell the LLM to NOT include any source references.
    let enhancedRagContext = ragContext;
    if (ragContext) {
      const noCitationInstructions = `\n\nIMPORTANT: Do NOT include any source references, citations, numbered markers like [1] [2] [3], or "Sources:" lists in your response. Do NOT use inline citation markers. Just provide a clean, helpful answer using the knowledge above. The sources are automatically displayed separately in the UI.`;
      enhancedRagContext = ragContext + noCitationInstructions;
    }
    
    console.log('[Supabase] Sending message to Edge Function, context:', context ? 'yes' : 'no', 'ragContext:', ragContext ? 'yes' : 'no');
    
    const response = await fetch(ENDPOINTS.chat, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        message,              // Send the raw user question
        context,              // Send real context (booking prices, etc.)
        ragContext: enhancedRagContext, // Send RAG context WITH citation instructions
        conversationHistory,
      }),
    });

    const data = await response.json();
    
    // Validate response to catch hallucinations
    if (data.success && data.response) {
      const providedNumbers = [
        context?.portalPrice,
        context?.directPrice,
        context?.portalMiles,
        context?.directMiles,
        context?.portalNetCost,
        context?.directNetCost,
        context?.savings,
        context?.creditRemaining,
        context?.eraser?.milesBalance,
        context?.awardMilesRequired,
        context?.awardTaxesFees,
      ].filter((n): n is number => n !== undefined);
      
      const validation = validateResponse(data.response, providedNumbers);
      if (!validation.isValid) {
        console.warn('[Supabase] Potential hallucinations detected:', validation.warnings);
        // We don't fail, but log the warning for debugging
      }
    }
    
    return data;
  } catch (error) {
    console.error('[Supabase] Chat error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// SEARCH - Semantic search via pgvector
// ============================================

export async function searchKnowledge(
  query: string,
  topK: number = 5,
  threshold: number = 0.3
): Promise<SearchResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const response = await fetch(ENDPOINTS.search, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        query,
        topK,
        threshold,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Supabase] Search error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// EMBED - Generate embeddings via Edge Function
// ============================================

export async function generateEmbeddings(texts: string[]): Promise<EmbedResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const response = await fetch(ENDPOINTS.embed, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ texts }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Supabase] Embed error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// UPSERT - Store documents in pgvector
// ============================================

export async function upsertDocuments(documents: UpsertDocument[]): Promise<UpsertResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const response = await fetch(ENDPOINTS.upsert, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ documents }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Supabase] Upsert error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// HELPER: Build RAG context from search results
// ============================================

export function buildRAGContext(results: SearchResult[]): {
  context: string;
  sources: Array<{
    title: string;
    url: string;
    source: string;
    author?: string;
    relevanceScore: number;
  }>;
} {
  if (results.length === 0) {
    return { context: '', sources: [] };
  }

  // Filter to only include sufficiently relevant chunks in the RAG context
  // We keep a lower bar here (0.4) than for source display (0.5) so the LLM
  // has enough context to reason, but irrelevant noise is excluded.
  const MIN_RAG_CONTEXT_THRESHOLD = 0.4;
  const relevantResults = results.filter(
    r => (r.score || 0) >= MIN_RAG_CONTEXT_THRESHOLD
  );

  // If nothing passes the threshold, fall back to the single best result
  // so the LLM still has something to work with
  const resultsToUse = relevantResults.length > 0
    ? relevantResults
    : results.slice(0, 1);

  const contextParts: string[] = [];
  const sources: Array<{
    title: string;
    url: string;
    source: string;
    author?: string;
    relevanceScore: number;
  }> = [];

  resultsToUse.forEach((r, i) => {
    const citationNum = i + 1;
    contextParts.push(`[${citationNum}] ${r.title}: ${r.content.slice(0, 800)}...`);
    sources.push({
      title: r.title,
      url: r.url,
      source: r.source,
      author: r.author,
      relevanceScore: r.score,
    });
  });

  return {
    context: contextParts.join('\n\n'),
    sources,
  };
}

// ============================================
// STATUS CHECK
// ============================================

export async function checkSupabaseStatus(): Promise<{
  configured: boolean;
  healthy: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { configured: false, healthy: false, error: 'Supabase not configured' };
  }

  try {
    // Simple health check - try to call search with empty query
    const response = await fetch(ENDPOINTS.search, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ query: 'test', topK: 1 }),
    });

    return {
      configured: true,
      healthy: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
