import React from "react";
import SideBar from "@/components/SideBar";
import NavBar from "@/components/NavBar";
import Dashboard from "@/components/Dashboard";
import { createClient } from "@/lib/supabase/server";

const page = async () => {
  const supabase = await createClient();
  const {
      data: { session },
    } = await supabase.auth.getSession();

  return (
    <div className="md:grid md:grid-cols-[auto_1fr] flex flex-col bg-brand-bg h-screen overflow-hidden relative">
      <SideBar />
      <div className="not-sidebar flex flex-col h-full overflow-hidden w-full relative z-0">
        <NavBar />
        <Dashboard id={session?.user?.id}/>
      </div>
    </div>
  );
};

export default page;
