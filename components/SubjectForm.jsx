import React, { useState, useEffect } from "react";
import DocInput from "./DocInput";
import YtInput from "./YtInput";
import ConfirmSubject from "./ConfirmSubject";
import { toast } from "react-toastify";

const ChaptersForm = ({
  Name,
  Notes,
  YTLink,
  index,
  showDelete,
  deleteFunction,
  onChange,
  existingNotes = [] 
}) => {
  return (
    <div className="chapterDialogContainer text-gray-400 flex flex-col p-3 bg-brand-card rounded-xl mb-5 w-full border border-brand-border">
      <div className="Chater-title grid grid-cols-[1fr_auto]">
        <input
          type="text"
          name="subjectName"
          id={index}
          placeholder={`Chapter ${index + 1} Name`}
          className="font-normal bg-brand-bg rounded-lg p-2 px-4 border border-brand-border mt-2 mb-5 text-brand-text-primary focus:outline-none focus:border-sky-500 transition-colors"
          value={Name || ""}
          onChange={(e) => onChange(index, "cName", e.target.value)}
        />
        {showDelete ? (
          <button
            className="w-10 h-10 flex justify-center items-center mt-2 rounded-lg hover:bg-red-900/50 hover:text-white transition-all duration-300 mx-2 text-brand-text-secondary"
            onClick={(e) => {
              e.preventDefault();
              deleteFunction(index);
            }}
          >
            ✕
          </button>
        ) : (
          ""
        )}
      </div>
      <span className="text-brand-text-secondary text-sm mb-1">Chapter {index + 1} Notes</span>
      <DocInput
        Notes={Notes}
        existingFiles={existingNotes} // Pass existing files here
        onUpdate={(newValue) => onChange(index, "cNotes", newValue)}
      />
      <span className="text-brand-text-secondary text-sm mb-1 mt-2">Chapter {index + 1} Youtube Links</span>
      <YtInput
        YTLink={YTLink}
        onUpdate={(newValue) => onChange(index, "cYoutubeLink", newValue)}
      />
    </div>
  );
};

