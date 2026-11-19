"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Camera, Check, Globe, ImagePlus, Loader2, RefreshCw, Trash2, Users, X } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import MessagingDialog from "@/components/messaging/MessagingDialog";
import { confirmDialog, dismissNativeDialog } from "@/lib/native-dialog";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { createShotsClient, mergeShotsPage, ShotsClientError, type ClientShot, type ShotAudience, type ShotPublication, type ShotsFeed } from "@/lib/shots-client";
import { importShotPhoto, renderShotPhoto, SHOT_LOOKS, type ShotFormat, type ShotLook, type ShotPhoto } from "@/lib/shots-photo";
import styles from "./ShotsExperience.module.css";

type Draft = { source: ShotPhoto; sourceUrl: string; preview: ShotPhoto; previewUrl: string; previewLook: ShotLook; previewGrain: number; requestId: string; look: ShotLook; grain: number; format: ShotFormat; audience: ShotAudience | null };
type Snapshot = { audience: ShotAudience; data: ShotsFeed | null; loading: boolean; error: string | null };
type Turn = { ids: [string, string]; phase: "out" | "in" } | null;
const sessionFailure = (cause: unknown) => cause instanceof ShotsClientError && (cause.status === 401 || cause.code === "unauthorized" || cause.code === "account_changed");
const shuffled = (items: ClientShot[]) => {
  const next = [...items]; for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; } return next;
};

/** At most one visible, equally shaped pair. Activity/visibility cancels every timer. */
function useShotPairMotion(root: RefObject<HTMLElement | null>, items: ClientShot[], enabled: boolean, swap: (ids: [string, string]) => void): Turn {
  const [turn, setTurn] = useState<Turn>(null);
  const key = items.map(item => `${item.id}:${item.format}:${item.audience}:${item.isMine}`).sort().join("|");
  useEffect(() => {
    const element = root.current; if (!element || !enabled || items.length < 2) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let idle: ReturnType<typeof setTimeout> | undefined, middle: ReturnType<typeof setTimeout> | undefined, end: ReturnType<typeof setTimeout> | undefined;
    let pressed = false, hovered = false, focused = document.hasFocus();
    const stop = () => { clearTimeout(idle); clearTimeout(middle); clearTimeout(end); idle = middle = end = undefined; setTurn(null); };
    const safe = () => !media.matches && !document.hidden && focused && !pressed && !hovered && !!element.getClientRects().length
      && !element.closest("[hidden],[inert]") && !(document.activeElement instanceof HTMLElement && document.activeElement !== document.body && document.activeElement.matches(":focus-visible"));
    const arm = () => { clearTimeout(idle); if (safe()) idle = setTimeout(start, 12_000 + Math.random() * 6_000); };
    const visible = (id: string) => {
      const node = Array.from(element.querySelectorAll<HTMLElement>("[data-shot-id]")).find(value => value.dataset.shotId === id);
      if (!node) return false; const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.top > 90 && rect.bottom < window.innerHeight - 100;
    };
    const start = () => {
      idle = undefined; if (!safe()) return;
      const eligible = items.filter(item => visible(item.id));
      const pair = eligible.flatMap((item, index) => eligible.slice(index + 1).filter(other => other.format === item.format && other.audience === item.audience && other.isMine === item.isMine).map(other => [item.id, other.id] as [string, string]));
      if (!pair.length) { arm(); return; }
      const ids = pair[Math.floor(Math.random() * pair.length)]; setTurn({ ids, phase: "out" });
      middle = setTimeout(() => { if (!safe() || !ids.every(visible)) { stop(); arm(); return; } swap(ids); setTurn({ ids, phase: "in" }); }, 300);
      end = setTimeout(() => { setTurn(null); arm(); }, 600);
    };
    const activity = () => { stop(); arm(); };
    const down = () => { pressed = true; stop(); }, up = () => { pressed = false; activity(); };
    const enter = (event: PointerEvent) => { if (event.pointerType === "mouse") { hovered = true; stop(); } };
    const leave = () => { hovered = false; activity(); };
    const blur = () => { focused = false; pressed = false; stop(); }, focus = () => { focused = true; activity(); };
    element.addEventListener("pointerdown", down, true); element.addEventListener("pointerenter", enter); element.addEventListener("pointerleave", leave);
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up); window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    window.addEventListener("scroll", activity, { passive: true }); element.addEventListener("wheel", activity, { passive: true });
    document.addEventListener("visibilitychange", activity); document.addEventListener("focusin", activity); document.addEventListener("focusout", activity); media.addEventListener("change", activity); arm();
    return () => { stop(); element.removeEventListener("pointerdown", down, true); element.removeEventListener("pointerenter", enter); element.removeEventListener("pointerleave", leave); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); window.removeEventListener("blur", blur); window.removeEventListener("focus", focus); window.removeEventListener("scroll", activity); element.removeEventListener("wheel", activity); document.removeEventListener("visibilitychange", activity); document.removeEventListener("focusin", activity); document.removeEventListener("focusout", activity); media.removeEventListener("change", activity); };
    // The sorted identity key deliberately excludes pair-order changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, key, enabled, swap]);
  return enabled ? turn : null;
}

