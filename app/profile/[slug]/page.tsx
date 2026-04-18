import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import JsonLd from "@/components/JsonLd";
const admin = supabaseAdmin;
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import ProfileView from "./ProfileView";
import type { UserProfile, ProjectCredit } from "@/lib/profile-types";
import { getPresetForType, type ProfileModule } from "@/lib/profile-types";
import type { ExternalProfileRow } from "@/lib/external-platforms";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

// Stable base columns that always exist
const BASE_FIELDS = "user_id, display_name, avatar_url, cover_image_url, role, positions, location, bio, tagline, slug, profile_type, verified, available, available_from, day_rate, languages, travel_ready, skills, filmography, profile_images, showreel_url, reel_url, awards, availability_config, modules, instagram_url, tiktok_url, youtube_url, vimeo_url, linkedin_url, website_url, video_links";
// Newer columns — fetched separately so a missing column doesn't break the whole query
const EXTRA_FIELDS = "physical, crew, creative, vendor, agency";

async function getProfile(slug: string): Promise<UserProfile | null> {
  const orClause = `slug.eq.${slug},user_id.eq.${slug}`;

  // 1. Always load the stable base columns
  const { data: base, error: baseErr } = await admin
    .from("profiles")
    .select(BASE_FIELDS)
    .or(orClause)
    .maybeSingle();

  if (baseErr || !base) return null;

  // 2. Try loading newer columns separately — silently ignore if they don't exist yet
  let extra: Record<string, unknown> = {};
  const { data: extraData, error: extraErr } = await admin
    .from("profiles")
    .select(EXTRA_FIELDS)
    .or(orClause)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!extraErr && extraData) extra = extraData as any;
  else if (extraErr) console.warn("[getProfile] extra fields error:", extraErr.code, extraErr.message);

  // Merge base + extra
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = { ...base, ...extra } as any;

  const type = (data.profile_type ?? "actor") as UserProfile["profile_type"];

  // Use stored modules, merged with preset so new module types are never missing
  // preset may be undefined if profile_type is unknown — always fall back to talent preset
  const preset: ProfileModule[] = getPresetForType(type) ?? getPresetForType("actor");
  const rawStored: ProfileModule[] = Array.isArray(data.modules) && data.modules.length > 0
    ? data.modules
    : preset;

  // If all non-hero modules are disabled, fall back to preset (fresh profile)
  const hasAnyEnabled = rawStored.some((m: ProfileModule) => m.enabled && m.type !== "hero");
  const stored: ProfileModule[] = (hasAnyEnabled ? rawStored : preset) ?? preset;

  const storedTypes = new Set(stored.map((m: ProfileModule) => m.type));
  const missing = preset.filter((m) => !storedTypes.has(m.type));
  const modules = missing.length > 0
    ? [...stored, ...missing.map((m, i) => ({ ...m, order: stored.length + i, enabled: false }))]
    : stored;

  return { ...data, profile_type: type, modules } as UserProfile;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) return { title: "Profil nicht gefunden" };
  const name = profile.display_name ?? "Profil";
  const role = profile.role ?? "";
  return {
    title: `${name}${role ? ` — ${role}` : ""} · CineGenius`,
    description: profile.tagline ?? profile.bio ?? `${name} auf CineGenius`,
    openGraph: {
      title: `${name} · CineGenius`,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

async function getProjectCredits(userId: string): Promise<ProjectCredit[]> {
  const { data, error } = await admin
    .from("project_credits")
    .select("id, role, project_id, projects(id, title, year, type, director, poster_url, metadata)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any;
}

async function getExternalProfiles(userId: string): Promise<ExternalProfileRow[]> {
  const { data } = await admin
    .from("external_profiles")
    .select("id, platform_type, platform_name, url, custom_label, sort_order, is_public")
    .eq("user_id", userId)
    .eq("is_public", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as ExternalProfileRow[];
}

async function getPublicListings(userId: string) {
  const { data } = await admin
    .from("listings")
    .select("id, type, title, category, price, city, image_url")
    .eq("user_id", userId)
    .eq("published", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as { id: string; type: string; title: string; category: string | null; price: number | null; city: string; image_url: string | null }[];
}

async function getCompanyMembership(userId: string) {
  const { data } = await admin
    .from("company_members")
    .select("id, role, title, status, company_id, companies(id, slug, name, logo_url)")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any ?? null;
}

export default async function ProfilePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const [profile, { userId }] = await Promise.all([
    getProfile(slug),
    auth(),
  ]);

  if (!profile) notFound();

  const isOwner = userId === profile.user_id;
  const [projectCredits, companyMembership, externalProfiles, listings] = await Promise.all([
    getProjectCredits(profile.user_id),
    getCompanyMembership(profile.user_id),
    getExternalProfiles(profile.user_id),
    getPublicListings(profile.user_id),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": profile.display_name ?? "",
    "description": profile.bio ?? "",
    "image": profile.avatar_url ?? "",
    "jobTitle": profile.role ?? (profile.positions?.[0] ?? ""),
    "address": profile.location ? { "@type": "PostalAddress", "addressLocality": profile.location } : undefined,
    "url": `https://cinegenius.com/profile/${slug}`,
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProfileView
        profile={profile}
        isOwner={isOwner}
        projectCredits={projectCredits}
        companyMembership={companyMembership}
        externalProfiles={externalProfiles}
        listings={listings}
      />
    </>
  );
}
