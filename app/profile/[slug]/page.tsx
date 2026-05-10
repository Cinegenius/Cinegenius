import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import JsonLd from "@/components/JsonLd";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import ProfileView from "./ProfileView";
import { getBlockStatus } from "@/lib/trust";
import type { UserProfile, ProjectCredit } from "@/lib/profile-types";
import { getPresetForType, type ProfileModule } from "@/lib/profile-types";
import type { ExternalProfileRow } from "@/lib/external-platforms";

// Page is dynamic because of auth(), but data fetches are cached with tags
export const dynamicParams = true;

// Stable base columns that always exist
const BASE_FIELDS = "user_id, display_name, avatar_url, cover_image_url, role, positions, location, bio, tagline, slug, profile_type, verified, available, available_from, day_rate, languages, travel_ready, skills, filmography, profile_images, showreel_url, reel_url, awards, availability_config, modules, instagram_url, tiktok_url, youtube_url, vimeo_url, linkedin_url, website_url, video_links";
// Newer columns — fetched separately so a missing column doesn't break the whole query
const EXTRA_FIELDS = "physical, crew, creative, vendor, agency";

async function _getProfile(slug: string): Promise<UserProfile | null> {
  // Validate slug to prevent PostgREST filter injection — allow only slug chars or UUID chars
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(slug)) return null;

  // Try slug first, then user_id (two separate queries avoids .or() injection surface)
  const { data: bySlug } = await db
    .from("profiles")
    .select(BASE_FIELDS)
    .eq("slug", slug)
    .maybeSingle();

  const { data: base, error: baseErr } = bySlug
    ? { data: bySlug, error: null }
    : await db.from("profiles").select(BASE_FIELDS).eq("user_id", slug).maybeSingle();

  if (baseErr || !base) return null;

  // 2. Try loading newer columns separately — silently ignore if they don't exist yet
  let extra: Record<string, unknown> = {};
  const { data: extraData, error: extraErr } = await db
    .from("profiles")
    .select(EXTRA_FIELDS)
    .eq("user_id", base.user_id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!extraErr && extraData) extra = extraData as any;

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

function getProfile(slug: string): Promise<UserProfile | null> {
  return unstable_cache(
    () => _getProfile(slug),
    ["profile", slug],
    { revalidate: 300, tags: ["profiles"] }
  )();
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
  const { data, error } = await db
    .from("project_credits")
    .select("id, role, project_id, projects(id, title, year, type, director, poster_url, metadata)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any;
}

function getExternalProfiles(userId: string): Promise<ExternalProfileRow[]> {
  return unstable_cache(
    async () => {
      const { data } = await db
        .from("external_profiles")
        .select("id, platform_type, platform_name, url, custom_label, sort_order, is_public")
        .eq("user_id", userId)
        .eq("is_public", true)
        .order("sort_order", { ascending: true });
      return (data ?? []) as ExternalProfileRow[];
    },
    ["profile-external", userId],
    { revalidate: 300, tags: ["profiles"] }
  )();
}

function getPublicListings(userId: string): Promise<{ id: string; type: string; title: string; category: string | null; price: number | null; city: string; image_url: string | null }[]> {
  return unstable_cache(
    async () => {
      const { data } = await db
        .from("listings")
        .select("id, type, title, category, price, city, image_url")
        .eq("user_id", userId)
        .eq("published", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as { id: string; type: string; title: string; category: string | null; price: number | null; city: string; image_url: string | null }[];
    },
    ["profile-listings", userId],
    { revalidate: 300, tags: ["profiles", "listings"] }
  )();
}

type PublicCollab = { user_id: string; label: string; display_name: string; avatar_url: string | null; slug: string; role: string | null };

function getPublicCollaborations(userId: string): Promise<PublicCollab[]> {
  return unstable_cache(
    async () => {
      const [asSender, asReceiver] = await Promise.all([
        db
          .from("friendships")
          .select("receiver_id, sender_collab_label")
          .eq("sender_id", userId)
          .eq("status", "accepted")
          .eq("sender_collab_public", true)
          .not("sender_collab_label", "is", null),
        db
          .from("friendships")
          .select("sender_id, receiver_collab_label")
          .eq("receiver_id", userId)
          .eq("status", "accepted")
          .eq("receiver_collab_public", true)
          .not("receiver_collab_label", "is", null),
      ]);

      const collabs: { friendId: string; label: string }[] = [
        ...(asSender.data ?? []).map((f) => ({ friendId: f.receiver_id, label: f.sender_collab_label as string })),
        ...(asReceiver.data ?? []).map((f) => ({ friendId: f.sender_id, label: f.receiver_collab_label as string })),
      ];

      if (collabs.length === 0) return [];

      const ids = [...new Set(collabs.map((c) => c.friendId))];
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, display_name, avatar_url, slug, role, positions")
        .in("user_id", ids);

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
      return collabs.flatMap((c) => {
        const p = profileMap[c.friendId];
        // Skip if profile not found or has no valid slug — avoids /profile/user_xxx 404s
        if (!p?.slug) return [];
        return [{
          user_id: c.friendId,
          label: c.label,
          display_name: p.display_name ?? "Unbekannt",
          avatar_url: p.avatar_url ?? null,
          slug: p.slug,
          role: p.role ?? (Array.isArray(p.positions) ? p.positions[0] : null) ?? null,
        }];
      });
    },
    ["profile-collaborations", userId],
    { revalidate: 300, tags: ["profiles"] }
  )();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCompanyMembership(userId: string): Promise<any> {
  return unstable_cache(
    async () => {
      const { data } = await db
        .from("company_members")
        .select("id, role, title, status, company_id, companies(id, slug, name, logo_url)")
        .eq("user_id", userId)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any ?? null;
    },
    ["profile-company", userId],
    { revalidate: 300, tags: ["profiles"] }
  )();
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
  const [projectCredits, companyMembership, externalProfiles, listings, blockStatus, collaborations] = await Promise.all([
    getProjectCredits(profile.user_id),
    getCompanyMembership(profile.user_id),
    getExternalProfiles(profile.user_id),
    getPublicListings(profile.user_id),
    userId && !isOwner ? getBlockStatus(userId, profile.user_id) : Promise.resolve(null),
    getPublicCollaborations(profile.user_id),
  ]);

  // Track profile view — awaited so serverless doesn't drop it before .then() runs
  if (userId && userId !== profile.user_id) {
    const { error: viewErr } = await db.from("profile_views").insert({ profile_id: profile.user_id, viewer_id: userId });
    if (viewErr) console.error("[profile_views]", viewErr.message);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": profile.display_name ?? "",
    "description": profile.bio ?? "",
    "image": profile.avatar_url ?? "",
    "jobTitle": profile.role ?? (profile.positions?.[0] ?? ""),
    "address": profile.location ? { "@type": "PostalAddress", "addressLocality": profile.location } : undefined,
    "url": `https://cinegenius.co/profile/${slug}`,
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
        blockStatus={blockStatus}
        collaborations={collaborations}
      />
    </>
  );
}
