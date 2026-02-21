import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPdfForRag } from "@/lib/pdfProcessor";

function sendProgress(controller, encoder, data) {
  controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
}

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

  try {
    await processPdfForRag(supabase, buffer, resourceData.resource_id, file.name, onProgress);
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

export async function PUT(request) {
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
        const subjectID = formData.get("subjectID");
        const userID = session.user.id;

        if (!metadataString || !subjectID) throw new Error("Missing metadata or subject ID");
        const subjectData = JSON.parse(metadataString);

        // Re-attach files
        subjectData.FinalSubjectInfo.globalInfo.sSyllabus = formData.getAll("syllabus_files");
        subjectData.FinalSubjectInfo.subjectinfo.forEach((chapter, index) => {
          chapter.cNotes = formData.getAll(`chapter_${index}_files`);
        });

        const onProgress = (prog) => sendProgress(controller, encoder, prog);

        sendProgress(controller, encoder, { type: "status", message: "Updating subject record..." });
        
        // 1. Update Global Info
        await supabase
          .from("Subject")
          .update({ name: subjectData.FinalSubjectInfo.globalInfo.sName })
          .eq("subject_id", subjectID)
          .eq("user_id", userID);

        // 2. Global Resources
        for (const file of subjectData.FinalSubjectInfo.globalInfo.sSyllabus) {
          sendProgress(controller, encoder, { type: "status", message: `Processing ${file.name}...` });
          await addDocument(supabase, file, null, subjectID, onProgress);
        }

        for (const linkObject of subjectData.FinalSubjectInfo.globalInfo.sYTVideos) {
          if (linkObject.link && !linkObject.resource_id) {
            await addYoutubeLink(supabase, linkObject, null, subjectID);
          }
        }

        // 3. Chapters
        let chapterIndex = 1;
        for (const chapter of subjectData.FinalSubjectInfo.subjectinfo) {
          let currentChapterID = chapter.chapterID;
          if (!currentChapterID) {
            const { data } = await supabase.from("Chapter").insert([{
              user_id: userID, subject_id: subjectID, Chapter_name: chapter.cName, order_index: chapterIndex
            }]).select().single();
            currentChapterID = data.chapter_id;
          } else {
            await supabase.from("Chapter").update({
              Chapter_name: chapter.cName, order_index: chapterIndex
            }).eq("chapter_id", currentChapterID);
          }

          for (const file of chapter.cNotes) {
            sendProgress(controller, encoder, { type: "status", message: `Processing ${file.name}...` });
            await addDocument(supabase, file, currentChapterID, subjectID, onProgress);
          }

          for (const linkObject of chapter.cYoutubeLink) {
            if (linkObject.link && !linkObject.resource_id) {
              await addYoutubeLink(supabase, linkObject, currentChapterID, subjectID);
            }
          }
          chapterIndex++;
        }

        sendProgress(controller, encoder, { type: "done", message: `${subjectData.FinalSubjectInfo.globalInfo.sName} updated successfully!` });
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
