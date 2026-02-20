/**
 * Native Gemini RAG Vectorization Script
 *
 * This script connects to Supabase, deletes all existing vectors, and re-processes
 * all PDF documents using Google's Generative AI SDK (Gemini 1.5 Pro).
 * 
 * Usage:
 *   node scripts/revectorize_gemini.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdfParseLib = require('pdf-parse');
const { Groq } = require('groq-sdk');

const pdfParse = (pdfParseLib && pdfParseLib.default) ? pdfParseLib.default : pdfParseLib;

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

// ── 2. Initialize Clients ─────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
// No Groq initialization here as we are using fallbacks for summaries


// We won't initialize Xenova here quite yet, we'll do it in generateEmbedding to create a singleton
let embedderInstance = null;
async function getEmbedder() {
  if (!embedderInstance) {
    console.log("Initializing Transformers.js framework...");
    const transformers = await import('@huggingface/transformers');
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = false;
    
    console.log("Loading local Xenova/bge-base-en-v1.5 model...");
    embedderInstance = await transformers.pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5');
  }
  return embedderInstance;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);


// ── 3. Helper Functions ───────────────────────────────────────

async function generateEmbedding(text) {
  if (!text || !text.trim()) return [];
  try {
    const embedder = await getEmbedder();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    throw new Error(`Local embedding failed: ${err.message}`);
  }
}

async function generateContextSummary(chunkText, docTitle) {
  return `Key information from "${docTitle}": ${chunkText.slice(0, 100)}...`;
}

async function generateDocumentSummary(fullText, docTitle) {
  const teaser = fullText.slice(0, 250).trim();
  return `Knowledge document titled "${docTitle}". Overview: ${teaser}${fullText.length > 250 ? '...' : ''}`;
}

function chunkText(text, chunkSize = 800, overlap = 100) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= chunkSize) return cleaned.length > 0 ? [cleaned] : [];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + chunkSize;
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
    if (chunk.length > 0) chunks.push(chunk);

    start = end - overlap;
    if (start >= cleaned.length - 10) break;
  }
  return chunks;
}


// ── 4. Main Processing Flow ───────────────────────────────────

async function processPdfForRag(buffer, resource) {
  console.log(`\n🔄 Processing "${resource.title}"...`);

  // 1. Extract Text
  console.log(`   📄 Extracting text...`);
  const data = await pdfParse(buffer);
  const fullText = data.text;
  
  if (!fullText || fullText.trim().length === 0) {
    console.warn(`   ⚠️ No text extracted`);
    return false;
  }

  // 2. Generate Doc Summary
  console.log(`   📝 Generating document summary...`);
  const docSummary = await generateDocumentSummary(fullText, resource.title);
  
  await supabase
    .from('Resources')
    .update({ document_summary: docSummary })
    .eq('resource_id', resource.resource_id);

  // 3. Chunk
  console.log(`   ✂️ Chunking...`);
  const chunks = chunkText(fullText);
  console.log(`   Created ${chunks.length} chunks`);

  // 4. Summarize and Prepare for Batches
  console.log(`   📝 Generating context summaries (Simple Fallback Mode)...`);
  const chunkSummaries = [];
  
  // We can process summaries sequentially to avoid rate limits on Groq
  for (let i = 0; i < chunks.length; i++) {
    const contextSummary = await generateContextSummary(chunks[i], resource.title);
    chunkSummaries.push(contextSummary);
    
    // Optional delay to avoid hitting Groq limits, but Groq's usually quite fast and limits are higher
    await new Promise(resolve => setTimeout(resolve, 500)); 
  }

  // 5. Batch Embed and Store
  console.log(`   🔄 Embedding chunks locally...`);
  let stored = 0, failed = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      // Local embedding is fast enough we just map it out sequentially with no API delays :)
      const combinedText = `${chunkSummaries[i]}\n\n${chunks[i]}`;
      const embedding = await generateEmbedding(combinedText);
      
      const { error } = await supabase.from('Vector_chunk').insert({
        resource_id: resource.resource_id,
        text: chunks[i],
        content_embeddings: embedding,
        chunk_index: i,
        context_summary: chunkSummaries[i],
      });

      if (error) {
         console.error(`   ❌ Chunk ${i}: ${error.message}`);
         failed++;
      } else {
         stored++;
      }
    } catch (err) {
      console.error(`   ❌ Chunk ${i} failed: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`   📊 Result: ${stored} stored, ${failed} failed`);
  return true;
}

// ── 5. Runner ─────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Google Gemini Re-Vectorization Script...');
  console.log('🗑️ NOTE: ALL EXISTING VECTORS WILL BE DELETED AND RE-CREATED.\n');

  try {
    // List all resources
    const { data: allResources, error: scanError } = await supabase
      .from('Resources').select('*');

    if (scanError) throw new Error(`Scan failed: ${scanError.message}`);

    const resources = allResources.filter(r =>
      ['Syllabus PDF', 'Note PDF', 'Notes PDF'].includes(r.resource_type)
    );

    console.log(`📄 Found ${resources.length} PDF resources to process\n`);

    let processed = 0, failed = 0;

    for (const resource of resources) {
      // DELETE old chunks
      console.log(`🗑️ Deleting existing chunks for "${resource.title}"...`);
      const { error: delError } = await supabase
        .from('Vector_chunk')
        .delete()
        .eq('resource_id', resource.resource_id);

      if (delError) {
        console.error(`   ❌ Delete failed: ${delError.message}`);
        failed++;
        continue;
      }

      // Download
      const bucket = resource.resource_type === 'Syllabus PDF' ? 'syllabus' : 'user_notes';
      const { data: fileData, error: downloadError } = await supabase
        .storage.from(bucket).download(resource.link);

      if (downloadError) {
        console.error(`   ❌ Download failed: ${JSON.stringify(downloadError)}`);
        failed++;
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Re-process
      try {
        const success = await processPdfForRag(buffer, resource);
        if (success) processed++;
        else failed++;
      } catch (err) {
        console.error(`   ❌ Processing Failed: ${err.message}`);
        failed++;
      }
    }

    console.log('\n══════════════════════════════════════════');
    console.log('🎉 Re-vectorization Complete!');
    console.log(`   Processed: ${processed}`);
    console.log(`   Failed:    ${failed}`);
    console.log('══════════════════════════════════════════');

  } catch (err) {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  }
}

main();
