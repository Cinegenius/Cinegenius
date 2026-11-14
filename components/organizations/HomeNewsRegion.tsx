'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { rememberNewsCountry, type NewsRegion } from '@/lib/news-region';
import NewsCountrySelect from './NewsCountrySelect';

export default function HomeNewsRegion({region, codes, empty = false, failed = false}: {region: NewsRegion; codes: string[]; empty?: boolean; failed?: boolean}) {
  const t = useTranslations('NewsRegion'), geo = useTranslations('Places');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const router = useRouter();
  const choose = (value: string) => {
    if (!rememberNewsCountry(region.cookieName, value)) { setError(true); return; }
    setError(false);
    startTransition(() => router.refresh());
  };
  return <div className="mb-3 min-w-0" aria-busy={pending}>
    <div className="w-full max-w-xs"><NewsCountrySelect value={region.selection} country={region.country} codes={codes} onChange={choose} disabled={pending}/></div>
    {error && <p role="alert" className="mt-2 text-sm text-text-secondary">{t('saveError')}</p>}
    {failed ? <div role="status" className="mt-2 text-sm text-text-secondary">{t('loadError')} <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{t('retry')}</button></div>
      : empty && <div role="status" className="mt-2 text-sm text-text-secondary">{t('empty')} {region.country && <button type="button" onClick={() => choose('all')} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{geo('allCountries')}</button>}</div>}
  </div>;
}
