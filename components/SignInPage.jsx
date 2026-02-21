"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-toastify";

const LoginForm = ({ handleSubmit, isLoading }) => {
  const email = useRef(null);
  const password = useRef(null);

  return (
    <form className="flex flex-col w-full m-2">
      <span className="font-medium mb-2 text-sm text-brand-text-secondary">Email</span>
      <input
        className="w-full p-2 rounded-md bg-brand-bg mb-4 border border-brand-border focus:border-sky-500 focus:outline-none transition-colors"
        type="email"
        name="email"
        id="email"
        ref={email}
        placeholder="your.email@example.com"
        disabled={isLoading}
      />
      <span className="font-medium mb-2">Password</span>
      <input
        className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
        type="password"
        name="password"
        id="password"
        ref={password}
        placeholder="********"
        disabled={isLoading}
      />
      <button
        disabled={isLoading}
        className={`bg-white text-black font-medium h-13 rounded-xl mt-5 flex items-center justify-center gap-2 transition-opacity ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-200"}`}
        onClick={(e) => {
          e.preventDefault();
          handleSubmit(e, email.current.value, password.current.value);
        }}
      >
        {isLoading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
        {isLoading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
};

const SignupForm = ({ handleSubmit, isLoading }) => {
  const [passwordError, setPasswordError] = useState(null);
  const email = useRef(null);
  const password = useRef(null);
  const confirmPassword = useRef(null);
  const userName = useRef(null);

  return (
    <form className="flex flex-col w-full m-2">
      <span className="font-medium mb-2">Your Name</span>
      <input
        className="w-full p-2 rounded-md bg-brand-bg mb-4 border border-brand-border focus:border-sky-500 focus:outline-none transition-colors"
        type="text"
        name="name"
        id="name"
        ref={userName}
        placeholder="E.g. John Snow"
        disabled={isLoading}
      />
      <span className="font-medium mb-2">Email</span>
      <input
        className="w-full p-2 rounded-md bg-brand-bg mb-4 border border-brand-border focus:border-sky-500 focus:outline-none transition-colors"
        type="email"
        name="email"
        id="email"
        ref={email}
        placeholder="your.email@example.com"
        disabled={isLoading}
      />
      <span className="font-medium mb-2">Password</span>
      <input
        className="w-full p-2 rounded-md bg-brand-bg mb-4 border border-brand-border focus:border-sky-500 focus:outline-none transition-colors"
        type="password"
        name="password"
        id="password"
        ref={password}
        placeholder="********"
        disabled={isLoading}
      />
      <span className="font-medium mb-2">Confirm Password</span>
      <input
        className="w-full p-2 rounded-md bg-brand-bg mb-4 border border-brand-border focus:border-sky-500 focus:outline-none transition-colors"
        type="password"
        name="conPassword"
        id="conPassword"
        ref={confirmPassword}
        placeholder="********"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className={`bg-white text-black font-medium h-13 rounded-xl mt-5 flex items-center justify-center gap-2 transition-opacity ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-200"}`}
        onClick={(e) => {
          e.preventDefault();
          if (password.current.value == confirmPassword.current.value) {
            setPasswordError(null);
            handleSubmit(
              e,
              email.current.value,
              password.current.value,
              userName.current.value
            );
          } else {
            setPasswordError(
              new Error("Password and Confirm password do not match")
            );
          }
        }}
      >
        {isLoading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
        {isLoading ? "Signing up..." : "Sign Up"}
      </button>


      {passwordError === null ? (
        ""
      ) : (
        <div className="message text-red-700">
          The password and confirm password do not match
        </div>
      )}
    </form>
  );
};

const SignInPage = () => {
  const router = useRouter();
  const supabase = createClient();
  const [isLoginState, setisLoginState] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkForPreviousLogin()
  }, []);

  const checkForPreviousLogin = async () => {
    // secure: verify with server to avoid redirect loops if local session is stale
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (user != null) {
      router.push(`/welcomeMessage`);
    }
  };

  const handleSubmit = async (e, email, password, name) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } =
      isLoginState === true
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: name,
              },
            },
          });
    const UserID = data?.user?.id;
    if (error == null) {
      if (isLoginState == false) {
        // [MODIFIED] Profile creation is now handled by the Supabase Database Trigger
        // derived from auth.users. This avoids RLS violations on signup.
        toast.success("Account created! Please check your email to confirm.");
      } else {
        const { data, error } = await supabase
          .from("User")
          .select("*")
          .eq("email", email)
          .single();
        if (error) {
          toast.error(`${error.message}. Please verify your credentials or try again later.`);
        } else {

          router.push(`/welcomeMessage`);
        }
      }
    } else {
      console.log(error.message);
      toast.error(`${error.message}. Please check your connection or try a different email.`);
    }

    setIsLoading(false);
  };


  return (
    <div className="contianer p-8 w-96 max-w-[90vw] bg-brand-card rounded-xl text-brand-text-primary flex flex-col items-center shadow-2xl border border-brand-border animate-fade-in">
      <div className="message-text w-full flex flex-col items-center mb-10 ">
        <h1 className="title font-medium text-2xl p-2 text-center">AI Study Buddy</h1>
        <h3 className="subtitle font-light text-brand-text-secondary p-2 text-center">
          Your syllabus-aware study companion
        </h3>
      </div>

      <div className="options w-full h-12 flex justify-evenly items-center rounded-xl bg-brand-bg font-medium relative border border-brand-border">
        <button
          onClick={() => {
            setisLoginState(true);
          }}
          className={`w-36 h-10 rounded-md flex justify-center items-center transition-colors ${
            isLoginState === true ? "bg-brand-card text-brand-text-primary" : "bg-transparent text-brand-text-secondary hover:text-white"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => {
            setisLoginState(false);
          }}
          className={`w-36 h-10 rounded-md flex justify-center items-center transition-colors ${
            isLoginState === false ? "bg-brand-card text-brand-text-primary" : "bg-transparent text-brand-text-secondary hover:text-white"
          }`}
        >
          Sign Up
        </button>
      </div>

      {isLoginState == true ? (
        <LoginForm handleSubmit={handleSubmit} isLoading={isLoading} />
      ) : (
        <SignupForm handleSubmit={handleSubmit} isLoading={isLoading} />
      )}

    </div>
  );
};

export default SignInPage;
