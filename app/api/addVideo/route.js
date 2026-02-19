import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { subjectId, chapterId, title, link } = body;

    if (!subjectId || !link) {
      return NextResponse.json({ error: "Subject ID and link are required" }, { status: 400 });
    }

    // Verify user owns this subject
    const { data: subject, error: subjectError } = await supabase
      .from("Subject")
      .select("subject_id")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Detect if it's a playlist URL
    const isPlaylist = link.includes("playlist?list=") || link.includes("&list=");
    const resourceType = isPlaylist ? "YouTube Playlist" : "YouTube Link";

    // Insert the resource
    const { data: resource, error: insertError } = await supabase
      .from("Resources")
      .insert([{
        subject_id: subjectId,
        chapter_id: chapterId || null,
        resource_type: resourceType,
        title: title || (isPlaylist ? "YouTube Playlist" : "Untitled Video"),
        link: link,
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      message: "Video added successfully",
      resource: {
        resource_id: resource.resource_id,
        resource_type: resource.resource_type,
        title: resource.title,
        link: resource.link,
      }
    });

  } catch (error) {
    console.error("Add Video Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
