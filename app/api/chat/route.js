import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding, streamChatWithOllama } from "@/lib/ollama";

const SYSTEM_PROMPT = `You are an AI Study Buddy — a knowledgeable, friendly, and precise tutor. Your job is to help students understand their course material.

RULES:
1. Base your answers PRIMARILY on the provided context from the student's uploaded documents. If the context contains the answer, use it.
2. Always cite which document your information comes from using the format: [Source: Document Name].
3. If the context doesn't contain enough information, you may supplement with your general knowledge but clearly indicate: "Based on general knowledge: ..."
4. If the student's documents contradict widely accepted facts, PRIORITIZE the document content and note the discrepancy.
5. Be concise but thorough. Use bullet points, numbered lists, and bold text for clarity.
6. If you don't know something and it's not in the context, say so honestly.
7. When asked about topics covered in the documents, structure your response clearly with headings if appropriate.`;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query, subjectId, resourceIds;
  try {
    const body = await request.json();
    query = body.query;
    subjectId = body.subjectId;
    resourceIds = body.resourceIds;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!query || !subjectId) {
    return NextResponse.json({ error: "Query and subjectId are required" }, { status: 400 });
  }

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send a status update
      const sendStatus = (status) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "status", status }) + "\n"));
      };

      // Helper to send a token
      const sendToken = (token) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "token", token }) + "\n"));
      };

      // Helper to send the final done event with citations
      const sendDone = (citations) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", citations }) + "\n"));
      };

      // Helper to send errors
      const sendError = (message) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: message }) + "\n"));
      };

      try {
        // 1. Verify ownership
        sendStatus("Verifying access...");
        const { data: subject, error: subjectError } = await supabase
          .from("Subject")
          .select("subject_id")
          .eq("subject_id", subjectId)
          .eq("user_id", user.id)
          .single();

        if (subjectError || !subject) {
          sendError("Subject not found");
          controller.close();
          return;
        }

        // 2. Retrieve chat history
        sendStatus("Loading conversation history...");
        const { data: history } = await supabase
          .from("Chat_history")
          .select("message_role, message_text")
          .eq("subject_id", subjectId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        const chatHistory = (history || []).reverse();

        // 3. Generate query embedding
        sendStatus("Encoding your question...");
        const queryEmbedding = await generateEmbedding(query);

        // 4. Vector similarity search
        sendStatus("Searching your documents...");
        const rpcParams = {
          query_embedding: queryEmbedding,
          p_subject_id: subjectId,
          match_count: 5,
        };

        if (resourceIds && resourceIds.length > 0) {
          rpcParams.p_resource_ids = resourceIds;
        }

        const { data: chunks, error: rpcError } = await supabase
          .rpc("match_chunks", rpcParams);

        if (rpcError) {
          console.error("Vector search error:", rpcError.message);
        }

        const relevantChunks = chunks || [];

        // 5. Assemble context
        sendStatus("Assembling context...");
        const contextParts = relevantChunks.map((chunk) =>
          `[Document: ${chunk.document_title}]\n${chunk.chunk_text}`
        );
        const contextBlock = contextParts.length > 0
          ? `RELEVANT CONTEXT FROM STUDENT'S DOCUMENTS:\n---\n${contextParts.join("\n---\n")}\n---`
          : "No relevant context found in the student's documents.";

        const historyBlock = chatHistory.length > 0
          ? "PREVIOUS CONVERSATION:\n" + chatHistory.map(m =>
              `${m.message_role === "user" ? "Student" : "AI Tutor"}: ${m.message_text}`
            ).join("\n")
          : "";

        const fullPrompt = [
          SYSTEM_PROMPT,
          "",
          contextBlock,
          "",
          historyBlock,
          "",
          `Student's Question: ${query}`,
          "",
          "AI Tutor's Answer:",
        ].filter(Boolean).join("\n");

        // 6. Stream the response from Ollama
        sendStatus("Thinking...");
        const ollamaStream = await streamChatWithOllama(fullPrompt);
        const reader = ollamaStream.getReader();
        const decoder = new TextDecoder();

        let fullResponse = "";
        let insideThinkBlock = false;
        let buffer = "";
        let startedGenerating = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Ollama streams newline-delimited JSON
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const token = parsed.response || "";

              if (!token) continue;

              // Handle <think>...</think> blocks from DeepSeek R1
              if (token.includes("<think>")) {
                insideThinkBlock = true;
                sendStatus("Thinking...");
                continue;
              }
              if (token.includes("</think>")) {
                insideThinkBlock = false;
                sendStatus("Generating response...");
                continue;
              }

              if (insideThinkBlock) {
                // Send reasoning tokens separately
                controller.enqueue(encoder.encode(JSON.stringify({ type: "reasoning", token }) + "\n"));
                continue;
              }

              if (!startedGenerating) {
                startedGenerating = true;
                sendStatus("Generating response...");
              }

              fullResponse += token;
              sendToken(token);
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Clean up any remaining think tags from the full response
        fullResponse = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

        // 7. Build citations
        const citations = relevantChunks.map(chunk => ({
          documentTitle: chunk.document_title,
          excerpt: chunk.chunk_text.slice(0, 200) + (chunk.chunk_text.length > 200 ? "..." : ""),
          similarity: Math.round(chunk.similarity * 100),
        }));

        const uniqueCitations = [];
        const seenDocs = new Set();
        for (const citation of citations) {
          if (!seenDocs.has(citation.documentTitle)) {
            seenDocs.add(citation.documentTitle);
            uniqueCitations.push(citation);
          }
        }

        // 8. Save chat history
        sendStatus("Saving conversation...");
        const { error: historyError } = await supabase
          .from("Chat_history")
          .insert([
            { user_id: user.id, subject_id: subjectId, message_role: "user", message_text: query },
            { user_id: user.id, subject_id: subjectId, message_role: "assistant", message_text: fullResponse },
          ]);

        if (historyError) {
          console.error("Failed to save chat history:", historyError.message);
        }

        // 9. Send completion with citations
        sendDone(uniqueCitations);

      } catch (error) {
        console.error("Chat Stream Error:", error.message);

        if (error.message.includes("Ollama") || error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
          sendError("AI service is not available. Please make sure Ollama is running (ollama serve).");
        } else {
          sendError(error.message);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
