'use client';

import BrowseSelect from '@/components/BrowseSelect';
import { Globe2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { countryName, UNASSIGNED_COUNTRY } from '@/lib/places/core';

export default function NewsCountrySelect({value, country, codes, onChange, disabled = false}: {
  value: string; country: string; codes: string[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const t = useTranslations('NewsRegion'), places = useTranslations('Places');
  const locale = useLocale();
  const label = (code: string) => code === UNASSIGNED_COUNTRY ? t('unassignedCountry') : countryName(code, locale);
  const hasUnassigned = codes.includes(UNASSIGNED_COUNTRY);
  const available = [...new Set(codes)].filter(code => code && code !== UNASSIGNED_COUNTRY).sort((a, b) => label(a).localeCompare(label(b), locale));
  return <BrowseSelect label={t('countryLabel')} value={value} onChange={onChange} disabled={disabled} icon={<Globe2 size={17} />} options={[
    ...(hasUnassigned || value === UNASSIGNED_COUNTRY ? [{value: UNASSIGNED_COUNTRY, label: label(UNASSIGNED_COUNTRY), disabled: !hasUnassigned}] : []),
    {value: 'auto', label: value === 'auto' && country ? t('automaticCountry', {country: label(country)}) : t('automatic')},
    {value: 'all', label: places('allCountries')},
    ...(value !== 'auto' && value !== 'all' && value !== UNASSIGNED_COUNTRY && !available.includes(value) ? [{value, label: label(value), disabled: true}] : []),
    ...available.map(code => ({value: code, label: label(code)})),
  ]} />;
}
