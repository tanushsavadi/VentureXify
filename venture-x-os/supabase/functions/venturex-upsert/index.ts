// ============================================
// VENTUREX UPSERT - Supabase Edge Function
// Stores document embeddings in pgvector
// ============================================
// 
// Deploy with: supabase functions deploy venturex-upsert
//
// Environment variables needed:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Document {
  id: string
  embedding: number[]
  content: string
  title: string
  source: string
  url?: string
  author?: string
  score?: number
}

interface UpsertRequest {
  documents: Document[]
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { documents } = await req.json() as UpsertRequest

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new Error('documents array is required')
    }

    let successCount = 0
    let errorCount = 0

    // Upsert each document
    for (const doc of documents) {
      if (!doc.id || !doc.embedding || !doc.content || !doc.title || !doc.source) {
        errorCount++
        continue
      }

      // Validate embedding dimension
      if (doc.embedding.length !== 384) {
        console.error(`Invalid embedding dimension for ${doc.id}: ${doc.embedding.length}`)
        errorCount++
        continue
      }

      try {
        const { error } = await supabase.rpc('upsert_knowledge', {
          p_id: doc.id,
          p_embedding: doc.embedding,
          p_content: doc.content.slice(0, 10000), // Limit content length
          p_title: doc.title.slice(0, 500),
          p_source: doc.source,
          p_url: doc.url || null,
          p_author: doc.author || null,
          p_score: doc.score || null,
        })

        if (error) {
          console.error(`Error upserting ${doc.id}:`, error)
          errorCount++
        } else {
          successCount++
        }
      } catch (e) {
        console.error(`Exception upserting ${doc.id}:`, e)
        errorCount++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        upserted: successCount,
        errors: errorCount,
        total: documents.length,
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
