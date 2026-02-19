const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Env
function loadEnv() {
  try {
    let envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) envPath = path.resolve(process.cwd(), '..', '.env.local');
    if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    });
  } catch (err) {
    console.error('❌ Env load error:', err.message);
    process.exit(1);
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Helper: Generate Embedding
async function generateEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()).embedding;
  } catch (e) {
    console.error('Embedding failed:', e.message);
    return null;
  }
}

async function main() {
  console.log('🕵️‍♂️ Starting RAG Content Debugger...');

  // Step A: Find the Syllabus
  const { data: resources, error: rError } = await supabase
    .from('Resources')
    .select('*')
    .ilike('title', '%pdf%') // Grab PDFs
    .limit(5);

  if (rError) { console.error('Error fetching resources:', rError); return; }
  
  const syllabus = resources.find(r => r.resource_type.includes('Syllabus')) || resources[0];
  if (!syllabus) { console.error('No PDF resources found.'); return; }

  console.log(`\n📄 Inspecting Resource: "${syllabus.title}" (ID: ${syllabus.resource_id})`);

  // Step B: Fetch Chunks directly
  const { data: chunks, error: cError } = await supabase
    .from('Vector_chunk')
    .select('chunk_index, text')
    .eq('resource_id', syllabus.resource_id)
    .order('chunk_index')
    .limit(5);

  if (cError) { console.error('Error fetching chunks:', cError); return; }

  console.log(`\n📝 First 5 Chunks Content Preview:`);
  console.log('--------------------------------------------------');
  chunks.forEach(c => {
    console.log(`[Chunk ${c.chunk_index}]: ${c.text.substring(0, 150).replace(/\n/g, ' ')}...`);
  });
  console.log('--------------------------------------------------');

  // Step C: Test Retrieval Logic (match_chunks)
  const query = "how many chapters are in the syllabus";
  console.log(`\n🔍 Testing Retrieval for query: "${query}"`);

  const embedding = await generateEmbedding(query);
  if (!embedding) return;

  // Call the function
  const { data: searchResults, error: rpcError } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    p_subject_id: syllabus.subject_id,
    match_count: 5
  });

  if (rpcError) {
    console.error('❌ match_chunks RPC Failed:', rpcError);
    console.error('   Hint: Did you run the update_rag_function.sql script?');
  } else {
    console.log(`✅ Search Success! Found ${searchResults.length} matches.`);
    searchResults.forEach((r, i) => {
      console.log(`   [${i}] Score: ${r.similarity.toFixed(4)} | Text: "${r.chunk_text.substring(0, 100)}..."`);
    });
  }


  // Step D: Retrieve "Unit" specific chunks and check rank
  console.log(`\n🔍 Checking Rank of "Unit" chunks...`);
  const { data: unitChunks, error: uError } = await supabase
    .from('Vector_chunk')
    .select('chunk_index, text, content_embeddings')
    .eq('resource_id', syllabus.resource_id)
    .ilike('text', '%Unit -%')
    .limit(5);

  if (uError) console.error('Error finding unit chunks:', uError);
  else if (unitChunks.length === 0) console.warn('⚠️  No chunks contain "Unit -" text.');
  else {
    unitChunks.forEach(async (c) => {
      // Calculate cosine similarity manually or just print text
      // We can use rpc matched on this specific text? No, just print text and let user infer.
      // But we want score. Let's use match_chunks again but limiting to this ID?
      // Actually simpler: just print the text to see if it's readable.
      console.log(`   [Chunk ${c.chunk_index}] Text: "${c.text.substring(0, 100).replace(/\n/g, ' ')}..."`);
    });
  }
}

main();

