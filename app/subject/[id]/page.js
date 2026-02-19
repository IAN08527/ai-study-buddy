import React from "react";
import SubjectPage from "@/components/subject/SubjectPage";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SubjectPageRoute = async ({ params }) => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { id } = await params;

  return (
    <div className="bg-brand-bg h-screen overflow-hidden">
      <SubjectPage subjectId={id} />
    </div>
  );
};

export default SubjectPageRoute;
