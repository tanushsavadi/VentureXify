// ============================================
// VENTUREX EMBED - Supabase Edge Function
// Generates embeddings using HuggingFace
// ============================================
// 
// Deploy with: supabase functions deploy venturex-embed
//
// Environment variables needed:
// - HF_API_KEY: Your HuggingFace API key (optional)
//
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const HF_EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_EMBEDDING_MODEL}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmbedRequest {
  texts: string[]
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const HF_API_KEY = Deno.env.get('HF_API_KEY')
    
    const { texts } = await req.json() as EmbedRequest

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new Error('texts array is required')
    }

    // Generate embeddings for each text
    const embeddings: (number[] | null)[] = []
    
    for (const text of texts) {
      const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 512)
      
      if (!cleanText) {
        embeddings.push(null)
        continue
      }

      const response = await fetch(HF_INFERENCE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(HF_API_KEY ? { 'Authorization': `Bearer ${HF_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          inputs: cleanText,
          options: { wait_for_model: true },
        }),
      })

      if (!response.ok) {
        if (response.status === 503) {
          // Model loading - wait and retry
          await new Promise(resolve => setTimeout(resolve, 5000))
          const retryResponse = await fetch(HF_INFERENCE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(HF_API_KEY ? { 'Authorization': `Bearer ${HF_API_KEY}` } : {}),
            },
            body: JSON.stringify({
              inputs: cleanText,
              options: { wait_for_model: true },
            }),
          })
          
          if (retryResponse.ok) {
            const data = await retryResponse.json()
            const embedding = Array.isArray(data[0]) ? data[0] : data
            embeddings.push(embedding)
            continue
          }
        }
        embeddings.push(null)
        continue
      }

      const data = await response.json()
      const embedding = Array.isArray(data[0]) ? data[0] : data
      
      if (embedding.length === 384) {
        embeddings.push(embedding)
      } else {
        embeddings.push(null)
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return new Response(
      JSON.stringify({
        success: true,
        embeddings,
        count: embeddings.filter(e => e !== null).length,
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
