"use client";

import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { placeOptions, matchesPlace } from "@/lib/places/core";

export type PlaceFilterValue = { country: string; region: string; city: string };
export const EMPTY_PLACE_FILTERS: PlaceFilterValue = { country: "", region: "", city: "" };

/** Parents supply the complete eligible corpus (or its public facet projection), not a result page. */
export default function PlaceFilters({ rows, value, onChange }: { rows: object[]; value: PlaceFilterValue; onChange: (value: PlaceFilterValue) => void }) {
  const locale = useLocale(), t = useTranslations("Places"), countries = useTranslations("CountryNames"), id = useId();
  const fields = useMemo(() => (["country", "region", "city"] as const).map(kind => {
    const eligible = kind === "city" && value.region ? rows.filter(row => matchesPlace(row, "region", value.region)) : rows;
    const options = placeOptions(eligible, kind, locale, kind === "country" ? "" : value.country)
      .map(option => kind === "country" && countries.has(option.value) ? { ...option, label: countries(option.value) } : option);
    if (kind === "country") options.sort((a,b) => a.label.localeCompare(b.label, locale));
    return { kind, options };
  }), [rows, value.country, value.region, locale, countries]);
  return <div className="grid min-w-0 gap-3 sm:grid-cols-3">{fields.map(({ kind, options }) => {
    if (!options.length && !value[kind]) return null;
    const selected = value[kind];
    const missing = selected && !options.some(option => option.value === selected);
    return <div key={kind} className="min-w-0">
      <label htmlFor={`${id}-${kind}`} className="mb-1 block text-xs text-text-muted">{t(kind)}</label>
      <div className="relative">
        <select id={`${id}-${kind}`} value={selected} onChange={event => onChange(kind === "country" ? { country: event.target.value, region: "", city: "" } : kind === "region" ? { ...value, region: event.target.value, city: "" } : { ...value, city: event.target.value })}
          className="min-h-11 w-full min-w-0 appearance-none rounded-lg border border-border bg-bg-primary pl-3 pr-9 text-sm text-text-primary focus:border-gold focus:outline-none">
          <option value="">{t(kind === "country" ? "allCountries" : kind === "region" ? "allRegions" : "allCities")}</option>
          {missing && <option value={selected} disabled>{kind === "country" && countries.has(selected) ? countries(selected) : placeOptions(rows, kind, locale).find(option => option.value === selected)?.label ?? selected}</option>}
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
      </div>
    </div>;
  })}</div>;
}
