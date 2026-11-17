"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { COUNTRY_CODES } from "@/lib/places/countries";
import { readSearchPlan, unifiedSearchHref, SEARCH_AREAS, SEARCH_PRICE_UNITS, SEARCH_CURRENCIES, type SearchBudget, type SearchPlan, type SearchWish } from "@/lib/unified-search";
import { searchQueryTitle } from "@/lib/unified-search-areas";
import { useFormRouter } from "@/lib/use-form-router";
import SmartSearchClarification from "./SmartSearchClarification";

const field = "min-h-11 min-w-0 w-full rounded-lg border border-border bg-bg-elevated px-3 text-base text-text-primary";

function WishEditor({ plan, index, onUnauthorized }: { plan: SearchPlan; index: number; onUnauthorized: () => void }) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), locale = useLocale(), router = useFormRouter();
  const prices = useTranslations("MarketplaceOffer");
  const requestText = useSearchParams().get('q') ?? '';
  const [wish, setWish] = useState<SearchWish>(() => structuredClone(plan.searches[index]));
  const [requirementsText, setRequirementsText] = useState(() => (plan.searches[index].requirements ?? []).map(group => group[0]).join('\n'));
  const [exclusionsText, setExclusionsText] = useState(() => (plan.searches[index].exclude ?? []).join('\n'));
  const [error, setError] = useState(false);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const update = (patch: Partial<SearchWish>) => setWish(value => ({ ...value, ...patch }));
  const save = () => {
    const next = readSearchPlan({ version: 2, searches: plan.searches.map((item, i) => i === index ? wish : item) });
    if (!next) { setError(true); return; }
    router.replace(unifiedSearchHref(next, requestText), { scroll: false });
  };
  return <div className="space-y-3 border-t border-border pt-3">
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); save(); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="min-w-0 text-xs text-text-muted">{t("editQuery")}
          <input className={field} value={wish.query || (taxonomy.has(`departments.${wish.department}`) ? taxonomy(`departments.${wish.department}`) : wish.department)} maxLength={120}
            onChange={event => update({ query: event.target.value, department: "" })} /></label>
        <label className="min-w-0 text-xs text-text-muted">{t("editArea")}
          <select className={field} value={wish.area} onChange={event => update({ area: event.target.value as SearchWish["area"], department: "", query: wish.query || taxonomy(`departments.${wish.department}`) })}>
            <option value="all">{t("allAreas")}</option>{SEARCH_AREAS.map(area => <option key={area} value={area}>{t(`areas.${area}`)}</option>)}
          </select></label>
        <label className="min-w-0 text-xs text-text-muted">{t("quantityLabel")}
          <input className={field} type="number" min={1} max={999} inputMode="numeric" value={wish.quantity ?? ""} onChange={event => update({ quantity: event.target.value ? Number(event.target.value) : undefined })} /></label>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-xs text-text-muted">{t("conditions.budgetLimit")}<input className={field} type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" value={wish.budget?.max ?? ''} onChange={event => update({ budget: event.target.value ? { currency: 'EUR', unit: 'unspecified', scope: 'unknown', ...wish.budget, max: Number(event.target.value) } : undefined })} /></label>
        <label className="min-w-0 text-xs text-text-muted">{t("conditions.currency")}<select className={field} disabled={!wish.budget} value={wish.budget?.currency ?? 'EUR'} onChange={event => wish.budget && update({ budget: { ...wish.budget, currency: event.target.value as SearchBudget['currency'] } })}>{SEARCH_CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}</select></label>
        <label className="min-w-0 text-xs text-text-muted">{t("conditions.priceUnit")}<select className={field} disabled={!wish.budget} value={wish.budget?.unit ?? 'unspecified'} onChange={event => wish.budget && update({ budget: { ...wish.budget, unit: event.target.value as SearchBudget['unit'] } })}>{SEARCH_PRICE_UNITS.map(unit => <option key={unit} value={unit}>{unit === 'unspecified' ? t('conditions.unspecified') : prices(unit === 'purchase' ? 'sale' : unit)}</option>)}</select></label>
        <label className="min-w-0 text-xs text-text-muted">{t("conditions.priceScope")}<select className={field} disabled={!wish.budget} value={wish.budget?.scope ?? 'unknown'} onChange={event => wish.budget && update({ budget: { ...wish.budget, scope: event.target.value as SearchBudget['scope'] } })}>{['each', 'total', 'unknown'].map(scope => <option key={scope} value={scope}>{t(`conditions.${scope === 'unknown' ? 'scopeUnknown' : scope}`)}</option>)}</select></label>
        <label className="min-w-0 text-xs text-text-muted">{t("conditions.period")}<input className={field} maxLength={100} value={wish.period ?? ''} onChange={event => update({ period: event.target.value || undefined })} /></label>
      </div>
      <label className="block text-xs text-text-muted">{t('conditions.requirements')}<textarea className={`${field} py-2`} rows={2} value={requirementsText} onChange={event => { setRequirementsText(event.target.value); update({ requirements: event.target.value.split('\n').filter(value => value.trim()).map(value => wish.requirements?.find(group => group[0] === value) ?? [value]) }); }} /></label>
      <label className="block text-xs text-text-muted">{t('conditions.exclusions')}<textarea className={`${field} py-2`} rows={2} value={exclusionsText} onChange={event => { setExclusionsText(event.target.value); update({ exclude: event.target.value.split('\n').filter(value => value.trim()) }); }} /></label>
      {wish.unsupported?.map((value, i) => <div key={i} className="flex min-w-0 items-center gap-2 text-xs text-text-muted"><span className="min-w-0 flex-1 break-words">{t('conditions.unsupported', { values: value })}</span><button type="button" className="min-h-11 min-w-11" aria-label={t('conditions.removeCondition')} onClick={() => update({ unsupported: wish.unsupported?.filter((_, j) => i !== j) })}><X className="mx-auto" size={16} /></button></div>)}
      {wish.places.map((place, p) => <div className="grid min-w-0 grid-cols-[1fr_44px] gap-2 sm:grid-cols-[1fr_1fr_44px]" key={p}>
        <label className="min-w-0 text-xs text-text-muted">{t("editCity")}<input className={field} maxLength={100} value={place.city} onChange={event => update({ places: wish.places.map((item, i) => i === p ? { ...item, city: event.target.value, continent: "" } : item) })} /></label>
        <label className="col-start-1 min-w-0 text-xs text-text-muted sm:col-auto">{t("editCountry")}<select className={field} value={place.country} onChange={event => update({ places: wish.places.map((item, i) => i === p ? { ...item, country: event.target.value, continent: "" } : item) })}>
          <option value="">{t("anyCountry")}</option>{COUNTRY_CODES.map(code => <option key={code} value={code}>{names.of(code)}</option>)}</select></label>
        <button type="button" className="col-start-2 row-start-1 min-h-11 min-w-11 self-end text-text-muted sm:col-auto sm:row-auto" aria-label={t("removePlace")} onClick={() => update({ places: wish.places.filter((_, i) => i !== p) })}><X size={18} className="mx-auto" /></button>
        {place.city && <label className="col-span-full text-xs text-text-muted">{t('conditions.radius')}<input className={field} type="number" min={0} max={200} inputMode="numeric" value={place.radiusKm} onChange={event => update({ places: wish.places.map((item, i) => i === p ? { ...item, radiusKm: Number(event.target.value) } : item) })} /></label>}
        {(place.continent || place.radiusKm > 0) && <p className="col-span-full text-xs text-text-muted">{place.continent ? names.of(place.continent) : t("withinRadius", { place: place.city, radius: place.radiusKm })}</p>}
      </div>)}
      <div className="flex flex-wrap items-center gap-3">
        {wish.places.length < 4 && <button type="button" className="min-h-11 text-sm text-gold" onClick={() => update({ places: [...wish.places, { city: "", country: "", continent: "", radiusKm: 0 }] })}>{t("addPlace")}</button>}
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm text-gold" type="submit">{t("applyWish")}</button>
        {plan.searches.length > 1 && <button type="button" className="min-h-11 text-sm text-text-muted" onClick={() => router.replace(unifiedSearchHref({ ...plan, searches: plan.searches.filter((_, i) => i !== index) }, requestText), { scroll: false })}>{t("removeWish")}</button>}
      </div>
      {error && <p role="alert" className="text-sm text-text-secondary">{t("editInvalid")}</p>}
    </form>
    <SmartSearchClarification question={t("refineWish")} requestText="" searchContext={{ plan, wishIndex: index }} onUnauthorized={onUnauthorized} />
  </div>;
}

