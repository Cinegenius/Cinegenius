"use client";

import SmartSearchPreview from "@/components/SmartSearchPreview";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Loader2 } from "lucide-react";
import { useFormRouter } from "@/lib/use-form-router";
import { decodeSearchPlan, searchPlanFromHref, type SearchPlan, type SearchGroup } from "@/lib/unified-search";
import DirectoryPage from "@/components/DirectoryPage";
import SmartSearchExplorer from "@/components/SmartSearchExplorer";
import SmartSearchExamples from "@/components/SmartSearchExamples";
import SmartSearchClarification from "@/components/SmartSearchClarification";
import SmartSearchWishes from "@/components/SmartSearchWishes";
import { searchQueryTitle } from "@/lib/unified-search-areas";

const SEARCH_ERROR = { invalid: "invalid", unavailable: "unavailable", unauthorized: "unauthorized" } as const;
type Clarification = { question: string; scope: string; retry: number } | null;

export default function UnifiedSearchResults() {
  const t = useTranslations("UnifiedSearch");
  const common = useTranslations("common");
  const { userId, isLoaded } = useAuth();
  const serverAdminId = useContext(ServerAdminContext);
  const [deniedUserId, setDeniedUserId] = useState<string | null>(null);
  const denyAccess = useCallback(() => setDeniedUserId(userId ?? null), [userId]);
  if (!isLoaded || !userId || serverAdminId !== userId || deniedUserId === userId) {
    return <main className="min-h-screen pt-16 pb-28 xl:pb-12"><div className="site-container py-7 sm:py-10">
      <h1 className="font-serif text-3xl text-text-primary sm:text-4xl">{t("title")}</h1>
      <p role="status" className="mt-3 text-sm text-text-secondary">{isLoaded ? t("inDevelopment") : common("loading")}</p>
      {isLoaded && userId && <SmartSearchPreview />}
    </div></main>;
  }
  return <AccessibleUnifiedSearchResults key={userId} onUnavailable={denyAccess} />;
}

