// ============================================
// SUPABASE CONFIGURATION
// ============================================
// 
// This file contains your Supabase project configuration.
// The extension calls Supabase Edge Functions which proxy
// to Groq (AI) and handle vector storage - keeping API keys
// safe on the server.
//
// ============================================

// Your Supabase project URL
// Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
export const SUPABASE_URL: string = 'https://yxbbmwebqjpxvpgzcyph.supabase.co';

// Supabase anon key (safe to expose - it's rate limited by RLS)
// Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
export const SUPABASE_ANON_KEY: string = 'sb_publishable_Pq37hXBqizmq3sBeh-Dreg_eHUjJQqz';

// Edge function endpoints
export const ENDPOINTS = {
  // AI Chat - proxies to Groq
  chat: `${SUPABASE_URL}/functions/v1/venturex-chat`,
  
  // Generate embeddings
  embed: `${SUPABASE_URL}/functions/v1/venturex-embed`,
  
  // Vector search
  search: `${SUPABASE_URL}/functions/v1/venturex-search`,
  
  // Upsert vectors to database
  upsert: `${SUPABASE_URL}/functions/v1/venturex-upsert`,
  
  // Update knowledge base (scrape + embed + store)
  updateKnowledge: `${SUPABASE_URL}/functions/v1/venturex-update-knowledge`,
} as const;

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' &&
    SUPABASE_URL.includes('supabase.co') &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
    SUPABASE_ANON_KEY.length > 20
  );
}

// Get headers for Supabase requests
export function getSupabaseHeaders(): Record<string, string> {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}
