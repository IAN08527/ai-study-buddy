import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPdfForRag } from "@/lib/pdfProcessor";

// Helper for streaming
function sendProgress(controller, encoder, data) {
  controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
}

// 1. Helper to upload binary to Storage and record in Database
const addDocument = async (supabase, file, chapterId, subjectID, onProgress) => {
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

  // Process PDF for RAG
  try {
    await processPdfForRag(supabase, buffer, resourceData.resource_id, file.name, onProgress);
    return { title: file.name, status: "success" };
  } catch (ragError) {
    return { title: file.name, status: "partial", reason: ragError.message };
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

const addChapter = async (supabase, chapterDetails, subjectID, userID, chapterIndex, onProgress) => {
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

  if (error) throw error;

  const chapterID = data[0].chapter_id;
  const results = [];

  for (const file of chapterDetails.cNotes) {
    const res = await addDocument(supabase, file, chapterID, subjectID, onProgress);
    results.push(res);
  }

  for (const linkObject of chapterDetails.cYoutubeLink) {
    if (linkObject.link !== "") {
      await addYoutubeLink(supabase, linkObject, chapterID, subjectID);
    }
  }

  return results;
};

export async function POST(request) {
  const supabase = await createClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const metadataString = formData.get("metadata");
        const id = formData.get("id");

        if (!metadataString) throw new Error("Metadata is missing");
        const subjectData = JSON.parse(metadataString);

        // Re-attach binary files
        const syllabusFiles = formData.getAll("syllabus_files");
        subjectData.FinalSubjectInfo.globalInfo.sSyllabus = syllabusFiles;
        
        subjectData.FinalSubjectInfo.subjectinfo.forEach((chapter, index) => {
          chapter.cNotes = formData.getAll(`chapter_${index}_files`);
        });

        sendProgress(controller, encoder, { type: "status", message: "Creating subject..." });

        const { data: subData, error: subError } = await supabase
          .from("Subject")
          .insert([{ user_id: id, name: subjectData.FinalSubjectInfo.globalInfo.sName }])
          .select()
          .single();

        if (subError) throw subError;
        const newSubjectId = subData.subject_id;
        const ragStatus = [];

        const onProgress = (prog) => sendProgress(controller, encoder, prog);

        // Upload Syllabus
        for (const file of subjectData.FinalSubjectInfo.globalInfo.sSyllabus) {
          sendProgress(controller, encoder, { type: "status", message: `Processing ${file.name}...` });
          const res = await addDocument(supabase, file, null, newSubjectId, onProgress);
          ragStatus.push(res);
        }

        // YouTube
        for (const linkObject of subjectData.FinalSubjectInfo.globalInfo.sYTVideos) {
          if (linkObject.link !== "") await addYoutubeLink(supabase, linkObject, null, newSubjectId);
        }

        // Chapters
        let chapterIndex = 1;
        for (const chapter of subjectData.FinalSubjectInfo.subjectinfo) {
          sendProgress(controller, encoder, { type: "status", message: `Creating Chapter: ${chapter.cName}...` });
          const results = await addChapter(supabase, chapter, newSubjectId, id, chapterIndex, onProgress);
          ragStatus.push(...results);
          chapterIndex++;
        }

        const failedCount = ragStatus.filter(s => s.status !== "success").length;
        sendProgress(controller, encoder, {
          type: "done",
          message: `${subjectData.FinalSubjectInfo.globalInfo.sName} created successfully!`,
          warning: failedCount > 0 ? `${failedCount} document(s) failed vector processing.` : null
        });

        controller.close();
      } catch (err) {
        sendProgress(controller, encoder, { type: "error", error: err.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
  });
}
