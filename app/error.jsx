"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error("Global App Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center items-center text-brand-text-primary p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
            <svg
              className="w-10 h-10 text-rose-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Something went wrong!</h1>
          <p className="text-brand-text-secondary">
            An unexpected error occurred. Don't worry, your study materials are safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <button
            onClick={() => reset()}
            className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all duration-300"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-8 py-3 rounded-xl bg-brand-card text-brand-text-primary border border-brand-border hover:bg-zinc-800 transition-all duration-300 text-center"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
