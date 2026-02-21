import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/gemini";
import { Groq } from "groq-sdk";

const SYSTEM_PROMPT = `You are an AI Study Buddy — a knowledgeable, friendly, and precise tutor. Your job is to help students understand their course material.

FORMATTING RULES:
1. You MUST output responses in valid GitHub Flavored Markdown with a clear visual hierarchy:
   - Use '#' for the main Title of the response (the student's topic).
   - Use '##' for major sections or Unit titles.
   - Use '###' for sub-topics or detailed points.
   - Use standard paragraphs for clear explanations.
   - Use bolding (**text**) for important terminology, key definitions, and critical concepts.
2. Always present marks distributions, comparisons, or schedules using Markdown Tables.
3. If the context contains a code snippet or tool command (e.g., Selenium, SQL), use a syntax-highlighted code block.
4. Use horizontal rules (---) to separate major sections.
5. NEVER use HTML tags like <br />. Use standard Markdown newline conventions (two newlines for a paragraph break).
6. DO NOT include any "Note", "Summary", or "Source" sections at the end of your response.
7. DO NOT include inline citations (e.g., [Source: Document Name]) within the text. Citations are handled by the system UI separately.

CONTENT RULES:
1. Base your answers PRIMARILY on the provided context from the student's uploaded documents. If the context contains the answer, use it.
2. If the context doesn't contain enough information, you may supplement with your general knowledge but clearly indicate: "Based on general knowledge: ..."
3. If the student's documents contradict widely accepted facts, PRIORITIZE the document content and note the discrepancy.
4. Be concise but thorough.
5. If you don't know something and it's not in the context, say so honestly.`;

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json(
      { error: "Unauthorized: Please log in to perform this action." },
      { status: 401 }
    );
  }

  let query, subjectId, resourceIds;
  try {
    const body = await request.json();
    query = body.query;
    subjectId = body.subjectId;
    resourceIds = body.resourceIds;
    // We explicitly ignore `clientEmbedding` now since we run it directly against HF API
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
          .eq("user_id", session.user.id)
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
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        const chatHistory = (history || []).reverse();

        // 3. Generate query embedding (Directly via HF API)
        sendStatus("Encoding your question via HF API...");
        const queryEmbedding = await generateEmbedding(query);

        if (!queryEmbedding || queryEmbedding.length === 0) {
          throw new Error("Failed to generate embedding array from Hugging Face.");
        }

        // 4. Vector similarity search
        sendStatus("Searching your documents...");
        
        let rpcParams;
        if (resourceIds && resourceIds.length > 0) {
          rpcParams = {
            query_embedding: queryEmbedding,
            p_subject_id: subjectId,
            p_resource_ids: resourceIds,
            match_count: 10
          };
        } else {
          rpcParams = {
            query_embedding: queryEmbedding,
            p_subject_id: subjectId,
            p_resource_ids: null,
            match_count: 10
          };
        }

        const { data: chunks, error: rpcError } = await supabase
          .rpc("match_chunks", rpcParams);

        if (rpcError) {
          console.error("Vector search error:", rpcError.message);
        } else {
          console.log(`🔍 Vector search found ${chunks?.length || 0} chunks.`);
          if (chunks && chunks.length > 0) {
            chunks.forEach((c, i) => console.log(`   [${i}] ${c.document_title} (Score: ${c.similarity.toFixed(4)}) - ${c.chunk_text.substring(0, 50)}...`));
          } else {
            console.warn("⚠️  No relevant chunks found.");
          }
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

        const fullPromptText = [
          contextBlock,
          "",
          historyBlock,
          "",
          `Student's Question: ${query}`
        ].filter(Boolean).join("\n");

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: fullPromptText }
        ];

        sendStatus("Thinking...");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqStream = await groq.chat.completions.create({
          messages,
          model: 'llama-3.3-70b-versatile',
          stream: true,
        });

        let fullResponse = "";
        let startedGenerating = false;

        for await (const chunk of groqStream) {
          const reasoning = chunk.choices[0]?.delta?.reasoning || '';
          const token = chunk.choices[0]?.delta?.content || '';
          
          if (reasoning) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "reasoning", token: reasoning }) + "\n"));
          }

          if (token) {
            if (!startedGenerating) {
              startedGenerating = true;
              sendStatus("Generating response...");
            }
            fullResponse += token;
            sendToken(token);
          }
        }

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
            { user_id: session.user.id, subject_id: subjectId, message_role: "user", message_text: query },
            { user_id: session.user.id, subject_id: subjectId, message_role: "assistant", message_text: fullResponse },
          ]);

        if (historyError) {
          console.error("Failed to save chat history:", historyError.message);
        }

        // 9. Send completion with citations
        sendDone(uniqueCitations);

      } catch (error) {
        console.error("Chat Stream Error:", error.message);

        if (error.status === 429) {
          sendError("The AI is currently receiving too many requests. Please try again in a moment.");
        } else if (error.status === 401 || error.message?.includes("API key")) {
          sendError("AI service configuration error. Please check your GROQ_API_KEY and GEMINI_API_KEY.");
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
