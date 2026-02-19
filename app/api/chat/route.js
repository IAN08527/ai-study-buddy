import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding, streamChatWithOllama } from "@/lib/ollama";
import { rerankChunks } from "@/lib/reranker";

const SYSTEM_PROMPT = `You are a precise Academic Tutor. Your role is to help students understand their course material with accuracy, proper citations, and beautifully formatted responses.

KNOWLEDGE RULES:
1. You will receive 5 highly relevant chunks and a 'Global Summary' of the document.
2. If the answer involves counting chapters, units, or modules, use the Global Summary FIRST.
3. If the answer involves a specific detail, concept, or definition, use the top-ranked chunks.
4. Do NOT include inline citations like [Page X] or [Section: "Name"] in your response text. The system automatically shows source references in a separate panel.
5. If a chunk is marked as table data, present the information in a structured format.
6. Base your answers PRIMARILY on the provided context. If the context doesn't contain enough information, clearly state: "Based on general knowledge: ..."
7. If information contradicts between chunks and general knowledge, PRIORITIZE the document content.
8. If you don't know something and it's not in the context, say so honestly.
9. Note that "Unit", "Module", and "Chapter" in syllabus documents are often equivalent terms.

FORMATTING RULES — You MUST output responses in valid GitHub Flavored Markdown:
1. Use \`##\` for Unit titles (e.g., "## Unit I: Software Testing Fundamentals").
2. Use \`###\` for sub-topics within a unit (e.g., "### Key Definitions").
3. IMPORTANT: Always put a blank line before any heading (## or ###). Never place a heading immediately after text on the previous line.
4. Always present marks distributions, comparisons, schedules, or structured data using **Markdown Tables**.
5. Use **bold** (\`**text**\`) for important terminology like COs, TLOs, key definitions, and technical terms.
6. If the context contains a code snippet or tool command (e.g., Selenium), use a syntax-highlighted code block with the language specified (e.g., \`\`\`java or \`\`\`python).
7. Use horizontal rules (\`---\`) to separate different documents or major sections in your response.
8. Use bullet points (\`-\`) for listing topics and numbered lists (\`1.\`) for sequential steps.
9. Structure every response as: **Header → Content → Summary/Key Takeaway**.`;

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

        // 4. Hybrid Search (Vector + Full-Text + RRF)
        sendStatus("Searching your documents...");
        const rpcParams = {
          query_embedding: queryEmbedding,
          query_text: query,
          p_subject_id: subjectId,
          match_count: 20,
        };

        if (resourceIds && resourceIds.length > 0) {
          rpcParams.p_resource_ids = resourceIds;
        }

        const { data: hybridChunks, error: rpcError } = await supabase
          .rpc("hybrid_search", rpcParams);

        if (rpcError) {
          console.error("Hybrid search error:", rpcError.message);
        } else {
          console.log(`🔍 Hybrid search found ${hybridChunks?.length || 0} chunks.`);
          if (hybridChunks && hybridChunks.length > 0) {
            hybridChunks.slice(0, 5).forEach((c, i) =>
              console.log(`   [${i}] ${c.document_title} (RRF: ${c.rrf_score?.toFixed(4)}, Sim: ${c.similarity?.toFixed(4)}) - ${c.chunk_text.substring(0, 50)}...`)
            );
          }
        }

        const candidateChunks = hybridChunks || [];

        // 5. Rerank — filter top 20 down to top 5
        sendStatus("Reranking results...");
        let relevantChunks;
        if (candidateChunks.length > 5) {
          try {
            relevantChunks = await rerankChunks(query, candidateChunks, 5);
            console.log(`🔀 Reranked ${candidateChunks.length} → ${relevantChunks.length} chunks`);
          } catch (rerankErr) {
            console.warn("Reranking failed, using top 5 from hybrid search:", rerankErr.message);
            relevantChunks = candidateChunks.slice(0, 5);
          }
        } else {
          relevantChunks = candidateChunks;
        }

        // 6. Fetch document summaries for Global Summary
        sendStatus("Loading document context...");
        const resourceIdsInResults = [...new Set(relevantChunks.map(c => c.resource_id))];
        let globalSummary = "";
        if (resourceIdsInResults.length > 0) {
          const { data: resources } = await supabase
            .from("Resources")
            .select("title, document_summary")
            .in("resource_id", resourceIdsInResults);

          if (resources && resources.length > 0) {
            globalSummary = resources
              .filter(r => r.document_summary)
              .map(r => `[${r.title}]: ${r.document_summary}`)
              .join("\n\n");
          }
        }

        // 7. Assemble context with rich metadata
        sendStatus("Assembling context...");
        const contextParts = relevantChunks.map((chunk, idx) => {
          const meta = [];
          meta.push(`Document: ${chunk.document_title}`);
          if (chunk.page_number) meta.push(`Page: ${chunk.page_number}`);
          if (chunk.section_title) meta.push(`Section: "${chunk.section_title}"`);
          if (chunk.is_table_data) meta.push(`Type: TABLE DATA`);
          if (chunk.context_summary) meta.push(`Context: ${chunk.context_summary}`);
          meta.push(`Relevance Rank: ${idx + 1}`);

          return `[${meta.join(" | ")}]\n${chunk.chunk_text}`;
        });

        const contextBlock = contextParts.length > 0
          ? `TOP 5 MOST RELEVANT CHUNKS (reranked by relevance):\n---\n${contextParts.join("\n---\n")}\n---`
          : "No relevant context found in the student's documents.";

        const summaryBlock = globalSummary
          ? `GLOBAL DOCUMENT SUMMARY (use for overview/counting questions):\n${globalSummary}`
          : "";

        const historyBlock = chatHistory.length > 0
          ? "PREVIOUS CONVERSATION:\n" + chatHistory.map(m =>
              `${m.message_role === "user" ? "Student" : "AI Tutor"}: ${m.message_text}`
            ).join("\n")
          : "";

        const fullPrompt = [
          SYSTEM_PROMPT,
          "",
          summaryBlock,
          "",
          contextBlock,
          "",
          historyBlock,
          "",
          `Student's Question: ${query}`,
          "",
          "AI Tutor's Answer:",
        ].filter(Boolean).join("\n");

        // 8. Stream the response from Ollama
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

        // 9. Build citations with rich metadata
        const citations = relevantChunks.map(chunk => ({
          documentTitle: chunk.document_title,
          excerpt: chunk.chunk_text.slice(0, 200) + (chunk.chunk_text.length > 200 ? "..." : ""),
          similarity: Math.round((chunk.similarity || 0) * 100),
          pageNumber: chunk.page_number || null,
          sectionTitle: chunk.section_title || null,
          isTableData: chunk.is_table_data || false,
        }));

        const uniqueCitations = [];
        const seenDocs = new Set();
        for (const citation of citations) {
          const key = `${citation.documentTitle}-p${citation.pageNumber}-${citation.sectionTitle}`;
          if (!seenDocs.has(key)) {
            seenDocs.add(key);
            uniqueCitations.push(citation);
          }
        }

        // 10. Save chat history
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

        // 11. Send completion with citations
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
