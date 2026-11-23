"use client";

import { useTranslations } from "next-intl";
import PlaceFilters, { type PlaceFilterValue } from "@/components/PlaceFilters";
import BrowseSelect from "@/components/BrowseSelect";
import { browseRadiusCenter, type BrowseRadius } from "@/lib/browse-radius";

export default function NativeBrowsePlaceFilters({ rows, value, onChange, radius, onRadiusChange }: {
  rows: object[]; value: PlaceFilterValue; onChange: (value: PlaceFilterValue) => void;
  radius: BrowseRadius | null; onRadiusChange: (value: BrowseRadius | null) => void;
}) {
  const ui = useTranslations();
  const center = browseRadiusCenter(rows, value.city);
  return <div className="space-y-3"><PlaceFilters rows={rows} value={value} onChange={next => { onRadiusChange(null); onChange(next); }} />
    <div className="mobile-filter-field"><label>{ui("locations.radiusLabel")}</label><BrowseSelect label={ui("locations.radiusLabel")} value={radius ? String(radius.km) : ""}
      triggerClassName="browse-filter-select" options={[{ value: "", label: ui("BrowseFilters.cityOnly") }, ...[10, 25, 50, 100, 200].map(km => ({ value: String(km), label: ui("locations.inRadius", { radius: km }), disabled: !center }))]}
      onChange={km => onRadiusChange(km && center ? { ...center, city: value.city, km: Number(km) } : null)} />
    </div>
    <p className="text-xs leading-relaxed text-text-muted">{ui(center ? "BrowseFilters.radiusHint" : "BrowseFilters.chooseCity")}</p>
  </div>;
}
