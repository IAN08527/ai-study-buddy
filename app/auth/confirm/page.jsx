import React from "react";
import Link from "next/link";

export default function ConfirmPage() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center items-center text-brand-text-primary p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
            <svg
              className="w-10 h-10 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Email Confirmed!</h1>
          <p className="text-brand-text-secondary text-lg">
            Your account has been successfully verified. You can now log in to start your study journey.
          </p>
        </div>

        <div className="pt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all duration-300"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    </div>
  );
}
