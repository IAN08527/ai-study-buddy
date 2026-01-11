import React from "react";
import { toast } from "react-toastify";

const DeleteSubject = ({ removeDialog ,refreshFunction ,subjectID}) => {

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
        removeDialog()
      }else{
        toast.error(result.message)
        removeDialog()
      }
    }
  };

  return (
    <div className="absolute w-full h-full bg-[#000000] opacity-85 overflow-hidden flex justify-center items-center">
      <div className="text-container">
        <h4>Are you sure you want to delete "Operating System"</h4>
        <div className="aciton-buttons flex justify-center gap-6 mt-5">
          <button
            className="edit bg-[rgb(25,25,25)] w-30 h-8 flex justify-center items-center rounded-2xl cursor-pointer"
            onClick={removeDialog}
          >
            No
          </button>
          <button
            className="delete bg-[rgb(25,25,25)] w-30 h-8 flex justify-center items-center rounded-2xl cursor-pointer"
            onClick={()=>{deleteSubject(subjectID)}}
          >
            <img src="/delete.svg" alt="editImage" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSubject;
