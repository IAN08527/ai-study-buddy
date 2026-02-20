/**
 * PDF text extraction, chunking, and embedding pipeline.
 *
 * Usage:
 *   await processPdfForRag(supabase, pdfBuffer, resourceId);
 */

import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { generateEmbedding } from "./gemini.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  // Clean whitespace but preserve paragraph structure
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= chunkSize) {
    return cleaned.length > 0 ? [cleaned] : [];
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;

    // Try to break at a sentence boundary
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const lastPeriod = slice.lastIndexOf(". ");
      const lastNewline = slice.lastIndexOf("\n");
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.3) {
        end = start + breakPoint + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;

    // Prevent infinite loop if no progress
    if (start >= cleaned.length - 10) break;
  }

  return chunks;
}

/**
 * Full pipeline: extract text → chunk → embed → store in Vector_chunk.
 * @param {object} supabase - Authenticated Supabase client
 * @param {Buffer} buffer   - PDF file buffer
 * @param {string} resourceId - The resource_id from Resources table
 */
export async function processPdfForRag(supabase, buffer, resourceId, resourceTitle = "Unknown Document") {
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

  // 4. Summarize and Prepare for Batches
  console.log(`   📝 Generating context summaries (Simple Fallback Mode)...`);
  const chunkSummaries = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const contextSummary = await generateContextSummary(chunks[i], resourceTitle);
    chunkSummaries.push(contextSummary);
    await new Promise(resolve => setTimeout(resolve, 500)); 
  }

  // 5. Embed and Store
  for (let i = 0; i < chunks.length; i++) {
    try {
      // Local embedding via Xenova (fast enough for sequential)
      const combinedText = `${chunkSummaries[i]}\n\n${chunks[i]}`;
      const embedding = await generateEmbedding(combinedText);
      
      const { error } = await supabase.from('Vector_chunk').insert({
        resource_id: resourceId,
        text: chunks[i],
        content_embeddings: embedding,
        chunk_index: i,
        context_summary: chunkSummaries[i],
      });

      if (error) {
         console.error(`   ❌ Chunk ${i}: ${error.message}`);
      }
    } catch (err) {
      console.error(`   ❌ Chunk ${i} failed: ${err.message}`);
    }
  }

  console.log(`Finished processing resource ${resourceId}`);
}
