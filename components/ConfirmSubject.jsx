import React from "react";

const ConfirmSubject = ({
  subjectName,
  chapterCount,
  notesCount,
  videoCount,
  onCancel,
  onConfirm,
  isEditMode,
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

        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-lg text-brand-text-primary hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 transition-colors"
          >
            {isEditMode ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmSubject;
