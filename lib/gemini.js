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
  if (!text || !text.trim() || !process.env.GEMINI_API_KEY) return [];

  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    
    // Explicitly request 768 dimensions if supported, or handle mapping
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
    });
    
    // embedding-001 returns 768 by default
    return result.embedding.values;
  } catch (error) {
    console.error("Gemini Embedding Error:", error);
    // Return empty array instead of throwing to avoid crashing the whole request
    return [];
  }
}

