import React from "react";
import { toast } from "react-toastify";

const YtInput = ({ YTLink, onUpdate }) => {
  const links = YTLink || [{ title: "", link: "" }];

  const handleChange = (updatedArray) => {
    onUpdate(updatedArray);
  };

  const addVideoLink = (e) => {
    e.preventDefault();
    const newList = [...links, { title: "", link: "" }];
    handleChange(newList);
  };

  const deleteVideoLink = (indexToRemove) => {
    const newList = links.filter((_, index) => index !== indexToRemove);
    handleChange(newList);
  };

  const handleInputChange = (index, field, value) => {
    const newList = [...links];
    if (field === "link" && isLinkValid(value)) {
      newList[index] = { ...newList[index], [field]: value };
      handleChange(newList);
    } else if (field === "title") {
      newList[index] = { ...newList[index], [field]: value };
      handleChange(newList);
    } else {
      toast.error(`${value} is not a valid YouTube link. Please use a standard watch or playlist URL.`);
    }

  };

  const isLinkValid = (link) => {
    if (!link) return true; // Don't show error if empty
    return (
      link.startsWith("https://youtu.be/") ||
      link.startsWith("https://www.youtube.com/watch") ||
      link.startsWith("https://youtube.com/playlist?")
    );
  };

  return (
    <div className="flex flex-col gap-3 bg-[rgb(32,32,32)] mt-2 mb-5 p-4 rounded-xl">
      {links.map((video, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 p-3 bg-[rgb(25,25,25)] border border-[rgb(51,51,51)] rounded-lg"
        >
          <div className="flex justify-between items-center">
            <span className="text-sm text-[rgb(155,154,151)] font-medium">
              Video {index + 1}
            </span>
            <button
              type="button"
              className="text-[rgb(155,154,151)] px-2 hover:text-rose-500 transition-colors"
              onClick={() => deleteVideoLink(index)}
            >
              ✕
            </button>
          </div>

          <input
            type="text"
            placeholder="Video Title"
            value={video.title || ""}
            onChange={(e) => handleInputChange(index, "title", e.target.value)}
            className="w-full bg-[rgb(18,18,18)] rounded-lg p-2 border border-[rgb(51,51,51)] text-white focus:outline-none focus:border-sky-500"
          />

          <input
            type="text"
            placeholder="https://youtube.com/..."
            value={video.link || ""}
            onChange={(e) => handleInputChange(index, "link", e.target.value)}
            className="w-full bg-[rgb(18,18,18)] rounded-lg p-2 border border-[rgb(51,51,51)] text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      ))}

      <button
        type="button"
        className="w-full bg-white text-black py-2 rounded-lg font-bold hover:bg-zinc-200 transition-colors mt-2"
        onClick={addVideoLink}
      >
        + Add Video Link
      </button>
    </div>
  );
};

export default YtInput;
