'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { rememberNewsCountry, type NewsRegion } from '@/lib/news-region';
import { rememberNewsTopic, type HomeNewsTopic } from '@/lib/news-topic';
import { type OrganizationTopic } from '@/lib/organization-taxonomy';
import NewsCountrySelect from './NewsCountrySelect';

export default function HomeNewsRegion({region, codes, topic, topics, empty = false, failed = false}: {
  region: NewsRegion; codes: string[]; topic: HomeNewsTopic; topics: OrganizationTopic[]; empty?: boolean; failed?: boolean;
}) {
  const t = useTranslations('NewsRegion'), geo = useTranslations('Places'), organizations = useTranslations('Organizations');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const router = useRouter();
  const choose = (kind: 'country' | 'topic', value: string) => {
    const saved = kind === 'country' ? rememberNewsCountry(region.cookieName, value) : rememberNewsTopic(topic.cookieName, value);
    if (!saved) { setError(true); return; }
    setError(false);
    startTransition(() => router.refresh());
  };
  return <div className="mb-3 min-w-0" aria-busy={pending}>
    <div className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:max-w-xl">
      <NewsCountrySelect value={region.selection} country={region.country} codes={codes} onChange={value => choose('country', value)} disabled={pending}/>
      <label className="relative flex min-h-11 min-w-0 items-center rounded-xl border border-border bg-bg-secondary text-sm text-text-secondary">
        <SlidersHorizontal size={17} aria-hidden="true" className="pointer-events-none absolute left-3 shrink-0 text-text-muted"/>
        <select aria-label={organizations('topics')} value={topic.selection} onChange={event => choose('topic', event.target.value)} disabled={pending}
          className="min-h-11 w-full min-w-0 appearance-auto rounded-xl bg-transparent py-2 pl-9 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60 [color-scheme:dark]">
          <option value="all">{t('allTopics')}</option>
          {topic.selection !== 'all' && !topics.includes(topic.selection) && <option value={topic.selection} disabled>{organizations(`topic.${topic.selection}`)}</option>}
          {topics.map(value => <option key={value} value={value}>{organizations(`topic.${value}`)}</option>)}
        </select>
      </label>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-text-secondary">{t('saveError')}</p>}
    {failed ? <div role="status" className="mt-2 text-sm text-text-secondary">{t('loadError')} <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{t('retry')}</button></div>
      : empty && <div role="status" className="mt-2 text-sm text-text-secondary">{t('empty')} {region.country && <button type="button" onClick={() => choose('country', 'all')} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{geo('allCountries')}</button>}{topic.selection !== 'all' && <button type="button" onClick={() => choose('topic', 'all')} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{t('allTopics')}</button>}</div>}
  </div>;
}
