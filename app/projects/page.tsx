import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Film, Tv, Camera, Zap, Music, FileVideo, Building2, Radio, ArrowRight, Clapperboard,
} from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Projekte — CineGenius",
  description: "Filmprojekte & Produktionen auf CineGenius — wähle eine Kategorie.",
};

const CATEGORIES = [
  {
    label: "Film & Serie",
    desc: "Spielfilme, Kurzfilme, Serien",
    href: "/projects/film",
    icon: Film,
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80",
    accent: "#a855f7",
  },
  {
    label: "Werbung",
    desc: "TV-Spots, Commercials, Online-Ads",
    href: "/projects/werbung",
    icon: Tv,
    image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=800&q=80",
    accent: "#ec4899",
  },
  {
    label: "Foto & Shooting",
    desc: "Editorial, Portrait, Kampagnen",
    href: "/projects/foto",
    icon: Camera,
    image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80",
    accent: "#38bdf8",
  },
  {
    label: "Social Media",
    desc: "TikTok, Instagram Reels, YouTube",
    href: "/projects/social-media",
    icon: Zap,
    image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=80",
    accent: "#8b5cf6",
  },
  {
    label: "Musikvideo",
    desc: "Musikvideos, Konzertfilme, Visuals",
    href: "/projects/musikvideo",
    icon: Music,
    image: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=800&q=80",
    accent: "#ef4444",
  },
  {
    label: "Dokumentation",
    desc: "Dokumentarfilme, Reportagen",
    href: "/projects/dokumentation",
    icon: FileVideo,
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80",
    accent: "#f59e0b",
  },
  {
    label: "Corporate",
    desc: "Imagefilme, Employer Branding",
    href: "/projects/corporate",
    icon: Building2,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    accent: "#06b6d4",
  },
  {
    label: "Event & Live",
    desc: "Konzerte, Festivals, Konferenzen",
    href: "/projects/event",
    icon: Radio,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    accent: "#f97316",
  },
];

export default function ProjectsPage() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary">

      {/* Header — no image, clean dark */}
      <div className="px-6 sm:px-10 lg:px-16 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-gold/15 border border-gold/25 flex items-center justify-center">
            <Clapperboard size={20} className="text-gold" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">CineGenius</span>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold text-text-primary leading-none mb-4">
          Projekte
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <p className="text-text-muted text-base max-w-lg">
            Entdecke Produktionen aus der DACH-Region — von Spielfilm bis Social Media Content.
          </p>
          <Link
            href="/projects/alle"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border border-border text-text-muted rounded-xl hover:border-gold/40 hover:text-gold transition-all text-sm whitespace-nowrap"
          >
            Alle durchsuchen <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-6 sm:mx-10 lg:mx-16 mb-8" />

      {/* Category Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-7xl mx-auto">
          {CATEGORIES.map(({ label, desc, href, icon: Icon, image, accent }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-2xl aspect-[3/2] block"
              style={{ "--accent": accent } as React.CSSProperties}
            >
              <Image
                src={image}
                alt={label}
                fill
                unoptimized
                className="object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
              />

              {/* Dark base overlay */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition-colors duration-500" />
              {/* Bottom gradient for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              {/* Colored top accent on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b to-transparent"
                style={{ backgroundImage: `linear-gradient(to bottom, ${accent}30, transparent)` }}
              />

              {/* Icon top-left */}
              <div
                className="absolute top-3 left-3 w-8 h-8 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10 transition-all duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${accent}25` }}
              >
                <Icon size={14} style={{ color: accent }} />
              </div>

              {/* Text bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                <p className="text-white font-bold text-sm sm:text-base leading-tight mb-0.5">{label}</p>
                <p className="text-white/55 text-[11px] sm:text-xs leading-tight hidden sm:block">{desc}</p>
              </div>

              {/* Arrow on hover */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                style={{ backgroundColor: accent }}>
                <ArrowRight size={13} className="text-white" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
