'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import BrowseSelect from '@/components/BrowseSelect';
import MediaImage from '@/components/MediaImage';
import { countryName } from '@/lib/places/core';
import { ENTRY_FILTER_KEYS, ENTRY_STATUSES, emptyEntryFilters, entryCountry, entrySource, parseEntryFilters, type EntryBrowseResult, type EntryFilters } from '@/lib/organization-entry-browser';

type Props = { admin?: boolean; revision?: number; onSelect: (id: string) => void; disabled?: boolean };
const PREFIX = 'news_';
const priorityCountries = ['MX', 'IT', 'HU', 'FR', 'ES', 'CZ'];
export default function OrganizationEntryBrowser(props: Props) {
  const { user, isLoaded } = useUser();
  // Unmount all private results and in-flight work immediately on an account switch.
  return isLoaded && user ? <EntryBrowser key={user.id} {...props} /> : null;
}

function EntryBrowser({ admin = false, revision = 0, onSelect, disabled }: Props) {
  const t = useTranslations('OrganizationBrowser'), ot = useTranslations('Organizations');
  const locale = useLocale(), router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const filters = parseEntryFilters(new URLSearchParams(params.toString()), PREFIX);
  const [draft, setDraft] = useState({ search: filters.search, value: filters.search });
  if (draft.search !== filters.search) setDraft({ search: filters.search, value: filters.search });
  const query = draft.search === filters.search ? draft.value : filters.search;
  const setQuery = (value: string) => setDraft({ search: filters.search, value });
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; result?: EntryBrowseResult; error?: boolean }>({ key: '' });
  const endpoint = admin ? '/api/admin/organizations/entry-browser' : '/api/organizations/entry-browser';
  const paramsString = params.toString();
  const update = useCallback((changes: Partial<EntryFilters>, replace = false) => {
    const next = new URLSearchParams(paramsString);
    const updated = { ...parseEntryFilters(next, PREFIX), ...changes };
    if (!('page' in changes)) updated.page = 1;
    for (const key of ENTRY_FILTER_KEYS) {
      if (updated[key] === emptyEntryFilters[key]) next.delete(PREFIX + key);
      else next.set(PREFIX + key, String(updated[key]));
    }
    const url = pathname + (next.size ? `?${next}` : '');
    if (replace) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  }, [paramsString, pathname, router]);
  // Back/forward restores actual filter URLs, with no sentinel history entries.
  useEffect(() => {
    if (query === filters.search) return;
    const timer = setTimeout(() => update({ search: query }, true), 300);
    return () => clearTimeout(timer);
  }, [query, filters.search, update]);
  const requestParams = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
  const requestKey = `${endpoint}?${requestParams}&revision=${revision}&retry=${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(requestKey, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('load');
      const result = await response.json() as EntryBrowseResult;
      if (!controller.signal.aborted) setState({ key: requestKey, result });
    }).catch(() => { if (!controller.signal.aborted) setState({ key: requestKey, error: true }); });
    return () => controller.abort();
  }, [requestKey]);
  const loading = state.key !== requestKey;
  const result = state.result;
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const countryLabel = (value: string) => value === 'none' ? t('unassigned') : countryName(value, locale);
  const topicLabel = (value: string) => ot.has(`topic.${value}`) ? ot(`topic.${value}`) : value;
  const sourceLabel = (value: string) => value === 'none' ? t('noSource') : value;
  const options = (values: Record<string, number>, selected: string, label: (value: string) => string) => {
    const keys = [...new Set([...Object.keys(values), ...(selected ? [selected] : [])])];
    keys.sort((a, b) => label(a).localeCompare(label(b), locale));
    if (label === countryLabel) keys.sort((a, b) => {
      const rank = (value: string) => priorityCountries.includes(value) ? priorityCountries.indexOf(value) : 10;
      return rank(a) - rank(b);
    });
    return [{ value: '', label: t('all') }, ...keys.map(value => ({ value, label: `${label(value)}${loading ? "" : ` (${count(values[value] ?? 0)})`}` }))];
  };
  const facets = result?.facets;
  const active = (['publisher', 'country', 'topic', 'source', 'status', 'search'] as const).filter(key => filters[key]);
  const activeLabel = (key: typeof active[number]) => key === 'country' ? countryLabel(filters[key]) : key === 'topic' ? topicLabel(filters[key]) : key === 'source' ? sourceLabel(filters[key]) : key === 'status' ? ot(`status.${filters[key]}`) : key === 'publisher' ? result?.publishers.find(item => item.id === filters[key])?.name ?? t('publisher') : filters[key];
  return <section className="min-w-0 space-y-4" aria-label={t('title')}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-text-primary">{t('title')}</h2><button type="button" onClick={() => setRetry(value => value + 1)} aria-label={t('refresh')} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm text-text-secondary"><RefreshCw size={16} /><span className="hidden sm:inline">{t('refresh')}</span></button></div>
    <div className="rounded-2xl border border-border bg-bg-secondary p-3 sm:p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="relative min-w-0"><span className="sr-only">{t('search')}</span><Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-3.5 text-text-muted" /><input value={query} onChange={event => setQuery(event.target.value)} maxLength={160} placeholder={t('search')} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-primary py-2 pl-10 pr-3 text-base text-text-primary outline-none focus:border-gold" /></label>
        <BrowseSelect label={t('publisher')} value={filters.publisher} onChange={value => update({ publisher: value })} options={[{ value: '', label: t('allPublishers') }, ...(result?.publishers ?? []).map(item => ({ value: item.id, label: `${item.name}${loading ? "" : ` (${count(item.count)})`}` }))]} />
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="min-w-0"><p className="mb-1 text-xs text-text-muted">{t('country')}</p><BrowseSelect label={t('country')} value={filters.country} options={options(facets?.countries ?? {}, filters.country, countryLabel)} onChange={value => update({ country: value })} /></div>
        <div className="min-w-0"><p className="mb-1 text-xs text-text-muted">{ot('topicLabel')}</p><BrowseSelect label={ot('topicLabel')} value={filters.topic} options={options(facets?.topics ?? {}, filters.topic, topicLabel)} onChange={value => update({ topic: value })} /></div>
        <div className="col-span-2 min-w-0 sm:col-span-1"><p className="mb-1 text-xs text-text-muted">{t('source')}</p><BrowseSelect label={t('source')} value={filters.source} options={options(facets?.sources ?? {}, filters.source, sourceLabel)} onChange={value => update({ source: value })} /></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-text-muted">{t('countryHelp')}</p>
    </div>
    <BrowseSelect className="sm:hidden" label={t('status')} value={filters.status} onChange={value => update({ status: value })} options={['', ...ENTRY_STATUSES].map(status => ({ value: status, label: `${status ? ot(`status.${status}`) : t('all')} (${loading ? '…' : count(status ? facets?.statuses[status] ?? 0 : facets?.statusTotal ?? 0)})` }))} />
    <div className="hidden flex-wrap gap-2 sm:flex" role="group" aria-label={t('status')}>
      {['', ...ENTRY_STATUSES].map(status => <button key={status} type="button" aria-pressed={filters.status === status} onClick={() => update({ status })} className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${filters.status === status ? 'border-gold/40 bg-gold/10 text-gold' : 'border-border text-text-secondary'}`}>{status ? ot(`status.${status}`) : t('all')} <span className="tabular-nums text-text-muted">{loading ? '…' : count(status ? facets?.statuses[status] ?? 0 : facets?.statusTotal ?? 0)}</span></button>)}
    </div>
    {active.length > 0 && <div className="flex flex-wrap items-center gap-2" aria-label={t('activeFilters')}>{active.map(key => <button type="button" key={key} onClick={() => { if (key === 'search') setQuery(''); update({ [key]: '' }); }} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-3 text-sm text-text-secondary" aria-label={t('remove', { value: activeLabel(key) })}><span className="min-w-0 break-words">{activeLabel(key)}</span><X size={14} className="shrink-0" /></button>)}<button type="button" onClick={() => { setQuery(''); update(emptyEntryFilters); }} className="min-h-11 px-2 text-sm text-gold underline">{t('reset')}</button></div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm text-text-secondary">{loading ? t('loading') : state.error ? t('loadError') : t('results', { count: result?.total ?? 0 })}</p><BrowseSelect label={t('sort')} value={filters.sort} className="w-full sm:w-52" options={[{ value: 'newest', label: t('newest') }, { value: 'oldest', label: t('oldest') }]} onChange={value => update({ sort: value })} /></div>
    {!loading && state.error && <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-xl border border-border px-4 text-gold">{t('retry')}</button>}
    {!loading && !state.error && result && <>
      {!result.total ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-muted">{t(result.available ? 'emptyFiltered' : 'empty')}</p> : <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-bg-secondary">{result.entries.map(entry => <li key={entry.id}><button type="button" disabled={disabled} onClick={() => onSelect(entry.id)} className="flex min-h-11 w-full items-center gap-3 p-3 text-left hover:bg-bg-elevated focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-60 sm:p-4">
        {entry.image_url && <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"><MediaImage src={admin ? `/api/admin/organizations/media?reference=${encodeURIComponent(entry.image_url)}` : entry.image_url} alt="" fill sizes="48px" className="object-cover" /></span>}
        <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-5 text-text-primary">{entry.title}</span><span className="mt-1 block break-words text-xs leading-5 text-text-muted">{countryLabel(entryCountry(entry))} · {topicLabel(entry.topic)} · {sourceLabel(entrySource(entry.external_url) || 'none')}</span><span className="block break-words text-xs leading-5 text-text-muted">{t('publishedBy', { name: entry.organization.name })} · {new Date(entry.created_at).toLocaleDateString(locale)}</span><span className="mt-1 block text-xs text-gold">{ot(`status.${entry.moderation_status}`)}</span></span><ChevronRight size={17} aria-hidden className="shrink-0 text-text-muted" />
      </button></li>)}</ul>}
      {result.pages > 1 && <nav aria-label={t('pages')} className="flex flex-wrap items-center justify-between gap-2"><button type="button" disabled={result.page <= 1} onClick={() => update({ page: result.page - 1 })} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm text-text-secondary disabled:opacity-40"><ChevronLeft size={16} />{t('previous')}</button><span className="text-xs text-text-muted">{t('page', { page: result.page, pages: result.pages })}</span><button type="button" disabled={result.page >= result.pages} onClick={() => update({ page: result.page + 1 })} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-3 text-sm text-text-secondary disabled:opacity-40">{t('next')}<ChevronRight size={16} /></button></nav>}
    </>}
  </section>;
}
