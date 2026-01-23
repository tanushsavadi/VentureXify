-- ============================================
-- SUPABASE PGVECTOR SETUP FOR VENTUREX OS
-- ============================================
-- 
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- Prerequisites:
-- 1. Create a Supabase project at https://supabase.com
-- 2. Go to SQL Editor and run this script
--
-- ============================================

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the knowledge embeddings table
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id TEXT PRIMARY KEY,
  embedding vector(384), -- 384 dimensions for all-MiniLM-L6-v2
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL, -- 'reddit-post', 'reddit-comment', 'capitalone'
  url TEXT,
  author TEXT,
  score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for fast similarity search
CREATE INDEX IF NOT EXISTS knowledge_embedding_idx 
ON knowledge_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Create index on source for filtering
CREATE INDEX IF NOT EXISTS knowledge_source_idx 
ON knowledge_embeddings (source);

-- 5. Function for semantic search
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  title TEXT,
  source TEXT,
  url TEXT,
  author TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.title,
    ke.source,
    ke.url,
    ke.author,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Function to upsert documents (insert or update)
CREATE OR REPLACE FUNCTION upsert_knowledge(
  p_id TEXT,
  p_embedding vector(384),
  p_content TEXT,
  p_title TEXT,
  p_source TEXT,
  p_url TEXT DEFAULT NULL,
  p_author TEXT DEFAULT NULL,
  p_score INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO knowledge_embeddings (id, embedding, content, title, source, url, author, score)
  VALUES (p_id, p_embedding, p_content, p_title, p_source, p_url, p_author, p_score)
  ON CONFLICT (id) DO UPDATE SET
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    url = EXCLUDED.url,
    author = EXCLUDED.author,
    score = EXCLUDED.score,
    updated_at = NOW();
END;
$$;

-- 7. Function to get stats
CREATE OR REPLACE FUNCTION get_knowledge_stats()
RETURNS TABLE (
  total_documents BIGINT,
  reddit_posts BIGINT,
  reddit_comments BIGINT,
  capitalone_docs BIGINT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_documents,
    COUNT(*) FILTER (WHERE source = 'reddit-post') AS reddit_posts,
    COUNT(*) FILTER (WHERE source = 'reddit-comment') AS reddit_comments,
    COUNT(*) FILTER (WHERE source = 'capitalone') AS capitalone_docs,
    MAX(updated_at) AS last_updated
  FROM knowledge_embeddings;
END;
$$;

-- 8. Enable Row Level Security (optional - for multi-user setup later)
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- 9. Create policy to allow anonymous read access
CREATE POLICY "Allow anonymous read access" ON knowledge_embeddings
  FOR SELECT
  USING (true);

-- 10. Create policy to allow authenticated insert/update (via Edge Functions)
CREATE POLICY "Allow authenticated insert" ON knowledge_embeddings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON knowledge_embeddings
  FOR UPDATE
  USING (true);

-- ============================================
-- CHAT HISTORY TABLE (Optional - for future)
-- ============================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_agent TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  portal_price DECIMAL,
  direct_price DECIMAL,
  recommendation TEXT,
  metadata JSONB
);

-- ============================================
-- USAGE TRACKING TABLE (Optional - for analytics)
-- ============================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tokens_used INTEGER,
  metadata JSONB
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS api_usage_created_idx ON api_usage (created_at);
CREATE INDEX IF NOT EXISTS api_usage_endpoint_idx ON api_usage (endpoint);

-- ============================================
-- Done! Now deploy the Edge Functions
-- ============================================
