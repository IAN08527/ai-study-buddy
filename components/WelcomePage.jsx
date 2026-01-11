import React from "react";

const WelcomePage = ({userName}) => {
  return (
    <div className="font-light text-7xl text-white flex gap-4 animate-breathe-text not-sm:flex-col">
      <div>Welcome</div>
      <div className="font-medium">{userName}</div>
    </div>
  );
};

export default WelcomePage;
