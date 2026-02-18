import React from "react";
import { toast } from "react-toastify";

const DeleteSubject = ({ removeDialog ,refreshFunction ,subjectID , subjectName}) => {

  const deleteSubject = async(subjectID) => {
    if(subjectID != null){
      const response = await fetch(`/api/deleteSubject/${subjectID}`,{
        method: "DELETE",
        headers: {
          'Content-Type' : 'application/json'
        }
      })
      const result = await response.json()

      if(response.ok){
        toast.success(result.message)
        refreshFunction()
        // Trigger global update for sidebar
        window.dispatchEvent(new Event("subjectUpdated"));
        removeDialog()
      }else{
        toast.error(result.message)
        removeDialog()
      }
    }
  };

  return (
    <div className="absolute w-full h-full bg-black/80 backdrop-blur-sm overflow-hidden flex justify-center items-center z-50 animate-fade-in">
      <div className="text-container bg-brand-card p-8 rounded-2xl border border-brand-border shadow-2xl">
        <h4 className="text-lg font-medium text-brand-text-primary mb-6">Are you sure you want to delete "{subjectName}"?</h4>
        <div className="aciton-buttons flex justify-center gap-6">
          <button
            className="edit bg-brand-bg hover:bg-zinc-700 w-32 h-10 flex justify-center items-center rounded-full cursor-pointer transition-colors text-brand-text-primary"
            onClick={removeDialog}
          >
            No
          </button>
          <button
            className="delete bg-brand-bg hover:bg-rose-900/50 w-32 h-10 flex justify-center items-center rounded-full cursor-pointer transition-colors border border-brand-border"
            onClick={()=>{deleteSubject(subjectID)}}
          >
            <img src="/delete.svg" alt="delete" className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSubject;