const SubjectForm = ({ id, subDetails, removeSubjectForm, refreshFunction }) => {
  const [subjectDetails, setSubjectDetails] = useState([
    { cName: "", cNotes: [], cYoutubeLink: [{ title: "", link: "" }] },
  ]);
  const [globalDetials, setGlobalDetials] = useState({
    sName: "",
    sSyllabus: [],
    sYTVideos: [{ title: "", link: "" }],
    sExistingSyllabus: [], // Store server-side syllabus
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form for Edit Mode
  useEffect(() => {
    if (subDetails) {
      setIsEditMode(true);
      fetchSubjectDetails(subDetails.subjectID);
    }
  }, [subDetails]);

  const fetchSubjectDetails = async (subjectID) => {
      setIsLoading(true);
      try {
          const res = await fetch(`/api/getSubjectDetails/${subjectID}`);
          const data = await res.json();
          
          if (res.ok) {
              setGlobalDetials({
                  sName: data.subjectName,
                  sSyllabus: [], // New files are empty
                  sExistingSyllabus: data.globalSyllabus || [],
                  sYTVideos: data.globalVideos.length > 0 ? data.globalVideos : [{ title: "", link: "" }],
              });

              const mappedChapters = data.chapters.map(ch => ({
                  chapterID: ch.chapterID,
                  cName: ch.cName,
                  cNotes: [], // New files are empty
                  cExistingNotes: ch.cNotes || [], // Store server files
                  cYoutubeLink: ch.cYoutubeLink.length > 0 ? ch.cYoutubeLink : [{ title: "", link: "" }]
              }));

              if (mappedChapters.length > 0) {
                  setSubjectDetails(mappedChapters);
              }
          } else {
              toast.error("Failed to load subject details");
          }
      } catch (error) {
          console.error(error);
          toast.error("Error fetching details");
      } finally {
          setIsLoading(false);
      }
  }

  const addChapter = (e) => {
    e.preventDefault();
    setSubjectDetails([
      ...subjectDetails,
      { cName: "", cNotes: [], cYoutubeLink: [{ title: "", link: "" }] },
    ]);
  };

  const deleteChapter = (indexToRemove) => {
    const updatedSubjectDetails = subjectDetails.filter(
      (_, index) => index !== indexToRemove
    );
    setSubjectDetails(updatedSubjectDetails);
  };

  const handleChange = (index, field, value) => {
    setSubjectDetails((prev) => {
      const newDetails = [...prev];
      newDetails[index] = { ...newDetails[index], [field]: value };
      return newDetails;
    });
  };

  const handleGlobalChange = (field, value) => {
    setGlobalDetials((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitInit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  // ... (processSubmission remains largely the same, maybe updated for clarity)
  const processSubmission = async () => {
    const formData = new FormData();
    const endpoint = isEditMode ? "/api/updateSubject" : "/api/addSubject";
    const method = isEditMode ? "PUT" : "POST";

    // 1. Wrap the data
    const metadata = {
      FinalSubjectInfo: {
        globalInfo: {
          sName: globalDetials.sName,
          sYTVideos: globalDetials.sYTVideos,
          sSyllabus: [],
        },
        subjectinfo: subjectDetails.map((chapter) => ({
          cName: chapter.cName,
          cYoutubeLink: chapter.cYoutubeLink,
          cNotes: [],
          chapterID: chapter.chapterID // Pass ID for updates
        })),
      },
    };

    formData.append("metadata", JSON.stringify(metadata));
    formData.append("id", id);
    if (isEditMode) {
        formData.append("subjectID", subDetails.subjectID);
    }

    // 2. Append binary files
    globalDetials.sSyllabus.forEach((file) => {
      formData.append("syllabus_files", file);
    });

    subjectDetails.forEach((subject, index) => {
      subject.cNotes.forEach((file) => {
        formData.append(`chapter_${index}_files`, file);
      });
    });

    try {
      const response = await fetch(endpoint, {
        method: method,
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        refreshFunction();
        window.dispatchEvent(new Event("subjectUpdated"));
        removeSubjectForm();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred.");
    } finally {
        setShowConfirm(false);
    }
  };

  if (isLoading) {
      return (
        <div className="absolute w-full h-full bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="spinner text-white">Loading Subject Details...</div>
        </div>
      )
  }

  return (
    <>
      {showConfirm && (
        <ConfirmSubject
          subjectName={globalDetials.sName}
          chapterCount={subjectDetails.length}
          notesCount={subjectDetails.reduce((acc, curr) => acc + curr.cNotes.length + (curr.cExistingNotes?.length || 0), 0) + globalDetials.sSyllabus.length + (globalDetials.sExistingSyllabus?.length || 0)}
          videoCount={subjectDetails.reduce((acc, curr) => acc + curr.cYoutubeLink.filter(l=>l.link).length, 0) + globalDetials.sYTVideos.filter(l=>l.link).length}
          onCancel={() => setShowConfirm(false)}
          onConfirm={processSubmission}
          isEditMode={isEditMode}
        />
      )}
      
      <div className="absolute w-full h-full bg-black/50 backdrop-blur-sm overflow-hidden flex justify-center items-center z-50">
        <div className="whole-form w-11/12 md:w-3/4 max-w-4xl h-5/6 overflow-auto custom-scrollbar opacity-100 p-6 bg-brand-card rounded-2xl border border-brand-border shadow-2xl animate-fade-in">
          <div className="form-title flex justify-between items-center mb-6">
            <h4 className="text-2xl font-bold text-brand-text-primary">
              {isEditMode ? "Edit Subject" : "Create New Study Subject"}
            </h4>
            <button
              className="text-2xl text-brand-text-secondary hover:text-white transition-colors"
              onClick={removeSubjectForm}
            >
              ✕
            </button>
          </div>
          <form className="SubjectDetails flex flex-col gap-4">
            <div>
              <span className="sub-name text-brand-text-primary font-medium">Subject Name</span>
              <input
                type="text"
                name="subjectName"
                id="subName"
                placeholder="e.g. Advanced Operating System"
                className="font-normal bg-brand-bg rounded-lg p-3 border border-brand-border mt-2 w-full text-brand-text-primary focus:outline-none focus:border-sky-500 transition-colors"
                value={globalDetials.sName || ""}
                onChange={(e) => {
                  handleGlobalChange("sName", e.target.value);
                }}
              />
            </div>

            <div>
              <span className="subSyllabus text-brand-text-primary font-medium">{`Upload Syllabus (Optional)`}</span>
              <DocInput
                Notes={globalDetials.sSyllabus}
                existingFiles={globalDetials.sExistingSyllabus} // Pass Global Existing
                onUpdate={(newValue) => handleGlobalChange("sSyllabus", newValue)}
              />
            </div>

            <div>
              <span className="global-youtube text-brand-text-primary font-medium">Global Youtube Links</span>
              <YtInput
                YTLink={globalDetials.sYTVideos}
                onUpdate={(newValue) => handleGlobalChange("sYTVideos", newValue)}
              />
            </div>

            <div className="border-t border-brand-border my-2"></div>
            <span className="mb-2 text-xl font-bold text-brand-text-primary">CHAPTERS</span>

            {subjectDetails.map((data, index) => {
              return (
                <ChaptersForm
                  key={index}
                  Name={data.cName}
                  Notes={data.cNotes}
                  existingNotes={data.cExistingNotes} // Pass Chapter Existing
                  YTLink={data.cYoutubeLink}
                  index={index}
                  showDelete={subjectDetails.length > 1}
                  deleteFunction={deleteChapter}
                  onChange={handleChange}
                />
              );
            })}
            <button
              type="button"
              className="w-full bg-brand-bg text-brand-text-primary border border-brand-border py-3 rounded-lg font-bold hover:bg-brand-border transition-colors mt-2"
              onClick={addChapter}
            >
              + Add Chapter
            </button>
            <button
              type="submit"
              className="w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors mt-4 mb-2"
              onClick={handleSubmitInit}
            >
              {isEditMode ? "Update Subject" : "Create Subject"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default SubjectForm;
