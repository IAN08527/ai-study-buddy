/**
 * Advanced PDF Processing Pipeline
 *
 * Layout-aware PDF → Markdown extraction with:
 * - Page number tracking
 * - Section/heading detection
 * - Table detection
 * - Markdown-aware chunking (split on headings, preserve tables)
 * - Contextual summary generation per chunk
 * - Global document summary generation
 */

import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { generateEmbedding, generateContextSummary, generateDocumentSummary } from "./ollama.js";

// ── PDF to Markdown Conversion ────────────────────────────────

/**
 * Extract text from PDF with page-level tracking.
 * Returns an array of { pageNumber, text } objects.
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<{ pages: Array<{pageNumber: number, text: string}>, fullText: string }>}
 */
export async function extractPagesFromPdf(buffer) {
  const data = await pdfParse(buffer, {
    // Custom page renderer — appends \f (form feed) so we can split pages reliably
    pagerender: function (pageData) {
      return pageData.getTextContent().then(function (textContent) {
        let lastY = null;
        let text = "";

        for (const item of textContent.items) {
          if (lastY !== null && Math.abs(lastY - item.transform[5]) > 2) {
            text += "\n";
          }
          text += item.str;
          lastY = item.transform[5];
        }

        // Append form-feed character so we can split on it later
        return text + "\f";
      });
    },
  });

  // Split by form-feed (now reliably inserted by our pagerender)
  const rawText = data.text || "";
  const numPages = data.numpages || 1;

  let pageTexts = rawText.split(/\f/).filter(t => t.trim().length > 0);

  // Fallback if splitting produced wrong count
  if (pageTexts.length < numPages && pageTexts.length <= 1) {
    const avgLen = Math.ceil(rawText.length / numPages);
    pageTexts = [];
    for (let i = 0; i < numPages; i++) {
      pageTexts.push(rawText.slice(i * avgLen, (i + 1) * avgLen));
    }
  }

  const pages = pageTexts.map((text, i) => ({
    pageNumber: i + 1,
    text: text.trim(),
  })).filter((p) => p.text.length > 0);

  // Clean form-feeds from fullText for downstream use
  const fullText = rawText.replace(/\f/g, "\n");

  return { pages, fullText };
}

// ── Section & Table Detection ──────────────────────────────────

/**
 * Detect section headings from text patterns common in academic documents.
 * Matches patterns like: "Unit 1:", "Chapter 3:", "Module 2 -", "1.1 Introduction"
 * @param {string} text
 * @returns {string|null} Detected section title or null
 */
function detectSectionTitle(text) {
  const patterns = [
    // "Unit 1: Title" or "UNIT I: Title"
    /^(Unit|UNIT|Chapter|CHAPTER|Module|MODULE)\s+[\dIVXivx]+[\s:.\-–]+(.+)/m,
    // "1.1 Title" or "1.1. Title"
    /^(\d+\.\d+\.?\s+[A-Z][^\n]{3,60})/m,
    // "## Heading" markdown
    /^#{1,3}\s+(.+)/m,
    // ALL CAPS heading (at least 3 words)
    /^([A-Z][A-Z\s]{10,60})$/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Return the full match or captured group
      return (match[2] || match[1] || match[0]).trim().slice(0, 100);
    }
  }
  return null;
}

/**
 * Detect if a text block is likely a table.
 * Looks for patterns with multiple columns separated by spaces/tabs, pipe chars, or dashes.
 * @param {string} text
 * @returns {boolean}
 */
function isTableContent(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;

  // Check for pipe-delimited tables (markdown tables)
  const pipeLines = lines.filter((l) => l.includes("|")).length;
  if (pipeLines >= 2) return true;

  // Check for tab-separated data (common in PDF tables)
  const tabLines = lines.filter((l) => l.includes("\t")).length;
  if (tabLines >= 2) return true;

  // Check for consistent multi-space alignment (PDF table extraction)
  const multiSpaceLines = lines.filter((l) => /\s{3,}/.test(l)).length;
  if (multiSpaceLines >= 3 && multiSpaceLines / lines.length > 0.5) return true;

  // Check for dash-separator rows
  const dashLines = lines.filter((l) => /^[\s\-|+]+$/.test(l)).length;
  if (dashLines >= 1 && lines.length >= 3) return true;

  return false;
}

// ── Markdown-Aware Chunking ────────────────────────────────────

/**
 * Convert raw page text to Markdown-like format, preserving structure.
 * @param {string} text - Raw page text
 * @returns {string} Markdown-formatted text
 */
