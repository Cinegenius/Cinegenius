"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import MobileBrowseControls, { MobileFilterField, MobileFilterSelect } from "@/components/MobileBrowseControls";
import { UNASSIGNED_COUNTRY } from "@/lib/places/core";
import { BrowsePreferenceControl } from "@/components/BrowseGeography";
import NewsCountrySelect from '@/components/organizations/NewsCountrySelect';
import { rememberNewsCountry, type NewsRegion } from '@/lib/news-region';
import { rememberNewsTopic } from '@/lib/news-topic';
import { ORGANIZATION_ENTRY_TYPES, ORGANIZATION_TOPICS } from "@/lib/organization-taxonomy";

type Filters = { q: string; type?: string; topic?: string; country: string };
export default function NewsBrowseControls({ filters, facets, count, region, topicCookieName }: { filters: Filters; facets: { type: string; topic: string; country: string }[]; count: number; region: NewsRegion; topicCookieName: string }) {
  const t = useTranslations("Organizations"), ui = useTranslations();
  const [draft, setDraft] = useState(filters);
  const [topicChanged, setTopicChanged] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const change = (patch: Partial<Filters>) => {
    if (Object.hasOwn(patch, 'topic')) setTopicChanged(true);
    setDraft(current => ({ ...current, ...patch }));
  };
  const apply = (values = draft, saveTopic = topicChanged) => {
    if (!rememberNewsCountry(region.cookieName, values.country)) { setSaveError(true); return; }
    if (saveTopic && !rememberNewsTopic(topicCookieName, values.topic || 'all')) { setSaveError(true); return; }
    setSaveError(false);
    setTopicChanged(false);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
    query.set('topic', values.topic || 'all');
    startTransition(() => router.push(query.size ? `/news?${query}` : "/news", { scroll: false }));
  };
  const reset = () => { const values = { ...draft, q: "", type: "", topic: "", country: "all" }; setDraft(values); setTopicChanged(true); apply(values, true); };
  const chips = (["type", "topic", "country"] as const).flatMap(key => draft[key] && (key !== 'country' || !['auto', 'all'].includes(draft.country)) ? [{ id: key, label: draft[key] === UNASSIGNED_COUNTRY ? ui("NewsRegion.unassignedCountry") : key === "country" ? (ui.has(`CountryNames.${draft[key]}`) ? ui(`CountryNames.${draft[key]}`) : draft[key]!) : t(`${key === "type" ? "entryType" : "topic"}.${draft[key]}`), onRemove: () => { const next = { ...draft, [key]: key === 'country' ? 'all' : '' }; setDraft(next); if (key === 'topic') setTopicChanged(true); apply(next, key === 'topic' || topicChanged); } }] : []);
  const preference = <BrowsePreferenceControl active={draft.country === 'auto'} label={ui(draft.country === 'auto' ? 'Places.allCountries' : 'NewsRegion.automatic')} onClick={() => { const next = {...draft, country: draft.country === 'auto' ? 'all' : 'auto'}; setDraft(next); apply(next); }} />;
  return <div aria-busy={pending}><MobileBrowseControls query={draft.q} onQueryChange={q => change({ q })} searchPlaceholder={t("searchLabel")}
    sortValue="newest" sortOptions={[{ value: "newest", label: ui("jobs.sortNewest") }]} onSortChange={() => {}}
    categoryLabel={t("type")} allCategoryLabel={t("all")} categoryValue={draft.type ?? ""} onCategoryChange={type => change({ type })}
    categories={ORGANIZATION_ENTRY_TYPES.filter(type => facets.some(row => row.type === type)).map(type => ({ value: type, label: t(`entryType.${type}`) }))}
    resultCount={pending ? null : count} resultSummary={pending ? ui("MarketplaceNavigation.loading") : ui("BrowseFilters.results", { count })}
    filterCount={chips.length} chips={chips} onReset={reset} resetLabel={ui("projects.resetFilters")} showResultsLabel={t("search")} onSearch={() => apply()} preference={preference}>
    <NewsCountrySelect value={draft.country} country={region.selection === 'auto' ? region.country : ''} onChange={country => change({ country })} codes={facets.map(row => row.country || UNASSIGNED_COUNTRY)} disabled={pending}/>
    <MobileFilterField label={t("topicLabel")}><MobileFilterSelect value={draft.topic ?? ""} onChange={topic => change({ topic })} placeholder={t("all")} options={ORGANIZATION_TOPICS.filter(topic => topic === draft.topic || facets.some(row => row.topic === topic)).map(topic => ({ value: topic, label: t(`topic.${topic}`), disabled: !facets.some(row => row.topic === topic) }))} /></MobileFilterField>
  </MobileBrowseControls>{saveError && <p role="alert" className="site-container py-2 text-sm text-text-secondary">{ui('NewsRegion.saveError')}</p>}</div>;
}
