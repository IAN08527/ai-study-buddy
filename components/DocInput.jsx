import React from "react";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

const DocInput = ({ Notes, onUpdate, existingFiles = [] }) => {
  const fileNames = Notes || [];

  const validateDocuments = (fileArray) => {
    const results = {
      valid: [],
      invalid: [],
    };

    fileArray.forEach((file) => {
      // Check for standard PDF MIME type
      if (file.type === "application/pdf") {
        results.valid.push(file);
      } else {
        results.invalid.push({
          name: file.name,
          reason: "Not a PDF",
        });
        toast.error(`${file.name} is not a PDF`)
      }
    });

    return results.valid;
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      let validPDFfiles = validateDocuments(files);
      // Merge with existing new uploads
      onUpdate([...fileNames, ...validPDFfiles]);
    }
  };

  const removeNewFile = (index) => {
      const updated = fileNames.filter((_, i) => i !== index);
      onUpdate(updated);
  }

  return (
    <div className="flex items-center justify-center w-full">
      <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-brand-border rounded-xl cursor-pointer mt-2 mb-5 hover:border-sky-500/50 transition-colors bg-[rgb(32,32,32)]">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg
            className="w-10 h-10 mb-4 text-brand-text-secondary"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 16"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
            />
          </svg>

          <div className="text-center px-4 w-full">
            {/* Display Existing Files (Server-side) */}
            {existingFiles.length > 0 && (
                <div className="mb-2 w-full">
                    <p className="text-xs text-brand-text-secondary uppercase mb-1">Saved Files:</p>
                    {existingFiles.map((file, index) => (
                        <div key={`existing-${index}`} className="font-normal text-sky-400 text-sm bg-black/20 p-1 rounded mb-1 flex justify-between items-center">
                            <span>{file.title || file.name}</span>
                            {/* We can add delete logic for existing files later */}
                        </div>
                    ))}
                </div>
            )}

            {/* Display New Pending Uploads */}
            {fileNames.length > 0 && (
               <div className="w-full">
                   <p className="text-xs text-brand-text-secondary uppercase mb-1">New Uploads:</p>
                   {fileNames.map((file, index) => (
                    <div key={index} className="font-normal text-green-400 text-sm flex justify-between items-center bg-black/20 p-1 rounded mb-1">
                      <span>{file.name}</span>
                      <button 
                        onClick={(e) => {
                            e.preventDefault(); 
                            removeNewFile(index);
                        }}
                        className="text-red-400 hover:text-red-200 px-2"
                      >✕</button>
                    </div>
                  ))}
               </div>
            )}
            
            {fileNames.length === 0 && existingFiles.length === 0 && (
              <>
                <p className="mb-2 text-sm text-brand-text-secondary">
                  <span className="font-semibold">
                    Click to upload
                  </span>
                </p>
                <p className="text-xs text-brand-text-secondary uppercase tracking-wider">
                  (PDF)
                </p>
              </>
            )}
          </div>
        </div>

        <input
          type="file"
          className="hidden"
          accept=".pdf"
          onChange={handleFileChange}
          multiple
        />
      </label>
    </div>
  );
};

export default DocInput;
