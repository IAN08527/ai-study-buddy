import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PUT rename conversation
export async function PUT(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { conversationId } = await params;
    const body = await request.json();
    
    const { data: conversation, error } = await supabase
      .from("Conversations")
      .update({ title: body.title })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ conversation });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE conversation
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { conversationId } = await params;
    
    const { error } = await supabase
      .from("Conversations")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
