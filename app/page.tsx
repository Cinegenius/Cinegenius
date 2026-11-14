import { homeMarketplaceOffers } from "@/lib/home-marketplace";
import HomeOrganizations from "@/components/organizations/HomeOrganizations";
import { listingPriceLabel } from "@/lib/listing-price";
import { db } from "@/lib/db";
import { getListingProviders } from "@/lib/listing-provider";
import { listingDetailPath } from "@/lib/listing-routes";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "@/components/MediaImage";
import ListingImage from "@/components/ListingImage";
import { getTranslations, getLocale } from "next-intl/server";
import { Fragment, Suspense } from "react";
import { SkeletonBox } from "@/components/Skeleton";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/" },
  title: tMetadata('m_010d820e3a26'),
  description: tMetadata('m_7055aabe2bd3'),
  keywords: [tMetadata('m_74826d9e051a'), tMetadata('m_63f1bb517ac1'), tMetadata('m_d9753ec6bbbb'), tMetadata('m_9a871cebc0d9'), tMetadata('m_60e020d36246'), tMetadata('m_7a9a84b10b4d'), tMetadata('m_89a6dff9be40'), tMetadata('m_9b949f719483')],
  openGraph: {
    title: tMetadata('m_87ce3bba89a8'),
    description: tMetadata('m_d31d8b89cb0e'),
  },
};
}

export const revalidate = 60;

