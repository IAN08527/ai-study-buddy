import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET all conversations for a subject
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subjectId } = await params;
    const { data: conversations, error } = await supabase
      .from("Conversations")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create a new conversation
export async function POST(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subjectId } = await params;
    const body = await request.json();
    const title = body.title || "New Conversation";

    const { data: conversation, error } = await supabase
      .from("Conversations")
      .insert([{ subject_id: subjectId, user_id: user.id, title }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
