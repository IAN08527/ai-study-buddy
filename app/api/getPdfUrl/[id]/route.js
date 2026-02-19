import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params; // resource_id

    // 1. Look up the resource to get the storage path and type
    const { data: resource, error: resourceError } = await supabase
      .from("Resources")
      .select("resource_id, resource_type, title, link, subject_id")
      .eq("resource_id", id)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // 2. Verify the user owns this resource's subject
    const { data: subject, error: subjectError } = await supabase
      .from("Subject")
      .select("subject_id")
      .eq("subject_id", resource.subject_id)
      .eq("user_id", user.id)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    // 3. Determine the bucket based on resource type
    const bucket = resource.resource_type === "Syllabus PDF" ? "syllabus" : "user_notes";

    // 4. Generate a signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(resource.link, 3600); // 1 hour expiry

    if (signedUrlError) {
      throw new Error(`Failed to generate URL: ${signedUrlError.message}`);
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      title: resource.title,
      resourceType: resource.resource_type,
    });

  } catch (error) {
    console.error("PDF URL Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
