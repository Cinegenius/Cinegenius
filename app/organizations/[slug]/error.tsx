'use client';

import { useTranslations } from 'next-intl';

export default function OrganizationError({ reset }: { reset: () => void }) {
  const t = useTranslations('OrganizationBrowser');
  return <main className="site-container min-h-[50vh] py-10 pb-28">
    <p role="alert" className="text-text-secondary">{t('loadError')}</p>
    <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-xl border border-border px-4 text-gold">{t('retry')}</button>
  </main>;
}
