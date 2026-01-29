-- ============================================
-- Migration: Add Source Provenance Fields
-- Tracks freshness, trust tier, and verification status
-- ============================================

-- Add provenance columns to knowledge_documents table
ALTER TABLE knowledge_documents 
ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS trust_tier SMALLINT DEFAULT 4 CHECK (trust_tier BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by TEXT,
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add index for freshness queries
CREATE INDEX IF NOT EXISTS idx_knowledge_freshness 
ON knowledge_documents(trust_tier, retrieved_at DESC, is_active)
WHERE is_active = TRUE;

-- Add index for content deduplication
CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash 
ON knowledge_documents(content_hash)
WHERE content_hash IS NOT NULL;

-- ============================================
-- Function: Check if source is fresh
-- Returns TRUE if content is fresh or stale (usable)
-- Returns FALSE if content is expired or unknown
-- ============================================
CREATE OR REPLACE FUNCTION is_source_fresh(
  p_source TEXT,
  p_retrieved_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_days_old INTEGER;
  v_stale_threshold INTEGER;
  v_expired_threshold INTEGER;
BEGIN
  -- Check explicit expiration first
  IF p_expires_at IS NOT NULL AND p_expires_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate days old
  v_days_old := EXTRACT(DAY FROM (NOW() - p_retrieved_at));
  
  -- Set thresholds based on source
  CASE LOWER(p_source)
    WHEN 'capitalone' THEN
      v_stale_threshold := 90;
      v_expired_threshold := 180;
    WHEN 'capitalone-official' THEN
      v_stale_threshold := 90;
      v_expired_threshold := 180;
    WHEN 'tpg' THEN
      v_stale_threshold := 60;
      v_expired_threshold := 120;
    WHEN 'nerdwallet' THEN
      v_stale_threshold := 60;
      v_expired_threshold := 120;
    WHEN 'doctorofcredit' THEN
      v_stale_threshold := 30;
      v_expired_threshold := 60;
    WHEN 'reddit' THEN
      v_stale_threshold := 14;
      v_expired_threshold := 60;
    ELSE
      v_stale_threshold := 30;
      v_expired_threshold := 90;
  END CASE;
  
  -- Return TRUE if not expired
  RETURN v_days_old < v_expired_threshold;
END;
$$;

-- ============================================
-- Function: Get freshness status
-- Returns 'fresh', 'stale', 'expired', or 'unknown'
-- ============================================
CREATE OR REPLACE FUNCTION get_freshness_status(
  p_source TEXT,
  p_retrieved_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_days_old INTEGER;
  v_stale_threshold INTEGER;
  v_expired_threshold INTEGER;
BEGIN
  IF p_retrieved_at IS NULL THEN
    RETURN 'unknown';
  END IF;
  
  -- Check explicit expiration first
  IF p_expires_at IS NOT NULL AND p_expires_at < NOW() THEN
    RETURN 'expired';
  END IF;
  
  -- Calculate days old
  v_days_old := EXTRACT(DAY FROM (NOW() - p_retrieved_at));
  
  -- Set thresholds based on source
  CASE LOWER(p_source)
    WHEN 'capitalone' THEN
      v_stale_threshold := 90;
      v_expired_threshold := 180;
    WHEN 'capitalone-official' THEN
      v_stale_threshold := 90;
      v_expired_threshold := 180;
    WHEN 'tpg' THEN
      v_stale_threshold := 60;
      v_expired_threshold := 120;
    WHEN 'nerdwallet' THEN
      v_stale_threshold := 60;
      v_expired_threshold := 120;
    WHEN 'doctorofcredit' THEN
      v_stale_threshold := 30;
      v_expired_threshold := 60;
    WHEN 'reddit' THEN
      v_stale_threshold := 14;
      v_expired_threshold := 60;
    ELSE
      v_stale_threshold := 30;
      v_expired_threshold := 90;
  END CASE;
  
  -- Return status
  IF v_days_old >= v_expired_threshold THEN
    RETURN 'expired';
  ELSIF v_days_old >= v_stale_threshold THEN
    RETURN 'stale';
  ELSE
    RETURN 'fresh';
  END IF;
END;
$$;

-- ============================================
-- Function: Search knowledge with freshness filter
-- Only returns fresh/stale content, excludes expired
-- ============================================
CREATE OR REPLACE FUNCTION search_knowledge_fresh(
  query_embedding VECTOR(384),
  match_count INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5,
  include_stale BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  source TEXT,
  url TEXT,
  similarity FLOAT,
  trust_tier SMALLINT,
  freshness_status TEXT,
  retrieved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.content,
    d.source,
    d.url,
    1 - (d.embedding <=> query_embedding) AS similarity,
    d.trust_tier,
    get_freshness_status(d.source, d.retrieved_at, d.expires_at) AS freshness_status,
    d.retrieved_at
  FROM knowledge_documents d
  WHERE 
    d.is_active = TRUE
    AND 1 - (d.embedding <=> query_embedding) >= similarity_threshold
    AND (
      include_stale = TRUE 
      OR get_freshness_status(d.source, d.retrieved_at, d.expires_at) = 'fresh'
    )
    AND get_freshness_status(d.source, d.retrieved_at, d.expires_at) != 'expired'
  ORDER BY 
    d.trust_tier ASC,  -- Prefer higher trust (lower number)
    similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- Trigger: Update version on content change
-- Bumps version number when content_hash changes
-- ============================================
CREATE OR REPLACE FUNCTION bump_version_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.content_hash IS DISTINCT FROM NEW.content_hash THEN
    NEW.version := COALESCE(OLD.version, 0) + 1;
    NEW.retrieved_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_bump_version ON knowledge_documents;
CREATE TRIGGER trigger_bump_version
BEFORE UPDATE ON knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION bump_version_on_change();

-- ============================================
-- Update existing rows with default provenance
-- ============================================
UPDATE knowledge_documents
SET 
  trust_tier = CASE 
    WHEN LOWER(source) LIKE '%capitalone%' THEN 1
    WHEN LOWER(source) IN ('tpg', 'nerdwallet') THEN 2
    WHEN LOWER(source) IN ('flyertalk', 'churning') THEN 3
    ELSE 4
  END,
  retrieved_at = COALESCE(retrieved_at, created_at, NOW()),
  is_active = TRUE
WHERE trust_tier IS NULL;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN knowledge_documents.trust_tier IS 'Trust tier 1-4: 1=Official, 2=Editorial, 3=Community, 4=User';
COMMENT ON COLUMN knowledge_documents.retrieved_at IS 'When content was scraped/indexed';
COMMENT ON COLUMN knowledge_documents.published_at IS 'When original content was published';
COMMENT ON COLUMN knowledge_documents.expires_at IS 'When content becomes invalid (e.g., promo end date)';
COMMENT ON COLUMN knowledge_documents.content_hash IS 'SHA-256 hash for change detection';
COMMENT ON COLUMN knowledge_documents.is_active IS 'FALSE for old versions, TRUE for current';
COMMENT ON FUNCTION is_source_fresh IS 'Check if source is fresh enough to use';
COMMENT ON FUNCTION get_freshness_status IS 'Get freshness status: fresh/stale/expired/unknown';
COMMENT ON FUNCTION search_knowledge_fresh IS 'Search with freshness filter - excludes expired content';
