import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// GET /api/profile-image-likes?profile_id=xxx
// Returns like count per image + which images the current user has liked
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

  const { userId } = await auth();

  const { data, error } = await db
    .from("profile_image_likes")
    .select("image_url, liker_id")
    .eq("profile_id", profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const likes: Record<string, number> = {};
  const myLikes: string[] = [];

  for (const row of data ?? []) {
    likes[row.image_url] = (likes[row.image_url] ?? 0) + 1;
    if (userId && row.liker_id === userId) myLikes.push(row.image_url);
  }

  return NextResponse.json({ likes, myLikes });
}

// POST /api/profile-image-likes  { profile_id, image_url }
// Toggles like — inserts if not liked, deletes if already liked
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { profile_id, image_url } = await req.json().catch(() => ({}));
  if (!profile_id || !image_url) return NextResponse.json({ error: "profile_id und image_url erforderlich" }, { status: 400 });
  if (profile_id === userId) return NextResponse.json({ error: "Eigene Fotos können nicht geliked werden" }, { status: 403 });

  const { data: existing } = await db
    .from("profile_image_likes")
    .select("id")
    .eq("liker_id", userId)
    .eq("image_url", image_url)
    .maybeSingle();

  if (existing) {
    await db.from("profile_image_likes").delete().eq("liker_id", userId).eq("image_url", image_url);
    revalidateTag("profile-image-likes", "profiles");
    return NextResponse.json({ liked: false });
  }

  const { error } = await db
    .from("profile_image_likes")
    .insert({ liker_id: userId, profile_id, image_url, rating: 1 });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify on first like
  try {
    const { data: liker } = await db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    const name = liker?.display_name ?? "Jemand";
    const { data: owner } = await db.from("profiles").select("slug").eq("user_id", profile_id).maybeSingle();
    await db.from("notifications").insert({
      user_id: profile_id,
      type: "review",
      title: "Foto geliked",
      body: `${name} hat eines deiner Fotos mit einem Herz versehen.`,
      href: `/profile/${owner?.slug ?? profile_id}`,
    });
  } catch { /* fire-and-forget */ }

  revalidateTag("profile-image-likes", "profiles");
  return NextResponse.json({ liked: true });
}
