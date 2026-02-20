import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPdfForRag } from "@/lib/pdfProcessor";

// Reusing helper functions from addSubject/route.js logic would be ideal, 
// but for now we'll duplicate or inline to keep it self-contained and modify for updates.

const addDocument = async (supabase, file, chapterId, subjectID) => {
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

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: resourceData, error: resourceEntryError } = await supabase.from("Resources").insert([
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

  // Process PDF for RAG (non-blocking)
  try {
    await processPdfForRag(supabase, buffer, resourceData.resource_id, file.name);
  } catch (ragError) {
    console.warn("RAG processing skipped:", ragError.message);
  }
};

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

// Main Update Function
const updateSubjectInDB = async (subjectData, subjectID, userID, supabase) => {
  // 1. Update Global Info (Name)
  const { error: updateError } = await supabase
    .from("Subject")
    .update({ name: subjectData.FinalSubjectInfo.globalInfo.sName })
    .eq("subject_id", subjectID)
    .eq("user_id", userID);

  if (updateError) throw updateError;

  // 2. Handle Global Resources (Syllabus & Videos)
  // For MVP: We only ADD new ones. We don't delete existing ones yet to avoid data loss complexity.
  // Ideally, we'd diff the lists.
  
  // Upload new Syllabus files
  for (const file of subjectData.FinalSubjectInfo.globalInfo.sSyllabus) {
    await addDocument(supabase, file, null, subjectID);
  }

  // Upload new YouTube Links
  for (const linkObject of subjectData.FinalSubjectInfo.globalInfo.sYTVideos) {
    if (linkObject.link && linkObject.link !== "") {
        // ONLY insert if it doesn't have a resource_id (meaning it's new)
        if (!linkObject.resource_id) {
            await addYoutubeLink(supabase, linkObject, null, subjectID);
        }
    }
  }

  // 3. Handle Chapters
  // MVP Strategy:
  // - If chapter exists (has ID): Update Name, Add new resources.
  // - If chapter is new (no ID): Create it.
  // - Deletion of chapters is handled by the DELETE API, not here.

  let chapterIndex = 1;
  for (const chapter of subjectData.FinalSubjectInfo.subjectinfo) {
     let currentChapterID = chapter.chapterID; // We need to ensure we pass this from frontend

     if (!currentChapterID) {
         // Create New Chapter
         const { data, error } = await supabase.from("Chapter").insert([{
             user_id: userID,
             subject_id: subjectID,
             Chapter_name: chapter.cName,
             order_index: chapterIndex
         }]).select();

         if (error) throw error;
         currentChapterID = data[0].chapter_id;
     } else {
         // Update Existing Chapter Name
         const { error } = await supabase.from("Chapter").update({
             Chapter_name: chapter.cName,
             order_index: chapterIndex
         }).eq("chapter_id", currentChapterID);
         
         if (error) throw error;
     }

     // Upload Resources for this Chapter (New ones only)
     for (const file of chapter.cNotes) {
        await addDocument(supabase, file, currentChapterID, subjectID);
     }

     for (const linkObject of chapter.cYoutubeLink) {
        if (linkObject.link && linkObject.link !== "") {
            // ONLY insert if it doesn't have a resource_id (meaning it's new)
            if (!linkObject.resource_id) {
                await addYoutubeLink(supabase, linkObject, currentChapterID, subjectID);
            }
        }
     }
     
     chapterIndex++;
  }
};

export async function PUT(request) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const metadataString = formData.get("metadata");
    const id = formData.get("id"); // This is User ID
    const subjectID = formData.get("subjectID"); // We need this for updates

    if (!metadataString || !subjectID) throw new Error("Missing metadata or subject ID");

    const subjectData = JSON.parse(metadataString);

    // Re-attach binary files
    const realFiles = formData.getAll("syllabus_files");
    const chapters = subjectData.FinalSubjectInfo.subjectinfo;
    
    // Global Syllabus
    if (subjectData?.FinalSubjectInfo?.globalInfo) {
      subjectData.FinalSubjectInfo.globalInfo.sSyllabus = realFiles;
    }

    // Chapter Notes
    chapters.forEach((chapter, index) => {
      const chapterFiles = formData.getAll(`chapter_${index}_files`);
      chapter.cNotes = chapterFiles;
    });

    await updateSubjectInDB(subjectData, subjectID, session.user.id, supabase);

    return NextResponse.json({
      message: `${subjectData.FinalSubjectInfo.globalInfo.sName} updated successfully!`,
    });

  } catch (err) {
    console.error("Update Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
