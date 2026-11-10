"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import { Loader2, Send } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


type Thread = {
  id: string; targetType: string; targetId: string; targetLabel: string; editUrl: string;
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

  const [threads, setThreads] = useState<Thread[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tab, setTab] = useState<"inbox" | "templates">("inbox");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const activeThreadRef = useRef<string | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const threadRequestRef = useRef(0);
  const [olderLoading, setOlderLoading] = useState(false);
  detailRef.current = detail;
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
      const payload = await fetchJson<{ threads: Thread[]; total: number }>(uiText, `/api/admin/support/threads?page=${page}`, { cache: "no-store" });
      setThreads(payload.threads); setTotal(payload.total);
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
    if (activeThreadRef.current !== id) { setReply(""); setSendSuccess(""); }
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
        void loadInbox();
      }
    } catch (cause) { if (activeThreadRef.current === id) setError(uiErrorMessage(cause, uiText("Ui.text_1fa117ab833b30"))); }
    finally { if (older) setOlderLoading(false); }
  }, [loadInbox]);
  useEffect(() => { void loadInbox(); void loadTemplates(); }, [loadInbox, loadTemplates]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadInbox(); }, 15000);
    return () => window.clearInterval(timer);
  }, [loadInbox]);
  useEffect(() => {
    if (!activeId || tab !== "inbox") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void openThread(activeId);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeId, openThread, tab]);

  async function sendReply() {
    if (!activeId || !reply.trim() || submitting.current) return;
    submitting.current = true;
    setSendSuccess("");
    setSending(true); setError("");
    try {
      const content = reply.trim();
      if (!replyIdempotency.current || replyIdempotency.current.content !== content || replyIdempotency.current.conversationId !== activeId) {
        replyIdempotency.current = { conversationId: activeId, content, key: crypto.randomUUID() };
      }
      await fetchJson(uiText, "/api/admin/support/threads/" + activeId, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, idempotencyKey: replyIdempotency.current.key }),
      });
      setSendSuccess(uiText("Ui.text_85f6090c147eb0"));
      setReply("");
      replyIdempotency.current = null;
      await Promise.all([openThread(activeId), loadInbox()]);
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_355ea51d5f6965"))); }
    finally { submitting.current = false; setSending(false); }
  }
  async function saveTemplate(template: Template) {
    const edit = edits[template.template_key];
    if (!edit || templateSaving) return;
    const reason = window.prompt(uiText("Ui.text_789a5042fe6805"));
    if (reason === null) return;
    if (reason.trim().length < 5) { setTemplateError(uiText("Ui.text_5a74d7bcf38f7d")); return; }
    setTemplateSaving(template.template_key); setTemplateError("");
    try {
      await fetchJson(uiText, "/api/admin/support/templates", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: template.template_key, ...edit, reason: reason.trim() }),
      });
      await loadTemplates();
    } catch (cause) { setTemplateError(uiErrorMessage(cause, uiText("Ui.text_e9c68d231f1fa4"))); }
    finally { setTemplateSaving(null); }
  }

  const unreadTotal = useMemo(() => threads.reduce((sum, thread) => sum + thread.unreadCount, 0), [threads]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-text-primary">{uiText("Ui.text_7ea8a1343a4e0c")}</h2><p className="mt-1 text-sm text-text-muted">{uiText("Ui.text_d985cd9358090b")}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary">{uiText.rich("Ui.text_972ca9e0f5fc04", { value1: () => (total), value2: () => (unreadTotal) })}</span><button onClick={() => void loadInbox()} className="min-h-10 rounded-lg border border-border px-3 text-xs text-text-secondary">{uiText("AdminAccounts.refresh")}</button></div></div>
    <div className="flex gap-2 border-b border-border"><button onClick={() => setTab("inbox")} className={"min-h-10 border-b-2 px-3 text-sm " + (tab === "inbox" ? "border-crimson text-text-primary" : "border-transparent text-text-muted")}>{uiText("Ui.text_daf3f78316430b")}</button><button onClick={() => setTab("templates")} className={"min-h-10 border-b-2 px-3 text-sm " + (tab === "templates" ? "border-crimson text-text-primary" : "border-transparent text-text-muted")}>{uiText("Ui.text_4301060a69bfc5")}</button></div>
    {tab === "inbox" && <div className="grid min-h-[540px] gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
      <section className="overflow-hidden rounded-xl border border-border bg-bg-secondary"><div className="border-b border-border p-3 text-xs text-text-muted">{uiText("Ui.text_103bd11ef1c3ac")}</div>{loading ? <p className="p-5 text-sm text-text-muted">{uiText("Ui.text_b3ed93b579c416")}</p> : !threads.length ? <p className="p-6 text-sm text-text-muted">{uiText("Ui.text_d03bbaf8aaecea")}</p> : <div className="max-h-[620px] divide-y divide-border overflow-y-auto">{threads.map((thread) => <button key={thread.id} onClick={() => void openThread(thread.id)} className={"w-full p-3 text-left hover:bg-bg-elevated " + (thread.id === activeId ? "bg-bg-elevated" : "")}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{thread.userName}</p><p className="truncate text-xs text-text-muted">{thread.targetLabel}</p></div>{thread.unreadCount > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-bg-primary">{thread.unreadCount}</span>}</div><p className="mt-2 line-clamp-2 text-xs text-text-secondary">{thread.latest?.senderName}: {thread.latest?.content}</p><p className="mt-1 text-[10px] text-text-muted">{new Date(thread.updatedAt).toLocaleString(uiLocale)}</p></button>)}</div>}
        <div className="flex items-center justify-between border-t border-border p-3 text-xs text-text-muted"><span>{uiText.rich("Ui.text_ccd5e6ba93091e", { value1: () => (page), value2: () => (total) })}</span><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="min-h-9 rounded-lg border border-border px-3 disabled:opacity-40">{uiText("setup.copy99")}</button><button disabled={page * 30 >= total || loading} onClick={() => setPage((value) => value + 1)} className="min-h-9 rounded-lg border border-border px-3 disabled:opacity-40">{uiText("setup.copy102")}</button></div></div>
      </section>
      <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-bg-secondary">
        {!activeId || !detail ? <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-muted">{uiText("Ui.text_c6ce6f6f2d2fa7")}</div> : <>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 sm:p-4"><div className="flex min-w-0 items-center gap-3">{detail.thread.userAvatarUrl ? <UnoptimizedImage src={detail.thread.userAvatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-bg-elevated" />}<div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{detail.thread.userName}</p><p className="truncate text-xs text-text-muted">{detail.thread.targetLabel}</p></div></div><div className="flex gap-2">{uiText.rich("Ui.text_29b1a8a5dc1790", { value1: () => (detail.thread.userProfileUrl && <a href={detail.thread.userProfileUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary">{uiText("AdminAccounts.openProfile")}</a>), part2: chunks => (<a href={detail.thread.editUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-gold/30 px-3 py-2 text-xs text-gold">{chunks}</a>) })}</div></header>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">{detail.hasOlder && <button type="button" disabled={olderLoading} onClick={() => void openThread(detail.thread.id, true)} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-secondary disabled:opacity-50">{olderLoading ? uiText("Ui.text_9767238939207a") : uiText("Ui.text_b15d7a15520819")}</button>}{detail.messages.map((message) => <article key={message.id} className={"max-w-[88%] rounded-xl border p-3 " + (message.fromSupport ? "ml-auto border-gold/30 bg-gold/10" : "border-border bg-bg-primary")}><p className="mb-1 text-[11px] font-semibold text-text-muted">{message.senderName}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{message.content}</p><time className="mt-2 block text-right text-[10px] text-text-muted">{new Date(message.createdAt).toLocaleString(uiLocale)}</time></article>)}</div>
          <div className="border-t border-border p-3 sm:p-4"><div className="flex items-end gap-2"><textarea disabled={sending} value={reply} onChange={(event) => { setReply(event.target.value); setSendSuccess(""); }} maxLength={5000} rows={2} placeholder={uiText("Ui.text_39c289eaf99305")} className="min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-primary" /><button aria-label={uiText("Ui.text_70e11be7ed62ea")} onClick={() => void sendReply()} disabled={!reply.trim() || sending} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-gold px-3 text-sm font-semibold text-bg-primary disabled:opacity-50">{uiText.rich("Ui.text_ec3ffacc47d449", { value1: () => (sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />), part2: chunks => (<span className="hidden sm:inline">{chunks}</span>) })}</button></div></div>
        </>}
      </section>
    </div>}
    {tab === "templates" && <div className="space-y-3"><div className="rounded-xl border border-border bg-bg-secondary p-4 text-xs leading-5 text-text-muted">{uiText("Ui.text_9307d4f57d075f")}</div>{templateError && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{templateError}</p>}{templates.map((template) => { const edit = edits[template.template_key] ?? { label: template.label, body: template.body, enabled: template.enabled }; return <article key={template.template_key} className="rounded-xl border border-border bg-bg-secondary p-4"><div className="flex flex-wrap items-center justify-between gap-2"><label className="min-w-0 flex-1 text-xs text-text-muted">{uiText.rich("Ui.text_a67b5c1f09eea3", { part1: () => (<input value={edit.label} onChange={(event) => setEdits((current) => ({ ...current, [template.template_key]: { ...edit, label: event.target.value } }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary" />) })}</label><label className="inline-flex min-h-10 items-center gap-2 text-xs text-text-secondary">{uiText.rich("Ui.text_ec586c7469c597", { part1: () => (<input type="checkbox" checked={edit.enabled} onChange={(event) => setEdits((current) => ({ ...current, [template.template_key]: { ...edit, enabled: event.target.checked } }))} />) })}</label></div><label className="mt-3 block text-xs text-text-muted">{uiText.rich("Ui.text_fb579af6d5090d", { part1: () => (<textarea value={edit.body} maxLength={5000} rows={4} onChange={(event) => setEdits((current) => ({ ...current, [template.template_key]: { ...edit, body: event.target.value } }))} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-bg-primary p-3 text-sm leading-6 text-text-primary" />) })}</label><div className="mt-3 flex justify-end"><button disabled={templateSaving === template.template_key} onClick={() => void saveTemplate(template)} className="min-h-10 rounded-lg border border-gold/30 px-3 text-xs font-semibold text-gold disabled:opacity-50">{templateSaving === template.template_key ? uiText("Ui.text_4f696a99f9c9e4") : uiText("Ui.text_c5505bb9de3b8b")}</button></div></article>; })}</div>}
    {sendSuccess && <p role="status" aria-live="polite" className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm font-semibold text-success">{sendSuccess}</p>}
    {error && <p role="alert" className="rounded-lg border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}
  </div>;
}

