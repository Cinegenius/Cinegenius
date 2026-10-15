import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { PROFILE_TYPE_LABELS } from "@/lib/profile-types";

// Stable columns that always exist in the profiles table
const PROFILE_COLS = [
  "user_id", "display_name", "display_name_alias", "slug", "phone",
  "avatar_url", "cover_image_url", "role", "positions", "location", "bio",
  "tagline", "profile_type", "profile_types", "account_type",
  "verified", "available", "available_from", "day_rate", "languages",
  "travel_ready", "skills", "memberships", "filmography", "portfolio_url", "portfolio_images",
  "profile_images", "showreel_url", "reel_url", "awards", "availability_config",
  "modules", "instagram_url", "tiktok_url", "youtube_url", "vimeo_url",
  "linkedin_url", "website_url", "video_links",
  "physical", "crew", "creative", "vendor", "agency", "focal_point",
  "experience", "updated_at", "created_at",
].join(", ");

// Newer optional columns — fetched separately so a missing column doesn't break the whole query
const PROFILE_COLS_EXTRA = "contact_email";
const PROFILE_COLS_MEDIA_EXTRA = "imdb_url";

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST204" || error.code === "42703" ||
    /could not find the .* column|column .* does not exist/i.test(error.message ?? "");
}

const PROFILE_TYPE_VALUES = new Set(Object.keys(PROFILE_TYPE_LABELS));
function isValidProfileType(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && PROFILE_TYPE_VALUES.has(value));
}
function isValidProfileTypes(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && PROFILE_TYPE_VALUES.has(entry));
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { data: base, error: dbError } = await db
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("user_id", userId)
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Merge optional newer columns; report schema gaps and fail on other query errors.
  let data = base;
  const unavailableFields: string[] = [];
  if (base) {
    const { data: extra, error: extraError } = await db
      .from("profiles")
      .select(PROFILE_COLS_EXTRA)
      .eq("user_id", userId)
      .maybeSingle();
    if (extraError) {
      if (isMissingColumnError(extraError)) unavailableFields.push("contact_email");
      else return NextResponse.json({ error: extraError.message }, { status: 500 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (extra) data = Object.assign({}, base, extra) as any;

    const { data: mediaExtra, error: mediaExtraError } = await db
      .from("profiles")
      .select(PROFILE_COLS_MEDIA_EXTRA)
      .eq("user_id", userId)
      .maybeSingle();
    if (mediaExtraError) {
      if (isMissingColumnError(mediaExtraError)) unavailableFields.push("imdb_url");
      else return NextResponse.json({ error: mediaExtraError.message }, { status: 500 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (mediaExtra) data = Object.assign({}, data, mediaExtra) as any;
  }

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
    const res = NextResponse.json({ profile: data, exists: true, unavailableFields });
    res.cookies.set("cg_profile_ok", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json({ profile: null, exists: false, unavailableFields: [] });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  const {
    display_name, bio, location, avatar_url, skills, memberships, portfolio_url, positions,
    portfolio_images, profile_images, experience, profile_types, profile_type, slug, phone, contact_email,
    available, available_from, travel_ready, availability_config, languages, reel_url, imdb_url, crew,
    cover_image_url, instagram_url, tiktok_url, youtube_url, vimeo_url, linkedin_url, website_url,
    day_rate, filmography, video_links, focal_point,
  } = body;

  if (!display_name?.trim()) {
    return NextResponse.json({ error: "Name ist ein Pflichtfeld" }, { status: 400 });
  }
  if (profile_type !== undefined && !isValidProfileType(profile_type)) {
    return NextResponse.json({ error: "Ungültiger Profiltyp." }, { status: 400 });
  }
  if (profile_types !== undefined && !isValidProfileTypes(profile_types)) {
    return NextResponse.json({ error: "Ungültige Profiltypen." }, { status: 400 });
  }

  let normalizedSlug: string | null = null;
  if (slug && String(slug).trim()) {
    normalizedSlug = String(slug).trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,64}$/.test(normalizedSlug)) {
      return NextResponse.json({ error: "Profil-URL ungültig (3–64 Zeichen, nur a-z, 0-9, _ und -)" }, { status: 400 });
    }
    const { data: conflict } = await db
      .from("profiles")
      .select("user_id")
      .eq("slug", normalizedSlug)
      .neq("user_id", userId)
      .maybeSingle();
    if (conflict) return NextResponse.json({ error: "Profil-URL ist bereits vergeben" }, { status: 409 });
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    display_name: display_name.trim(),
    bio: bio?.trim() ?? "",
    location: location?.trim() ?? "",
    avatar_url: avatar_url ?? null,
    skills: skills ?? [],
    memberships: memberships ?? [],
    portfolio_url: portfolio_url?.trim() || null,
    positions: positions ?? [],
    languages: languages ?? [],
    portfolio_images: portfolio_images ?? [],
    profile_images: profile_images ?? [],
    experience: experience?.trim() ?? "",
    account_type: "person",
    profile_types: profile_types ?? [],
    profile_type: profile_type ?? null,
    slug: normalizedSlug,
    phone: phone?.trim() || null,
    contact_email: contact_email?.trim() || null,
    available: available ?? true,
    available_from: available_from ?? null,
    travel_ready: travel_ready ?? false,
    availability_config: availability_config ?? null,
    reel_url: reel_url ?? null,
    imdb_url: imdb_url ?? null,
    crew: crew ?? null,
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
  };
  const unavailableFields: string[] = [];
  let data: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await db
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (!result.error) {
      data = result.data as Record<string, unknown>;
      break;
    }

    if (result.error.code === "PGRST204") {
      const match = result.error.message.match(/Could not find the '([\w]+)' column/);
      const badCol = match?.[1];
      if (badCol && badCol in payload) {
        unavailableFields.push(badCol);
        delete payload[badCol];
        continue;
      }
    }

    console.error("[profile POST]", result.error);
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Profil konnte nicht gespeichert werden." }, { status: 500 });
  }

  // Mark profile as complete in Clerk metadata (best-effort — JWT refresh takes ~60s)
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { profileComplete: true },
    });
  } catch (e) {
    console.error("[profile POST] failed to set Clerk metadata:", e);
  }
  // Welcome email is sent by the Clerk webhook (user.created) — no duplicate here

  revalidateTag("profiles", "max");

  // Set a cookie so the middleware can immediately pass the user through
  // without waiting for the JWT to be re-issued with the new metadata.
  const res = NextResponse.json({ profile: data, unavailableFields });
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
  // SECURITY: "role", "verified", "account_type" excluded — set via admin routes only
  "display_name", "display_name_alias", "slug", "phone", "contact_email", "location", "bio",
  "available", "available_from", "travel_ready",
  "avatar_url", "cover_image_url", "portfolio_url", "website_url",
  "skills", "memberships", "positions", "languages", "portfolio_images", "profile_images", "experience",
  "reel_url", "imdb_url",
  "instagram_url", "tiktok_url", "youtube_url", "vimeo_url", "linkedin_url",
  "day_rate", "filmography", "video_links",
  "availability_config",
  "profile_types",
  "profile_type", "modules", "physical", "crew", "creative", "vendor",
  "focal_point", "tagline",
]);

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });

    // Only pass known columns to Supabase to avoid "column does not exist" errors
    const safe = Object.fromEntries(
      Object.entries(body).filter(([k]) => ALLOWED_PATCH_KEYS.has(k))
    );
    if (Object.keys(safe).length === 0) {
      return NextResponse.json({ error: "Keine unterstützten Profiländerungen erhalten." }, { status: 400 });
    }
    if ("profile_type" in safe && !isValidProfileType(safe.profile_type)) {
      return NextResponse.json({ error: "Ungültiger Profiltyp." }, { status: 400 });
    }
    if ("profile_types" in safe && !isValidProfileTypes(safe.profile_types)) {
      return NextResponse.json({ error: "Ungültige Profiltypen." }, { status: 400 });
    }

    // Slug: validate format and check uniqueness to prevent profile hijacking
    if ("slug" in safe) {
      const rawSlug = safe.slug;
      // Guard: null/empty/whitespace → clear slug, no uniqueness check needed.
      // (Prevents String(null)==="null" being stored as a real slug and blocking all subsequent signups.)
      if (!rawSlug || (typeof rawSlug === "string" && !rawSlug.trim())) {
        safe.slug = null;
      } else {
        const slug = String(rawSlug).trim().toLowerCase();
        if (!/^[a-z0-9_-]{3,64}$/.test(slug)) {
          return NextResponse.json({ error: "Slug ungültig (3–64 Zeichen, nur a-z, 0-9, _ und -)" }, { status: 400 });
        }
        const { data: conflict } = await db
          .from("profiles")
          .select("user_id")
          .eq("slug", slug)
          .neq("user_id", userId)
          .maybeSingle();
        if (conflict) {
          return NextResponse.json({ error: "Slug ist bereits vergeben" }, { status: 409 });
        }
        safe.slug = slug;
      }
    }

    const updated_at = new Date().toISOString();
    let payload: Record<string, unknown> = { ...safe, updated_at };
    const unavailableFields: string[] = [];

    // Retry: if PostgREST reports an unknown column, extract name from message and strip it
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await db
        .from("profiles")
        .update(payload)
        .eq("user_id", userId)
        .select("user_id")
        .maybeSingle();

      if (!error) {
        if (!data) return NextResponse.json({ error: "Profil nicht gefunden. Bitte zuerst das Profil anlegen." }, { status: 404 });
        revalidateTag("profiles", "max");
        if (unavailableFields.length > 0) {
          return NextResponse.json({
            error: `Diese Felder konnten nicht gespeichert werden: ${unavailableFields.join(", ")}. Bitte die Profil-Datenbank aktualisieren lassen.`,
            unavailableFields,
          }, { status: 422 });
        }
        return NextResponse.json({ success: true });
      }

      if (error.code === "PGRST204") {
        const match = error.message.match(/Could not find the '(\w+)' column/);
        const badCol = match?.[1];
        if (badCol && badCol in payload) {
          unavailableFields.push(badCol);
          const next = { ...payload };
          delete next[badCol];
          payload = next;
          continue;
        }
      }

      console.error("[profile PATCH] error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ error: "Profil konnte nicht vollständig gespeichert werden." }, { status: 500 });
  } catch (err) {
    console.error("[profile PATCH] uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
