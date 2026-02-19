"use client";

import React, { useState, useEffect, useCallback } from "react";

const VideoNotes = ({ resourceId, videoTitle }) => {
  const [notes, setNotes] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteTimestamp, setNewNoteTimestamp] = useState("00:00");

  const storageKey = `video-notes-${resourceId}`;

  // Load notes from localStorage
  useEffect(() => {
    if (!resourceId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setNotes(JSON.parse(stored));
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    }
  }, [resourceId, storageKey]);

  // Save notes to localStorage
  const saveNotes = useCallback((updatedNotes) => {
    setNotes(updatedNotes);
    localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
  }, [storageKey]);

  const addNote = () => {
    if (!newNoteText.trim()) return;
    const note = {
      id: Date.now().toString(),
      text: newNoteText.trim(),
      timestamp: newNoteTimestamp,
      createdAt: new Date().toISOString(),
    };
    const updated = [...notes, note].sort((a, b) => {
      const [am, as] = a.timestamp.split(":").map(Number);
      const [bm, bs] = b.timestamp.split(":").map(Number);
      return (am * 60 + as) - (bm * 60 + bs);
    });
    saveNotes(updated);
    setNewNoteText("");
    setNewNoteTimestamp("00:00");
  };

  const deleteNote = (noteId) => {
    const updated = notes.filter((n) => n.id !== noteId);
    saveNotes(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  };

  if (!resourceId) return null;

  return (
    <div className="video-notes">
      <button
        className="video-notes-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span>Notes {notes.length > 0 && `(${notes.length})`}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`video-notes-chevron ${isExpanded ? "video-notes-chevron--open" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className="video-notes-panel">
          {/* Add note form */}
          <div className="video-notes-form">
            <input
              type="text"
              className="video-notes-timestamp-input"
              value={newNoteTimestamp}
              onChange={(e) => setNewNoteTimestamp(e.target.value)}
              placeholder="00:00"
              maxLength={8}
            />
            <input
              type="text"
              className="video-notes-text-input"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note..."
            />
            <button
              className="video-notes-add-btn"
              onClick={addNote}
              disabled={!newNoteText.trim()}
            >
              +
            </button>
          </div>

          {/* Notes list */}
          <div className="video-notes-list custom-scrollbar">
            {notes.length === 0 && (
              <p className="video-notes-empty">
                No notes yet. Add timestamps and notes while watching.
              </p>
            )}
            {notes.map((note) => (
              <div key={note.id} className="video-note-item">
                <span className="video-note-timestamp">{note.timestamp}</span>
                <span className="video-note-text">{note.text}</span>
                <button
                  className="video-note-delete"
                  onClick={() => deleteNote(note.id)}
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoNotes;
