import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/profile-image-comments?profile_id=xxx&image_url=xxx
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const imageUrl = req.nextUrl.searchParams.get("image_url");
  if (!profileId || !imageUrl) return NextResponse.json({ comments: [] });

  const { data, error } = await db
    .from("profile_image_comments")
    .select("id, author_id, text, created_at, profiles(display_name, avatar_url)")
    .eq("profile_id", profileId)
    .eq("image_url", imageUrl)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ comments: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = (data ?? []).map((row: any) => ({
    id: row.id as string,
    author_id: row.author_id as string,
    author_name: (Array.isArray(row.profiles) ? row.profiles[0]?.display_name : row.profiles?.display_name) ?? "Nutzer",
    author_avatar: (Array.isArray(row.profiles) ? row.profiles[0]?.avatar_url : row.profiles?.avatar_url) ?? null,
    text: row.text as string,
    created_at: row.created_at as string,
  }));

  return NextResponse.json({ comments });
}

// POST /api/profile-image-comments  { profile_id, image_url, text }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { profile_id, image_url, text } = await req.json().catch(() => ({}));
  if (!profile_id || !image_url || !text?.trim())
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 });

  const { data: inserted, error } = await db
    .from("profile_image_comments")
    .insert({ profile_id, image_url, author_id: userId, text: text.trim() })
    .select("id, author_id, text, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profile } = await db.from("profiles").select("display_name, avatar_url").eq("user_id", userId).maybeSingle();

  return NextResponse.json({
    comment: {
      id: inserted.id,
      author_id: inserted.author_id,
      author_name: profile?.display_name ?? "Du",
      author_avatar: profile?.avatar_url ?? null,
      text: inserted.text,
      created_at: inserted.created_at,
    },
  });
}
