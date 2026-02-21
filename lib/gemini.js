/**
 * AI helpers for embedding using Supabase Edge Functions.
 * This replaces Google Gemini and avoids Vercel deployment issues with native binaries.
 */

import { createClient } from "@supabase/supabase-js";

// Initialize a standard supabase client for Edge Function invocation
// Note: We use the anon key here because Edge Functions can handle their own auth/CORS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Generate a 768-dim embedding using the deployed 'embed' Supabase Edge Function.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional vector
 */
export async function generateEmbedding(text) {
  if (!text || !text.trim()) return [];

  try {
    const { data, error } = await supabase.functions.invoke('embed', {
      body: { text }
    });

    if (error) {
       console.error("Supabase Edge Function Error Details:", error);
       throw new Error(`Edge Function returned an error: ${error.message || 'Unknown error'}`);
    }

    if (!data || !data.embedding) {
      throw new Error("Edge Function did not return an embedding array");
    }

    return data.embedding;
  } catch (error) {
    console.error("Embedding Generation Error:", error);
    // Return empty array instead of throwing to avoid crashing the whole request
    return [];
  }
}