export default function ShotsExperience() {
  const auth = useAuth(), { session, isLoaded } = useSession(), t = useTranslations("AppShots"), common = useTranslations("Messaging");
  const verified = auth.isLoaded && isLoaded && auth.isSignedIn && !!auth.userId && !!auth.sessionId
    && session?.status === "active" && session.id === auth.sessionId && session.user.id === auth.userId;
  if (!auth.isLoaded || !isLoaded) return <p role="status" className={styles.status}>{common("loading")}</p>;
  if (!verified || !auth.userId) return <section className={styles.status}><p>{t("signInRequired")}</p><Link href="/sign-in?redirect_url=%2Fapp%2Fshots">{t("signIn")}</Link></section>;
  return <AccountShots key={`${auth.userId}:${auth.sessionId}`} accountId={auth.userId} />;
}

function AccountShots({ accountId }: { accountId: string }) {
  const t = useTranslations("AppShots"), common = useTranslations("Messaging"), locale = useLocale();
  const { register, notify, leave } = useFormNavigation();
  const client = useMemo(() => createShotsClient(accountId), [accountId]);
  const [audience, setAudience] = useState<ShotAudience>("community"), [reload, setReload] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({ audience: "community", data: null, loading: true, error: null });
  const [mode, setMode] = useState<"source" | "edit" | null>(null), [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false), [rendering, setRendering] = useState(false), [working, setWorking] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState<ShotPublication | null>(null), [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(false), [blocked, setBlocked] = useState(false);
  const [selected, setSelected] = useState<ClientShot | null>(null), [detailLoading, setDetailLoading] = useState(false), [failedImages, setFailedImages] = useState<string[]>([]);
  const [clock, setClock] = useState({ now: 0, offset: 0 });
  const root = useRef<HTMLElement>(null), editor = useRef<HTMLDivElement>(null), picker = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const alive = useRef(false), operations = useRef(new Set<AbortController>()), urls = useRef(new Set<string>()), generation = useRef(0), loadController = useRef<AbortController | null>(null), photoController = useRef<AbortController | null>(null), busy = useRef(false), confirming = useRef(false);
  const draftRef = useRef(draft), unsafe = useRef(false), protectionId = useRef(Symbol("shots-photo")), seenCursors = useRef(new Set<string>()), accessBlocked = useRef(false);
  const data = snapshot.audience === audience ? snapshot.data : null;
  const now = clock.now || Date.now();
  const items = data?.items.filter(item => Date.parse(item.expiresAt) > now && !failedImages.includes(item.id)) ?? [];
  const previewReady = !!draft && draft.previewLook === draft.look && draft.previewGrain === draft.grain;
  const source = draft?.source, look = draft?.look ?? "original", grain = draft?.grain ?? 0;

  const revoke = useCallback((url: string) => { if (urls.current.delete(url)) URL.revokeObjectURL(url); }, []);
  const createUrl = useCallback((blob: Blob) => { const url = URL.createObjectURL(blob); urls.current.add(url); return url; }, []);
  const clearDraft = useCallback(() => {
    photoController.current?.abort(); urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear();
    draftRef.current = null; unsafe.current = false; setDraft(null); setLocked(null); setRequestStatus(null); setRetryAllowed(false); setImporting(false); setRendering(false); setEditorError(null);
  }, []);
  const closeEditor = useCallback(() => { clearDraft(); setMode(null); requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }); }, [clearDraft]);
  const updateClock = useCallback((serverNow: string) => setClock({ now: Date.parse(serverNow), offset: Date.parse(serverNow) - Date.now() }), []);
  const blockAccess = useCallback(() => { accessBlocked.current = true; generation.current++; operations.current.forEach(controller => controller.abort()); clearDraft(); busy.current = false; setWorking(false); setSelected(null); setMode(null); setSnapshot({ audience: "community", data: null, loading: false, error: null }); setBlocked(true); }, [clearDraft]);

  useLayoutEffect(() => { alive.current = true; const pending = operations.current, allocated = urls.current; return () => { alive.current = false; pending.forEach(controller => controller.abort()); photoController.current?.abort(); if (confirming.current) dismissNativeDialog(); allocated.forEach(url => URL.revokeObjectURL(url)); allocated.clear(); }; }, []);
  useLayoutEffect(() => { draftRef.current = draft; unsafe.current = !!draft || importing || working; });
  useEffect(() => register(protectionId.current, { unsafe: () => unsafe.current, discard: async () => { clearDraft(); } }), [register, clearDraft]);
  useEffect(() => { notify(); }, [draft, importing, working, notify]);

  const load = useCallback(async (more = false) => {
    if (document.hidden || accessBlocked.current) return;
    const cursor = more && snapshot.audience === audience ? snapshot.data?.nextCursor : null;
    if (more && !cursor) return;
    loadController.current?.abort(); const controller = new AbortController(); loadController.current = controller; operations.current.add(controller);
    const version = ++generation.current;
    if (!more) { setFailedImages([]); seenCursors.current.clear(); }
    setSnapshot(previous => ({ audience, data: more && previous.audience === audience ? previous.data : null, loading: true, error: null }));
    try {
      const page = await client.feed(audience, cursor ?? null, controller.signal);
      if (!alive.current || controller.signal.aborted || version !== generation.current) return;
      if (audience === "homies" && !page.capabilities.homiesRead) throw new ShotsClientError("unavailable");
      if (more && (page.nextCursor === cursor || page.nextCursor && seenCursors.current.has(page.nextCursor))) throw new ShotsClientError("invalid_response");
      if (more && cursor) seenCursors.current.add(cursor);
      updateClock(page.serverNow);
      setSnapshot(previous => { const merged = more && previous.data ? mergeShotsPage(previous.data.items, page.items, page.serverNow) : shuffled(page.items); return { audience, loading: false, error: null, data: { ...page, items: merged, nextCursor: merged.length >= 120 ? null : page.nextCursor } }; });
    } catch (cause) {
      if (alive.current && sessionFailure(cause)) { blockAccess(); return; }
      if (alive.current && !controller.signal.aborted && version === generation.current) setSnapshot(previous => ({ ...previous, loading: false, error: cause instanceof ShotsClientError && cause.code === "unavailable" ? "unavailable" : "loadError" }));
    } finally { operations.current.delete(controller); }
  }, [audience, client, snapshot.audience, snapshot.data?.nextCursor, updateClock, blockAccess]);
  const loadRef = useRef(load);
  useLayoutEffect(() => { loadRef.current = load; });
  useEffect(() => {
    let active = true;
    const start = () => { if (active && !document.hidden) void loadRef.current(); };
    queueMicrotask(start);
    return () => { active = false; loadController.current?.abort(); };
  }, [audience, reload]);

  useEffect(() => {
    const expiries = [...(data?.items ?? []), ...(selected ? [selected] : [])].map(item => Date.parse(item.expiresAt));
    const tick = () => setClock(previous => ({ ...previous, now: Date.now() + previous.offset }));
    const resume = () => { tick(); if (!document.hidden && !data) void loadRef.current(); };
    const remaining = expiries.filter(value => value > now);
    const timer = remaining.length ? setTimeout(tick, Math.max(1, Math.min(...remaining) - now + 1)) : undefined;
    document.addEventListener("visibilitychange", resume); window.addEventListener("focus", tick);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("focus", tick); };
  }, [data, selected, now]);

  useEffect(() => {
    if (selected && Date.parse(selected.expiresAt) <= now) queueMicrotask(() => { if (alive.current) { setSelected(null); setNotice("expired"); } });
  }, [selected, now]);

  useEffect(() => {
    if (!source) return;
    const controller = new AbortController(); photoController.current?.abort(); photoController.current = controller;
    const timer = setTimeout(() => {
      void renderShotPhoto(source, look, grain, controller.signal).then(photo => {
        if (!alive.current || controller.signal.aborted || draftRef.current?.source !== source) return;
        const url = photo === source ? draftRef.current.sourceUrl : createUrl(photo.blob);
        const previous = draftRef.current.previewUrl;
        setDraft(value => value?.source === source ? { ...value, preview: photo, previewUrl: url, previewLook: look, previewGrain: grain } : value);
        if (previous !== draftRef.current.sourceUrl && previous !== url) revoke(previous);
        setRendering(false);
      }).catch(() => { if (alive.current && !controller.signal.aborted) { setEditorError("photoError"); setRendering(false); } });
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [source, look, grain, createUrl, revoke]);

  // A DOM modal below the shared draft-confirmation layer; no artificial history entries.
  useEffect(() => {
    if (!mode) return;
    const panel = editor.current; if (!panel) return;
    const changed: { node: HTMLElement; inert: boolean }[] = [];
    let ancestor: HTMLElement = panel;
    while (ancestor.parentElement && ancestor.parentElement !== document.body) {
      for (const node of ancestor.parentElement.children) if (node instanceof HTMLElement && node !== ancestor && !["SCRIPT", "STYLE", "LINK"].includes(node.tagName)) { changed.push({ node, inert: node.inert }); node.inert = true; }
      ancestor = ancestor.parentElement;
    }
    if (ancestor.parentElement === document.body) for (const node of document.body.children) if (node instanceof HTMLElement && node !== ancestor && !["SCRIPT", "STYLE", "LINK"].includes(node.tagName)) { changed.push({ node, inert: node.inert }); node.inert = true; }
    const frame = requestAnimationFrame(() => panel.querySelector<HTMLButtonElement>("[data-close-shots]")?.focus({ preventScroll: true }));
    const keyboard = (event: KeyboardEvent) => {
      if (document.getElementById("draft-leave-title")) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy.current) leave(closeEditor); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),a[href]")).filter(node => node.getClientRects().length && node.tabIndex >= 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => { cancelAnimationFrame(frame); changed.forEach(({ node, inert }) => { node.inert = inert; }); document.removeEventListener("keydown", keyboard, true); };
  }, [mode, leave, closeEditor]);

  const swap = useCallback((ids: [string, string]) => setSnapshot(previous => {
    if (!previous.data) return previous; const rows = [...previous.data.items], a = rows.findIndex(item => item.id === ids[0]), b = rows.findIndex(item => item.id === ids[1]);
    if (a < 0 || b < 0) return previous; [rows[a], rows[b]] = [rows[b], rows[a]]; return { ...previous, data: { ...previous.data, items: rows } };
  }), []);
  const turn = useShotPairMotion(root, items, !blocked && !mode && !selected && !detailLoading && !snapshot.loading, swap);

  async function importFile(file: File) {
    if (busy.current || locked || accessBlocked.current) return;
    photoController.current?.abort(); const controller = new AbortController(); photoController.current = controller;
    setImporting(true); setEditorError(null); setMode("edit");
    try {
      const photo = await importShotPhoto(file, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      clearDraft(); const url = createUrl(photo.blob);
      setDraft({ source: photo, sourceUrl: url, preview: photo, previewUrl: url, previewLook: "original", previewGrain: 0, requestId: crypto.randomUUID(), look: "original", grain: 0, format: photo.width > photo.height ? "landscape" : "portrait", audience: null });
    } catch { if (alive.current && !controller.signal.aborted) { setEditorError("photoError"); if (!draftRef.current) setMode("source"); } }
    finally { if (alive.current && photoController.current === controller) setImporting(false); }
  }

  function acceptPublished(item: ClientShot, serverNow: string) {
    updateClock(serverNow); clearDraft(); setMode(null); setNotice("published"); setAudience(item.audience); setReload(value => value + 1);
  }
  async function publish() {
    if (accessBlocked.current || busy.current || !draft?.audience || !previewReady || importing || rendering || document.hidden || locked && !retryAllowed) return;
    const publication = locked ?? { requestId: draft.requestId, photo: draft.preview, audience: draft.audience, format: draft.format, look: draft.look, grain: draft.grain };
    busy.current = true; setWorking(true); setEditorError(null); setLocked(publication); setRetryAllowed(false);
    const controller = new AbortController(); operations.current.add(controller);
    try { const result = await client.publish(publication, controller.signal); if (!alive.current || controller.signal.aborted) return; updateClock(result.serverNow); if (result.status === "published" && result.item) acceptPublished(result.item, result.serverNow); else setRequestStatus("pending"); }
    catch (cause) { if (alive.current && sessionFailure(cause)) { blockAccess(); return; } if (alive.current && !controller.signal.aborted) { setEditorError("uncertain"); setRequestStatus("unknown"); } }
    finally { operations.current.delete(controller); if (alive.current) { busy.current = false; setWorking(false); } }
  }
  async function checkPublication() {
    if (!locked || busy.current || document.hidden || accessBlocked.current) return;
    busy.current = true; setWorking(true); setRetryAllowed(false); const controller = new AbortController(); operations.current.add(controller);
    try {
      const result = await client.status(locked.requestId, controller.signal); if (!alive.current || controller.signal.aborted) return;
      updateClock(result.serverNow); setEditorError(null); setRequestStatus(result.status); setRetryAllowed(result.retryAllowed);
      if (result.status === "published" && result.item) acceptPublished(result.item, result.serverNow);
      else if (result.status === "expired" || result.status === "deleted") { closeEditor(); setNotice(result.status); setReload(value => value + 1); }
    } catch (cause) { if (alive.current && sessionFailure(cause)) { blockAccess(); return; } if (alive.current && !controller.signal.aborted) setEditorError("statusError"); }
    finally { operations.current.delete(controller); if (alive.current) { busy.current = false; setWorking(false); } }
  }
  async function openShot(item: ClientShot) {
    if (detailLoading || document.hidden || accessBlocked.current || Date.parse(item.expiresAt) <= now) return;
    setDetailLoading(true); setNotice(null); const controller = new AbortController(); operations.current.add(controller);
    try { const result = await client.detail(item.id, controller.signal); if (alive.current && !controller.signal.aborted) { updateClock(result.serverNow); setSelected(result.item); } }
    catch (cause) { if (alive.current && sessionFailure(cause)) { blockAccess(); return; } if (alive.current && !controller.signal.aborted) { if (cause instanceof ShotsClientError && ["expired", "not_found"].includes(cause.code)) { setFailedImages(value => [...value, item.id]); setNotice("expired"); } else setNotice("loadError"); } }
    finally { operations.current.delete(controller); if (alive.current) setDetailLoading(false); }
  }
  async function removeShot(item: ClientShot) {
    if (!item.isMine || busy.current || document.hidden || accessBlocked.current) return;
    busy.current = true; confirming.current = true;
    const confirmed = await confirmDialog({ message: t("deleteConfirm"), confirmLabel: t("delete"), cancelLabel: common("cancel") });
    confirming.current = false;
    if (!confirmed || !alive.current) { busy.current = false; return; }
    setWorking(true); const controller = new AbortController(); operations.current.add(controller);
    try {
      await client.remove(item.id, controller.signal); if (!alive.current || controller.signal.aborted) return;
      generation.current++; loadController.current?.abort(); setSnapshot(previous => previous.data ? { ...previous, loading: false, data: { ...previous.data, items: previous.data.items.filter(row => row.id !== item.id) } } : previous); setSelected(null); setNotice("deleted");
    } catch (cause) { if (alive.current && sessionFailure(cause)) { blockAccess(); return; } if (alive.current && !controller.signal.aborted) setNotice("deleteError"); }
    finally { operations.current.delete(controller); if (alive.current) { busy.current = false; setWorking(false); } }
  }

  if (blocked) return <section className={styles.status}><p>{t("signInRequired")}</p><Link href="/sign-in?redirect_url=%2Fapp%2Fshots">{t("signIn")}</Link></section>;

  const expires = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  return <section ref={root} data-shots-root="v1" className={styles.root} aria-labelledby="real-shots-title">
    <h1 id="real-shots-title" className={styles.srOnly}>{t("title")}</h1>
    <div className={styles.toolbar}><div className={styles.audiences} role="group" aria-label={t("showShots")}>{(["community", "homies"] as const).map(value => <button type="button" key={value} aria-pressed={audience === value} onClick={() => setAudience(value)}>{value === "community" ? t("community") : t("homies")}</button>)}</div>
      <button type="button" className={styles.camera} aria-label={t("newShot")} disabled={!data?.capabilities.publish || snapshot.loading} onClick={event => { returnFocus.current = event.currentTarget; setNotice(null); setMode("source"); }}><Camera aria-hidden="true" size={21} /></button></div>
    <p className={styles.note}>{t("lifetime")}</p>
    {notice && <p role="status" className={styles.message}>{t(notice)}</p>}
    {snapshot.loading && <p role="status" className={styles.status}><Loader2 size={18} aria-hidden="true" />{common("loading")}</p>}
    {snapshot.error && <div role="alert" className={styles.message}><p>{t(snapshot.error)}</p><button type="button" onClick={() => void load(false)}>{common("retry")}</button></div>}
    {data && !snapshot.loading && !items.length && !snapshot.error && <p className={styles.status}>{t("empty")}</p>}
    <div className={styles.grid}>{items.map(item => <button type="button" key={item.id} className={styles.tile} data-shot-id={item.id} data-format={item.format} data-turn={turn?.ids.includes(item.id) ? turn.phase : undefined}
      aria-label={t("openPhoto")} aria-disabled={turn?.ids.includes(item.id) || undefined} disabled={detailLoading}
      onClick={() => { if (!turn?.ids.includes(item.id)) void openShot(item); }}>
      <MediaImage src={item.media.thumbnail} alt="" width={item.width} height={item.height} unoptimized loading="lazy" decoding="async" onError={() => setFailedImages(value => [...value, item.id])} />
      <span className={styles.tileNote}>{item.audience === "homies" ? <Users size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}{item.isMine ? t("yours") : t(item.audience === "homies" ? "homies" : "community")}</span>
    </button>)}</div>
    {data?.nextCursor && !snapshot.loading && <button type="button" className={styles.loadMore} onClick={() => void load(true)}>{t("loadMore")}</button>}
    {data && <button type="button" className={styles.refresh} disabled={snapshot.loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />{t("refresh")}</button>}

    {mode && <div className={styles.overlay}><div ref={editor} role="dialog" aria-modal="true" aria-labelledby="shots-editor-title" className={styles.editor} data-shots-editor="v1">
      <header><h2 id="shots-editor-title">{t("newShot")}</h2><button type="button" data-close-shots disabled={working} aria-label={common("close")} onClick={() => leave(closeEditor)}><X size={21} aria-hidden="true" /></button></header>
      <div className={styles.editorBody}>
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={t("choosePhoto")} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importFile(file); }} />
        <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label={t("takePhoto")} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importFile(file); }} />
        {editorError && <p role="alert" className={styles.message}>{t(editorError)}</p>}
        {importing && <p role="status">{t("preparing")}</p>}
        {!draft && <div className={styles.sourceOptions}><button type="button" disabled={importing} onClick={() => camera.current?.click()}><Camera size={22} aria-hidden="true" />{t("takePhoto")}</button><button type="button" disabled={importing} onClick={() => picker.current?.click()}><ImagePlus size={22} aria-hidden="true" />{t("choosePhoto")}</button><p className={styles.note}>{t("fileHint")}</p></div>}
        {draft && <><div className={styles.preview} data-format={draft.format} aria-busy={rendering || !previewReady}><MediaImage src={draft.previewUrl} alt={t("preview")} width={draft.preview.width} height={draft.preview.height} unoptimized />{(rendering || !previewReady) && <span role="status">{t("rendering")}</span>}</div>
          <p className={styles.note}>{t("draftNote")}</p>
          <fieldset disabled={!!locked || working || importing} className={styles.controls}><legend>{t("format")}</legend><div className={styles.inline}><button type="button" onClick={() => picker.current?.click()}>{t("choosePhoto")}</button></div><div className={styles.inline}>{(["portrait", "landscape"] as const).map(value => <button type="button" key={value} aria-pressed={draft.format === value} onClick={() => setDraft(previous => previous ? { ...previous, format: value } : previous)}>{t(value)}</button>)}</div>
            <div className={styles.inline} role="group" aria-label={t("look")}>{SHOT_LOOKS.map(value => <button key={value.id} type="button" aria-pressed={draft.look === value.id} onClick={() => { if (draft.look === value.id && draft.grain === value.grain) return; setRendering(true); setEditorError(null); setDraft(previous => previous ? { ...previous, look: value.id, grain: value.grain } : previous); }}>{t(`look_${value.id}`)}</button>)}</div>
            <label className={styles.grain}>{t("grain")}<output>{draft.grain}%</output><input type="range" min="0" max="100" step="1" value={draft.grain} onChange={event => { setRendering(true); setEditorError(null); const value = Number(event.target.value); setDraft(previous => previous ? { ...previous, grain: value } : previous); }} /></label>
            <fieldset className={styles.choice}><legend>{t("audience")}</legend>{(["homies", "community"] as const).map(value => <label key={value}><input type="radio" name="shot-audience" value={value} disabled={value === "homies" && !data?.capabilities.homiesRead} checked={draft.audience === value} onChange={() => setDraft(previous => previous ? { ...previous, audience: value } : previous)} />{value === "homies" ? <Users size={20} aria-hidden="true" /> : <Globe size={20} aria-hidden="true" />}<span>{t(value === "homies" ? "onlyHomies" : "community")}</span>{draft.audience === value && <Check size={18} aria-hidden="true" />}</label>)}</fieldset>
          </fieldset><p className={styles.note}>{t("publishHint")}</p>
          {locked && <p role="status" className={styles.message}>{t(retryAllowed && (requestStatus === "absent" || requestStatus === "pending") ? "absent" : "uncertain")}</p>}
        </>}
      </div>
      <footer>{locked ? <><button type="button" disabled={working} onClick={() => void checkPublication()}>{t("checkStatus")}</button>{retryAllowed && <button type="button" disabled={working} onClick={() => void publish()}>{common("retry")}</button>}</> : <button type="button" className={styles.publish} disabled={!draft?.audience || !previewReady || importing || rendering || working || !!editorError} onClick={() => void publish()}>{working ? t("publishing") : t("publish")}</button>}</footer>
    </div></div>}
    <MessagingDialog open={!!selected && Date.parse(selected.expiresAt) > now} title={t("title")} onClose={() => setSelected(null)} busy={working}>
      {selected && Date.parse(selected.expiresAt) > now && <><MediaImage className={styles.fullPhoto} src={selected.media.full} alt={t("preview")} width={selected.width} height={selected.height} unoptimized onError={() => { setSelected(null); setFailedImages(value => [...value, selected.id]); setNotice("expired"); }} /><p className={styles.note}>{t("expires", { date: expires(selected.expiresAt) })}</p>{selected.isMine && <button type="button" className={styles.delete} disabled={working} onClick={() => void removeShot(selected)}><Trash2 size={18} aria-hidden="true" />{t("delete")}</button>}</>}
    </MessagingDialog>
  </section>;
}
