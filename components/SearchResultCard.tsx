"use client";
import MediaImage from "@/components/MediaImage";
import ListingImage from "@/components/ListingImage";
import { Briefcase, Building2, Car, MapPin, Package, PawPrint, User, Users, Film, Newspaper } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { SearchResult as Result } from "@/lib/unified-search";

export function getLocalizedTypeConfig(translate: (key: string) => string): Record<string, {
  label: string;
  pluralLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: (id: string) => string;
  color: string;
  bgColor: string;
}> {
  return ({
  profile:  { label: translate("nav.crew"),        pluralLabel: translate("nav.crew"),        icon: User,      href: (id) => `/profile/${id}`,   color: "text-gold",          bgColor: "bg-gold/10 border-gold/20"      },
  creator:  { label: translate("nav.crew"),        pluralLabel: translate("nav.crew"),        icon: Users,     href: (id) => `/profile/${id}`,   color: "text-gold",          bgColor: "bg-gold/10 border-gold/20"      },
  location: { label: translate("profile.labelLocation"),     pluralLabel: translate("nav.locations"),    icon: MapPin,    href: (id) => `/locations/${id}`, color: "text-sky-400",        bgColor: "bg-sky-500/10 border-sky-500/20"   },
  vehicle:  { label: translate("AdminAccounts.contentKinds.vehicle"),    pluralLabel: translate("footer.links_vehicles"),   icon: Car,       href: (id) => `/vehicles/${id}`,  color: "text-orange-400",    bgColor: "bg-orange-500/10 border-orange-500/20" },
  prop:     { label: translate("Ui.text_27c673e10176f0"),   pluralLabel: translate("search.typeProps"),  icon: Package,   href: (id) => `/props/${id}`,     color: "text-violet-400",    bgColor: "bg-violet-500/10 border-violet-500/20" },
  job:      { label: translate("AdminAccounts.contentKinds.job"),         pluralLabel: translate("nav.jobs"),        icon: Briefcase, href: (id) => `/jobs/${id}`,      color: "text-emerald-400",   bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  animal: {label: translate("FilmAnimals.portfolio"), pluralLabel: translate("FilmAnimals.portfolio"), icon: PawPrint, href: id => `/tiere/${id}`, color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20"},
  company:  { label: translate("AdminReview.types.company"),       pluralLabel: translate("nav.companies"),      icon: Building2, href: (id) => `/companies/${id}`, color: "text-blue-400",      bgColor: "bg-blue-500/10 border-blue-500/20" },
  project: { label: translate("nav.projects"), pluralLabel: translate("nav.projects"), icon: Film, href: id => `/projects/${id}`, color: "text-gold", bgColor: "bg-gold/10 border-gold/20" },
  news: { label: translate("nav.news"), pluralLabel: translate("nav.news"), icon: Newspaper, href: id => `/news/${id}`, color: "text-gold", bgColor: "bg-gold/10 border-gold/20" },
  organization: { label: translate("UnifiedSearch.areas.organizations"), pluralLabel: translate("UnifiedSearch.areas.organizations"), icon: Building2, href: id => `/organizations/${id}`, color: "text-gold", bgColor: "bg-gold/10 border-gold/20" },
});
}

export default function ResultCard({ result, compact = false }: { result: Result; compact?: boolean }) {
  const uiText = useTranslations();
  const typeConfig = getLocalizedTypeConfig(uiText);

  const uiLocale = useLocale();

  const animals = useTranslations("FilmAnimals");
  const cfg = typeConfig[result.type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const isProfile = result.type === "profile" || result.type === "creator";
  const PreviewImage = ["location", "vehicle", "prop", "animal"].includes(result.type) ? ListingImage : MediaImage;

  return (
    <Link
      href={cfg.href(result.id)}
      className={`group flex min-w-0 bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-gold/40 transition-colors ${compact ? "items-center gap-2.5 p-2" : "flex-col hover:shadow-lg hover:shadow-black/20"}`}
    >
      {/* Image */}
      <div className={`relative bg-bg-elevated overflow-hidden ${compact ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-md" : "aspect-video"}`}>
        {result.image ? (
          <PreviewImage
            {...(compact ? { width: 48, height: 48 } : { fill: true })}
            sizes={compact ? "48px" : "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 240px"} mediaSize="thumbnail"
            src={result.image}
            alt={result.title}
            className="w-full h-full object-contain object-center"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center border ${cfg.bgColor}`}>
            <Icon size={compact ? 22 : 32} className={`${cfg.color} opacity-40`} />
          </div>
        )}
        {/* Type badge */}
        {!compact && <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${cfg.bgColor}`}>
          <Icon size={10} className={cfg.color} />
          <span className={cfg.color}>{result.type === "animal" ? animals("portfolio") : cfg.label}</span>
        </div>}
        {/* Availability dot for profiles */}
        {!compact && isProfile && result.available !== null && (
          <div className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${result.available ? "bg-success" : "bg-text-muted"}`}
            title={result.available ? uiText("common.available") : uiText("common.booked")} />
        )}
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 flex flex-col ${compact ? "" : "p-4"}`}>
        <h3 title={result.title} className={`font-semibold text-sm text-text-primary leading-tight group-hover:text-gold transition-colors ${compact ? "truncate" : "mb-1 line-clamp-2"}`}>
          {result.title}
        </h3>
        <p title={result.subtitle} className="text-xs text-text-muted line-clamp-1 flex-1">{result.subtitle}</p>
        {!isProfile && result.type !== "animal" && (result.priceLabel || result.price > 0) && (
          <p className={`${compact ? "text-xs" : "mt-2 text-sm"} font-semibold font-mono text-gold`}>
            {result.priceLabel ?? uiText("Ui.text_4519fabedb2cbd", { value1: String(result.price.toLocaleString(uiLocale)) })}
          </p>
        )}
        {!compact && isProfile && result.available !== null && (
          <div className={`${compact ? "mt-1" : "mt-2"} flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${result.available ? "bg-success" : "bg-text-muted"}`} />
            <span className="text-xs text-text-muted">{result.available ? uiText("common.available") : uiText("creators.currentlyBooked")}</span>
          </div>
        )}
      </div>
      {compact && isProfile && result.available !== null && <span role="img"
        aria-label={result.available ? uiText("common.available") : uiText("common.booked")}
        title={result.available ? uiText("common.available") : uiText("common.booked")}
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${result.available ? "bg-success" : "bg-text-muted"}`} />}
    </Link>
  );
}
