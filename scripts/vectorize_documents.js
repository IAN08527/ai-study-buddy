/**
 * Advanced RAG Vectorization Script
 *
 * Re-processes all PDF documents with the advanced pipeline:
 * - Layout-aware Markdown extraction
 * - Page number & section tracking
 * - Table detection
 * - Contextual chunking with DeepSeek summaries
 * - Document-level summary generation
 *
 * Usage:
 *   node scripts/vectorize_documents.js              # Process new docs only
 *   node scripts/vectorize_documents.js --reprocess   # Delete & re-process all
 *   node scripts/vectorize_documents.js --fast         # Skip LLM context summaries
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdfParseLib = require('pdf-parse');
const pdfParse = (pdfParseLib && pdfParseLib.default) ? pdfParseLib.default : pdfParseLib;

const REPROCESS = process.argv.includes('--reprocess');
const FAST_MODE = process.argv.includes('--fast');

// ── 1. Load Environment Variables ─────────────────────────────
function loadEnv() {
  try {
    let envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      envPath = path.resolve(process.cwd(), '..', '.env.local');
    }
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env.local file not found!');
      process.exit(1);
    }
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && (value || value === '')) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });
    console.log('✅ Environment loaded');
  } catch (err) {
    console.error('❌ Failed to load .env.local:', err.message);
    process.exit(1);
  }
}

loadEnv();

// ── 2. Initialize Supabase ────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── 3. Ollama Helpers (inline to avoid ESM) ───────────────────

async function generateEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });
  if (!response.ok) throw new Error(`Embedding failed: ${await response.text()}`);
  return (await response.json()).embedding;
}

async function generateContextSummary(chunkText, docTitle) {
  if (FAST_MODE) return `From document: ${docTitle}`;

  try {
    const prompt = `You are a document analysis assistant. Given a chunk of text from the document "${docTitle}", provide a single sentence that describes what this chunk is about. Be specific and mention the topic/concept.

Chunk:
${chunkText.slice(0, 1000)}

Respond with ONLY a single sentence, no quotes, no prefix.`;

    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-r1:8b",
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 100 },
      }),
    });

    if (!response.ok) return `From document: ${docTitle}`;

    const data = await response.json();
    let answer = data.response || "";
    answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const firstSentence = answer.split(/[.\n]/)[0]?.trim();
    return firstSentence || `From document: ${docTitle}`;
  } catch {
    return `From document: ${docTitle}`;
  }
}

async function generateDocumentSummary(fullText, docTitle) {
  try {
    // Extract structural headings from the FULL text before truncation
    const headingPattern = /^.*(Unit|UNIT|Chapter|CHAPTER|Module|MODULE)\s+[\dIVXivx]+[\s:.,\-–].*$/gm;
    const headings = [];
    let match;
    while ((match = headingPattern.exec(fullText)) !== null) {
      const heading = match[0].trim().slice(0, 120);
      if (!headings.includes(heading)) headings.push(heading);
    }
    const headingBlock = headings.length > 0
      ? `\n\nSTRUCTURAL HEADINGS FOUND IN FULL DOCUMENT:\n${headings.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : "";

    const truncated = fullText.slice(0, 8000);
    const prompt = `You are an academic document analyzer. Summarize the following document titled "${docTitle}".
Include:
- The main subject/course name
- Total number of units/chapters/modules and their names (USE THE HEADING LIST BELOW)
- Key topics covered in each unit
- Whether it contains tables, syllabi, or other structured content
${headingBlock}

Document text (first portion):
${truncated}

Provide a concise but complete summary (3-5 sentences). Be PRECISE about the number of units/chapters — count them from the heading list above:`;

    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-r1:8b",
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 500 },
      }),
    });

    if (!response.ok) return `Document: ${docTitle}`;

    const data = await response.json();
    let answer = data.response || "";
    answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return answer || `Document: ${docTitle}`;
  } catch {
    return `Document: ${docTitle}`;
  }
}

// ── 4. PDF Processing Functions ───────────────────────────────

async function extractPagesFromPdf(buffer) {
  const data = await pdfParse(buffer, {
    // Custom page renderer — appends \f so we can split pages reliably
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
        return text + "\f";
      });
    },
  });

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
  })).filter(p => p.text.length > 0);

  return { pages, fullText: rawText.replace(/\f/g, "\n") };
}

function detectSectionTitle(text) {
  const patterns = [
    /^(Unit|UNIT|Chapter|CHAPTER|Module|MODULE)\s+[\dIVXivx]+[\s:.\-–]+(.+)/m,
    /^(\d+\.\d+\.?\s+[A-Z][^\n]{3,60})/m,
    /^#{1,3}\s+(.+)/m,
    /^([A-Z][A-Z\s]{10,60})$/m,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[2] || match[1] || match[0]).trim().slice(0, 100);
  }
  return null;
}

function isTableContent(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return false;
  if (lines.filter(l => l.includes("|")).length >= 2) return true;
  if (lines.filter(l => l.includes("\t")).length >= 2) return true;
  const multiSpaceLines = lines.filter(l => /\s{3,}/.test(l)).length;
  if (multiSpaceLines >= 3 && multiSpaceLines / lines.length > 0.5) return true;
  if (lines.filter(l => /^[\s\-|+]+$/.test(l)).length >= 1 && lines.length >= 3) return true;
  return false;
}

function textToMarkdown(text) {
  let md = text;
  md = md.replace(
    /^(Unit|UNIT|Chapter|CHAPTER|Module|MODULE)\s+([\dIVXivx]+)[\s:.\-–]+(.+)/gm,
    "## $1 $2: $3"
  );
  md = md.replace(/^([A-Z][A-Z\s]{10,60})$/gm, match => `### ${match.trim()}`);
  return md;
}

function markdownAwareChunk(pages, maxChunkSize = 800, overlap = 100) {
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
      // Split long text sections, tracking page numbers via character offset
      const text = section.text;
      // Build a mapping of character offset → page number from tagged lines
      const lineOffsets = [];
      let charPos = 0;
      for (const tl of section.lines) {
        lineOffsets.push({ offset: charPos, pageNumber: tl.pageNumber });
        charPos += tl.line.length + 1; // +1 for the \n
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
          const bp = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
          if (bp > maxChunkSize * 0.3) end = start + bp + 1;
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

// ── 5. Main Processing Pipeline ───────────────────────────────

async function processResource(resource) {
  console.log(`\n🔄 Processing "${resource.title}" (${resource.resource_type})...`);

  // Download PDF
  const bucket = resource.resource_type === 'Syllabus PDF' ? 'syllabus' : 'user_notes';
  const { data: fileData, error: downloadError } = await supabase
    .storage.from(bucket).download(resource.link);

  if (downloadError) {
    console.error(`   ❌ Download failed: ${JSON.stringify(downloadError)}`);
    return false;
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 1. Extract pages
  console.log(`   📄 Extracting pages...`);
  const { pages, fullText } = await extractPagesFromPdf(buffer);
  if (!fullText || fullText.trim().length === 0) {
    console.warn(`   ⚠️ No text extracted`);
    return false;
  }
  console.log(`   Found ${pages.length} pages, ${fullText.length} chars`);

  // 2. Generate document summary
  console.log(`   📝 Generating document summary...`);
  const docSummary = await generateDocumentSummary(fullText, resource.title);
  console.log(`   Summary: ${docSummary.slice(0, 80)}...`);

  // Store in Resources
  const { error: sumError } = await supabase
    .from('Resources')
    .update({ document_summary: docSummary })
    .eq('resource_id', resource.resource_id);
  if (sumError) console.warn(`   ⚠️ Failed to store summary: ${sumError.message}`);

  // 3. Chunk
  console.log(`   ✂️ Chunking...`);
  const chunks = markdownAwareChunk(pages);
  console.log(`   Created ${chunks.length} chunks`);

  // 4. Embed & store each chunk
  console.log(`   🔄 Embedding and storing chunks...`);
  let stored = 0, failed = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunk = chunks[i];

      // Generate contextual summary
      const contextSummary = await generateContextSummary(chunk.text, resource.title);

      // Prepend context for better embedding
      const textForEmbedding = `${contextSummary}\n\n${chunk.text}`;
      const embedding = await generateEmbedding(textForEmbedding);

      const { error } = await supabase.from('Vector_chunk').insert({
        resource_id: resource.resource_id,
        text: chunk.text,
        content_embeddings: embedding,
        chunk_index: i,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        is_table_data: chunk.isTableData,
        context_summary: contextSummary,
      });

      if (error) {
        console.error(`   ❌ Chunk ${i}: ${error.message}`);
        failed++;
      } else {
        stored++;
        if (i % 5 === 0 || i === chunks.length - 1) {
          console.log(`   ✅ ${stored}/${chunks.length} chunks (page ${chunk.pageNumber}${chunk.sectionTitle ? ` "${chunk.sectionTitle}"` : ''})`);
        }
      }
    } catch (err) {
      console.error(`   ❌ Chunk ${i}: ${err.message}`);
      failed++;
    }
  }

  console.log(`   📊 Result: ${stored} stored, ${failed} failed`);
  return true;
}

// ── 6. Main Script ────────────────────────────────────────────

async function main() {
  console.log('🚀 Advanced RAG Vectorization Script');
  console.log(`   Mode: ${REPROCESS ? '♻️ REPROCESS (delete + re-vectorize all)' : '➕ NEW ONLY'}`);
  console.log(`   Context: ${FAST_MODE ? '⚡ FAST (skip LLM summaries)' : '🧠 FULL (with DeepSeek context summaries)'}\n`);

  try {
    // List all resources
    const { data: allResources, error: scanError } = await supabase
      .from('Resources').select('*');

    if (scanError) throw new Error(`Scan failed: ${scanError.message}`);

    console.log(`📋 Database: ${allResources.length} resources total`);
    allResources.forEach(r => {
      console.log(`   • [${r.resource_type.padEnd(12)}] ${r.title}`);
    });

    // Filter for PDFs
    const resources = allResources.filter(r =>
      ['Syllabus PDF', 'Note PDF', 'Notes PDF'].includes(r.resource_type)
    );

    console.log(`\n📄 Found ${resources.length} PDF resources to process`);

    let processed = 0, skipped = 0, failed = 0;

    for (const resource of resources) {
      // Check existing chunks
      const { count } = await supabase
        .from('Vector_chunk')
        .select('*', { count: 'exact', head: true })
        .eq('resource_id', resource.resource_id);

      if (count > 0 && !REPROCESS) {
        console.log(`⏩ Skipping "${resource.title}" (already has ${count} chunks)`);
        skipped++;
        continue;
      }

      // If reprocessing, delete existing chunks first
      if (count > 0 && REPROCESS) {
        console.log(`🗑️ Deleting ${count} existing chunks for "${resource.title}"...`);
        const { error: delError } = await supabase
          .from('Vector_chunk')
          .delete()
          .eq('resource_id', resource.resource_id);

        if (delError) {
          console.error(`   ❌ Delete failed: ${delError.message}`);
          failed++;
          continue;
        }
      }

      // Process
      try {
        const success = await processResource(resource);
        if (success) processed++;
        else failed++;
      } catch (err) {
        console.error(`   ❌ Failed: ${err.message}`);
        failed++;
      }
    }

    console.log('\n══════════════════════════════════════════');
    console.log('🎉 Vectorization Complete!');
    console.log(`   Processed: ${processed}`);
    console.log(`   Skipped:   ${skipped}`);
    console.log(`   Failed:    ${failed}`);
    console.log('══════════════════════════════════════════');

  } catch (err) {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  }
}

main();
