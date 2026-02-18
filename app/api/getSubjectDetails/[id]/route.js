import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params; // This is the Subject ID

    // 1. Fetch Subject & Global Resources
    // Explicitly name the foreign key relationship to avoid ambiguity
    const { data: subjectData, error: subjectError } = await supabase
      .from("Subject")
      .select(`
        subject_id,
        name,
        Resources!Resources_subject_id_fkey (resource_id, resource_type, title, link)
      `)
      .eq("subject_id", id)
      .eq("user_id", user.id)
      .single();

    if (subjectError) throw subjectError;

    // 2. Fetch Chapters & their Resources
    // We order by order_index to keep chapters in correct sequence
    const { data: chapterData, error: chapterError } = await supabase
      .from("Chapter")
      .select(`
        chapter_id,
        Chapter_name,
        order_index,
        Resources (resource_id, resource_type, title, link)
      `)
      .eq("subject_id", id)
      .order('order_index', { ascending: true });

    if (chapterError) throw chapterError;

    // 3. Structure the response for the frontend
    const globalSyllabus = subjectData.Resources.filter(r => r.resource_type === "Syllabus PDF");
    const globalVideos = subjectData.Resources.filter(r => r.resource_type === "YouTube Link");

    const chapters = chapterData.map(ch => ({
      chapterID: ch.chapter_id,
      cName: ch.Chapter_name,
      cNotes: ch.Resources.filter(r => r.resource_type === "Notes PDF" || r.resource_type === "PDF"),
      cYoutubeLink: ch.Resources.filter(r => r.resource_type === "YouTube Link"),
    }));

    return NextResponse.json({
      subjectName: subjectData.name,
      subjectID: subjectData.subject_id,
      globalSyllabus,
      globalVideos,
      chapters
    });

  } catch (error) {
    console.error("Fetch Details Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