export default function SmartSearchWishes({ plan, onUnauthorized, compact = false }: { plan: SearchPlan; onUnauthorized: () => void; compact?: boolean }) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), locale = useLocale();
  const prices = useTranslations("MarketplaceOffer");
  const [opened, setOpened] = useState<number[]>([]);
  const [refineOpened, setRefineOpened] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!compact || !panelOpen || !panel.current) return;
    const viewport = window.visualViewport;
    const resize = () => {
      const element = panel.current;
      if (!element) return;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const navigation = document.querySelector('nav.safe-area-pb')?.getBoundingClientRect();
      const usableBottom = navigation?.height ? Math.min(bottom, navigation.top) : bottom;
      element.style.maxHeight = `${Math.max(44, usableBottom - element.getBoundingClientRect().top - 12)}px`;
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', resize, { passive: true });
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); window.removeEventListener('scroll', resize); };
  }, [compact, panelOpen]);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return <details className={compact ? "smart-plan-editor" : "mt-3 rounded-xl border border-border bg-bg-secondary/70 px-3"} onToggle={event => { if (event.target === event.currentTarget) setPanelOpen(event.currentTarget.open); }} onKeyDown={event => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}><summary aria-label={t("discovery.understood")} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 text-sm text-text-primary"><Pencil size={16} aria-hidden="true" /><span className={compact ? "sr-only" : ""}>{t("discovery.understood")}</span></summary><div ref={panel} className={compact ? "smart-plan-editor-panel space-y-2" : "space-y-2 pb-3"}>
    {plan.searches.map((wish, index) => <details key={index} className="rounded-xl border border-border bg-bg-secondary/70 px-3" onToggle={event => {
      if (event.currentTarget.open) setOpened(values => values.includes(index) ? values : [...values, index]);
    }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm text-text-secondary">
        <span className="min-w-0 flex-1 break-words">{wish.quantity ? `${wish.quantity} × ` : ""}{searchQueryTitle(wish, t) || taxonomy(`departments.${wish.department}`)}
          {wish.places.length > 0 && <span className="text-text-muted"> · {wish.places.map(place => [place.city, place.country && names.of(place.country), place.continent && names.of(place.continent)].filter(Boolean).join(", ")).join(" / ")}</span>}
          {wish.recommended && <span className="ml-2 text-xs text-text-muted">{t("suggested")}</span>}
          {!!wish.requirements?.length && <span className="block text-xs text-text-muted">{t("required", { values: wish.requirements.map(group => group[0]).join(" · ") })}</span>}
          {!!wish.exclude?.length && <span className="block text-xs text-text-muted">{t("excluded", { values: wish.exclude.join(" · ") })}</span>}
          {wish.budget && <span className="block text-xs text-text-muted">{t('conditions.budgetLimit')}: {new Intl.NumberFormat(locale, { style: 'currency', currency: wish.budget.currency }).format(wish.budget.max)} · {wish.budget.unit === 'unspecified' ? t('conditions.unspecified') : prices(wish.budget.unit === 'purchase' ? 'sale' : wish.budget.unit)} · {t(`conditions.${wish.budget.scope === 'unknown' ? 'scopeUnknown' : wish.budget.scope}`)}</span>}
          {wish.period && <span className="block text-xs text-text-muted">{t('conditions.period')}: {wish.period} · {t('conditions.periodNote')}</span>}
          {!!wish.unsupported?.length && <span className="block text-xs text-text-muted">{t('conditions.unsupported', { values: wish.unsupported.join(' · ') })}</span>}
        </span><Pencil size={16} aria-hidden="true" /><span className="sr-only">{t("editWish")}</span>
      </summary>
      {opened.includes(index) && <WishEditor plan={plan} index={index} onUnauthorized={onUnauthorized} />}
    </details>)}
    {plan.searches.some(wish => wish.quantity) && <p className="text-xs text-text-muted">{t("quantityNotice")}</p>}
    <details onToggle={event => { if (event.currentTarget.open) setRefineOpened(true); }}><summary className="flex min-h-11 cursor-pointer items-center text-sm text-gold">{t("refineSearch")}</summary>
      {refineOpened && <SmartSearchClarification question={t("refineHint")} requestText="" searchContext={{ plan }} onUnauthorized={onUnauthorized} />}
    </details>
  </div></details>;
}
