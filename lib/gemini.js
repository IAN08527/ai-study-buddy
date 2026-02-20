/**
 * Local AI helpers for embedding using Transformers.js.
 * Replaces Google Gemini/Ollama to eliminate rate limits natively.
 * 
 * Uses:
 *  - Xenova/bge-base-en-v1.5 for 768-dim embeddings entirely locally
 */

import { pipeline, env } from "@huggingface/transformers";

// Optional: Optimize for Node serverless environment
env.allowLocalModels = false;
env.useBrowserCache = false;

class PipelineSingleton {
  static task = "feature-extraction";
  static model = "Xenova/bge-base-en-v1.5";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      console.log("Downloading/Loading local 768-D model (Xenova/bge-base-en-v1.5)...");
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

/**
 * Generate a 768-dim embedding using Xenova's bge-base-en.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional vector
 */
export async function generateEmbedding(text) {
  if (!text || !text.trim()) return [];

  try {
    const embedder = await PipelineSingleton.getInstance();
    
    // Generate embeddings with mean pooling and L2 normalization
    const output = await embedder(text, { pooling: "mean", normalize: true });
    
    // Extract array from the tensor
    const embedding = Array.from(output.data);
    return embedding;
  } catch (error) {
    console.error("Local Embedding Error:", error);
    throw new Error(`Local embedding failed: ${error.message}`);
  }
}
