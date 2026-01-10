import React from "react";
import { useState, useEffect } from "react";
import DocInput from "./DocInput";
import YtInput from "./YtInput";
import { toast } from "react-toastify";

const ChaptersForm = ({
  Name,
  Notes,
  YTLink,
  index,
  showDelete,
  deleteFunction,
  onChange,
}) => {
  return (
    <div className="chapterDialogContainer text-gray-400 flex flex-col p-3 bg-[rgb(25,25,25)] rounded-xl mb-5 w-full">
      <div className="Chater-title grid grid-cols-[1fr_auto]">
        <input
          type="text"
          name="subjectName"
          id={index}
          placeholder={`Chapter ${index + 1} Name`}
          className="font-normal bg-[rgb(32,32,32)] rounded-lg p-2 px-4 border border-[rgb(51,51,51)] mt-2 mb-5"
          value={Name || ""}
          onChange={(e) => onChange(index, "cName", e.target.value)}
        />
        {showDelete ? (
          <button
            className="w-10 h-10 flex justify-center items-center mt-2  rounded-lg hover:bg-red-900 hover:text-black transition-all duration-300 mx-2"
            onClick={(e) => {
              e.preventDefault();
              deleteFunction(index);
            }}
          >
            X
          </button>
        ) : (
          ""
        )}
      </div>
      <span>Chapter {index + 1} Notes</span>
      <DocInput
        Notes={Notes}
        onUpdate={(newValue) => onChange(index, "cNotes", newValue)}
      />
      <span>Chapter {index + 1} Youtube Links</span>
      <YtInput
        YTLink={YTLink}
        onUpdate={(newValue) => onChange(index, "cYoutubeLink", newValue)}
      />
    </div>
  );
};

const SubjectForm = ({ id, subDetails, removeSubjectForm }) => {
  const [subjectDetails, setSubjectDetails] = useState([
    { cName: "", cNotes: [], cYoutubeLink: [{ title: "", link: "" }] },
  ]);
  const [globalDetials, setGlobalDetials] = useState({
    sName: "",
    sSyllabus: [],
    sYTVideos: [{ title: "", link: "" }],
  });

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

  const createSubject = async (e) => {
  e.preventDefault();
  const formData = new FormData();

  // 1. Wrap the data in the EXACT structure the backend expects
  const metadata = {
    FinalSubjectInfo: {
      globalInfo: {
        sName: globalDetials.sName,
        sYTVideos: globalDetials.sYTVideos,
        // We leave sSyllabus empty here because we append binary files separately
        sSyllabus: [] 
      },

      subjectinfo: subjectDetails.map(chapter => ({
      cName: chapter.cName,
      cYoutubeLink: chapter.cYoutubeLink,
      cNotes: [] // Do NOT stringify the File objects here
    }))
    }
  };

  formData.append("metadata", JSON.stringify(metadata));
  formData.append("id", id);

  // 2. Append the actual binary files
  globalDetials.sSyllabus.forEach((file) => {
    formData.append("syllabus_files", file);
  });

  subjectDetails.forEach((subject , index)=> {
    subject.cNotes.forEach((file)=>{
      formData.append(`chapter_${index}_files`,file)
    })
  })

  const response = await fetch("/api/addSubject", {
    method: "POST",
    body: formData, // Browser sets Content-Type automatically
  });
  
  const result = await response.json();
  if(response.ok){
    toast.success(result.message)
    removeSubjectForm()
  }else{
    toast.error(result.error)
  }
};

  return (
    <div className="absolute w-full h-full bg-[#000000]/35 overflow-hidden flex justify-center items-center">
      <div className="whole-form w-10/25 h-7/8 overflow-auto custom-scrollbar opactiy-100 min-w-170 p-5 bg-[rgb(32,32,32)] rounded-2xl">
        <div className="form-title flex justify-between">
          <div className="empty"></div>
          <h4 className="text-2xl font-medium">Create New Study Subejct</h4>
          <button
            className="text-xl text-[rgb(155,154,151)]"
            onClick={removeSubjectForm}
          >
            x
          </button>
        </div>
        <form className="SubjectDetails flex flex-col ">
          <span className="sub-name">Subject Name</span>
          <input
            type="text"
            name="subjectName"
            id="subName"
            placeholder="e.g. Advanced Operating System"
            className="font-normal bg-[rgb(25,25,25)] rounded-lg p-2 border border-[rgb(51,51,51)] mt-2 mb-5 w-full"
            value={globalDetials.sName || ""}
            onChange={(e) => {
              handleGlobalChange("sName", e.target.value);
            }}
          />
          <span className="subSyllabus">{`Upload Syllabus (Optional)`}</span>
          <DocInput
            Notes={globalDetials.sSyllabus}
            onUpdate={(newValue) => handleGlobalChange("sSyllabus", newValue)}
          />
          <span className="global-youtube">Global Youtube Links</span>
          <YtInput
            YTLink={globalDetials.sYTVideos}
            onUpdate={(newValue) => handleGlobalChange("sYTVideos", newValue)}
          />
          <span className="mb-4">CHAPTERS</span>
          {subjectDetails.map((data, index) => {
            return (
              <ChaptersForm
                key={index}
                Name={data.cName}
                Notes={data.cNotes}
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
            className="w-full bg-white text-black py-2 rounded-lg font-bold hover:bg-zinc-200 transition-colors mt-2"
            onClick={addChapter}
          >
            + Add Chapter
          </button>
          <button
            type="submit"
            className="w-full bg-white text-black py-2 rounded-lg font-bold hover:bg-zinc-200 transition-colors mt-2"
            onClick={createSubject}
          >
            Create Subject
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubjectForm;
