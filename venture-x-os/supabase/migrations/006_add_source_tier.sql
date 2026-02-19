-- ============================================
-- Migration: Add source_tier to knowledge_embeddings
-- Enables tier-aware scoring so official Capital One
-- sources outrank Reddit in RAG retrieval.
-- ============================================
--
-- Tier scale (0-2):
--   0 = Official Capital One (policy truth)
--   1 = Trusted third-party guides (TPG, NerdWallet, OMAAT, etc.)
--   2 = Community sources (Reddit, FlyerTalk)
--
-- IMPORTANT: This is an additive migration - backward compatible.
-- All existing queries continue to work. New parameter p_source_tier
-- defaults to 2 so callers that don't pass it behave as before.
-- ============================================

-- 1. Add source_tier column (DEFAULT 2 = community, safest default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_embeddings'
    AND column_name = 'source_tier'
  ) THEN
    ALTER TABLE knowledge_embeddings
    ADD COLUMN source_tier SMALLINT DEFAULT 2;
  END IF;
END $$;

-- 2. Backfill existing rows based on source field
UPDATE knowledge_embeddings
SET source_tier = 0
WHERE LOWER(source) = 'capitalone'
  AND (source_tier IS NULL OR source_tier != 0);

UPDATE knowledge_embeddings
SET source_tier = 1
WHERE LOWER(source) IN ('tpg', 'nerdwallet', 'doctorofcredit', 'omaat', 'onemileatatime', 'frequentmiler', 'editorial')
  AND (source_tier IS NULL OR source_tier != 1);

UPDATE knowledge_embeddings
SET source_tier = 2
WHERE LOWER(source) IN ('reddit-post', 'reddit-comment', 'reddit', 'flyertalk', 'custom')
  AND (source_tier IS NULL OR source_tier != 2);

-- Catch-all: anything still NULL gets tier 2
UPDATE knowledge_embeddings
SET source_tier = 2
WHERE source_tier IS NULL;

-- 3. Create index on source_tier for fast filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_source_tier
ON knowledge_embeddings (source_tier);

