"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { useFormRouter } from "@/lib/use-form-router";
import { decodeSearchPlan, searchPlanFromHref, SEARCH_AREAS, type SearchPlan, type SearchGroup } from "@/lib/unified-search";
import ResultCard from "@/components/SearchResultCard";

const groupKey = (group: SearchGroup) => `${group.area}:${group.wishIndex}`;
const SEARCH_ERROR = { invalid: "invalid", unavailable: "unavailable", unauthorized: "unauthorized" } as const;

export default function UnifiedSearchResults() {
  const t = useTranslations("UnifiedSearch");
  const genie = useTranslations("Genie");
  const taxonomy = useTranslations("Taxonomy");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useFormRouter();
  const { userId, isLoaded } = useAuth();
  const encodedPlan = params.get("plan");
  const requestText = params.get("q") ?? "";
  const [input, setInput] = useState(requestText);
  const [plan, setPlan] = useState<SearchPlan | null>(null);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clarification, setClarification] = useState("");
  const [retry, setRetry] = useState(0);
  const [morePending, setMorePending] = useState<string[]>([]);
  const [moreErrors, setMoreErrors] = useState<string[]>([]);
  const [resultScope, setResultScope] = useState("");
  const active = useRef<AbortController | null>(null);
  const inputSource = useRef("");
  const interpretationAttempt = useRef<{ text: string; retry: number } | null>(null);
  const pages = useRef(new Set<AbortController>());
  const navigation = useRef(router);
  useEffect(() => { navigation.current = router; }, [router]);
  const scope = JSON.stringify([encodedPlan, requestText, locale, userId, isLoaded]);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    const pendingPages = pages.current;
    for (const pending of pendingPages) pending.abort();
    pendingPages.clear();
    // A deferred start avoids duplicate paid requests during React's effect replay.
    const timer = setTimeout(async () => {
      setResultScope(scope);
      setMorePending([]); setMoreErrors([]); setGroups([]); setError(""); setClarification("");
      const decoded = decodeSearchPlan(encodedPlan);
      setPlan(decoded);
      const source = JSON.stringify([encodedPlan, requestText]);
      if (inputSource.current !== source) {
        inputSource.current = source;
        const names = new Intl.DisplayNames([locale], { type: "region" });
        const summary = decoded?.searches.map(wish => {
          const key = `departments.${wish.department}`;
          const title = wish.query || (taxonomy.has(key) ? taxonomy(key) : wish.department);
          const places = wish.places.map(place => {
            const label = [place.city, place.country ? names.of(place.country) : "", place.continent ? names.of(place.continent) : ""].filter(Boolean).join(", ");
            return place.radiusKm ? t("withinRadius", { place: label, radius: place.radiusKm }) : label;
          });
          return [title, ...places].filter(Boolean).join(" · ");
        }).join("; ");
        setInput(requestText || summary || "");
      }
      if (!isLoaded) { setLoading(false); return; }
      if (!userId) { setError(SEARCH_ERROR.unauthorized); setLoading(false); return; }
      if (!encodedPlan && !requestText.trim()) { setLoading(false); return; }
      if (encodedPlan && !decoded) { setError(SEARCH_ERROR.invalid); setLoading(false); return; }
      setLoading(true);
      try {
        if (decoded) {
          interpretationAttempt.current = null;
          const response = await fetch("/api/search/unified", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal, body: JSON.stringify({ plan: decoded }) });
          const data = await response.json();
          if (!response.ok) throw new Error(response.status === 401 ? "unauthorized" : data.error || SEARCH_ERROR.unavailable);
          if (!controller.signal.aborted) setGroups(data.groups);
        } else {
          // Locale/account changes may cancel a request, but never repeat paid
          // interpretation of the previous input without another explicit send.
          if (interpretationAttempt.current?.text === requestText && interpretationAttempt.current.retry === retry) {
            setError(SEARCH_ERROR.unavailable);
            return;
          }
          interpretationAttempt.current = { text: requestText, retry };
          const response = await fetch("/api/genie", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
            body: JSON.stringify({ area: "general", locale, messages: [{ role: "user", content: requestText }] }) });
          const data = await response.json();
          if (!response.ok) throw new Error(response.status === 401 ? "unauthorized" : data.error || SEARCH_ERROR.unavailable);
          if (controller.signal.aborted) return;
          const link = Array.isArray(data.links) ? data.links.find((item: { href?: unknown }) => typeof item?.href === "string" && searchPlanFromHref(item.href)) : null;
          if (link) navigation.current.replace(link.href, { scroll: false });
          else setClarification(typeof data.reply === "string" ? data.reply : "");
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : SEARCH_ERROR.unavailable);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); for (const pending of pendingPages) pending.abort(); };
  }, [encodedPlan, requestText, locale, userId, isLoaded, retry, scope, t, taxonomy]);

  async function more(group: SearchGroup) {
    if (!plan || group.nextOffset === null || morePending.includes(groupKey(group))) return;
    const key = groupKey(group), controller = new AbortController();
    pages.current.add(controller); setMorePending(values => [...values, key]); setMoreErrors(values => values.filter(value => value !== key));
    try {
      const response = await fetch("/api/search/unified", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ plan, cursor: { wishIndex: group.wishIndex, area: group.area, offset: group.nextOffset } }) });
      const data = await response.json();
      if (response.status === 401) {
        if (!controller.signal.aborted) { setGroups([]); setError(SEARCH_ERROR.unauthorized); }
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      if (!controller.signal.aborted) setGroups(values => values.map(current => {
        if (groupKey(current) !== key) return current;
        const next = data.groups[0] as SearchGroup;
        const unique = new Map([...current.results, ...next.results].map(result => [`${result.type}:${result.id}`, result]));
        return { ...next, results: [...unique.values()] };
      }));
    } catch { if (!controller.signal.aborted) setMoreErrors(values => [...values, key]); }
    finally { pages.current.delete(controller); if (!controller.signal.aborted) setMorePending(values => values.filter(value => value !== key)); }
  }

  const errorText = error === "unauthorized" ? t("signInRequired") : error === "rate_limited" ? genie("errorRateLimited") : error === "invalid" || error === "search_unresolved" ? genie("errorSearch") : t("error");
  const returnTo = `/search?${new URLSearchParams(plan && encodedPlan ? { plan: encodedPlan } : { smart: "1", q: input })}`;
  return <main className="min-h-screen pt-16 pb-28 xl:pb-12">
    <div className="border-b border-border bg-bg-secondary/50">
      <div className="site-container py-7 sm:py-10">
        <h1 className="font-serif text-3xl text-text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t("intro")}</p>
        <form className="mt-5 flex items-center gap-2" onSubmit={event => {
          event.preventDefault(); if (!input.trim()) return;
          active.current?.abort();
          const href = `/search?${new URLSearchParams({ smart: "1", q: input.trim() })}`;
          if (!encodedPlan && input.trim() === requestText) setRetry(value => value + 1);
          else router.push(href, { scroll: false });
        }}>
          <input aria-label={t("title")} value={input} maxLength={2000} onChange={event => { active.current?.abort(); setLoading(false); setInput(event.target.value); }}
            placeholder={t("placeholder")} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-base text-text-primary focus:border-gold focus:outline-none" />
          <button type="submit" aria-label={t("submit")} disabled={!input.trim()} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-gold px-3 text-bg-primary disabled:opacity-50"><Search size={20} /></button>
        </form>
        <div aria-live="polite" className="mt-3 text-sm text-text-secondary">
          {loading && <p className="flex items-center gap-2"><Loader2 size={18} className="animate-spin text-gold" />{plan ? t("loading") : t("understanding")}</p>}
          {resultScope === scope && clarification && <p>{clarification}</p>}
        </div>
        {resultScope === scope && error && <div role="alert" className="mt-3 text-sm text-text-secondary"><p>{errorText}</p>
          {error === "unauthorized" ? <Link className="inline-flex min-h-11 items-center text-gold" href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>{genie("signIn")}</Link>
            : <button type="button" className="min-h-11 text-gold" onClick={() => setRetry(value => value + 1)}>{t("retry")}</button>}
        </div>}
      </div>
    </div>
    {resultScope === scope && !loading && !error && <div className="site-container space-y-10 py-7">
      {SEARCH_AREAS.map(area => {
        const visible = groups.filter(group => group.area === area && (group.results.length || group.nextOffset !== null || plan?.searches[group.wishIndex].area !== "all"));
        if (!visible.length) return null;
        return <section key={area} aria-label={t(`areas.${area}`)}>
          <h2 className="mb-4 font-serif text-2xl text-text-primary">{t(`areas.${area}`)}</h2>
          <div className="space-y-7">{visible.map(group => <section key={groupKey(group)} aria-label={group.label}>
            <h3 className="mb-3 break-words text-sm font-semibold text-gold">{group.label}</h3>
            {!group.results.length && <p className="text-sm text-text-muted">{group.nextOffset !== null ? t("continueSearch") : t("emptyGroup")}</p>}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{group.results.map(result => <ResultCard key={`${result.type}:${result.id}`} result={result} />)}</div>
            {moreErrors.includes(groupKey(group)) && <p role="alert" className="mt-3 text-sm text-text-secondary">{t("error")}</p>}
            {group.nextOffset !== null && <button type="button" disabled={morePending.includes(groupKey(group))} onClick={() => more(group)} className="mt-3 min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:text-gold disabled:opacity-50">{morePending.includes(groupKey(group)) ? t("loading") : t("more")}</button>}
          </section>)}</div>
        </section>;
      })}
      {groups.length > 0 && groups.every(group => !group.results.length && group.nextOffset === null) && plan?.searches.every(wish => wish.area === "all") && <p className="text-text-secondary">{t("emptyGroup")}</p>}
    </div>}
  </main>;
}
