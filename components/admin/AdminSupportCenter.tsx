"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { useAuth } from "@clerk/nextjs";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { backFromAdminSupportThread, navigateAdminSupportThread } from "@/lib/admin-support-navigation";


type Thread = {
  id: string; memberInitiated?: boolean; targetType: string; targetId: string; targetLabel: string; editUrl: string;
  userId: string; userName: string; userProfileUrl: string | null; userAvatarUrl: string | null;
  createdAt: string; updatedAt: string; unreadCount: number;
  latest: { id: string; content: string; createdAt: string; senderName: string; fromSupport: boolean } | null;
};
type Message = { id: string; content: string; createdAt: string; senderName: string; senderAvatarUrl: string | null; fromSupport: boolean; readAt: string | null };
type Detail = { thread: Thread; messages: Message[]; hasOlder?: boolean; nextCursor?: { before: string; before_id: string } | null };
type Template = { template_key: string; label: string; body: string; enabled: boolean; updated_at?: string };
async function fetchJson<T>(translate: (key: string, values?: Record<string, string | number>) => string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? translate("Ui.text_028a4ad4223a26"));
  return data as T;
}

export function AdminSupportCenter() {
  const uiText = useTranslations();
  const uiLocale = useLocale();
  const layoutText = useTranslations("SupportLayout");
  const { userId, isLoaded } = useAuth();
  const serverAdminId = useContext(ServerAdminContext);
  const owner = userId ?? (!isLoaded ? serverAdminId : null);
  const replyDrafts = useRef(new Map<string, string>());
  const messagesViewport = useRef<HTMLDivElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const atBottom = useRef(true);
  const olderScroll = useRef<{ threadId: string; top: number; height: number } | null>(null);
  const [viewportTop, setViewportTop] = useState(64);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [templateReason, setTemplateReason] = useState("");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [globalUnread, setGlobalUnread] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tab, setTab] = useState<"inbox" | "templates">("inbox");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const activeThreadRef = useRef<string | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const threadRequestRef = useRef(0);
  const [olderLoading, setOlderLoading] = useState(false);
  useEffect(() => { detailRef.current = detail; }, [detail]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState("");
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [templateSaving, setTemplateSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { label: string; body: string; enabled: boolean }>>({});
  const replyIdempotency = useRef<{ conversationId: string; content: string; key: string } | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const payload = await fetchJson<{ threads: Thread[]; total: number; unreadCount?: number }>(uiText, `/api/admin/support/threads?page=${page}`, { cache: "no-store" });
      setThreads(payload.threads); setTotal(payload.total); setGlobalUnread(payload.unreadCount ?? null);
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_7d9dadb013a54e"))); }
    finally { setLoading(false); }
  }, [page]);
  const loadTemplates = useCallback(async () => {
    setTemplateError("");
    try {
      const payload = await fetchJson<{ templates: Template[] }>(uiText, "/api/admin/support/templates", { cache: "no-store" });
      setTemplates(payload.templates);
      setEdits(Object.fromEntries(payload.templates.map((item) => [item.template_key, { label: item.label, body: item.body, enabled: item.enabled }])));
    } catch (cause) { setTemplateError(uiErrorMessage(cause, uiText("Ui.text_32e7fd4733fbad"))); }
  }, []);
  const openThread = useCallback(async (id: string, older = false) => {
    const cursor = older ? detailRef.current?.nextCursor : null;
    if (older && !cursor) return;
    if (activeThreadRef.current !== id) {
      setReply(replyDrafts.current.get(id) ?? ""); setSendSuccess(""); atBottom.current = true;
    }
    if (older && messagesViewport.current) olderScroll.current = { threadId: id, top: messagesViewport.current.scrollTop, height: messagesViewport.current.scrollHeight };
    activeThreadRef.current = id;
    const sequence = older ? null : ++threadRequestRef.current;
    if (older) setOlderLoading(true);
    setActiveId(id); setDetail((current) => current?.thread.id === id ? current : null); setError("");
    try {
      const suffix = cursor ? "?" + new URLSearchParams(cursor).toString() : "";
      const payload = await fetchJson<Detail>(uiText, "/api/admin/support/threads/" + id + suffix, { cache: "no-store" });
      if (activeThreadRef.current !== id || (sequence !== null && sequence !== threadRequestRef.current)) return;
      setDetail((current) => {
        if (current?.thread.id !== id) return payload;
        const earliest = payload.messages[0];
        const retained = older ? current.messages : current.messages.filter(message => earliest && (message.createdAt < earliest.createdAt || (message.createdAt === earliest.createdAt && message.id < earliest.id)));
        const messages = [...new Map([...retained, ...payload.messages].map(message => [message.id, message])).values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
        return { ...payload, messages, ...(older || !retained.length ? {} : { hasOlder: current.hasOlder, nextCursor: current.nextCursor }) };
      });
      const unreadIds = payload.messages.filter((message) => !message.fromSupport && !message.readAt).map((message) => message.id);
      if (unreadIds.length) {
        await fetchJson(uiText, "/api/admin/support/threads/" + id + "/read", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_ids: unreadIds }),
        });
        window.dispatchEvent(new Event("cg:support-unread-changed"));
        void loadInbox();
      }
    } catch (cause) { if (activeThreadRef.current === id) setError(uiErrorMessage(cause, uiText("Ui.text_1fa117ab833b30"))); }
    finally { if (older) setOlderLoading(false); }
  }, [loadInbox]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { void loadInbox(); void loadTemplates(); } });
    return () => { active = false; };
  }, [loadInbox, loadTemplates]);
  useEffect(() => {
    const restore = () => {
      const id = new URL(window.location.href).searchParams.get("supportThread");
      if (id && owner) { setTab("inbox"); void openThread(id); }
      else {
        activeThreadRef.current = null; ++threadRequestRef.current;
        setActiveId(null); setDetail(null); setReply(""); setSendSuccess("");
      }
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("popstate", restore); activeThreadRef.current = null; ++threadRequestRef.current; };
  }, [owner, openThread]);
  useEffect(() => {
    if (activeId && window.matchMedia?.("(max-width: 1279px)").matches) backButton.current?.focus();
  }, [activeId]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const top = viewport?.offsetTop ?? 0;
      const covered = Math.max(0, window.innerHeight - top - (viewport?.height ?? window.innerHeight));
      setViewportTop(64 + top); setKeyboardInset(covered > 120 ? covered : 0);
    };
    update();
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => { viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  useEffect(() => {
    const viewport = messagesViewport.current;
    if (!viewport) return;
    if (olderScroll.current && olderScroll.current.threadId === detail?.thread.id) {
      viewport.scrollTop = olderScroll.current.top + viewport.scrollHeight - olderScroll.current.height;
      olderScroll.current = null;
    } else {
      olderScroll.current = null;
      if (atBottom.current) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [detail]);
  function selectThread(id: string) {
    if (owner) navigateAdminSupportThread(window, owner, id);
    void openThread(id);
  }
  function closeThread() {
    activeThreadRef.current = null; ++threadRequestRef.current;
    setActiveId(null); setDetail(null); setReply(""); setSendSuccess("");
    if (owner) backFromAdminSupportThread(window, owner);
  }

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadInbox(); }, 15000);
    return () => window.clearInterval(timer);
  }, [loadInbox]);
  useEffect(() => {
    if (!activeId || tab !== "inbox") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && activeThreadRef.current === activeId) void openThread(activeId);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeId, openThread, tab]);

  async function sendReply() {
    const threadId = activeId;
    const content = reply.trim();
    if (!threadId || !content || submitting.current) return;
    submitting.current = true; setSendSuccess(""); setSending(true); setError("");
    try {
      if (!replyIdempotency.current || replyIdempotency.current.content !== content || replyIdempotency.current.conversationId !== threadId) {
        replyIdempotency.current = { conversationId: threadId, content, key: crypto.randomUUID() };
      }
      const result = await fetchJson<{ success: boolean; messageId?: string }>(uiText, "/api/admin/support/threads/" + threadId, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, idempotencyKey: replyIdempotency.current.key }),
      });
      if (!result.success || !result.messageId) throw new Error(uiText("Ui.text_355ea51d5f6965"));
      if (replyDrafts.current.get(threadId)?.trim() === content) replyDrafts.current.delete(threadId);
      replyIdempotency.current = null;
      if (activeThreadRef.current === threadId) {
        setSendSuccess(uiText("Ui.text_85f6090c147eb0"));
        setReply(replyDrafts.current.get(threadId) ?? "");
        atBottom.current = true;
        await openThread(threadId);
      }
      await loadInbox();
    } catch (cause) {
      if (activeThreadRef.current === threadId) setError(uiErrorMessage(cause, uiText("Ui.text_355ea51d5f6965")));
    } finally { submitting.current = false; setSending(false); }
  }
  async function saveTemplate(template: Template) {
    const edit = edits[template.template_key];
    if (!edit || templateSaving) return;
    const reason = templateReason;
    if (reason.trim().length < 5) { setTemplateError(uiText("Ui.text_5a74d7bcf38f7d")); return; }
    setTemplateSaving(template.template_key); setTemplateError("");
    try {
      await fetchJson(uiText, "/api/admin/support/templates", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: template.template_key, ...edit, reason: reason.trim() }),
      });
      await loadTemplates(); setTemplateReason("");
    } catch (cause) { setTemplateError(uiErrorMessage(cause, uiText("Ui.text_e9c68d231f1fa4"))); }
    finally { setTemplateSaving(null); }
  }

  const unreadTotal = useMemo(() => threads.reduce((sum, thread) => sum + thread.unreadCount, 0), [threads]);
  const viewportStyle = { "--support-top": `${viewportTop}px`, "--support-bottom": `max(var(--mobile-nav-offset), ${keyboardInset}px)` } as CSSProperties;
  return <div className="min-w-0 space-y-4">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="text-lg font-semibold text-text-primary">{uiText("Ui.text_7ea8a1343a4e0c")}</h2><p className="mt-1 text-sm text-text-muted">{uiText("Ui.text_d985cd9358090b")}</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary">{uiText.rich("Ui.text_972ca9e0f5fc04", { value1: () => total, value2: () => globalUnread ?? unreadTotal })}</span><button onClick={() => void loadInbox()} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-secondary">{uiText("AdminAccounts.refresh")}</button></div>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-border">
      <button onClick={() => setTab("inbox")} aria-pressed={tab === "inbox"} className={"min-h-11 border-b-2 px-3 text-sm " + (tab === "inbox" ? "border-crimson text-text-primary" : "border-transparent text-text-muted")}>{uiText("Ui.text_daf3f78316430b")}</button>
      <button onClick={() => setTab("templates")} aria-pressed={tab === "templates"} className={"min-h-11 border-b-2 px-3 text-sm " + (tab === "templates" ? "border-crimson text-text-primary" : "border-transparent text-text-muted")}>{uiText("Ui.text_4301060a69bfc5")}</button>
    </div>
    {tab === "inbox" && <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
      <section className={`${activeId ? "hidden xl:flex" : "flex"} min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-bg-secondary xl:h-[min(70dvh,640px)]`}>
        <div className="shrink-0 border-b border-border p-3 text-xs text-text-muted">{uiText("Ui.text_103bd11ef1c3ac")}</div>
        {loading && !threads.length ? <p role="status" className="p-5 text-sm text-text-muted">{uiText("Ui.text_b3ed93b579c416")}</p> : !threads.length ? <p className="p-6 text-sm text-text-muted">{uiText("Ui.text_d03bbaf8aaecea")}</p> : <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
          {threads.map(thread => <button key={thread.id} onClick={() => selectThread(thread.id)} aria-pressed={thread.id === activeId} className={"w-full p-3 text-left hover:bg-bg-elevated " + (thread.id === activeId ? "bg-bg-elevated" : "")}>
            <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{thread.userName}</p><p className="truncate text-xs text-text-muted">{thread.targetLabel}</p></div>{thread.unreadCount > 0 && <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-bg-primary">{thread.unreadCount}</span>}</div>
            <p className="mt-2 line-clamp-2 break-words text-xs text-text-secondary [overflow-wrap:anywhere]">{thread.latest?.senderName}: {thread.latest?.content}</p><p className="mt-1 text-[10px] text-text-muted">{new Date(thread.updatedAt).toLocaleString(uiLocale)}</p>
          </button>)}
        </div>}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border p-3 text-xs text-text-muted"><span>{uiText.rich("Ui.text_ccd5e6ba93091e", { value1: () => page, value2: () => total })}</span><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">{uiText("setup.copy99")}</button><button disabled={page * 30 >= total || loading} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">{uiText("setup.copy102")}</button></div></div>
      </section>
      <section style={viewportStyle} aria-label={layoutText("conversation")} className={`${activeId ? "flex" : "hidden xl:flex"} fixed inset-x-0 top-[var(--support-top)] bottom-[var(--support-bottom)] z-50 min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-bg-secondary xl:static xl:z-auto xl:h-[min(70dvh,640px)] xl:rounded-xl`}>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border p-3 sm:p-4">
          <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-0">
            <button ref={backButton} type="button" onClick={closeThread} aria-label={layoutText("back")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary xl:hidden"><ArrowLeft size={19} /></button>
            {detail ? <><div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-elevated">{detail.thread.userAvatarUrl && <UnoptimizedImage src={detail.thread.userAvatarUrl} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{detail.thread.userName}</p><p className="truncate text-xs text-text-muted">{detail.thread.targetLabel}</p></div></> : <p role="status" className="text-sm text-text-muted">{activeId ? (error ? "" : layoutText("loading")) : uiText("Ui.text_c6ce6f6f2d2fa7")}</p>}
          </div>
          {detail && <div className="flex flex-wrap gap-2">{uiText.rich("Ui.text_29b1a8a5dc1790", { value1: () => detail.thread.userProfileUrl && <a href={detail.thread.userProfileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs text-text-secondary">{uiText("AdminAccounts.openProfile")}</a>, part2: chunks => detail.thread.memberInitiated ? null : <a href={detail.thread.editUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-gold/30 px-3 text-xs text-gold">{chunks}</a> })}</div>}
        </header>
        {error && <div role="alert" className="shrink-0 border-b border-crimson/30 p-3 text-sm text-crimson-light"><p>{error}</p>{activeId && <button type="button" onClick={() => void openThread(activeId)} className="min-h-11 rounded-lg border border-border px-3 text-text-secondary">{uiText("FormDraft.reload")}</button>}</div>}
        <div ref={messagesViewport} onScroll={event => { const viewport = event.currentTarget; atBottom.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80; }} className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {detail?.hasOlder && <button type="button" disabled={olderLoading} onClick={() => void openThread(detail.thread.id, true)} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-secondary disabled:opacity-50">{olderLoading ? uiText("Ui.text_9767238939207a") : uiText("Ui.text_b15d7a15520819")}</button>}
          {detail?.messages.map(message => <article key={message.id} className={"max-w-[88%] rounded-xl border p-3 " + (message.fromSupport ? "ml-auto border-gold/30 bg-gold/10" : "border-border bg-bg-primary")}><p className="mb-1 break-words text-[11px] font-semibold text-text-muted [overflow-wrap:anywhere]">{message.senderName}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{message.content}</p><time className="mt-2 block text-right text-[10px] text-text-muted">{new Date(message.createdAt).toLocaleString(uiLocale)}</time></article>)}
        </div>
        {detail && <div className="shrink-0 border-t border-border p-3 sm:p-4">
          {sendSuccess && <p role="status" className="mb-2 text-xs text-success">{sendSuccess}</p>}
          <div className="flex min-w-0 items-end gap-2"><textarea aria-label={layoutText("reply")} value={reply} onChange={event => { const value = event.target.value; setReply(value); if (activeId) replyDrafts.current.set(activeId, value); setSendSuccess(""); }} maxLength={5000} rows={2} placeholder={uiText("Ui.text_39c289eaf99305")} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-border bg-bg-primary p-3 text-base text-text-primary sm:text-sm" /><button aria-label={uiText("Ui.text_70e11be7ed62ea")} onClick={() => void sendReply()} disabled={!reply.trim() || sending} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-gold px-3 text-sm font-semibold text-bg-primary disabled:opacity-50">{uiText.rich("Ui.text_ec3ffacc47d449", { value1: () => sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />, part2: chunks => <span className="hidden sm:inline">{chunks}</span> })}</button></div>
        </div>}
      </section>
    </div>}
    {tab === "templates" && <div className="min-w-0 space-y-3">
      <div className="rounded-xl border border-border bg-bg-secondary p-4 text-xs leading-5 text-text-muted">{uiText("Ui.text_9307d4f57d075f")}</div>
      <label className="block text-sm text-text-secondary">{layoutText("templateReason")}<textarea value={templateReason} maxLength={500} rows={2} onChange={event => setTemplateReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-primary p-3 text-base sm:text-sm" /></label>
      {templateError && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{templateError}</p>}
      {templates.map(template => { const edit = edits[template.template_key] ?? { label: template.label, body: template.body, enabled: template.enabled }; return <article key={template.template_key} className="min-w-0 rounded-xl border border-border bg-bg-secondary p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><label className="min-w-0 flex-1 text-xs text-text-muted">{uiText.rich("Ui.text_a67b5c1f09eea3", { part1: () => <input value={edit.label} onChange={event => setEdits(current => ({ ...current, [template.template_key]: { ...edit, label: event.target.value } }))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary sm:text-sm" /> })}</label><label className="inline-flex min-h-11 items-center gap-2 text-xs text-text-secondary">{uiText.rich("Ui.text_ec586c7469c597", { part1: () => <input type="checkbox" checked={edit.enabled} onChange={event => setEdits(current => ({ ...current, [template.template_key]: { ...edit, enabled: event.target.checked } }))} /> })}</label></div>
        <label className="mt-3 block text-xs text-text-muted">{uiText.rich("Ui.text_fb579af6d5090d", { part1: () => <textarea value={edit.body} maxLength={5000} rows={4} onChange={event => setEdits(current => ({ ...current, [template.template_key]: { ...edit, body: event.target.value } }))} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-bg-primary p-3 text-base leading-6 text-text-primary sm:text-sm" /> })}</label>
        <div className="mt-3 flex justify-end"><button disabled={Boolean(templateSaving)} onClick={() => void saveTemplate(template)} className="min-h-11 rounded-lg border border-gold/30 px-4 py-2 text-xs font-semibold text-gold disabled:opacity-50">{templateSaving === template.template_key ? uiText("Ui.text_4f696a99f9c9e4") : uiText("Ui.text_c5505bb9de3b8b")}</button></div>
      </article>; })}
    </div>}
    {error && !activeId && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}
  </div>;
}
