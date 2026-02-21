/**
 * Local AI helpers for embedding using Transformers.js.
 * Replaces Google Gemini/Ollama to eliminate rate limits natively.
 * 
 * Uses:
 *  - Xenova/bge-small-en-v1.5 for 768-dim embeddings entirely locally (optimized for serverless)
 */

import { pipeline, env } from "@huggingface/transformers";

// Configure for Vercel / Serverless environment
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;

// Force WASM backend and specify CDN paths for the .wasm files
// This is critical for Vercel where local binary/wasm loading often fails
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';

class PipelineSingleton {
  static task = "feature-extraction";
  static model = "Xenova/bge-small-en-v1.5"; // Smaller model (33MB vs 100MB) for serverless
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      console.log(`Downloading/Loading local model (${this.model})...`);
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
