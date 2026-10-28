"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useViewState } from "@/lib/use-view-state";
import { REVIEW_SOURCES, type ReviewKind } from "@/lib/admin-review";
import OfferModerationStatus from "@/components/OfferModerationStatus";
import { OFFER_STATUSES } from "@/lib/offer-moderation";
import AdminReviewLink from "./AdminReviewLink";
type Result = { rows: { id: string; title: string; published: boolean | null; moderation_status?: string }[]; total: number; pageSize: number };
export default function AdminReviewQueue() {
  const t = useTranslations("AdminReview");
  const m = useTranslations("OfferModeration");
  const [status, setStatus] = useViewState("reviewStatus", "pending");
  const [kind, setKind] = useViewState<ReviewKind>("reviewKind", "listing");
  const [page, setPage] = useViewState("reviewPage", 1);
  const [search, setSearch] = useViewState("reviewSearch", "");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState("");
  const requestKey = JSON.stringify([kind, page, search, status]);
  const loading = requestKey !== finished;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/reviews?" + new URLSearchParams({ kind, page: String(page), q: search, status }), { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("loadError"));
        if (!controller.signal.aborted) { setResult(data); setError(""); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("loadError")); }
      finally { if (!controller.signal.aborted) setFinished(requestKey); }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [kind, page, search, status, requestKey, t]);
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 30)));
  return <section className="space-y-4"><p className="text-sm leading-6 text-text-secondary">{t("queueNotice")}</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-text-secondary">{t("source")}<select value={kind} onChange={event => { setKind(event.target.value as ReviewKind); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-secondary p-3">{Object.keys(REVIEW_SOURCES).map(key => <option key={key} value={key}>{t("types." + key)}</option>)}</select></label><label className="text-sm text-text-secondary">{t("search")}<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-secondary p-3" /></label></div>
    {(kind === "listing" || kind === "company_equipment") && <label className="block text-sm text-text-secondary">{m("statusLabel")}<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-secondary p-3"><option value="all">{m("allStatuses")}</option>{OFFER_STATUSES.map(value => <option key={value} value={value}>{m("statuses." + value)}</option>)}</select></label>}
    {loading ? <p role="status" className="flex items-center gap-2 py-8 text-text-muted"><Loader2 className="animate-spin" size={18} />{t("loading")}</p> : error ? <p role="alert" className="text-crimson-light">{error}</p> : <><p className="text-sm text-text-muted">{t("count", { count: result?.total ?? 0 })}</p><ul className="space-y-3">{result?.rows.map(row => <li key={row.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-secondary p-4"><div className="min-w-0 flex-1 basis-40"><p className="break-words text-text-primary [overflow-wrap:anywhere]">{row.title || t("untitled")}</p>{row.published !== null && <div className="mt-1 text-xs text-text-muted">{row.moderation_status ? <OfferModerationStatus item={row} /> : t(row.published ? "published" : "draft")}</div>}</div><AdminReviewLink kind={kind} id={row.id} /></li>)}</ul><div className="flex items-center justify-between gap-3 text-sm text-text-muted"><p>{page} / {pages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1} aria-label={t("previous")} onClick={() => setPage(value => value - 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={18} /></button><button type="button" disabled={page >= pages} aria-label={t("next")} onClick={() => setPage(value => value + 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={18} /></button></div></div></>}
  </section>;
}
