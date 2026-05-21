import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// GET /api/profile-image-likes?profile_id=xxx
// Returns like counts + which ones the current user liked
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

  const { userId } = await auth();

  const { data, error } = await db
    .from("profile_image_likes")
    .select("image_url, liker_id")
    .eq("profile_id", profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const liked = new Set<string>();
  for (const row of data ?? []) {
    counts[row.image_url] = (counts[row.image_url] ?? 0) + 1;
    if (userId && row.liker_id === userId) liked.add(row.image_url);
  }

  return NextResponse.json({ counts, liked: [...liked] });
}

// POST /api/profile-image-likes  { profile_id, image_url }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { profile_id, image_url } = await req.json().catch(() => ({}));
  if (!profile_id || !image_url) return NextResponse.json({ error: "profile_id und image_url erforderlich" }, { status: 400 });

  if (profile_id === userId) return NextResponse.json({ error: "Eigene Fotos können nicht geliked werden" }, { status: 403 });

  const { error } = await db.from("profile_image_likes").insert({ liker_id: userId, profile_id, image_url });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateTag("profile-image-likes", "profiles");
  return NextResponse.json({ success: true });
}

// DELETE /api/profile-image-likes  { profile_id, image_url }
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { image_url } = await req.json().catch(() => ({}));
  if (!image_url) return NextResponse.json({ error: "image_url erforderlich" }, { status: 400 });

  await db.from("profile_image_likes").delete().eq("liker_id", userId).eq("image_url", image_url);

  revalidateTag("profile-image-likes", "profiles");
  return NextResponse.json({ success: true });
}
