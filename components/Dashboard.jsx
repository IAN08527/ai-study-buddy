"use client";

import React from "react";
import { useState, useEffect } from "react";
import DeleteSubject from "./DeleteSubject";
import SubjectForm from "./SubjectForm";

const SubCard = ({
  subjectID,
  subName,
  chapterCount,
  notesCount,
  videoCount,
  handleSubjectForm,
  setShowDeleteDialog,
}) => {
  return (
    <div className="subject-card border border-[rgb(51,51,51)] w-80 h-58 p-6 pt-4 rounded-xl bg-[rgb(32,32,32)]">
      <h6 className="mb-4 text-xl h-14">{subName}</h6>
      <ul className="includList text-[rgb(155,154,151)] flex flex-col gap-2">
        <li className="flex gap-2 text-sm ">
          <img src="/chapter.svg" alt="chapter img" className="w-5" />
          <span>{chapterCount} Chapters</span>
        </li>
        <li className="flex gap-2 text-sm ">
          <img src="/document.svg" alt="document img" className="w-5" />
          <span>{notesCount} Notes Uploaded</span>
        </li>
        <li className="flex gap-2 text-sm ">
          <img src="/videos.svg" alt="videos img" className="w-5" />
          <span>{videoCount} Videos</span>
        </li>
      </ul>
      <div className="aciton-buttons flex justify-between mt-5">
        <button
          className="edit-button bg-[rgb(25,25,25)] w-30 h-8 flex justify-center items-center rounded-2xl cursor-pointer"
          onClick={handleSubjectForm}
        >
          <img src="/edit.svg" alt="editImage" />
        </button>
        <button
          className="delete bg-[rgb(25,25,25)] w-30 h-8 flex justify-center items-center rounded-2xl cursor-pointer"
          onClick={() => {
            setShowDeleteDialog(subjectID);
          }}
        >
          <img src="/delete.svg" alt="editImage" />
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ id }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectDetails, setSubjectDetails] = useState(null); // subject details for edit button
  const [allSubjectDetails, setAllSubjectDetails] = useState([]); // all subjects for dasboard

  useEffect(() => {
    refreshSubjects();
  }, []);

  useEffect(() => {
    console.log(allSubjectDetails);
  }, [allSubjectDetails]);

  const closeDeleteDialog = () => setShowDeleteDialog(null);

  const handleSubjectForm = (e) => {};

  const refreshSubjects = async () => {
    try {
      const reply = await fetch(`/api/getSubjects/${id}`);
      const response = await reply.json();
      if (reply.ok) {
        if (Array.isArray(response.data)) {
          setAllSubjectDetails(response.data || []);
        } else {
          console.log(response.data);
        }
      }
    } catch (error) {
      console.log(error.message);
    }
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
        <button
          className="add-button flex gap-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-500 font-medium cursor-pointer"
          onClick={() => {
            setShowSubjectForm(true);
          }}
        >
          <img src="/add.svg" alt="add button logo" />
          Add New Subject
        </button>
      </div>
      <div className="sub-card-Container mt-8 p-4 pr-0 flex flex-wrap gap-4  overflow-y-scroll custom-scrollbar w-full h-full content-start">
        {allSubjectDetails.map((subjectDetail, index) => {
          return (
            <SubCard
              key={subjectDetail.subjectID}
              subjectID={subjectDetail.subjectID}
              handleSubjectForm={handleSubjectForm}
              setShowDeleteDialog={setShowDeleteDialog}
              subName={subjectDetail.subjectName}
              chapterCount={subjectDetail.subjectChapterCount}
              notesCount={subjectDetail["Notes PDF"]}
              videoCount={subjectDetail["YouTube Link"]}
            />
          );
        })}
      </div>
      {showDeleteDialog != null ? (
        <DeleteSubject
          removeDialog={closeDeleteDialog}
          refreshFunction={refreshSubjects}
          subjectID={showDeleteDialog}
        />
      ) : (
        ""
      )}
      {showSubjectForm ? (
        <SubjectForm
          id={id}
          subDetails={subjectDetails}
          removeSubjectForm={() => {
            setShowSubjectForm(false);
          }}
          refreshFunction={refreshSubjects}
        />
      ) : (
        ""
      )}
    </div>
  );
};

export default Dashboard;
