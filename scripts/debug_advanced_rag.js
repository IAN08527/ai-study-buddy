/**
 * Debug script for Advanced RAG pipeline
 * Tests: hybrid_search RPC, document summaries, chunk metadata
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";

async function generateEmbedding(text) {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed`);
  return (await res.json()).embedding;
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("🔍 Advanced RAG Debug Script");
  console.log("═══════════════════════════════════════\n");

  // 1. Check total chunks
  const { count } = await supabase
    .from('Vector_chunk')
    .select('*', { count: 'exact', head: true });
  console.log(`📊 Total chunks in DB: ${count}\n`);

  // 2. Check chunk metadata
  console.log("── Chunk Metadata Sampling ──");
  const { data: sampleChunks } = await supabase
    .from('Vector_chunk')
    .select('chunk_id, page_number, section_title, is_table_data, context_summary, text')
    .limit(10);

  sampleChunks?.forEach((c, i) => {
    console.log(`  [${i}] page=${c.page_number}, section="${c.section_title || 'null'}", table=${c.is_table_data}`);
    console.log(`       context: ${(c.context_summary || 'null').slice(0, 80)}`);
    console.log(`       text: ${c.text.slice(0, 80)}...`);
  });

  // 3. Check document summaries in Resources
  console.log("\n── Document Summaries ──");
  const { data: resources } = await supabase
    .from('Resources')
    .select('resource_id, title, resource_type, document_summary');

  resources?.forEach(r => {
    console.log(`  📄 ${r.title} (${r.resource_type})`);
    console.log(`     Summary: ${r.document_summary ? r.document_summary.slice(0, 150) + '...' : '❌ NULL'}`);
  });

  // 4. Check if hybrid_search function exists
  console.log("\n── Testing hybrid_search RPC ──");
  const testQuery = "how many units are there in the syllabus";
  console.log(`  Query: "${testQuery}"`);

  try {
    const embedding = await generateEmbedding(testQuery);
    console.log(`  ✅ Embedding generated (${embedding.length} dims)`);

    // Get a subject ID
    const { data: subjects } = await supabase.from('Subject').select('subject_id, name').limit(1);
    if (!subjects || subjects.length === 0) {
      console.log("  ❌ No subjects found!");
      return;
    }
    const subjectId = subjects[0].subject_id;
    console.log(`  Using subject: ${subjects[0].name} (${subjectId})`);

    const { data: results, error: rpcError } = await supabase.rpc('hybrid_search', {
      query_embedding: embedding,
      query_text: testQuery,
      p_subject_id: subjectId,
      match_count: 10,
    });

    if (rpcError) {
      console.log(`  ❌ hybrid_search FAILED: ${rpcError.message}`);
      console.log(`  💡 Did you run the SQL migration in Supabase SQL Editor?`);
      
      // Try old match_chunks as fallback test
      console.log("\n  Trying old match_chunks...");
      const { data: oldResults, error: oldErr } = await supabase.rpc('match_chunks', {
        query_embedding: embedding,
        p_subject_id: subjectId,
        match_count: 5,
      });
      if (oldErr) {
        console.log(`  ❌ match_chunks also failed: ${oldErr.message}`);
      } else {
        console.log(`  ⚠️ match_chunks works (${oldResults?.length} results) — hybrid_search not deployed!`);
      }
    } else {
      console.log(`  ✅ hybrid_search returned ${results?.length} results`);
      results?.forEach((r, i) => {
        console.log(`    [${i}] ${r.document_title} | RRF: ${r.rrf_score?.toFixed(4)} | Sim: ${r.similarity?.toFixed(4)}`);
        console.log(`        Page: ${r.page_number} | Section: "${r.section_title || 'null'}"`);
        console.log(`        Text: ${r.chunk_text?.slice(0, 100)}...`);
      });
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }

  // 5. Check text_search column
  console.log("\n── tsvector Check ──");
  const { data: tsCheck } = await supabase
    .from('Vector_chunk')
    .select('chunk_id, text_search')
    .not('text_search', 'is', null)
    .limit(3);
  
  if (tsCheck && tsCheck.length > 0) {
    console.log(`  ✅ text_search populated (${tsCheck.length} sample rows have tsvector)`);
  } else {
    console.log(`  ❌ text_search is NULL — tsvector trigger may not be working`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("Debug complete!");
  console.log("═══════════════════════════════════════");
}

main().catch(console.error);
