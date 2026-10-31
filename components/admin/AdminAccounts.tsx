"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Users } from "lucide-react";
import Image from "@/components/MediaImage";
import { SupportMessageAction } from "./SupportMessageAction";
import AdminReviewLink from "./AdminReviewLink";
import type { adminAccountRow } from "@/lib/admin-account-status";
import type { AccountContent } from "@/lib/admin-account-content";
import { reviewPath } from "@/lib/admin-review";
import Link from "next/link";

type Account = ReturnType<typeof adminAccountRow> & { content: AccountContent };

function AccountContents({ content }: { content: AccountContent }) {
  const t = useTranslations("AdminAccounts");
  const moderation = useTranslations("OfferModeration");
  const drafts = useTranslations("AdminStartedOffers");
  const actionClass = "inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold";
  const kinds = new Set(["location", "prop", "vehicle", "job", "creator", "service", "animal"]);
  if (!content.companies.length && !content.listings.length && !content.drafts.length) return <p className="text-xs text-text-muted">{t("contentEmpty")}</p>;
  return <div className="min-w-0 space-y-4">
    {content.companies.length > 0 && <section aria-label={t("ownedCompanies")}><h3 className="text-xs font-semibold text-text-secondary">{t("ownedCompanies")} ({content.companies.length})</h3><ul className="mt-2 space-y-2">{content.companies.map(company => <li key={company.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0 flex-1 basis-40 break-words [overflow-wrap:anywhere]"><p className="text-sm text-text-primary">{company.title || drafts("untitled")}</p><p className={`mt-1 text-xs ${company.published ? "text-success" : "text-text-muted"}`}>{t(company.published ? "contentPublic" : "contentPrivate")}</p></div><div className="flex flex-wrap gap-2"><Link href={reviewPath("company", company.id)} prefetch={false} className={actionClass}>{t(company.published ? "manageContent" : "reviewAndPublish")}</Link><SupportMessageAction targetType="company" targetId={company.id} /></div></li>)}</ul></section>}
    {content.listings.length > 0 && <section aria-label={t("createdListings")}><h3 className="text-xs font-semibold text-text-secondary">{t("createdListings")} ({content.listings.length})</h3><p className="mt-1 text-xs text-text-muted">{t("creatorNotice")}</p><ul className="mt-2 space-y-2">{content.listings.map(listing => <li key={listing.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0 flex-1 basis-40 break-words [overflow-wrap:anywhere]"><p className="text-sm text-text-primary">{listing.title || drafts("untitled")}</p><p className="mt-1 text-xs text-text-muted">{t("contentKinds." + (kinds.has(listing.type) ? listing.type : "other"))} · {listing.status === "draft" && !listing.published ? t("notSubmitted") : `${t(listing.published ? "contentPublic" : "contentPrivate")} · ${moderation("statuses." + listing.status)}`}</p></div><div className="flex flex-wrap gap-2"><Link href={reviewPath("listing", listing.id)} prefetch={false} className={actionClass}>{t(listing.published ? "manageContent" : "reviewAndPublish")}</Link><SupportMessageAction targetType="listing" targetId={listing.id} label={listing.status === "draft" && !listing.published ? t("remindSubmission") : undefined} preferredTemplate={listing.status === "draft" && !listing.published ? "resume_draft" : undefined} /></div></li>)}</ul></section>}
    {content.drafts.length > 0 && <section aria-label={t("privateDrafts")}><h3 className="text-xs font-semibold text-text-secondary">{t("privateDrafts")} ({content.drafts.length})</h3><p className="mt-1 text-xs text-text-muted">{t("draftNotice")}</p><ul className="mt-2 space-y-2">{content.drafts.map(draft => <li key={draft.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0 flex-1 basis-40 break-words [overflow-wrap:anywhere]"><p className="text-sm text-text-primary">{draft.title || drafts("untitled")}</p><p className="mt-1 text-xs text-text-muted">{drafts("kinds." + draft.kind)} · {drafts("status")}</p></div><SupportMessageAction targetType="started_offer" targetId={draft.id} label={drafts("remind")} /></li>)}</ul></section>}
  </div>;
}
export function AdminAccounts() {
  const t = useTranslations("AdminAccounts");
  const format = useFormatter();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ accounts: Account[]; total: number; pageSize: number } | null>(null);
  const [finishedRequest, setFinishedRequest] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestKey = JSON.stringify([search, page, refresh, locale]);
  const loading = finishedRequest !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/accounts?" + new URLSearchParams({ search, page: String(page) }), { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("loadError"));
        if (!controller.signal.aborted) { setResult(data); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("loadError"));
      } finally { if (!controller.signal.aborted) setFinishedRequest(requestKey); }
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page, refresh, requestKey, t]);
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 50)));
  return <div className="space-y-4">
    <p className="rounded-xl border border-border bg-bg-elevated p-4 text-sm leading-6 text-text-secondary">{t("explanation")}</p>
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative w-full max-w-md"><span className="sr-only">{t("search")}</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={t("search")} className="min-h-11 w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary" /></label>
      {result && !loading && <span className="text-sm text-text-muted">{t("count", { count: result.total })}</span>}
      <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary disabled:opacity-50"><RefreshCw size={14} />{t("refresh")}</button>
    </div>
    {loading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" />{t("loading")}</p> : error ? <p role="alert" className="rounded-xl border border-crimson/30 p-4 text-sm text-crimson-light">{error}</p> : !result?.accounts.length ? <p className="py-10 text-center text-sm text-text-muted">{t("empty")}</p> : <ul className="space-y-2">{result.accounts.map(account => <li key={account.userId} className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-border bg-bg-secondary p-4">
      {account.avatarUrl ? <Image src={account.avatarUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated"><Users size={16} className="text-text-muted" /></div>}
      <div className="min-w-0 flex-1 basis-48 break-words [overflow-wrap:anywhere]">
        <p className="text-sm font-medium text-text-primary">{account.name || t("unnamed")}</p>
        <p className="mt-1 text-xs text-text-muted">{account.email || t("noEmail")}</p>
        <p className="mt-2 text-xs text-text-secondary">{account.purposes.length ? account.purposes.map(purpose => t("purposes." + purpose)).join(" · ") : t("accountOnly")} · <span className={account.needsSetup ? "text-gold" : "text-success"}>{t(account.needsSetup ? "needsSetup" : account.accountKind === "provider" ? "providerReady" : "setupComplete")}</span></p>
        {(account.profileStatus !== "missing" || account.purposes.some(purpose => purpose === "crew" || purpose === "talent")) && <p className="mt-1 text-xs text-text-muted">{t("profileStatus." + account.profileStatus)}</p>}
        <p className="mt-2 text-xs text-text-muted">{t("registered", { date: format.dateTime(account.createdAt, { dateStyle: "medium" }) })}</p>
        <p className="mt-1 font-mono text-[10px] text-text-muted">{account.userId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {account.profileStatus !== "missing" && <AdminReviewLink kind="profile" id={account.userId} />}{account.profileUrl && <a href={account.profileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs text-text-secondary hover:text-gold">{t("openProfile")}</a>}
        <SupportMessageAction targetType="profile" targetId={account.userId} />
      </div>
      <div className="min-w-0 w-full basis-full border-t border-border pt-3">
        {account.profileStatus === "missing" && !account.purposes.some(purpose => purpose === "crew" || purpose === "talent") && <p className="mb-3 text-xs leading-5 text-text-muted">{t("nonPersonalSetupNotice")}</p>}
        <AccountContents content={account.content} />
      </div>
    </li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
      <p>{t("page", { page, pages })}</p><div className="flex gap-2"><button type="button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)} aria-label={t("previous")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)} aria-label={t("next")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button></div>
    </div>
  </div>;
}
