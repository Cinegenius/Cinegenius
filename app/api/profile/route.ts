import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { PROFILE_TYPE_LABELS } from "@/lib/profile-types";
import { normalizeProfileTypes } from "@/lib/profile-display";
import {
  retryWithoutMissingOptionalProfileColumns,
  selectOptionalProfileColumns,
} from "@/lib/profile-db-compat";

// Stable columns that always exist in the profiles table
const PROFILE_COLS = [
  "user_id", "display_name", "display_name_alias", "slug", "phone",
  "avatar_url", "cover_image_url", "role", "positions", "location", "bio",
  "tagline", "profile_type", "account_type",
  "verified", "available", "available_from", "day_rate", "languages",
  "travel_ready", "skills", "memberships", "filmography", "portfolio_url", "portfolio_images",
  "profile_images", "showreel_url", "reel_url", "awards", "availability_config",
  "modules", "instagram_url", "tiktok_url", "youtube_url", "vimeo_url",
  "linkedin_url", "website_url", "video_links",
  "crew", "creative", "vendor", "agency", "focal_point",
  "experience", "updated_at", "created_at",
].join(", ");

// Newly added profile fields are isolated from the stable projection so a
// not-yet-applied database migration cannot disable the entire profile editor.
const PROFILE_OPTIONAL_COLS = [
  "profile_types", "physical", "performance", "model_measurements", "casting",
  "contact_email", "imdb_url",
] as const;
const PROFILE_OPTIONAL_COLUMN_SET = new Set<string>(PROFILE_OPTIONAL_COLS);

