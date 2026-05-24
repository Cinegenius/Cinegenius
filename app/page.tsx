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
  MapPin, Briefcase,
  ArrowRight, Star, CheckCircle, Zap, Shield, Clock,
  TrendingUp, Film, Play, Building2, Camera, PawPrint,
} from "lucide-react";
import { stats } from "@/lib/data";
import HeroSearch from "@/components/HeroSearch";

function fmtCount(n: number, fallback: string): string {
  if (n === 0) return fallback;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k+`;
  return `${n}+`;
}

async function getHomeData() {
  const [
    { count: locationCount },
    { count: jobCount },
    { count: profileCount },
    { count: marketCount },
    { count: projectCount },
    { count: companyCount },
    { data: recentLocations },
    { data: recentJobs },
    { data: liveCompanies },
    { data: liveProjects },
    { data: userReviewsRaw },
  ] = await Promise.all([
    db.from("listings").select("*", { count: "exact", head: true }).eq("type", "location").eq("published", true),
    db.from("listings").select("*", { count: "exact", head: true }).eq("type", "job").eq("published", true),
    db.from("profiles").select("*", { count: "exact", head: true }).not("display_name", "is", null),
    db.from("listings").select("*", { count: "exact", head: true }).in("type", ["prop", "vehicle"]).eq("published", true),
    db.from("projects").select("*", { count: "exact", head: true }),
    db.from("companies").select("*", { count: "exact", head: true }).eq("published", true),
    db.from("listings").select("id,title,city,price,image_url,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(3),
    db.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    db.from("companies").select("id,slug,name,logo_url,city").not("logo_url", "is", null).order("created_at", { ascending: false }).limit(12),
    db.from("projects").select("id,title,poster_url,year,type,director").not("poster_url", "is", null).order("created_at", { ascending: false }).limit(8),
    db.from("reviews").select("target_id, rating").eq("target_type", "user"),
  ]);

  // Compute top-rated creator IDs from reviews (min 2 reviews)
  const ratingMap: Record<string, { sum: number; count: number }> = {};
  for (const r of (userReviewsRaw ?? []) as Array<{ target_id: string; rating: number }>) {
    if (!ratingMap[r.target_id]) ratingMap[r.target_id] = { sum: 0, count: 0 };
    ratingMap[r.target_id].sum += r.rating;
    ratingMap[r.target_id].count += 1;
  }
  const topRatedIds = Object.entries(ratingMap)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)
    .slice(0, 8)
    .map(([id]) => id);

  let topCreators: Array<{
    id: string; name: string; tagline?: string; avatar?: string;
    city?: string; verified: boolean; rating: number; reviews: number;
  }> = [];
  if (topRatedIds.length >= 3) {
    const { data: topProfiles } = await db
      .from("profiles")
      .select("user_id, display_name, tagline, avatar_url, location, verified")
      .in("user_id", topRatedIds)
      .not("display_name", "is", null);
    topCreators = ((topProfiles ?? []) as Array<Record<string, unknown>>)
      .map((p) => ({
        id: p.user_id as string,
        name: p.display_name as string,
        tagline: p.tagline as string | undefined,
        avatar: typeof p.avatar_url === "string" && (p.avatar_url as string).includes("supabase.co/storage") ? p.avatar_url as string : undefined,
        city: typeof p.location === "string" ? (p.location as string).split(",")[0]?.trim() : undefined,
        verified: (p.verified as boolean) ?? false,
        rating: Math.round((ratingMap[p.user_id as string].sum / ratingMap[p.user_id as string].count) * 10) / 10,
        reviews: ratingMap[p.user_id as string].count,
      }))
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      .slice(0, 8);
  }

  const liveStats = [
    { value: fmtCount(locationCount ?? 0, stats[0].value), label: stats[0].label },
    { value: fmtCount(profileCount ?? 0, stats[1].value), label: stats[1].label },
    { value: fmtCount(jobCount ?? 0, stats[2].value), label: stats[2].label },
    { value: fmtCount(marketCount ?? 0, stats[3].value), label: stats[3].label },
    { value: fmtCount(projectCount ?? 0, "0"), label: "Projekte" },
    { value: fmtCount(companyCount ?? 0, "0"), label: "Firmen" },
  ];

  const liveLocations = recentLocations && recentLocations.length > 0
    ? recentLocations.map((l) => ({
        id: l.id as string,
        title: l.title as string,
        city: (l.city ?? "") as string,
        price: (l.price ?? 0) as number,
        image: (l.image_url ?? "") as string,
        isNew: l.created_at ? (Date.now() - new Date(l.created_at as string).getTime()) < 3 * 24 * 60 * 60 * 1000 : false,
        created_at: (l.created_at ?? "") as string,
      }))
    : [];

  const liveJobs = recentJobs && recentJobs.length > 0
    ? recentJobs.map((j) => ({
        id: j.id as string,
        title: j.title as string,
        location: (j.city ?? "") as string,
        rawPrice: j.price as number | null,
        created_at: (j.created_at ?? "") as string,
      }))
    : [];

  const companies = (liveCompanies ?? []).map((c: { id: string; slug: string | null; name: string; logo_url: string | null; city: string | null }) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    logo: c.logo_url,
    city: (c.city ?? "").split(",")[0]?.trim() ?? "",
  }));

  const projects = (liveProjects ?? [])
    .filter((p: { poster_url: string | null }) => p.poster_url?.includes("supabase.co/storage"))
    .map((p: { id: string; title: string; poster_url: string; year: number | null; type: string | null; director: string | null }) => ({
      id: p.id,
      title: p.title,
      poster: p.poster_url,
      year: p.year,
    }));

  // Fetch top-liked profile image for BTS card
  let btsImage: string | null = null;
  try {
    const { data: likeRows } = await db
      .from("profile_image_likes")
      .select("image_url");
    if (likeRows && likeRows.length > 0) {
      const counts: Record<string, number> = {};
      for (const row of likeRows) counts[row.image_url] = (counts[row.image_url] ?? 0) + 1;
      btsImage = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
  } catch { /* table may not exist yet */ }

  return { liveStats, liveLocations, liveJobs, companies, projects, topCreators, btsImage };
}

export default async function HomePage() {
  const { userId } = await auth();
  const isLoggedIn = !!userId;
  const ctaHref = isLoggedIn ? "/dashboard" : "/sign-up";

  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  const ctaLabel = isLoggedIn ? t("ctaDashboard") : t("ctaSignup");

  function formatDate(iso: string): string {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return tc("today");
    if (diff === 1) return tc("yesterday");
    if (diff < 7) return tc("daysAgo", { days: diff });
    if (diff < 14) return tc("weekAgo");
    return tc("weeksAgo", { weeks: Math.floor(diff / 7) });
  }

  const { liveLocations, liveJobs, companies, projects, topCreators, btsImage } = await getHomeData();

  return (
    <>
      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="relative min-h-[80svh] sm:min-h-[82svh] flex flex-col overflow-hidden">
        <div className="hero-bg absolute inset-0 bg-cover bg-no-repeat" />
        <div
          className="absolute inset-0 hidden sm:block"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.35) 100%)" }}
        />
        <div
          className="absolute inset-0 sm:hidden"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.2) 100%)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/40" />
        <div className="hero-overlay-light absolute inset-0 bg-gradient-to-b from-white/25 via-white/20 to-[#D9D4CB]/95" />
        <div
          className="grain hero-overlay-dark absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")" }}
        />

        {/* Desktop layout: top-left */}
        <div className="hidden sm:block relative z-10 px-10 lg:px-[100px] pt-[90px] lg:pt-[100px]">
          <div className="max-w-[680px]">
            <div className="hero-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-semibold uppercase tracking-[0.18em] mb-5 animate-fade-in">
              <Zap size={9} /> {t("badgeHero")}
            </div>
            <h1
              className="hero-title font-display text-[3.5rem] lg:text-[5rem] font-bold tracking-tight mb-6 animate-fade-up"
              style={{ lineHeight: "1.1" }}
            >
              {t("heroTitle1")}<br />
              <span className="text-gradient-gold" style={{ lineHeight: "1.15" }}>{t("heroTitle2")}</span>
            </h1>
            <p className="hero-sub text-lg mb-10 leading-[1.55] animate-fade-up max-w-[500px]" style={{ opacity: 0.75 }}>
              {t("heroSubtitle")}
            </p>
            <div className="w-full max-w-[580px] mb-10 animate-fade-up">
              <HeroSearch />
            </div>
            <div className="flex flex-row items-center gap-3 animate-fade-up">
              <Link href={ctaHref}
                className={`inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-gold hover:bg-gold-light text-bg-primary font-semibold rounded-lg active:scale-[0.98] transition-all text-sm ${isLoggedIn ? "hidden sm:inline-flex" : ""}`}>
                {ctaLabel} <ArrowRight size={13} />
              </Link>
              <Link href="/inserat"
                className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg border border-white/25 text-white/70 font-medium hover:border-white/40 hover:text-white active:scale-[0.98] transition-all text-sm">
                {t("ctaCreateListing")}
              </Link>
            </div>
          </div>
        </div>

        <div className="hidden sm:block flex-1" />

        {/* Mobile layout: vertically centered text + bottom search */}
        <div className="sm:hidden flex-1 flex flex-col items-center justify-center px-5 pt-16 text-center">
          <div className="hero-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-semibold uppercase tracking-[0.18em] mb-3 animate-fade-in">
            <Zap size={9} /> {t("badgeHero")}
          </div>
          <h1
            className="hero-title font-display text-[1.9rem] font-bold tracking-tight mb-3 animate-fade-up"
            style={{ lineHeight: "1.1" }}
          >
            {t("heroTitle1")}<br />
            <span className="text-gradient-gold" style={{ lineHeight: "1.15" }}>{t("heroTitle2")}</span>
          </h1>
          <p className="hero-sub text-sm leading-[1.55] animate-fade-up max-w-[360px]" style={{ opacity: 0.75 }}>
            {t("heroSubtitle")}
          </p>
        </div>

        <div className="sm:hidden relative z-10 px-5 pb-5">
          <div className="mb-2">
            <HeroSearch />
          </div>
          <div className="flex gap-2">
            <Link href={ctaHref}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gold hover:bg-gold-light text-bg-primary font-semibold rounded-lg active:scale-[0.98] transition-all text-sm ${isLoggedIn ? "hidden" : ""}`}>
              {ctaLabel} <ArrowRight size={13} />
            </Link>
            <Link href="/inserat"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/25 text-white/70 font-medium hover:border-white/40 hover:text-white active:scale-[0.98] transition-all text-sm">
              {t("ctaCreateListing")}
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TARGET AUDIENCES
      ══════════════════════════════════════════════ */}
      <section className="py-6 lg:py-16 bg-bg-secondary border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4 lg:mb-10 text-center lg:text-left">
            <p className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">{t("audienceLabel")}</p>
            <h2 className="font-display text-lg lg:text-3xl font-bold text-text-primary max-w-xl mx-auto lg:mx-0">
              {t("audienceTitle")}{" "}
              <span className="text-gradient-gold">{t("audienceTitleHighlight")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {([
              {
                icon: Film,
                title: t("audienceFilmTitle"),
                desc: t("audienceFilmDesc"),
                cta: t("audienceFilmCta"),
                href: "/locations",
                highlight: false,
              },
              {
                icon: Camera,
                title: t("audienceFreelanceTitle"),
                desc: t("audienceFreelanceDesc"),
                cta: isLoggedIn ? t("ctaDashboard") : t("audienceFreelanceCta"),
                href: ctaHref,
                highlight: false,
              },
              {
                icon: Building2,
                title: t("audienceCompanyTitle"),
                desc: t("audienceCompanyDesc"),
                cta: t("audienceCompanyCta"),
                href: "/company-setup",
                highlight: false,
              },
              {
                icon: TrendingUp,
                title: t("audiencePassiveTitle"),
                desc: t("audiencePassiveDesc"),
                cta: t("audiencePassiveCta"),
                href: "/inserat",
                highlight: true,
              },
            ] as const).map(({ icon: Icon, title, desc, cta, href, highlight }) => (
              <div key={title} className={`rounded-xl lg:rounded-2xl border p-3 lg:p-5 flex flex-col gap-3 ${highlight ? "border-gold/25 bg-gold-subtle" : "border-border bg-bg-elevated"}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${highlight ? "bg-gold/10 border border-gold/20" : "bg-bg-hover border border-border-light"}`}>
                  <Icon size={16} className={highlight ? "text-gold" : "text-text-secondary"} />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-sm lg:text-base font-bold text-text-primary leading-tight mb-1">{title}</h3>
                  <p className="text-[11px] lg:text-xs text-text-muted leading-relaxed">{desc}</p>
                </div>
                <Link
                  href={href}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${highlight ? "bg-gold text-bg-primary hover:bg-gold-light" : "border border-border-light text-text-secondary hover:border-gold/40 hover:text-gold"}`}
                >
                  {cta} <ArrowRight size={11} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════ */}
      <div className="bg-bg-secondary border-b border-border">
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
          TOP RATED CREATORS
      ══════════════════════════════════════════════ */}
      {topCreators.length >= 3 && (
        <section className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center sm:flex-row sm:items-end sm:justify-between mb-6 text-center sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("topCreatorsLabel")}</p>
              <h2 className="font-display text-2xl font-bold text-text-primary">{t("topCreatorsTitle")}</h2>
            </div>
            <Link href="/creators" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium mt-2 sm:mt-0">
              {tc("viewAll")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {topCreators.map((c) => (
              <Link
                key={c.id}
                href={`/profile/${c.id}`}
                className="group card-hover rounded-2xl border border-border bg-bg-secondary hover:border-gold/30 transition-all overflow-hidden flex flex-col"
              >
                <div className="relative aspect-square bg-bg-elevated overflow-hidden">
                  {c.avatar ? (
                    <Image
                      src={c.avatar}
                      alt={c.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
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
                  {c.city && (
                    <p className="text-[11px] text-text-muted flex items-center gap-1 mb-1.5">
                      <MapPin size={9} /> {c.city}
                    </p>
                  )}
                  {c.tagline && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 flex-1 mb-2">{c.tagline}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-auto">
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
                    <span className="text-[11px] text-text-muted">({c.reviews})</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          VISUAL SHOWCASE
      ══════════════════════════════════════════════ */}
      <section className="py-8 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-10">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">{t("showcaseLabel")}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary max-w-lg">
            {t("showcaseTitle")}
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-[160px] sm:auto-rows-[200px]">
          <Link href="/projects" className="relative rounded-2xl overflow-hidden group block">
            <Image src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=85" alt="Film Set" fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out" sizes="(max-width:1024px) 50vw,33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-5 left-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 rounded-full text-gold text-xs font-semibold mb-2">
                <Film size={10} /> {t("showcaseFilm")}
              </span>
              <p className="text-white font-semibold text-sm">{t("showcaseFilmDesc")}</p>
              <p className="text-white/60 text-xs mt-0.5">{t("showcaseFilmSub")}</p>
            </div>
          </Link>
          <Link href="/photo" className="relative rounded-2xl overflow-hidden group block">
            <Image src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=85" alt="Fotoshooting" fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out" sizes="(max-width:1024px) 50vw,33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 rounded-full text-gold text-xs font-semibold mb-1.5">
                <Camera size={10} /> {t("showcasePhoto")}
              </span>
              <p className="text-white font-semibold text-sm">{t("showcasePhotoDesc")}</p>
            </div>
          </Link>
          <Link href="/social-media" className="relative rounded-2xl overflow-hidden group block">
            <Image src="https://images.unsplash.com/photo-1683721003111-070bcc053d8b?w=800&q=85" alt="Social Media" fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out" sizes="(max-width:1024px) 50vw,33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 rounded-full text-gold text-xs font-semibold mb-1.5">
                <Zap size={10} /> {t("showcaseSocial")}
              </span>
              <p className="text-white font-semibold text-sm">{t("showcaseSocialDesc")}</p>
            </div>
          </Link>
          <Link href="/companies" className="relative rounded-2xl overflow-hidden group block">
            <Image src="https://images.unsplash.com/photo-1557858310-9052820906f7?w=800&q=85" alt="Werbung" fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out" sizes="(max-width:1024px) 50vw,33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 rounded-full text-gold text-xs font-semibold mb-1.5">
                <TrendingUp size={10} /> {t("showcaseAds")}
              </span>
              <p className="text-white font-semibold text-sm">{t("showcaseAdsDesc")}</p>
            </div>
          </Link>
          <Link href="/bts" className="relative rounded-2xl overflow-hidden group block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={btsImage ?? "https://plus.unsplash.com/premium_photo-1682001110037-50545d73acfa?w=800&q=85"} alt="Behind the scenes"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 rounded-full text-gold text-xs font-semibold mb-1.5">
                <Play size={10} /> {t("showcaseBts")}
              </span>
              <p className="text-white font-semibold text-sm">{t("showcaseBtsDesc")}</p>
            </div>
          </Link>
          <Link href="/tiere" className="relative rounded-2xl overflow-hidden group block">
            <Image src="/tier.jpg" alt="Film-Tiere" fill
              className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out" sizes="(max-width:1024px) 50vw,33vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/20 backdrop-blur-sm border border-gold/30 rounded-full text-gold text-xs font-semibold mb-1.5">
                <PawPrint size={10} /> Film-Tiere
              </span>
              <p className="text-white font-semibold text-sm">Hunde, Pferde & Exoten</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURED LOCATIONS
      ══════════════════════════════════════════════ */}
      {liveLocations.length > 0 && (
        <section className="py-8 sm:py-12 bg-bg-secondary border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center sm:flex-row sm:items-end sm:justify-between mb-6 text-center sm:text-left">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("locationsLabel")}</p>
                <h2 className="font-display text-2xl font-bold text-text-primary">{t("locationsTitle")}</h2>
              </div>
              <Link href="/locations" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium mt-2 sm:mt-0">
                {tc("viewAll")} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveLocations.map((loc) => (
                <Link key={loc.id} href={`/locations/${loc.id}`} className="card-hover group rounded-xl border border-border bg-bg-elevated overflow-hidden block">
                  <div className="relative overflow-hidden aspect-video bg-bg-elevated">
                    {loc.image && (
                      <Image src={loc.image} alt={loc.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />
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
          COMPANIES
      ══════════════════════════════════════════════ */}
      {companies.length > 0 && (
        <section className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center sm:flex-row sm:items-end sm:justify-between mb-6 text-center sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("companiesLabel")}</p>
              <h2 className="font-display text-2xl font-bold text-text-primary">{t("companiesTitle")}</h2>
            </div>
            <Link href="/companies" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium mt-2 sm:mt-0">
              {tc("viewAll")} <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-5">
            {companies.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/companies/${c.slug ?? c.id}`} className="card-hover group flex flex-col items-center text-center gap-2">
                <div className="w-full h-10 overflow-hidden flex items-center justify-center">
                  {c.logo ? (
                    <Image src={c.logo} alt={c.name} width={120} height={40} className="object-contain max-h-full w-auto max-w-full opacity-70 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Building2 size={22} className="text-text-muted" />
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-semibold text-text-secondary group-hover:text-text-primary text-[11px] leading-snug truncate transition-colors">{c.name}</h3>
                  {c.city && <p className="text-[10px] text-text-muted truncate">{c.city}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          PROJECTS
      ══════════════════════════════════════════════ */}
      {projects.length > 0 && (
        <section className="py-8 sm:py-12 bg-bg-secondary border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center sm:flex-row sm:items-end sm:justify-between mb-6 text-center sm:text-left">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("projectsLabel")}</p>
                <h2 className="font-display text-2xl font-bold text-text-primary">{t("projectsTitle")}</h2>
              </div>
              <Link href="/projects" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium mt-2 sm:mt-0">
                {tc("allProjects")} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {projects.slice(0, 8).map((p, i) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className={`card-hover group rounded-xl overflow-hidden border border-border bg-bg-elevated block${i >= 4 ? " hidden sm:block" : ""}`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <Image src={p.poster} alt={p.title} fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" sizes="(max-width:640px) 50vw,12vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-[10px] text-white font-semibold leading-tight line-clamp-2">{p.title}</p>
                      {p.year && <p className="text-[10px] text-white/60 mt-0.5">{p.year}</p>}
                    </div>
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
      <section className="py-8 sm:py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center sm:flex-row sm:items-end sm:justify-between mb-6 text-center sm:text-left">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("jobsLabel")}</p>
            <h2 className="font-display text-2xl font-bold text-text-primary">{t("jobsTitle")}</h2>
          </div>
          <Link href="/jobs" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium mt-2 sm:mt-0">
            {tc("viewAll")} <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {liveJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="card-hover group flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all">
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
        <div className="mt-4 text-center">
          <Link href="/inserat" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors">
            {tc("postJob")} <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section className="py-12 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-subtle via-bg-primary to-bg-primary" />
        <div className="absolute inset-0 border-t border-b border-gold/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-5">
                <Play size={10} className="fill-gold" /> {t("ctaBadge")}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3 leading-tight">
                {t("ctaTitle")}<br />
                <span className="text-gradient-gold">{t("ctaTitleHighlight")}</span>
              </h2>
              <p className="text-text-muted text-sm leading-relaxed max-w-sm mx-auto lg:mx-0">
                {t("ctaDesc")}
              </p>
            </div>
            <div className="flex flex-col items-stretch lg:items-start gap-3 shrink-0 max-w-[320px] mx-auto lg:mx-0 w-full lg:w-auto">
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
              <p className="text-[11px] text-text-muted text-center">
                {t("ctaFootnote")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
