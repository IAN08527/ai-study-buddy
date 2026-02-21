/**
 * PDF text extraction, chunking, and embedding pipeline.
 *
 * Usage:
 *   await processPdfForRag(supabase, pdfBuffer, resourceId);
 */

import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { generateEmbedding } from "./embeddings.js";

async function generateContextSummary(chunkText, docTitle) {
  // Simple fallback: Provide a basic description without LLM call
  return `Key information from "${docTitle}": ${chunkText.slice(0, 100)}...`;
}

async function generateDocumentSummary(fullText, docTitle) {
  // Simple fallback: Return a truncated version of the first paragraph
  const teaser = fullText.slice(0, 250).trim();
  return `Knowledge document titled "${docTitle}". Overview: ${teaser}${fullText.length > 250 ? '...' : ''}`;
}

/**
 * Extract raw text from a PDF buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Split text into overlapping chunks for embedding.
 * @param {string} text - Full document text
 * @param {number} chunkSize - Target chunk size in characters (default 500)
 * @param {number} overlap  - Overlap between chunks in characters (default 50)
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, chunkSize = 500, overlap = 50) {
  // Ensure overlap is less than chunk size to prevent infinite loops
  const effectiveOverlap = Math.min(overlap, chunkSize - 20);
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= chunkSize) {
    return cleaned.length > 0 ? [cleaned] : [];
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const lastPeriod = slice.lastIndexOf(". ");
      const lastNewline = slice.lastIndexOf("\n");
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      // Only break at boundary if it's reasonably far into the chunk
      if (breakPoint > chunkSize * 0.5) {
        end = start + breakPoint + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    const nextStart = end - effectiveOverlap;
    
    // Safety: ensure we always advance at least one character
    if (nextStart <= start) {
      start = end;
    } else {
      start = nextStart;
    }

    if (start >= cleaned.length) break;
  }

  return chunks;
}


/**
 * Full pipeline: extract text → chunk → embed → store in Vector_chunk.
 * @param {object} supabase - Authenticated Supabase client
 * @param {Buffer} buffer   - PDF file buffer
 * @param {string} resourceId - The resource_id from Resources table
 */
export async function processPdfForRag(supabase, buffer, resourceId, resourceTitle = "Unknown Document", onProgress = null) {
  // 1. Extract text
  const text = await extractTextFromPdf(buffer);
  if (!text || text.trim().length === 0) {
    console.warn(`No text extracted for resource ${resourceId}`);
    return;
  }

  // 2. Generate Doc Summary
  console.log(`   📝 Generating document summary...`);
  const docSummary = await generateDocumentSummary(text, resourceTitle);
  
  await supabase
    .from('Resources')
    .update({ document_summary: docSummary })
    .eq('resource_id', resourceId);

  // 3. Chunk the text
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  console.log(`Processing ${chunks.length} chunks for resource ${resourceId}`);
  if (onProgress) onProgress({ type: "start", total: chunks.length, title: resourceTitle });

  // 4. Summarize (Parallel because it's fast fallback logic)
  console.log(`   📝 Generating context summaries (Parallel)...`);
  const chunkSummaries = await Promise.all(
    chunks.map((chunk) => generateContextSummary(chunk, resourceTitle))
  );


  // 5. Embed and Store (Batched Parallel)
  const BATCH_SIZE = 5;
  console.log(`   🚀 Embedding & Storing chunks in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchSummaries = chunkSummaries.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (chunk, index) => {
        const globalIndex = i + index;
        const currentSummary = batchSummaries[index];
        try {
          const combinedText = `${currentSummary}\n\n${chunk}`;
          const embedding = await generateEmbedding(combinedText);

          const { error } = await supabase.from("Vector_chunk").insert({
            resource_id: resourceId,
            text: chunk,
            content_embeddings: embedding,
            chunk_index: globalIndex,
            context_summary: currentSummary,
          });

          if (error) {
            console.error(`   ❌ Chunk ${globalIndex}: ${error.message}`);
          } else {
            if (onProgress) onProgress({ type: "progress", current: globalIndex + 1, total: chunks.length, title: resourceTitle });
          }
        } catch (err) {
          console.error(`   ❌ Chunk ${globalIndex} failed: ${err.message}`);
        }
      })
    );
  }


  console.log(`Finished processing resource ${resourceId}`);
}
