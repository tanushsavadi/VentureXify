// ============================================
// VENTUREX SEARCH - Supabase Edge Function
// Semantic search using pgvector
// ============================================
// 
// Deploy with: supabase functions deploy venturex-search
//
// Environment variables needed:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - HF_API_KEY (optional)
//
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Using BAAI/bge-small-en-v1.5 - better quality embeddings, 384 dimensions
const HF_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5'
// HuggingFace router (api-inference is deprecated)
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchRequest {
  query: string
  topK?: number
  threshold?: number
}

// Generate embedding for search query
async function generateQueryEmbedding(text: string, apiKey?: string): Promise<number[] | null> {
  const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 512)
  
  if (!cleanText) return null

  try {
    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: cleanText,
        options: { wait_for_model: true },
      }),
    })

    if (!response.ok) {
      if (response.status === 503) {
        // Model loading, wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000))
        return generateQueryEmbedding(text, apiKey)
      }
      return null
    }

    const data = await response.json()
    const embedding = Array.isArray(data[0]) ? data[0] : data
    
    return embedding.length === 384 ? embedding : null
  } catch (error) {
    console.error('Embedding error:', error)
    return null
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const HF_API_KEY = Deno.env.get('HF_API_KEY')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { query, topK = 5, threshold = 0.3 } = await req.json() as SearchRequest

    if (!query) {
      throw new Error('query is required')
    }

    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query, HF_API_KEY || undefined)
    
    if (!queryEmbedding) {
      return new Response(
        JSON.stringify({
          success: true,
          results: [],
          message: 'Could not generate query embedding'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Call the search function in Supabase
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK,
    })

    if (error) {
      console.error('Search error:', error)
      throw error
    }

    // Format results — includes source_tier from tier-aware search_knowledge function
    const results = (data || []).map((row: {
      id: string
      content: string
      title: string
      source: string
      url: string
      author: string | null
      similarity: number
      source_tier: number | null
    }) => ({
      id: row.id,
      score: row.similarity,
      title: row.title,
      content: row.content,
      source: row.source,
      url: row.url,
      author: row.author,
      source_tier: row.source_tier ?? 2,
    }))

    return new Response(
      JSON.stringify({
        success: true,
        results,
        count: results.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
