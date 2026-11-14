'use client';

import { Globe2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { countryName, UNASSIGNED_COUNTRY } from '@/lib/places/core';

export default function NewsCountrySelect({value, country, codes, onChange, disabled = false}: {
  value: string; country: string; codes: string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const t = useTranslations('NewsRegion'), places = useTranslations('Places');
  const locale = useLocale();
  const label = (code: string) => code === UNASSIGNED_COUNTRY ? places('countryUnassigned') : countryName(code, locale);
  const available = [...new Set(codes)].filter(Boolean).sort((a, b) => label(a).localeCompare(label(b), locale));
  return <label className="relative flex min-h-11 min-w-0 items-center rounded-xl border border-border bg-bg-secondary text-sm text-text-secondary">
    <Globe2 size={17} aria-hidden="true" className="pointer-events-none absolute left-3 shrink-0 text-text-muted" />
    <select aria-label={t('countryLabel')} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
      className="min-h-11 w-full min-w-0 appearance-auto rounded-xl bg-transparent py-2 pl-9 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60 [color-scheme:dark]">
      <option value="auto">{value === 'auto' && country ? t('automaticCountry', {country: label(country)}) : t('automatic')}</option>
      <option value="all">{places('allCountries')}</option>
      {value !== 'auto' && value !== 'all' && !available.includes(value) && <option value={value} disabled>{label(value)}</option>}
      {available.map(code => <option key={code} value={code}>{label(code)}</option>)}
    </select>
  </label>;
}
