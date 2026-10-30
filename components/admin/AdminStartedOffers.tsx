"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { SupportMessageAction } from "./SupportMessageAction";
import type { StartedOffer } from "@/lib/admin-started-offers";

type Result = { offers: (StartedOffer & { accountName: string })[]; nextOffset: number | null; scanned: number };
export function AdminStartedOffers() {
  const t = useTranslations("AdminStartedOffers");
  const format = useFormatter();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [offsets, setOffsets] = useState([0]);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [finished, setFinished] = useState("");
  const [error, setError] = useState("");
  const offset = offsets[offsets.length - 1];
  const requestKey = JSON.stringify([search, kind, offset, refresh, locale]);
  const loading = finished !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/started-offers?" + new URLSearchParams({ search, kind, offset: String(offset) }), { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("loadError"));
        if (!controller.signal.aborted) { setResult(data); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("loadError"));
      } finally { if (!controller.signal.aborted) setFinished(requestKey); }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, kind, offset, requestKey, t]);

  return <div className="space-y-4">
    <p className="rounded-xl border border-border bg-bg-elevated p-4 text-sm leading-6 text-text-secondary">{t("explanation")}</p>
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative w-full sm:max-w-sm"><span className="sr-only">{t("search")}</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setOffsets([0]); }} placeholder={t("search")} className="min-h-11 w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary" /></label>
      <label className="min-w-0"><span className="sr-only">{t("kind")}</span><select value={kind} onChange={event => { setKind(event.target.value); setOffsets([0]); }} className="min-h-11 max-w-full rounded-xl border border-border bg-bg-secondary px-3 text-sm text-text-primary">{["all", "location", "marketplace", "company", "animal", "job"].map(value => <option key={value} value={value}>{t("kinds." + value)}</option>)}</select></label>
      <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary disabled:opacity-50"><RefreshCw size={14} />{t("refresh")}</button>
    </div>
    {loading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" />{t("loading")}</p> : error ? <p role="alert" className="rounded-xl border border-crimson/30 p-4 text-sm text-crimson-light">{error}</p> : !result?.offers.length ? <p className="py-10 text-center text-sm text-text-muted">{t(result?.nextOffset !== null ? "emptyPage" : "empty")}</p> : <ul className="space-y-3">{result.offers.map(offer => <li key={offer.id} className="flex min-w-0 flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-bg-secondary p-4">
      <div className="min-w-0 flex-1 basis-52 break-words [overflow-wrap:anywhere]">
        <p className="text-xs font-semibold text-gold">{t("kinds." + offer.kind)} · {t("status")}</p>
        <h2 className="mt-2 text-base font-semibold text-text-primary">{offer.title || t("untitled")}</h2>
        <p className="mt-2 text-sm text-text-secondary">{t("startedBy", { name: offer.accountName })}</p>
        <p className="mt-1 text-xs text-text-muted">{offer.updatedAt ? t("savedAt", { date: format.dateTime(new Date(offer.updatedAt), { dateStyle: "medium", timeStyle: "short" }) }) : t("noDate")}</p>
        <p className="mt-1 font-mono text-[10px] text-text-muted">{offer.userId}</p>
      </div>
      <SupportMessageAction targetType="started_offer" targetId={offer.id} label={t("remind")} />
    </li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
      <p>{t("page", { page: offsets.length })}</p><div className="flex gap-2"><button type="button" disabled={loading || offsets.length <= 1} onClick={() => setOffsets(previous => previous.slice(0, -1))} aria-label={t("previous")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" disabled={loading || !!error || result?.nextOffset == null} onClick={() => { if (result?.nextOffset != null) setOffsets(previous => [...previous, result.nextOffset!]); }} aria-label={t("next")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button></div>
    </div>
  </div>;
}
