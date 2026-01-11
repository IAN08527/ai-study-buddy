import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const deleteSubject = async (supabase, subjectID) => {
  const { data, error } = await supabase
    .from("Subject")
    .delete()
    .eq("subject_id", subjectID)
    .select("name");

  if (error != null) {
    throw Error(error.message);
  } else {
    console.log(data);
    return `${data[0].name} is deleted sucessfully`;
  }
};

export async function DELETE(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json(
      { error: "Unauthorized: Please log in to perform this action." },
      { status: 401 }
    );
  }

  try {
    const deletedSubject = deleteSubject(supabase, id);

    return NextResponse.json({
      message: deletedSubject,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