const PROFILE_TYPE_VALUES = new Set(Object.keys(PROFILE_TYPE_LABELS));
function privateNoStoreJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

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

  if (dbError) return privateNoStoreJson({ error: dbError.message }, 500);

  let data = base;
  let unavailableFields: string[] = [];
  if (base) {
    const optionalResult = await selectOptionalProfileColumns<Record<string, unknown>>(
      PROFILE_OPTIONAL_COLS,
      async (projection) => {
        const result = await db.from("profiles").select(projection).eq("user_id", userId).maybeSingle();
        return { data: result.data as Record<string, unknown> | null, error: result.error };
      },
    );
    if (optionalResult.error) {
      console.error("[profile GET] optional profile fields could not be read:", optionalResult.error);
      return privateNoStoreJson({ error: optionalResult.error.message ?? "Optionale Profilfelder konnten nicht geladen werden.", code: optionalResult.error.code }, 500);
    }
    data = Object.assign({}, base, optionalResult.data ?? {}) as typeof base;
    unavailableFields = optionalResult.unavailableFields;
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
    const res = privateNoStoreJson({ profile: data, exists: true, unavailableFields });
    res.cookies.set("cg_profile_ok", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return privateNoStoreJson({ profile: null, exists: false, unavailableFields: [] });
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
    day_rate, filmography, video_links, focal_point, physical, performance, model_measurements, casting,
  } = body;

  const fieldErrors: Record<string, string> = {};
  if (typeof display_name !== "string" || !display_name.trim()) fieldErrors.display_name = "Bitte gib deinen Namen ein.";
  if (typeof location !== "string" || !location.trim()) fieldErrors.location = "Bitte gib deinen Standort ein.";
  if (profile_type !== undefined && !isValidProfileType(profile_type)) {
    return NextResponse.json({ error: "Ungültiger Profiltyp." }, { status: 400 });
  }
  if (profile_types !== undefined && !isValidProfileTypes(profile_types)) {
    return NextResponse.json({ error: "Ungültige Profiltypen." }, { status: 400 });
  }
  const normalizedProfileTypes = normalizeProfileTypes(profile_types ?? [], profile_type ?? null);
  const hasPositions = Array.isArray(positions) && positions.some((position: unknown) => typeof position === "string" && position.trim());
  if (!hasPositions && normalizedProfileTypes.length === 0) fieldErrors.activity = "Bitte wähle mindestens eine Tätigkeit aus.";
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "Bitte prüfe die markierten Pflichtfelder.", fieldErrors }, { status: 400 });
  }
  const requestedPrimary = normalizedProfileTypes[0] ?? null;

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
    profile_types: normalizedProfileTypes,
    profile_type: requestedPrimary,
    slug: normalizedSlug,
    phone: phone?.trim() || null,
    contact_email: contact_email?.trim() || null,
    available: available ?? true,
    available_from: available_from ?? null,
    travel_ready: travel_ready ?? false,
    availability_config: availability_config ?? null,
    reel_url: reel_url ?? null,
    imdb_url: imdb_url ?? null,
    physical: physical ?? null,
    performance: performance ?? null,
    model_measurements: model_measurements ?? null,
    casting: casting ?? null,
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
  const saveResult = await retryWithoutMissingOptionalProfileColumns(
    payload,
    PROFILE_OPTIONAL_COLUMN_SET,
    async (nextPayload) => {
      const result = await db.from("profiles").upsert(nextPayload, { onConflict: "user_id" }).select().single();
      return { data: result.data as Record<string, unknown> | null, error: result.error };
    },
  );
  if (saveResult.error) {
    console.error("[profile POST]", saveResult.error);
    return NextResponse.json({ error: saveResult.error.message ?? "Profil konnte nicht gespeichert werden.", code: saveResult.error.code }, { status: 500 });
  }
  const data = saveResult.data;
  const unavailableFields = saveResult.unavailableFields;

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

  revalidateTag("profiles", { expire: 0 });

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
  "profile_type", "modules", "physical", "performance", "model_measurements", "casting", "crew", "creative", "vendor",
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
    if ("profile_types" in safe) {
      const normalizedTypes = normalizeProfileTypes(safe.profile_types as string[], safe.profile_type as string | null | undefined);
      safe.profile_types = normalizedTypes;
      safe.profile_type = normalizedTypes[0] ?? null;
    } else if ("profile_type" in safe) {
      safe.profile_types = typeof safe.profile_type === "string" ? [safe.profile_type] : [];
    }

    const fieldErrors: Record<string, string> = {};
    if ("display_name" in safe && (typeof safe.display_name !== "string" || !safe.display_name.trim())) {
      fieldErrors.display_name = "Bitte gib deinen Namen ein.";
    }
    if ("location" in safe && (typeof safe.location !== "string" || !safe.location.trim())) {
      fieldErrors.location = "Bitte gib deinen Standort ein.";
    }
    if ("positions" in safe || "profile_types" in safe || "profile_type" in safe) {
      const hasPositions = Array.isArray(safe.positions) && safe.positions.some((position) => typeof position === "string" && position.trim());
      const types = Array.isArray(safe.profile_types) ? safe.profile_types as string[] : [];
      if (!hasPositions && types.length === 0) fieldErrors.activity = "Bitte wähle mindestens eine Tätigkeit aus.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ error: "Bitte prüfe die markierten Pflichtfelder.", fieldErrors }, { status: 400 });
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
    const payload: Record<string, unknown> = { ...safe, updated_at };
    const saveResult = await retryWithoutMissingOptionalProfileColumns(
      payload,
      PROFILE_OPTIONAL_COLUMN_SET,
      async (nextPayload) => {
        const result = await db.from("profiles").update(nextPayload).eq("user_id", userId).select("user_id").maybeSingle();
        return { data: result.data as { user_id: string } | null, error: result.error };
      },
    );

    if (saveResult.error) {
      console.error("[profile PATCH] error:", JSON.stringify(saveResult.error));
      return NextResponse.json({ error: saveResult.error.message ?? "Profil konnte nicht gespeichert werden.", code: saveResult.error.code }, { status: 500 });
    }
    if (!saveResult.data) return NextResponse.json({ error: "Profil nicht gefunden. Bitte zuerst das Profil anlegen." }, { status: 404 });

    revalidateTag("profiles", { expire: 0 });
    if (saveResult.unavailableFields.length > 0) {
      return NextResponse.json({ success: true, unavailableFields: saveResult.unavailableFields });
    }
    return NextResponse.json({ success: true, unavailableFields: [] });
  } catch (err) {
    console.error("[profile PATCH] uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
