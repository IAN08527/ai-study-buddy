/**
 * AI helpers for embedding using Google Gemini API.
 * This replaces local Transformers.js to resolve Vercel deployment issues with native binaries.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate a 768-dim embedding using Google's text-embedding-004.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional vector
 */
export async function generateEmbedding(text) {
  if (!text || !text.trim()) return [];

  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    // Explicitly request 768 dimensions to match existing database vectors
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 768,
    });
    
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    throw new Error(`Gemini embedding failed: ${error.message}`);
  }
}

