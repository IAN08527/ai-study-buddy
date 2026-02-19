import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params; // resource_id

    // 1. Fetch the resource to verify it exists and get subject_id
    const { data: resource, error: fetchError } = await supabase
      .from("Resources")
      .select("resource_id, subject_id, resource_type")
      .eq("resource_id", id)
      .single();

    if (fetchError || !resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // 2. Verify user owns the subject
    const { data: subject, error: subjectError } = await supabase
      .from("Subject")
      .select("subject_id")
      .eq("subject_id", resource.subject_id)
      .eq("user_id", user.id)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    // 3. Only allow deleting YouTube resources
    if (resource.resource_type !== "YouTube Link" && resource.resource_type !== "YouTube Playlist") {
      return NextResponse.json({ error: "This endpoint only deletes video resources" }, { status: 400 });
    }

    // 4. Delete the resource
    const { error: deleteError } = await supabase
      .from("Resources")
      .delete()
      .eq("resource_id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ message: "Video deleted successfully" });

  } catch (error) {
    console.error("Delete Video Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
