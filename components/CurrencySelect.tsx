'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import BrowseSelect from '@/components/BrowseSelect';
import { currencyOptions } from '@/lib/currency';

export default function CurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const locale = useLocale(), t = useTranslations('Regional');
  const options = useMemo(() => currencyOptions(locale, value), [locale, value]);
  return <div className="min-w-0 space-y-1.5">
    <BrowseSelect value={value} onChange={onChange} options={options} label={t('currency')} />
    <p className="text-xs leading-5 text-text-muted">{t('currencyHelp')}</p>
  </div>;
}
