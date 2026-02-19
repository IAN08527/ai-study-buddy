/**
 * Ollama API helpers for embedding and text generation.
 * 
 * Uses:
 *  - nomic-embed-text for 768-dim embeddings
 *  - deepseek-r1:8b for chat generation
 */

const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";

/**
 * Generate a 768-dim embedding for the given text using nomic-embed-text.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional vector
 */
export async function generateEmbedding(text) {
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

/**
 * Generate a chat completion using DeepSeek R1 8b (non-streaming).
 * @param {string} prompt - The full assembled prompt
 * @returns {Promise<string>} The generated text
 */
export async function chatWithOllama(prompt) {
  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-r1:8b",
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 4096,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama generation failed: ${err}`);
  }

  const data = await response.json();
  
  // DeepSeek R1 wraps reasoning in <think>...</think> tags.
  // Strip the thinking block and return only the final answer.
  let answer = data.response || "";
  answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  
  return answer;
}

/**
 * Stream a chat completion from DeepSeek R1 8b.
 * Yields tokens one by one, filtering out <think>...</think> blocks.
 * @param {string} prompt - The full assembled prompt
 * @returns {Promise<ReadableStream>} Stream of Ollama response objects
 */
export async function streamChatWithOllama(prompt) {
  const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-r1:8b",
      prompt,
      stream: true,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 4096,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama generation failed: ${err}`);
  }

  return response.body;
}

/**
 * Generate a 1-sentence contextual summary for a chunk using DeepSeek.
 * Used during ingestion to prepend context before embedding.
 * @param {string} chunkText - The chunk content
 * @param {string} docTitle - The document title for context
 * @returns {Promise<string>} A single-sentence context summary
 */
export async function generateContextSummary(chunkText, docTitle) {
  const prompt = `You are a document analysis assistant. Given a chunk of text from the document "${docTitle}", provide a single sentence that describes what this chunk is about. Be specific and mention the topic/concept.

Chunk:
${chunkText.slice(0, 1000)}

Respond with ONLY a single sentence, no quotes, no prefix. Example: "This section discusses Test Plan creation in Software Testing."`;

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

  if (!response.ok) {
    console.warn("Context summary generation failed, using fallback");
    return `From document: ${docTitle}`;
  }

  const data = await response.json();
  let answer = data.response || "";
  answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Take only the first sentence
  const firstSentence = answer.split(/[.\n]/)[0]?.trim();
  return firstSentence || `From document: ${docTitle}`;
}

/**
 * Generate a global summary of an entire document using DeepSeek.
 * Stored in the Resources table for overview questions.
 * @param {string} fullText - The full document text (truncated if too long)
 * @param {string} docTitle - The document title
 * @returns {Promise<string>} A multi-sentence document summary
 */
export async function generateDocumentSummary(fullText, docTitle) {
  // Extract structural headings (Unit/Chapter/Module lines) from the FULL text
  // This ensures we capture all units even if the text is very long
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

  // Use more text for better coverage (8000 chars)
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

  if (!response.ok) {
    return `Document: ${docTitle}. Summary generation failed.`;
  }

  const data = await response.json();
  let answer = data.response || "";
  answer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return answer || `Document: ${docTitle}`;
}
