import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Fetch chat history for a subject
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subjectId } = await params;

    const { data: messages, error } = await supabase
      .from("Chat_history")
      .select("chat_id, message_role, message_text, created_at")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: messages || [] });

  } catch (error) {
    console.error("Chat History Fetch Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Clear chat history for a subject
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subjectId } = await params;

    const { error } = await supabase
      .from("Chat_history")
      .delete()
      .eq("subject_id", subjectId)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ message: "Chat history cleared" });

  } catch (error) {
    console.error("Chat History Delete Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
