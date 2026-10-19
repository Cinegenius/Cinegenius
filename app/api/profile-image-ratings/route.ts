import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { anyBlockExists, canViewProfile, getPrivateProfileIds } from "@/lib/trust";
import { rateLimit } from "@/lib/rateLimit";
import { resolveReviewEligibility } from "@/lib/review-eligibility";
import { summarizePhotoRatings } from "@/lib/photo-rating-summary";

type GalleryImage = { url?: unknown; media_type?: unknown };

function isUploadedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co") && parsed.pathname.includes("/storage/v1/object/");
  } catch {
    return false;
  }
}

function hasPublicImage(profile: { profile_images?: unknown; portfolio_images?: unknown }, imageUrl: string): boolean {
  const profileImages = Array.isArray(profile.profile_images) ? profile.profile_images as GalleryImage[] : [];
  const hasProfileImage = profileImages.some((image) =>
    typeof image?.url === "string" && image.url === imageUrl && image.media_type !== "headshot",
  );
  const portfolioImages = Array.isArray(profile.portfolio_images) ? profile.portfolio_images : [];
  return hasProfileImage || portfolioImages.includes(imageUrl);
}

async function getVisibleProfile(profileId: string, imageUrl: string, viewerId: string | null) {
  if (!isUploadedImageUrl(imageUrl)) return null;
  const { data: profile, error } = await db
    .from("profiles")
    .select("user_id, profile_images, portfolio_images")
    .eq("user_id", profileId)
    .maybeSingle();
  if (error || !profile || !hasPublicImage(profile, imageUrl)) return null;
  const privateIds = await getPrivateProfileIds([profileId]);
  if (privateIds.has(profileId) && !(await canViewProfile(profileId, viewerId))) return null;
  return profile;
}

// GET /api/profile-image-ratings?profile_id=...&image_url=...
export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  const imageUrl = req.nextUrl.searchParams.get("image_url");
  if (!profileId || !imageUrl || profileId.length > 128 || imageUrl.length > 2048) {
    return NextResponse.json({ error: "profile_id und image_url erforderlich" }, { status: 400 });
  }
  const { userId } = await auth();
  if (!(await getVisibleProfile(profileId, imageUrl, userId))) {
    return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
  }

  const { data, error } = await db
    .from("profile_image_ratings")
    .select("reviewer_id, rating")
    .eq("profile_id", profileId)
    .eq("image_url", imageUrl);
  if (error) return NextResponse.json({ error: "Fotobewertungen konnten nicht geladen werden" }, { status: 500 });
  const rows = data ?? [];
  const myRating = userId ? rows.find((row) => row.reviewer_id === userId)?.rating ?? null : null;
  const summary = summarizePhotoRatings(rows);
  const eligible = Boolean(userId && userId !== profileId && !(await anyBlockExists(userId, profileId)) && await resolveReviewEligibility(userId, "user", profileId, profileId));
  return NextResponse.json({ ...summary, myRating, eligible });
}

// POST /api/profile-image-ratings { profile_id, image_url, rating }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const profileId = body.profile_id;
  const imageUrl = body.image_url;
  const rating = body.rating;
  if (typeof profileId !== "string" || profileId.length > 128 || typeof imageUrl !== "string" || imageUrl.length > 2048) {
    return NextResponse.json({ error: "Ungültiges Foto." }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Bitte wähle 1 bis 5 Sterne." }, { status: 400 });
  }
  const { allowed } = await rateLimit(`profile-image-rating:${userId}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Bewertungen. Bitte kurz warten." }, { status: 429 });
  if (profileId === userId) return NextResponse.json({ error: "Eigene Fotos können nicht bewertet werden." }, { status: 403 });
  if (await anyBlockExists(userId, profileId)) return NextResponse.json({ error: "Bewertung nicht möglich." }, { status: 403 });
  if (!(await getVisibleProfile(profileId, imageUrl, userId))) {
    return NextResponse.json({ error: "Foto nicht gefunden." }, { status: 404 });
  }
  const via = await resolveReviewEligibility(userId, "user", profileId, profileId);
  if (!via) return NextResponse.json({ error: "Bewerten kannst du nach einer bestätigten Buchung oder angenommenen Bewerbung." }, { status: 403 });

  const { error } = await db
    .from("profile_image_ratings")
    .upsert({ profile_id: profileId, reviewer_id: userId, image_url: imageUrl, rating, updated_at: new Date().toISOString() }, { onConflict: "profile_id,image_url,reviewer_id" });
  if (error) return NextResponse.json({ error: "Deine Bewertung konnte nicht gespeichert werden." }, { status: 500 });
  revalidatePath("/");
  revalidatePath("/photo");

  const { data, error: readError } = await db
    .from("profile_image_ratings")
    .select("reviewer_id,rating")
    .eq("profile_id", profileId)
    .eq("image_url", imageUrl);
  if (readError) return NextResponse.json({ error: "Bewertung gespeichert, Zusammenfassung noch nicht verfügbar." }, { status: 200 });
  const rows = data ?? [];
  return NextResponse.json({ ...summarizePhotoRatings(rows), myRating: rating });
}
