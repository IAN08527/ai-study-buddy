import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getFilesList(supabase, subjectID) {
  const { data: fetchData, error: fetchError } = await supabase
    .from("Resources")
    .select("link , chapter_id")
    .eq("subject_id", subjectID)
    .in("resource_type", ["Syllabus PDF", "Notes PDF"]);

  if (fetchError != null) {
    console.log(fetchError.message);
    throw Error(fetchError.message);
  } else {
    return fetchData;
  }
}

async function deleteFromBucket(bucketList, supabase, bucketName) {
  if (!bucketList || bucketList.length === 0) return "Success";
  const { data: deleteData, error: deleteError } = await supabase.storage
    .from(bucketName)
    .remove(bucketList);

  if (deleteError != null) {
    console.log(deleteError);
    throw Error(deleteError.message);
  } else {
    return "Success";
  }
}

async function deleteFiles(supabase, storageDocsList) {
  let notesBucketList = [];
  let syllabuBucketList = [];

  // Filtering all the entries
  storageDocsList.forEach((data) => {
    if (data.chapter_id == null) {
      syllabuBucketList.push(data.link);
    } else {
      notesBucketList.push(data.link);
    }
  });

  // Delete form both the buckets
  let user_notes_message = await deleteFromBucket(
    notesBucketList,
    supabase,
    "user_notes"
  );
  let syllabus_message = await deleteFromBucket(
    syllabuBucketList,
    supabase,
    "syllabus"
  );

  if (syllabus_message == "Success" && user_notes_message == "Success") {
    return "Success";
  }
}

const deleteSubject = async (supabase, subjectID) => {
  const storageDocsDetails = await getFilesList(supabase, subjectID);
  
  // Deleting the  subject
  const { data: deleteData, error: deleteError } = await supabase
    .from("Subject")
    .delete()
    .eq("subject_id", subjectID)
    .select("name");

  // Deleting files from the supabase storage
  const deleteFilesSucess = await deleteFiles(supabase, storageDocsDetails);

  if (deleteError != null) {
    throw Error(deleteError.message);
  } else {
    return `${deleteData[0].name} deleted sucessfully`;
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
      { status: 400 }
    );
  }

  try {
    const deletedSubject = await deleteSubject(supabase, id);

    return NextResponse.json({
      message: deletedSubject,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
