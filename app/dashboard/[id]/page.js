import React from "react";
import SideBar from "@/components/SideBar";
import NavBar from "@/components/NavBar";
import Dashboard from "@/components/Dashboard";

const page = async ({ params }) => {
  const { id } = await params;

  return (
    <div className="grid grid-cols-[auto_1fr] bg-[rgb(25,25,25)]">
      <SideBar />
      <div className="not-sidebar">
        <NavBar />
        <Dashboard id={id}/>
      </div>
    </div>
  );
};

export default page;
