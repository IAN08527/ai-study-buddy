"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const SubjectSidebar = ({
  subjectName,
  chapters,
  syllabus,
  activeTab,
  onTabChange,
  selectedResource,
  onResourceSelect,
}) => {
  const router = useRouter();
  const [expandedChapters, setExpandedChapters] = useState(
    // default all expanded
    chapters.reduce((acc, ch) => ({ ...acc, [ch.chapterID]: true }), {})
  );
  const [collapsed, setCollapsed] = useState(false);

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const tabs = [
    { id: "chat", label: "AI Chat", icon: "chat" },
    { id: "notes", label: "Notes & Syllabus", icon: "notes" },
    { id: "videos", label: "Study Videos", icon: "videos" },
  ];

  const tabIcons = {
    chat: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    notes: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>
    ),
    videos: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m10 9 5 3-5 3z" />
      </svg>
    ),
  };

  // Icons for file types
  const pdfIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );

  const videoIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </svg>
  );

  const syllabusIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );

  const chevronIcon = (expanded) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  return (
    <aside className={`subject-sidebar ${collapsed ? "subject-sidebar--collapsed" : ""}`}>
      {/* Mobile toggle */}
      <button
        className="subject-sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? (
            <>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          ) : (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          )}
        </svg>
      </button>

      <div className={`subject-sidebar-inner ${collapsed ? "subject-sidebar-inner--hidden" : ""}`}>
        {/* Back to Dashboard */}
        <button
          className="subject-back-btn"
          onClick={() => router.push("/dashboard")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Dashboard</span>
        </button>

        {/* Subject Name */}
        <h2 className="subject-sidebar-title">{subjectName}</h2>

        {/* Tabs */}
        <nav className="subject-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`subject-tab ${activeTab === tab.id ? "subject-tab--active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tabIcons[tab.icon]}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Scrollable content */}
        <div className="subject-sidebar-scroll custom-scrollbar">
          {/* Syllabus */}
          {syllabus && syllabus.length > 0 && (
            <div className="subject-sidebar-section">
              {syllabus.map((s) => (
                <button
                  key={s.resource_id}
                  className={`subject-resource-item ${
                    selectedResource?.resource_id === s.resource_id
                      ? "subject-resource-item--active"
                      : ""
                  }`}
                  onClick={() => onResourceSelect(s)}
                >
                  {syllabusIcon}
                  <span>Syllabus</span>
                </button>
              ))}
            </div>
          )}

          {/* Chapters */}
          <div className="subject-chapters">
            {chapters.map((chapter) => (
              <div key={chapter.chapterID} className="subject-chapter">
                <button
                  className="subject-chapter-header"
                  onClick={() => toggleChapter(chapter.chapterID)}
                >
                  {chevronIcon(expandedChapters[chapter.chapterID])}
                  <span className="subject-chapter-name">{chapter.cName}</span>
                </button>

                {expandedChapters[chapter.chapterID] && (
                  <div className="subject-chapter-items">
                    {/* Notes */}
                    {chapter.cNotes.map((note) => (
                      <button
                        key={note.resource_id}
                        className={`subject-resource-item subject-resource-item--nested ${
                          selectedResource?.resource_id === note.resource_id
                            ? "subject-resource-item--active"
                            : ""
                        }`}
                        onClick={() => onResourceSelect(note)}
                      >
                        {pdfIcon}
                        <span>{note.title}</span>
                      </button>
                    ))}
                    {/* Videos */}
                    {chapter.cYoutubeLink.map((video) => (
                      <button
                        key={video.resource_id}
                        className={`subject-resource-item subject-resource-item--nested ${
                          selectedResource?.resource_id === video.resource_id
                            ? "subject-resource-item--active"
                            : ""
                        }`}
                        onClick={() => onResourceSelect(video)}
                      >
                        {videoIcon}
                        <span>{video.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SubjectSidebar;
