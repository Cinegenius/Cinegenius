"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "@/components/MediaImage";
import Link from "next/link";
import { Search, MapPin, Star, ArrowRight, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { locationCategoryLabel } from "@/lib/location-category-labels";

export type LocationCard = {
  id: string; title: string; type: string; city: string; price: number;
  priceOnRequest: boolean; priceLabel: string;
  image: string; rating: number; reviews: number;
  focalPoint?: { x: number; y: number } | null;
};

export default function LocationsLanding({ allLocations, totalCount }: { allLocations: LocationCard[]; totalCount: number }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("locations");
  const categoryText = useTranslations("menu");
  const [query, setQuery] = useState("");
  const locations = allLocations.slice(0, 24);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/locations/suche${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        optimizeImage
        badge={t("landingBadge")}
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={totalCount > 0 ? `${t("results", { count: totalCount })} · ${t("heroDesc")}` : t("heroDesc")}
        ctaSecondary={{ label: t("landingAll"), href: "/locations/suche" }}
        cta={{ label: t("heroCta"), href: "/inserat?group=drehorte" }}
      >
        <form onSubmit={handleSearch} className="max-w-2xl">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated p-1.5 transition-colors focus-within:border-gold/50">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search size={15} aria-hidden="true" className="shrink-0 text-text-muted" />
              <input
                type="search"
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label={t("landingClear")} className="min-h-11 min-w-11 text-text-muted transition-colors hover:text-text-primary">×</button>
              )}
            </div>
            <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light">
              {t("landingSearch")} <ArrowRight size={14} aria-hidden="true" className="ml-1 inline" />
            </button>
          </div>
        </form>
      </PageHeader>

      <div className="site-container mobile-bottom-nav-clear space-y-10 py-8 sm:space-y-14 sm:py-10">
        {allLocations.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-bg-elevated"><MapPin size={24} aria-hidden="true" className="text-text-muted" /></div>
            <p className="mb-1 font-semibold text-text-primary">{t("emptyTitle")}</p>
            <p className="mb-6 text-sm text-text-muted">{t("emptyDesc")}</p>
            <Link href="/inserat?group=drehorte" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary"><Plus size={14} aria-hidden="true" />{t("emptyAction")}</Link>
          </div>
        ) : (
          <section aria-labelledby="locations-discover-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="locations-discover-title" className="text-xl font-bold text-text-primary sm:text-2xl">{t("landingDiscover")}</h2>
              <span className="text-sm text-text-muted">{t("results", { count: totalCount })}</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map(location => (
                <Link key={location.id} href={`/locations/${location.id}`} className="browse-card group flex min-w-0 flex-col transition-colors hover:border-gold/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
                  <div className="relative aspect-video w-full overflow-hidden bg-bg-elevated">
                    {location.image ? (
                      <Image
                        src={location.image}
                        alt={location.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        mediaSize="thumbnail"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        style={location.focalPoint ? { objectPosition: `${location.focalPoint.x * 100}% ${location.focalPoint.y * 100}%` } : undefined}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><MapPin size={28} aria-hidden="true" className="text-text-muted" /></div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 text-text-primary transition-colors group-hover:text-gold">{location.title}</h3>
                    <p className="mt-2 break-words text-sm text-text-muted">{location.type ? locationCategoryLabel(location.type, categoryText) : t("landingBadge")}</p>
                    {location.city && <p className="mt-1 flex items-start gap-1.5 text-sm text-text-secondary"><MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" /><span className="min-w-0 break-words">{location.city}</span></p>}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                      {location.rating > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-text-muted"><Star size={12} aria-hidden="true" className="fill-gold text-gold" />{location.rating.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span>({location.reviews.toLocaleString(locale)})</span></span>
                      ) : (
                        <span title={t("landingNoReviews")} className="text-xs text-text-muted">{t("newBadge")}</span>
                      )}
                      <span className="break-words text-sm font-bold text-gold">{location.priceLabel}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {allLocations.length > locations.length && (
              <div className="mt-6 text-center"><Link href="/locations/suche" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-gold/50 hover:text-gold">{t("landingMore")}<ArrowRight size={14} aria-hidden="true" /></Link></div>
            )}
          </section>
        )}

        {allLocations.length > 0 && (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-bg-elevated p-6 sm:flex-row sm:items-center sm:p-8">
            <div><p className="mb-1 text-lg font-bold text-text-primary">{t("heroCta")}</p><p className="text-sm text-text-muted">{t("heroDesc")}</p></div>
            <Link href="/inserat?group=drehorte" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light">{t("heroCta")}<ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
