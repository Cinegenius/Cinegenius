import { placeReadFields } from "@/lib/places/catalog";
import { isPeopleDirectoryProfile } from "@/lib/profile-provider-filters";
import { crewOccupationIds } from "@/lib/crew-occupations";
import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import { getPrivateProfileIds } from "@/lib/trust";
import CreatorsContent, { type ServerCreator } from "./CreatorsContent";
import { primaryOccupationForPositions, occupationReference } from "@/lib/primary-occupation";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { getProfileDisplayPositions, normalizeProfileTypes } from "@/lib/profile-display";
import { getTranslations, getLocale } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

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
  crew: { primaryOccupation?: unknown; occupations?: unknown } | null;
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
        .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, user_id, title, category, city, price, image_url, description")
        .eq("published", true)
        .eq("type", "creator")
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("profiles")
        .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, bio, skills, role, positions, crew, available, avatar_url, portfolio_images, languages, profile_types, profile_type, physical, availability_config, day_rate, travel_ready, verified, tagline, focal_point, last_seen_at")
        .not("display_name", "is", null)
        .neq("display_name", "")
        .order("display_name", { ascending: true })
        .order("user_id", { ascending: true })
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
  ["people-directory-alphabetical-v8"],
  { revalidate: 60, tags: ["creator-directory", "profiles", "listings"] },
);

export const revalidate = 60;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/creators" },
  title: tMetadata('m_177de5567cb4'),
  description: tMetadata('m_65995207208d'),
  keywords: [tMetadata('m_e54dabc25ec8'), tMetadata('m_82e523280085'), tMetadata('m_ac88802c1689'), tMetadata('m_0cc63a71479c'), tMetadata('m_e57913375963'), tMetadata('m_b7a6dbd670b8')],
  openGraph: {
    title: tMetadata('m_a9f10b644ea2'),
    description: tMetadata('m_80d5794fa4d8'),
  },
};
}

function getLocalizedProfileTypeLabels(translate: (key: string) => string): typeof PROFILE_TYPE_LABELS { return { actor: translate("menu.crewActors"), model: translate("MarketplaceOffer.fields.model"), extra: translate("Ui.text_359b6b495d37ee"), host: translate("Ui.text_0a95f0e5c8dfe9"), dancer: translate("Ui.text_edbf4c8ebb46d7"), stunt: translate("Ui.text_b84275027d70dc"), voiceover: translate("Ui.text_ecd65813175a41"), creator: translate("Ui.text_d952b2e69292db"), camera: translate("menu.crewCamera"), lighting: translate("Ui.text_df58636dc4a76c"), sound: translate("menu.crewSound"), director_of_photography: translate("Ui.text_e0e64895eb6431"), director: translate("menu.crewDirection"), production: translate("menu.crewProduction"), makeup: translate("Ui.text_93c744e1d17b9a"), costume: translate("Ui.text_a21ae87ef519df"), postproduction: translate("Ui.text_212f3b80ce86c2"), vfx: translate("Ui.text_23d20474305ac3"), sfx: translate("menu.marketSfx"), art_department: translate("Ui.text_a92fc587a90c16"), broadcast: translate("Ui.text_17bc9178343601"), filmmaker: translate("Ui.text_93ecd734fdc054"), writer: translate("Ui.text_fec099ea8a39bd"), photographer: translate("menu.crewPhotographer"), editor: translate("Ui.text_0e4eb4156e02e7"), motion_designer: translate("Ui.text_8213a51cdbc986"), art_director: translate("Ui.text_2d3b48143ed2b9"), location: translate("locations.vendorSection"), equipment: translate("props.vendorSection"), vehicle: translate("Ui.text_758a6eefc6f22f"), studio: translate("Ui.text_3e35f07c14a89e"), props: translate("Ui.text_54d1cc854cc30d") }; }

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
  const uiText = await getTranslations();
  const PROFILE_TYPE_LABELS = getLocalizedProfileTypeLabels(uiText);


  const locale = await getLocale();
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
      occupationIds: crewOccupationIds({positions: l.category ? [l.category] : []}),
      location: l.city ?? "",
        ...placeReadFields(l.city ?? "", l, locale),
      image: l.image_url ?? "",
      avatar: l.image_url ?? "",
      rating: 0,
      reviews: 0,
      dayRate: (l.price ?? 0) > 0 ? uiText("Ui.text_4519fabedb2cbd", { value1: Number(l.price).toLocaleString(locale) }) : tCommon("byArrangement"), dayRateOnRequest: !((l.price ?? 0) > 0),
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

      return isPeopleDirectoryProfile(p);
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
        name: p.display_name ?? uiText("Ui.text_276ffa1fb4f970"),
        role: p.role ?? displayPositions[0] ?? typeLabel ?? "Filmschaffende/r",
        positions: displayPositions,
        primaryOccupation: occupationReference(primaryOccupationForPositions(p.crew?.primaryOccupation, p.positions ?? [], p.role)),
        occupationIds: crewOccupationIds(p),
        location: p.location ?? "",
        ...placeReadFields(p.location ?? "", p, locale),
        // cover: prefer first portfolio image, fall back to avatar
        image: (Array.isArray(p.portfolio_images) && p.portfolio_images.length > 0)
          ? p.portfolio_images[0]
          : (p.avatar_url ?? ""),
        avatar: p.avatar_url ?? "",
        rating: 0,
        reviews: 0,
        dayRate: p.day_rate ? uiText("Ui.text_4519fabedb2cbd", { value1: Number(p.day_rate).toLocaleString(locale) }) : tCommon("byArrangement"), dayRateOnRequest: !(p.day_rate),
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
    <DirectoryPage area="crew">
      <PageHeader
        withBackdrop={false}
        badge={uiText("nav.crew")}
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
          cityText: Array.isArray(params.cityText) ? params.cityText[0] ?? "" : params.cityText ?? "",
          country: Array.isArray(params.country) ? params.country[0] ?? "" : params.country ?? "",
          region: Array.isArray(params.region) ? params.region[0] ?? "" : params.region ?? "",
          sort: Array.isArray(params.sort) ? params.sort[0] ?? "" : params.sort ?? "",
        }}
      />
    </DirectoryPage>
  );
}
