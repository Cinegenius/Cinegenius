import HomeOrganizations from "@/components/organizations/HomeOrganizations";
import { listingPriceLabel } from "@/lib/listing-price";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getListingProviders } from "@/lib/listing-provider";
import { listingDetailPath } from "@/lib/listing-routes";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "@/components/MediaImage";
import { getTranslations, getLocale } from "next-intl/server";
import { Suspense } from "react";
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
  Zap, Shield, Clock, Package2, Building2, UsersRound, Film,
} from "lucide-react";
import HeroSearch from "@/components/HeroSearch";
import CommunityBoard from "@/components/CommunityBoard";
import HomeCompanyPartners from "@/components/HomeCompanyPartners";
import { PageBackdrop } from "@/components/PageHeader";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { HomePhotoDiscovery, type DiscoverPhoto } from "@/components/HomePhotoDiscovery";
import { PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { isPeopleDirectoryProfile } from "@/lib/profile-provider-filters";
import { getPrivateProfileIds } from "@/lib/trust";
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

async function getHomeData(viewerId: string | null) {
  const uiProfileText = await getTranslations();
  const PROFILE_TYPE_LABELS = getLocalizedProfileTypeLabels(uiProfileText);

  const market=await getTranslations("MarketplaceOffer"),marketLocale=await getLocale();
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
      projects: [],
      newCrew: [],
      ratedPhotos: [],
      newPhotos: [],
      currentTime,
    };
  }

  const results = await Promise.all([
    db.from("listings").select("id,title,city,price,image_url,metadata,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(3),
    db.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    db.from("listings").select("id,user_id,company_id,responsible_person,title,city,price,image_url,type,metadata,created_at").in("type", ["prop", "vehicle"]).eq("published", true).order("created_at", { ascending: false }).limit(4),
    db.from("companies").select("id,slug,name,logo_url,city,categories").eq("published", true).order("created_at", { ascending: false }).limit(6),
    db.from("profiles").select("user_id,slug,display_name,tagline,avatar_url,location,verified,role,positions,profile_type,profile_types,created_at").not("display_name", "is", null).neq("display_name", "").order("created_at", { ascending: false }).limit(300),
    db.from("projects").select("id,title,year,type,director").order("year", { ascending: false }).limit(3),
  ]);
  if (results.some(result => result.error)) throw new Error("Homepage recommendations unavailable");
  const [
    { data: recentLocations },
    { data: recentJobs },
    { data: recentProps },
    { data: liveCompanies },
    { data: profilesRaw },
    { data: recentProjects },
  ] = results;

  const profileRows = (profilesRaw ?? []) as HomeProfileRow[];
  const privateIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const publicProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));
  const photosTask = getCommunityMedia({ limit: 24, viewerId, diverse: true, includeTotal: false, signal: AbortSignal.timeout(4000) }).catch(() => {
    console.error("[homepage] Photo discovery unavailable");
    return { photos: [] };
  });

  // Use the same eligibility rule as the people directory. Location and
  // marketplace providers are people too, even when they do not also choose
  // an invented crew occupation.
  const peopleProfiles = publicProfiles.filter(isPeopleDirectoryProfile);
  const { photos } = await photosTask;
  const newPhotos: DiscoverPhoto[] = photos.slice(0, 24);
  const peopleSummaries = peopleProfiles.map((profile) => {
    const types = [profile.profile_type, ...(profile.profile_types ?? [])].filter((type): type is string => Boolean(type));
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
    .slice(0, 4);

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

  const propProviders = await getListingProviders((recentProps ?? []).map((p) => ({ user_id: p.user_id, company_id: p.company_id, responsible_person: p.responsible_person })));
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

  const projects = (recentProjects ?? []).map((project: { id: string; title: string; year: number | null; type: string | null; director: string | null }) => ({
    id: project.id,
    title: project.title,
    year: project.year,
    type: project.type,
    director: project.director,
  }));

  return {
    liveLocations,
    liveJobs,
    liveProps,
    companies,
    projects,
    newCrew,
    ratedPhotos: [],
    newPhotos,
    currentTime,
  };
}

async function HomeRecommendations({ viewerId }: { viewerId: string | null }) {
  const uiText = await getTranslations();
  const uiLocale = await getLocale();

  const [t, tc] = await Promise.all([getTranslations("home"), getTranslations("common")]);
  let data: Awaited<ReturnType<typeof getHomeData>>;
  try {
    data = await getHomeData(viewerId);
  } catch {
    console.error("[homepage] Recommendations unavailable");
    return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><p role="status" className="rounded-xl border border-border bg-bg-secondary px-4 py-6 text-sm text-text-muted">{t("recommendationsUnavailable")}</p></section>;
  }
  const { liveLocations, liveJobs, liveProps, companies, projects, newCrew, newPhotos, currentTime } = data;

  function formatDate(iso: string): string {
    if (!iso) return "";
    const diff = Math.floor((currentTime - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return tc("today");
    if (diff === 1) return tc("yesterday");
    if (diff < 7) return tc("daysAgo", { days: diff });
    if (diff < 14) return tc("weekAgo");
    return tc("weeksAgo", { weeks: Math.floor(diff / 7) });
  }

  return <>
      <HomePhotoDiscovery ratedPhotos={[]} newPhotos={newPhotos} />

      {/* ══════════════════════════════════════════════
          FEATURED LOCATIONS
      ══════════════════════════════════════════════ */}
      {liveLocations.length > 0 && (
        <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("locationsLabel")}</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("locationsTitle")}</h2>
              </div>
              <Link href="/locations" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium shrink-0">
                {tc("viewAll")} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveLocations.map((loc) => (
                <Link key={loc.id} href={`/locations/${loc.id}`} className="card-hover group rounded-xl border border-border bg-bg-elevated overflow-hidden block">
                  <div className="relative overflow-hidden aspect-video bg-bg-elevated">
                    {loc.image ? (
                      <Image
                        src={loc.image}
                        alt={loc.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        style={{ objectPosition: loc.focalPoint ? `${loc.focalPoint.x}% ${loc.focalPoint.y}%` : "50% 50%" }}
                        sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
                      />
                    ) : <div className="absolute inset-0 flex items-center justify-center text-text-muted/30"><MapPin size={36} aria-hidden="true" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/70 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="font-semibold text-white text-sm leading-tight">{loc.title}</h3>
                      <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {loc.city}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    {loc.isNew ? (
                      <span className="text-xs font-semibold text-gold">{tc("newBadge")}</span>
                    ) : (
                      <span className="text-xs text-text-muted">{formatDate(loc.created_at)}</span>
                    )}
                    <span className="text-sm font-semibold text-gold">
                      {loc.priceLabel}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          NEWEST PEOPLE PROFILES
      ══════════════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("newCrewLabel")}</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("newCrewTitle")}</h2>
                <p className="mt-1 text-xs text-text-muted">{t("newCrewDescription")}</p>
              </div>
              <Link href="/creators?sort=rating" className="inline-flex min-h-11 max-w-full items-center gap-1 text-sm text-gold hover:text-gold-light font-medium sm:max-w-[45%]">
                <span className="min-w-0 break-words">{t("discoverCrew")}</span> <ArrowRight size={14} className="shrink-0" />
              </Link>
            </div>
            {newCrew.length > 0 ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {newCrew.map((c) => (
                <Link
                  key={c.id}
                  href={`/profile/${c.slug}`}
                  className="group card-hover rounded-2xl border border-border bg-bg-secondary hover:border-gold/30 transition-all overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-square bg-bg-elevated overflow-hidden">
                    {c.avatar ? (
                      <Image
                        src={c.avatar}
                        alt={c.name}
                        fill
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
            </div> : <div className="rounded-xl border border-border bg-bg-secondary px-4 py-8 text-center text-sm text-text-muted">{t("noCrewProfiles")}</div>}
          </div>
      </section>


      {/* ══════════════════════════════════════════════
          MARKTPLATZ / PROPS
      ══════════════════════════════════════════════ */}
      {liveProps.length > 0 && (
        <section className="relative overflow-hidden border-y border-gold/20 bg-bg-secondary/90 py-7 sm:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(185,255,36,0.10),transparent_35%)]" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
                  <Package2 size={14} aria-hidden="true" />
                  {t("pillarMarketplaceTitle")}
                </div>
                <h2 className="max-w-3xl font-display text-2xl font-bold leading-tight text-text-primary sm:text-4xl">
                  {t("pillarMarketplaceTitle")}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-5 text-text-secondary sm:mt-2 sm:text-base sm:leading-6">
                  {t("pillarMarketplaceDesc")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Link href="/marketplace" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-3 text-center text-sm font-semibold text-bg-primary transition-colors hover:bg-gold-light sm:min-h-12 sm:px-5">
                  {tc("viewAll")} <ArrowRight size={15} />
                </Link>
                <Link href="/guided-listing?type=equipment" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-bg-primary/70 px-3 text-center text-sm font-semibold text-text-primary transition-colors hover:border-gold/40 hover:text-gold sm:min-h-12 sm:px-5">
                  {t("pillarMarketplaceCta")} <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              {liveProps.map((prop) => (
                <Link
                  key={prop.id}
                  href={prop.detailHref ?? "/props"}
                  className="card-hover group block overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-lg shadow-black/10 transition-colors hover:border-gold/35"
                >
                  <div className="relative aspect-square overflow-hidden bg-bg-elevated sm:aspect-video">
                    {prop.image ? <Image
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
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          COMPANIES
      ══════════════════════════════════════════════ */}
      {companies.length > 0 && (
        <section className="py-10 sm:py-14 bg-bg-secondary/75 border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("companiesLabel")}</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("companiesTitle")}</h2>
              </div>
              <Link href="/companies" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium shrink-0">
                {tc("viewAll")} <ArrowRight size={14} />
              </Link>
            </div>
            <HomeCompanyPartners companies={companies.map(c => ({
              id: c.id, href: `/companies/${c.slug ?? c.id}`, name: c.name,
              logo: c.logo, city: c.city,
              category: COMPANY_CATEGORIES.find(category => category.id === c.category)?.label,
            }))} />
          </div>
        </section>
      )}

      <Suspense fallback={null}><HomeOrganizations /></Suspense>
      {/* ══════════════════════════════════════════════
          JOBS
      ══════════════════════════════════════════════ */}
      {liveJobs.length > 0 && <section className="py-10 sm:py-14 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("jobsLabel")}</p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("jobsTitle")}</h2>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium shrink-0">
              {tc("viewAll")} <ArrowRight size={14} />
            </Link>
          </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {liveJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="card-hover group flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <Briefcase size={16} className="text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary text-sm truncate">{job.title}</h3>
                    <p className="text-xs text-text-muted truncate">{job.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gold">
                      {job.rawPrice ? uiText("Ui.text_8ae8849cdb3aaa", { value1: String(job.rawPrice.toLocaleString(uiLocale)), value2: String(tc("perDay")) }) : tc("onRequest")}
                    </p>
                    <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5 justify-end">
                      <Clock size={9} /> {formatDate(job.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
        </div>
      </section>}

      {projects.length > 0 && <section className="py-8 sm:py-10 border-b border-border" aria-labelledby="home-projects-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("projectsLabel")}</p>
              <h2 id="home-projects-title" className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("projectsTitle")}</h2>
            </div>
            <Link href="/projects/alle" className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-medium text-gold hover:text-gold-light">{tc("viewAll")} <ArrowRight size={14} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="card-hover group flex min-w-0 items-start gap-3 rounded-xl border border-border bg-bg-secondary p-4 hover:border-gold/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10"><Film size={17} className="text-gold" /></div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-gold">{project.title}</h3>
                <p className="mt-1 truncate text-xs text-text-muted">{[project.type, project.year, project.director].filter(Boolean).join(" · ")}</p>
              </div>
            </Link>)}
          </div>
        </div>
      </section>}
  </>;
}

export default async function HomePage() {
  const { userId } = await auth();
  const isLoggedIn = !!userId;
  const ctaHref = isLoggedIn ? "/dashboard" : "/sign-up";

  const t = await getTranslations("home");

  const findCards = [
    { title: t("findLocationsTitle"), description: t("findLocationsDescription"), href: "/locations", icon: MapPin },
    { title: t("findCrewTitle"), description: t("findCrewDescription"), href: "/creators", icon: UsersRound },
    { title: t("findEquipmentTitle"), description: t("findEquipmentDescription"), href: "/props", icon: Package2 },
    { title: t("findCompaniesTitle"), description: t("findCompaniesDescription"), href: "/companies", icon: Building2 },
  ];

  return (
    <main className="relative isolate min-h-screen">
      <PageBackdrop
        optimizeImage
        image="/hero-bg-v2.jpg"
        imagePosition="center 42%"
        imageOpacity={100}
        overlayClassName="absolute inset-0 bg-bg-primary/72"
        className="pointer-events-none fixed inset-0 z-[-1]"
      />
      {/* ══════════════════════════════════════════════
          HERO — minimal, kein Leerraum
      ══════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-11 text-center">
          <h1 className="font-display text-[2rem] sm:text-[2.8rem] font-bold tracking-tight text-text-primary mb-2 leading-tight">
            {t("homepageTitle")}
          </h1>
          <p className="mx-auto mb-5 max-w-2xl text-text-muted text-sm sm:text-base">
            {t("homepageDescription")}
          </p>
          <div className="mb-5 flex flex-col min-[440px]:flex-row items-stretch justify-center gap-2">
            <Link href="/search" prefetch className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-bg-primary shadow-lg shadow-gold/15 transition-colors hover:bg-gold-light">
              {t("heroSearchAction")} <ArrowRight size={15} />
            </Link>
            <Link href={ctaHref} prefetch className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-bg-primary/50 px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-gold hover:text-gold">
              {isLoggedIn ? t("heroManageAction") : t("heroPresentAction")} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="max-w-xl mx-auto">
            <HeroSearch />
          </div>
        </div>
        <AiDisclosureBadge source="/hero-bg-v2.jpg" subtle className="absolute bottom-0.5 right-4 z-10 sm:right-6 lg:right-8" />
      </section>

      {/* Finden: kompakte, direkte Einstiege in die bestehenden Verzeichnisse */}
      <section className="py-8 sm:py-10" aria-labelledby="home-find-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("findLabel")}</p>
            <h2 id="home-find-title" className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("findTitle")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {findCards.map(({ title, description, href, icon: Icon }) => (
              <Link key={href} href={href} className="group min-w-0 rounded-xl border border-border bg-bg-secondary/90 p-3.5 transition-colors hover:border-gold/40 sm:p-4">
                <Icon size={18} className="mb-2 text-gold" />
                <h3 className="text-sm font-semibold leading-snug text-text-primary group-hover:text-gold">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
              </Link>
            ))}
            <div className="col-span-2 min-w-0 rounded-xl border border-border bg-bg-secondary/90 p-3.5 sm:p-4 lg:col-span-1">
              <Film size={18} className="mb-2 text-gold" />
              <h3 className="text-sm font-semibold leading-snug text-text-primary">{t("findJobsTitle")}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{t("findJobsDescription")}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                <Link href="/jobs" className="inline-flex min-h-8 items-center gap-1 text-gold hover:text-gold-light">{t("findJobsLink")} <ArrowRight size={12} /></Link>
                <Link href="/projects/alle" className="inline-flex min-h-8 items-center gap-1 text-gold hover:text-gold-light">{t("findProjectsLink")} <ArrowRight size={12} /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Anbieter verständlich ansprechen, ohne neue Produktwege zu erfinden */}
      <section className="border-y border-border bg-bg-secondary/55 py-8 sm:py-10" aria-labelledby="home-offer-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("offerLabel")}</p>
            <h2 id="home-offer-title" className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("offerTitle")}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: t("offerLocationTitle"), description: t("offerLocationDescription"), action: t("offerLocationAction"), href: isLoggedIn ? "/inserat" : "/sign-up", icon: MapPin },
              { title: t("offerTalentTitle"), description: t("offerTalentDescription"), action: t("offerTalentAction"), href: isLoggedIn ? "/profile" : "/sign-up", icon: UsersRound },
              { title: t("offerEquipmentTitle"), description: t("offerEquipmentDescription"), action: t("offerEquipmentAction"), href: isLoggedIn ? "/inserat" : "/sign-up", serviceAction: t("offerServicesAction"), serviceHref: isLoggedIn ? "/company-setup" : "/sign-up", icon: Package2 },
            ].map(({ title, description, action, href, serviceAction, serviceHref, icon: Icon }) => (
              <article key={title} className="min-w-0 rounded-xl border border-border bg-bg-primary/70 p-4 sm:p-5">
                <Icon size={18} className="mb-2 text-gold" />
                <h3 className="font-semibold text-text-primary">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{description}</p>
                <Link href={href} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-light">{action} <ArrowRight size={14} /></Link>
                {serviceAction && serviceHref && <Link href={serviceHref} className="mt-1 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-gold">{serviceAction} <ArrowRight size={14} /></Link>}
              </article>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<div aria-hidden="true" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><SkeletonBox className="mb-4 h-6 w-48" /><SkeletonBox className="h-28 w-full" /></div>}>
        <HomeRecommendations viewerId={userId} />
      </Suspense>


      <section className="border-y border-border bg-bg-secondary/55 py-8 sm:py-10" aria-labelledby="home-how-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("howLabel")}</p>
            <h2 id="home-how-title" className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("howTitle")}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-bg-primary/70 p-4 sm:p-5">
              <h3 className="font-semibold text-text-primary">{t("howSearchTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t("howSearchSteps")}</p>
            </article>
            <article className="rounded-xl border border-border bg-bg-primary/70 p-4 sm:p-5">
              <h3 className="font-semibold text-text-primary">{t("howOfferTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t("howOfferSteps")}</p>
            </article>
          </div>
        </div>
      </section>

      {/* Community-Ergänzung steht bewusst nach den Verzeichnissen und dem Fotoband. */}
      <CommunityBoard loggedIn={isLoggedIn} />

      {/* ══════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════ */}
      <div className="bg-bg-secondary/75 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 sm:px-6 py-5">
          <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-5">
            {[
              { icon: Shield,      text: t("trustPayment"),  sub: t("trustPaymentSub") },
              { icon: CheckCircle, text: t("trustVerified"), sub: t("trustVerifiedSub") },
              { icon: Zap,         text: t("trustFree"),     sub: t("trustFreeSub") },
              { icon: Clock,       text: t("trustRegion"),   sub: t("trustRegionSub") },
            ].map(({ icon: Icon, text, sub }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary leading-tight">{text}</p>
                  <p className="text-[10px] text-text-muted">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section className="py-12 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-subtle/80 via-bg-primary/70 to-bg-primary/70" />
        <div className="absolute inset-0 border-t border-b border-gold/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-text-primary mb-3 leading-tight">
            {t("ctaTitle")}<br />
            <span className="text-gradient-gold">{t("ctaTitleHighlight")}</span>
          </h2>
          <p className="text-text-muted text-sm leading-relaxed max-w-sm mx-auto mb-8">
            {isLoggedIn ? t("ctaLoggedInDesc") : t("ctaDesc")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-light text-bg-primary font-bold rounded-xl transition-all text-sm shadow-lg shadow-gold/20"
            >
              {isLoggedIn ? t("heroManageAction") : t("ctaPrimary")} <ArrowRight size={15} />
            </Link>
            <Link
              href="/inserat"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-border text-text-primary font-semibold rounded-xl hover:border-gold hover:text-gold transition-all text-sm"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
          {!isLoggedIn && <p className="text-[11px] text-text-muted mt-4">{t("ctaFootnote")}</p>}
        </div>
      </section>
    </main>
  );
}
