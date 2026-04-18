import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Film, Tv, Camera, Zap, Music, FileVideo, Building2, Radio, ArrowRight,
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
    color: "from-purple-900/80",
  },
  {
    label: "Werbung",
    desc: "TV-Spots, Commercials, Online-Ads",
    href: "/projects/werbung",
    icon: Tv,
    image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=800&q=80",
    color: "from-pink-900/80",
  },
  {
    label: "Foto & Shooting",
    desc: "Editorial, Portrait, Kampagnen",
    href: "/projects/foto",
    icon: Camera,
    image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80",
    color: "from-sky-900/80",
  },
  {
    label: "Social Media",
    desc: "TikTok, Instagram Reels, YouTube",
    href: "/projects/social-media",
    icon: Zap,
    image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80",
    color: "from-violet-900/80",
  },
  {
    label: "Musikvideo",
    desc: "Musikvideos, Konzertfilme, Visuals",
    href: "/projects/musikvideo",
    icon: Music,
    image: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=800&q=80",
    color: "from-red-900/80",
  },
  {
    label: "Dokumentation",
    desc: "Dokumentarfilme, Reportagen",
    href: "/projects/dokumentation",
    icon: FileVideo,
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80",
    color: "from-amber-900/80",
  },
  {
    label: "Corporate",
    desc: "Imagefilme, Employer Branding",
    href: "/projects/corporate",
    icon: Building2,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    color: "from-cyan-900/80",
  },
  {
    label: "Event & Live",
    desc: "Konzerte, Festivals, Konferenzen",
    href: "/projects/event",
    icon: Radio,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    color: "from-orange-900/80",
  },
];

export default function ProjectsPage() {
  return (
    <div className="pt-16 min-h-screen bg-bg-primary">

      {/* Hero */}
      <div className="relative overflow-hidden h-[220px] sm:h-[280px]">
        <Image
          src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&q=90"
          alt="Projekte"
          fill
          priority
          unoptimized
          className="object-cover"
          style={{ objectPosition: "center 50%" }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
        <div className="absolute inset-0 flex items-center px-6 sm:px-10 lg:px-16">
          <div>
            <span className="inline-flex items-center px-3 py-1 bg-white/12 backdrop-blur-sm border border-white/20 rounded-full text-[11px] text-white/90 font-bold uppercase tracking-widest mb-4">
              Projekte
            </span>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-2">
              Filmprojekte &<br />
              <span className="text-gradient-gold">Produktionen</span>
            </h1>
            <p className="text-white/60 text-sm max-w-md">
              Wähle eine Kategorie — oder durchsuche alle Produktionen.
            </p>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {CATEGORIES.map(({ label, desc, href, icon: Icon, image, color }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-2xl aspect-[4/3] block"
            >
              <Image
                src={image}
                alt={label}
                fill
                unoptimized
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
              />
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t ${color} via-black/20 to-transparent`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
                    <Icon size={12} className="text-white" />
                  </div>
                  <span className="text-white font-bold text-sm leading-tight">{label}</span>
                </div>
                <p className="text-white/60 text-[11px] leading-tight hidden sm:block">{desc}</p>
              </div>

              {/* Hover arrow */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gold/0 group-hover:bg-gold/90 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100">
                <ArrowRight size={13} className="text-bg-primary" />
              </div>
            </Link>
          ))}
        </div>

        {/* All projects link */}
        <div className="mt-8 text-center">
          <Link
            href="/projects/alle"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border text-text-secondary rounded-xl hover:border-gold/40 hover:text-gold transition-all text-sm"
          >
            Alle Projekte durchsuchen <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
