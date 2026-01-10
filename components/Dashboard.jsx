"use client"

import React from "react";
import { useState } from "react";
import DeleteSubject from "./DeleteSubject";
import SubjectForm from "./SubjectForm";

const Dashboard = ({id}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [subjectDetails, setSubjectDetails] = useState(null)

  const changeDeleteDialog = () => setShowDeleteDialog(!showDeleteDialog)
  const removeSubjectForm = () => setShowSubjectForm(false)

  const handleSubjectForm = (e) => {
    const target = e.target;
    if(target.classList.contains('edit-button')){
      
    }
    setShowSubjectForm(true)
  }

  const SubCard = () => {
    return (
      <div className="subject-card border border-[rgb(51,51,51)] w-80 h-50 p-6 pt-4 rounded-xl bg-[rgb(32,32,32)]">
        <h6 className="mb-4 text-xl">Operating System</h6>
        <ul className="includList text-[rgb(155,154,151)] flex flex-col gap-2">
          <li className="flex gap-2 text-sm ">
            <img src="/chapter.svg" alt="chapter img" className="w-5" />
            <span>4 Chapters</span>
          </li>
          <li className="flex gap-2 text-sm ">
            <img src="/document.svg" alt="document img" className="w-5" />
            <span>2 Notes Uploaded</span>
          </li>
          <li className="flex gap-2 text-sm ">
            <img src="/videos.svg" alt="videos img" className="w-5" />
            <span>1 Videos</span>
          </li>
        </ul>
        <div className="aciton-buttons flex justify-between mt-5">
          <button className="edit-button bg-[rgb(25,25,25)] w-30 h-8 flex justify-center items-center rounded-2xl cursor-pointer" onClick={handleSubjectForm}>
            <img src="/edit.svg" alt="editImage" />
          </button>
          <button className="delete bg-[rgb(25,25,25)] w-30 h-8 flex justify-center items-center rounded-2xl cursor-pointer" onClick={()=>{setShowDeleteDialog(true)}}>
            <img src="/delete.svg" alt="editImage" />
          </button>
        </div>
      </div>
    );
  };

  return (
    
    <div className="dashboard py-8 px-6 text-white h-[93vh] grid grid-rows-[auto_1fr] relative">
      <div className="sub-nav flex justify-between items-center pr-10">
        <div className="heading">
          <h4 className="font-medium text-2xl">My Subjects</h4>
          <p className="text-[rgb(155,154,151)] text-sm">
            Manage your study metarials and track your progress
          </p>
        </div>
        <button className="add-button flex gap-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-500 font-medium cursor-pointer" onClick={handleSubjectForm}>
          <img src="/add.svg" alt="add button logo" />
          Add New Subject
        </button>
      </div>
      <div className="sub-card-Container mt-8 p-4 pr-0 flex flex-wrap gap-4  overflow-y-scroll custom-scrollbar w-full h-full content-start">
        <SubCard />
      </div>
      {showDeleteDialog?<DeleteSubject removeDialog={changeDeleteDialog}/>:""}
      {showSubjectForm?<SubjectForm id={id} subDetails ={subjectDetails} removeSubjectForm ={removeSubjectForm}/>:""}
    </div>
  );
};

export default Dashboard;
