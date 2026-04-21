import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";

// All profile columns needed by the edit form.
// Update if new columns are added to the profiles table.
const PROFILE_COLS = [
  "user_id", "display_name", "display_name_alias", "slug", "phone",
  "avatar_url", "cover_image_url", "role", "positions", "location", "bio",
  "tagline", "profile_type", "profile_types", "account_type",
  "verified", "available", "available_from", "day_rate", "languages",
  "travel_ready", "skills", "filmography", "portfolio_url", "portfolio_images",
  "profile_images", "showreel_url", "reel_url", "awards", "availability_config",
  "modules", "instagram_url", "tiktok_url", "youtube_url", "vimeo_url",
  "linkedin_url", "website_url", "video_links",
  "physical", "crew", "creative", "vendor", "agency", "focal_point",
  "experience", "updated_at", "created_at",
].join(", ");

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { data } = await db
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();

  // Back-fill Clerk metadata and set cookie for users who had a profile before this flag existed
  if (data) {
    const { sessionClaims } = await auth();
    const meta = sessionClaims?.metadata as Record<string, unknown> | undefined;
    if (!meta?.profileComplete) {
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: { profileComplete: true },
        });
      } catch (e) {
        console.error("[profile GET] failed to back-fill Clerk metadata:", e);
      }
    }
    const res = NextResponse.json({ profile: data, exists: true });
    res.cookies.set("cg_profile_ok", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json({ profile: null, exists: false });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const {
    display_name, bio, location, avatar_url, skills, portfolio_url, positions,
    portfolio_images, experience, account_type, profile_types,
    cover_image_url, instagram_url, tiktok_url, youtube_url, vimeo_url, linkedin_url, website_url,
    day_rate, filmography, video_links, focal_point,
  } = body;

  if (!display_name?.trim()) {
    return NextResponse.json({ error: "Name ist ein Pflichtfeld" }, { status: 400 });
  }

  // Check if this is a brand-new profile
  const { data: existing } = await db
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  const isNewProfile = !existing;

  const { data, error } = await db
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        display_name: display_name.trim(),
        bio: bio?.trim() ?? "",
        location: location?.trim() ?? "",
        avatar_url: avatar_url ?? null,
        skills: skills ?? [],
        portfolio_url: portfolio_url?.trim() || null,
        positions: positions ?? [],
        portfolio_images: portfolio_images ?? [],
        experience: experience?.trim() ?? "",
        account_type: account_type ?? "person",
        profile_types: profile_types ?? [],
        cover_image_url: cover_image_url ?? null,
        instagram_url: instagram_url ?? null,
        tiktok_url: tiktok_url ?? null,
        youtube_url: youtube_url ?? null,
        vimeo_url: vimeo_url ?? null,
        linkedin_url: linkedin_url ?? null,
        website_url: website_url ?? null,
        day_rate: day_rate ?? null,
        filmography: filmography ?? [],
        video_links: video_links ?? [],
        focal_point: focal_point ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[profile POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark profile as complete in Clerk metadata (best-effort — JWT refresh takes ~60s)
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { profileComplete: true },
    });

    // Send welcome email only for brand-new profiles
    if (isNewProfile) {
      const clerkUser = await clerk.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (email) {
        sendWelcomeEmail(email, display_name.trim()).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[profile POST] failed to set Clerk metadata:", e);
  }

  revalidateTag("profiles", "max");

  // Set a cookie so the middleware can immediately pass the user through
  // without waiting for the JWT to be re-issued with the new metadata.
  const res = NextResponse.json({ profile: data });
  res.cookies.set("cg_profile_ok", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

// All known profile columns — any unknown key from the client is silently dropped
const ALLOWED_PATCH_KEYS = new Set([
  // SECURITY: "role", "verified", "account_type" deliberately excluded — set by admin only
  "display_name", "display_name_alias", "slug", "phone", "location", "bio",
  "available", "available_from", "travel_ready",
  "avatar_url", "cover_image_url", "portfolio_url", "website_url",
  "skills", "positions", "languages", "portfolio_images", "profile_images", "experience",
  "reel_url", "imdb_url",
  "instagram_url", "tiktok_url", "youtube_url", "vimeo_url", "linkedin_url",
  "day_rate", "filmography", "video_links",
  "account_type", "profile_types",
  "profile_type", "modules", "physical", "crew", "creative", "vendor",
  "focal_point",
]);

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    console.log("[profile PATCH] body keys:", Object.keys(body));

    // Only pass known columns to Supabase to avoid "column does not exist" errors
    const safe = Object.fromEntries(
      Object.entries(body).filter(([k]) => ALLOWED_PATCH_KEYS.has(k))
    );
    console.log("[profile PATCH] safe keys:", Object.keys(safe), "userId:", userId);

    const updated_at = new Date().toISOString();
    let payload: Record<string, unknown> = { ...safe, updated_at };

    // Retry: if PostgREST reports an unknown column, extract name from message and strip it
    for (let attempt = 0; attempt < 20; attempt++) {
      const { error } = await db
        .from("profiles")
        .update(payload)
        .eq("user_id", userId);

      if (!error) {
        revalidateTag("profiles", "max");
        return NextResponse.json({ success: true });
      }

      if (error.code === "PGRST204") {
        const match = error.message.match(/Could not find the '(\w+)' column/);
        const badCol = match?.[1];
        if (badCol && badCol in payload) {
          console.warn(`[profile PATCH] stripping missing column: ${badCol}`);
          const next = { ...payload };
          delete next[badCol];
          payload = next;
          continue;
        }
      }

      console.error("[profile PATCH] error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ success: true, partial: true });
  } catch (err) {
    console.error("[profile PATCH] uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
