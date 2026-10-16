import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { getProfileDisplayPositions, normalizeProfileTypes } from "@/lib/profile-display";
import { getPrivateProfileIds } from "@/lib/trust";

const PAGE_SIZE = 48;

// GET /api/creators?page=1  → next page of profiles (page 0 = first 96 served by SSR)
export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const from = 96 + (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: profiles, error } = await db
    .from("profiles")
    .select("user_id, display_name, location, bio, skills, role, positions, available, avatar_url, portfolio_images, languages, profile_types, profile_type, physical, availability_config, day_rate, travel_ready, verified, tagline, focal_point")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const privateProfileIds = await getPrivateProfileIds((profiles ?? []).map((profile) => profile.user_id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creators = (profiles ?? []).filter((profile) => !privateProfileIds.has(profile.user_id)).map((p: any) => {
    const phys = p.physical ?? {};
    const avail = p.availability_config ?? {};
    const types = normalizeProfileTypes(p.profile_types, p.profile_type);
    const primaryType = (types[0] ?? "") as ProfileType;
    const typeLabel = primaryType ? (PROFILE_TYPE_LABELS[primaryType] ?? "") : "";
    const displayPositions = getProfileDisplayPositions({
      positions: p.positions,
      role: p.role,
      profileTypes: types,
      primaryType,
      labels: PROFILE_TYPE_LABELS,
    });
    return {
      id: p.user_id,
      name: p.display_name ?? "Unbekannt",
      role: p.role ?? displayPositions[0] ?? typeLabel ?? "Filmschaffende/r",
      positions: displayPositions,
      location: p.location ?? "",
      image: (Array.isArray(p.portfolio_images) && p.portfolio_images.length > 0) ? p.portfolio_images[0] : (p.avatar_url ?? ""),
      avatar: p.avatar_url ?? "",
      rating: 0, reviews: 0,
      dayRate: p.day_rate ? `${p.day_rate} €/Tag` : "Nach Vereinbarung",
      available: p.available ?? true,
      credits: [], skills: p.skills ?? [],
      bio: p.bio ?? p.tagline ?? "",
      languages: p.languages ?? [],
      verified: p.verified ?? false,
      isReal: true as const,
      profile_type: primaryType,
      profile_types: types,
      isVendor: types.some((type) => PROFILE_CATEGORY_MAP[type] === "vendor"),
      hair_color: phys.hair_color ?? "", eye_color: phys.eye_color ?? "",
      body_type: phys.body_type ?? "",
      playing_age_min: phys.playing_age_min ?? null, playing_age_max: phys.playing_age_max ?? null,
      height_cm: phys.height_cm ?? null,
      travel: avail.travel ?? (p.travel_ready ? "national" : ""),
      focal_point: p.focal_point ?? undefined,
    };
  }).filter(Boolean);

  return NextResponse.json({ creators, hasMore: (profiles ?? []).length === PAGE_SIZE });
}
