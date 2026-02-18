"use client";
import React from "react";
import { useRouter } from "next/navigation";

const RedirectButton = () => {

    const router = useRouter();

    const handleRedirect = () => {
        router.push(`/dashboard`)
    }

  return (
    <button className="text-black border border-white w-45 h-20 rounded-4xl bg-white font-medium animate-slide-up" onClick={handleRedirect}>
      Go to Dashboard
    </button>
  );
};

export default RedirectButton;
