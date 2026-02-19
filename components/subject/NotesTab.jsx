"use client";

import React, { useState, useEffect, useCallback } from "react";

const NotesTab = ({ selectedResource }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [zoom, setZoom] = useState(100);

  const fileName = selectedResource?.title || "No document selected";

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));

  // Fetch signed URL when a resource is selected
  const fetchPdfUrl = useCallback(async (resourceId) => {
    setIsLoadingPdf(true);
    setPdfError(null);
    setPdfUrl(null);
    try {
      const response = await fetch(`/api/getPdfUrl/${resourceId}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load PDF (${response.status})`);
      }
      const data = await response.json();
      setPdfUrl(data.url);
    } catch (error) {
      console.error("PDF fetch error:", error);
      setPdfError(error.message);
    } finally {
      setIsLoadingPdf(false);
    }
  }, []);

  useEffect(() => {
    if (selectedResource?.resource_id) {
      fetchPdfUrl(selectedResource.resource_id);
    } else {
      setPdfUrl(null);
      setPdfError(null);
    }
  }, [selectedResource, fetchPdfUrl]);

  const handleDownload = async () => {
    if (!pdfUrl) return;
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = selectedResource?.title || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback: open in new tab
      window.open(pdfUrl, "_blank");
    }
  };

  // ── Empty state ──────────────────────────────────────────
  if (!selectedResource) {
    return (
      <div className="notes-tab">
        <div className="notes-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="notes-empty-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3 className="notes-empty-title">Select a document</h3>
          <p className="notes-empty-desc">
            Choose a PDF from the sidebar to view it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-tab">
      {/* Toolbar */}
      <div className="notes-toolbar">
        <span className="notes-filename">{fileName}</span>
        <div className="notes-toolbar-actions">
          <button
            className="notes-toolbar-btn"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            disabled={isLoadingPdf}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <span className="notes-zoom-label">{zoom}%</span>
          <button
            className="notes-toolbar-btn"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            disabled={isLoadingPdf}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
          <button
            className="notes-toolbar-btn notes-download-btn"
            aria-label="Download"
            onClick={handleDownload}
            disabled={!pdfUrl || isLoadingPdf}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* PDF Viewer Area */}
      <div className="notes-viewer">
        {isLoadingPdf && (
          <div className="notes-loading">
            <div className="notes-loading-spinner" />
            <p>Loading document...</p>
          </div>
        )}

        {pdfError && (
          <div className="notes-pdf-body">
            <div className="notes-error-card">
              <h4>Failed to load PDF</h4>
              <p>{pdfError}</p>
              <button
                className="notes-reload-btn"
                onClick={() => fetchPdfUrl(selectedResource.resource_id)}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {pdfUrl && !isLoadingPdf && !pdfError && (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            className="notes-pdf-iframe"
            title={fileName}
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
              width: `${10000 / zoom}%`,
              height: `${10000 / zoom}%`,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default NotesTab;
