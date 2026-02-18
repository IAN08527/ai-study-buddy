
import React from "react";
import WelcomePage from "@/components/WelcomePage";
import RedirectButton from "@/components/RedirectButton";
import { createClient } from "@/lib/supabase/server";

const WelcomeMessage = async () => {
  const supabase = await createClient();
    const {
        data: { session },
      } = await supabase.auth.getSession();

    // Fallback if session is missing (middleware should catch this, but safe to check)
    if (!session) return <div>Please log in</div>;

  return (
    <div className="wrapper bg-brand-bg w-screen h-screen flex justify-evenly items-center flex-col text-brand-text-primary">
      <WelcomePage userName={session.user.user_metadata.name || "User"} />
      <RedirectButton />
    </div>
  );
};

export default WelcomeMessage;
