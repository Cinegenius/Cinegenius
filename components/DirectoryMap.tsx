"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Building2, MapPin, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import MediaImage from "./MediaImage";
import { hasCoordinates, inMapBounds, type MapBounds } from "@/lib/location-map";

function LoadingMap() {
  const t = useTranslations();
  return <div role="status" className="flex h-full items-center justify-center text-sm text-text-muted">{t("Ui.text_8cd626fb7674ab")}</div>;
}
const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false, loading: LoadingMap });

export type DirectoryMapItem = {
  id: string; title: string; city: string; subtitle: string; href: string; image: string;
  priceLabel?: string; focalPoint?: { x: number; y: number } | null;
  lat?: number | null; lng?: number | null;
};

export default function DirectoryMap({ items, kind, bounds, onBoundsChange }: {
  items: DirectoryMapItem[]; kind: "crew" | "marketplace" | "companies";
  bounds: MapBounds | null; onBoundsChange: (bounds: MapBounds | null) => void;
}) {
  const t = useTranslations("directoryMap"), mapText = useTranslations("locationMap");
  const clusterLabel = useCallback((count: number) => t("cluster", { count }), [t]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const locations = useMemo(() => items.map(item => ({ ...item, type: "", price: 0, lat: item.lat ?? null, lng: item.lng ?? null })), [items]);
  const known = locations.filter(hasCoordinates).length;
  const visible = locations.filter(hasCoordinates).filter(item => !bounds || inMapBounds(item, bounds)).length;
  return <section className="mb-6 min-w-0 space-y-3" aria-label={t(kind)}>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 text-sm text-text-secondary">{t("cityNotice")}</p>
      {bounds && <button type="button" onClick={() => onBoundsChange(null)} className="min-h-11 rounded-lg border border-border px-3 text-sm text-gold">{mapText("resetArea")}</button>}
    </div>
    <div className="directory-map-frame">
      <LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50} appliedBounds={bounds} onApplyBounds={onBoundsChange} onBoundsChange={onBoundsChange}
        visibleCount={visible} labels={{ label: t(kind), results: t("mapped", { count: visible }), empty: t("empty"), unknownCoordinates: "", cluster: clusterLabel, error: t("error") }}
        renderPreview={selected => {
          const item = items.find(row => row.id === selected.id);
          if (!item) return null;
          return <Link href={item.href} className="block overflow-hidden rounded-xl p-3 focus-visible:outline-2 focus-visible:outline-gold">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-bg-elevated">{item.image ? <MediaImage src={item.image} alt="" fill mediaSize="thumbnail" sizes="48px" className={kind === "companies" ? "object-contain p-1" : "object-cover"} style={{ objectPosition: item.focalPoint ? `${item.focalPoint.x}% ${item.focalPoint.y}%` : "50% 50%" }} /> : <div className="flex h-full items-center justify-center text-text-muted">{kind === "crew" ? <UserRound size={22} aria-hidden="true" /> : kind === "companies" ? <Building2 size={22} aria-hidden="true" /> : <MapPin size={22} aria-hidden="true" />}</div>}</div>
              <div className="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]">
                <h3 className="line-clamp-2 pr-8 text-sm font-semibold text-text-primary" title={item.title}>{item.title}</h3>
                <p className="line-clamp-2 text-xs text-text-muted" title={item.subtitle}>{item.subtitle}</p>
                <p className="truncate text-xs text-text-secondary" title={item.city}>{item.city}</p>
              </div>
            </div>
            {item.priceLabel && <p className="mt-2 line-clamp-2 text-sm font-bold text-gold">{item.priceLabel}</p>}
            <span className="flex min-h-11 items-center text-sm font-medium text-gold">{t(kind === "crew" ? "profile" : kind === "companies" ? "company" : "offer")} →</span>
          </Link>;
        }} />
    </div>
    {known < items.length && <p role="status" className="text-xs text-text-muted">{t("unmapped", { count: items.length - known })}</p>}
    <p className="text-xs text-text-muted">{t.rich("source", { provider: chunks => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a>, license: chunks => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a> })}</p>
  </section>;
}
