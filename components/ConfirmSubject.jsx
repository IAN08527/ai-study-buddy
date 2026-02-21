import React from "react";

const ConfirmSubject = ({
  subjectName,
  chapterCount,
  notesCount,
  videoCount,
  onCancel,
  onConfirm,
  isEditMode,
  isLoading,
  progress, // New prop for progress tracking
}) => {

  return (
    <div className="absolute w-full h-full bg-black/80 backdrop-blur-sm overflow-hidden flex justify-center items-center z-[60] animate-fade-in">
      <div className="bg-brand-card p-8 rounded-2xl border border-brand-border shadow-2xl max-w-md w-full">
        <h3 className="text-xl font-bold text-brand-text-primary mb-4">
          {isEditMode ? "Update Subject?" : "Create Subject?"}
        </h3>
        <p className="text-brand-text-secondary mb-6">
          Please review the details below before {isEditMode ? "updating" : "creating"}.
        </p>

        <div className="bg-brand-bg p-4 rounded-lg mb-6 border border-brand-border">
          <div className="flex justify-between mb-2">
            <span className="text-brand-text-secondary">Name:</span>
            <span className="text-brand-text-primary font-medium">{subjectName}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-brand-text-secondary">Chapters:</span>
            <span className="text-brand-text-primary font-medium">{chapterCount}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-brand-text-secondary">Total Notes:</span>
            <span className="text-brand-text-primary font-medium">{notesCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-secondary">Total Videos:</span>
            <span className="text-brand-text-primary font-medium">{videoCount}</span>
          </div>
        </div>

        {isLoading && (
          <div className="mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-brand-text-primary">
                {progress?.type === "progress" 
                  ? `Encoding: ${progress.title}` 
                  : (progress?.message || "Preparing files...")}
              </span>
              {progress?.type === "progress" && (
                <span className="text-xs text-brand-text-secondary">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              )}
            </div>
            
            <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-300 ease-out"
                style={{ 
                  width: progress?.type === "progress" 
                    ? `${(progress.current / progress.total) * 100}%` 
                    : (progress?.message ? "100%" : "10%") 
                }}
              />
            </div>
            
            {progress?.type === "progress" && (
              <p className="text-[10px] text-brand-text-secondary mt-1 text-right">
                Chunk {progress.current} of {progress.total}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg text-brand-text-primary hover:bg-zinc-800 transition-colors ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2 ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
            {isLoading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update" : "Create")}
          </button>

        </div>
      </div>
    </div>
  );
};

export default ConfirmSubject;
