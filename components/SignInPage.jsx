"use client";

import React from "react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-toastify";

const SignInPage = () => {
  const router = useRouter();
  const supabase = createClient();
  const [isLoginState, setisLoginState] = useState(true);

  const handleSubmit = async (e, email, password, name) => {
    e.preventDefault();
    const {data ,error} =
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

    const UserID = data.user.id
    if (error == null) {
      if (isLoginState == false) {
        const { data, error } = await supabase
          .from("User")
          .insert([
            {
              user_id: UserID,
              email: email,
              name: name,
            },
          ])
          .select();
        if (error) {
          toast.error(error.message);
        } 
      } else {
        const { data, error } = await supabase
          .from("User")
          .select("*")
          .eq("email", email)
          .single();
        if (error) {
          toast.error(error.message);
        } else {
          router.push(`/welcomeMessage?name=${data.name}&id=${data.user_id}`);
        }
      }
    } else {
      console.log(error.message);
      toast.error(error.message);
    }
  };

  const LoginForm = () => {
    const email = useRef(null);
    const password = useRef(null);

    return (
      <form className="flex flex-col w-full m-2">
        <span className="font-medium mb-2">Email</span>
        <input
          className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
          type="email"
          name="email"
          id="email"
          ref={email}
          placeholder="your.email@example.com"
        />
        <span className="font-medium mb-2">Password</span>
        <input
          className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
          type="password"
          name="password"
          id="password"
          ref={password}
          placeholder="********"
        />
        <button
          className="bg-white text-black font-medium h-13 rounded-xl mt-5"
          onClick={(e) => {
            e.preventDefault();
            handleSubmit(e, email.current.value, password.current.value);
          }}
        >
          Login
        </button>
      </form>
    );
  };

  const SignupForm = () => {
    const [passwordError, setPasswordError] = useState(null);
    const email = useRef(null);
    const password = useRef(null);
    const confirmPassword = useRef(null);
    const userName = useRef(null);

    return (
      <form className="flex flex-col w-full m-2">
        <span className="font-medium mb-2">Your Name</span>
        <input
          className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
          type="email"
          name="email"
          id="email"
          ref={userName}
          placeholder="E.g. John Snow"
        />
        <span className="font-medium mb-2">Email</span>
        <input
          className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
          type="email"
          name="email"
          id="email"
          ref={email}
          placeholder="your.email@example.com"
        />
        <span className="font-medium mb-2">Password</span>
        <input
          className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
          type="password"
          name="password"
          id="password"
          ref={password}
          placeholder="********"
        />
        <span className="font-medium mb-2">Confirm Password</span>
        <input
          className="w-full p-2 rounded-md bg-[rgb(25,25,25)] mb-4"
          type="password"
          name="conPassword"
          id="conPassword"
          ref={confirmPassword}
          placeholder="********"
        />
        <button
          type="submit"
          className="bg-white text-black font-medium h-13 rounded-xl mt-5"
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
          Sign Up
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

  return (
    <div className="contianer p-8 w-96 max-w-96 bg-[rgb(32,32,32)] rounded-xl text-white flex flex-col items-center shadow-2xl">
      <div className="message-text w-full flex flex-col items-center mb-10 ">
        <h1 className="title font-medium text-2xl p-2">AI Study Buddy</h1>
        <h3 className="subtitle font-light text-[rgb(155,154,151)] p-2">
          Your syllabus-aware study companion
        </h3>
      </div>

      <div className="options w-full h-12 flex justify-evenly items-center rounded-xl bg-[rgb(25,25,25)] font-medium relative">
        <button
          onClick={() => {
            setisLoginState(true);
          }}
          className={`w-39 h-10 rounded-md flex justify-center items-center bg-[${
            isLoginState == true ? "rgb(32,32,32)" : "rgb(25,25,25)"
          }]`}
        >
          Login
        </button>
        <button
          onClick={() => {
            setisLoginState(false);
          }}
          className={`w-39 h-10 rounded-md flex justify-center items-center bg-[${
            isLoginState == true ? "rgb(25,25,25)" : "rgb(32,32,32)"
          }]`}
        >
          Sign Up
        </button>
      </div>

      {isLoginState == true ? <LoginForm /> : <SignupForm />}
    </div>
  );
};

export default SignInPage;
