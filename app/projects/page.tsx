import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  Film, Tv, Camera, Zap, Music, FileVideo, Building2, Radio, ArrowRight,
} from "lucide-react";
import PageHeader, { PageBackdrop, PROJECTS_BACKDROP_IMAGE } from "@/components/PageHeader";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Projekte — CineGenius",
  description: "Filmprojekte & Produktionen auf CineGenius — wähle eine Kategorie.",
};

const CATEGORIES_META = [
  { labelKey: "catFilmSerie" as const,   descKey: "catFilmSerieDesc" as const,   href: "/projects/film",       icon: Film,      image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catWerbung" as const,     descKey: "catWerbungDesc" as const,     href: "/projects/werbung",    icon: Tv,        image: "https://images.unsplash.com/photo-1557858310-9052820906f7?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catFoto" as const,        descKey: "catFotoDesc" as const,        href: "/projects/foto",       icon: Camera,    image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catSocialMedia" as const, descKey: "catSocialMediaDesc" as const, href: "/projects/social-media",icon: Zap,      image: "https://images.unsplash.com/photo-1683721003111-070bcc053d8b?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catMusikvideo" as const,  descKey: "catMusikvideoDesc" as const,  href: "/projects/musikvideo", icon: Music,     image: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catDokumentation" as const,descKey: "catDokumentationDesc" as const,href: "/projects/dokumentation",icon: FileVideo,image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catCorporate" as const,   descKey: "catCorporateDesc" as const,   href: "/projects/corporate",  icon: Building2, image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", accent: "#c8f135" },
  { labelKey: "catEvent" as const,       descKey: "catEventDesc" as const,       href: "/projects/event",      icon: Radio,     image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80", accent: "#c8f135" },
];

export default async function ProjectsPage() {
  const t = await getTranslations("projects");
  const CATEGORIES = CATEGORIES_META.map((c) => ({
    ...c,
    label: t(c.labelKey),
    desc: t(c.descKey),
  }));
  const [titleLead = "", titleTail = ""] = t("title").split("&");

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-bg-primary">
      <PageBackdrop image={PROJECTS_BACKDROP_IMAGE} className="absolute inset-0 z-0" />
      <PageHeader
        badge={t("badge")}
        title={`${titleLead.trim()} &`}
        titleHighlight={titleTail.trim()}
        description={t("subtitle")}
        withBackdrop={false}
        ctaSecondary={{ label: t("allBrowse"), href: "/projects/alle" }}
        cta={{ label: t("addProject"), href: "/projects/neu" }}
      />

      {/* Category Grid */}
      <div className="relative z-10 site-container pb-16">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
