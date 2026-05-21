import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// GET /api/profile-image-likes?profile_id=xxx
// Returns avg rating + count per image, plus current user's own ratings
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

  const { userId } = await auth();

  const { data, error } = await db
    .from("profile_image_likes")
    .select("image_url, liker_id, rating")
    .eq("profile_id", profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const agg: Record<string, { sum: number; count: number }> = {};
  const myRatings: Record<string, number> = {};

  for (const row of data ?? []) {
    if (!agg[row.image_url]) agg[row.image_url] = { sum: 0, count: 0 };
    agg[row.image_url].sum += row.rating ?? 1;
    agg[row.image_url].count += 1;
    if (userId && row.liker_id === userId) myRatings[row.image_url] = row.rating ?? 1;
  }

  const ratings: Record<string, { avg: number; count: number }> = {};
  for (const [url, { sum, count }] of Object.entries(agg)) {
    ratings[url] = { avg: Math.round((sum / count) * 10) / 10, count };
  }

  return NextResponse.json({ ratings, myRatings });
}

// POST /api/profile-image-likes  { profile_id, image_url, rating: 1-5 }
// Upserts — updates existing rating if user rated this image before
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { profile_id, image_url, rating } = await req.json().catch(() => ({}));
  if (!profile_id || !image_url) return NextResponse.json({ error: "profile_id und image_url erforderlich" }, { status: 400 });
  if (profile_id === userId) return NextResponse.json({ error: "Eigene Fotos können nicht bewertet werden" }, { status: 403 });

  const r = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

  // Check BEFORE upsert whether this is a new rating or an update
  const { data: existing } = await db
    .from("profile_image_likes")
    .select("id")
    .eq("liker_id", userId)
    .eq("image_url", image_url)
    .maybeSingle();
  const isNew = !existing;

  const { error } = await db
    .from("profile_image_likes")
    .upsert(
      { liker_id: userId, profile_id, image_url, rating: r },
      { onConflict: "liker_id,image_url" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify profile owner only on first rating (not on updates)
  if (isNew) {
    try {
      const { data: liker } = await db.from("profiles").select("display_name, slug").eq("user_id", userId).maybeSingle();
      const name = liker?.display_name ?? "Jemand";
      const { data: owner } = await db.from("profiles").select("slug").eq("user_id", profile_id).maybeSingle();
      await db.from("notifications").insert({
        user_id: profile_id,
        type: "review",
        title: "Foto bewertet",
        body: `${name} hat eines deiner Fotos mit ${r} Stern${r !== 1 ? "en" : ""} bewertet.`,
        href: `/profile/${owner?.slug ?? profile_id}`,
      });
    } catch { /* fire-and-forget */ }
  }

  revalidateTag("profile-image-likes", "profiles");
  return NextResponse.json({ success: true });
}

// DELETE /api/profile-image-likes  { image_url }
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { image_url } = await req.json().catch(() => ({}));
  if (!image_url) return NextResponse.json({ error: "image_url erforderlich" }, { status: 400 });

  await db.from("profile_image_likes").delete().eq("liker_id", userId).eq("image_url", image_url);

  revalidateTag("profile-image-likes", "profiles");
  return NextResponse.json({ success: true });
}
