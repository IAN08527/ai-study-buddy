const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pdfParseLib = require('pdf-parse');
const pdfParse = (pdfParseLib && pdfParseLib.default) ? pdfParseLib.default : pdfParseLib;

// ── 1. Load Environment Variables ─────────────────────────────
function loadEnv() {
  try {
    let envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
      // Try parent directory
      envPath = path.resolve(process.cwd(), '..', '.env.local');
    }
    
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env.local file not found in current or parent directory!');
      process.exit(1);
    }
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && (value || value === '')) {
        process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });
    console.log('✅ Environment variables loaded from .env.local');
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

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  WARNING: Running without SUPABASE_SERVICE_ROLE_KEY. Storage downloads may fail due to RLS policies.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── 3. Helper Functions (Inline to avoid ESM issues) ──────────

// Generate Embedding (from lib/ollama.js)
async function generateEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama embedding failed: ${err}`);
  }

  const data = await response.json();
  return data.embedding;
}

// Chunk Text (from lib/pdfProcessor.js)
function chunkText(text, chunkSize = 500, overlap = 50) {
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

// Extract Text
async function extractTextFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

// Full Processor Logic
async function processPdfForRag(supabaseClient, buffer, resourceId) {
  // Extract
  const text = await extractTextFromPdf(buffer);
  if (!text || text.trim().length === 0) {
    console.warn(`⚠️ No text extracted for resource ${resourceId}`);
    return;
  }

  // Chunk
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  console.log(`   Processing ${chunks.length} chunks...`);

  // Embed & Store
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i]);
      const { error } = await supabaseClient.from("Vector_chunk").insert({
        resource_id: resourceId,
        text: chunks[i],
        content_embeddings: embedding,
        chunk_index: i,
      });

      if (error) console.error(`   ❌ Failed to store chunk ${i}:`, error.message);
    } catch (err) {
      console.error(`   ❌ Failed to embed chunk ${i}:`, err.message);
    }
  }
}

// ── 4. Main Script ────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting vectorization backfill script...');

  try {
    // ── 4a. Diagnostic: List ALL Resources ──────────────────────
    console.log('🔍 Scanning all resources in database...');
    const { data: allResources, error: scanError } = await supabase
      .from('Resources')
      .select('*');

    if (scanError) throw new Error(`Scan failed: ${scanError.message}`);

    console.log(`\n📋 Database Inventory (${allResources.length} items):`);
    console.log('──────────────────────────────────────────────────');
    allResources.forEach(r => {
      console.log(`• [${r.resource_type.padEnd(12)}] ${r.title} (ID: ${r.resource_id.substring(0, 8)}...)`);
    });
    console.log('──────────────────────────────────────────────────\n');

    // Filter for PDFs
    const resources = allResources.filter(r => 
      ['Syllabus PDF', 'Note PDF', 'Notes PDF'].includes(r.resource_type)
    );


    console.log(`Found ${resources.length} total PDF resources.`);

    let processed = 0, skipped = 0, failed = 0;

    for (const resource of resources) {
      // Check existing chunks
      const { count } = await supabase
        .from('Vector_chunk')
        .select('*', { count: 'exact', head: true })
        .eq('resource_id', resource.resource_id);

      if (count > 0) {
        console.log(`⏩ Skipping "${resource.title}" (already has ${count} chunks)`);
        skipped++;
        continue;
      }

      console.log(`\n🔄 Processing "${resource.title}" (${resource.resource_type})...`);

      // Download
      const bucket = resource.resource_type === 'Syllabus PDF' ? 'syllabus' : 'user_notes';
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from(bucket)
        .download(resource.link);

      if (downloadError) {
        console.error(`   ❌ Download failed: ${JSON.stringify(downloadError)}`);
        failed++;
        continue;
      }

      // Buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Process
      try {
        await processPdfForRag(supabase, buffer, resource.resource_id);
        console.log(`   ✅ Complete`);
        processed++;
      } catch (err) {
        console.error(`   ❌ Failed: ${err.message}`);
        failed++;
      }
    }

    console.log('\n──────────────────────────────────────────');
    console.log('🎉 Backfill Complete!');
    console.log(`   Processed: ${processed}`);
    console.log(`   Skipped:   ${skipped}`);
    console.log(`   Failed:    ${failed}`);
    console.log('──────────────────────────────────────────');

  } catch (err) {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  }
}

main();
