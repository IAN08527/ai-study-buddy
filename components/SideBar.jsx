"use client";

import React from "react";
import { useState } from "react";

const SideBar = () => {
  const [sidebarClosed, SetsidebarClosed] = useState(false);

  const handleCollapse = () => {};

  const SubCard = () => {
    return (
      <li className={`flex items-center ${sidebarClosed?"ml-2.5":"ml-5"} transition-all duration-700`}>
        <div className={`indicator w-10 h-10 flex shrink-0 justify-center items-center rounded-4xl bg-[rgb(25,25,25)] mr-2 ${sidebarClosed?"":"ml-1"}`}>
          O
        </div>
        <span className="h-full flex items-center overflow-hidden w-full whitespace-nowrap">
          {sidebarClosed?"":"Operating System"}
        </span>
      </li>
    );
  };

  return (
    <aside
      className={`border h-screen ${
        sidebarClosed ? "w-15" : "w-[15vw] min-w-45"
      } bg-[rgb(32,32,32)] border-[rgb(51,51,51)] text-white flex flex-col items-center transition-all duration-700 overflow-hidden`}
    >
      <span className="w-full h-[7vh] flex items-center px-2 text-md justify-between mt-5 whitespace-nowrap">
        {sidebarClosed?"":"AI Study Buddy"}
        <button
          className="cover-wrapper hover:bg-[rgb(25,25,25)] w-10 h-10 flex items-center justify-center pl-2 rounded-2xl transition-"
          onClick={() => {
            SetsidebarClosed(!sidebarClosed);
          }}
        >
          <img
            src="/left-arrow.png"
            alt="collapse"
            width={25}
            className={`mr-2 ${sidebarClosed?"-scale-x-100":""} transition-all duration-700`}
          />
        </button>
      </span>
      <div className="subject-List flex flex-col items-center w-full">
        <span className="w-full py-5 px-4 text-xl flex gap-3 whitespace-nowrap">
          <img src="/subIcon.svg" alt="" /> {sidebarClosed?"":"My Subjects"}
        </span>
        <ul className="w-full flex flex-col gap-5 overflow-x-hidden custom-scrollbar overflow-y-scroll h-[calc(93vh-69px)]">
          <SubCard />
        </ul>
      </div>
    </aside>
  );
};

export default SideBar;
