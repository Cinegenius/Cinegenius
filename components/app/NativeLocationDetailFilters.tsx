"use client";

import { useTranslations } from "next-intl";
import { type LocationDetailFilters } from "@/lib/location-browse-details";
import NativeFilterNumber from "./NativeFilterNumber";

export default function NativeLocationDetailFilters({ value, onChange, power, onPowerChange, deferNumbers = false }: {
  value: LocationDetailFilters; onChange: (patch: LocationDetailFilters) => void; power: boolean; onPowerChange: (value: boolean) => void; deferNumbers?:boolean;
}) {
  const ui = useTranslations();
  const numeric = (key: "sqm" | "ceiling" | "parking", label: string, unit?: string) => <label className="mobile-filter-field"><span>{label}</span><div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-primary px-3">
    <NativeFilterNumber key={deferNumbers ? `${key}:${value[key] ?? ""}` : key} defer={deferNumbers} className="min-h-11 w-full min-w-0 bg-transparent text-sm" aria-label={label} min="0" max="1000000" step={key === "ceiling" ? "0.1" : "1"} value={value[key] ?? ""} placeholder="—" onCommit={next => onChange({ [key]: next })} />
    {unit && <span aria-hidden="true" className="shrink-0 text-sm text-text-muted">{unit}</span>}
  </div></label>;
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">{numeric("sqm", ui("BrowseFilters.areaMin"), "m²")}{numeric("ceiling", ui("BrowseFilters.heightMin"), "m")}</div>
    <div className="grid grid-cols-2 gap-3">{numeric("parking", ui("BrowseFilters.parkingMin"))}<label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" checked={value.loading === "1"} onChange={event => onChange({ loading: event.target.checked ? "1" : "" })} />{ui("AdminReview.fields.loading_access")}</label></div>
    <details><summary className="flex min-h-11 cursor-pointer items-center text-sm">{ui("BrowseFilters.equipment")}</summary><div className="space-y-1">
      <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" checked={power} onChange={event => onPowerChange(event.target.checked)} />{ui("locations.filterPower")}</label>
      {(["blackout", "natural"] as const).map(key => <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" checked={value[key] === "1"} onChange={event => onChange({ [key]: event.target.checked ? "1" : "" })} />{ui(key === "blackout" ? "AdminReview.fields.blackout_possible" : "AdminReview.fields.natural_light")}</label>)}
    </div></details>
  </div>;
}
