"use client";
import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

const NavBar = () => {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    console.log("log out activated");
    if (!error) {
      router.push("/");
      console.log("pushing Complete");
      window.localStorage.clear();
      window.sessionStorage.clear();
    } else {
      console.log(error);
      toast.error(`${error.message}. Please try signing out again or refresh the page.`);
    }

  };

  return (
    <nav className="border h-[7vh] bg-[rgb(32,32,32)] border-[rgb(51,51,51)] text-white flex justify-between px-6 md:px-10 items-center">
      <div className="flex items-center gap-4">
        <button 
          className="md:hidden p-2 hover:bg-brand-bg rounded-lg"
          onClick={() => window.dispatchEvent(new Event("toggleSidebar"))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <Link href={"/dashboard"} className="text-xl md:text-2xl font-semibold">
          Dashboard
        </Link>
      </div>
      <button
        className="flex items-center gap-2 mr-0 md:mr-4 hover:bg-[rgb(25,25,25)] rounded-2xl w-24 md:w-30 h-10 justify-center transition-colors px-2"

        onClick={handleLogout}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-log-out w-4 h-4 mr-2"
          aria-hidden="true"
        >
          <path d="m16 17 5-5-5-5"></path>
          <path d="M21 12H9"></path>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        </svg>
        Logout
      </button>
    </nav>
  );
};

export default NavBar;
