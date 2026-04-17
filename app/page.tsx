import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import Image from "next/image";

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
  MapPin, Briefcase, ShoppingBag, Users,
  ArrowRight, Star, CheckCircle, Zap, Shield, Clock,
  TrendingUp, Film, ChevronRight, Play, Building2, Clapperboard, Camera,
} from "lucide-react";
import { stats } from "@/lib/data";
import ImageStrip from "@/components/ImageStrip";

function fmtCount(n: number, fallback: string): string {
  if (n === 0) return fallback;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k+`;
  return `${n}+`;
}

function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  if (diff < 7) return `Vor ${diff} Tagen`;
  if (diff < 14) return "Vor 1 Woche";
  return `Vor ${Math.floor(diff / 7)} Wochen`;
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
    { data: recentProjects },
    { data: recentProfiles },
    { data: recentLocationsStrip },
    { data: locationImages },
    { data: crewImages },
    { data: equipmentImages },
    { data: jobImages },
    { data: liveCompanies },
    { data: liveProjects },
  ] = await Promise.all([
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("type", "location").eq("published", true),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("type", "job").eq("published", true),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).not("display_name", "is", null),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).in("type", ["prop", "vehicle"]).eq("published", true),
    supabaseAdmin.from("projects").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("companies").select("*", { count: "exact", head: true }).eq("published", true),
    supabaseAdmin.from("listings").select("id,title,city,price,image_url,created_at").eq("type", "location").eq("published", true).order("created_at", { ascending: false }).limit(3),
    supabaseAdmin.from("listings").select("id,title,city,price,created_at").eq("type", "job").eq("published", true).order("created_at", { ascending: false }).limit(4),
    supabaseAdmin.from("projects").select("id,title,poster_url").not("poster_url", "is", null).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("profiles").select("user_id,display_name,avatar_url").not("avatar_url", "is", null).order("updated_at", { ascending: false }).limit(50),
    supabaseAdmin.from("listings").select("id,title,image_url").eq("type", "location").eq("published", true).not("image_url", "is", null).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("listings").select("image_url").eq("type", "location").eq("published", true).not("image_url", "is", null).limit(20),
    supabaseAdmin.from("profiles").select("avatar_url").not("avatar_url", "is", null).not("display_name", "is", null).limit(20),
    supabaseAdmin.from("listings").select("image_url").in("type", ["prop", "vehicle"]).eq("published", true).not("image_url", "is", null).limit(20),
    supabaseAdmin.from("listings").select("image_url").eq("type", "job").eq("published", true).not("image_url", "is", null).limit(20),
    supabaseAdmin.from("companies").select("id,name,logo_url,tagline,location").eq("published", true).not("logo_url", "is", null).order("created_at", { ascending: false }).limit(12),
    supabaseAdmin.from("projects").select("id,title,poster_url,year,type,director").not("poster_url", "is", null).order("created_at", { ascending: false }).limit(8),
  ]);

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
        reviews: 0,
        image: (l.image_url ?? "") as string,
      }))
    : [];

  const liveJobs = recentJobs && recentJobs.length > 0
    ? recentJobs.map((j) => ({
        id: j.id as string,
        title: j.title as string,
        location: (j.city ?? "") as string,
        rate: j.price ? `${(j.price as number).toLocaleString()} €/Tag` : "Auf Anfrage",
        urgent: false,
        posted: relativeDate(j.created_at as string),
      }))
    : [];

  const posterStrip = (recentProjects ?? [])
    .filter((p: { poster_url: string | null }) => p.poster_url?.includes("supabase.co/storage"))
    .map((p: { id: string; title: string; poster_url: string }) => ({ src: p.poster_url, alt: p.title, href: `/projects/${p.id}` }));

  const avatarStrip = (recentProfiles ?? [])
    .filter((p: { avatar_url: string | null }) => p.avatar_url?.includes("supabase.co/storage"))
    .map((p: { user_id: string; display_name: string | null; avatar_url: string }) => ({ src: p.avatar_url, alt: p.display_name ?? "Crew", href: `/creators/${p.user_id}` }));

  const locationStrip = (recentLocationsStrip ?? [])
    .filter((l: { image_url: string | null }) => l.image_url?.includes("supabase.co/storage"))
    .map((l: { id: string; title: string; image_url: string }) => ({ src: l.image_url, alt: l.title, href: `/locations/${l.id}` }));

  function pickRandom(arr: Array<Record<string, string | null | undefined>>): string | null {
    const urls = arr
      .map((x) => x.image_url ?? x.avatar_url)
      .filter((u): u is string => !!u && u.includes("supabase.co/storage"));
    if (urls.length === 0) return null;
    return urls[Math.floor(Math.random() * urls.length)];
  }

  const pillarImages = {
    location: pickRandom(locationImages ?? []),
    crew: pickRandom(crewImages ?? []),
    equipment: pickRandom(equipmentImages ?? []),
    job: pickRandom(jobImages ?? []),
    firma: pickRandom((liveCompanies ?? []).map((c) => ({ image_url: c.logo_url }))),
    projekt: pickRandom((liveProjects ?? []).filter((p) => p.poster_url?.includes("supabase.co/storage")).map((p) => ({ image_url: p.poster_url }))),
  };

  const companies = (liveCompanies ?? []).map((c: { id: string; name: string; logo_url: string | null; tagline: string | null; location: string | null }) => ({
    id: c.id,
    name: c.name,
    logo: c.logo_url,
    tagline: c.tagline ?? "",
    city: (c.location ?? "").split(",")[0]?.trim() ?? "",
  }));

  const projects = (liveProjects ?? [])
    .filter((p: { poster_url: string | null }) => p.poster_url?.includes("supabase.co/storage"))
    .map((p: { id: string; title: string; poster_url: string; year: number | null; type: string | null; director: string | null }) => ({
      id: p.id,
      title: p.title,
      poster: p.poster_url,
      year: p.year,
      type: p.type,
      director: p.director,
    }));

  return { liveStats, liveLocations, liveJobs, posterStrip, avatarStrip, locationStrip, pillarImages, companies, projects };
}

const featurePillars = [
  {
    icon: MapPin,
    title: "Drehorte",
    desc: "Altbauten, Studios, Industriehallen — der perfekte Ort für jede Szene.",
    href: "/locations",
    pillarKey: "location",
    accent: "from-sky-900/70",
  },
  {
    icon: Users,
    title: "Crew & Talente",
    desc: "DPs, Regisseure, Schauspieler, Maskenbildner — direkt buchbar.",
    href: "/creators",
    pillarKey: "crew",
    accent: "from-violet-900/70",
  },
  {
    icon: ShoppingBag,
    title: "Marktplatz",
    desc: "Kameras, Kostüme, Requisiten, Fahrzeuge — kaufen oder mieten.",
    href: "/props",
    pillarKey: "equipment",
    accent: "from-slate-900/70",
  },
  {
    icon: Briefcase,
    title: "Jobs & Aufträge",
    desc: "Ausschreiben oder bewerben — für jeden Dreh, jedes Budget.",
    href: "/jobs",
    pillarKey: "job",
    accent: "from-zinc-900/70",
  },
  {
    icon: Building2,
    title: "Firmen",
    desc: "Produktionsfirmen, Verleiher, Studios — entdecke Branchenpartner.",
    href: "/firmen",
    pillarKey: "firma",
    accent: "from-emerald-900/70",
  },
  {
    icon: Clapperboard,
    title: "Projekte",
    desc: "Dokumentiere deine Arbeit, zeig dein Team und deine Produktionen.",
    href: "/projects",
    pillarKey: "projekt",
    accent: "from-rose-900/70",
  },
];

const useCases = [
  {
    title: "Wohnung als Drehort vermieten",
    desc: "Dein Zuhause ist die perfekte Kulisse. Verdiene 300–800 € pro Drehtag.",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=85",
    cta: "Location inserieren",
    href: "/inserat",
  },
  {
    title: "Kameramann für Werbespot buchen",
    desc: "Erfahrene DPs mit Showreel — direkt anfragen, ohne Agentur.",
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&q=85",
    cta: "Crew durchsuchen",
    href: "/creators",
  },
  {
    title: "Firma eintragen & Kunden gewinnen",
    desc: "Produktionsfirma, Verleih oder Studio? Präsentiere dich mit Logo, Services und Team.",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=85",
    cta: "Firma eintragen",
    href: "/company-setup",
  },
  {
    title: "Filmprojekt dokumentieren",
    desc: "Trag dein Projekt ein, füge Credits hinzu und zeig was du gemacht hast.",
    image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=85",
    cta: "Projekt anlegen",
    href: "/projects",
  },
];

const testimonials = [
  {
    quote: "Unsere Location-Suche hat sich von 3 Wochen auf 2 Tage reduziert — und wir haben über CineGenius auch gleich den Kameramann und die Lichttechnik für den Shoot gefunden.",
    name: "Lena Hofmann",
    role: "Producerin, Parallax Films",
    rating: 5,
  },
  {
    quote: "Als Fotografin bekomme ich über mein Profil regelmäßig Anfragen für Produkt- und Werbeshootings. Ich musste nie kalt akquirieren — die Kunden kommen zu mir.",
    name: "Sara Nkemdirim",
    role: "Fotografin & Content Creator",
    rating: 5,
  },
  {
    quote: "Ich hab einfach mein Loft inseriert — ich bin kein Filmprofi, hab keine Ahnung von der Branche. Trotzdem war die Location innerhalb einer Woche zum ersten Mal gebucht.",
    name: "Thomas Brauer",
    role: "Location-Anbieter, Berlin",
    rating: 5,
  },
];

export default async function HomePage() {
  const { userId } = await auth();
  const isLoggedIn = !!userId;
  // For logged-in users: send to dashboard instead of sign-up
  const ctaHref = isLoggedIn ? "/dashboard" : "/sign-up";
  const ctaLabel = isLoggedIn ? "Zum Dashboard" : "Kostenlos starten";

  const { liveStats, liveLocations, liveJobs, posterStrip, avatarStrip, locationStrip, pillarImages, companies, projects } = await getHomeData();
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pb-[270px]">
        {/* Theme-aware background image (CSS class in globals.css) */}
        <div className="hero-bg absolute inset-0 bg-cover bg-no-repeat" />

        {/* Dark mode overlay */}
        <div className="hero-overlay-dark absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/80" />
        {/* Dark mode vignette */}
        <div className="hero-overlay-dark absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.40) 100%)" }} />

        {/* Light mode overlay — bright fade to page bg */}
        <div className="hero-overlay-light absolute inset-0 bg-gradient-to-b from-white/15 via-white/35 to-[#D9D4CB]/95" />

        {/* Always: strong top gradient so navbar text is readable over any image */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/75 to-transparent" />

        {/* Grain — dark mode only, animated */}
        <div
          className="grain hero-overlay-dark absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E\")" }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-20">
          <div className="hero-badge inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-widest mb-8 animate-fade-in">
            <Zap size={12} /> Film · Foto · Content · Werbung
          </div>

          <h1 className="hero-title font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-fade-up">
            Alles, was dein Projekt<br />
            <span className="text-gradient-gold">zum Leben braucht.</span>
          </h1>

          <p className="hero-sub text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up">
            Egal ob Kurzfilm, Werbespot, Fotoshooting oder YouTube-Produktion —
            CineGenius verbindet Kreative mit Locations, Crew, Equipment und Jobs.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12 animate-fade-up delay-200">
            <Link
              href={ctaHref}
              className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2 text-base"
            >
              {isLoggedIn ? "Zum Dashboard" : "Jetzt starten"} <ArrowRight size={16} />
            </Link>
            <Link
              href="/inserat"
              className="px-8 py-3.5 border border-white/30 text-white font-semibold rounded-xl hover:border-white/60 hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-base"
            >
              Inserat erstellen
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-y-4 gap-x-6 animate-fade-up delay-300">
            {liveStats.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div className="text-center px-3 sm:px-0 w-full sm:w-auto">
                  <div className="hero-stat-val text-xl sm:text-2xl font-bold font-display">{s.value}</div>
                  <div className="hero-stat-lbl text-[10px] sm:text-xs uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
                {i < liveStats.length - 1 && <span className="hero-stat-lbl opacity-20 text-lg hidden sm:inline ml-6">·</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ── LIVE STRIPS — anchored to bottom of hero ── */}
        {(posterStrip.length >= 1 || avatarStrip.length >= 1 || locationStrip.length >= 1) && (
          <div className="absolute bottom-0 left-0 right-0 z-20" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {posterStrip.length >= 1 && (
              <ImageStrip images={posterStrip} aspectRatio="wide" height={90} durationOverride={35} direction="left" overlay={false} stripId="top" />
            )}
            {avatarStrip.length >= 1 && (
              <ImageStrip images={avatarStrip} aspectRatio="square" height={90} durationOverride={45} direction="right" overlay={false} stripId="mid" startOffset={0.33} />
            )}
            {locationStrip.length >= 1 && (
              <ImageStrip images={locationStrip} aspectRatio="wide" height={90} durationOverride={90} direction="left" overlay={false} stripId="bot" startOffset={0.5} />
            )}
          </div>
        )}
      </section>

      {/* ── ALLES AUF EINER PLATTFORM ── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Alles auf einer Plattform</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Der Marktplatz für Kreative
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto leading-relaxed">
            Locations, Crew, Equipment, Jobs, Firmen und Projekte — für Film, Foto, Content und Werbung.
          </p>
        </div>

        {/* Cinematic 6-pillar grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {featurePillars.map(({ icon: Icon, title, desc, href, pillarKey, accent }) => {
            const image = pillarImages[pillarKey as keyof typeof pillarImages];
            return (
            <Link
              key={href}
              href={href}
              className="group relative rounded-2xl overflow-hidden aspect-[3/4] flex flex-col justify-end bg-bg-elevated border border-border"
            >
              {image && (
                <Image
                  src={image}
                  alt={title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,16vw"
                />
              )}
              <div className={`absolute inset-0 bg-gradient-to-t ${accent} ${image ? "via-black/20" : "via-black/60"} to-transparent`} />
              {image && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />}
              <div className="relative p-4 pb-5">
                <div className="w-7 h-7 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-2.5">
                  <Icon size={14} className="text-white" />
                </div>
                <h3 className="font-display text-sm font-bold text-white mb-1 leading-tight">{title}</h3>
                <p className="text-[11px] text-white/60 leading-relaxed mb-2.5 line-clamp-2 hidden sm:block">{desc}</p>
                <span className="inline-flex items-center gap-1 text-[11px] text-white/75 font-semibold group-hover:text-white transition-colors">
                  Entdecken <ChevronRight size={10} />
                </span>
              </div>
            </Link>
            );
          })}
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section className="py-20 bg-bg-secondary border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Konkrete Beispiele</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">
              Was du mit CineGenius machen kannst
            </h2>
          </div>

          {/* 2-column asymmetric grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Large featured card */}
            <Link
              href={useCases[0].href}
              className="group relative rounded-2xl overflow-hidden"
              style={{ minHeight: "420px" }}
            >
              <Image src={useCases[0].image} alt={useCases[0].title} fill
                className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                sizes="(max-width:1024px) 100vw,50vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h3 className="font-display text-2xl font-bold text-white mb-2">{useCases[0].title}</h3>
                <p className="text-white/65 text-sm mb-4">{useCases[0].desc}</p>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg text-white text-xs font-semibold group-hover:bg-white/25 transition-colors">
                  {useCases[0].cta} <ArrowRight size={12} />
                </span>
              </div>
            </Link>

            {/* 3 stacked cards */}
            <div className="grid grid-rows-3 gap-4">
              {useCases.slice(1).map(({ title, desc, image, cta, href }) => (
                <Link key={href + title} href={href}
                  className="group relative rounded-2xl overflow-hidden flex items-end"
                  style={{ minHeight: "120px" }}
                >
                  <Image src={image} alt={title} fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width:1024px) 100vw,50vw" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
                  <div className="relative p-5 flex items-center gap-4 w-full">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm leading-snug mb-0.5">{title}</h3>
                      <p className="text-white/55 text-xs truncate">{desc}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-white/75 font-medium group-hover:text-white transition-colors">
                      {cta} <ArrowRight size={11} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WIE ES FUNKTIONIERT ── */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Einfach & schnell</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">In 3 Schritten dabei sein</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-9 left-[calc(16.6%+28px)] right-[calc(16.6%+28px)] h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />
          {[
            {
              step: "01",
              icon: Film,
              title: "Kostenlos registrieren",
              desc: "Komplett kostenlos — keine Gebühren, keine Provision. Erstelle in Minuten ein Profil — als Kreativer, Anbieter oder Firma.",
            },
            {
              step: "02",
              icon: MapPin,
              title: "Anbieten oder suchen",
              desc: "Inseriere deine Location, dein Equipment oder dich selbst — oder finde genau das, was du brauchst.",
            },
            {
              step: "03",
              icon: Shield,
              title: "Direkt loslegen",
              desc: "Schreib direkt, keine Agentur dazwischen. Zahlung sicher über Treuhand — erst nach Abschluss.",
            },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-5 relative">
                <Icon size={26} className="text-gold" />
                <span className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-gold text-bg-primary text-[10px] font-bold rounded-full flex items-center justify-center">
                  {step}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CINEMATIC BREAK ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "clamp(340px, 45vw, 560px)" }}>
        <Image
          src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1920&q=90"
          alt="Film set"
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority={false}
        />
        {/* Layered cinematic overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Content */}
        <div className="relative z-10 flex items-center py-14 sm:py-0 sm:absolute sm:inset-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-4 flex items-center gap-2">
                <span className="w-6 h-px bg-gold inline-block" />
                Film · Foto · Content · Werbung
              </p>
              <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5">
                Jedes Projekt<br />
                <span className="text-gradient-gold">beginnt hier.</span>
              </h2>
              <p className="text-white/65 text-lg leading-relaxed mb-8 max-w-lg">
                Von der ersten Location-Anfrage bis zum letzten Credit — CineGenius verbindet alle, die etwas erschaffen.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
                >
                  {ctaLabel} <ArrowRight size={15} />
                </Link>
                <Link
                  href="/locations"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/25 text-white/85 font-semibold rounded-xl hover:border-white/50 hover:text-white transition-all text-sm"
                >
                  Drehorte entdecken
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FÜR WEN ── */}
      <section className="py-16 bg-bg-secondary border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Vor und hinter der Kamera</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">CineGenius ist für dich — <span className="text-gradient-gold">ganz egal wer du bist.</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Film,
                title: "Film, Foto & Content",
                desc: "Du drehst, fotografierst oder produzierst Content — hier findest du alles dafür.",
                items: ["Locations in Minuten finden", "Crew & Talente direkt anfragen", "Equipment tagesweise mieten", "Jobs & Aufträge ausschreiben"],
                cta: "Jetzt entdecken",
                href: "/locations",
                highlight: false,
              },
              {
                icon: Camera,
                title: "Freelancer & Kreative",
                desc: "Fotograf, DP, Editor, Social-Media-Creator — zeig was du kannst und werde gebucht.",
                items: ["Profil mit Portfolio & Tagessatz", "Von Produktionen gefunden werden", "Projekte & Credits dokumentieren", "Netzwerk & Sichtbarkeit aufbauen"],
                cta: isLoggedIn ? "Zum Dashboard" : "Profil erstellen",
                href: ctaHref,
                highlight: false,
              },
              {
                icon: Building2,
                title: "Firmen & Agenturen",
                desc: "Werbeagentur, Studio, Verleih — präsentiere dich und gewinne neue Aufträge.",
                items: ["Firmenprofil mit Logo & Team", "Services & Equipment listen", "Aufträge & Anfragen erhalten", "Verifiziertes Branchenprofil"],
                cta: "Firma eintragen",
                href: "/company-setup",
                highlight: false,
              },
              {
                icon: TrendingUp,
                title: "Du brauchst keine Kamera",
                desc: "Schöne Wohnung? Industriehalle? Oldtimer? Du kannst hier Geld verdienen — ohne selbst zu produzieren.",
                items: ["300–800 € pro Drehtag mit deiner Location", "Equipment & Fahrzeuge vermieten", "Keine Branchenerfahrung nötig", "Kostenlos inserieren, sicher bezahlt werden"],
                cta: "Inserat erstellen",
                href: "/inserat",
                highlight: true,
              },
            ].map(({ icon: Icon, title, desc, items, cta, href, highlight }) => (
              <div key={title} className={`rounded-2xl border p-6 flex flex-col ${highlight ? "border-gold/20 bg-gold-subtle" : "border-border bg-bg-elevated"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${highlight ? "bg-gold/10 border border-gold/20" : "bg-bg-hover border border-border-light"}`}>
                  <Icon size={18} className={highlight ? "text-gold" : "text-text-secondary"} />
                </div>
                <h3 className="font-display text-base font-bold text-text-primary mb-1">{title}</h3>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">{desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-text-secondary">
                      <CheckCircle size={12} className={`shrink-0 mt-0.5 ${highlight ? "text-gold" : "text-success"}`} /> {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${highlight ? "bg-gold text-bg-primary hover:bg-gold-light" : "border border-border-light text-text-secondary hover:border-gold/40 hover:text-gold"}`}
                >
                  {cta} <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED LOCATIONS ── */}
      <section className="py-12 bg-bg-secondary border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Neu & empfohlen</p>
              <h2 className="font-display text-2xl font-bold text-text-primary">Ausgewählte Drehorte</h2>
            </div>
            <Link href="/locations" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors font-medium">
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveLocations.map((loc) => (
              <Link key={loc.id} href={`/locations/${loc.id}`} className="card-hover group rounded-xl border border-border bg-bg-elevated overflow-hidden block">
                <div className="relative overflow-hidden aspect-video bg-bg-elevated">
                  {loc.image && <Image src={loc.image} alt={loc.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/70 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <h3 className="font-semibold text-white text-sm leading-tight">{loc.title}</h3>
                    <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {loc.city}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-text-muted">Neu</span>
                  <span className="text-sm font-semibold text-gold">
                    {loc.price.toLocaleString()} €<span className="text-[11px] text-text-muted font-normal">/Tag</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FIRMEN ── */}
      {companies.length > 0 && (
        <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Branchenpartner</p>
              <h2 className="font-display text-2xl font-bold text-text-primary">Firmen & Studios</h2>
            </div>
            <Link href="/firmen" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors font-medium">
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {companies.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/firmen/${c.id}`} className="card-hover group flex flex-col items-center text-center p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all gap-3">
                <div className="w-14 h-14 rounded-xl border border-border bg-bg-elevated overflow-hidden flex items-center justify-center shrink-0">
                  {c.logo ? (
                    <Image src={c.logo} alt={c.name} width={56} height={56} className="object-contain w-full h-full" />
                  ) : (
                    <Building2 size={22} className="text-text-muted" />
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-semibold text-text-primary text-xs leading-snug truncate">{c.name}</h3>
                  {c.city && <p className="text-[11px] text-text-muted truncate mt-0.5">{c.city}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── PROJEKTE ── */}
      {projects.length > 0 && (
        <section className="py-12 bg-bg-secondary border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Neu eingetragen</p>
                <h2 className="font-display text-2xl font-bold text-text-primary">Aktuelle Filmprojekte</h2>
              </div>
              <Link href="/projects" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors font-medium">
                Alle Projekte <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {projects.slice(0, 8).map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="card-hover group rounded-xl overflow-hidden border border-border bg-bg-elevated block">
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

      {/* ── AKTUELLE JOBS ── */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Jetzt gesucht</p>
            <h2 className="font-display text-2xl font-bold text-text-primary">Aktuelle Jobs</h2>
          </div>
          <Link href="/jobs" className="flex items-center gap-1 text-sm text-gold hover:text-gold-light transition-colors font-medium">
            Alle anzeigen <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {liveJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="card-hover group flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Briefcase size={16} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-text-primary text-sm truncate">{job.title}</h3>
                  {job.urgent && (
                    <span className="px-1.5 py-0.5 bg-crimson/20 border border-crimson/40 text-crimson-light text-[10px] font-semibold rounded shrink-0">
                      Dringend
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted truncate">{job.location}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gold">{job.rate}</p>
                <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5 justify-end">
                  <Clock size={9} /> {job.posted}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/inserat"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors"
          >
            Job ausschreiben <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {/* ── PLATTFORM-PULSE ── */}
      <section className="py-10 border-y border-border bg-bg-secondary overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: "0 €", label: "Gebühren", sub: "komplett kostenlos", icon: CheckCircle },
              { value: "0 %", label: "Provision", sub: "keine Transaktionsgebühr", icon: CheckCircle },
              { value: "24 h", label: "Antwortzeit", sub: "Ø Reaktionszeit", icon: Clock },
              { value: "DACH", label: "Region", sub: "DE · AT · CH", icon: TrendingUp },
            ].map(({ value, label, sub, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-4 rounded-xl bg-bg-elevated border border-border">
                <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-gold" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-xl font-bold text-text-primary leading-none">{value}</p>
                  <p className="text-xs font-medium text-text-secondary mt-0.5">{label}</p>
                  <p className="text-[10px] text-text-muted">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VERTRAUEN + TESTIMONIALS ── */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-3">Vertrauen & Sicherheit</p>
          <h2 className="font-display text-3xl font-bold text-text-primary">Warum CineGenius?</h2>
        </div>

        {/* Trust pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-16">
          {[
            { icon: Shield, title: "Sichere Zahlung", desc: "Stripe-Treuhand — Geld wird erst nach erfolgreichem Abschluss freigegeben." },
            { icon: CheckCircle, title: "Verifizierte Anbieter", desc: "Geprüfte Profile und Identitäten für maximale Sicherheit auf beiden Seiten." },
            { icon: Zap, title: "Komplett kostenlos", desc: "Kein Abo, keine Grundgebühr, keine Provision. Einfach registrieren und loslegen." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-bg-secondary">
              <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
                <Icon size={20} className="text-gold" />
              </div>
              <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div key={t.name} className="p-6 rounded-2xl border border-border bg-bg-secondary flex flex-col gap-4">
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={14} className="text-gold fill-gold" />
                ))}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-sm font-bold text-gold">
                  {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-subtle via-bg-primary to-bg-primary" />
        <div className="absolute inset-0 border-t border-b border-gold/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/5 text-gold text-xs font-semibold mb-6">
            <Play size={10} className="fill-gold" /> Bereit loszulegen?
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            Dein nächstes Projekt<br />
            <span className="text-gradient-gold">wartet schon.</span>
          </h2>
          <p className="text-text-secondary mb-5 leading-relaxed">
            Kostenlos registrieren. Sofort loslegen.<br />
            Für Kreative, Produzenten, Fotografen — und alle, die einfach verdienen wollen.
          </p>
          <p className="text-xs text-text-muted mb-7">
            Keine Kamera? Kein Problem — vermiete deine Location, dein Equipment oder dein Fahrzeug.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              href={ctaHref}
              className="px-8 py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
            >
              {ctaLabel} <ArrowRight size={16} />
            </Link>
            <Link
              href="/locations"
              className="px-8 py-3.5 border border-border text-text-primary font-semibold rounded-xl hover:border-gold hover:text-gold transition-all flex items-center justify-center gap-2"
            >
              Drehorte entdecken
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            Keine Kreditkarte erforderlich · Sofort einsatzbereit · Jederzeit kündbar
          </p>
        </div>
      </section>
    </>
  );
}
