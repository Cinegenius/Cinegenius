"use client";
import { useId, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe2, Navigation } from "lucide-react";
import { COUNTRY_CODES } from "@/lib/places/countries";
import type { useBrowseGeography } from "@/lib/use-browse-geography";

export function CountrySelect({ value, onChange, name, defaultValue, emptyLabel }: { value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string; emptyLabel?: string }) {
  const locale = useLocale(), t = useTranslations("Places"), countries = useTranslations("CountryNames"), id = useId();
  const options = useMemo(() => COUNTRY_CODES.map(code => ({ code, label: countries(code) })).sort((a, b) => a.label.localeCompare(b.label, locale)), [locale, countries]);
  return <label htmlFor={id} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 text-sm text-text-secondary focus-within:border-gold">
    <Globe2 size={16} aria-hidden="true" className="shrink-0 text-text-muted" /><span className="sr-only">{t("country")}</span>
    <select id={id} name={name} value={value} defaultValue={defaultValue} onChange={onChange ? event => onChange(event.target.value) : undefined} className="min-h-11 w-full min-w-0 bg-transparent outline-none">
      <option value="">{emptyLabel ?? t("allCountries")}</option>{options.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
    </select>
  </label>;
}

export default function BrowseGeography({ country, onCountryChange, geography, hasDesktopCountryFilter = false }: { country: string; onCountryChange: (value: string) => void; geography: ReturnType<typeof useBrowseGeography>; hasDesktopCountryFilter?: boolean }) {
  const t = useTranslations("BrowseGeography"), countries = useTranslations("CountryNames");
  return <div className={`site-container py-3 ${hasDesktopCountryFilter && !(geography.place && geography.eligible) && !geography.error ? "xl:hidden" : ""}`}>
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className={`w-full min-w-0 sm:max-w-xs ${hasDesktopCountryFilter ? "xl:hidden" : ""}`}><CountrySelect value={country} onChange={onCountryChange} /></div>
      {geography.place && geography.eligible && <button type="button" aria-pressed={geography.enabled} onClick={() => geography.setEnabled(!geography.enabled)} className="inline-flex min-h-11 items-center gap-2 self-start text-left text-xs text-text-secondary sm:self-auto">
        <Navigation size={14} aria-hidden="true" className={geography.enabled ? "shrink-0 text-gold" : "shrink-0 text-text-muted"} />
        {t(geography.enabled ? "preferred" : "prefer", { country: countries(geography.place.country) })}
      </button>}
      {geography.error && <button type="button" onClick={geography.retry} className="min-h-11 text-left text-xs text-text-muted">{t("retry")}</button>}
    </div>
  </div>;
}
