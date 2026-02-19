import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPdfForRag } from "@/lib/pdfProcessor";

// 1. Helper to upload binary to Storage and record in Database
const addDocument = async (supabase, file, chapterId, subjectID) => {
  // Convert File to Buffer for server-side processing
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const bucket = chapterId == null ? "syllabus" : "user_notes";
  const filePath = `${Date.now()}_${file.name}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      duplex: "half",
    });

  if (uploadError)
    throw new Error(`Storage upload failed: ${uploadError.message}`);

  // Insert link into Resources table
  const { data: resourceData, error: resourceEntryError } = await supabase
    .from("Resources")
    .insert([
      {
        chapter_id: chapterId,
        resource_type: chapterId == null ? "Syllabus PDF" : "Notes PDF",
        title: file.name,
        link: uploadData.path,
        subject_id: subjectID,
      },
    ])
    .select("resource_id")
    .single();

  if (resourceEntryError) throw resourceEntryError;

  // Process PDF for RAG (non-blocking: don't fail subject creation if Ollama is down)
  try {
    await processPdfForRag(supabase, buffer, resourceData.resource_id, file.name);
  } catch (ragError) {
    console.warn("RAG processing skipped:", ragError.message);
  }
};

// 2. Helper to save YouTube links
const addYoutubeLink = async (supabase, linkObject, chapterId, subjectID) => {
  const { error } = await supabase.from("Resources").insert([
    {
      chapter_id: chapterId,
      resource_type: "YouTube Link",
      title: linkObject.title,
      link: linkObject.link,
      subject_id: subjectID,
    },
  ]);

  if (error) throw new Error("Failed to save Youtube link");
};

const addChapter = async (
  supabase,
  chapterDetails,
  subjectID,
  userID,
  chapterIndex
) => {
  const { data, error } = await supabase
    .from("Chapter")
    .insert([
      {
        user_id: userID,
        subject_id: subjectID,
        Chapter_name: chapterDetails.cName,
        order_index: chapterIndex,
      },
    ])
    .select();

  if (error) {
    console.error("Insert Error:", error.message);
    return;
  }

  const chapterID = data[0].chapter_id;

  // Upload all the documents of the subject
  for (const file of chapterDetails.cNotes) {
    await addDocument(supabase, file, chapterID, subjectID);
  }

  // Upload all the Youtube videos of the subjects
  for (const linkObject of chapterDetails.cYoutubeLink) {
    if (linkObject.link == "") {
      continue;
    } else {
      await addYoutubeLink(supabase, linkObject, chapterID, subjectID);
    }
  }

  if (error) throw new Error("Failed to create Chapter");
};

// 3. Main function to create Subject and trigger uploads
const addsubjectToDB = async (subjectData, id, supabase) => {
  const { data, error } = await supabase
    .from("Subject")
    .insert([
      {
        user_id: id,
        name: subjectData.FinalSubjectInfo.globalInfo.sName,
      },
    ])
    .select(); // Essential to get the new subject ID back

  if (error) throw error;

  // IMPORTANT: Supabase usually returns 'id'. Check if your column is named 'id' or 'subject_id'
  const newSubjectId = data[0].subject_id;

  /// UPLOADING GLOBAL INFO
  // Uploading Syllabus (MUST AWAIT THESE)
  for (const file of subjectData.FinalSubjectInfo.globalInfo.sSyllabus) {
    await addDocument(supabase, file, null, newSubjectId);
  }
  // Uploading YouTube Links (MUST AWAIT THESE)
  for (const linkObject of subjectData.FinalSubjectInfo.globalInfo.sYTVideos) {
    if (linkObject.link == "") {
      continue;
    } else {
      await addYoutubeLink(supabase, linkObject, null, newSubjectId);
    }
  }

  /// UPLOADING CHAPTERWISE INFO
  let chapterIndex = 1;
  for (const chapter of subjectData.FinalSubjectInfo.subjectinfo) {
    await addChapter(supabase, chapter, newSubjectId, id, chapterIndex);
    chapterIndex++;
  }
};

/// The actual POST request
export async function POST(request) {
  // 1. VALIDATE SESSION
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  // Check if session exists or if there's an auth error
  if (authError || !session) {
    return NextResponse.json(
      { error: "Unauthorized: Please log in to perform this action." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const metadataString = formData.get("metadata");
    const id = formData.get("id");

    if (!metadataString) throw new Error("Metadata is missing");

    // 1. Parse the text structure
    const subjectData = JSON.parse(metadataString);

    // 2. RE-ATTACH BINARY FILES TO THE DEEP PATH
    // This is where the 'undefined' error usually starts
    const realFiles = formData.getAll("syllabus_files");
    const chapters = subjectData.FinalSubjectInfo.subjectinfo;
    chapters.forEach((chapter, index) => {
      // Look for the specific key you appended on the frontend: "chapter_N_files"
      const chapterFiles = formData.getAll(`chapter_${index}_files`);
      chapter.cNotes = chapterFiles;
    });

    // Safety check: ensure the path exists before assigning
    if (subjectData?.FinalSubjectInfo?.globalInfo) {
      subjectData.FinalSubjectInfo.globalInfo.sSyllabus = realFiles;
    } else {
      throw new Error("Invalid metadata structure received");
    }


    // 3. Call the DB function with the correctly formatted object
    await addsubjectToDB(subjectData, id, supabase);

    return NextResponse.json({
      message: `${subjectData.FinalSubjectInfo.globalInfo.sName} created sucessfully !!!`,
    });
  } catch (err) {
    console.error("Critical Server Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