function textToMarkdown(text) {
  let md = text;

  // Convert detected headings to markdown headings
  md = md.replace(
    /^(Unit|UNIT|Chapter|CHAPTER|Module|MODULE)\s+([\dIVXivx]+)[\s:.\-–]+(.+)/gm,
    "## $1 $2: $3"
  );

  // Convert ALL-CAPS lines to bold headings (likely section titles)
  md = md.replace(/^([A-Z][A-Z\s]{10,60})$/gm, (match) => `### ${match.trim()}`);

  return md;
}

/**
 * Split document into chunks that respect Markdown structure.
 * - Splits on heading boundaries (##, ###)
 * - Keeps tables as atomic units
 * - Tracks page numbers for each chunk
 * @param {Array<{pageNumber: number, text: string}>} pages
 * @param {number} maxChunkSize - Maximum chunk size in characters (default 800)
 * @param {number} overlap - Overlap between chunks (default 100)
 * @returns {Array<{text: string, pageNumber: number, sectionTitle: string|null, isTableData: boolean}>}
 */
export function markdownAwareChunk(pages, maxChunkSize = 800, overlap = 100) {
  const chunks = [];

  // Build a flat list of lines, each tagged with its source page number
  const taggedLines = [];
  for (const page of pages) {
    const md = textToMarkdown(page.text);
    const lines = md.split("\n");
    for (const line of lines) {
      taggedLines.push({ line, pageNumber: page.pageNumber });
    }
  }

  // Group lines into sections by headings
  const sections = [];
  let currentSection = { lines: [], startPage: 1, sectionTitle: null };

  for (const { line, pageNumber } of taggedLines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (currentSection.lines.length > 0) {
        sections.push({
          text: currentSection.lines.map(l => l.line).join("\n").trim(),
          pageNumber: currentSection.startPage,
          sectionTitle: currentSection.sectionTitle,
          lines: currentSection.lines,
        });
      }
      currentSection = {
        lines: [{ line, pageNumber }],
        startPage: pageNumber,
        sectionTitle: line.replace(/^#{1,3}\s+/, "").trim(),
      };
    } else {
      currentSection.lines.push({ line, pageNumber });
      if (currentSection.lines.length === 1) currentSection.startPage = pageNumber;
    }
  }
  if (currentSection.lines.length > 0) {
    sections.push({
      text: currentSection.lines.map(l => l.line).join("\n").trim(),
      pageNumber: currentSection.startPage,
      sectionTitle: currentSection.sectionTitle,
      lines: currentSection.lines,
    });
  }

  // Now chunk each section if it's too large
  for (const section of sections) {
    const isTable = isTableContent(section.text);

    if (section.text.length <= maxChunkSize) {
      chunks.push({
        text: section.text,
        pageNumber: section.pageNumber,
        sectionTitle: section.sectionTitle || detectSectionTitle(section.text),
        isTableData: isTable,
      });
    } else if (isTable) {
      const rows = section.text.split("\n");
      let currentChunk = "";
      let chunkPage = section.pageNumber;
      for (let ri = 0; ri < rows.length; ri++) {
        if (currentChunk.length + rows[ri].length > maxChunkSize && currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.trim(),
            pageNumber: chunkPage,
            sectionTitle: section.sectionTitle,
            isTableData: true,
          });
          currentChunk = "";
          chunkPage = section.lines[Math.min(ri, section.lines.length - 1)]?.pageNumber || section.pageNumber;
        }
        currentChunk += rows[ri] + "\n";
        if (currentChunk.length <= rows[ri].length + 1) {
          chunkPage = section.lines[Math.min(ri, section.lines.length - 1)]?.pageNumber || section.pageNumber;
        }
      }
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          pageNumber: chunkPage,
          sectionTitle: section.sectionTitle,
          isTableData: true,
        });
      }
    } else {
      // Split large text sections with overlap, tracking page via character offset
      const text = section.text;
      const lineOffsets = [];
      let charPos = 0;
      for (const tl of section.lines) {
        lineOffsets.push({ offset: charPos, pageNumber: tl.pageNumber });
        charPos += tl.line.length + 1;
      }

      function getPageForOffset(offset) {
        let page = section.pageNumber;
        for (const lo of lineOffsets) {
          if (lo.offset <= offset) page = lo.pageNumber;
          else break;
        }
        return page;
      }

      let start = 0;
      while (start < text.length) {
        let end = start + maxChunkSize;

        if (end < text.length) {
          const slice = text.slice(start, end);
          const lastParagraph = slice.lastIndexOf("\n\n");
          const lastPeriod = slice.lastIndexOf(". ");
          const lastNewline = slice.lastIndexOf("\n");
          const breakPoint = Math.max(lastParagraph, lastPeriod, lastNewline);
          if (breakPoint > maxChunkSize * 0.3) {
            end = start + breakPoint + 1;
          }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk.length > 0) {
          chunks.push({
            text: chunk,
            pageNumber: getPageForOffset(start),
            sectionTitle: section.sectionTitle || detectSectionTitle(chunk),
            isTableData: false,
          });
        }

        start = end - overlap;
        if (start >= text.length - 20) break;
      }
    }
  }

  return chunks;
}

