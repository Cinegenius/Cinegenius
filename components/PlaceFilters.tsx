"use client";

import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import BrowseSelect from "@/components/BrowseSelect";
import { browsePlaceOptions as placeOptions, UNASSIGNED_COUNTRY, matchesPlace } from "@/lib/places/core";

export type PlaceFilterValue = { country: string; region: string; city: string };
export const EMPTY_PLACE_FILTERS: PlaceFilterValue = { country: "", region: "", city: "" };

/** Parents supply the complete eligible corpus (or its public facet projection), not a result page. */
export default function PlaceFilters({ rows, value, onChange }: { rows: object[]; value: PlaceFilterValue; onChange: (value: PlaceFilterValue) => void }) {
  const locale = useLocale(), t = useTranslations("Places"), countries = useTranslations("CountryNames"), id = useId();
  const fields = useMemo(() => (["country", "region", "city"] as const).map(kind => {
    const eligible = kind === "city" && value.region ? rows.filter(row => matchesPlace(row, "region", value.region)) : rows;
    const options = placeOptions(eligible, kind, locale, kind === "country" ? "" : value.country)
      .map(option => option.value === UNASSIGNED_COUNTRY ? { ...option, label: t("countryUnassigned") } : kind === "country" && countries.has(option.value) ? { ...option, label: countries(option.value) } : option);
    if (kind === "country") options.sort((a,b) => a.label.localeCompare(b.label, locale));
    return { kind, options };
  }), [rows, value.country, value.region, locale, countries, t]);
  return <div className="grid min-w-0 gap-3 sm:grid-cols-3">{fields.map(({ kind, options }) => {
    if (!options.length && !value[kind]) return null;
    const selected = value[kind];
    const missing = selected && !options.some(option => option.value === selected);
    return <div key={kind} className="min-w-0">
      <label htmlFor={`${id}-${kind}`} className="mb-1 block text-xs text-text-muted">{t(kind)}</label>
      <BrowseSelect id={`${id}-${kind}`} label={t(kind)} value={selected}
        onChange={next => onChange(kind === "country" ? { country: next, region: "", city: "" } : kind === "region" ? { ...value, region: next, city: "" } : { ...value, city: next })}
        triggerClassName="browse-filter-select"
        options={[
          { value: "", label: t(kind === "country" ? "allCountries" : kind === "region" ? "allRegions" : "allCities") },
          ...(missing ? [{ value: selected, label: kind === "country" && countries.has(selected) ? countries(selected) : placeOptions(rows, kind, locale).find(option => option.value === selected)?.label ?? selected, disabled: true }] : []),
          ...options,
        ]} />
    </div>;
  })}</div>;
}
