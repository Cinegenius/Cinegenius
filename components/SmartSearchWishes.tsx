"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, X } from "lucide-react";
import { COUNTRY_CODES } from "@/lib/places/countries";
import { readSearchPlan, unifiedSearchHref, SEARCH_AREAS, type SearchPlan, type SearchWish } from "@/lib/unified-search";
import { searchQueryTitle } from "@/lib/unified-search-areas";
import { useFormRouter } from "@/lib/use-form-router";
import SmartSearchClarification from "./SmartSearchClarification";

const field = "min-h-11 min-w-0 w-full rounded-lg border border-border bg-bg-elevated px-3 text-base text-text-primary";

function WishEditor({ plan, index, onUnauthorized }: { plan: SearchPlan; index: number; onUnauthorized: () => void }) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), locale = useLocale(), router = useFormRouter();
  const [wish, setWish] = useState<SearchWish>(() => structuredClone(plan.searches[index]));
  const [error, setError] = useState(false);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const update = (patch: Partial<SearchWish>) => setWish(value => ({ ...value, ...patch }));
  const save = () => {
    const next = readSearchPlan({ version: 2, searches: plan.searches.map((item, i) => i === index ? wish : item) });
    if (!next) { setError(true); return; }
    router.replace(unifiedSearchHref(next), { scroll: false });
  };
  return <div className="space-y-3 border-t border-border pt-3">
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); save(); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="min-w-0 text-xs text-text-muted">{t("editQuery")}
          <input className={field} value={wish.query || (taxonomy.has(`departments.${wish.department}`) ? taxonomy(`departments.${wish.department}`) : wish.department)} maxLength={120}
            onChange={event => update({ query: event.target.value, department: "" })} /></label>
        <label className="min-w-0 text-xs text-text-muted">{t("editArea")}
          <select className={field} value={wish.area} onChange={event => update({ area: event.target.value as SearchWish["area"], department: "", query: wish.query || taxonomy(`departments.${wish.department}`), places: wish.places.map(place => ({ ...place, radiusKm: event.target.value === "crew" ? place.radiusKm : 0 })) })}>
            <option value="all">{t("allAreas")}</option>{SEARCH_AREAS.map(area => <option key={area} value={area}>{t(`areas.${area}`)}</option>)}
          </select></label>
        <label className="min-w-0 text-xs text-text-muted">{t("quantityLabel")}
          <input className={field} type="number" min={1} max={999} inputMode="numeric" value={wish.quantity ?? ""} onChange={event => update({ quantity: event.target.value ? Number(event.target.value) : undefined })} /></label>
      </div>
      {wish.places.map((place, p) => <div className="grid min-w-0 grid-cols-[1fr_44px] gap-2 sm:grid-cols-[1fr_1fr_44px]" key={p}>
        <label className="min-w-0 text-xs text-text-muted">{t("editCity")}<input className={field} maxLength={100} value={place.city} onChange={event => update({ places: wish.places.map((item, i) => i === p ? { ...item, city: event.target.value, continent: "" } : item) })} /></label>
        <label className="col-start-1 min-w-0 text-xs text-text-muted sm:col-auto">{t("editCountry")}<select className={field} value={place.country} onChange={event => update({ places: wish.places.map((item, i) => i === p ? { ...item, country: event.target.value, continent: "" } : item) })}>
          <option value="">{t("anyCountry")}</option>{COUNTRY_CODES.map(code => <option key={code} value={code}>{names.of(code)}</option>)}</select></label>
        <button type="button" className="col-start-2 row-start-1 min-h-11 min-w-11 self-end text-text-muted sm:col-auto sm:row-auto" aria-label={t("removePlace")} onClick={() => update({ places: wish.places.filter((_, i) => i !== p) })}><X size={18} className="mx-auto" /></button>
        {(place.continent || place.radiusKm > 0) && <p className="col-span-full text-xs text-text-muted">{place.continent ? names.of(place.continent) : t("withinRadius", { place: place.city, radius: place.radiusKm })}</p>}
      </div>)}
      <div className="flex flex-wrap items-center gap-3">
        {wish.places.length < 4 && <button type="button" className="min-h-11 text-sm text-gold" onClick={() => update({ places: [...wish.places, { city: "", country: "", continent: "", radiusKm: 0 }] })}>{t("addPlace")}</button>}
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm text-gold" type="submit">{t("applyWish")}</button>
        {plan.searches.length > 1 && <button type="button" className="min-h-11 text-sm text-text-muted" onClick={() => router.replace(unifiedSearchHref({ ...plan, searches: plan.searches.filter((_, i) => i !== index) }), { scroll: false })}>{t("removeWish")}</button>}
      </div>
      {error && <p role="alert" className="text-sm text-text-secondary">{t("editInvalid")}</p>}
    </form>
    <SmartSearchClarification question={t("refineWish")} requestText="" searchContext={{ plan, wishIndex: index }} onUnauthorized={onUnauthorized} />
  </div>;
}

export default function SmartSearchWishes({ plan, onUnauthorized }: { plan: SearchPlan; onUnauthorized: () => void }) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), locale = useLocale();
  const [opened, setOpened] = useState<number[]>([]);
  const [refineOpened, setRefineOpened] = useState(false);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return <details className="mt-3 rounded-xl border border-border bg-bg-secondary/70 px-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-primary"><Pencil size={16} aria-hidden="true" />{t("discovery.understood")}</summary><div className="space-y-2 pb-3">
    {plan.searches.map((wish, index) => <details key={index} className="rounded-xl border border-border bg-bg-secondary/70 px-3" onToggle={event => {
      if (event.currentTarget.open) setOpened(values => values.includes(index) ? values : [...values, index]);
    }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm text-text-secondary">
        <span className="min-w-0 flex-1 break-words">{wish.quantity ? `${wish.quantity} × ` : ""}{searchQueryTitle(wish, t) || taxonomy(`departments.${wish.department}`)}
          {wish.places.length > 0 && <span className="text-text-muted"> · {wish.places.map(place => [place.city, place.country && names.of(place.country), place.continent && names.of(place.continent)].filter(Boolean).join(", ")).join(" / ")}</span>}
          {wish.recommended && <span className="ml-2 text-xs text-text-muted">{t("suggested")}</span>}
          {!!wish.requirements?.length && <span className="block text-xs text-text-muted">{t("required", { values: wish.requirements.map(group => group[0]).join(" · ") })}</span>}
          {!!wish.exclude?.length && <span className="block text-xs text-text-muted">{t("excluded", { values: wish.exclude.join(" · ") })}</span>}
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
