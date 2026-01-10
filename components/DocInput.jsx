import React from "react";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

const DocInput = ({ Notes, onUpdate }) => {
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
      onUpdate(validPDFfiles);
    }
  };

  return (
    <div className="flex items-center justify-center w-full">
      <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-[rgb(51,51,51)] rounded-xl cursor-pointer mt-2 mb-5 hover:border-sky-500/50 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg
            className="w-10 h-10 mb-4 text-[rgb(155,154,151)]"
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

          <div className="text-center px-4">
            {fileNames.length > 0 ? (
              fileNames.map((file, index) => (
                <div key={index} className="font-normal text-sky-400 text-sm">
                  {file.name}
                </div>
              ))
            ) : (
              <>
                <p className="mb-2 text-sm text-[rgb(155,154,151)]">
                  <span className="font-semibold text-[rgb(155,154,151)]">
                    Click to upload syllabus
                  </span>
                </p>
                <p className="text-xs text-[rgb(155,154,151)] uppercase tracking-wider">
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
