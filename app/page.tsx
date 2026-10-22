import type { Metadata } from "next";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "CineGenius — Locations, Crew & Equipment für Film, Foto und Content",
  description: "Locations mieten, Crew buchen, Equipment leihen, Jobs finden — der Marktplatz für Kreative. Für Film, Fotografie, Werbung und Content-Produktion in der DACH-Region.",
  keywords: ["Location mieten", "Crew buchen", "Fotostudio mieten", "Equipment leihen", "Content Production", "Filmproduktion", "Fotoshooting Location", "Creative Hub DACH"],
  openGraph: {
    title: "CineGenius — Der Marktplatz für Kreative",
    description: "Locations, Crew, Equipment und Jobs — für Film, Foto, Content und Werbung.",
  },
};

export const revalidate = 60;

import {
  MapPin, Briefcase, ArrowRight, Star, CheckCircle,
  Zap, Shield, Clock, Package2, Building2,
} from "lucide-react";
import HeroSearch from "@/components/HeroSearch";
import CommunityBoard from "@/components/CommunityBoard";
import { PageBackdrop } from "@/components/PageHeader";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { HomePhotoDiscovery, type DiscoverPhoto } from "@/components/HomePhotoDiscovery";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";
import { getPrivateProfileIds } from "@/lib/trust";
import { fetchRatingSummaries } from "@/lib/ratings";
import { extractPublicProfilePhotos } from "@/lib/home-discovery";
import { rankByRatingConfidence } from "@/lib/rating-ranking";
import { summarizePhotoRatings } from "@/lib/photo-rating-summary";

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
  const [
    { data: recentLocations },
    { data: recentJobs },
    { data: recentProps },
    { data: liveCompanies },
    { data: profilesRaw },
  ] = await Promise.all([
    db.from("listings").select("id,title,city,price,image_url,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(3),
    db.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    db.from("listings").select("id,title,city,price,image_url,type,created_at").in("type", ["prop", "vehicle"]).eq("published", true).not("image_url", "is", null).order("created_at", { ascending: false }).limit(3),
    db.from("companies").select("id,slug,name,logo_url,city,categories").eq("published", true).not("logo_url", "is", null).order("created_at", { ascending: false }).limit(6),
    db.from("profiles").select("user_id,slug,display_name,tagline,avatar_url,location,verified,role,positions,profile_type,profile_types,profile_images,portfolio_images,created_at").not("display_name", "is", null).neq("display_name", "").order("created_at", { ascending: false }).limit(300),
  ]);

  const profileRows = (profilesRaw ?? []) as HomeProfileRow[];
  const privateIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const publicProfiles = profileRows.filter((profile) => !privateIds.has(profile.user_id));
  const photos = extractPublicProfilePhotos(publicProfiles);
  const profileIds = publicProfiles.map((profile) => profile.user_id);
  const [crewRatingSummaries, photoRatingsResult, photoLikesResult] = await Promise.all([
    fetchRatingSummaries(profileIds, "user").catch(() => ({} as Awaited<ReturnType<typeof fetchRatingSummaries>>)),
    profileIds.length
    ? db.from("profile_image_ratings").select("profile_id,image_url,reviewer_id,rating").in("profile_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? db.from("profile_image_likes").select("profile_id,image_url,liker_id").in("profile_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const photoLikeCounts = new Map<string, number>();
  const myPhotoLikes = new Set<string>();
  for (const row of photoLikesResult.data ?? []) {
    const key = `${row.profile_id}:${row.image_url}`;
    photoLikeCounts.set(key, (photoLikeCounts.get(key) ?? 0) + 1);
    if (viewerId && row.liker_id === viewerId) myPhotoLikes.add(key);
  }

  const photosWithRatings: DiscoverPhoto[] = photos.map((photo) => {
    const rows = (photoRatingsResult.data ?? []).filter((row: { profile_id: string; image_url: string }) => row.profile_id === photo.profileId && row.image_url === photo.imageUrl) as Array<{ reviewer_id: string; rating: number }>;
    const key = `${photo.profileId}:${photo.imageUrl}`;
    return { ...photo, ...summarizePhotoRatings(rows), likeCount: photoLikeCounts.get(key) ?? 0, likedByMe: myPhotoLikes.has(key) };
  });
  const ratedPhotos = rankByRatingConfidence(
    photosWithRatings.filter((photo) => photo.count >= 2),
    (photo) => photo.rating,
    (photo) => photo.count,
    (photo) => `${photo.profileId}:${photo.imageUrl}`,
  ).slice(0, 4);
  const newPhotos = photosWithRatings.slice(0, 4);

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
    image: (l.image_url ?? "") as string,
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

  const liveProps = (recentProps ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    city: (p.city ?? "") as string,
    price: (p.price ?? 0) as number,
    image: (p.image_url ?? "") as string,
    type: (p.type ?? "prop") as string,
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
    topCreators,
    newCrew,
    ratedPhotos,
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
  const tn = await getTranslations("nav");

  function formatDate(iso: string): string {
    if (!iso) return "";
    const diff = Math.floor((currentTime - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return tc("today");
    if (diff === 1) return tc("yesterday");
    if (diff < 7) return tc("daysAgo", { days: diff });
    if (diff < 14) return tc("weekAgo");
    return tc("weeksAgo", { weeks: Math.floor(diff / 7) });
  }

  const { liveLocations, liveJobs, liveProps, companies, topCreators, newCrew, ratedPhotos, newPhotos, currentTime } = await getHomeData(userId);

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
          <h1
            className="font-display text-[2rem] sm:text-[2.8rem] font-bold tracking-tight text-text-primary mb-1 leading-tight"
          >
            Locations, Jobs &{" "}
            <span className="text-gradient-gold">Marktplatz</span>
          </h1>
          <p className="text-text-muted text-sm sm:text-base mb-5">
            für Film, Foto & Content — kostenlos in der DACH-Region
          </p>
          {!isLoggedIn && (
            <div className="mb-5 flex flex-col min-[380px]:flex-row items-stretch justify-center gap-2">
              <Link
                href="/sign-up"
                prefetch
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-bg-primary shadow-lg shadow-gold/15 transition-colors hover:bg-gold-light"
              >
                {tn("signUp")} <ArrowRight size={15} />
              </Link>
              <Link
                href="/sign-in"
                prefetch
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-bg-primary/50 px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-gold hover:text-gold"
              >
                {tn("signIn")}
              </Link>
            </div>
          )}
          <div className="max-w-xl mx-auto">
            <HeroSearch />
          </div>
        </div>
      </section>

      <CommunityBoard loggedIn={isLoggedIn} />

      <HomePhotoDiscovery ratedPhotos={ratedPhotos} newPhotos={newPhotos} />

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
                      {loc.price.toLocaleString()} €<span className="text-[11px] text-text-muted font-normal">{tc("perDay")}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {liveProps.map((prop) => (
                <Link
                  key={prop.id}
                  href={`/props/${prop.id}`}
                  className="card-hover group rounded-xl border border-border bg-bg-elevated overflow-hidden block"
                >
                  <div className="relative overflow-hidden aspect-video bg-bg-elevated">
                    <Image
                      src={prop.image}
                      alt={prop.title}
                      fill
                      className="object-cover object-bottom group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width:640px) 50vw,(max-width:1024px) 50vw,33vw"
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
                    </div>
                  </div>
                  <div className="px-2.5 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-xs text-text-muted truncate">{formatDate(prop.created_at)}</span>
                    <span className="text-xs sm:text-sm font-semibold text-gold whitespace-nowrap">
                      {prop.price > 0 ? `${prop.price.toLocaleString()} €${tc("perDay")}` : tc("onRequest")}
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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-6 gap-y-5">
              {companies.map((c) => (
                <Link key={c.id} href={`/companies/${c.slug ?? c.id}`} className="card-hover group flex flex-col items-center text-center gap-2">
                  <div className="w-full h-10 overflow-hidden flex items-center justify-center">
                    {c.logo ? (
                      <Image
                        src={c.logo}
                        alt={c.name}
                        width={120}
                        height={40}
                        className="object-contain max-h-full w-auto max-w-full opacity-70 group-hover:opacity-100 transition-opacity"
                      />
                    ) : (
                      <Building2 size={22} className="text-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <h3 className="font-semibold text-text-secondary group-hover:text-text-primary text-[11px] leading-snug truncate transition-colors">{c.name}</h3>
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
      <section className="py-10 sm:py-14 border-b border-border">
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
          {liveJobs.length > 0 ? (
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
          ) : (
            <div className="text-center py-10 text-text-muted text-sm">
              Noch keine Jobs — <Link href="/inserat" className="text-gold hover:text-gold-light">Job ausschreiben</Link>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TOP RATED CREATORS
      ══════════════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{topCreators.length >= 3 ? "Top bewertete Crew" : "Crew neu entdecken"}</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{topCreators.length >= 3 ? t("topCreatorsTitle") : "Menschen aus der Filmwelt"}</h2>
                {topCreators.length < 3 && <p className="mt-1 text-xs text-text-muted">Für eine Top-Auswahl liegen noch nicht genügend Crew-Bewertungen vor.</p>}
              </div>
              <Link href="/creators?sort=rating" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium shrink-0">
                Alle Crewmitglieder entdecken <ArrowRight size={14} />
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
            </div> : <div className="rounded-xl border border-border bg-bg-secondary px-4 py-8 text-center text-sm text-text-muted">Aktuell sind noch keine öffentlichen Crewprofile zum Entdecken vorhanden.</div>}
          </div>
      </section>

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
            {t("ctaDesc")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gold hover:bg-gold-light text-bg-primary font-bold rounded-xl transition-all text-sm shadow-lg shadow-gold/20"
            >
              {t("ctaPrimary")} <ArrowRight size={15} />
            </Link>
            <Link
              href="/inserat"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-border text-text-primary font-semibold rounded-xl hover:border-gold hover:text-gold transition-all text-sm"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
          <p className="text-[11px] text-text-muted mt-4">
            {t("ctaFootnote")}
          </p>
        </div>
      </section>
    </main>
  );
}
