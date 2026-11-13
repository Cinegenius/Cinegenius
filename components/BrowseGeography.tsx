"use client";
import { COUNTRY_CODES } from "@/lib/places/countries";
import type { useBrowseGeography } from "@/lib/use-browse-geography";
import { Globe2,Navigation } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import { useId,useMemo } from "react";

export function CountrySelect({ value, onChange, name, defaultValue, emptyLabel, codes = COUNTRY_CODES }: { value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string; emptyLabel?: string; codes?: readonly string[] }) {
  const locale = useLocale(), t = useTranslations("Places"), countries = useTranslations("CountryNames"), id = useId();
  const options = useMemo(() => [...new Set(codes)].map(code => ({ code, label: countries.has(code) ? countries(code) : code })).sort((a, b) => a.label.localeCompare(b.label, locale)), [locale, countries, codes]);
  if (!options.length && !value && !defaultValue) return null;
  return <label htmlFor={id} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 text-sm text-text-secondary focus-within:border-gold">
    <Globe2 size={16} aria-hidden="true" className="shrink-0 text-text-muted" /><span className="sr-only">{t("country")}</span>
    <select id={id} name={name} value={value} defaultValue={defaultValue} onChange={onChange ? event => onChange(event.target.value) : undefined} className="min-h-11 w-full min-w-0 bg-transparent outline-none">
      {(value || defaultValue) && !options.some(option => option.code === (value || defaultValue)) && <option value={value || defaultValue} disabled>{countries.has(value || defaultValue || "") ? countries(value || defaultValue || "") : (value || defaultValue)}</option>}
      <option value="">{emptyLabel ?? t("allCountries")}</option>{options.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
    </select>
  </label>;
}

export default function BrowseGeography({ geography }: { geography: ReturnType<typeof useBrowseGeography> }) {
  const t = useTranslations("BrowseGeography"), countries = useTranslations("CountryNames");
  if (!geography.error && !(geography.place && geography.eligible)) return null;
  return <div className="browse-preference">
    {geography.place && geography.eligible && <button type="button" aria-pressed={geography.enabled} onClick={() => geography.setEnabled(!geography.enabled)} className="inline-flex min-h-11 items-center gap-2 text-left text-xs text-text-secondary">
      <Navigation size={14} aria-hidden="true" className={geography.enabled ? "shrink-0 text-gold" : "shrink-0 text-text-muted"} />
      {t(geography.enabled ? "preferred" : "prefer", { country: countries(geography.place.country) })}
    </button>}
    {geography.error && <button type="button" onClick={geography.retry} className="min-h-11 text-left text-xs text-text-muted">{t("retry")}</button>}
  </div>;
}
