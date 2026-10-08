"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, MessageCircle, Pin, Plus, Search, Send, Trash2, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type Kind = "question" | "recommendation" | "request" | "offer";
type Reply = { id: string; body: string; created_at: string; author_name: string; author_avatar: string | null };
type Post = {
  id: string; author_id: string; kind: Kind; title: string; body: string; city: string | null; created_at: string;
  author_name: string; author_avatar: string | null; reply_count: number;
};

const KINDS: Kind[] = ["question", "recommendation", "request", "offer"];
const KIND_STYLE: Record<Kind, string> = {
  question: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  recommendation: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  request: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  offer: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
};
const KIND_CARD_STYLE: Record<Kind, { card: string; accent: string }> = {
  question: {
    card: "border-cyan-300/30 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.10),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-cyan-300/55",
    accent: "from-cyan-300 via-cyan-400/80 to-sky-400/70",
  },
  recommendation: {
    card: "border-violet-300/30 bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.11),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-violet-300/55",
    accent: "from-violet-300 via-violet-400/80 to-fuchsia-400/70",
  },
  request: {
    card: "border-amber-300/35 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.12),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-amber-300/60",
    accent: "from-amber-300 via-amber-400/80 to-orange-400/70",
  },
  offer: {
    card: "border-emerald-300/30 bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.11),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-emerald-300/55",
    accent: "from-emerald-300 via-emerald-400/80 to-teal-400/70",
  },
};

