import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { canViewProfile } from "@/lib/trust";
import { rateLimit } from "@/lib/rateLimit";

import { resolvePublicCommunityPhoto } from "@/lib/community-media-server";
import { photoHref } from "@/lib/photo-link";

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

async function getPhotoOwner(profileId: string, imageUrl?: string) {
  if (imageUrl) return await resolvePublicCommunityPhoto(profileId, imageUrl) ? { user_id: profileId } : null;
  const { data: profile, error } = await db
    .from("profiles")
    .select("user_id, profile_images, portfolio_images")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error || !profile) return null;
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
    return privateJson({ error: "profile_id und ein gültiges Bild sind erforderlich" }, { status: 400 });
  }
  const { userId } = await auth();
  if (!imageUrl && !(await canViewProfile(profileId, userId))) return privateJson({ error: "Foto nicht gefunden" }, { status: 404 });
  if (!(await getPhotoOwner(profileId, imageUrl ?? undefined))) return privateJson({ error: "Foto nicht gefunden" }, { status: 404 });

  if (imageUrl) {
    const [{ data, error }, count] = await Promise.all([
      db.from("profile_image_likes").select("liker_id").eq("profile_id", profileId).eq("image_url", imageUrl),
      getCount(profileId, imageUrl),
    ]);
    if (error) return privateJson({ error: "Likes konnten nicht geladen werden" }, { status: 500 });
    return privateJson({ count, liked: Boolean(userId && (data ?? []).some((row) => row.liker_id === userId)) });
  }

  const { data, error } = await db.from("profile_image_likes").select("image_url, liker_id").eq("profile_id", profileId);
  if (error) return privateJson({ error: "Likes konnten nicht geladen werden" }, { status: 500 });
  const { data: visible, error: visibilityError } = await db.from("public_community_media").select("image_url").eq("owner_id", profileId);
  if (visibilityError) return privateJson({ error: "Fotosichtbarkeit konnte nicht geprüft werden." }, { status: 503 });
  const visibleUrls = new Set((visible ?? []).map((image) => image.image_url));
  const likes: Record<string, number> = {};
  const myLikes: string[] = [];
  for (const row of data ?? []) {
    if (!visibleUrls.has(row.image_url)) continue;
    likes[row.image_url] = (likes[row.image_url] ?? 0) + 1;
    if (userId && row.liker_id === userId) myLikes.push(row.image_url);
  }
  return privateJson({ likes, myLikes });
}

// POST is state-setting (idempotent), not toggle-based, so retries and concurrent
// tabs cannot invert the same action twice.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return privateJson({ error: "Bitte melde dich an." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const profileId = body.profile_id;
  const imageUrl = body.image_url;
  const liked = body.liked;
  if (typeof profileId !== "string" || profileId.length > 128 || typeof imageUrl !== "string" || imageUrl.length > 2048 || typeof liked !== "boolean") {
    return privateJson({ error: "Profil, Foto und Like-Zustand sind erforderlich." }, { status: 400 });
  }
  if (profileId === userId) return privateJson({ error: "Eigene Fotos können nicht geliked werden." }, { status: 403 });
  const { allowed } = await rateLimit(`photo-like:${userId}`, 60, 60);
  if (!allowed) return privateJson({ error: "Zu viele Likes in kurzer Zeit. Bitte kurz warten." }, { status: 429 });
  if (!(await getPhotoOwner(profileId, imageUrl))) {
    return privateJson({ error: "Foto nicht gefunden." }, { status: 404 });
  }

  const { data: existing, error: lookupError } = await db
    .from("profile_image_likes")
    .select("id")
    .eq("liker_id", userId)
    .eq("profile_id", profileId)
    .eq("image_url", imageUrl)
    .maybeSingle();
  if (lookupError) return privateJson({ error: "Like-Zustand konnte nicht geprüft werden." }, { status: 500 });

  if (liked && !existing) {
    const { error } = await db.from("profile_image_likes").upsert(
      { liker_id: userId, profile_id: profileId, image_url: imageUrl, rating: 1 },
      { onConflict: "liker_id,profile_id,image_url", ignoreDuplicates: true },
    );
    if (error) return privateJson({ error: "Dein Like konnte nicht gespeichert werden." }, { status: 500 });
  } else if (!liked && existing) {
    const { error } = await db.from("profile_image_likes").delete()
      .eq("liker_id", userId).eq("profile_id", profileId).eq("image_url", imageUrl);
    if (error) return privateJson({ error: "Dein Like konnte nicht entfernt werden." }, { status: 500 });
  }

  const count = await getCount(profileId, imageUrl).catch(() => null);

  if (liked && !existing) {
    try {
      const { data: liker } = await db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
      await db.from("notifications").insert({
        user_id: profileId,
        type: "review_request",
        title: "Foto geliked",
        body: `${liker?.display_name ?? "Jemand"} hat eines deiner Fotos mit einem Herz versehen.`,
        href: photoHref(profileId, imageUrl),
      });
    } catch { /* Notification is best-effort; the like is already saved. */ }
  }

  revalidateTag("profile-image-likes", "profiles");
  return privateJson({ liked, count });
}
