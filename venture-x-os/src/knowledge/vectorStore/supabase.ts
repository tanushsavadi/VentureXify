// ============================================
// SUPABASE CLIENT FOR VENTUREX EXTENSION
// Calls Edge Functions instead of direct API calls
// With STRICT prompt system to prevent hallucinations
// ============================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, ENDPOINTS, isSupabaseConfigured, getSupabaseHeaders } from '../../config/supabase';
import { buildPromptWithContext, validateResponse, STRICT_SYSTEM_PROMPT } from '../../ai/prompts/systemPrompt';

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
    // Build the strict prompt with context injection
    // This ensures the AI only uses numbers we explicitly provide
    const strictPrompt = buildPromptWithContext(
      message,
      {
        portalPrice: context?.portalPrice,
        directPrice: context?.directPrice,
        portalMiles: context?.portalMiles,
        directMiles: context?.directMiles,
        portalNetCost: context?.portalNetCost,
        directNetCost: context?.directNetCost,
        winner: context?.winner,
        savings: context?.savings,
        milesBalance: context?.eraser?.milesBalance,
        creditRemaining: context?.creditRemaining,
        route: context?.route,
        awardMilesRequired: context?.awardMilesRequired,
        awardTaxesFees: context?.awardTaxesFees,
        awardPartner: context?.awardPartner,
      },
      ragContext
    );
    
    console.log('[Supabase] Sending with strict prompt, context:', context ? 'yes' : 'no');
    
    const response = await fetch(ENDPOINTS.chat, {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        message: strictPrompt, // Send the full strict prompt as the message
        context: null,         // Context is already embedded in the prompt
        ragContext: null,      // RAG context is already embedded
        conversationHistory,
        useStrictPrompt: true, // Flag for the edge function
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

  const contextParts: string[] = [];
  const sources: Array<{
    title: string;
    url: string;
    source: string;
    author?: string;
    relevanceScore: number;
  }> = [];

  results.forEach((r, i) => {
    const citationNum = i + 1;
    contextParts.push(`[${citationNum}] ${r.title}: ${r.content.slice(0, 300)}...`);
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
