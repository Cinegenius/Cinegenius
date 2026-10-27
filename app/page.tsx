import { listingPriceLabel } from "@/lib/listing-price";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getListingProviders } from "@/lib/listing-provider";
import { listingDetailPath } from "@/lib/listing-routes";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "@/components/MediaImage";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "CineGenius — Film, Fotografie und Content",
  description: "Finde Drehorte, Crew, Talente, Equipment und Dienstleister für dein nächstes Projekt – oder präsentiere deine Arbeit und dein Angebot.",
  keywords: ["Location mieten", "Crew buchen", "Fotostudio mieten", "Equipment leihen", "Content Production", "Filmproduktion", "Fotoshooting Location", "Creative Hub DACH"],
  openGraph: {
    title: "CineGenius — Der Marktplatz für Kreative",
    description: "Locations, Crew, Equipment und Jobs — für Film, Foto, Content und Werbung.",
  },
};

export const revalidate = 60;

import {
  MapPin, Briefcase, ArrowRight, Star, CheckCircle,
  Zap, Shield, Clock, Package2, Building2, UsersRound, Film,
} from "lucide-react";
import HeroSearch from "@/components/HeroSearch";
import CommunityBoard from "@/components/CommunityBoard";
import CompanyLogo from "@/components/CompanyLogo";
import { PageBackdrop } from "@/components/PageHeader";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { HomePhotoDiscovery, type DiscoverPhoto } from "@/components/HomePhotoDiscovery";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { getPrivateProfileIds } from "@/lib/trust";
import { fetchRatingSummaries } from "@/lib/ratings";
import { getCommunityMedia } from "@/lib/community-media-server";
import { rankByRatingConfidence } from "@/lib/rating-ranking";

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
  profile_images: unknown;
  portfolio_images: unknown;
  created_at?: string | null;
};

