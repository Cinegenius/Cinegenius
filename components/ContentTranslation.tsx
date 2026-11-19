"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { createContentTranslationClient } from "@/lib/content-translation-client";
import { isAppLocale } from "@/lib/i18n/locales";
import type { ContentReference } from "@/lib/content-translation";

type Client = ReturnType<typeof createContentTranslationClient>;
type TranslationContext = {client: Client | null; original: boolean; setOriginal: (value: boolean) => void; enabled: boolean};
const Context = createContext<TranslationContext>({client: null, original: false, setOriginal: () => {}, enabled: false});
const noSubscribe = () => () => {};
const noSnapshot = () => undefined;

export function ContentTranslationProvider({children, enabled, initialOriginal, initialUserId}: {children: ReactNode; enabled: boolean; initialOriginal: boolean; initialUserId: string | null}) {
  const locale = useLocale();
  const pathname = usePathname();
  const {userId, isLoaded} = useAuth();
  const account = isLoaded ? userId ?? null : initialUserId;
  const [original, setOriginalValue] = useState(initialOriginal);
  // Replacing only the service, not the component subtree, keeps editors/uploads mounted.
  const scope = useMemo(() => ({enabled, original, locale, account, pathname}), [enabled, original, locale, account, pathname]);
  // Construction is inert: only committed subscribers can start a request.
  const client = useMemo(() => scope.enabled && !scope.original && isAppLocale(scope.locale)
    ? createContentTranslationClient(scope.locale) : null, [scope]);
  const lifetimes = useRef(new Map<Client, object>());
  useEffect(() => {
    if (!client) return;
    const leases = lifetimes.current;
    const token = {};
    leases.set(client, token);
    const refresh = () => client.refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
      // Strict Mode reattaches the same service in this commit. A real scope
      // change already displays the new client; dispose the old one afterward.
      queueMicrotask(() => {
        if (leases.get(client) === token) { client.dispose(); leases.delete(client); }
      });
    };
  }, [client]);
  const setOriginal = useCallback((value: boolean) => {
    document.cookie = `cg_content_original=${value ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    setOriginalValue(value);
  }, []);
  const context = useMemo(() => ({client, original, setOriginal, enabled}), [client, original, setOriginal, enabled]);
  return <Context.Provider value={context}>{children}</Context.Provider>;
}

/** The source value binds display updates to the currently rendered revision. */
export function useTranslatedContent({kind, id, field, source, active = true}: ContentReference & {field: string; source: string | null | undefined; active?: boolean}) {
  const {client} = useContext(Context);
  const subscribe = useCallback((listener: () => void) => active && client && source ? client.subscribe({kind, id}, listener) : noSubscribe(), [client, active, source, kind, id]);
  const snapshot = useCallback(() => active && client ? client.get({kind, id}) : undefined, [client, active, kind, id]);
  const result = useSyncExternalStore(subscribe, snapshot, noSnapshot);
  const text = result?.status === "translated" && result.originals[field] === source && typeof result.fields[field] === "string" ? result.fields[field] : source;
  return {text, translated: text !== source, locale: result?.locale};
}

/** Explicit public display fields only. Never wrap editors, private messages or legal documents. */
export function TranslatedText({kind, id, field, children, className}: ContentReference & {field: string; children: string | null | undefined; className?: string}) {
  const {client} = useContext(Context);
  const t = useTranslations("contentTranslation");
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!client || !element.current) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {rootMargin: "100px"});
    observer.observe(element.current); return () => observer.disconnect();
  }, [client]);
  const result = useTranslatedContent({kind, id, field, source: children, active: visible});
  return <span ref={element} className={className} data-content-kind={kind} data-content-field={field}
    data-machine-translated={result.translated ? "true" : undefined} lang={result.translated ? result.locale : undefined} title={result.translated ? t("machineLabel") : undefined}>
    {result.text}
  </span>;
}

/** Shared website/app preference. Functional cookie only; never a new translation system. */
export function ContentTranslationChoice() {
  const {enabled, original, setOriginal} = useContext(Context);
  const t = useTranslations("contentTranslation");
  if (!enabled) return null;
  return <div className="border-t border-border px-3 py-2 text-left">
    <label className="flex min-h-11 items-center gap-3 text-xs text-text-secondary cursor-pointer">
      <input type="checkbox" checked={!original} onChange={event => setOriginal(!event.target.checked)} className="h-4 w-4 shrink-0 accent-gold" />
      <span className="min-w-0 break-words">{t("automatic")}</span>
    </label>
    <p className="text-xs leading-relaxed text-text-muted break-words">{t("explanation")}</p>
  </div>;
}

export function ContentTranslationNotice() {
  const {enabled, original, setOriginal, client} = useContext(Context);
  const t = useTranslations("contentTranslation");
  if (!enabled) return null;
  return <div className="content-translation-notice flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
    <span className="min-w-0 break-words">{t(original ? "originalMode" : "notice")}</span>
    <button type="button" className="min-h-11 underline underline-offset-4 text-text-secondary" onClick={() => setOriginal(!original)}>{t(original ? "showTranslated" : "showOriginal")}</button>
    {!original && <button type="button" className="min-h-11 underline underline-offset-4 text-text-secondary" onClick={() => client?.refresh()}>{t("retry")}</button>}
  </div>;
}
