-- =====================================================
-- RAG Setup: Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Ensure the content_embeddings column is 768-dim
-- (If the column was created without a specific dimension, alter it)
-- This is safe to run even if it already exists with the right type.
ALTER TABLE "Vector_chunk" 
  ALTER COLUMN content_embeddings TYPE vector(768);

-- 3. Create a similarity search function
-- This finds the most relevant text chunks for a user query.
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

-- 4. Create an index for faster vector search
CREATE INDEX IF NOT EXISTS idx_vector_chunk_embeddings 
  ON "Vector_chunk" 
  USING ivfflat (content_embeddings vector_cosine_ops)
  WITH (lists = 100);