// ── Full Advanced Pipeline ─────────────────────────────────────

/**
 * Full advanced pipeline: extract → chunk → contextualize → embed → store.
 * @param {object} supabase - Authenticated Supabase client
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} resourceId - The resource_id from Resources table
 * @param {string} docTitle - The document title (for context generation)
 * @param {object} options - Processing options
 * @param {boolean} options.skipContextSummary - Skip LLM context generation (faster but lower quality)
 */
export async function processPdfForRag(supabase, buffer, resourceId, docTitle = "Document", options = {}) {
  // 1. Extract pages with page numbers
  console.log(`📄 Extracting pages from PDF...`);
  const { pages, fullText } = await extractPagesFromPdf(buffer);

  if (!fullText || fullText.trim().length === 0) {
    console.warn(`⚠️ No text extracted for resource ${resourceId}`);
    return;
  }

  console.log(`   Found ${pages.length} pages, ${fullText.length} chars total`);

  // 2. Generate global document summary
  console.log(`📝 Generating document summary...`);
  let docSummary;
  try {
    docSummary = await generateDocumentSummary(fullText, docTitle);
    console.log(`   Summary: ${docSummary.slice(0, 100)}...`);
  } catch (err) {
    console.warn(`   ⚠️ Summary generation failed: ${err.message}`);
    docSummary = `Document: ${docTitle}`;
  }

  // Store document summary in Resources table
  const { error: summaryError } = await supabase
    .from("Resources")
    .update({ document_summary: docSummary })
    .eq("resource_id", resourceId);

  if (summaryError) {
    console.warn(`   ⚠️ Failed to store document summary: ${summaryError.message}`);
  }

  // 3. Chunk with Markdown awareness
  console.log(`✂️ Chunking with Markdown awareness...`);
  const chunks = markdownAwareChunk(pages);
  if (chunks.length === 0) return;
  console.log(`   Created ${chunks.length} chunks`);

  // 4. For each chunk: generate context → prepend → embed → store
  console.log(`🔄 Processing ${chunks.length} chunks (embed + contextualize)...`);
  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunk = chunks[i];

      // Generate contextual summary (unless skipped)
      let contextSummary = `From document: ${docTitle}`;
      if (!options.skipContextSummary) {
        try {
          contextSummary = await generateContextSummary(chunk.text, docTitle);
        } catch (err) {
          console.warn(`   ⚠️ Context summary failed for chunk ${i}, using fallback`);
        }
      }

      // Prepend context to text before embedding for better retrieval
      const textForEmbedding = `${contextSummary}\n\n${chunk.text}`;
      const embedding = await generateEmbedding(textForEmbedding);

      const { error } = await supabase.from("Vector_chunk").insert({
        resource_id: resourceId,
        text: chunk.text,
        content_embeddings: embedding,
        chunk_index: i,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        is_table_data: chunk.isTableData,
        context_summary: contextSummary,
      });

      if (error) {
        console.error(`   ❌ Failed to store chunk ${i}:`, error.message);
      } else if (i % 5 === 0) {
        console.log(`   ✅ Chunk ${i}/${chunks.length} stored (page ${chunk.pageNumber}${chunk.sectionTitle ? `, "${chunk.sectionTitle}"` : ""})`);
      }
    } catch (err) {
      console.error(`   ❌ Failed to process chunk ${i}:`, err.message);
    }
  }

  console.log(`✅ Finished processing resource ${resourceId} (${chunks.length} chunks)`);
}

// ── Legacy export for backward compatibility ───────────────────
export { extractPagesFromPdf as extractTextFromPdf };
export { markdownAwareChunk as chunkText };
