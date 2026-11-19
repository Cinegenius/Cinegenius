"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUp, Building2, Loader2, MapPin, ShoppingBag, Users } from "lucide-react";
import DirectoryPage from "@/components/DirectoryPage";
import SmartSearchPreview from "@/components/SmartSearchPreview";
import SmartSearchExplorer, { type SmartSearchControls } from "@/components/SmartSearchExplorer";
import { emptyDiscoveryFilters } from "@/lib/smart-discovery";
import { useViewState } from "@/lib/use-view-state";
import { useFormRouter } from "@/lib/use-form-router";
import { NATIVE_DISCOVERY_CONTRACT, NATIVE_DISCOVERY_DIRECTORIES, readNativeDiscovery, type NativeDiscoveryMode, type NativeDiscoveryResponse } from "@/lib/native-smart-discovery";
import styles from "./NativeSmartLanding.module.css";

const icons = { crew: Users, marketplace: ShoppingBag, locations: MapPin, companies: Building2 };

/** The native empty entry only. Text searches and public website keep their existing path. */
type LandingProps = { accountId: string | null; loaded: boolean; allowed: boolean; onUnavailable: () => void };
export default function NativeSmartLanding(props: LandingProps) {
  const auth = useAuth(), { session, isLoaded } = useSession();
  const verified = auth.isLoaded && isLoaded && auth.isSignedIn && !!auth.sessionId && auth.userId === props.accountId
    && session?.status === "active" && session.id === auth.sessionId && session.user.id === props.accountId;
  return <AccountNativeSmartLanding key={`${props.accountId ?? "guest"}:${auth.sessionId ?? "none"}`}
    {...props} loaded={props.loaded && !!auth.isLoaded && isLoaded} allowed={props.allowed && !!verified} />;
}

function AccountNativeSmartLanding({ accountId, loaded, allowed, onUnavailable }: LandingProps) {
  const t = useTranslations("NativeSmartDiscovery"), search = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy");
  const locale = useLocale(), router = useFormRouter();
  const [input, setInput] = useState("");
  const [mode, setMode] = useViewState<NativeDiscoveryMode>("native.smart.focus", "profile");
  const [controls, setControls] = useViewState<SmartSearchControls>("smart.controls", { scope: "", filters: emptyDiscoveryFilters(), mapOpen: true, limits: {} });
  const [result, setResult] = useState<{ scope: string; data: NativeDiscoveryResponse } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([accountId, loaded, allowed, locale, mode, retry]);
  const currentScope = useRef(scope);
  // Commit the identity before passive request effects; never render stale rows.
  useLayoutEffect(() => { currentScope.current = scope; }, [scope]);
  const request = useRef<AbortController | null>(null);
  const retryRef = useRef(0);
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
    if (!allowed || !loaded || !accountId) return;
    const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const response = await fetch(`/api/native/v1/discovery?focus=${mode === "neutral" ? "neutral" : "profile"}`, {
          headers: { "X-CineGenius-Native-Discovery": NATIVE_DISCOVERY_CONTRACT, "X-Native-Account": accountId },
          credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
        });
        if (controller.signal.aborted || currentScope.current !== scope) return;
        if (response.status === 401 || response.status === 403) { onUnavailable(); return; }
        if (!response.ok) throw new Error("unavailable");
        const data = readNativeDiscovery(await response.json(), accountId);
        if (!data) throw new Error("unavailable");
        if (!controller.signal.aborted && currentScope.current === scope) setResult({ scope, data });
      } catch { if (!controller.signal.aborted && currentScope.current === scope) setError(true); }
      finally { if (!controller.signal.aborted && currentScope.current === scope) setLoading(false); }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [accountId, allowed, loaded, mode, onUnavailable, scope]);

  const data = result?.scope === scope ? result.data : null;
  return <DirectoryPage area="crew"><main className={`smart-search-page ${styles.landing}`} data-native-smart-landing>
    <div className="site-container">
      <h1 className="sr-only">{search("tab")}</h1>
      <form className={`smart-search-input native-browse-search ${styles.search}`} onSubmit={event => {
        event.preventDefault(); if (!input.trim()) return;
        request.current?.abort();
        router.push(`/search?${new URLSearchParams({ smart: "1", q: input.trim() })}`, { scroll: false });
      }}>
        <input aria-label={search("title")} value={input} maxLength={2000} onChange={event => setInput(event.target.value)} placeholder={search("placeholder")} />
        <button type="submit" aria-label={search("submit")} disabled={!input.trim()}><ArrowUp size={20} aria-hidden="true" /></button>
      </form>
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
        <fieldset className={styles.focus}><legend className="sr-only">{t("focus")}</legend>
          <button type="button" aria-pressed={mode !== "neutral"} onClick={() => setMode("profile")}>{t("profileFocus")}</button>
          <button type="button" aria-pressed={mode === "neutral"} onClick={() => setMode("neutral")}>{t("neutral")}</button>
          <Link href="/profile" className={styles.edit}>{t("editProfile")}</Link>
        </fieldset>
        {data?.focus.mode === "profile" && <p className={styles.focusSummary}>
          {[...data.focus.departments.map(id => taxonomy.has(`departments.${id}`) ? taxonomy(`departments.${id}`) : id), data.focus.city].filter(Boolean).join(" · ")}
        </p>}
        {data && <p className={styles.note}>{data.focus.mode === "profile" ? t("focusNote") : t("neutralNote")}</p>}
        <div role="status" aria-live="polite" className={styles.status}>{loading && <><Loader2 size={17} className="animate-spin" aria-hidden="true" />{t("loading")}</>}</div>
        {error && !data && <div role="alert" className={styles.error}><p>{t("error")}</p><button type="button" onClick={refresh}>{t("retry")}</button></div>}
        {data && <SmartSearchExplorer plan={data.plan} initialGroups={data.groups} initialMapGroups={data.groups} onUnavailable={onUnavailable} stored={controls} setStored={setControls} />}
      </>}
    </div>
  </main></DirectoryPage>;
}
