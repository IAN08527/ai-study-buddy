/**
 * Reranker module — uses DeepSeek to rerank retrieved chunks by relevance.
 *
 * Takes the top N chunks from hybrid search and filters down to the
 * most relevant ones to prevent LLM hallucination.
 */

const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";

/**
 * Rerank chunks using DeepSeek as a cross-encoder style reranker.
 * @param {string} query - The user's question
 * @param {Array} chunks - Array of chunk objects from hybrid_search
 * @param {number} topK - Number of top results to return (default 5)
 * @returns {Promise<Array>} Top K reranked chunks
 */
export async function rerankChunks(query, chunks, topK = 5) {
  if (!chunks || chunks.length === 0) return [];
  if (chunks.length <= topK) return chunks;

  try {
    // Build a condensed representation of each chunk for reranking
    const chunkSummaries = chunks.map((c, i) => {
      const preview = c.chunk_text.slice(0, 200).replace(/\n/g, " ");
      const meta = [
        c.section_title ? `Section: ${c.section_title}` : "",
        c.page_number ? `Page: ${c.page_number}` : "",
      ].filter(Boolean).join(", ");
      return `[${i}] ${meta ? `(${meta}) ` : ""}${preview}`;
    }).join("\n");

    const prompt = `You are a relevance judge. Given a student's question and ${chunks.length} text chunks from their study documents, rank the chunks by relevance to the question.

Question: "${query}"

Chunks:
${chunkSummaries}

Return ONLY a JSON array of the indices of the top ${topK} most relevant chunks, ordered from most to least relevant.
Example output: [3, 7, 1, 12, 5]

Your answer (JSON array only):`;

    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-r1:8b",
        prompt,
        stream: false,
        options: { temperature: 0.0, num_predict: 100 },
      }),
    });

    if (!response.ok) {
      console.warn("Reranker call failed, falling back to original order");
      return chunks.slice(0, topK);
    }

    const data = await response.json();
    let answer = data.response || "";
    // Strip <think> blocks
    answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Extract JSON array from the response
    const arrayMatch = answer.match(/\[[\d,\s]+\]/);
    if (!arrayMatch) {
      console.warn("Reranker returned non-JSON response, falling back");
      return chunks.slice(0, topK);
    }

    const indices = JSON.parse(arrayMatch[0]);
    const validIndices = indices
      .filter((i) => Number.isInteger(i) && i >= 0 && i < chunks.length);

    // Deduplicate while preserving order
    const seen = new Set();
    const uniqueIndices = [];
    for (const idx of validIndices) {
      if (!seen.has(idx)) {
        seen.add(idx);
        uniqueIndices.push(idx);
      }
    }

    // Map back to chunk objects
    const reranked = uniqueIndices.slice(0, topK).map((i) => chunks[i]);

    // If reranker returned fewer than topK, pad with remaining chunks
    if (reranked.length < topK) {
      for (const chunk of chunks) {
        if (reranked.length >= topK) break;
        if (!reranked.includes(chunk)) {
          reranked.push(chunk);
        }
      }
    }

    console.log(`🔀 Reranker selected indices: [${uniqueIndices.slice(0, topK).join(", ")}]`);
    return reranked;
  } catch (err) {
    console.error("Reranker error:", err.message);
    return chunks.slice(0, topK);
  }
}
