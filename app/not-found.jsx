import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center items-center text-brand-text-primary p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Visual Element */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 bg-sky-500/20 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-6xl text-sky-500 font-bold">404</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Oops! Document Lost.</h1>
          <p className="text-brand-text-secondary text-lg">
            Even your AI Study Buddy couldn't find this page. It might have been deleted, or the URL might be incorrect.
          </p>
        </div>

        <div className="pt-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all duration-300 shadow-lg hover:shadow-white/10"
          >
            Go Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
