'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { rememberNewsCountry, type NewsRegion } from '@/lib/news-region';
import { rememberNewsTopic, type HomeNewsTopic } from '@/lib/news-topic';
import { type OrganizationTopic } from '@/lib/organization-taxonomy';
import BrowseSelect from '@/components/BrowseSelect';
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
  return <div className="w-full min-w-0 lg:self-end" aria-busy={pending}>
    <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:max-w-xl">
      <NewsCountrySelect value={region.selection} country={region.country} codes={codes} onChange={value => choose('country', value)} disabled={pending}/>
      <BrowseSelect label={organizations('topics')} value={topic.selection} onChange={value => choose('topic', value)} disabled={pending} icon={<SlidersHorizontal size={17} />} options={[
        {value: 'all', label: t('allTopics')},
        ...(topic.selection !== 'all' && !topics.includes(topic.selection) ? [{value: topic.selection, label: organizations(`topic.${topic.selection}`), disabled: true}] : []),
        ...topics.map(value => ({value, label: organizations(`topic.${value}`)})),
      ]} />
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-text-secondary">{t('saveError')}</p>}
    {failed ? <div role="status" className="mt-2 text-sm text-text-secondary">{t('loadError')} <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{t('retry')}</button></div>
      : empty && <div role="status" className="mt-2 text-sm text-text-secondary">{t('empty')} {region.country && <button type="button" onClick={() => choose('country', 'all')} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{geo('allCountries')}</button>}{topic.selection !== 'all' && <button type="button" onClick={() => choose('topic', 'all')} disabled={pending} className="inline-flex min-h-11 items-center px-2 text-gold">{t('allTopics')}</button>}</div>}
  </div>;
}
