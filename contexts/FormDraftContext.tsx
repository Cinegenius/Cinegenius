"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

export type FormProtection = { unsafe: () => boolean; flush?: () => Promise<boolean>; discard?: () => Promise<void> };
const Context = createContext<{ register: (id: symbol, protection: FormProtection) => () => void; leave: (action: () => void) => void; notify: () => void } | null>(null);
const HISTORY_KEY = "cgDraftNavigation";
type HistoryPosition = { session: string; index: number };
const position = (state: unknown) => (state as Record<string, HistoryPosition> | null)?.[HISTORY_KEY];

/** One guard for links, explicit actions and the actual browser history. No sentinel entries. */
export default function FormDraftProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("FormDraft");
  const entries = useRef(new Map<symbol, FormProtection>());
  const pending = useRef<(() => void) | null>(null);
  const [dialog, setDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const working = useRef(false);
  const notify = useCallback(() => setHasUnsaved([...entries.current.values()].some(entry => entry.unsafe())), []);
  const register = useCallback((id: symbol, protection: FormProtection) => {
    entries.current.set(id, protection);
    notify();
    return () => { entries.current.delete(id); notify(); };
  }, [notify]);
  const unsafe = useCallback(() => [...entries.current.values()].filter(entry => entry.unsafe()), []);
  const flush = useCallback(async () => {
    const changed = unsafe();
    if (changed.some(entry => !entry.flush)) return false;
    try { return (await Promise.all(changed.map(entry => entry.flush!()))).every(Boolean) && !unsafe().length; }
    catch { return false; }
  }, [unsafe]);
  const leave = useCallback((action: () => void) => {
    if (pending.current || working.current) return;
    if (!unsafe().length) { action(); return; }
    pending.current = action;
    setCanSave(unsafe().every(entry => !!entry.flush));
    working.current = true;
    setSaving(true); setFailed(false); setDialog(true);
    void flush().then(saved => {
      working.current = false; setSaving(false);
      if (!pending.current) return;
      if (saved) { const go = pending.current; pending.current = null; setDialog(false); go(); }
      else setFailed(true);
    });
  }, [flush, unsafe]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsafe().length) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsaved, unsafe]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !unsafe().length) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (link?.hasAttribute("data-context-back")) return;
      if (!link || link.hasAttribute("download") || link.target && link.target !== "_self") return;
      const target = new URL(link.href, location.href);
      if (target.origin !== location.origin || target.protocol !== "https:" && target.protocol !== "http:") return;
      if (target.pathname === location.pathname && target.search === location.search) return;
      event.preventDefault(); event.stopImmediatePropagation();
      leave(() => router.push(target.pathname + target.search + target.hash));
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [leave, router, unsafe]);

  useEffect(() => {
    const previousPush = history.pushState;
    const previousReplace = history.replaceState;
    let current = position(history.state) ?? { session: crypto.randomUUID(), index: 0 };
    let restoring = false;
    let replay: number | null = null;
    let afterRestore: (() => void) | null = null;
    const stamp = (state: unknown, value: HistoryPosition) => ({ ...(state && typeof state === "object" ? state : {}), [HISTORY_KEY]: value });
    previousReplace.call(history, stamp(history.state, current), "");
    history.pushState = function (data, unused, url) {
      const next = { ...current, index: current.index + 1 };
      previousPush.call(this, stamp(data, next), unused, url);
      current = next;
    };
    history.replaceState = function (data, unused, url) { previousReplace.call(this, stamp(data, current), unused, url); };
    const pop = (event: PopStateEvent) => {
      const target = position(event.state);
      if (restoring) {
        event.stopImmediatePropagation(); restoring = false;
        afterRestore?.(); afterRestore = null;
        return;
      }
      if (replay !== null && target?.index === replay) { replay = null; current = target; return; }
      // Cross-document departures use the browser's beforeunload prompt. Only
      // replay tracked same-document entries, whose exact distance is known.
      if (!target || target.session !== current.session) return;
      if (!unsafe().length) { current = target; return; }
      const distance = target.index - current.index;
      if (!distance) return;
      event.stopImmediatePropagation();
      restoring = true;
      afterRestore = () => leave(() => { replay = target.index; history.go(distance); });
      history.go(-distance);
    };
    window.addEventListener("popstate", pop, true);
    return () => {
      history.pushState = previousPush; history.replaceState = previousReplace;
      window.removeEventListener("popstate", pop, true);
    };
  }, [leave, unsafe]);

  const stay = useCallback(() => { pending.current = null; setDialog(false); setFailed(false); }, []);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!dialog) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("[data-stay]")?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); stay(); }
      if (event.key !== "Tab") return;
      const buttons = [...panel.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", keydown); active?.focus({ preventScroll: true }); };
  }, [dialog, stay]);

  const context = useMemo(() => ({ register, leave, notify }), [register, leave, notify]);
  return <Context.Provider value={context}>{children}{dialog && createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" role="presentation">
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="draft-leave-title" aria-describedby="draft-leave-description" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-bg-secondary p-5 shadow-2xl sm:p-6">
        <h2 id="draft-leave-title" className="font-display text-xl">{t("title")}</h2>
        <p id="draft-leave-description" className="mt-3 text-sm leading-6 text-text-secondary">{t(saving ? "savingBeforeLeave" : "description")}</p>
        {failed && <p role="alert" className="mt-3 text-sm text-red-400">{t("failedLeave")}</p>}
        <div className="mt-5 flex flex-col gap-3">
          <button data-stay type="button" onClick={stay} className="min-h-11 rounded-xl border border-border px-4 py-2 text-text-primary">{t("stay")}</button>
          {canSave && <button type="button" disabled={saving} onClick={() => {
            if (working.current) return;
            working.current = true; setSaving(true);
            void flush().then(ok => { working.current = false; setSaving(false); if (ok && pending.current) { const go = pending.current; pending.current = null; setDialog(false); go(); } else setFailed(true); });
          }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 font-semibold text-bg-primary disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{t("saveLeave")}</button>}
          <button type="button" disabled={saving} onClick={() => {
            const go = pending.current;
            if (!go) return;
            pending.current = null;
            void Promise.all(unsafe().map(entry => entry.discard?.())).finally(() => { setDialog(false); go(); });
          }} className="min-h-11 rounded-xl px-4 py-2 text-text-muted disabled:opacity-60">{t("discard")}</button>
        </div>
      </section>
    </div>, document.body)}</Context.Provider>;
}

export function useFormNavigation() {
  const context = useContext(Context);
  if (!context) throw new Error("FormDraftProvider missing");
  return context;
}
