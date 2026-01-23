// ============================================
// API KEYS CONFIGURATION
// ============================================
// 
// For distribution: These keys are bundled in the extension
// so users don't need to configure anything.
//
// SECURITY NOTE: Keys bundled in Chrome extensions can be
// extracted by determined users. For production at scale,
// consider using a backend proxy (Supabase Edge Functions).
//
// ============================================

// Groq API Key - For AI chat responses
// Free tier: 30 requests/minute, 14,400 requests/day
// Get yours at: https://console.groq.com/keys
export const GROQ_API_KEY: string = 'YOUR_GROQ_API_KEY_HERE';

// HuggingFace API Key - For embedding generation
// Free tier: Rate limited but generous
// Get yours at: https://huggingface.co/settings/tokens
export const HUGGINGFACE_API_KEY: string = 'YOUR_HF_API_KEY_HERE';

// Pinecone Configuration - For vector search
// Free tier: 1 index, 1M vectors
// Get yours at: https://www.pinecone.io
export const PINECONE_HOST: string = 'YOUR_PINECONE_INDEX_HOST_HERE'; // e.g., 'https://venturex-xxx.svc.gcp-starter.pinecone.io'
export const PINECONE_API_KEY: string = 'YOUR_PINECONE_API_KEY_HERE';

// ============================================
// USAGE TRACKING (optional - for when you scale)
// ============================================

// If you want to track usage to plan for scaling:
// export const ANALYTICS_ENDPOINT = 'https://your-supabase-project.supabase.co/rest/v1/usage';

// ============================================
// RATE LIMITS & COSTS (for planning)
// ============================================
// 
// Groq (Llama 3.1 8B):
// - Free: 30 req/min, 14,400/day
// - Input: $0.05/1M tokens
// - Output: $0.08/1M tokens
// - ~1000 chats/day costs ~$0.50
//
// HuggingFace (embeddings):
// - Free tier works fine for most use cases
// - Rate limited but not strictly enforced
//
// Pinecone:
// - Free: 1 index, 1M vectors
// - Starter: $70/mo for 5M vectors
//
// At 100 users with 10 queries/day each:
// - ~$5/month Groq
// - ~$0 HuggingFace
// - ~$0 Pinecone (free tier)
//
// At 1000 users with 10 queries/day each:
// - ~$50/month Groq
// - May need paid HuggingFace
// - May need paid Pinecone
//
// ============================================

// Check if keys are configured
export function areKeysConfigured(): boolean {
  return (
    GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE' &&
    GROQ_API_KEY.startsWith('gsk_')
  );
}

// Get config status for debugging
export function getConfigStatus(): {
  groq: boolean;
  huggingface: boolean;
  pinecone: boolean;
} {
  return {
    groq: GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE' && GROQ_API_KEY.startsWith('gsk_'),
    huggingface: HUGGINGFACE_API_KEY !== 'YOUR_HF_API_KEY_HERE' && HUGGINGFACE_API_KEY.startsWith('hf_'),
    pinecone: PINECONE_API_KEY !== 'YOUR_PINECONE_API_KEY_HERE' && PINECONE_HOST.startsWith('https://'),
  };
}
