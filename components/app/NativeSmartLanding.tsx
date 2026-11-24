"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUp, Building2, Globe, Info, Loader2, MapPin, ShoppingBag, UserRound, Users } from "lucide-react";
import { ContentTranslationNotice } from "@/components/ContentTranslation";
import DirectoryPage from "@/components/DirectoryPage";
import SmartSearchPreview from "@/components/SmartSearchPreview";
import SmartSearchExplorer, { type SmartSearchControls } from "@/components/SmartSearchExplorer";
import { emptyDiscoveryFilters } from "@/lib/smart-discovery";
import { useViewState } from "@/lib/use-view-state";
import { useFormRouter } from "@/lib/use-form-router";
import { NATIVE_DISCOVERY_CONTRACT, NATIVE_DISCOVERY_DIRECTORIES, nativeDiscoveryPlan, readNativeDiscovery, type NativeDiscoveryMode, type NativeDiscoveryResponse } from "@/lib/native-smart-discovery";
import styles from "./NativeSmartLanding.module.css";
import { isDiscoverySeed } from "@/lib/discovery-seed";
import { useNativeSegmentDrag } from "@/lib/use-native-segment-drag";
import NativeCreateMenu from "./NativeCreateMenu";
import {hasBrowseFilterControls} from "@/lib/browse-filter-controls";
import {nativeSmartBrowseFilters,nativeSmartView} from "@/lib/native-smart-controls";
import {NATIVE_DISCOVERY_FILTER_HEADER,encodeNativeDiscoveryFilters} from "@/lib/native-smart-discovery-request";
const nativePlanScope=JSON.stringify(nativeDiscoveryPlan());

const icons = { crew: Users, marketplace: ShoppingBag, locations: MapPin, companies: Building2 };

/** The native empty entry only. Text searches and public website keep their existing path. */
type LandingProps = { accountId: string | null; loaded: boolean; allowed: boolean; onUnavailable: () => void };
export default function NativeSmartLanding(props: LandingProps) {
  const auth = useAuth(), { session, isLoaded } = useSession();
  const verified = auth.isLoaded && isLoaded && auth.isSignedIn && !!auth.sessionId && auth.userId === props.accountId
    && session?.status === "active" && session.id === auth.sessionId && session.user.id === props.accountId;
  return <AccountNativeSmartLanding key={`${props.accountId ?? "guest"}:${auth.sessionId ?? "none"}`}
    {...props} sessionId={auth.sessionId ?? null} loaded={props.loaded && !!auth.isLoaded && isLoaded} allowed={props.allowed && !!verified} authenticated={!!verified} />;
}

