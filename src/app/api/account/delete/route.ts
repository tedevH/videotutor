import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const BUCKETS = ["frames", "materials", "homework"];

/**
 * Deletes the account for good. Rows cascade from auth.users; stored files are removed first,
 * since storage objects aren't tied to the user row.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });

  const db = createAdminClient();
  for (const bucket of BUCKETS) {
    const { data: folders } = await db.storage.from(bucket).list(user.id, { limit: 1000 });
    for (const folder of folders ?? []) {
      const { data: files } = await db.storage.from(bucket).list(`${user.id}/${folder.name}`, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${user.id}/${folder.name}/${f.name}`);
      if (paths.length) await db.storage.from(bucket).remove(paths);
    }
    await db.storage.from(bucket).remove([user.id]).catch(() => null);
  }

  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
