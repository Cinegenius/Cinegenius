import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Film, Tv, Camera, Zap, Music, FileVideo, Building2, Radio, ArrowRight, Search,
} from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Projekte — CineGenius",
  description: "Filmprojekte & Produktionen auf CineGenius — wähle eine Kategorie.",
};

const LIME = "#c8f135";

const CATEGORIES = [
  {
    label: "Film & Serie",
    desc: "Spielfilme, Kurzfilme, Serien",
    href: "/projects/film",
    icon: Film,
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=85",
    span: "col-span-2 row-span-2",   // featured tile
  },
  {
    label: "Werbung",
    desc: "TV-Spots, Commercials",
    href: "/projects/werbung",
    icon: Tv,
    image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=800&q=80",
    span: "",
  },
  {
    label: "Foto & Shooting",
    desc: "Editorial, Portrait",
    href: "/projects/foto",
    icon: Camera,
    image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80",
    span: "",
  },
  {
    label: "Social Media",
    desc: "TikTok, Reels, YouTube",
    href: "/projects/social-media",
    icon: Zap,
    image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=80",
    span: "",
  },
  {
    label: "Musikvideo",
    desc: "Konzertfilme, Visuals",
    href: "/projects/musikvideo",
    icon: Music,
    image: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=800&q=80",
    span: "",
  },
  {
    label: "Dokumentation",
    desc: "Dokumentarfilme, Reportagen",
    href: "/projects/dokumentation",
    icon: FileVideo,
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80",
    span: "col-span-2",              // wide tile
  },
  {
    label: "Corporate",
    desc: "Imagefilme, Employer Branding",
    href: "/projects/corporate",
    icon: Building2,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    span: "",
  },
  {
    label: "Event & Live",
    desc: "Konzerte, Festivals",
    href: "/projects/event",
    icon: Radio,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    span: "",
  },
];

export default function ProjectsPage() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary overflow-hidden">

      {/* ── Cinematic header ─────────────────────────────────────── */}
      <div className="relative px-6 sm:px-10 lg:px-16 pt-10 pb-8">
        {/* Decorative background glow */}
        <div
          className="absolute top-0 left-0 w-[600px] h-[200px] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top left, ${LIME}12 0%, transparent 70%)`,
          }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {/* Super-title */}
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-2">
              CineGenius · Deine Produktionen
            </p>
            {/* Giant title */}
            <h1
              className="font-display font-black leading-none select-none"
              style={{
                fontSize: "clamp(3.5rem, 10vw, 8rem)",
                letterSpacing: "-0.03em",
                color: "transparent",
                WebkitTextStroke: `1px ${LIME}60`,
                backgroundImage: `linear-gradient(135deg, #fff 30%, ${LIME}80 80%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              Projekte
            </h1>
            <p className="text-text-muted text-sm mt-3 max-w-sm">
              Entdecke Produktionen aus der DACH-Region — von Spielfilm bis Social Media.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 pb-1">
            <Link
              href="/projects/alle"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-text-muted rounded-xl hover:border-gold/40 hover:text-gold transition-all text-sm"
            >
              <Search size={13} /> Alle durchsuchen
            </Link>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
            >
              + Projekt eintragen
            </Link>
          </div>
        </div>
      </div>

      {/* ── Asymmetric grid ──────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(4, 1fr)",
            gridAutoRows: "200px",
          }}
        >
          {CATEGORIES.map(({ label, desc, href, icon: Icon, image, span }) => {
            const isFeatured = span.includes("row-span-2");
            const isWide = span.includes("col-span-2") && !isFeatured;

            return (
              <Link
                key={href}
                href={href}
                className={`group relative overflow-hidden rounded-2xl block ${span}`}
              >
                <Image
                  src={image}
                  alt={label}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  sizes={isFeatured ? "50vw" : isWide ? "50vw" : "25vw"}
                />

                {/* Base dark veil */}
                <div className="absolute inset-0 bg-black/45 group-hover:bg-black/30 transition-colors duration-500" />
                {/* Bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                {/* Lime top shimmer on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(160deg, ${LIME}18 0%, transparent 50%)` }}
                />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-between p-4">
                  {/* Icon badge */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 self-start"
                    style={{ background: `${LIME}20` }}
                  >
                    <Icon size={14} style={{ color: LIME }} />
                  </div>

                  {/* Label */}
                  <div>
                    <p className={`font-bold text-white leading-tight ${isFeatured ? "text-2xl mb-1" : "text-base mb-0.5"}`}>
                      {label}
                    </p>
                    <p className={`text-white/55 leading-tight ${isFeatured ? "text-sm" : "text-xs"}`}>
                      {desc}
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div
                  className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
                  style={{ background: LIME }}
                >
                  <ArrowRight size={13} className="text-black" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
