import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import { getPrivateProfileIds } from "@/lib/trust";
import CreatorsContent, { type ServerCreator } from "./CreatorsContent";
import { primaryOccupationForPositions, occupationReference, isCrewDirectoryProfile, crewDepartmentForPositions } from "@/lib/primary-occupation";
import PageHeader from "@/components/PageHeader";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { getProfileDisplayPositions, normalizeProfileTypes } from "@/lib/profile-display";
import { getTranslations } from "next-intl/server";

// Mixed person/offer accounts are retained; offer-only accounts are excluded below.
const VENDOR_TYPES = new Set(
  (Object.entries(PROFILE_CATEGORY_MAP) as [ProfileType, string][])
    .filter(([, cat]) => cat === "vendor")
    .map(([type]) => type)
);

type CreatorProfileRow = {
  user_id: string;
  display_name: string | null;
  location: string | null;
  bio: string | null;
  skills: string[] | null;
  role: string | null;
  positions: string[] | null;
  crew: { primaryOccupation?: unknown } | null;
  available: boolean | null;
  avatar_url: string | null;
  portfolio_images: string[] | null;
  languages: string[] | null;
  profile_types: string[] | null;
  profile_type: string | null;
  physical: { hair_color?: string | null; eye_color?: string | null; body_type?: string | null; playing_age_min?: number | null; playing_age_max?: number | null; height_cm?: number | null } | null;
  availability_config: { travel?: string | null } | null;
  day_rate: number | null;
  travel_ready: boolean | null;
  verified: boolean | null;
  tagline: string | null;
  focal_point: { x: number; y: number } | null;
  last_seen_at: string | null;
};

type CreatorListingRow = {
  id: string;
  user_id: string | null;
  title: string;
  category: string | null;
  city: string | null;
  price: number | null;
  image_url: string | null;
  description: string | null;
};

const getCreatorDirectoryData = unstable_cache(
  async () => {
    const [listingResult, profileResult] = await Promise.all([
      db
        .from("listings")
        .select("id, user_id, title, category, city, price, image_url, description")
        .eq("published", true)
        .eq("type", "creator")
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("profiles")
        .select("user_id, display_name, location, bio, skills, role, positions, crew, available, avatar_url, portfolio_images, languages, profile_types, profile_type, physical, availability_config, day_rate, travel_ready, verified, tagline, focal_point, last_seen_at")
        .not("display_name", "is", null)
        .neq("display_name", "")
        .order("created_at", { ascending: false })
        .limit(96),
    ]);

    if (listingResult.error) throw new Error(`Crew-Inserate konnten nicht geladen werden: ${listingResult.error.message}`);
    if (profileResult.error) throw new Error(`Crew-Profile konnten nicht geladen werden: ${profileResult.error.message}`);

    const listings = (listingResult.data ?? []) as CreatorListingRow[];
    const profiles = (profileResult.data ?? []) as CreatorProfileRow[];
    const [listingRatings, profileRatings] = await Promise.all([
      fetchRatings(listings.map((listing) => listing.id), "listing"),
      fetchRatings(profiles.map((profile) => profile.user_id), "user"),
    ]);

    return { listings, profiles, listingRatings, profileRatings };
  },
  ["creator-directory-primary-v5"],
  { revalidate: 60, tags: ["creator-directory", "profiles", "listings"] },
);

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Filmcrew & Kreative finden — Kamera, Regie, Content Creator",
  description: "Finde erfahrene Filmcrew, Content Creator und Fotografen: Kameraleute, Regisseure, Cutter, Tontechniker, Influencer und mehr — deutschlandweit buchbar.",
  keywords: ["Filmcrew buchen", "Kameramann buchen", "Content Creator buchen", "Fotograf buchen", "Freelancer Film", "Crew für Filmproduktion"],
  openGraph: {
    title: "Filmcrew & Kreative finden — CineGenius",
    description: "Kamera, Regie, Licht, Ton, Social Media, Fotografie — alle Gewerke auf einer Plattform.",
  },
};

