-- =====================================================
-- Advanced RAG Migration
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Add metadata columns to Vector_chunk
ALTER TABLE "Vector_chunk"
  ADD COLUMN IF NOT EXISTS page_number INTEGER,
  ADD COLUMN IF NOT EXISTS section_title TEXT,
  ADD COLUMN IF NOT EXISTS is_table_data BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS context_summary TEXT;

-- 2. Add tsvector column for full-text search
ALTER TABLE "Vector_chunk"
  ADD COLUMN IF NOT EXISTS text_search TSVECTOR;

-- Auto-populate tsvector from text column
UPDATE "Vector_chunk" SET text_search = to_tsvector('english', COALESCE(text, ''))
  WHERE text_search IS NULL;

-- Trigger to keep tsvector in sync on INSERT/UPDATE
CREATE OR REPLACE FUNCTION vector_chunk_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.text_search := to_tsvector('english', COALESCE(NEW.text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsvector_update ON "Vector_chunk";
CREATE TRIGGER tsvector_update
  BEFORE INSERT OR UPDATE OF text ON "Vector_chunk"
  FOR EACH ROW EXECUTE FUNCTION vector_chunk_tsvector_trigger();

-- 3. Add document_summary column to Resources
ALTER TABLE "Resources"
  ADD COLUMN IF NOT EXISTS document_summary TEXT;

-- 4. Drop old ivfflat index and create HNSW index
DROP INDEX IF EXISTS idx_vector_chunk_embeddings;

CREATE INDEX IF NOT EXISTS idx_vector_chunk_hnsw
  ON "Vector_chunk"
  USING hnsw (content_embeddings vector_cosine_ops);

-- 5. Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_vector_chunk_text_search
  ON "Vector_chunk"
  USING gin (text_search);

-- 6. Drop old match_chunks function
DROP FUNCTION IF EXISTS match_chunks(vector(768), uuid, uuid[], int);
DROP FUNCTION IF EXISTS match_chunks;

-- 7. Create hybrid_search function with RRF
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(768),
  query_text text,
  p_subject_id uuid,
  p_resource_ids uuid[] DEFAULT NULL,
  match_count int DEFAULT 20,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  chunk_id uuid,
  resource_id uuid,
  chunk_text text,
  chunk_index int4,
  page_number int4,
  section_title text,
  is_table_data boolean,
  context_summary text,
  similarity float,
  rrf_score float,
  document_title varchar,
  resource_type varchar
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      vc.chunk_id,
      vc.resource_id,
      vc.text AS chunk_text,
      vc.chunk_index,
      vc.page_number,
      vc.section_title,
      vc.is_table_data,
      vc.context_summary,
      (1 - (vc.content_embeddings <=> query_embedding))::float AS similarity,
      r.title AS document_title,
      r.resource_type,
      ROW_NUMBER() OVER (ORDER BY vc.content_embeddings <=> query_embedding) AS vector_rank
    FROM "Vector_chunk" vc
    JOIN "Resources" r ON r.resource_id = vc.resource_id
    WHERE r.subject_id = p_subject_id
      AND (p_resource_ids IS NULL OR vc.resource_id = ANY(p_resource_ids))
    ORDER BY vc.content_embeddings <=> query_embedding
    LIMIT match_count * 2
  ),
  text_results AS (
    SELECT
      vc.chunk_id,
      ts_rank(vc.text_search, websearch_to_tsquery('english', query_text))::float AS text_rank_score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(vc.text_search, websearch_to_tsquery('english', query_text)) DESC
      ) AS text_rank
    FROM "Vector_chunk" vc
    JOIN "Resources" r ON r.resource_id = vc.resource_id
    WHERE r.subject_id = p_subject_id
      AND (p_resource_ids IS NULL OR vc.resource_id = ANY(p_resource_ids))
      AND vc.text_search @@ websearch_to_tsquery('english', query_text)
    ORDER BY ts_rank(vc.text_search, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      vr.chunk_id,
      vr.resource_id,
      vr.chunk_text,
      vr.chunk_index,
      vr.page_number,
      vr.section_title,
      vr.is_table_data,
      vr.context_summary,
      vr.similarity,
      vr.document_title,
      vr.resource_type,
      vr.vector_rank,
      tr.text_rank,
      -- RRF Score: combine both rankings
      (1.0 / (rrf_k + vr.vector_rank))::float +
      COALESCE((1.0 / (rrf_k + tr.text_rank))::float, 0) AS rrf_score
    FROM vector_results vr
    LEFT JOIN text_results tr ON vr.chunk_id = tr.chunk_id
  )
  SELECT
    c.chunk_id,
    c.resource_id,
    c.chunk_text,
    c.chunk_index,
    c.page_number,
    c.section_title,
    c.is_table_data,
    c.context_summary,
    c.similarity,
    c.rrf_score,
    c.document_title,
    c.resource_type
  FROM combined c
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
END;
$$;

-- 8. Verify
-- Run these after migration to confirm:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'Vector_chunk';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'Vector_chunk';
-- SELECT proname FROM pg_proc WHERE proname = 'hybrid_search';
