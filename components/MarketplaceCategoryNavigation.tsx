"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Car, ChevronDown, ChevronRight, Lightbulb, Mic, Package, Search, Shirt, Wrench, X } from "lucide-react";
import { localizedMarketplaceDepartments } from "@/lib/marketplaceCategories";
import { searchMarketplaceCategoryOptions } from "@/lib/marketplace-category-search";

const FIRST_CATEGORIES = ["kamera", "licht", "ton", "grip", "requisiten", "kostuem", "fahrzeuge", "produktion"];
const ICONS = { kamera: Camera, fahrzeuge: Car, licht: Lightbulb, ton: Mic, grip: Wrench, kostuem: Shirt };

export default function MarketplaceCategoryNavigation({ department, subcategory, onChange }: {
  department: string | null; subcategory: string; onChange: (department: string | null, subcategory?: string) => void;
}) {
  const t = useTranslations("MarketplaceNavigation");
  const catalog = useTranslations("MarketplaceCatalog");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  // Browsing starts with offers; the catalogue opens only when someone needs it.
  const [expanded, setExpanded] = useState(Boolean(department && !subcategory));
  const [showAll, setShowAll] = useState(false);
  const departments = useMemo(() => localizedMarketplaceDepartments(catalog).sort((a, b) => a.label.localeCompare(b.label, locale)), [catalog, locale]);
  const selected = departments.find(row => row.id === department);
  const child = selected?.groups.find(row => row.id === subcategory);
  const matches = useMemo(() => query.trim() ? searchMarketplaceCategoryOptions(query, catalog, locale) : [], [query, catalog, locale]);
  const visibleDepartments = showAll ? departments : FIRST_CATEGORIES.flatMap(id => departments.filter(row => row.id === id));
  const tileClass = "flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return <section aria-label={t("title")} className={`${expanded ? "mb-3 pb-4" : "mb-0"} border-b border-border`} data-marketplace-navigation>
    <div className={`${expanded ? "mb-3" : ""} flex min-h-11 flex-wrap items-center justify-between gap-2`}>
      <nav aria-label={t("category")} className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm">
        <button type="button" aria-controls={!selected ? "marketplace-category-options" : undefined} aria-expanded={!selected ? expanded : undefined} onClick={() => { if (selected) onChange(null); setExpanded(value => Boolean(selected) || !value); }} className={`flex min-h-11 items-center gap-2 py-2 pr-1 ${selected ? "text-text-muted hover:text-gold" : "font-semibold text-text-primary"}`}>{t("allCategories")}{!selected && <ChevronDown size={16} aria-hidden="true" className="text-gold" />}</button>
        {selected && <><ChevronRight size={14} aria-hidden="true" className="text-text-muted" /><button type="button" onClick={() => { onChange(selected.id); setExpanded(true); }} className="min-h-11 px-1 py-2 text-text-secondary hover:text-gold">{selected.label}</button></>}
        {child && <><ChevronRight size={14} aria-hidden="true" className="text-text-muted" /><span aria-current="page" className="min-w-0 py-2 font-medium text-gold">{child.label}</span></>}
      </nav>
      {selected && <button type="button" aria-expanded={expanded} aria-controls="marketplace-category-options" onClick={() => setExpanded(value => !value)} className="min-h-11 shrink-0 px-2 text-sm text-gold hover:underline">{t("change")}</button>}
    </div>
    {expanded && <div id="marketplace-category-options">
      {!selected && <p className="mb-3 text-sm text-text-muted">{t("hint")}</p>}
      <label className="mb-3 block max-w-xl text-xs font-medium text-text-secondary">
        <span>{t("searchLabel")}</span>
        <span className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 focus-within:border-gold">
          <Search size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder={t("searchPlaceholder")} className="min-h-11 w-full min-w-0 bg-transparent text-sm text-text-primary outline-none" />
          {query && <button type="button" aria-label={t("clearSearch")} onClick={() => setQuery("")} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted"><X size={16} /></button>}
        </span>
      </label>
      {query.trim() ? <>
        <p role="status" className="mb-2 text-xs text-text-muted">{t("searchResults", { count: matches.length })}</p>
        {matches.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(showAll ? matches : matches.slice(0, 9)).map(option => <button type="button" key={option.value} onClick={() => onChange(option.departmentId, option.value)} className={tileClass}>
          <span className="min-w-0 flex-1"><span className="block font-medium">{option.label}</span><span className="mt-0.5 block text-xs text-text-muted">{option.departmentLabel}</span></span><ChevronRight size={15} aria-hidden="true" className="shrink-0" />
        </button>)}</div> : <p className="py-3 text-sm text-text-secondary">{t("empty")}</p>}
        {matches.length > 9 && !showAll && <button type="button" onClick={() => setShowAll(true)} className="mt-2 min-h-11 text-sm text-gold">{t("showAll")}</button>}
      </> : selected ? <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
        <button type="button" aria-pressed={!subcategory} onClick={() => { onChange(selected.id); setExpanded(false); }} className={`${tileClass} ${!subcategory ? "border-gold/40 text-gold" : ""}`}>{t("allInCategory", { category: selected.label })}</button>
        {[...selected.groups].sort((a, b) => a.label.localeCompare(b.label, locale)).map(group => <button type="button" key={group.id} aria-pressed={group.id === subcategory} onClick={() => onChange(selected.id, group.id)} className={`${tileClass} ${group.id === subcategory ? "border-gold/40 text-gold" : ""}`}>{group.label}</button>)}
      </div> : <>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">{visibleDepartments.map(row => {
          const Icon = ICONS[row.id as keyof typeof ICONS] ?? Package;
          return <button key={row.id} type="button" onClick={() => onChange(row.id)} className={tileClass}><Icon size={18} aria-hidden="true" className="shrink-0 text-gold" /><span className="min-w-0 flex-1">{row.label}</span><ChevronRight size={14} aria-hidden="true" className="shrink-0 text-text-muted" /></button>;
        })}</div>
        <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)} className="mt-2 min-h-11 text-sm text-gold hover:underline">{t(showAll ? "showLess" : "showAll")}</button>
      </>}
    </div>}
  </section>;
}
