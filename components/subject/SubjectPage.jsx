"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import SubjectSidebar from "./SubjectSidebar";
import AIChatTab from "./AIChatTab";
import NotesTab from "./NotesTab";
import StudyVideosTab from "./StudyVideosTab";

const SubjectPage = ({ subjectId }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "notes" | "videos"
  const [subjectData, setSubjectData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);

  const fetchSubjectData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/getSubjectDetails/${subjectId}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load subject (${response.status})`);
      }
      const data = await response.json();
      setSubjectData(data);
    } catch (error) {
      console.error("Failed to fetch subject details:", error);
      setFetchError(error.message);
      toast.error(error.message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (subjectId) {
      fetchSubjectData();
    }
  }, [subjectId]);

  // Refresh without showing loading skeleton (for CRUD operations)
  const refreshSubjectData = () => fetchSubjectData(false);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setIsTabTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setSelectedResource(null);
      setIsTabTransitioning(false);
    }, 150);
  };

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
    // If selecting a PDF, switch to notes tab
    if (
      resource.resource_type === "Notes PDF" ||
      resource.resource_type === "PDF" ||
      resource.resource_type === "Syllabus PDF"
    ) {
      if (activeTab !== "notes") handleTabChange("notes");
      else setSelectedResource(resource);
    }
    // If selecting a video, switch to videos tab
    if (resource.resource_type === "YouTube Link") {
      if (activeTab !== "videos") handleTabChange("videos");
      else setSelectedResource(resource);
    }
  };

  // Collect all videos for the playlist (global + chapter videos)
  const allVideos = subjectData
    ? [...(subjectData.globalVideos || []), ...subjectData.chapters.flatMap((ch) => ch.cYoutubeLink)]
    : [];

  // Collect all PDFs for the @ mention dropdown in chat
  const allPdfs = subjectData
    ? [
        ...(subjectData.globalSyllabus || []),
        ...subjectData.chapters.flatMap((ch) => ch.cNotes || []),
      ]
    : [];

  const renderContent = () => {
    if (isTabTransitioning) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="subject-spinner" />
        </div>
      );
    }

    switch (activeTab) {
      case "chat":
        return (
          <AIChatTab
            subjectName={subjectData?.subjectName || "Subject"}
            subjectId={subjectId}
            allPdfs={allPdfs}
          />
        );
      case "notes":
        return <NotesTab selectedResource={selectedResource} />;
      case "videos":
        return (
          <StudyVideosTab
            videos={allVideos}
            selectedVideo={selectedResource}
            onVideoSelect={setSelectedResource}
            subjectId={subjectId}
            onVideoAdded={refreshSubjectData}
          />
        );
      default:
        return null;
    }
  };

  // ── Loading Skeleton ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="subject-page-container">
        {/* Sidebar skeleton */}
        <div className="subject-sidebar-skeleton">
          <div className="skel-back" />
          <div className="skel-title" />
          <div className="skel-tabs">
            <div className="skel-tab" />
            <div className="skel-tab" />
            <div className="skel-tab" />
          </div>
          <div className="skel-divider" />
          <div className="skel-item" />
          <div className="skel-divider" />
          <div className="skel-chapter" />
          <div className="skel-sub" />
          <div className="skel-sub" />
          <div className="skel-chapter" />
          <div className="skel-sub" />
        </div>
        {/* Main content skeleton */}
        <div className="subject-main-skeleton">
          <div className="skel-msg" />
          <div className="skel-input" />
        </div>
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="subject-page-container">
        <div className="subject-main-content" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="notes-error-card" style={{ textAlign: "center", maxWidth: 400 }}>
            <h4>Failed to load subject</h4>
            <p>{fetchError}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                className="notes-reload-btn"
                onClick={() => router.push("/dashboard")}
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
              >
                ← Dashboard
              </button>
              <button
                className="notes-reload-btn"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="subject-page-container">
      <SubjectSidebar
        subjectName={subjectData.subjectName}
        chapters={subjectData.chapters}
        syllabus={subjectData.globalSyllabus}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedResource={selectedResource}
        onResourceSelect={handleResourceSelect}
      />
      <main
        className={`subject-main-content ${isTabTransitioning ? "subject-fade-out" : "subject-fade-in"}`}
      >
        {renderContent()}
      </main>
    </div>
  );
};

export default SubjectPage;
