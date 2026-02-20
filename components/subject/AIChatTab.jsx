"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// ── Improved Status Indicator Component ───────────────────────────
const StatusIndicator = ({ status }) => {
  if (!status) return null;

  const statusMap = {
    "Verifying access...": { icon: "🔐", color: "var(--status-blue, rgb(100,160,255))" },
    "Loading conversation history...": { icon: "💬", color: "var(--status-blue, rgb(100,160,255))" },
    "Encoding your question...": { icon: "🔢", color: "var(--status-purple, rgb(180,130,255))" },
    "Searching your documents...": { icon: "🔍", color: "var(--status-amber, rgb(255,190,80))" },
    "Assembling context...": { icon: "📋", color: "var(--status-amber, rgb(255,190,80))" },
    "Thinking...": { icon: "🧠", color: "var(--status-green, rgb(80,200,120))" },
    "Reasoning...": { icon: "🧠", color: "var(--status-green, rgb(80,200,120))" },
    "Generating response...": { icon: "✍️", color: "var(--status-green, rgb(80,200,120))" },
    "Saving conversation...": { icon: "💾", color: "var(--status-blue, rgb(100,160,255))" },
  };

  const config = statusMap[status] || { icon: "⏳", color: "rgb(150,150,150)" };

  return (
    <div className="chat-status-indicator">
      <div className="chat-status-pulse" style={{ background: config.color, boxShadow: `0 0 8px ${config.color}` }} />
      <span className="chat-status-icon">{config.icon}</span>
      <span className="chat-status-text">{status}</span>
    </div>
  );
};

// ── Reasoning Block Component ─────────────────────────────
const ReasoningBlock = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-expand if content is streaming (optional, keeps it collapsed by default to reduce noise)
  // But user asked to see tokens being generated. Let's keep it manual toggle but make it clear.
  
  if (!content) return null;

  return (
    <div className="chat-reasoning-block">
      <button 
        className={`chat-reasoning-toggle ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Valid Reasoning Process"
      >
        <span className="reasoning-icon">🧠</span>
        <span className="reasoning-label">Thinking Process ({content.length} chars)</span>
        <svg 
          width="12" height="12" viewBox="0 0 24 24" 
          fill="none" stroke="currentColor" strokeWidth="2"
          className={`reasoning-chevron ${isOpen ? "open" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="chat-reasoning-content">
          {content}
          <span className="animate-pulse">▍</span>
        </div>
      )}
    </div>
  );
};

