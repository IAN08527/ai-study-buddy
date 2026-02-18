import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const getAllSubjectDetails = async (supabase, id) => {
  try {
    const { data: subjectNameData, error: subjectNameError } = await supabase
      .from("Subject")
      .select(
        `
      subject_id,
      name,
      Chapter(count),
      Resources!Resources_subject_id_fkey(resource_type)
    `
      )
      .eq("user_id", id);

    if(subjectNameError!=null){
      throw Error(subjectNameError.message)
    }

    const finalSubjectDetails = subjectNameData.map((subject) => {
      const subjectName = subject.name;
      const subjectID = subject.subject_id;
      // Safety check for empty chapters array
      const subjectChapterCount = subject.Chapter?.[0]?.count || 0;

      const subjectResourcesCount = subject.Resources.reduce((acc, curr) => {
        const types = curr.resource_type;

        acc[types] = (acc[types] || 0) + 1;

        return acc;
      }, {});
      return {
        subjectName: subjectName,
        subjectID: subjectID,
        subjectChapterCount: subjectChapterCount,
        subjectResourcesCount: subjectResourcesCount,
      };
    });

    return finalSubjectDetails;
  } catch (error) {
    throw error;
  }
};

export async function GET(request, { params }) {
  try {
    // 1. VALIDATE SESSION
    const supabase = await createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    // Check if session exists or if there's an auth error
    if (authError || !session) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to perform this action." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const allSubjectDetails = await getAllSubjectDetails(supabase, id);

    return NextResponse.json({
      message: "Success getting details",
      data: allSubjectDetails,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