function AccountNativeSmartLanding({ accountId, sessionId, loaded, allowed, onUnavailable, authenticated }: LandingProps & { sessionId: string | null; authenticated: boolean }) {
  const t = useTranslations("NativeSmartDiscovery"), search = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy");
  const locale = useLocale(), router = useFormRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useViewState<NativeDiscoveryMode>("native.smart.focus", "profile");
  const [seed, setSeed] = useViewState("native.smart.seed", "");
  useEffect(() => { setSeed(previous => isDiscoverySeed(previous) ? previous : crypto.randomUUID().replaceAll("-", "")); }, [setSeed]);
  const [controls, setControls] = useViewState<SmartSearchControls>("smart.controls", { scope: "", filters: emptyDiscoveryFilters(), mapOpen: false, view: "grid", limits: {} });
  const [result, setResult] = useState<{ scope: string; revision: number; data: NativeDiscoveryResponse; timingStart: number; browseKey:string } | null>(null);
  const choices=useMemo(()=>{
    const filters=controls.scope === nativePlanScope ? controls.filters : emptyDiscoveryFilters();
    const browse=nativeSmartBrowseFilters({...filters.browse,version:1,departments:filters.browse?.departments ?? filters.departments,marketplace:filters.browse?.marketplace ?? filters.marketplace});
    return {view:controls.scope === nativePlanScope && nativeSmartView(controls.mapOpen,controls.view) === "map" ? "map" as const : "list" as const,browse,browseKey:JSON.stringify(browse)};
  },[controls]);
  const choicesRef=useRef(choices),hasResult=useRef(false);
  useLayoutEffect(()=>{choicesRef.current=choices;hasResult.current=!!result;},[choices,result]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reservedHeight, setReservedHeight] = useState(0);
  const resultFrame = useRef<HTMLDivElement>(null);
  // A refresh revalidates this same view; it must not discard its current rows.
  // Identity, access and discovery choices still invalidate them before paint.
  const scope = JSON.stringify([accountId, sessionId, loaded, allowed, authenticated, locale, mode, seed]);
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope);
    setResult(null); setError(false); setLoading(false); setReservedHeight(0);
  }
  const layoutScope = JSON.stringify([scope, controls]);
  const [previousLayoutScope, setPreviousLayoutScope] = useState(layoutScope);
  if (previousLayoutScope !== layoutScope) {
    setPreviousLayoutScope(layoutScope); setReservedHeight(0);
  }
  const currentScope = useRef(scope);
  useLayoutEffect(() => { currentScope.current = scope; }, [scope]);
  const request = useRef<AbortController | null>(null);
  const requestRevision = useRef(0);
  const denyAccess = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setResult(null); setError(false); setLoading(false); setReservedHeight(0);
    onUnavailable();
  }, [onUnavailable]);
  const retryRef = useRef(0);
  const focusDetails = useRef<HTMLDetailsElement>(null);
  const focusDrag = useNativeSegmentDrag(mode, index => setMode(index === 0 ? "profile" : "neutral"));
  const refresh = useCallback(() => {
    if (document.visibilityState === "hidden" || Date.now() - retryRef.current < 500) return;
    // One foreground return can emit focus, pageshow and native resume apart.
    // Keep its current rights check instead of cancelling and restarting it.
    if (request.current && !request.current.signal.aborted) return;
    retryRef.current = Date.now();
    setRetry(value => value + 1);
  }, []);
  const suspend = useCallback(() => {
    const frame = resultFrame.current;
    if (frame?.isConnected && frame.getAttribute("data-native-smart-result-current") === "v1") {
      const height = frame.getBoundingClientRect().height;
      // Preserve only an anonymous, bounded layout number, never the old rows
      // or a screenshot. It prevents the inner scrollport clamping on return.
      setReservedHeight(Number.isFinite(height) && height > 0 ? Math.min(100_000, Math.ceil(height)) : 0);
    }
    request.current?.abort();
    request.current = null;
    retryRef.current = 0;
    // Retention is limited to the same foreground visit. Returning from Work
    // or the background must reauthorize before any private rows are shown.
    setResult(null); setError(false); setLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed || !loaded || !authenticated || !accountId || !sessionId) return;
    const events = ["focus", "pageshow", "cinegenius:app-resume"];
    events.forEach(event => window.addEventListener(event, refresh));
    const suspendedEvents = ["blur", "pagehide", "cinegenius:native-workspace-presented"];
    suspendedEvents.forEach(event => window.addEventListener(event, suspend));
    const visibility = () => document.visibilityState === "hidden" ? suspend() : refresh();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      events.forEach(event => window.removeEventListener(event, refresh));
      suspendedEvents.forEach(event => window.removeEventListener(event, suspend));
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [accountId, sessionId, allowed, loaded, authenticated, refresh, suspend]);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (focusDetails.current && !focusDetails.current.contains(event.target as Node)) focusDetails.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useLayoutEffect(() => {
    if (result?.scope !== scope) return;
    // Bounded local Performance entries contain durations only, never account/profile data.
    performance.clearMeasures("cinegenius:smart:render");
    performance.measure("cinegenius:smart:render", { start: result.timingStart, end: performance.now() });
    const route = performance.getEntriesByName("cinegenius:smart:route-start", "mark").at(-1);
    if (route && performance.now() - route.startTime < 60_000) {
      performance.clearMeasures("cinegenius:smart:route");
      performance.measure("cinegenius:smart:route", { start: route.startTime, end: performance.now() });
      performance.clearMarks("cinegenius:smart:route-start");
    }
  }, [result, scope]);

  useEffect(() => {
    if (!allowed || !loaded || !authenticated || !accountId || !sessionId || !isDiscoverySeed(seed)) return;
    const controller = new AbortController(); request.current = controller;
    const revision = ++requestRevision.current;
    const current = () => !controller.signal.aborted && request.current === controller && currentScope.current === scope;
    const requested=choicesRef.current;
    const scheduled = performance.now();
    const timer = window.setTimeout(async () => {
      if (!current()) return;
      const started = performance.now();
      performance.clearMeasures("cinegenius:smart:schedule");
      performance.measure("cinegenius:smart:schedule", { start: scheduled, end: started });
      setLoading(true); setError(false);
      try {
        let encodedFilters:string|null,requestView=requested.view,servedBrowseKey=requested.browseKey;
        try {encodedFilters=encodeNativeDiscoveryFilters(requested.browse);}
        catch (error) {
          if (!(error instanceof Error) || error.message !== "invalid_request") throw error;
          // Large legitimate selections use the existing validated body POST.
          // Mark this smaller bootstrap honestly so Explorer hides its rows
          // until that exact full filter scope has returned; keep UI choices.
          encodedFilters=null;requestView="list";servedBrowseKey=JSON.stringify({version:1});
        }
        const response = await fetch(`/api/native/v1/discovery?focus=${mode === "neutral" ? "neutral" : "profile"}&seed=${seed}${requestView === "map" ? "&view=map" : ""}`, {
          headers: { "X-CineGenius-Native-Discovery": NATIVE_DISCOVERY_CONTRACT, "X-Native-Account": accountId,...(encodedFilters ? {[NATIVE_DISCOVERY_FILTER_HEADER]:encodedFilters} : {}) },
          credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(requestView === "map" ? 35_000 : 25_000)]),
        });
        performance.clearMeasures("cinegenius:smart:api");
        performance.measure("cinegenius:smart:api", { start: started, end: performance.now() });
        if (!current()) return;
        if ([401, 403, 409].includes(response.status)) { denyAccess(); return; }
        if (!response.ok) throw new Error("unavailable");
        const received = performance.now();
        const data = readNativeDiscovery(await response.json(), accountId, seed,requestView);
        performance.clearMeasures("cinegenius:smart:decode");
        performance.measure("cinegenius:smart:decode", { start: received, end: performance.now() });
        if (!data) throw new Error("unavailable");
        if (requested.browseKey !== choicesRef.current.browseKey) {if (current() && !hasResult.current) setRetry(value=>value+1);return;}
        if (current()) { setReservedHeight(0); setResult({ scope, revision, data, timingStart: performance.now(),browseKey:servedBrowseKey }); }
      } catch { if (current()) { setReservedHeight(0); setError(true); } }
      finally {
        if (current()) setLoading(false);
        if (request.current === controller) request.current = null;
      }
    }, 0);
    return () => {
      window.clearTimeout(timer); controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [accountId, sessionId, allowed, loaded, authenticated, mode, denyAccess, retry, scope, seed]);

  const data = loaded && allowed && authenticated && result?.scope === scope ? result.data : null;
  const routeReady = loaded && (!allowed || authenticated && (!!data || error && !loading));
  return <DirectoryPage area="crew"><main className={`smart-search-page ${styles.landing}`} data-native-smart-landing data-native-route-ready={routeReady ? "v1" : undefined}>
    <div className="site-container">
      <h1 className="sr-only">{search("tab")}</h1>
      <div className={styles.searchRow}><form className={`smart-search-input native-browse-search ${styles.search}`} onSubmit={event => {
        event.preventDefault(); if (!input.trim()) return;
        request.current?.abort();
        router.push(`/search?${new URLSearchParams({ smart: "1", q: input.trim() })}`, { scroll: false });
      }}>
        <input aria-label={search("title")} value={input} maxLength={2000} onChange={event => setInput(event.target.value)} placeholder={search("placeholder")} />
        <button type="submit" aria-label={search("submit")} disabled={!input.trim()}><ArrowUp size={20} aria-hidden="true" /></button>
      </form>{authenticated && <NativeCreateMenu disabled={!loaded} onOpen={() => { if (focusDetails.current) focusDetails.current.open = false; }} />}</div>
      {!allowed && <nav className={styles.directories} aria-label={t("directories")}>
        {NATIVE_DISCOVERY_DIRECTORIES.map(({ area, href }) => {
          const Icon = icons[area];
          return <Link key={area} href={href}><Icon size={17} aria-hidden="true" /><span>{search(`areas.${area}`)}</span></Link>;
        })}
      </nav>}
      {!loaded && <p role="status" className={styles.status}>{t("loading")}</p>}
      {loaded && !allowed && <div className={styles.development}>
        <p role="status">{search("inDevelopment")}</p>
        {accountId && <SmartSearchPreview />}
      </div>}
      {loaded && allowed && <>
        <div className={styles.focus} data-native-smart-focus="v1">
          <div {...focusDrag} className={styles.focusChoices} role="group" aria-label={t("focus")}>
            <button type="button" data-native-segment="profile" aria-pressed={mode !== "neutral"} aria-label={t("profileFocus")} title={t("profileFocus")} onClick={() => setMode("profile")}><UserRound size={15} aria-hidden="true" /><span>{t("profileFocus")}</span></button>
            <button type="button" data-native-segment="neutral" aria-pressed={mode === "neutral"} aria-label={t("neutral")} title={t("neutral")} onClick={() => setMode("neutral")}><Globe size={15} aria-hidden="true" /><span>{search("discovery.all")}</span></button>
          </div>
          <div role="status" aria-live="polite" className={styles.focusProgress}>{loading && <><Loader2 size={17} className="animate-spin" aria-hidden="true" /><span className="sr-only">{t("loading")}</span></>}</div>
          <ContentTranslationNotice hideStatusText />
          <details ref={focusDetails} className={styles.focusDetails} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
            <summary aria-label={t("focus")}><Info size={18} aria-hidden="true" /></summary>
            <div className={styles.focusPopover}>
              {data?.focus.mode === "profile" && <p className={styles.focusSummary}>{[...data.focus.departments.map(id => taxonomy.has(`departments.${id}`) ? taxonomy(`departments.${id}`) : id), data.focus.city].filter(Boolean).join(" · ")}</p>}
              <p className={styles.note}>{t("focusNote")}</p>
              <Link href="/profile" className={styles.edit}>{t("editProfile")}</Link>
            </div>
          </details>
        </div>
        {error && <div role="alert" className={styles.error}><p>{t("error")}</p><button type="button" onClick={refresh}>{t("retry")}</button>{hasBrowseFilterControls(choices.browse) && <button type="button" className="min-h-11" onClick={()=>{setControls(previous=>({...previous,filters:emptyDiscoveryFilters()}));setRetry(value=>value+1);}}>{search("discovery.reset")}</button>}</div>}
        {/* The explorer owns its rows after mount. Replace it atomically only
            when a freshly authorized response is ready, including removals. */}
        <div ref={resultFrame} className={styles.results} data-native-smart-result-frame="v1" data-native-smart-result-current={data ? "v1" : undefined}>
          {data ? <SmartSearchExplorer translationInHeader key={`${scope}:${result?.revision}`} discoverySeed={data.seed} plan={data.plan} initialGroups={data.groups} initialMapGroups={data.view === "map" ? data.groups : undefined} initialBrowseKey={result?.browseKey} onUnavailable={denyAccess} stored={controls} setStored={setControls} />
            : reservedHeight > 0 && <div className={styles.placeholder} data-native-smart-placeholder="v1" aria-hidden="true" style={{ height: reservedHeight }}><span /><span /></div>}
        </div>
      </>}
    </div>
  </main></DirectoryPage>;
}
