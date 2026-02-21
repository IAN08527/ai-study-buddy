"use client";

import React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  onCardClick,
}) => {
  return (
    <div className="subject-card border border-brand-border w-full max-w-md mx-auto sm:max-w-none h-auto min-h-[14rem] p-6 pt-4 rounded-xl bg-brand-card hover:border-sky-500/50 transition-all duration-300 animate-slide-up shadow-lg hover:shadow-sky-500/10 cursor-pointer flex flex-col" onClick={onCardClick}>
      <h6 className="mb-4 text-xl min-h-[3.5rem] font-semibold text-brand-text-primary line-clamp-2">{subName}</h6>
      <ul className="includList text-brand-text-secondary flex flex-col gap-3 flex-1">
        <li className="flex gap-3 text-sm items-center">
          <img src="/chapter.svg" alt="chapter img" className="w-5 h-5 opacity-70" />
          <span>{chapterCount || 0} Chapters</span>
        </li>
        <li className="flex gap-3 text-sm items-center">
          <img src="/document.svg" alt="document img" className="w-5 h-5 opacity-70" />
          <span>{notesCount || 0} Notes Uploaded</span>
        </li>
        <li className="flex gap-3 text-sm items-center">
          <img src="/videos.svg" alt="videos img" className="w-5 h-5 opacity-70" />
          <span>{videoCount || 0} Videos</span>
        </li>
      </ul>
      <div className="aciton-buttons flex justify-between items-center mt-6 pt-4 border-t border-brand-border/30">
        <button
          className="edit-button bg-brand-bg hover:bg-zinc-800 w-10 h-10 flex justify-center items-center rounded-full cursor-pointer transition-colors"
          onClick={(e) => { e.stopPropagation(); handleSubjectEdit(e); }}
          title="Edit Subject"
        >
          <img src="/edit.svg" alt="editImage" className="w-4 h-4" />
        </button>
        <button
          className="delete bg-brand-bg hover:bg-rose-900/40 w-10 h-10 flex justify-center items-center rounded-full cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
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
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectDetails, setSubjectDetails] = useState(null); // subject details for edit button
  const [allSubjectDetails, setAllSubjectDetails] = useState([]); // all subjects for dasboard
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/user");
        const json = res.ok ? await res.json() : null;
        const user = json?.data?.user || json?.user;

        if (user?.email) {
          setUserEmail(user.email);
        } else {
          // Fallback to client-side
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: { user: clientUser } } = await supabase.auth.getUser();
          if (clientUser?.email) setUserEmail(clientUser.email);
        }
      } catch (err) {
        console.warn("API user fetch failed, trying client-side fallback...");
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user: clientUser } } = await supabase.auth.getUser();
        if (clientUser?.email) setUserEmail(clientUser.email);
      }
    };
    fetchUser();
    refreshSubjects();
  }, []);

  useEffect(() => {
    // Subjects loaded
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
        }
      }
    } catch (error) {
      console.log(error.message);
      toast.error("Failed to refresh subjects. Please check your connection or try refreshing the page.");
    }

  };

  return (
    <div className="dashboard py-8 px-4 sm:px-6 text-brand-text-primary h-full overflow-hidden flex flex-col relative">
      <div className="sub-nav flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:pr-10 mb-8">
        <div className="heading">
          <h4 className="font-medium text-2xl animate-fade-in">My Subjects</h4>
          <p className="text-brand-text-secondary text-sm animate-fade-in delay-100 italic mb-1">
            {userEmail || "Loading user info..."}
          </p>
          <p className="text-brand-text-secondary text-sm animate-fade-in delay-100">
            Manage your study materials and track your progress
          </p>
        </div>
        <button
          className="add-button flex items-center gap-3 p-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 font-medium cursor-pointer transition-colors whitespace-nowrap w-full sm:w-auto justify-center"
          onClick={() => {
            setShowSubjectForm(true);
          }}
        >
          <img src="/add.svg" alt="add button logo" className="w-5 h-5" />
          <span>Add New Subject</span>
        </button>
      </div>
      <div className="sub-card-Container p-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar w-full flex-1 content-start">
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
              onCardClick={() => router.push(`/subject/${subjectDetail.subjectID}`)}
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