import {
  MapPin, Briefcase, ArrowRight, CheckCircle,
  Clock, Package2, Film, Building2, UsersRound, Newspaper,
} from "lucide-react";
import HeroSearch from "@/components/HeroSearch";
import HomeCommunityBoard from "@/components/HomeCommunityBoard";
import HomeCompanyPartners from "@/components/HomeCompanyPartners";
import HomeCardRail from "@/components/HomeCardRail";
import { PageBackdrop } from "@/components/PageHeader";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { HomePhotoDiscovery, type DiscoverPhoto } from "@/components/HomePhotoDiscovery";
import { PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { isPeopleDirectoryProfile } from "@/lib/profile-provider-filters";
import { getPrivateProfileIds } from "@/lib/trust";
import { taxonomyLabel } from "@/lib/departments";
import { getCommunityMedia } from "@/lib/community-media-server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

type HomeProfileRow = {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  tagline: string | null;
  avatar_url: string | null;
  location: string | null;
  verified: boolean | null;
  role: string | null;
  positions: string[] | null;
  profile_type: string | null;
  profile_types: string[] | null;
  created_at?: string | null;
};

function getLocalizedProfileTypeLabels(translate: (key: string) => string): typeof PROFILE_TYPE_LABELS { return { actor: translate("menu.crewActors"), model: translate("MarketplaceOffer.fields.model"), extra: translate("Ui.text_359b6b495d37ee"), host: translate("Ui.text_0a95f0e5c8dfe9"), dancer: translate("Ui.text_edbf4c8ebb46d7"), stunt: translate("Ui.text_b84275027d70dc"), voiceover: translate("Ui.text_ecd65813175a41"), creator: translate("Ui.text_d952b2e69292db"), camera: translate("menu.crewCamera"), lighting: translate("Ui.text_df58636dc4a76c"), sound: translate("menu.crewSound"), director_of_photography: translate("Ui.text_e0e64895eb6431"), director: translate("menu.crewDirection"), production: translate("menu.crewProduction"), makeup: translate("Ui.text_93c744e1d17b9a"), costume: translate("Ui.text_a21ae87ef519df"), postproduction: translate("Ui.text_212f3b80ce86c2"), vfx: translate("Ui.text_23d20474305ac3"), sfx: translate("menu.marketSfx"), art_department: translate("Ui.text_a92fc587a90c16"), broadcast: translate("Ui.text_17bc9178343601"), filmmaker: translate("Ui.text_93ecd734fdc054"), writer: translate("Ui.text_fec099ea8a39bd"), photographer: translate("menu.crewPhotographer"), editor: translate("Ui.text_0e4eb4156e02e7"), motion_designer: translate("Ui.text_8213a51cdbc986"), art_director: translate("Ui.text_2d3b48143ed2b9"), location: translate("locations.vendorSection"), equipment: translate("props.vendorSection"), vehicle: translate("Ui.text_758a6eefc6f22f"), studio: translate("Ui.text_3e35f07c14a89e"), props: translate("Ui.text_54d1cc854cc30d") }; }

async function getHomeData() {
  const [uiProfileText, market, marketLocale] = await Promise.all([getTranslations(), getTranslations("MarketplaceOffer"), getLocale()]);
  const PROFILE_TYPE_LABELS = getLocalizedProfileTypeLabels(uiProfileText);
  const currentTime = Date.now();
  const hasSupabaseCredentials = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Local copy-only previews should still render the homepage when the Vercel
  // Development environment has no database credentials. Production keeps
  // the normal failure behavior, and this mode never connects to live data.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.CINEGENIUS_LOCAL_PREVIEW === "1" &&
    !hasSupabaseCredentials
  ) {
    console.info("[homepage] Local preview without Supabase: dynamic sections are empty.");
    return {
      liveLocations: [],
      liveJobs: [],
      liveProps: [],
      companies: [],
      newCrew: [],
      currentTime,
    };
  }

  const results = await Promise.all([
    db.from("listings").select("id,title,city,price,image_url,metadata,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(10),
    db.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    homeMarketplaceOffers(currentTime),
    db.from("companies").select("id,slug,name,logo_url,city,categories").eq("published", true).order("created_at", { ascending: false }).limit(6),
    db.from("profiles").select("user_id,slug,display_name,tagline,avatar_url,location,verified,role,positions,profile_type,profile_types,created_at").not("display_name", "is", null).neq("display_name", "").order("created_at", { ascending: false }).limit(300),
  ]);
  if (results.some(result => result.error)) throw new Error("Homepage recommendations unavailable");
  const [
    { data: recentLocations },
    { data: recentJobs },
    { data: recentProps },
    { data: liveCompanies },
    { data: profilesRaw },
  ] = results;

  const profileRows = (profilesRaw ?? []) as HomeProfileRow[];
  // Independent permission-aware lookups run together; private profiles are
  // still excluded before any card is constructed. Never cache these results.
  const [privateIds, propProviders] = await Promise.all([
    getPrivateProfileIds(profileRows.map((profile) => profile.user_id)),
    getListingProviders((recentProps ?? []).map((p) => ({ user_id: p.user_id, company_id: p.company_id, responsible_person: p.responsible_person }))),
  ]);
  const publicProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));

  // Use the same eligibility rule as the people directory. Location and
  // marketplace providers are people too, even when they do not also choose
  // an invented crew occupation.
  const peopleProfiles = publicProfiles.filter(isPeopleDirectoryProfile);
  const peopleSummaries = peopleProfiles.map((profile) => {
    const positions = [...new Set([...(profile.positions ?? []), ...(profile.role ? [profile.role] : [])].map((position) => position.trim()).filter(Boolean))];
    if (positions.length === 0) {
      const profileTypes = [...new Set([profile.profile_type, ...(profile.profile_types ?? [])].filter((type): type is string => Boolean(type)))];
      positions.push(...profileTypes
        .filter((type): type is ProfileType => type in PROFILE_TYPE_LABELS)
        .map((type) => PROFILE_TYPE_LABELS[type]));
    }
    return {
      id: profile.user_id,
      slug: profile.slug || profile.user_id,
      name: profile.display_name ?? uiProfileText("Ui.text_51fb8dfa65e81e"),
      tagline: profile.tagline ?? undefined,
      avatar: profile.avatar_url?.trim() || undefined,
      city: profile.location?.split(",")[0]?.trim() ?? "",
      verified: profile.verified ?? false,
      positions,
      createdAt: profile.created_at ?? "",
    };
  });
  // Keep this homepage selection strictly chronological: the latest eligible
  // public people profiles always occupy the first positions.
  const newCrew = peopleSummaries
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, marketLocale))
    .slice(0, 10);

  const liveLocations = (recentLocations ?? []).map((l) => ({
    id: l.id as string,
    title: l.title as string,
    city: (l.city ?? "") as string,
    price: (l.price ?? 0) as number,
    priceLabel: listingPriceLabel(l.price,l.metadata,"/Tag",marketLocale,market),
    image: (l.image_url ?? "") as string,
    focalPoint: (((l.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null) ?? null,
    isNew: l.created_at ? (currentTime - new Date(l.created_at as string).getTime()) < 3 * 24 * 60 * 60 * 1000 : false,
    created_at: (l.created_at ?? "") as string,
  }));

  const liveJobs = (recentJobs ?? []).map((j) => ({
    id: j.id as string,
    title: j.title as string,
    location: (j.city ?? "") as string,
    rawPrice: j.price as number | null,
    created_at: (j.created_at ?? "") as string,
  }));

  const liveProps = (recentProps ?? []).map((p, index) => ({
    id: p.id as string,
    title: p.title as string,
    city: (p.city ?? "") as string,
    price: (p.price ?? 0) as number,
    priceLabel: listingPriceLabel(p.price,p.metadata,"/Tag",marketLocale,market),
    image: (p.image_url ?? "") as string,
    focalPoint: (((p.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null) ?? null,
    type: (p.type ?? "prop") as string,
    providerName: propProviders[index]?.name ?? uiProfileText("Ui.text_fb0adca8892ab2"),
    detailHref: listingDetailPath(p.type ?? "prop", p.id),
    created_at: (p.created_at ?? "") as string,
  }));

  const companies = (liveCompanies ?? []).map((c: { id: string; slug: string | null; name: string; logo_url: string | null; city: string | null; categories: string[] | null }) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    logo: c.logo_url,
    city: (c.city ?? "").split(",")[0]?.trim() ?? "",
    category: Array.isArray(c.categories) && c.categories.length > 0 ? c.categories[0] : null,
  }));

  return {
    liveLocations,
    liveJobs,
    liveProps,
    companies,
    newCrew,
    currentTime,
  };
}

type HomeDataPromise = Promise<Awaited<ReturnType<typeof getHomeData>> | null>;

async function HomeLocations({ dataPromise }: { dataPromise: HomeDataPromise }) {
  const [data, t, tc] = await Promise.all([dataPromise, getTranslations("home"), getTranslations("common")]);
  if (!data?.liveLocations.length) return null;
  return <section className="min-w-0" aria-labelledby="home-locations-title">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3"><h2 id="home-locations-title" className="font-display text-xl font-bold text-text-primary sm:text-2xl">{t("locationsTitle")}</h2><Link href="/locations" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold hover:text-gold-light sm:text-sm">{tc("viewAll")} <ArrowRight size={13} /></Link></div>
    <HomeCardRail id="home-locations-rail" labelledBy="home-locations-title" hint={t("locationScrollHint")} itemCount={data.liveLocations.length} variant="location" wide>
      {data.liveLocations.map(loc => <Link key={loc.id} href={`/locations/${loc.id}`} className="group relative isolate block aspect-[4/3] min-h-11 min-w-0 overflow-hidden rounded-2xl border border-border bg-bg-elevated sm:aspect-[3/2]">
        {loc.image ? <ListingImage src={loc.image} alt={loc.title} fill mediaSize="thumbnail" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" style={{ objectPosition: loc.focalPoint ? `${loc.focalPoint.x}% ${loc.focalPoint.y}%` : "50% 50%" }} sizes="(min-width:1024px) 33vw,(min-width:640px) 60vw,72vw" /> : <div className="absolute inset-0 flex items-center justify-center text-text-muted/30"><MapPin size={32} aria-hidden="true" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5"><h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{loc.title}</h3><div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"><span className="min-w-0 truncate text-white/75">{loc.city}</span><span className="font-semibold text-gold [overflow-wrap:anywhere]">{loc.priceLabel}</span></div></div>
      </Link>)}
    </HomeCardRail>
  </section>;
}

async function HomeCrew({ dataPromise }: { dataPromise: HomeDataPromise }) {
  const [data, t, tc] = await Promise.all([dataPromise, getTranslations("home"), getTranslations("common")]);
  if (!data?.newCrew.length) return null;
  const { newCrew } = data;
  return <section className="min-w-0" aria-labelledby="home-crew-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3"><h2 id="home-crew-title" className="font-display text-xl font-bold text-text-primary sm:text-2xl">{t("newCrewTitle")}</h2><Link href="/creators" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold hover:text-gold-light sm:text-sm">{tc("viewAll")} <ArrowRight size={13} /></Link></div>
      <HomeCardRail id="home-crew-rail" labelledBy="home-crew-title" hint={t("crewScrollHint")} itemCount={newCrew.length} variant="crew" wide>
        {newCrew.map((c) => (
                <Link
                  key={c.id}
                  href={`/profile/${c.slug}`}
                  className="group rounded-2xl border border-border bg-bg-secondary hover:border-gold/30 transition-colors overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-square bg-bg-elevated overflow-hidden">
                    {c.avatar ? (
                      <Image
                        src={c.avatar}
                        alt={c.name}
                        fill
                        mediaSize="thumbnail"
                        className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        sizes="(max-width:640px) 50vw,25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-bg-elevated flex items-center justify-center">
                        <span className="text-4xl font-display font-bold text-gold/40">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {c.verified && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                        <CheckCircle size={11} className="text-bg-primary" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-text-primary text-sm leading-snug mb-0.5">{c.name}</h3>
                    {c.positions.length > 0 && <p className="mb-1 line-clamp-2 text-[11px] leading-snug text-gold">{c.positions.join(" · ")}</p>}
                    {c.city && (
                      <p className="text-[11px] text-text-muted flex items-center gap-1 mb-1.5">
                        <MapPin size={9} /> {c.city}
                      </p>
                    )}
                    {c.tagline && (
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 flex-1 mb-2">{c.tagline}</p>
                    )}
                  </div>
                </Link>
              ))}
      </HomeCardRail>
    </section>;
}

async function HomeRecommendations({ dataPromise }: { dataPromise: HomeDataPromise }) {
  const [uiText, uiLocale, t, tc, data] = await Promise.all([getTranslations(), getLocale(), getTranslations("home"), getTranslations("common"), dataPromise]);
  if (!data) return <section className="site-container py-7"><p role="status" className="rounded-xl border border-border bg-bg-secondary px-4 py-6 text-sm text-text-muted">{t("recommendationsUnavailable")}</p></section>;
  const { liveJobs, liveProps, currentTime } = data;
  if (!liveJobs.length && !liveProps.length) return null;
  function formatDate(iso: string): string {
    if (!iso) return "";
    const diff = Math.floor((currentTime - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return tc("today");
    if (diff === 1) return tc("yesterday");
    if (diff < 7) return tc("daysAgo", { days: diff });
    if (diff < 14) return tc("weekAgo");
    return tc("weeksAgo", { weeks: Math.floor(diff / 7) });
  }
  return <div className="site-container grid items-start gap-7 py-7 sm:gap-8 sm:py-9">
    {liveProps.length > 0 && <section className="min-w-0" aria-labelledby="home-marketplace-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3"><h2 id="home-marketplace-title" className="font-display text-xl font-bold text-text-primary sm:text-2xl">{t("findEquipmentTitle")}</h2><Link href="/marketplace" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold hover:text-gold-light sm:text-sm">{tc("viewAll")} <ArrowRight size={13} /></Link></div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {liveProps.map((prop) => (
                <Link
                  key={prop.id}
                  href={prop.detailHref ?? "/props"}
                  className="card-hover group block overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-lg shadow-black/10 transition-colors hover:border-gold/35"
                >
                  <div className="relative aspect-square overflow-hidden bg-bg-elevated sm:aspect-video">
                    {prop.image ? <ListingImage
                      src={prop.image}
                      alt={prop.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      style={{ objectPosition: prop.focalPoint ? `${prop.focalPoint.x}% ${prop.focalPoint.y}%` : "50% 66%" }}
                      sizes="(max-width:1023px) 50vw,25vw"
                    /> : <div className="absolute inset-0 flex items-center justify-center text-text-muted/30"><Package2 size={36} aria-hidden="true" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/55 via-bg-primary/10 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary/80 backdrop-blur-sm border border-border text-[10px] font-semibold text-text-secondary">
                        <Package2 size={9} className="text-gold" />
                        {prop.type === "vehicle" ? uiText("AdminAccounts.contentKinds.vehicle") : uiText("companies.groupAusstattung")}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 sm:left-3 sm:right-3">
                      <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-white drop-shadow-md sm:text-sm">{prop.title}</h3>
                      {prop.city && (
                        <p className="text-[10px] sm:text-xs text-white/70 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {prop.city}
                        </p>
                      )}
                      <p className="mt-1 truncate text-[10px] text-white/75">{uiText.rich("Ui.text_c84554a48878b8", { value1: () => (prop.providerName) })}</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-xs text-text-muted truncate">{formatDate(prop.created_at)}</span>
                    <span className="text-xs sm:text-sm font-semibold text-gold whitespace-nowrap">
                      {prop.priceLabel}
                    </span>
                  </div>
                </Link>
              ))}
      </div>
    </section>}
    {liveJobs.length > 0 && <section className="min-w-0 border-t border-border/60 pt-4" aria-labelledby="home-jobs-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3"><h2 id="home-jobs-title" className="font-display text-lg font-bold text-text-primary">{t("jobsTitle")}</h2><Link href="/jobs" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold hover:text-gold-light">{tc("viewAll")} <ArrowRight size={12} /></Link></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {liveJobs.map(job => <Link key={job.id} href={`/jobs/${job.id}`} className="group flex min-h-11 min-w-0 items-start gap-2 rounded-xl border border-border/70 px-3 py-3 transition-colors hover:bg-bg-secondary/60">
          <Briefcase size={15} className="mt-0.5 shrink-0 text-gold" />
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-gold">{job.title}</h3><p className="mt-0.5 truncate text-xs text-text-muted">{job.location}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-text-muted"><Clock size={9} />{formatDate(job.created_at)}</p></div>
          <span className="shrink-0 text-right text-xs font-semibold text-gold">{job.rawPrice ? uiText("Ui.text_8ae8849cdb3aaa", { value1: String(job.rawPrice.toLocaleString(uiLocale)), value2: String(tc("perDay")) }) : tc("onRequest")}</span>
        </Link>)}
      </div>
    </section>}
  </div>;
}

async function HomePartnersAndLocations({ dataPromise }: { dataPromise: HomeDataPromise }) {
  const [data, uiText, t, tc] = await Promise.all([dataPromise, getTranslations(), getTranslations("home"), getTranslations("common")]);
  if (!data || (!data.companies.length && !data.liveLocations.length)) return null;
  const { companies } = data;
  return <div className="site-container grid items-start gap-7 py-7 sm:gap-8 sm:py-9">
    {companies.length > 0 && <section className="min-w-0" aria-labelledby="home-companies-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3"><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">{t("companiesLabel")}</p><h2 id="home-companies-title" className="font-display text-xl font-bold text-text-primary sm:text-2xl">{t("companiesTitle")}</h2></div><Link href="/companies" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold hover:text-gold-light sm:text-sm">{tc("viewAll")} <ArrowRight size={13} /></Link></div>
      <HomeCompanyPartners companies={companies.map(c => ({
        id: c.id, href: `/companies/${c.slug ?? c.id}`, name: c.name, logo: c.logo, city: c.city,
        category: taxonomyLabel(COMPANY_CATEGORIES.find(category => category.id === c.category)?.label ?? "", uiText) || undefined,
      }))} />
    </section>}
    <HomeLocations dataPromise={dataPromise} />
  </div>;
}

async function HomePhotoRecommendations({ viewerId }: { viewerId: string | null }) {
  if (process.env.NODE_ENV === "development" && process.env.CINEGENIUS_LOCAL_PREVIEW === "1" && !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) return null;
  let newPhotos: DiscoverPhoto[];
  try {
    const { photos } = await getCommunityMedia({ limit: 24, viewerId, diverse: true, includeTotal: false, signal: AbortSignal.timeout(4000) });
    newPhotos = photos.slice(0, 24);
  } catch {
    console.error("[homepage] Photo discovery unavailable");
    return null;
  }
  return <HomePhotoDiscovery ratedPhotos={[]} newPhotos={newPhotos} />;
}

export default async function HomePage() {
  // Public recommendation data is shared only within this page request.
  const dataPromise: HomeDataPromise = getHomeData().catch(() => {
    console.error("[homepage] Recommendations unavailable");
    return null;
  });
  const [{ userId }, t] = await Promise.all([auth(), getTranslations("home")]);
  const isLoggedIn = !!userId;
  const findCards = [
    { title: t("findLocationsTitle"), description: t("findLocationsDescription"), href: "/locations", icon: MapPin },
    { title: t("findCrewTitle"), description: t("findCrewDescription"), href: "/creators", icon: UsersRound },
    { title: t("findEquipmentTitle"), description: t("findEquipmentDescription"), href: "/props", icon: Package2 },
    { title: t("findCompaniesTitle"), description: t("findCompaniesDescription"), href: "/companies", icon: Building2 },
    { title: t("findJobsTitle"), description: t("findJobsDescription"), href: "/jobs", icon: Briefcase },
    { title: t("newsShortcut"), description: t("newsShortcutDescription"), href: "/news", icon: Newspaper },
  ];
  return <main className="relative isolate min-h-screen">
    <PageBackdrop optimizeImage image="/hero-bg-v2.jpg" imagePosition="center 42%" imageOpacity={100} overlayClassName="absolute inset-0 bg-bg-primary/72" className="pointer-events-none fixed inset-0 z-[-1]" />
    <section className="relative isolate pt-16">
      <div className="site-container grid items-start gap-5 py-6 sm:py-8 lg:gap-9">
        <div className="min-w-0">
          <p className="mb-2 flex w-full items-center justify-between gap-1 text-xs font-semibold uppercase tracking-widest text-gold">
            {t("badgeHero").split(" · ").map((topic, index) => <Fragment key={topic}>
              {index > 0 && <span aria-hidden="true">·</span>}
              <span>{topic}</span>
            </Fragment>)}
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-text-primary lg:text-5xl">{t("heroTitle1")} <span className="text-gradient-gold">{t("heroTitle2")}</span></h1>
          <p className="mb-4 mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">{t("homepageDescription")}</p>
          <HeroSearch />
        </div>
      {/* Finden: kompakte, direkte Einstiege in die bestehenden Verzeichnisse */}
      <section className="min-w-0" aria-labelledby="home-find-title">
        <div className="min-w-0">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("findLabel")}</p>
            <h2 id="home-find-title" className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("findTitle")}</h2>
          </div>
          <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {findCards.map(({ title, description, href, icon: Icon }) => (
              <Link key={href} href={href} className="group h-full min-h-11 min-w-0 rounded-xl border border-border bg-bg-secondary/90 p-3.5 transition-colors hover:border-gold/40 sm:p-4">
                <Icon size={18} className="mb-2 text-gold" aria-hidden="true" />
                <h3 className="break-words text-sm font-semibold leading-snug text-text-primary group-hover:text-gold">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
        <Suspense fallback={null}><HomeCrew dataPromise={dataPromise} /></Suspense>
      </div>
      <AiDisclosureBadge source="/hero-bg-v2.jpg" subtle className="absolute bottom-0.5 right-4 z-10 sm:right-6 lg:right-8" />
    </section>
    <Suspense fallback={null}><HomeOrganizations /></Suspense>
    <Suspense fallback={<div aria-hidden="true" className="site-container py-5"><SkeletonBox className="mb-3 h-6 w-48" /><SkeletonBox className="h-28 w-full" /></div>}><HomeRecommendations dataPromise={dataPromise} /></Suspense>
    <Suspense fallback={null}><HomePhotoRecommendations viewerId={userId} /></Suspense>
    <Suspense fallback={null}><HomePartnersAndLocations dataPromise={dataPromise} /></Suspense>
    <HomeCommunityBoard loggedIn={isLoggedIn} />
    <section className="site-container py-5 sm:py-7" aria-labelledby="home-projects-title"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-4"><h2 id="home-projects-title" className="flex items-center gap-2 text-sm font-medium text-text-muted"><Film size={15} aria-hidden="true" />{t("projectsTitle")}</h2><Link href="/projects/alle" className="inline-flex min-h-11 items-center gap-1 text-sm text-text-secondary hover:text-gold">{t("findProjectsLink")} <ArrowRight size={13} /></Link></div></section>
  </main>;
}
