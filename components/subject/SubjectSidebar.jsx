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
    chapters.reduce((acc, ch) => ({ ...acc, [ch.chapterID]: true }), {})
  );
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Responsive check
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const tabs = [
    { id: "chat", label: "AI Chat", icon: "chat" },
    { id: "notes", label: "Library", icon: "notes" }, // Shortened for mobile
    { id: "videos", label: "Videos", icon: "videos" }, // Shortened for mobile
  ];

  const tabIcons = {
    chat: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    notes: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
      </svg>
    ),
    videos: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m10 9 5 3-5 3z" />
      </svg>
    ),
  };

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

  const chevronIcon = (expanded) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  const renderResourceList = () => (
    <div className="subject-sidebar-scroll custom-scrollbar">
      {syllabus?.length > 0 && (
        <div className="subject-sidebar-section">
          {syllabus.map((s) => (
            <button
              key={s.resource_id}
              className={`subject-resource-item ${selectedResource?.resource_id === s.resource_id ? "subject-resource-item--active" : ""}`}
              onClick={() => { onResourceSelect(s); setIsDrawerOpen(false); }}
            >
              {pdfIcon}
              <span>Syllabus</span>
            </button>
          ))}
        </div>
      )}

      <div className="subject-chapters">
        {chapters.map((chapter) => (
          <div key={chapter.chapterID} className="subject-chapter">
            <button className="subject-chapter-header" onClick={() => toggleChapter(chapter.chapterID)}>
              {chevronIcon(expandedChapters[chapter.chapterID])}
              <span className="subject-chapter-name">{chapter.cName}</span>
            </button>

            {expandedChapters[chapter.chapterID] && (
              <div className="subject-chapter-items">
                {chapter.cNotes.map((note) => (
                  <button
                    key={note.resource_id}
                    className={`subject-resource-item subject-resource-item--nested ${selectedResource?.resource_id === note.resource_id ? "subject-resource-item--active" : ""}`}
                    onClick={() => { onResourceSelect(note); setIsDrawerOpen(false); }}
                  >
                    {pdfIcon}
                    <span>{note.title}</span>
                  </button>
                ))}
                {chapter.cYoutubeLink.map((video) => (
                  <button
                    key={video.resource_id}
                    className={`subject-resource-item subject-resource-item--nested ${selectedResource?.resource_id === video.resource_id ? "subject-resource-item--active" : ""}`}
                    onClick={() => { onResourceSelect(video); setIsDrawerOpen(false); }}
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
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Top Header */}
        <header className="subject-mobile-header">
          <button className="mobile-header-back" onClick={() => router.push("/dashboard")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className="mobile-header-title line-clamp-1">{subjectName}</h2>
          <button className={`mobile-header-drawer-btn ${isDrawerOpen ? "active" : ""}`} onClick={() => setIsDrawerOpen(!isDrawerOpen)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" /></svg>
          </button>
        </header>

        {/* Resource Drawer */}
        <div className={`subject-mobile-drawer ${isDrawerOpen ? "open" : ""}`}>
          <div className="drawer-header">
            <h3>Resources</h3>
            <button onClick={() => setIsDrawerOpen(false)}>✕</button>
          </div>
          {renderResourceList()}
        </div>

        {/* Mobile Bottom Tabs */}
        <nav className="subject-mobile-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`mobile-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tabIcons[tab.id]}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </>
    );
  }

  return (
    <aside className={`subject-sidebar ${collapsed ? "subject-sidebar--collapsed" : ""}`}>
      <div className={`subject-sidebar-inner ${collapsed ? "subject-sidebar-inner--hidden" : ""}`}>
        <button className="subject-back-btn" onClick={() => router.push("/dashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          <span>Dashboard</span>
        </button>
        <h2 className="subject-sidebar-title">{subjectName}</h2>
        <nav className="subject-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`subject-tab ${activeTab === tab.id ? "subject-tab--active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <div className="tab-icon-wrapper">{tabIcons[tab.id]}</div>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        {renderResourceList()}
      </div>
    </aside>
  );
};

export default SubjectSidebar;
