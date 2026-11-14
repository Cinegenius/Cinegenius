"use client";
import { UNASSIGNED_COUNTRY } from "@/lib/places/core";
import { COUNTRY_CODES } from "@/lib/places/countries";
import type { useBrowseGeography } from "@/lib/use-browse-geography";
import { Globe2,Navigation,RotateCw } from "lucide-react";
import Link from "next/link";
import { useLocale,useTranslations } from "next-intl";
import { useId,useMemo } from "react";

export function CountrySelect({ value, onChange, name, defaultValue, emptyLabel, codes = COUNTRY_CODES }: { value?: string; onChange?: (value: string) => void; name?: string; defaultValue?: string; emptyLabel?: string; codes?: readonly string[] }) {
  const locale = useLocale(), t = useTranslations("Places"), countries = useTranslations("CountryNames"), id = useId();
  const options = useMemo(() => [...new Set(codes)].map(code => ({ code, label: code === UNASSIGNED_COUNTRY ? t("countryUnassigned") : countries.has(code) ? countries(code) : code })).sort((a, b) => a.label.localeCompare(b.label, locale)), [locale, countries, codes, t]);
  if (!options.length && !value && !defaultValue) return null;
  return <label htmlFor={id} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 text-sm text-text-secondary focus-within:border-gold">
    <Globe2 size={16} aria-hidden="true" className="shrink-0 text-text-muted" /><span className="sr-only">{t("country")}</span>
    <select id={id} name={name} value={value} defaultValue={defaultValue} onChange={onChange ? event => onChange(event.target.value) : undefined} className="min-h-11 w-full min-w-0 bg-transparent outline-none">
      {(value || defaultValue) && !options.some(option => option.code === (value || defaultValue)) && <option value={value || defaultValue} disabled>{countries.has(value || defaultValue || "") ? countries(value || defaultValue || "") : (value || defaultValue)}</option>}
      <option value="">{emptyLabel ?? t("allCountries")}</option>{options.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
    </select>
  </label>;
}

type BrowsePreferenceControlProps = {
  label: string;
  active?: boolean;
  retry?: boolean;
} & ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

/** The same quiet location action for client filters and server-rendered News. */
export function BrowsePreferenceControl({ label, active = false, retry = false, href, onClick }: BrowsePreferenceControlProps) {
  const icon = retry ? <RotateCw size={16} aria-hidden="true" /> : <Navigation size={16} aria-hidden="true" />;
  const props = { className: "browse-preference-toggle", "aria-label": label, title: label, "data-active": active };
  return href !== undefined
    ? <Link {...props} href={href}>{icon}</Link>
    : <button {...props} type="button" aria-pressed={retry ? undefined : active} onClick={onClick}>{icon}</button>;
}

export default function BrowseGeography({ geography }: { geography: ReturnType<typeof useBrowseGeography> }) {
  const t = useTranslations("BrowseGeography"), countries = useTranslations("CountryNames");
  if (!geography.error && !(geography.place && geography.eligible)) return null;
  return <div className="browse-preference">
    {geography.place && geography.eligible && <BrowsePreferenceControl active={geography.enabled}
      label={t("prefer", { country: countries(geography.place.country) })}
      onClick={() => geography.setEnabled(!geography.enabled)} />}
    {geography.error && <BrowsePreferenceControl retry label={t("retry")} onClick={geography.retry} />}
  </div>;
}
