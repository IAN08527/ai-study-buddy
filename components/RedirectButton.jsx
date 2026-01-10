"use client";
import React from "react";
import { useRouter } from "next/navigation";

const RedirectButton = ({id}) => {

    const router = useRouter();

    const handleRedirect = () => {
        router.push(`/dashboard/${id}`)
    }

  return (
    <button className="border border-white w-45 h-20 rounded-4xl bg-white font-medium animate-slide-up" onClick={handleRedirect}>
      Go to Dashboard
    </button>
  );
};

export default RedirectButton;
