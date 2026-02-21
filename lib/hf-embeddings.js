/**
 * Server-side AI embedding utility using standard HTTP fetch to the 
 * Hugging Face Inference API.
 * 
 * This completely avoids Vercel build errors with native ONNX/Transformers binaries
 * by offloading the calculation to Hugging Face's servers via REST API.
 */

const HF_ACCESS_TOKEN = process.env.HF_ACCESS_TOKEN;
// BAAI/bge-base-en-v1.5 outputs 768-dimensional embeddings and correctly routes to the feature-extraction pipeline on HF's new API
const MODEL_ID = "BAAI/bge-base-en-v1.5"; 

/**
 * Generate a 768-dim embedding via Hugging Face REST API.
 * @param {string} text The text chunk to embed.
 * @returns {Promise<number[]>} 768-dimensional vector array.
 */
export async function generateEmbedding(text) {
  if (!text || !text.trim()) return [];

  if (!HF_ACCESS_TOKEN) {
    console.error("Embedding Error: Missing HF_ACCESS_TOKEN environment variable.");
    return []; // Return empty to prevent crushing the whole request
  }

  try {
    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${MODEL_ID}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hugging Face API Error (${response.status}): ${errorText}`);
      throw new Error(`HF API HTTP error! status: ${response.status}`);
    }

    const embedding = await response.json();
    return embedding;
  } catch (error) {
    console.error("Embedding Generation Catch Error:", error.message);
    return [];
  }
}
