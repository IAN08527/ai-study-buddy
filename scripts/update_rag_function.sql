-- =====================================================
-- RAG Function Update: 768 Dimensions (Ollama)
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Drop the old function (to avoid mismatched signatures)
DROP FUNCTION IF EXISTS match_chunks(vector(1536), uuid, uuid[], int);
DROP FUNCTION IF EXISTS match_chunks;

-- 2. Create the new function accepting vector(768)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(768),
  p_subject_id uuid,
  p_resource_ids uuid[] DEFAULT NULL,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  resource_id uuid,
  chunk_text text,
  chunk_index int4,
  similarity float,
  document_title varchar,
  resource_type varchar
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vc.chunk_id,
    vc.resource_id,
    vc.text AS chunk_text,
    vc.chunk_index,
    1 - (vc.content_embeddings <=> query_embedding) AS similarity,
    r.title AS document_title,
    r.resource_type
  FROM "Vector_chunk" vc
  JOIN "Resources" r ON r.resource_id = vc.resource_id
  WHERE r.subject_id = p_subject_id
    AND (p_resource_ids IS NULL OR vc.resource_id = ANY(p_resource_ids))
  ORDER BY vc.content_embeddings <=> query_embedding
  LIMIT match_count;
END;
$$;
