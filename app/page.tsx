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
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";

function fmtCount(n: number, fallback: string): string {
  if (n === 0) return fallback;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k+`;
  return `${n}+`;
}

async function getHomeData() {
  const [
    { count: locationCount },
    { count: jobCount },
    { count: marketCount },
    { data: recentLocations },
    { data: recentJobs },
    { data: recentProps },
    { data: liveCompanies },
    { data: userReviewsRaw },
  ] = await Promise.all([
    db.from("listings").select("*", { count: "exact", head: true }).eq("type", "location").eq("published", true),
    db.from("listings").select("*", { count: "exact", head: true }).eq("type", "job").eq("published", true),
    db.from("listings").select("*", { count: "exact", head: true }).in("type", ["prop", "vehicle"]).eq("published", true),
    db.from("listings").select("id,title,city,price,image_url,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(3),
    db.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    db.from("listings").select("id,title,city,price,image_url,type,created_at").in("type", ["prop", "vehicle"]).eq("published", true).not("image_url", "is", null).order("created_at", { ascending: false }).limit(3),
    db.from("companies").select("id,slug,name,logo_url,city,categories").not("logo_url", "is", null).order("created_at", { ascending: false }).limit(6),
    db.from("reviews").select("target_id, rating").eq("target_type", "user"),
  ]);

  const ratingMap: Record<string, { sum: number; count: number }> = {};
  for (const r of (userReviewsRaw ?? []) as Array<{ target_id: string; rating: number }>) {
    if (!ratingMap[r.target_id]) ratingMap[r.target_id] = { sum: 0, count: 0 };
    ratingMap[r.target_id].sum += r.rating;
    ratingMap[r.target_id].count += 1;
  }
  const topRatedIds = Object.entries(ratingMap)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count)
    .slice(0, 4)
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
      .slice(0, 4);
  }

  const liveLocations = (recentLocations ?? []).map((l) => ({
    id: l.id as string,
    title: l.title as string,
    city: (l.city ?? "") as string,
    price: (l.price ?? 0) as number,
    image: (l.image_url ?? "") as string,
    isNew: l.created_at ? (Date.now() - new Date(l.created_at as string).getTime()) < 3 * 24 * 60 * 60 * 1000 : false,
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
    locationCount: locationCount ?? 0,
    jobCount: jobCount ?? 0,
    marketCount: marketCount ?? 0,
    liveLocations,
    liveJobs,
    liveProps,
    companies,
    topCreators,
  };
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

  const { locationCount, jobCount, marketCount, liveLocations, liveJobs, liveProps, companies, topCreators } = await getHomeData();

  return (
    <>
      {/* ══════════════════════════════════════════════
          HERO — kompakt, kein Vollbild
      ══════════════════════════════════════════════ */}
      <section className="relative flex flex-col justify-center overflow-hidden bg-bg-primary border-b border-border" style={{ minHeight: "52svh" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-[10px] font-semibold uppercase tracking-widest mb-6 animate-fade-in">
            <Zap size={9} /> {t("badgeHero")}
          </div>
          <h1
            className="font-display text-[2.4rem] sm:text-[4rem] font-bold tracking-tight text-text-primary mb-4 animate-fade-up"
            style={{ lineHeight: "1.1" }}
          >
            Locations, Jobs &<br />
            <span className="text-gradient-gold">Marktplatz</span>
          </h1>
          <p className="text-text-muted text-sm sm:text-base leading-relaxed mb-8 animate-fade-up">
            {t("heroSubtitle")}
          </p>
          <div className="max-w-xl mx-auto mb-8 animate-fade-up">
            <HeroSearch />
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 animate-fade-up">
            <Link
              href="/locations"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-gold/5 transition-all text-sm font-semibold text-text-primary"
            >
              <MapPin size={13} className="text-gold" />
              Locations
              {locationCount > 0 && <span className="text-[11px] text-text-muted font-normal">{fmtCount(locationCount, "")}</span>}
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-gold/5 transition-all text-sm font-semibold text-text-primary"
            >
              <Briefcase size={13} className="text-gold" />
              Jobs
              {jobCount > 0 && <span className="text-[11px] text-text-muted font-normal">{fmtCount(jobCount, "")}</span>}
            </Link>
            <Link
              href="/props"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-gold/5 transition-all text-sm font-semibold text-text-primary"
            >
              <Package2 size={13} className="text-gold" />
              Marktplatz
              {marketCount > 0 && <span className="text-[11px] text-text-muted font-normal">{fmtCount(marketCount, "")}</span>}
            </Link>
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold hover:bg-gold-light text-bg-primary font-semibold transition-all text-sm"
            >
              {ctaLabel} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/70 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-primary/80 backdrop-blur-sm border border-border text-[10px] font-semibold text-text-secondary">
                        <Package2 size={9} className="text-gold" />
                        {prop.type === "vehicle" ? "Fahrzeug" : "Equipment"}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="font-semibold text-white text-sm leading-tight">{prop.title}</h3>
                      {prop.city && (
                        <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {prop.city}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-text-muted">{formatDate(prop.created_at)}</span>
                    <span className="text-sm font-semibold text-gold">
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
        <section className="py-10 sm:py-14 bg-bg-secondary border-y border-border">
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
          <div className="mt-5 flex gap-3 justify-center sm:justify-start">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors"
            >
              Alle Jobs ansehen <ArrowRight size={13} />
            </Link>
            <span className="text-border">·</span>
            <Link
              href="/inserat"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors"
            >
              {tc("postJob")} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TOP RATED CREATORS
      ══════════════════════════════════════════════ */}
      {topCreators.length >= 3 && (
        <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">{t("topCreatorsLabel")}</p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-text-primary">{t("topCreatorsTitle")}</h2>
              </div>
              <Link href="/creators" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light font-medium shrink-0">
                {tc("viewAll")} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════ */}
      <div className="bg-bg-secondary border-y border-border">
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
        <div className="absolute inset-0 bg-gradient-to-br from-gold-subtle via-bg-primary to-bg-primary" />
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
    </>
  );
}
