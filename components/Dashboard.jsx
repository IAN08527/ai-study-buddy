"use client";

import React from "react";
import { useState, useEffect } from "react";
import DeleteSubject from "./DeleteSubject";
import SubjectForm from "./SubjectForm";
import { toast } from "react-toastify";

const SubCard = ({
  subjectID,
  subName,
  chapterCount,
  notesCount,
  videoCount,
  handleSubjectEdit,
  setShowDeleteDialog,
}) => {
  return (
    <div className="subject-card border border-brand-border w-full h-auto min-h-[14rem] p-6 pt-4 rounded-xl bg-brand-card hover:border-sky-500/50 transition-all duration-300 animate-slide-up shadow-lg hover:shadow-sky-500/10">
      <h6 className="mb-4 text-xl h-14 font-semibold text-brand-text-primary line-clamp-2">{subName}</h6>
      <ul className="includList text-brand-text-secondary flex flex-col gap-2">
        <li className="flex gap-2 text-sm items-center">
          <img src="/chapter.svg" alt="chapter img" className="w-5 h-5 opacity-70" />
          <span>{chapterCount || 0} Chapters</span>
        </li>
        <li className="flex gap-2 text-sm items-center">
          <img src="/document.svg" alt="document img" className="w-5 h-5 opacity-70" />
          <span>{notesCount || 0} Notes Uploaded</span>
        </li>
        <li className="flex gap-2 text-sm items-center">
          <img src="/videos.svg" alt="videos img" className="w-5 h-5 opacity-70" />
          <span>{videoCount || 0} Videos</span>
        </li>
      </ul>
      <div className="aciton-buttons flex justify-between mt-5">
        <button
          className="edit-button bg-brand-bg hover:bg-zinc-800 w-12 h-8 flex justify-center items-center rounded-full cursor-pointer transition-colors"
          onClick={handleSubjectEdit}
          title="Edit Subject (Coming Soon)"
        >
          <img src="/edit.svg" alt="editImage" className="w-4 h-4" />
        </button>
        <button
          className="delete bg-brand-bg hover:bg-rose-900/50 w-12 h-8 flex justify-center items-center rounded-full cursor-pointer transition-colors"
          onClick={() => {
            setShowDeleteDialog({id:subjectID , name :subName});
          }}
          title="Delete Subject"
        >
          <img src="/delete.svg" alt="deleteImage" className="w-4 h-4" />
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

  const handleSubjectEdit = (e, subject) => {
    setSubjectDetails(subject);
    setShowSubjectForm(true);
  };

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
    <div className="dashboard py-8 px-6 text-brand-text-primary h-[93vh] grid grid-rows-[auto_1fr] relative">
      <div className="sub-nav flex justify-between items-center pr-10">
        <div className="heading">
          <h4 className="font-medium text-2xl animate-fade-in">My Subjects</h4>
          <p className="text-brand-text-secondary text-sm animate-fade-in delay-100">
            Manage your study materials and track your progress
          </p>
        </div>
        <button
          className="add-button flex gap-4 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 font-medium cursor-pointer transition-colors"
          onClick={() => {
            setShowSubjectForm(true);
          }}
        >
          <img src="/add.svg" alt="add button logo" />
          Add New Subject
        </button>
      </div>
      <div className="sub-card-Container mt-8 p-4 pr-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-scroll custom-scrollbar w-full h-full content-start">
        {allSubjectDetails.map((subjectDetail, index) => {
          return (
            <SubCard
              key={subjectDetail.subjectID}
              subjectID={subjectDetail.subjectID}
              handleSubjectEdit={(e) => handleSubjectEdit(e, subjectDetail)}
              setShowDeleteDialog={setShowDeleteDialog}
              subName={subjectDetail.subjectName}
              chapterCount={subjectDetail.subjectChapterCount}
              notesCount={subjectDetail.subjectResourcesCount["Notes PDF"]}
              videoCount={subjectDetail.subjectResourcesCount["YouTube Link"]}
            />
          );
        })}
      </div>
      {showDeleteDialog != null ? (
        <DeleteSubject
          removeDialog={closeDeleteDialog}
          refreshFunction={refreshSubjects}
          subjectID={showDeleteDialog.id}
          subjectName={showDeleteDialog.name}
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