async function getHomeData(viewerId: string | null) {
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
      topCreators: [],
      newCrew: [],
      ratedPhotos: [],
      newPhotos: [],
      currentTime,
    };
  }

  const [
    { data: recentLocations },
    { data: recentJobs },
    { data: recentProps },
    { data: liveCompanies },
    { data: profilesRaw },
    { data: recentProjects },
  ] = await Promise.all([
    db.from("listings").select("id,title,city,price,image_url,metadata,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(3),
    db.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    db.from("listings").select("id,user_id,company_id,title,city,price,image_url,type,metadata,created_at").in("type", ["prop", "vehicle"]).eq("published", true).not("image_url", "is", null).order("created_at", { ascending: false }).limit(4),
    db.from("companies").select("id,slug,name,logo_url,city,categories").eq("published", true).order("created_at", { ascending: false }).limit(6),
    db.from("profiles").select("user_id,slug,display_name,tagline,avatar_url,location,verified,role,positions,profile_type,profile_types,profile_images,portfolio_images,created_at").not("display_name", "is", null).neq("display_name", "").order("created_at", { ascending: false }).limit(300),
    db.from("projects").select("id,title,year,type,director,poster_url").order("year", { ascending: false }).limit(3),
  ]);

  const profileRows = (profilesRaw ?? []) as HomeProfileRow[];
  const privateIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const publicProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));
  const { photos } = await getCommunityMedia({ limit: 24, viewerId, diverse: true });
  const profileIds = publicProfiles.map((profile) => profile.user_id);
  const crewRatingSummaries = await fetchRatingSummaries(profileIds, "user").catch(() => ({} as Awaited<ReturnType<typeof fetchRatingSummaries>>));
  const newPhotos: DiscoverPhoto[] = photos.slice(0, 24);

  const crewTypeLabels = new Set(
    (Object.entries(PROFILE_TYPE_LABELS) as [ProfileType, string][])
      .filter(([type]) => PROFILE_CATEGORY_MAP[type] === "crew")
      .map(([, label]) => label.toLocaleLowerCase("de")),
  );
  const crewProfiles = publicProfiles.filter((profile) => {
    const types = [profile.profile_type, ...(profile.profile_types ?? [])].filter((type): type is string => Boolean(type));
    if (types.some((type) => PROFILE_CATEGORY_MAP[type as ProfileType] === "crew")) return true;
    const positions = [...(profile.positions ?? []), profile.role ?? ""].map((position) => position.toLocaleLowerCase("de"));
    return positions.some((position) => [...crewTypeLabels].some((label) => position === label || position.includes(label)));
  });
  const crewSummaries = crewProfiles.map((profile) => {
    const summary = crewRatingSummaries[profile.user_id] ?? { rating: 0, reviews: 0, ratingOnly: 0 };
    const positions = [...new Set([...(profile.positions ?? []), ...(profile.role ? [profile.role] : [])].map((position) => position.trim()).filter(Boolean))];
    return {
      id: profile.user_id,
      slug: profile.slug || profile.user_id,
      name: profile.display_name ?? "CineGenius Mitglied",
      tagline: profile.tagline ?? undefined,
      avatar: typeof profile.avatar_url === "string" && profile.avatar_url.includes("supabase.co/storage") ? profile.avatar_url : undefined,
      city: profile.location?.split(",")[0]?.trim() ?? "",
      verified: profile.verified ?? false,
      positions,
      rating: summary.rating,
      reviews: summary.reviews,
      createdAt: profile.created_at ?? "",
    };
  });
  const topCreators = rankByRatingConfidence(
    crewSummaries.filter((profile) => profile.reviews >= 2),
    (profile) => profile.rating,
    (profile) => profile.reviews,
    (profile) => `${profile.name}:${profile.id}`,
  ).slice(0, 4);
  const newCrew = crewSummaries
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, "de"))
    .slice(0, 4);

  const liveLocations = (recentLocations ?? []).map((l) => ({
    id: l.id as string,
    title: l.title as string,
    city: (l.city ?? "") as string,
    price: (l.price ?? 0) as number,
    priceLabel: listingPriceLabel(l.price,l.metadata),
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

  const propProviders = await getListingProviders((recentProps ?? []).map((p) => ({ user_id: p.user_id, company_id: p.company_id })));
  const liveProps = (recentProps ?? []).map((p, index) => ({
    id: p.id as string,
    title: p.title as string,
    city: (p.city ?? "") as string,
    price: (p.price ?? 0) as number,
    priceLabel: listingPriceLabel(p.price,p.metadata),
    image: (p.image_url ?? "") as string,
    focalPoint: (((p.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null) ?? null,
    type: (p.type ?? "prop") as string,
    providerName: propProviders[index]?.name ?? "Anbieter wird geprüft",
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
    topCreators,
    newCrew,
    ratedPhotos: [],
    newPhotos,
    currentTime,
  };
}

export default async function HomePage() {
  const { userId } = await auth();
  const isLoggedIn = !!userId;
  const ctaHref = isLoggedIn ? "/dashboard" : "/sign-up";

  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  function formatDate(iso: string): string {
    if (!iso) return "";
    const diff = Math.floor((currentTime - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return tc("today");
    if (diff === 1) return tc("yesterday");
    if (diff < 7) return tc("daysAgo", { days: diff });
    if (diff < 14) return tc("weekAgo");
    return tc("weeksAgo", { weeks: Math.floor(diff / 7) });
  }

  const { liveLocations, liveJobs, liveProps, companies, projects, topCreators, newCrew, newPhotos, currentTime } = await getHomeData(userId);

  const findCards = [
    { title: t("findLocationsTitle"), description: t("findLocationsDescription"), href: "/locations", icon: MapPin },
    { title: t("findCrewTitle"), description: t("findCrewDescription"), href: "/creators", icon: UsersRound },
    { title: t("findEquipmentTitle"), description: t("findEquipmentDescription"), href: "/props", icon: Package2 },
    { title: t("findCompaniesTitle"), description: t("findCompaniesDescription"), href: "/companies", icon: Building2 },
  ];

  return (
    <main className="relative isolate min-h-screen">
      <PageBackdrop
        image="/hero-bg.jpg"
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
                    {loc.image && (
                      <Image
                        src={loc.image}
                        alt={loc.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        style={{ objectPosition: loc.focalPoint ? `${loc.focalPoint.x}% ${loc.focalPoint.y}%` : "50% 50%" }}
                        sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
                      />
                    )}
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
          TOP RATED CREATORS
      ══════════════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{topCreators.length >= 3 ? t("topCreatorsLabel") : t("newCrewLabel")}</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{topCreators.length >= 3 ? t("topCreatorsTitle") : t("newCrewTitle")}</h2>
                {topCreators.length < 3 && <p className="mt-1 text-xs text-text-muted">{t("newCrewDescription")}</p>}
              </div>
              <Link href="/creators?sort=rating" className="inline-flex min-h-11 max-w-full items-center gap-1 text-sm text-gold hover:text-gold-light font-medium sm:max-w-[45%]">
                <span className="min-w-0 break-words">{t("discoverCrew")}</span> <ArrowRight size={14} className="shrink-0" />
              </Link>
            </div>
            {(topCreators.length >= 3 || newCrew.length > 0) ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(topCreators.length >= 3 ? topCreators : newCrew).map((c) => (
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
                    {topCreators.length >= 3 && <div className="flex items-center gap-1.5 mt-auto">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={11}
                            className={i <= Math.round(c.rating) ? "text-gold fill-gold" : "text-border fill-border"}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-text-primary">{c.rating.toFixed(1)}</span>
                      <span className="text-[11px] text-text-muted">({c.reviews} {c.reviews === 1 ? "Bewertung" : "Bewertungen"})</span>
                    </div>}
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
        <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Marktplatz</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("pillarMarketplaceTitle")} — Equipment & Requisiten</h2>
              </div>
              <Link href="/props" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium shrink-0">
                {tc("viewAll")} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {liveProps.map((prop) => (
                <Link
                  key={prop.id}
                  href={prop.detailHref ?? "/props"}
                  className="card-hover group rounded-xl border border-border bg-bg-elevated overflow-hidden block"
                >
                  <div className="relative overflow-hidden aspect-video bg-bg-elevated">
                    <Image
                      src={prop.image}
                      alt={prop.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      style={{ objectPosition: prop.focalPoint ? `${prop.focalPoint.x}% ${prop.focalPoint.y}%` : "50% 66%" }}
                      sizes="(max-width:1023px) 50vw,25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/70 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary/80 backdrop-blur-sm border border-border text-[10px] font-semibold text-text-secondary">
                        <Package2 size={9} className="text-gold" />
                        {prop.type === "vehicle" ? "Fahrzeug" : "Equipment"}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 sm:left-3 sm:right-3">
                      <h3 className="font-semibold text-white text-xs sm:text-sm leading-tight line-clamp-2">{prop.title}</h3>
                      {prop.city && (
                        <p className="text-[10px] sm:text-xs text-white/70 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {prop.city}
                        </p>
                      )}
                      <p className="mt-1 truncate text-[10px] text-white/75">Anbieter: {prop.providerName}</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {companies.map((c) => (
                <Link key={c.id} href={`/companies/${c.slug ?? c.id}`} className="card-hover group flex flex-col items-center text-center gap-2">
                  <CompanyLogo src={c.logo} name={c.name} className="h-24 w-full sm:h-28" />
                  <div className="min-w-0 w-full">
                    <h3 className="font-semibold text-text-secondary group-hover:text-text-primary text-xs leading-snug break-words [overflow-wrap:anywhere] transition-colors">{c.name}</h3>
                    {c.category && (
                      <p className="text-[10px] text-gold/70 truncate">
                        {COMPANY_CATEGORIES.find(cat => cat.id === c.category)?.label}
                      </p>
                    )}
                    {c.city && <p className="text-[10px] text-text-muted truncate">{c.city}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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
                      {job.rawPrice ? `${job.rawPrice.toLocaleString()} €${tc("perDay")}` : tc("onRequest")}
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