// ── Citations Component ──────────────────────────────────
const Citations = ({ citations }) => {
  const [expanded, setExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="chat-citations">
      <button
        className="chat-citations-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
        {citations.length} source{citations.length > 1 ? "s" : ""} cited
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`chat-citations-chevron ${expanded ? "chat-citations-chevron--open" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="chat-citations-list">
          {citations.map((c, i) => (
            <div key={i} className="chat-citation-card">
              <div className="chat-citation-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
                <span className="chat-citation-title">{c.documentTitle}</span>
                <span className="chat-citation-score">{c.similarity}% match</span>
              </div>
              <p className="chat-citation-excerpt">{c.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Mention Dropdown ─────────────────────────────────────
const MentionDropdown = ({ pdfs, filter, onSelect }) => {
  const filtered = pdfs.filter((p) =>
    p.title.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="chat-mention-dropdown">
      <div className="chat-mention-header">Filter by document</div>
      {filtered.map((pdf) => (
        <button
          key={pdf.resource_id}
          className="chat-mention-item"
          onClick={() => onSelect(pdf)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          <span>{pdf.title}</span>
        </button>
      ))}
    </div>
  );
};

// ── Main Chat Component ──────────────────────────────────
const AIChatTab = ({ subjectName, subjectId, allPdfs }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [selectedPdfs, setSelectedPdfs] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const isAtBottom = useRef(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/chatHistory/${subjectId}`);
        if (response.ok) {
          const data = await response.json();
          const historyMessages = (data.messages || []).map((m) => ({
            id: m.chat_id,
            role: m.message_role,
            content: m.message_text,
          }));
          setMessages(historyMessages);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    if (subjectId) loadHistory();
  }, [subjectId]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      // If we are within 100px of the bottom, consider it "at bottom"
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      isAtBottom.current = atBottom;
    }
  };

  useEffect(() => {
    if (isAtBottom.current) {
      // During streaming, use "auto" behavior to prevent the choppy/laggy animations
      // Use "smooth" only for standard history loading or user message sending
      scrollToBottom(!isStreaming);
    }
  }, [messages, isStreaming, currentStatus, scrollToBottom]);

  const displayMessages = useMemo(() => {
    const welcome = {
      id: "welcome",
      role: "assistant",
      content: `Hello! I'm your AI Study Buddy for **${subjectName}**. I can answer questions based on your uploaded notes and syllabus.\n\nTip: Type **@** to filter your search by specific documents.`,
    };
    return [welcome, ...messages];
  }, [messages, subjectName]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const cleanQuery = input.replace(/@\S*/g, "").trim();
    if (!cleanQuery) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: cleanQuery,
      selectedPdfs: selectedPdfs.length > 0 ? [...selectedPdfs] : null,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSelectedPdfs([]);
    setIsStreaming(true);
    setCurrentStatus("Connecting...");
    setShowMentions(false);

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const aiMessageId = `ai-${Date.now()}`;
    let messageAdded = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cleanQuery,
          subjectId,
          resourceIds: userMessage.selectedPdfs?.map((p) => p.resource_id) || [],
        }),
      });

      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "status") setCurrentStatus(event.status);

            if (event.type === "reasoning") {
              if (!messageAdded) {
                messageAdded = true;
                setCurrentStatus("Reasoning...");
                setMessages((prev) => [
                    ...prev,
                    { id: aiMessageId, role: "assistant", content: "", reasoning: event.token },
                  ]);
              } else {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === aiMessageId
                        ? { ...m, reasoning: (m.reasoning || "") + event.token }
                        : m
                    )
                );
              }
            }

            if (event.type === "token") {
              if (!messageAdded) {
                messageAdded = true;
                setCurrentStatus(null);
                setMessages((prev) => [
                  ...prev,
                  { id: aiMessageId, role: "assistant", content: event.token },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId
                      ? { ...m, content: m.content + event.token }
                      : m
                  )
                );
              }
            }

            if (event.type === "done") {
              if (messageAdded) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId ? { ...m, citations: event.citations } : m
                  )
                );
              }
            }

            if (event.type === "error") throw new Error(event.error);

          } catch (parseErr) {
            // Ignore parse errors from partial JSON
          }
        }
      }

      if (!messageAdded) {
        setMessages((prev) => [
          ...prev,
          { id: aiMessageId, role: "assistant", content: "I wasn't able to generate a response.", isError: true },
        ]);
      }
    } catch (error) {
      if (error.message.includes("too many requests") || error.message.includes("429")) {
        toast.error("AI service is busy (Rate Limit). Please wait a few seconds.");
      } else {
        toast.error(error.message);
      }
      
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: "assistant", content: `⚠️ ${error.message}`, isError: true },
      ]);
    } finally {
      setIsStreaming(false);
      setCurrentStatus(null);
    }
  }, [input, isStreaming, selectedPdfs, subjectId]);

  // Input Handlers
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") setShowMentions(false);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setInput(val);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";

    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(" ") || after.length === 0) {
        setShowMentions(true);
        setMentionFilter(after);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (pdf) => {
    if (!selectedPdfs.find((p) => p.resource_id === pdf.resource_id)) {
      setSelectedPdfs(prev => [...prev, pdf]);
    }
    setInput(input.slice(0, input.lastIndexOf("@")).trim());
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const removePdfFilter = (id) => setSelectedPdfs(prev => prev.filter(p => p.resource_id !== id));

  const handleClearChat = async () => {
    try {
      if (confirm("Clear chat history?")) {
        const res = await fetch(`/api/chatHistory/${subjectId}`, { method: "DELETE" });
        if (res.ok) { setMessages([]); toast.success("Cleared"); }
      }
    } catch { toast.error("Failed to clear"); }
  };

  return (
    <div className="chat-tab">
      <div className="chat-header">
        <span className="chat-header-title">AI Study Buddy</span>
        {messages.length > 0 && (
          <button className="chat-clear-btn" onClick={handleClearChat} title="Clear history">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            Clear
          </button>
        )}
      </div>

      <div 
        className="chat-messages custom-scrollbar" 
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {isLoadingHistory ? (
          <div className="chat-loading-history">
            <div className="subject-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            <span>Loading chat history...</span>
          </div>
        ) : (
          displayMessages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role === "assistant" ? "chat-message--ai" : "chat-message--user"}`}>
              {msg.selectedPdfs?.length > 0 && (
                <div className="chat-msg-filters">
                  {msg.selectedPdfs.map(p => <span key={p.resource_id} className="chat-msg-filter-chip">📄 {p.title}</span>)}
                </div>
              )}
              
              <div className={`chat-bubble ${msg.isError ? "chat-bubble--error" : ""}`}>
                {msg.role === "assistant" ? (
                  <>
                    {/* Render reasoning block if present */}
                    {msg.reasoning && <ReasoningBlock content={msg.reasoning} />}
                    {/* Render message content using ReactMarkdown with GFM */}
                    <div className="chat-md-content prose prose-slate max-w-none dark:prose-invert prose-headings:text-blue-600 prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                                code({node, inline, className, children, ...props}) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                    ) : (
                                    <code className={`chat-inline-code ${className}`} {...props}>
                                        {children}
                                    </code>
                                    )
                                }
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                  </>
                ) : (
                  msg.content
                )}
              </div>
              {msg.citations && <Citations citations={msg.citations} />}
            </div>
          ))
        )}

        {isStreaming && currentStatus && (
          <div className="chat-message chat-message--ai">
            <StatusIndicator status={currentStatus} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {selectedPdfs.length > 0 && (
          <div className="chat-pdf-chips">
            {selectedPdfs.map(p => (
              <span key={p.resource_id} className="chat-pdf-chip">
                📄 {p.title}
                <button className="chat-pdf-chip-remove" onClick={() => removePdfFilter(p.resource_id)}>×</button>
              </span>
            ))}
          </div>
        )}

        <div className="chat-input-wrapper">
          {showMentions && allPdfs?.length > 0 && (
            <MentionDropdown pdfs={allPdfs} filter={mentionFilter} onSelect={handleMentionSelect} />
          )}

          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Ask a question... (@ for docs)"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isStreaming}
          />
          <button className={`chat-send-btn ${input.trim() ? "chat-send-btn--active" : ""}`} onClick={handleSend} disabled={!input.trim() || isStreaming}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
        <p className="chat-hint">Enter to send · Shift+Enter for newline · @ to filter docs</p>
      </div>
    </div>
  );
};

export default AIChatTab;
