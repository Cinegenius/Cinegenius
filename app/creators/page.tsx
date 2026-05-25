import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import CreatorsContent, { type ServerCreator } from "./CreatorsContent";
import PageHeader from "@/components/PageHeader";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { getTranslations } from "next-intl/server";

// All profile types shown on this page (crew, talent, creative + vendors/renters)
const CREATOR_TYPES = new Set(
  (Object.entries(PROFILE_CATEGORY_MAP) as [ProfileType, string][]).map(([type]) => type)
);

const VENDOR_TYPES = new Set(
  (Object.entries(PROFILE_CATEGORY_MAP) as [ProfileType, string][])
    .filter(([, cat]) => cat === "vendor")
    .map(([type]) => type)
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

export default async function CreatorsPage() {
  const t = await getTranslations("creators");
  const tCommon = await getTranslations("common");
  const { userId } = await auth();
  let hasProfile = false;
  if (userId) {
    const { data } = await db.from("profiles").select("display_name").eq("user_id", userId).single();
    hasProfile = !!(data?.display_name);
  }
  // Fetch creator listings
  const { data: listings } = await db
    .from("listings")
    .select("id, user_id, title, category, city, price, image_url, description")
    .eq("published", true)
    .eq("type", "creator")
    .order("created_at", { ascending: false })
    .limit(300);


  // Fetch profiles — limit initial load to 96 for fast page render
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name, location, bio, skills, role, positions, available, avatar_url, portfolio_url, portfolio_images, languages, profile_types, profile_type, physical, availability_config, day_rate, travel_ready, verified, tagline, focal_point, last_seen_at")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .order("created_at", { ascending: false })
    .limit(96);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromListings: ServerCreator[] = (listings ?? []).map((l: any) => {
    const { skills, credits } = parseCreatorDescription(l.description ?? "");
    return {
      id: `listing_${l.id}`,        // prefix to avoid collision with user IDs
      name: l.title,
      role: l.category ?? "Filmschaffende/r",
      positions: l.category ? [l.category] : [],
      location: l.city ?? "",
      image: l.image_url ?? "",
      avatar: l.image_url ?? "",
      rating: 0,
      reviews: 0,
      dayRate: l.price > 0 ? `${l.price} €/Tag` : tCommon("byArrangement"),
      available: true,
      credits,
      skills,
      verified: false,
      isReal: true,
    };
  });

  // User IDs that already have a creator listing → suppress their profile card
  const listingOwnerIds = new Set(
    (listings ?? []).map((l: { user_id?: string }) => l.user_id).filter(Boolean)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromProfiles: ServerCreator[] = (profiles ?? [])
    .filter((p: any) => {
      // Don't show a second card for users who already have a creator listing
      if (listingOwnerIds.has(p.user_id)) return false;
      const types: string[] = p.profile_types ?? [];
      // Show if any profile type belongs on this page (talent / crew / creative)
      if (types.some((t) => CREATOR_TYPES.has(t as ProfileType))) return true;
      // No profile type set yet (new/incomplete profile) → show by default
      if (types.length === 0) return true;
      return false;
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => {
      const phys = p.physical ?? {};
      const avail = p.availability_config ?? {};
      // Pick a human-readable role label from the profile types
      const primaryType = (p.profile_types?.[0] ?? p.profile_type ?? "") as ProfileType;
      const typeLabel = primaryType ? (PROFILE_TYPE_LABELS[primaryType] ?? "") : "";
      return {
        id: p.user_id,
        name: p.display_name ?? "Unbekannt",
        role: p.role ?? p.positions?.[0] ?? typeLabel ?? "Filmschaffende/r",
        positions: p.positions?.length ? p.positions : (typeLabel ? [typeLabel] : []),
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
        isVendor: VENDOR_TYPES.has(primaryType),
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

  // Fetch ratings with correct target_type per source
  const listingDbIds = (listings ?? []).map((l: { id: string }) => l.id);
  const profileUserIds = fromProfiles.map((c) => c.id);
  const [listingRatings, profileRatings] = await Promise.all([
    fetchRatings(listingDbIds, "listing"),
    fetchRatings(profileUserIds, "user"),
  ]);

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

  // Avatar strip — only real user-uploaded avatars (Supabase storage URLs)
  const avatarImages = [...fromListings, ...fromProfiles]
    .filter((c) => c.avatar?.includes("supabase.co/storage"))
    .map((c) => ({ src: c.avatar, alt: c.name, href: `/creators/${c.id}` }))
    .sort((a, b) => a.alt.localeCompare(b.alt));

  return (
    <div style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(251,146,60,0.03) 0%, transparent 50%)" }}>
      <PageHeader
          badge="Crew"
          title={t("heroTitle")}
          titleHighlight={t("heroTitleHighlight")}
          description={t("heroDesc")}
          accentRgb="251,146,60"
          cta={!hasProfile ? { label: t("heroCta"), href: "/profile" } : undefined}
        />
      <CreatorsContent serverCreators={serverCreators} hasStrip={true} />
    </div>
  );
}