-- ============================================
-- DROP existing functions whose return types are changing.
-- PostgreSQL cannot CREATE OR REPLACE when OUT parameters differ;
-- we must DROP using the ORIGINAL input-parameter signature first.
-- ============================================
DROP FUNCTION IF EXISTS search_knowledge(vector, double precision, integer);
DROP FUNCTION IF EXISTS upsert_knowledge(text, vector, text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS get_knowledge_stats();
DROP FUNCTION IF EXISTS search_knowledge_bm25(text, integer);
DROP FUNCTION IF EXISTS search_knowledge_hybrid(vector, text, double precision, integer, double precision, double precision, integer);
DROP FUNCTION IF EXISTS search_knowledge_text_only(text, integer);

-- 4. Update upsert_knowledge to accept and store source_tier
CREATE OR REPLACE FUNCTION upsert_knowledge(
  p_id TEXT,
  p_embedding vector(384),
  p_content TEXT,
  p_title TEXT,
  p_source TEXT,
  p_url TEXT DEFAULT NULL,
  p_author TEXT DEFAULT NULL,
  p_score INTEGER DEFAULT NULL,
  p_source_tier SMALLINT DEFAULT 2
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO knowledge_embeddings (id, embedding, content, title, source, url, author, score, source_tier)
  VALUES (p_id, p_embedding, p_content, p_title, p_source, p_url, p_author, p_score, p_source_tier)
  ON CONFLICT (id) DO UPDATE SET
    embedding = EXCLUDED.embedding,
    content = EXCLUDED.content,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    url = EXCLUDED.url,
    author = EXCLUDED.author,
    score = EXCLUDED.score,
    source_tier = EXCLUDED.source_tier,
    updated_at = NOW();
END;
$$;

-- 5. Replace search_knowledge with tier-aware scoring
--    Tier boost: Tier 0 = +0.15, Tier 1 = +0.05, Tier 2 = +0.00
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
  similarity FLOAT,
  source_tier SMALLINT
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
    (1 - (ke.embedding <=> query_embedding)) +
      CASE COALESCE(ke.source_tier, 2)
        WHEN 0 THEN 0.15
        WHEN 1 THEN 0.05
        ELSE 0.00
      END AS similarity,
    COALESCE(ke.source_tier, 2::SMALLINT) AS source_tier
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 6. Update hybrid search to also return source_tier
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
  fused_score FLOAT,
  source_tier SMALLINT
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
    similarity FLOAT,
    source_tier SMALLINT
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS temp_sparse_results (
    doc_id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    source TEXT,
    url TEXT,
    author TEXT,
    rank_pos INTEGER,
    bm25_score FLOAT,
    source_tier SMALLINT
  ) ON COMMIT DROP;

  -- Clear any existing data
  TRUNCATE temp_dense_results;
  TRUNCATE temp_sparse_results;

  -- Get dense (vector) search results with ranks
  INSERT INTO temp_dense_results (doc_id, title, content, source, url, author, rank_pos, similarity, source_tier)
  SELECT
    ke.id,
    ke.title,
    ke.content,
    ke.source,
    ke.url,
    ke.author,
    ROW_NUMBER() OVER (ORDER BY ke.embedding <=> query_embedding) as rank_pos,
    1 - (ke.embedding <=> query_embedding) as similarity,
    COALESCE(ke.source_tier, 2::SMALLINT) as source_tier
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count * 3;

  -- Get sparse (BM25) search results with ranks (only if query_text provided)
  IF query_text IS NOT NULL AND query_text != '' THEN
    INSERT INTO temp_sparse_results (doc_id, title, content, source, url, author, rank_pos, bm25_score, source_tier)
    SELECT
      ke.id,
      ke.title,
      ke.content,
      ke.source,
      ke.url,
      ke.author,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32) DESC) as rank_pos,
      ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32) as bm25_score,
      COALESCE(ke.source_tier, 2::SMALLINT) as source_tier
    FROM knowledge_embeddings ke
    WHERE ke.content_tsv @@ websearch_to_tsquery('english', query_text)
    ORDER BY bm25_score DESC
    LIMIT match_count * 3;
  END IF;

  -- Compute RRF fusion with tier boost and return results
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
      COALESCE(d.source_tier, s.source_tier, 2::SMALLINT) as fused_tier,
      -- RRF formula + tier boost
      dense_weight * (1.0 / (rrf_k + COALESCE(d.rank_pos, 1000))) +
      sparse_weight * (1.0 / (rrf_k + COALESCE(s.rank_pos, 1000))) +
      CASE COALESCE(d.source_tier, s.source_tier, 2)
        WHEN 0 THEN 0.15
        WHEN 1 THEN 0.05
        ELSE 0.00
      END as fusion_score
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
    fusion_score,
    fused_tier
  FROM fused
  ORDER BY fusion_score DESC
  LIMIT match_count;
END;
$$;

-- 7. Update BM25 search to also return source_tier
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
  bm25_rank REAL,
  source_tier SMALLINT
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
    ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32) as bm25_rank,
    COALESCE(ke.source_tier, 2::SMALLINT) AS source_tier
  FROM knowledge_embeddings ke
  WHERE ke.content_tsv @@ websearch_to_tsquery('english', query_text)
  ORDER BY bm25_rank DESC
  LIMIT match_count;
END;
$$;

-- 8. Update text-only search to also return source_tier
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
  score FLOAT,
  source_tier SMALLINT
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
    ts_rank_cd(ke.content_tsv, websearch_to_tsquery('english', query_text), 32)::FLOAT as score,
    COALESCE(ke.source_tier, 2::SMALLINT) AS source_tier
  FROM knowledge_embeddings ke
  WHERE ke.content_tsv @@ websearch_to_tsquery('english', query_text)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- 9. Update get_knowledge_stats to include tier breakdown
CREATE OR REPLACE FUNCTION get_knowledge_stats()
RETURNS TABLE (
  total_documents BIGINT,
  reddit_posts BIGINT,
  reddit_comments BIGINT,
  capitalone_docs BIGINT,
  tier0_count BIGINT,
  tier1_count BIGINT,
  tier2_count BIGINT,
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
    COUNT(*) FILTER (WHERE source_tier = 0) AS tier0_count,
    COUNT(*) FILTER (WHERE source_tier = 1) AS tier1_count,
    COUNT(*) FILTER (WHERE source_tier = 2) AS tier2_count,
    MAX(updated_at) AS last_updated
  FROM knowledge_embeddings;
END;
$$;

-- ============================================
-- DOCUMENTATION
-- ============================================
COMMENT ON COLUMN knowledge_embeddings.source_tier IS 'Source tier: 0=Official CapitalOne, 1=Trusted Guide, 2=Community (Reddit)';