export default function CommunityBoard({ loggedIn = false, fullPage = false }: { loggedIn?: boolean; fullPage?: boolean }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ kind: "question" as Kind, title: "", body: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const limit = fullPage ? 50 : 3;

  const loadPosts = useCallback(async (search: string, selectedKind: Kind | "all") => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (search.trim()) params.set("q", search.trim());
    if (selectedKind !== "all") params.set("kind", selectedKind);
    try {
      const response = await fetch(`/api/community-posts?${params}`);
      const payload = await response.json();
      setPosts(response.ok ? payload.posts ?? [] : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { void loadPosts("", "all"); }, [loadPosts]);

  useEffect(() => {
    if (!fullPage) return;
    const timer = window.setTimeout(() => void loadPosts(query, kind), 250);
    return () => window.clearTimeout(timer);
  }, [fullPage, kind, query, loadPosts]);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/community-posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t("boardError"));
      setForm({ kind: "question", title: "", body: "", city: "" });
      setComposerOpen(false);
      await loadPosts("", "all");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("boardError"));
    } finally { setBusy(false); }
  }

  async function toggleReplies(postId: string) {
    if (expanded === postId) { setExpanded(null); return; }
    setExpanded(postId);
    if (replies[postId]) return;
    try {
      const response = await fetch(`/api/community-posts/${postId}/replies`);
      const payload = await response.json();
      if (response.ok) setReplies(current => ({ ...current, [postId]: payload.replies ?? [] }));
    } catch { /* Reply panel stays available for retry on next open. */ }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const body = replyDrafts[postId]?.trim();
    if (!body) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/community-posts/${postId}/replies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t("boardError"));
      setReplies(current => ({ ...current, [postId]: [...(current[postId] ?? []), payload.reply] }));
      setPosts(current => current.map(post => post.id === postId ? { ...post, reply_count: post.reply_count + 1 } : post));
      setReplyDrafts(current => ({ ...current, [postId]: "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("boardError")); }
    finally { setBusy(false); }
  }

  async function deletePost(postId: string) {
    if (!window.confirm(t("boardDeleteConfirm"))) return;
    setDeleting(postId); setError("");
    try {
      const response = await fetch(`/api/community-posts/${postId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t("boardError"));
      setPosts(current => current.filter(post => post.id !== postId));
      setExpanded(current => current === postId ? null : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("boardError"));
    } finally { setDeleting(null); }
  }

  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(date));
  const composerContent = loggedIn ? <form onSubmit={event => void submitPost(event)} className="space-y-4">
    <label className="block text-sm font-medium text-text-secondary">{t("boardTypeLabel")}<select value={form.kind} onChange={event => setForm(current => ({ ...current, kind: event.target.value as Kind }))} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold/60">{KINDS.map(value => <option key={value} value={value}>{t(`boardKind_${value}`)}</option>)}</select></label>
    <label className="block text-sm font-medium text-text-secondary">{t("boardTitleLabel")}<input required minLength={5} maxLength={140} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder={t("boardTitlePlaceholder")} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold/60" /></label>
    <label className="block text-sm font-medium text-text-secondary">{t("boardTextLabel")}<textarea required minLength={10} maxLength={3000} rows={5} value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder={t(form.kind === "question" ? "boardQuestionPlaceholder" : "boardBodyPlaceholder")} className="mt-1.5 w-full resize-y rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold/60" /></label>
    <label className="block text-sm font-medium text-text-secondary">{t("boardCityLabel")}<input maxLength={100} value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} placeholder={t("boardCityPlaceholder")} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold/60" /></label>
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setComposerOpen(false)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary">{t("boardCancel")}</button><button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-60"><Pin size={15} />{t("boardSubmit")}</button></div>
  </form> : <div className="rounded-xl border border-border bg-bg-primary/50 p-5 text-center"><p className="text-sm text-text-secondary">{t("boardLoginPrompt")}</p><Link href="/sign-in?redirect_url=%2Fcommunity" className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary">{t("boardLogin")}</Link></div>;

  return (
    <section className={fullPage ? "mx-auto max-w-5xl px-4 pt-3 pb-8 sm:px-6 sm:py-12" : "px-4 py-7 sm:px-6 sm:py-9 lg:px-8"} aria-labelledby="community-board-title">
      <div className={fullPage ? "" : "relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/[0.12] via-bg-secondary/95 to-cyan-400/[0.08] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.3)] sm:p-6 lg:p-7 before:pointer-events-none before:absolute before:-right-12 before:-top-24 before:h-72 before:w-72 before:rounded-full before:bg-gold/[0.14] before:blur-3xl"}>
        <div className={`mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row ${fullPage ? "sm:items-center sm:justify-end" : "sm:items-end sm:justify-between"}`}>
          {!fullPage && <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gold"><Pin size={12} />{t("boardLabel")}</p>
            <h2 id="community-board-title" className="font-display text-2xl font-bold text-text-primary sm:text-3xl">{t("boardTitle")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">{t("boardDescription")}</p>
          </div>}
          <button type="button" onClick={() => { setError(""); setComposerOpen(!composerOpen); }} className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-bg-primary shadow-lg shadow-gold/15 transition-all hover:-translate-y-0.5 hover:bg-gold-light ${fullPage ? "w-full sm:w-auto" : ""}`}>
            {composerOpen ? <X size={16} /> : <Plus size={16} />} {composerOpen ? t("boardCancel") : t("boardCreate")}
          </button>
        </div>

        {composerOpen && !fullPage && <div className="relative mb-5 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-bg-primary/70 to-bg-primary/40 p-4 shadow-lg shadow-black/10 sm:p-5">
          <span className="absolute -top-1.5 left-7 h-3 w-3 rounded-full border-2 border-bg-secondary bg-gold shadow-[0_0_12px_rgba(191,242,39,0.45)]" />
          <div className="mb-4 border-b border-gold/15 pb-3"><p className="font-display text-lg font-semibold italic text-text-primary">{t("boardComposeTitle")}</p><p className="mt-1 text-xs text-text-muted">{t("boardExpiresHint")}</p></div>
          {composerContent}
        </div>}

        {fullPage && <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("boardSearchPlaceholder")} className="h-11 w-full rounded-xl border border-border bg-bg-secondary pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold/60" />
          </label>
          <div className="flex flex-wrap gap-2">
            {(["all", ...KINDS] as const).map(value => <button key={value} type="button" onClick={() => setKind(value)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${kind === value ? "border-gold/50 bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/30"}`}>{value === "all" ? t("boardAll") : t(`boardKind_${value}`)}</button>)}
          </div>
        </div>}

        {error && <p role="alert" className="relative mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        {loading ? <div className="relative rounded-xl border border-border bg-bg-primary/40 px-4 py-8 text-center text-sm text-text-muted">{t("boardLoading")}</div> : posts.length ? <div className={`relative grid gap-2.5 sm:gap-3 ${fullPage ? "md:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
          {posts.map((post, index) => <article id={post.id} key={post.id} className={`relative min-w-0 overflow-hidden rounded-2xl border p-3.5 text-text-primary shadow-[0_12px_30px_rgba(0,0,0,0.26)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.38)] sm:p-5 ${KIND_CARD_STYLE[post.kind].card} ${!fullPage && index >= 2 ? "hidden sm:block" : ""}`}>
            <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${KIND_CARD_STYLE[post.kind].accent}`} />
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 sm:mb-3.5">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide sm:px-3 sm:py-1.5 sm:text-xs ${KIND_STYLE[post.kind]}`}>{t(`boardKind_${post.kind}`)}</span>
              <div className="flex items-center gap-3">
                <time className="text-xs text-text-muted" dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                {loggedIn && user?.id === post.author_id && <button type="button" onClick={() => void deletePost(post.id)} disabled={deleting === post.id} aria-label={t("boardDelete")} title={t("boardDelete")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-400/[0.06] px-2.5 text-xs font-semibold text-red-200/80 transition-colors hover:border-red-300/40 hover:bg-red-400/15 hover:text-red-100 disabled:opacity-50"><Trash2 size={14} />{deleting === post.id ? t("boardDeleting") : t("boardDelete")}</button>}
              </div>
            </div>
            <h3 className="break-words font-display text-lg font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-xl">{post.title}</h3>
            <p className={`mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-secondary [overflow-wrap:anywhere] sm:mt-2.5 sm:text-sm ${fullPage ? "" : "line-clamp-3"}`}>{post.body}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/80 pt-2.5 text-xs text-text-muted sm:mt-3.5 sm:gap-3 sm:pt-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                {post.author_avatar ? <Image src={post.author_avatar} alt="" width={24} height={24} unoptimized className="h-6 w-6 rounded-full object-cover ring-1 ring-border" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/10 text-[10px] font-semibold text-gold">{post.author_name.slice(0, 1).toUpperCase()}</span>}
                <span className="truncate text-text-secondary">{post.author_name}</span>
                {post.city && <span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={12} className="shrink-0" /><span className="truncate">{post.city}</span></span>}
              </div>
              {fullPage ? <button type="button" onClick={() => void toggleReplies(post.id)} className="inline-flex min-h-9 shrink-0 items-center gap-1 font-semibold text-gold transition-colors hover:text-gold-light sm:gap-1.5"><MessageCircle size={14} />{t("boardReplies", { count: post.reply_count })}</button> : <Link href={`/community#${post.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-1 font-semibold text-gold transition-colors hover:text-gold-light sm:gap-1.5"><MessageCircle size={14} />{t("boardReplies", { count: post.reply_count })}</Link>}
            </div>
            {fullPage && expanded === post.id && <div className="mt-3 border-t border-border/70 pt-3">
              <div className="space-y-3">
                {(replies[post.id] ?? []).map(reply => <div key={reply.id} className="flex gap-2.5 text-sm"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-[10px] text-text-secondary">{reply.author_name.slice(0, 1).toUpperCase()}</span><div><p className="font-medium text-text-primary">{reply.author_name} <time className="ml-1 text-[11px] font-normal text-text-muted">{formatDate(reply.created_at)}</time></p><p className="mt-0.5 whitespace-pre-wrap text-text-secondary">{reply.body}</p></div></div>)}
                {!replies[post.id]?.length && <p className="text-xs text-text-muted">{t("boardNoReplies")}</p>}
              </div>
              {loggedIn ? <form onSubmit={event => void submitReply(event, post.id)} className="mt-3 flex gap-2"><input value={replyDrafts[post.id] ?? ""} onChange={event => setReplyDrafts(current => ({ ...current, [post.id]: event.target.value }))} maxLength={1000} placeholder={t("boardReplyPlaceholder")} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold/60" /><button aria-label={t("boardSendReply")} disabled={busy || !(replyDrafts[post.id] ?? "").trim()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-bg-primary disabled:opacity-50"><Send size={15} /></button></form> : <Link href="/sign-in?redirect_url=%2Fcommunity" className="mt-3 inline-block text-sm font-medium text-gold">{t("boardLogin")}</Link>}
            </div>}
          </article>)}
        </div> : <div className="rounded-2xl border border-dashed border-border bg-bg-primary/30 px-4 py-8 text-center sm:px-6">
          <p className="font-display text-lg font-semibold text-text-primary">{t("boardEmptyTitle")}</p><p className="mx-auto mt-1 max-w-lg text-sm text-text-secondary">{t("boardEmptyDescription")}</p>
        </div>}
        {!fullPage && <div className="mt-4 text-right"><Link href="/community" className="text-sm font-semibold text-gold hover:text-gold-light">{t("boardSeeAll")} →</Link></div>}
      </div>

      {composerOpen && fullPage && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setComposerOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="board-compose-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-border bg-bg-secondary p-5 shadow-2xl sm:rounded-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-gold">{t("boardLabel")}</p><h2 id="board-compose-title" className="mt-1 font-display text-xl font-bold text-text-primary">{t("boardComposeTitle")}</h2></div><button type="button" onClick={() => setComposerOpen(false)} aria-label={t("boardCancel")} className="rounded-lg p-2 text-text-muted hover:bg-bg-elevated"><X size={18} /></button></div>
          {composerContent}
        </div>
      </div>}
    </section>
  );
}