function parseCreatorDescription(raw: string): { skills: string[]; credits: string[] } {
  const skillsMatch = raw.match(/^Skills: (.+)$/m);
  const experienceMatch = raw.match(/^Erfahrung: (.+)$/m);

  const skills = skillsMatch
    ? skillsMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const credits = experienceMatch
    ? [experienceMatch[1].trim()]
    : [];

  return { skills, credits };
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, tCommon, { userId }, directoryData, params] = await Promise.all([
    getTranslations("creators"),
    getTranslations("common"),
    auth(),
    getCreatorDirectoryData(),
    searchParams,
  ]);
  const { listings, profiles, listingRatings, profileRatings } = directoryData;

  const profileQuery = userId
    ? db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [privateProfileIds, ownProfile] = await Promise.all([
    getPrivateProfileIds(profiles.map((profile) => profile.user_id)),
    profileQuery,
  ]);
  const hasProfile = !!ownProfile.data?.display_name;

  const profileOwnerIds = new Set(profiles.map(profile => profile.user_id));
  const seenListingOwners = new Set<string>();
  const fromListings: ServerCreator[] = listings.filter(listing => {
    if (!listing.user_id) return true;
    if (profileOwnerIds.has(listing.user_id) || seenListingOwners.has(listing.user_id)) return false;
    seenListingOwners.add(listing.user_id);
    return true;
  }).map((l) => {
    const { skills, credits } = parseCreatorDescription(l.description ?? "");
    return {
      id: `listing_${l.id}`,        // prefix to avoid collision with user IDs
      ownerId: l.user_id ?? undefined,
      name: l.title,
      role: l.category ?? "Filmschaffende/r",
      positions: l.category ? [l.category] : [],
      primaryOccupation: occupationReference(primaryOccupationForPositions(null, l.category ? [l.category] : [])),
      crewDepartmentId: crewDepartmentForPositions(null, l.category ? [l.category] : []),
      location: l.city ?? "",
      image: l.image_url ?? "",
      avatar: l.image_url ?? "",
      rating: 0,
      reviews: 0,
      dayRate: (l.price ?? 0) > 0 ? `${l.price} €/Tag` : tCommon("byArrangement"),
      available: true,
      credits,
      skills,
      verified: false,
      isReal: true,
    };
  });

  const fromProfiles: ServerCreator[] = profiles
    .filter((p) => {
      if (privateProfileIds.has(p.user_id)) return false;
      // Don't show a second card for users who already have a creator listing

      return isCrewDirectoryProfile(p);
    })
    .map((p) => {
      const phys = p.physical ?? {};
      const avail = p.availability_config ?? {};
      const types = normalizeProfileTypes(p.profile_types, p.profile_type);
      // Pick a human-readable role label from the profile types
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
        primaryOccupation: occupationReference(primaryOccupationForPositions(p.crew?.primaryOccupation, p.positions ?? [], p.role)),
        crewDepartmentId: crewDepartmentForPositions(p.crew?.primaryOccupation, p.positions ?? [], p.role),
        location: p.location ?? "",
        // cover: prefer first portfolio image, fall back to avatar
        image: (Array.isArray(p.portfolio_images) && p.portfolio_images.length > 0)
          ? p.portfolio_images[0]
          : (p.avatar_url ?? ""),
        avatar: p.avatar_url ?? "",
        rating: 0,
        reviews: 0,
        dayRate: p.day_rate ? `${p.day_rate} €/Tag` : tCommon("byArrangement"),
        available: p.available ?? true,
        credits: [],
        skills: p.skills ?? [],
        bio: p.bio ?? p.tagline ?? "",
        languages: p.languages ?? [],
        verified: p.verified ?? false,
        isReal: true as const,
        profile_type: primaryType,
        profile_types: types,
        isVendor: types.some((type) => VENDOR_TYPES.has(type)) || VENDOR_TYPES.has(primaryType),
        hair_color: phys.hair_color ?? "",
        eye_color: phys.eye_color ?? "",
        body_type: phys.body_type ?? "",
        playing_age_min: phys.playing_age_min ?? null,
        playing_age_max: phys.playing_age_max ?? null,
        height_cm: phys.height_cm ?? null,
        travel: avail.travel ?? (p.travel_ready ? "national" : ""),
        focal_point: p.focal_point ?? undefined,
        last_seen_at: p.last_seen_at ?? null,
      };
    });

  const serverCreators: ServerCreator[] = [
    ...fromListings.map((c) => ({
      ...c,
      rating:  listingRatings[c.id.replace("listing_", "")]?.rating  ?? 0,
      reviews: listingRatings[c.id.replace("listing_", "")]?.reviews ?? 0,
    })),
    ...fromProfiles.map((c) => ({
      ...c,
      rating:  profileRatings[c.id]?.rating  ?? 0,
      reviews: profileRatings[c.id]?.reviews ?? 0,
    })),
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge="Crew"
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={t("heroDesc")}
        cta={!hasProfile ? { label: t("heroCta"), href: "/profile" } : undefined}
      />
      <CreatorsContent
        serverCreators={serverCreators}
        hasMoreProfiles={profiles.length >= 96}
        initialFilters={{
          query: Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "",
          city: Array.isArray(params.city) ? params.city[0] ?? "" : params.city ?? "",
          sort: Array.isArray(params.sort) ? params.sort[0] ?? "" : params.sort ?? "",
        }}
      />
    </div>
  );
}
