import { pipeline, env } from "@huggingface/transformers";

// Configure Transformers.js for browser environment
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true; // Use IndexedDB to save the model after first download

// Pull the WebAssembly binaries from CDN
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';

class PipelineSingleton {
  static task = "feature-extraction";
  static model = "Xenova/bge-small-en-v1.5";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { 
        progress_callback,
        device: 'webgpu', // Try WebGPU first for faster embeddings
      }).catch(err => {
        console.warn("WebGPU not available, falling back to WASM:", err);
        return pipeline(this.task, this.model, { progress_callback });
      });
    }
    return this.instance;
  }
}

/**
 * Client-side embedding generation.
 * @param {string} text 
 * @param {Function} onProgress Optional callback for download progress
 * @returns {Promise<number[]>}
 */
export async function generateClientEmbedding(text, onProgress) {
  if (!text || !text.trim()) return [];

  const embedder = await PipelineSingleton.getInstance(onProgress);
  const output = await embedder(text, { pooling: "mean", normalize: true });
  
  return Array.from(output.data);
}
