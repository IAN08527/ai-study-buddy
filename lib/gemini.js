/**
 * Legacy bridge.
 * All embedding calls in the backend now route directly to the Hugging Face Inference API 
 * via `hf-embeddings.js` to avoid native node binary errors on Vercel.
 */

import { generateEmbedding as hfEmbed } from "./hf-embeddings";

export async function generateEmbedding(text) {
  return await hfEmbed(text);
}


