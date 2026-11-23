"use client";

import { TranslatedText } from "@/components/ContentTranslation";

import VerifiedBadge from "@/components/VerifiedBadge";
import MediaImage from "@/components/MediaImage";
import ListingImage from "@/components/ListingImage";
import ProfileCardPhoto from "@/components/ProfileCardPhoto";
import CompanyLogo from "@/components/CompanyLogo";
import { ChevronRight, Briefcase, Building2, Car, MapPin, Package, PawPrint, User, Users, Film, Newspaper } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { SearchResult as Result } from "@/lib/unified-search";
import type { CSSProperties } from "react";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { nativeSmartAreaForType, nativeSmartColorStyle } from "@/lib/native-smart-colors";
import styles from "./SearchResultCard.module.css";

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

export default function ResultCard({ result, compact = false, showEvidence = false, row = false }: { result: Result; compact?: boolean; showEvidence?: boolean; row?: boolean }) {
  const uiText = useTranslations();
  const typeConfig = getLocalizedTypeConfig(uiText);

  const uiLocale = useLocale();

  const animals = useTranslations("FilmAnimals");
  const nativeAppearance = useNativeAppAppearance();
  const cfg = typeConfig[result.type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const isProfile = result.type === "profile" || result.type === "creator";
  const nativeCrew = nativeAppearance && isProfile;
  const isCompany = result.type === "company" || result.type === "organization";
  const nativeArea = nativeAppearance ? nativeSmartAreaForType(result.type) : null;
  const PreviewImage = ["location", "vehicle", "prop", "animal"].includes(result.type) ? ListingImage : MediaImage;

  if (nativeAppearance && compact && row) {
    const occupation = nativeCrew ? result.crewPreview?.occupation : undefined;
    const place = nativeCrew ? result.crewPreview?.place : result.subtitle;
    return <Link href={cfg.href(result.id)} data-search-result-card={result.type}
      data-native-crew-preview={nativeCrew ? "true" : undefined} data-native-browse-row="true"
      data-native-smart-area={nativeArea ?? undefined} data-result-layout="row"
      style={nativeArea ? nativeSmartColorStyle(nativeArea) as CSSProperties : undefined}
      aria-label={[result.title, isProfile && result.verified === true ? uiText("common.verified") : null, occupation, place, result.priceLabel].filter(Boolean).join(", ")}
      className={`${styles.card} ${styles.rowCard} ${nativeCrew ? styles.crewRowCard : ""} ${isCompany ? styles.companyRowCard : ""} directory-entry group`}>
      <div data-result-image={isCompany ? "logo" : "photo"} className={styles.rowPhoto}>
        {nativeCrew ? <ProfileCardPhoto src={result.image ?? ""} name={result.title} className="h-full w-full rounded-full border border-border/60" sizes="36px" />
          : isCompany ? <CompanyLogo src={result.image} name={result.title} className="h-full w-full" />
          : result.image ? <PreviewImage src={result.image} alt={result.title} fill mediaSize="thumbnail" sizes="64px" className="object-cover" />
          : <div data-result-placeholder className="flex h-full items-center justify-center text-text-muted"><Icon size={24} aria-hidden="true" /></div>}
      </div>
      <div className="directory-entry-body">
        <h3 data-result-title title={result.title} className="directory-entry-title"><SearchResultTitle result={result} /></h3>
        {nativeCrew && occupation && <p data-result-occupation title={occupation}>{occupation}</p>}
        {!nativeCrew && place && <p data-result-subtitle className="directory-entry-place"><MapPin size={11} aria-hidden="true" /><span title={place}>{place}</span></p>}
        {!nativeCrew && showEvidence && result.evidence && <p className="text-xs text-text-muted">{uiText(`UnifiedSearch.discovery.evidence.${result.evidence}`)}</p>}
        {!nativeCrew && result.nearby && <p className="text-xs text-text-muted">{uiText("UnifiedSearch.nearbyDistance", { distance: result.nearby.distanceKm.toLocaleString(uiLocale), place: result.nearby.origin })}</p>}
        {!isProfile && !isCompany && result.type !== "animal" && (result.priceLabel || result.price > 0) && <p data-result-price className="directory-entry-price">
          {result.priceLabel ?? uiText("Ui.text_4519fabedb2cbd", { value1: String(result.price.toLocaleString(uiLocale)) })}
        </p>}
      </div>
      {nativeCrew && place && <p data-result-place className={styles.crewRowPlace}><MapPin size={10} aria-hidden="true" /><span title={place}>{place}</span></p>}
    </Link>;
  }

  // The app uses the same compact Crew identity and fixed offer-photo geometry
  // as the public directory, while retaining Smart's permission-checked results.
  if (nativeCrew && !compact) {
    const occupation = result.crewPreview?.occupation;
    const place = result.crewPreview?.place;
    return <Link href={cfg.href(result.id)} data-search-result-card={result.type}
      data-native-crew-preview="true" data-native-smart-area={nativeArea ?? undefined} data-result-layout="grid"
      style={nativeArea ? nativeSmartColorStyle(nativeArea) as CSSProperties : undefined}
      aria-label={[result.title, isProfile && result.verified === true ? uiText("common.verified") : null, occupation, place].filter(Boolean).join(", ")}
      className={`${styles.card} ${styles.crewBrowseCard} browse-card card-hover group flex min-w-0 items-center gap-1.5 p-2 sm:gap-3 sm:p-3`}>
      <div data-result-image="photo" className={styles.crewPhoto}>
        <ProfileCardPhoto src={result.image ?? ""} name={result.title}
          className="h-full w-full rounded-lg border border-border/60"
          sizes="(min-width: 1024px) 96px, (min-width: 640px) 88px, (min-width: 375px) 56px, 48px" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 data-result-title title={result.title} className="min-w-0 break-words [overflow-wrap:anywhere] font-semibold text-text-primary text-[13px] leading-snug sm:text-sm"><SearchResultTitle result={result} /></h3>
        </div>
        {occupation && <p data-result-occupation title={occupation} className="line-clamp-2 text-[11px] leading-snug text-gold font-medium sm:text-xs">{occupation}</p>}
        {place && <p data-result-place className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] text-text-muted sm:text-xs">
          <MapPin size={11} className="shrink-0" aria-hidden="true" /><span title={place} className="truncate">{place}</span>
        </p>}
      </div>
    </Link>;
  }
  if (nativeAppearance && !compact && isCompany) {
    return <Link href={cfg.href(result.id)} data-search-result-card={result.type}
      data-native-smart-area={nativeArea ?? undefined} data-result-layout="grid"
      style={nativeArea ? nativeSmartColorStyle(nativeArea) as CSSProperties : undefined}
      className={`${styles.card} ${styles.companyBrowseCard} browse-card directory-entry directory-company group`}>
      <div data-result-image="logo"><CompanyLogo src={result.image} name={result.title} className="h-full w-full" /></div>
      <div className="directory-entry-body">
        <h3 data-result-title className="directory-entry-title" title={result.title}><SearchResultTitle result={result} /></h3>
        {result.subtitle && <p data-result-subtitle className="directory-entry-place"><MapPin size={11} aria-hidden="true" /><span title={result.subtitle}>{result.subtitle}</span></p>}
      </div>
    </Link>;
  }
  if (nativeAppearance && !compact) {
    return <Link href={cfg.href(result.id)} data-search-result-card={result.type}
      data-native-smart-area={nativeArea ?? undefined} data-result-layout="grid"
      style={nativeArea ? nativeSmartColorStyle(nativeArea) as CSSProperties : undefined}
      className={`${styles.card} ${styles.offerBrowseCard} directory-entry browse-card group`}>
      <div data-result-image={result.type === "company" || result.type === "organization" ? "logo" : "photo"} className="directory-entry-photo">
        {result.image ? <PreviewImage src={result.image} alt={result.title} fill mediaSize="thumbnail"
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
          className={result.type === "company" || result.type === "organization" ? "object-contain" : "object-cover"} />
          : <div data-result-placeholder className="flex h-full items-center justify-center text-text-muted"><Icon size={24} aria-hidden="true" /></div>}
      </div>
      <div className="directory-entry-body">
        <h3 data-result-title className="directory-entry-title" title={result.title}><SearchResultTitle result={result} /></h3>
        <p data-result-subtitle className="directory-entry-place"><MapPin size={11} aria-hidden="true" /><span title={result.subtitle}>{result.subtitle}</span></p>
        {result.type !== "animal" && (result.priceLabel || result.price > 0) && <p data-result-price className="directory-entry-price font-bold">
          {result.priceLabel ?? uiText("Ui.text_4519fabedb2cbd", { value1: String(result.price.toLocaleString(uiLocale)) })}
        </p>}
      </div>
    </Link>;
  }

  return (
    <Link
      href={cfg.href(result.id)}
      data-search-result-card={result.type}
      data-native-crew-preview={nativeCrew ? "true" : undefined}
      data-native-smart-area={nativeArea ?? undefined}
      style={nativeArea ? nativeSmartColorStyle(nativeArea) as CSSProperties : undefined}
      data-result-layout={compact ? "row" : "grid"}
      className={`${styles.card} ${row ? "smart-result-row" : ""} group flex min-w-0 bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-gold/40 transition-colors ${compact ? "items-center gap-2.5 p-2" : "flex-col hover:shadow-lg hover:shadow-black/20"}`}
    >
      {/* Image */}
      <div data-result-image={result.type === "company" || result.type === "organization" ? "logo" : "photo"} className={`${row && isProfile ? "smart-result-portrait" : ""} relative bg-bg-elevated overflow-hidden ${compact ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-md" : "aspect-video"}`}>
        {result.image ? (
          <PreviewImage
            {...(compact ? { width: 48, height: 48 } : { fill: true })}
            sizes={compact ? "48px" : "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 240px"} mediaSize="thumbnail"
            src={result.image}
            alt={result.title}
            className="w-full h-full object-contain object-center"
          />
        ) : (
          <div data-result-placeholder className={`w-full h-full flex items-center justify-center border ${cfg.bgColor}`}>
            <Icon size={compact ? 22 : 32} className={`${cfg.color} opacity-40`} />
          </div>
        )}
        {/* Type badge */}
        {!compact && !nativeAppearance && <div data-result-type-badge className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-sm ${cfg.bgColor}`}>
          <Icon size={10} className={cfg.color} />
          <span className={cfg.color}>{result.type === "animal" ? animals("portfolio") : cfg.label}</span>
        </div>}
        {/* Availability dot for profiles */}
        {!nativeCrew && !compact && isProfile && result.available !== null && (
          <div className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${result.available ? "bg-success" : "bg-text-muted"}`}
            title={result.available ? uiText("common.available") : uiText("common.booked")} />
        )}
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 flex flex-col ${compact ? "" : "p-4"}`}>
        {!compact && nativeAppearance && !isProfile && <div data-result-type-badge className={`mb-2 inline-flex self-start items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${cfg.bgColor}`}>
          <Icon size={10} className={cfg.color} aria-hidden="true" />
          <span className={cfg.color}>{result.type === "animal" ? animals("portfolio") : cfg.label}</span>
        </div>}
        <h3 data-result-title title={result.title} className={`font-semibold text-sm text-text-primary leading-tight group-hover:text-gold transition-colors ${compact ? "truncate" : "mb-1 line-clamp-2"}`}>
          <SearchResultTitle result={result} />
        </h3>
        {nativeCrew && result.crewPreview ? <>
          {result.crewPreview.occupation && <p data-result-occupation className="text-xs text-text-muted">{result.crewPreview.occupation}</p>}
          {result.crewPreview.place && <p data-result-place className="text-xs text-text-muted">{result.crewPreview.place}</p>}
        </> : <p data-result-subtitle title={result.subtitle} className="text-xs text-text-muted line-clamp-1 flex-1">{result.subtitle}</p>}
        {!nativeCrew && showEvidence && result.evidence && <p className="mt-1 text-xs text-text-secondary">{uiText(`UnifiedSearch.discovery.evidence.${result.evidence}`)}</p>}
        {!nativeCrew && result.nearby && <p className="text-xs text-text-muted">{uiText("UnifiedSearch.nearbyDistance", { distance: result.nearby.distanceKm.toLocaleString(uiLocale), place: result.nearby.origin })}</p>}
        {!isProfile && result.type !== "animal" && (result.priceLabel || result.price > 0) && (
          <p data-result-price className={`${compact ? "text-xs" : "mt-2 text-sm"} font-semibold font-mono text-gold`}>
            {result.priceLabel ?? uiText("Ui.text_4519fabedb2cbd", { value1: String(result.price.toLocaleString(uiLocale)) })}
          </p>
        )}
        {!nativeCrew && !compact && isProfile && result.available !== null && (
          <div className={`${compact ? "mt-1" : "mt-2"} flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${result.available ? "bg-success" : "bg-text-muted"}`} />
            <span className="text-xs text-text-muted">{result.available ? uiText("common.available") : uiText("creators.currentlyBooked")}</span>
          </div>
        )}
      </div>
      {!nativeCrew && compact && !row && isProfile && result.available !== null && <span role="img"
        aria-label={result.available ? uiText("common.available") : uiText("common.booked")}
        title={result.available ? uiText("common.available") : uiText("common.booked")}
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${result.available ? "bg-success" : "bg-text-muted"}`} />}
      {row && <ChevronRight size={15} className="shrink-0 text-text-muted" aria-hidden="true" />}
    </Link>
  );
}


export function SearchResultTitle({result}: {result: Result}) {
  const t = useTranslations("common");
  const id = result.sourceId ?? result.id;
  if (["location", "vehicle", "prop", "job"].includes(result.type)) return <TranslatedText kind="listing" id={id} field="title">{result.title}</TranslatedText>;
  if (result.type === "news") return <TranslatedText kind="news" id={id} field="title">{result.title}</TranslatedText>;
  return <>{result.title}{(result.type === "profile" || result.type === "creator") && <VerifiedBadge verified={result.verified} label={t("verified")} />}</>;
}
