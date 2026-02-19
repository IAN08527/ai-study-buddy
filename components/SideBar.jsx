"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const SideBar = () => {
  const [sidebarClosed, SetsidebarClosed] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Check screen size
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) SetsidebarClosed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Fetch subjects
    fetchSubjects();

    // Listen for updates from other components
    const handleSubjectUpdate = () => fetchSubjects();
    window.addEventListener("subjectUpdated", handleSubjectUpdate);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("subjectUpdated", handleSubjectUpdate);
    };
  }, []);

  const fetchSubjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
      const reply = await fetch(`/api/getSubjects/${user.id}`);
      const response = await reply.json();
      if (reply.ok && Array.isArray(response.data)) {
        setSubjects(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch subjects for sidebar", error);
    }
  };

  const handleCollapse = () => {
    SetsidebarClosed(!sidebarClosed);
  };

  const SubCard = ({ name, subjectID }) => {
    return (
      <li
        className={`flex items-center ${sidebarClosed?"ml-2.5":"ml-5"} transition-all duration-300 hover:bg-white/10 p-2 rounded-lg cursor-pointer`}
        onClick={() => router.push(`/subject/${subjectID}`)}
      >
        <div className={`indicator w-10 h-10 flex shrink-0 justify-center items-center rounded-full bg-brand-bg mr-2 ${sidebarClosed?"":"ml-1"} border border-brand-border text-xs`}>
          {name.charAt(0).toUpperCase()}
        </div>
        <span className={`h-full flex items-center overflow-hidden w-full whitespace-nowrap text-sm ${sidebarClosed ? "opacity-0 w-0" : "opacity-100"} transition-all duration-300`}>
          {name}
        </span>
      </li>
    );
  };

  return (
    <aside
      className={`border-r border-brand-border h-screen ${
        sidebarClosed ? (isMobile ? "w-0 border-none" : "w-20") : "w-[240px]"
      } bg-brand-card text-brand-text-primary flex flex-col items-center transition-all duration-300 z-50 ${isMobile ? "absolute left-0 top-0 shadow-2xl" : "relative"}`}
    >
      <span className="w-full h-[7vh] flex items-center px-4 text-md justify-between mt-2 whitespace-nowrap overflow-hidden">
        <span className={`${sidebarClosed ? "opacity-0 hidden" : "opacity-100 flex"} font-bold transition-opacity duration-300`}>
            AI Study Buddy
        </span>
        
        {/* Mobile Toggle Button (outside if closed logic handled by parent padding or absolute?) 
            Actually, if w-0, this button is hidden. We need an external toggle for mobile.
            For now, we assume desktop-first or that on mobile user swipes (not implemented).
            We'll stick to simple desktop collapsing for MVP + simple mobile hidden.
        */}
        <button
          className="cover-wrapper hover:bg-brand-bg w-10 h-10 flex items-center justify-center rounded-xl transition-colors shrink-0"
          onClick={handleCollapse}
        >
          <img
            src="/left-arrow.png"
            alt="collapse"
            width={20}
            className={`${sidebarClosed?"rotate-180":""} transition-transform duration-300 filter`}
          />
        </button>
      </span>

      <div className={`subject-List flex flex-col items-center w-full mt-4 ${sidebarClosed && isMobile ? "hidden" : "flex"}`}>
        <span className={`w-full py-2 px-4 text-sm font-semibold flex gap-3 whitespace-nowrap text-brand-text-secondary ${sidebarClosed ? "justify-center" : ""}`}>
           {sidebarClosed ? <img src="/subIcon.svg" alt="" className="w-6 opacity-50"/> : "MY SUBJECTS"}
        </span>
        <ul className="w-full flex flex-col gap-2 overflow-x-hidden custom-scrollbar overflow-y-auto h-[calc(93vh-100px)] pt-2 pb-20">
            {subjects.map((sub) => (
                <SubCard key={sub.subjectID} name={sub.subjectName} subjectID={sub.subjectID} />
            ))}
            {subjects.length === 0 && !sidebarClosed && (
                <li className="text-xs text-center text-brand-text-secondary mt-5">No subjects yet</li>
            )}
        </ul>
      </div>
{/* 
      Mobile Overlay Toggle when closed? 
      Strictly, if it's w-0 on mobile, we can't open it. 
      We need a hamburger in NavBar to open it.
      For this step, we'll just keep it w-16 on mobile (icon only) or w-0.
      Let's keep it w-16 (collapsed) on mobile so it's usable.
*/}
    </aside>
  );
};

export default SideBar;
