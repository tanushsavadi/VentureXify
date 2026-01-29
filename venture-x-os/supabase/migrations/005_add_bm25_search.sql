-- ============================================
-- Migration: Add BM25/tsvector Search Support
-- Enables hybrid search (dense + sparse) for better retrieval
-- ============================================
-- 
-- This migration adds text search capabilities alongside existing
-- vector similarity search. The hybrid approach improves retrieval
-- by combining semantic understanding (vectors) with keyword matching (BM25).
--
-- IMPORTANT: This is an additive migration - it does NOT modify
-- existing functionality. All existing queries will continue to work.
-- ============================================

-- 1. Add tsvector column for text search (if not exists)
-- Uses generated column to auto-update when content changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'knowledge_embeddings' 
    AND column_name = 'content_tsv'
  ) THEN
    ALTER TABLE knowledge_embeddings 
    ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(content, '')), 'B')
    ) STORED;
  END IF;
END $$;

-- 2. Create GIN index for fast text search (if not exists)
CREATE INDEX IF NOT EXISTS idx_knowledge_content_tsv 
ON knowledge_embeddings USING GIN(content_tsv);

-- 3. Create BM25-style text search function
-- Uses ts_rank_cd with normalization for BM25-like scoring
CREATE OR REPLACE FUNCTION search_knowledge_bm25(
  query_text TEXT,
  match_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  source TEXT,
  url TEXT,
  author TEXT,
  bm25_rank REAL
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Validate input
  IF query_text IS NULL OR query_text = '' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    ke.id,
    ke.title,
    ke.content,
    ke.source,
    ke.url,
    ke.author,
    -- ts_rank_cd with normalization 32 gives BM25-like behavior
    -- It normalizes by document length (important for BM25)
    ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32) as bm25_rank
  FROM knowledge_embeddings ke
  WHERE ke.content_tsv @@ websearch_to_tsquery('english', query_text)
  ORDER BY bm25_rank DESC
  LIMIT match_count;
END;
$$;

-- 4. Create hybrid search function that combines vector and BM25
-- Uses Reciprocal Rank Fusion (RRF) to merge results
CREATE OR REPLACE FUNCTION search_knowledge_hybrid(
  query_embedding vector(384),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10,
  dense_weight FLOAT DEFAULT 0.5,
  sparse_weight FLOAT DEFAULT 0.5,
  rrf_k INT DEFAULT 60
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  source TEXT,
  url TEXT,
  author TEXT,
  dense_score FLOAT,
  sparse_score FLOAT,
  fused_score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  dense_results RECORD;
  sparse_results RECORD;
BEGIN
  -- Create temporary tables for intermediate results
  CREATE TEMP TABLE IF NOT EXISTS temp_dense_results (
    doc_id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    source TEXT,
    url TEXT,
    author TEXT,
    rank_pos INTEGER,
    similarity FLOAT
  ) ON COMMIT DROP;
  
  CREATE TEMP TABLE IF NOT EXISTS temp_sparse_results (
    doc_id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    source TEXT,
    url TEXT,
    author TEXT,
    rank_pos INTEGER,
    bm25_score FLOAT
  ) ON COMMIT DROP;
  
  -- Clear any existing data
  TRUNCATE temp_dense_results;
  TRUNCATE temp_sparse_results;
  
  -- Get dense (vector) search results with ranks
  INSERT INTO temp_dense_results (doc_id, title, content, source, url, author, rank_pos, similarity)
  SELECT 
    ke.id,
    ke.title,
    ke.content,
    ke.source,
    ke.url,
    ke.author,
    ROW_NUMBER() OVER (ORDER BY ke.embedding <=> query_embedding) as rank_pos,
    1 - (ke.embedding <=> query_embedding) as similarity
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count * 3;
  
  -- Get sparse (BM25) search results with ranks (only if query_text provided)
  IF query_text IS NOT NULL AND query_text != '' THEN
    INSERT INTO temp_sparse_results (doc_id, title, content, source, url, author, rank_pos, bm25_score)
    SELECT 
      ke.id,
      ke.title,
      ke.content,
      ke.source,
      ke.url,
      ke.author,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32) DESC) as rank_pos,
      ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32) as bm25_score
    FROM knowledge_embeddings ke
    WHERE ke.content_tsv @@ websearch_to_tsquery('english', query_text)
    ORDER BY bm25_score DESC
    LIMIT match_count * 3;
  END IF;
  
  -- Compute RRF fusion and return results
  RETURN QUERY
  WITH fused AS (
    SELECT DISTINCT
      COALESCE(d.doc_id, s.doc_id) as fused_id,
      COALESCE(d.title, s.title) as fused_title,
      COALESCE(d.content, s.content) as fused_content,
      COALESCE(d.source, s.source) as fused_source,
      COALESCE(d.url, s.url) as fused_url,
      COALESCE(d.author, s.author) as fused_author,
      COALESCE(d.similarity, 0) as d_score,
      COALESCE(s.bm25_score, 0) as s_score,
      -- RRF formula: score = weight * (1 / (k + rank))
      dense_weight * (1.0 / (rrf_k + COALESCE(d.rank_pos, 1000))) +
      sparse_weight * (1.0 / (rrf_k + COALESCE(s.rank_pos, 1000))) as fusion_score
    FROM temp_dense_results d
    FULL OUTER JOIN temp_sparse_results s ON d.doc_id = s.doc_id
  )
  SELECT 
    fused_id,
    fused_title,
    fused_content,
    fused_source,
    fused_url,
    fused_author,
    d_score,
    s_score,
    fusion_score
  FROM fused
  ORDER BY fusion_score DESC
  LIMIT match_count;
END;
$$;

-- 5. Create a simpler hybrid search for when we only have text (no embedding)
-- Useful for fallback when embedding generation fails
CREATE OR REPLACE FUNCTION search_knowledge_text_only(
  query_text TEXT,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  source TEXT,
  url TEXT,
  author TEXT,
  score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF query_text IS NULL OR query_text = '' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    ke.id,
    ke.title,
    ke.content,
    ke.source,
    ke.url,
    ke.author,
    ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32)::FLOAT as score
  FROM knowledge_embeddings ke
  WHERE ke.content_tsv @@ websearch_to_tsquery('english', query_text)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON COLUMN knowledge_embeddings.content_tsv IS 'Generated tsvector for full-text search (title=A, content=B weights)';
COMMENT ON FUNCTION search_knowledge_bm25 IS 'BM25-style text search using PostgreSQL ts_rank_cd with normalization';
COMMENT ON FUNCTION search_knowledge_hybrid IS 'Hybrid search combining vector similarity and BM25 using Reciprocal Rank Fusion';
COMMENT ON FUNCTION search_knowledge_text_only IS 'Text-only search fallback when embeddings are not available';

-- ============================================
-- VERIFICATION QUERY (optional - run manually)
-- ============================================
-- 
-- After running this migration, verify with:
-- 
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'knowledge_embeddings';
-- 
-- Expected: Should now include 'content_tsv' column of type 'tsvector'
-- ============================================
