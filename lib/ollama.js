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
