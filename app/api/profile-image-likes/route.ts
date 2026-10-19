import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { canViewProfile } from "@/lib/trust";
import { rateLimit } from "@/lib/rateLimit";

type ProfileImages = { url?: unknown }[];

async function getPhotoOwner(profileId: string, imageUrl?: string) {
  const { data: profile, error } = await db
    .from("profiles")
    .select("user_id, profile_images, portfolio_images")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error || !profile) return null;
  if (imageUrl) {
    let parsed: URL;
    try { parsed = new URL(imageUrl); } catch { return null; }
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co") || !parsed.pathname.includes("/storage/v1/object/")) return null;
    const profileImages = Array.isArray(profile.profile_images) ? profile.profile_images as ProfileImages : [];
    const portfolioImages = Array.isArray(profile.portfolio_images) ? profile.portfolio_images : [];
    const belongsToProfile = profileImages.some((image) => image?.url === imageUrl) || portfolioImages.includes(imageUrl);
    if (!belongsToProfile) return null;
  }
  return profile;
}

async function getCount(profileId: string, imageUrl: string) {
  const { count, error } = await db
    .from("profile_image_likes")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("image_url", imageUrl);
  if (error) throw error;
  return count ?? 0;
}

// GET /api/profile-image-likes?profile_id=...&image_url=...
// Without image_url this retains the profile-wide response used by dashboard/profile pages.
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const imageUrl = req.nextUrl.searchParams.get("image_url");
  if (!profileId || profileId.length > 128 || (imageUrl && imageUrl.length > 2048)) {
    return NextResponse.json({ error: "profile_id und ein gültiges Bild sind erforderlich" }, { status: 400 });
  }
  const { userId } = await auth();
  if (!(await canViewProfile(profileId, userId))) return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
  if (!(await getPhotoOwner(profileId, imageUrl ?? undefined))) return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });

  if (imageUrl) {
    const [{ data, error }, count] = await Promise.all([
      db.from("profile_image_likes").select("liker_id").eq("profile_id", profileId).eq("image_url", imageUrl),
      getCount(profileId, imageUrl),
    ]);
    if (error) return NextResponse.json({ error: "Likes konnten nicht geladen werden" }, { status: 500 });
    return NextResponse.json({ count, liked: Boolean(userId && (data ?? []).some((row) => row.liker_id === userId)) });
  }

  const { data, error } = await db.from("profile_image_likes").select("image_url, liker_id").eq("profile_id", profileId);
  if (error) return NextResponse.json({ error: "Likes konnten nicht geladen werden" }, { status: 500 });
  const likes: Record<string, number> = {};
  const myLikes: string[] = [];
  for (const row of data ?? []) {
    likes[row.image_url] = (likes[row.image_url] ?? 0) + 1;
    if (userId && row.liker_id === userId) myLikes.push(row.image_url);
  }
  return NextResponse.json({ likes, myLikes });
}

// POST is state-setting (idempotent), not toggle-based, so retries and concurrent
// tabs cannot invert the same action twice.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const profileId = body.profile_id;
  const imageUrl = body.image_url;
  const liked = body.liked;
  if (typeof profileId !== "string" || profileId.length > 128 || typeof imageUrl !== "string" || imageUrl.length > 2048 || typeof liked !== "boolean") {
    return NextResponse.json({ error: "Profil, Foto und Like-Zustand sind erforderlich." }, { status: 400 });
  }
  if (profileId === userId) return NextResponse.json({ error: "Eigene Fotos können nicht geliked werden." }, { status: 403 });
  const { allowed } = await rateLimit(`photo-like:${userId}`, 60, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Likes in kurzer Zeit. Bitte kurz warten." }, { status: 429 });
  if (!(await canViewProfile(profileId, userId)) || !(await getPhotoOwner(profileId, imageUrl))) {
    return NextResponse.json({ error: "Foto nicht gefunden." }, { status: 404 });
  }

  const { data: existing, error: lookupError } = await db
    .from("profile_image_likes")
    .select("id")
    .eq("liker_id", userId)
    .eq("profile_id", profileId)
    .eq("image_url", imageUrl)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Like-Zustand konnte nicht geprüft werden." }, { status: 500 });

  if (liked && !existing) {
    const { error } = await db.from("profile_image_likes").upsert(
      { liker_id: userId, profile_id: profileId, image_url: imageUrl, rating: 1 },
      { onConflict: "liker_id,profile_id,image_url", ignoreDuplicates: true },
    );
    if (error) return NextResponse.json({ error: "Dein Like konnte nicht gespeichert werden." }, { status: 500 });
  } else if (!liked && existing) {
    const { error } = await db.from("profile_image_likes").delete()
      .eq("liker_id", userId).eq("profile_id", profileId).eq("image_url", imageUrl);
    if (error) return NextResponse.json({ error: "Dein Like konnte nicht entfernt werden." }, { status: 500 });
  }

  const count = await getCount(profileId, imageUrl).catch(() => null);

  if (liked && !existing) {
    try {
      const [{ data: liker }, { data: owner }] = await Promise.all([
        db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
        db.from("profiles").select("slug").eq("user_id", profileId).maybeSingle(),
      ]);
      await db.from("notifications").insert({
        user_id: profileId,
        type: "review_request",
        title: "Foto geliked",
        body: `${liker?.display_name ?? "Jemand"} hat eines deiner Fotos mit einem Herz versehen.`,
        href: `/profile/${owner?.slug ?? profileId}`,
      });
    } catch { /* Notification is best-effort; the like is already saved. */ }
  }

  revalidateTag("profile-image-likes", "profiles");
  return NextResponse.json({ liked, count });
}
