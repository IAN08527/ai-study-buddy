import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Edge functions have a strict 256MB memory limit and 10s CPU limit on the free tier.
// Loading a 130MB+ Transformers.js model natively crashes the function.
// We use the HF API instead, which offloads the heavy lifting and returns exactly 768 dims.
const HF_ACCESS_TOKEN = Deno.env.get("HF_ACCESS_TOKEN");
const MODEL_ID = "sentence-transformers/all-mpnet-base-v2";

Deno.serve(async (req) => {
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!HF_ACCESS_TOKEN) {
       return new Response(JSON.stringify({ error: 'HF_ACCESS_TOKEN is missing' }), { 
         status: 500,
         headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
       });
    }

    const response = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL_ID}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hugging Face API Error: ${errorText}`);
    }

    const embedding = await response.json();

    return new Response(JSON.stringify({ embedding }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: 200
    });
  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
