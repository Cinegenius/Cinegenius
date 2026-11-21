'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import BrowseSelect from '@/components/BrowseSelect';
import { countryName } from '@/lib/places/core';
import { emptyPublicEntryFilters, publicEntryHref, type PublicEntryBrowse, type PublicEntryFilters } from '@/lib/public-organization-entries';

type Props = { filters: PublicEntryFilters; result: Omit<PublicEntryBrowse, 'ids'>; children: ReactNode };
export default function PublicOrganizationEntries({ filters, result, children }: Props) {
  const t = useTranslations('OrganizationBrowser'), ot = useTranslations('Organizations'), ui = useTranslations();
  const locale = useLocale(), router = useRouter(), pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState({ committed: filters.search, value: filters.search });
  if (draft.committed !== filters.search) setDraft({ committed: filters.search, value: filters.search });
  const search = draft.committed === filters.search ? draft.value : filters.search;
  const update = (changes: Partial<PublicEntryFilters>) => {
    const next = { ...filters, search, page: 1, ...changes };
    startTransition(() => router.push(publicEntryHref(pathname, next), { scroll: false }));
  };
  const labels = {
    country: (value: string) => value === 'none' ? t('unassigned') : countryName(value, locale),
    topic: (value: string) => value === 'none' ? t('unassigned') : ot.has(`topic.${value}`) ? ot(`topic.${value}`) : value,
    type: (value: string) => ot.has(`entryType.${value}`) ? ot(`entryType.${value}`) : value,
    source: (value: string) => value === 'none' ? t('noSource') : value,
    search: (value: string) => value,
  };
  const fields = ['country', 'topic', 'type', 'source'] as const;
  const fieldLabels = { country: t('country'), topic: ot('topicLabel'), type: ot('type'), source: t('source') };
  const active = ([...fields, 'search'] as const).filter(key => filters[key]);
  const reset = () => { setDraft({ committed: filters.search, value: '' }); update(emptyPublicEntryFilters); };
  const choice = (key: typeof fields[number]) => {
    const values = [...new Set([...Object.keys(result.facets[key]), ...(filters[key] ? [filters[key]] : [])])];
    values.sort((a, b) => a === 'none' ? -1 : b === 'none' ? 1 : labels[key](a).localeCompare(labels[key](b), locale));
    return <div className="min-w-0"><p className="mb-1.5 text-xs text-text-muted">{fieldLabels[key]}</p><BrowseSelect
      className="w-full" label={fieldLabels[key]} value={filters[key]} disabled={pending}
      onChange={value => update({ [key]: value })}
      options={[{ value: '', label: t('all') }, ...values.map(value => ({ value,
        label: `${labels[key](value)} (${new Intl.NumberFormat(locale).format(result.facets[key][value] ?? 0)})`,
      }))]} /></div>;
  };
  return <section className="min-w-0 space-y-4" aria-labelledby="public-organization-entries" aria-busy={pending}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="public-organization-entries" className="font-serif text-2xl text-text-primary sm:text-3xl">{ot('organizationEntries')}</h2>
      <p role="status" aria-live="polite" className="text-sm tabular-nums text-text-muted">{pending ? t('loading') : t('results', { count: result.total })}</p>
    </div>
    <div className="rounded-2xl border border-border bg-bg-secondary p-3 sm:p-4">
      <form onSubmit={event => { event.preventDefault(); update({ search }); }} className="flex min-w-0 gap-2">
        <label className="relative min-w-0 flex-1"><span className="sr-only">{t('search')}</span><Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-3.5 text-text-muted" /><input type="search" maxLength={160} value={search} onChange={event => setDraft({ committed: filters.search, value: event.target.value })} placeholder={t('search')} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary py-2 pl-10 pr-3 text-base text-text-primary outline-none focus:border-gold" /></label>
        <button type="submit" disabled={pending} aria-label={ot('search')} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold disabled:opacity-50"><Search size={19} aria-hidden /></button>
      </form>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {choice('country')}
        <button type="button" disabled={pending} onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="public-news-filters" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm text-text-secondary sm:hidden"><SlidersHorizontal size={17} aria-hidden />{ui('locations.filterBtn')}{active.length > 0 && <span className="text-gold">{new Intl.NumberFormat(locale).format(active.length)}</span>}</button>
        <div id="public-news-filters" className={expanded ? 'contents' : 'hidden sm:contents'}>{choice('topic')}{choice('type')}{choice('source')}</div>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-label={t('activeFilters')}>
        {active.map(key => <button type="button" disabled={pending} key={key} onClick={() => { if (key === 'search') setDraft({ committed: filters.search, value: '' }); update({ [key]: '' }); }} aria-label={t('remove', { value: labels[key](filters[key]) })} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-3 text-sm text-text-secondary"><span className="min-w-0 break-all">{labels[key](filters[key])}</span><X size={14} className="shrink-0" aria-hidden /></button>)}
        {(active.length > 0 || filters.sort !== 'newest') && <button type="button" disabled={pending} onClick={reset} className="min-h-11 px-2 text-sm text-gold underline">{t('reset')}</button>}
      </div>
      <BrowseSelect label={t('sort')} value={filters.sort} disabled={pending} onChange={sort => update({ sort })} className="w-full sm:w-52" options={[{ value: 'newest', label: t('newest') }, { value: 'oldest', label: t('oldest') }]} />
    </div>
    <div inert={pending} className={pending ? 'opacity-50' : ''}>
      {result.total ? children : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-muted">{result.available ? t('emptyFiltered') : ot('emptyOrganization')}</p>}
      {result.pages > 1 && <nav aria-label={t('pages')} className="mt-5 flex flex-wrap items-center justify-between gap-2">
        {result.page > 1 ? <Link prefetch={false} href={publicEntryHref(pathname, { ...filters, page: result.page - 1 })} scroll={false} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm text-text-secondary"><ChevronLeft size={16} aria-hidden />{t('previous')}</Link> : <span />}
        <span className="text-xs text-text-muted">{t('page', { page: result.page, pages: result.pages })}</span>
        {result.page < result.pages ? <Link prefetch={false} href={publicEntryHref(pathname, { ...filters, page: result.page + 1 })} scroll={false} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm text-text-secondary">{t('next')}<ChevronRight size={16} aria-hidden /></Link> : <span />}
      </nav>}
    </div>
  </section>;
}
