import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Opens a fresh whiteboard session. */
export default async function NewBoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/board");

  const { data, error } = await supabase.from("sessions").insert({ user_id: user.id, video_id: null }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't start a whiteboard session");
  redirect(`/board/${data.id}`);
}
