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
  
  // Conversations states
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [editingConvId, setEditingConvId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const isAtBottom = useRef(true);

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch(`/api/conversations/${subjectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.conversations && data.conversations.length > 0) {
            setConversations(data.conversations);
            setActiveConversationId(data.conversations[0].conversation_id);
          } else {
            handleNewConversation();
          }
        }
      } catch (err) {
        console.error("Failed to fetch conversations", err);
      } finally {
        setIsConversationsLoading(false);
      }
    };
    if (subjectId) fetchConversations();
  }, [subjectId]);

  // Load history when active conversation changes
  useEffect(() => {
    const loadHistory = async () => {
      if (!activeConversationId) return;
      setIsLoadingHistory(true);
      try {
        const response = await fetch(`/api/chatHistory/${activeConversationId}`);
        if (response.ok) {
          const data = await response.json();
          const historyMessages = (data.messages || []).map((m) => ({
            id: m.chat_id,
            role: m.message_role,
            content: m.message_text,
          }));
          setMessages(historyMessages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, [activeConversationId]);

  const handleNewConversation = async () => {
    try {
      const res = await fetch(`/api/conversations/${subjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" })
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(prev => [data.conversation, ...prev]);
        setActiveConversationId(data.conversation.conversation_id);
        if (window.innerWidth < 768) setIsSidebarOpen(false); // Auto close on mobile
      }
    } catch (err) {
      toast.error("Failed to create new chat");
    }
  };

  const handleRename = async (id) => {
    if (!editTitle.trim()) { setEditingConvId(null); return; }
    try {
      const res = await fetch(`/api/conversation/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      if (res.ok) {
        setConversations(prev => prev.map(c => c.conversation_id === id ? { ...c, title: editTitle.trim() } : c));
        toast.success("Renamed successfully");
      }
    } catch {
      toast.error("Failed to rename");
    } finally {
      setEditingConvId(null);
    }
  };

  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`/api/conversation/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.conversation_id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter(c => c.conversation_id !== id);
          if (remaining.length > 0) setActiveConversationId(remaining[0].conversation_id);
          else handleNewConversation();
        }
        toast.success("Conversation deleted");
      }
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      isAtBottom.current = atBottom;
    }
  };

  useEffect(() => {
    if (isAtBottom.current) {
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
    if (!input.trim() || isStreaming || !activeConversationId) return;

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

    // Optional: auto rename conversation title on first message
    if (messages.length === 0) {
        const newTitle = cleanQuery.substring(0, 30) + (cleanQuery.length > 30 ? '...' : '');
        try {
            const renameRes = await fetch(`/api/conversation/${activeConversationId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle })
            });
            if (renameRes.ok) {
                setConversations(prev => prev.map(c => c.conversation_id === activeConversationId ? { ...c, title: newTitle } : c));
            }
        } catch (ignored) {}
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cleanQuery,
          subjectId,
          conversationId: activeConversationId,
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
  }, [input, isStreaming, selectedPdfs, subjectId, activeConversationId, messages.length]);

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

  return (
    <div className="chat-tab">

      <div className={`chat-sidebar ${isSidebarOpen ? "" : "chat-sidebar--hidden"}`}>
        <div className="chat-sidebar-header">
          <span className="chat-sidebar-title">Conversations</span>
          <button className="chat-new-btn" onClick={handleNewConversation} title="Start a new conversation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Chat
          </button>
        </div>
        <div className="chat-sidebar-list custom-scrollbar">
          {isConversationsLoading ? (
            <div style={{ padding: "12px", color: "#888", fontSize: "0.85rem", textAlign: "center" }}>Loading...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: "12px", color: "#888", fontSize: "0.85rem", textAlign: "center" }}>No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.conversation_id} 
                className={`chat-conv-item ${activeConversationId === conv.conversation_id ? "chat-conv-item--active" : ""}`}
                onClick={() => {
                  if (editingConvId !== conv.conversation_id) setActiveConversationId(conv.conversation_id);
                }}
              >
                {editingConvId === conv.conversation_id ? (
                  <input
                    autoFocus
                    className="chat-conv-edit-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(conv.conversation_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(conv.conversation_id);
                      if (e.key === "Escape") setEditingConvId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="chat-conv-title">{conv.title}</span>
                    <div className="chat-conv-actions">
                      <button 
                        className="chat-conv-action-btn" 
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitle(conv.title);
                          setEditingConvId(conv.conversation_id);
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button 
                        className="chat-conv-action-btn" 
                        title="Delete"
                        onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button 
              className="chat-conv-action-btn" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              title="Toggle Conversations Sidebar"
              style={{ background: "rgba(255,255,255,0.05)", padding: "6px", borderRadius: "6px" }}
            >
               <svg style={{transform: isSidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'block'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="chat-header-title">AI Study Buddy</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
             {!isSidebarOpen && (
                <button className="chat-new-btn" onClick={handleNewConversation} title="Start a new chat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Chat
                </button>
             )}
          </div>
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
                      {msg.reasoning && <ReasoningBlock content={msg.reasoning} />}
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
    </div>
  );
};

export default AIChatTab;
