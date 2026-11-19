"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUp, Building2, Globe, Info, Loader2, MapPin, ShoppingBag, UserRound, Users } from "lucide-react";
import DirectoryPage from "@/components/DirectoryPage";
import SmartSearchPreview from "@/components/SmartSearchPreview";
import SmartSearchExplorer, { type SmartSearchControls } from "@/components/SmartSearchExplorer";
import { emptyDiscoveryFilters } from "@/lib/smart-discovery";
import { useViewState } from "@/lib/use-view-state";
import { useFormRouter } from "@/lib/use-form-router";
import { NATIVE_DISCOVERY_CONTRACT, NATIVE_DISCOVERY_DIRECTORIES, readNativeDiscovery, type NativeDiscoveryMode, type NativeDiscoveryResponse } from "@/lib/native-smart-discovery";
import styles from "./NativeSmartLanding.module.css";
import { useNativeSegmentDrag } from "@/lib/use-native-segment-drag";
import NativeCreateMenu from "./NativeCreateMenu";

const icons = { crew: Users, marketplace: ShoppingBag, locations: MapPin, companies: Building2 };

/** The native empty entry only. Text searches and public website keep their existing path. */
type LandingProps = { accountId: string | null; loaded: boolean; allowed: boolean; onUnavailable: () => void };
export default function NativeSmartLanding(props: LandingProps) {
  const auth = useAuth(), { session, isLoaded } = useSession();
  const verified = auth.isLoaded && isLoaded && auth.isSignedIn && !!auth.sessionId && auth.userId === props.accountId
    && session?.status === "active" && session.id === auth.sessionId && session.user.id === props.accountId;
  return <AccountNativeSmartLanding key={`${props.accountId ?? "guest"}:${auth.sessionId ?? "none"}`}
    {...props} loaded={props.loaded && !!auth.isLoaded && isLoaded} allowed={props.allowed && !!verified} authenticated={!!verified} />;
}

function AccountNativeSmartLanding({ accountId, loaded, allowed, onUnavailable, authenticated }: LandingProps & { authenticated: boolean }) {
  const t = useTranslations("NativeSmartDiscovery"), search = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy");
  const locale = useLocale(), router = useFormRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useViewState<NativeDiscoveryMode>("native.smart.focus", "profile");
  const [controls, setControls] = useViewState<SmartSearchControls>("smart.controls", { scope: "", filters: emptyDiscoveryFilters(), mapOpen: false, view: "grid", limits: {} });
  const [result, setResult] = useState<{ scope: string; data: NativeDiscoveryResponse; timingStart: number } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([accountId, loaded, allowed, locale, mode, retry]);
  const currentScope = useRef(scope);
  // Commit the identity before passive request effects; never render stale rows.
  useLayoutEffect(() => { currentScope.current = scope; }, [scope]);
  const request = useRef<AbortController | null>(null);
  const retryRef = useRef(0);
  const focusDetails = useRef<HTMLDetailsElement>(null);
  const focusDrag = useNativeSegmentDrag(mode, index => setMode(index === 0 ? "profile" : "neutral"));
  const refresh = useCallback(() => {
    if (document.visibilityState === "hidden" || Date.now() - retryRef.current < 500) return;
    retryRef.current = Date.now();
    request.current?.abort();
    setRetry(value => value + 1);
  }, []);

  useEffect(() => {
    if (!allowed || !loaded || !accountId) return;
    const events = ["focus", "pageshow", "cinegenius:app-resume"];
    events.forEach(event => window.addEventListener(event, refresh));
    document.addEventListener("visibilitychange", refresh);
    return () => { events.forEach(event => window.removeEventListener(event, refresh)); document.removeEventListener("visibilitychange", refresh); };
  }, [accountId, allowed, loaded, refresh]);

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
    if (!allowed || !loaded || !accountId) return;
    const controller = new AbortController(); request.current = controller;
    const scheduled = performance.now();
    const timer = window.setTimeout(async () => {
      const started = performance.now();
      performance.clearMeasures("cinegenius:smart:schedule");
      performance.measure("cinegenius:smart:schedule", { start: scheduled, end: started });
      setLoading(true); setError(false);
      try {
        const response = await fetch(`/api/native/v1/discovery?focus=${mode === "neutral" ? "neutral" : "profile"}`, {
          headers: { "X-CineGenius-Native-Discovery": NATIVE_DISCOVERY_CONTRACT, "X-Native-Account": accountId },
          credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
        });
        performance.clearMeasures("cinegenius:smart:api");
        performance.measure("cinegenius:smart:api", { start: started, end: performance.now() });
        if (controller.signal.aborted || currentScope.current !== scope) return;
        if (response.status === 401 || response.status === 403) { onUnavailable(); return; }
        if (!response.ok) throw new Error("unavailable");
        const received = performance.now();
        const data = readNativeDiscovery(await response.json(), accountId);
        performance.clearMeasures("cinegenius:smart:decode");
        performance.measure("cinegenius:smart:decode", { start: received, end: performance.now() });
        if (!data) throw new Error("unavailable");
        if (!controller.signal.aborted && currentScope.current === scope) setResult({ scope, data, timingStart: performance.now() });
      } catch { if (!controller.signal.aborted && currentScope.current === scope) setError(true); }
      finally { if (!controller.signal.aborted && currentScope.current === scope) setLoading(false); }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [accountId, allowed, loaded, mode, onUnavailable, scope]);

  const data = result?.scope === scope ? result.data : null;
  return <DirectoryPage area="crew"><main className={`smart-search-page ${styles.landing}`} data-native-smart-landing>
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
        <div className={styles.focus}>
          <div {...focusDrag} className={styles.focusChoices} role="group" aria-label={t("focus")}>
            <button type="button" data-native-segment="profile" aria-pressed={mode !== "neutral"} onClick={() => setMode("profile")}><UserRound size={15} aria-hidden="true" />{t("profileFocus")}</button>
            <button type="button" data-native-segment="neutral" aria-pressed={mode === "neutral"} aria-label={t("neutral")} onClick={() => setMode("neutral")}><Globe size={15} aria-hidden="true" />{search("discovery.all")}</button>
          </div>
          <details ref={focusDetails} className={styles.focusDetails} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
            <summary aria-label={t("focus")}><Info size={18} aria-hidden="true" /></summary>
            <div className={styles.focusPopover}>
              {data?.focus.mode === "profile" && <p className={styles.focusSummary}>{[...data.focus.departments.map(id => taxonomy.has(`departments.${id}`) ? taxonomy(`departments.${id}`) : id), data.focus.city].filter(Boolean).join(" · ")}</p>}
              <p className={styles.note}>{t("focusNote")}</p>
              <Link href="/profile" className={styles.edit}>{t("editProfile")}</Link>
            </div>
          </details>
        </div>
        <div role="status" aria-live="polite" className={styles.status}>{loading && <><Loader2 size={17} className="animate-spin" aria-hidden="true" />{t("loading")}</>}</div>
        {error && !data && <div role="alert" className={styles.error}><p>{t("error")}</p><button type="button" onClick={refresh}>{t("retry")}</button></div>}
        {data && <SmartSearchExplorer plan={data.plan} initialGroups={data.groups} onUnavailable={onUnavailable} stored={controls} setStored={setControls} />}
      </>}
    </div>
  </main></DirectoryPage>;
}
