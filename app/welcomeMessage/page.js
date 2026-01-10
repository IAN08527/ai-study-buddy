import React from "react";
import WelcomePage from "@/components/WelcomePage";
import RedirectButton from "@/components/RedirectButton";

const WelcomeMessage = async ({ searchParams }) => {
  const { name, id } = await searchParams;

  return (
    <div className="wrapper bg-[rgb(25,25,25)] w-screen h-screen flex justify-evenly items-center flex-col">
      <WelcomePage userName={name} />
      <RedirectButton id={id}/>
    </div>
  );
};

export default WelcomeMessage;
