import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0-alpha.18/dist/transformers.min.js";

// Configuration for Deno Edge Environment
env.allowLocalModels = false;
env.allowRemoteModels = true;
// Edge functions don't have persistent file systems in the same way, so cache must be managed carefully
// but Transformers.js handles memory caching during the request lifecycle.
env.useBrowserCache = false;
env.useCustomCache = false;

// Force WASM backend (CPU) since Edge environments don't support native Node.js addons like ONNX Runtime Node
env.backends.onnx.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/";

class PipelineSingleton {
  static task = "feature-extraction";
  // We use bge-small-en-v1.5 to output 768 dimensions (matches your database)
  // and it's small enough (~33MB) to usually run within Edge Function memory limits.
  static model = "Xenova/bge-small-en-v1.5";
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      env.backends.onnx.setPriority(['wasm']); // strictly enforce WASM
      this.instance = await pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

// Ensure pre-loading the model on worker startup to minimize cold start delays
PipelineSingleton.getInstance().catch(console.error);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text input is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Get the embedder
    const embedder = await PipelineSingleton.getInstance();

    // Generate embedding (outputs 768 dims)
    const output = await embedder(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data);

    return new Response(JSON.stringify({ embedding }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });
  } catch (error) {
    console.error("Embedding Error inside Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