function AccessibleUnifiedSearchResults({ onUnavailable }: { onUnavailable: () => void }) {
  const t = useTranslations("UnifiedSearch");
  const genie = useTranslations("Genie");
  const taxonomy = useTranslations("Taxonomy");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useFormRouter();
  const { userId, isLoaded } = useAuth();
  const encodedPlan = params.get("plan");
  const editablePlan = useMemo(() => decodeSearchPlan(encodedPlan), [encodedPlan]);
  const requestText = params.get("q") ?? "";
  const [input, setInput] = useState(requestText);
  const [plan, setPlan] = useState<SearchPlan | null>(null);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [mapGroups, setMapGroups] = useState<SearchGroup[] | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clarification, setClarification] = useState<Clarification>(null);
  const clarificationRef = useRef<Clarification>(null);
  const updateClarification = useCallback((value: Clarification) => { clarificationRef.current = value; setClarification(value); }, []);
  const [retry, setRetry] = useState(0);
  const [resultScope, setResultScope] = useState("");
  const active = useRef<AbortController | null>(null);
  const inputSource = useRef("");
  const interpretationAttempt = useRef<{ text: string; retry: number } | null>(null);
  const inputElement = useRef<HTMLInputElement>(null);
  const navigation = useRef(router);
  useEffect(() => { navigation.current = router; }, [router]);
  const scope = JSON.stringify([encodedPlan, requestText, locale, userId, isLoaded]);
  const dialogueScope = JSON.stringify([encodedPlan, requestText, userId]);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    // A deferred start avoids duplicate paid requests during React's effect replay.
    const timer = setTimeout(async () => {
      setResultScope(scope);
      setGroups([]); setMapGroups(undefined); setError("");
      const decoded = decodeSearchPlan(encodedPlan);
      setPlan(decoded);
      const source = JSON.stringify([encodedPlan, requestText]);
      if (inputSource.current !== source) {
        inputSource.current = source;
        const names = new Intl.DisplayNames([locale], { type: "region" });
        const summary = decoded?.searches.map(wish => {
          const key = `departments.${wish.department}`;
          const title = searchQueryTitle(wish, t) || (taxonomy.has(key) ? taxonomy(key) : wish.department);
          const places = wish.places.map(place => {
            const label = [place.city, place.country ? names.of(place.country) : "", place.continent ? names.of(place.continent) : ""].filter(Boolean).join(", ");
            return place.radiusKm ? t("withinRadius", { place: label, radius: place.radiusKm }) : label;
          });
          return [title, ...places].filter(Boolean).join(" · ");
        }).join("; ");
        setInput(requestText || summary || "");
      }
      if (!isLoaded) { setLoading(false); return; }
      if (!userId) { updateClarification(null); setError(SEARCH_ERROR.unauthorized); setLoading(false); return; }
      if (!encodedPlan && !requestText.trim()) { setLoading(false); return; }
      if (encodedPlan && !decoded) { setError(SEARCH_ERROR.invalid); setLoading(false); return; }
      // Locale changes translate the controls without losing the answer draft or
      // reinterpreting the initial request. Account/query changes get a new dialogue.
      if (!encodedPlan && clarificationRef.current?.scope === dialogueScope && clarificationRef.current.retry === retry) { setLoading(false); return; }
      setLoading(true);
      try {
        if (decoded) {
          interpretationAttempt.current = null;
          const response = await fetch("/api/search/unified", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]), body: JSON.stringify({ plan: decoded, ...(decoded.version === 2 ? { view: "combined" } : {}) }) });
          const data = await response.json();
          if (response.status === 401 || (response.status === 403 && data.error === "in_development")) { if (!controller.signal.aborted) onUnavailable(); return; }
          if (!response.ok) throw new Error(data.error || SEARCH_ERROR.unavailable);
          if (!controller.signal.aborted) { setGroups(data.groups); setMapGroups(data.mapGroups); }
        } else {
          // Locale/account changes may cancel a request, but never repeat paid
          // interpretation of the previous input without another explicit send.
          if (interpretationAttempt.current?.text === requestText && interpretationAttempt.current.retry === retry) {
            setError(SEARCH_ERROR.unavailable);
            return;
          }
          interpretationAttempt.current = { text: requestText, retry };
          const response = await fetch("/api/genie", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
            body: JSON.stringify({ area: "general", locale, messages: [{ role: "user", content: requestText }] }) });
          const data = await response.json();
          if (response.status === 401 || (response.status === 403 && data.error === "in_development")) { if (!controller.signal.aborted) onUnavailable(); return; }
          if (!response.ok) throw new Error(data.error || SEARCH_ERROR.unavailable);
          if (controller.signal.aborted) return;
          const link = Array.isArray(data.links) ? data.links.find((item: { href?: unknown }) => typeof item?.href === "string" && searchPlanFromHref(item.href)) : null;
          if (link) navigation.current.replace(link.href, { scroll: false });
          else if (typeof data.reply === "string" && data.reply.trim()) updateClarification({ question: data.reply, scope: dialogueScope, retry });
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : SEARCH_ERROR.unavailable);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [encodedPlan, requestText, locale, userId, isLoaded, retry, scope, dialogueScope, updateClarification, t, taxonomy, onUnavailable]);

  const errorText = error === "unauthorized" ? t("signInRequired") : error === "rate_limited" ? genie("errorRateLimited") : error === "invalid" || error === "search_unresolved" ? genie("errorSearch") : t("error");
  const returnTo = `/search?${new URLSearchParams(plan && encodedPlan ? { plan: encodedPlan } : { smart: "1", q: input })}`;
  return <DirectoryPage area="crew"><main className="smart-search-page min-h-screen pt-16 pb-28 xl:pb-12">
    <div>
      <div className="site-container py-4 sm:py-5">
        <div className="flex items-center justify-between gap-3"><h1 className="font-serif text-3xl text-text-primary sm:text-4xl">{t("tab")}</h1>
          {/* The editor stays outside the locale/result-scoped explorer so unfinished edits survive refreshes. */}
          {editablePlan && isLoaded && userId && error !== SEARCH_ERROR.unauthorized && <SmartSearchWishes key={dialogueScope} plan={editablePlan} onUnauthorized={onUnavailable} compact />}
        </div>
        {!plan && <p className="mt-2 text-sm text-text-secondary">{t("intro")}</p>}
        <form className="smart-search-input mt-4 flex min-h-[52px] items-center gap-2 rounded-xl border p-1" onSubmit={event => {
          event.preventDefault(); if (!input.trim()) return;
          active.current?.abort();
          const href = `/search?${new URLSearchParams({ smart: "1", q: input.trim() })}`;
          if (!encodedPlan && input.trim() === requestText) setRetry(value => value + 1);
          else router.push(href, { scroll: false });
        }}>
          <input ref={inputElement} aria-label={t("title")} value={input} maxLength={2000} onChange={event => { active.current?.abort(); setLoading(false); setInput(event.target.value); }}
            placeholder={t("placeholder")} className="min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-text-primary focus:outline-none" />
          <button type="submit" aria-label={t("submit")} disabled={!input.trim()} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-gold px-3 text-bg-primary disabled:opacity-50"><ArrowUp size={20} aria-hidden="true" /></button>
        </form>
        {!encodedPlan && !plan && <SmartSearchExamples onSelect={value => { active.current?.abort(); setLoading(false); setInput(value); inputElement.current?.focus({ preventScroll: true }); }} />}
        <div aria-live="polite" className={`${loading ? "mt-3" : ""} text-sm text-text-secondary`}>
          {loading && <p className="flex items-center gap-2"><Loader2 size={18} className="animate-spin text-gold" />{plan ? t("loading") : t("understanding")}</p>}
        </div>
        {clarification?.scope === dialogueScope && clarification.retry === retry && !error && userId && <SmartSearchClarification key={`${dialogueScope}:${retry}`}
          question={clarification.question} requestText={requestText} onUnauthorized={onUnavailable} />}
        {resultScope === scope && error && <div role="alert" className="mt-3 text-sm text-text-secondary"><p>{errorText}</p>
          {error === "unauthorized" ? <Link className="inline-flex min-h-11 items-center text-gold" href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>{genie("signIn")}</Link>
            : <button type="button" className="min-h-11 text-gold" onClick={() => setRetry(value => value + 1)}>{t("retry")}</button>}
        </div>}
      </div>
    </div>
    {resultScope === scope && !loading && !error && <div className="site-container pb-5">
      {plan && userId && <SmartSearchExplorer key={scope} plan={plan} initialGroups={groups} initialMapGroups={mapGroups} onUnavailable={onUnavailable} />}
    </div>}
  </main></DirectoryPage>;
}
