"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Users } from "lucide-react";
import Image from "@/components/MediaImage";
import { SupportMessageAction } from "./SupportMessageAction";
import AdminReviewLink from "./AdminReviewLink";
import type { adminAccountRow } from "@/lib/admin-account-status";
import { ACCOUNT_AREAS, readAccountDirectory, selectDirectoryAccounts, type DirectoryAccount } from "@/lib/admin-account-directory";
import { useViewState } from "@/lib/use-view-state";
import type { AccountContent } from "@/lib/admin-account-content";
import { reviewPath } from "@/lib/admin-review";
import Link from "next/link";

type Account = ReturnType<typeof adminAccountRow> & { content: AccountContent };

function AccountContents({ content }: { content: AccountContent }) {
  const uiText = useTranslations();

  const t = useTranslations("AdminAccounts");
  const moderation = useTranslations("OfferModeration");
  const drafts = useTranslations("AdminStartedOffers");
  const actionClass = "inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold";
  const kinds = new Set(["location", "prop", "vehicle", "job", "creator", "service", "animal"]);
  if (!content.companies.length && !content.listings.length && !content.drafts.length) return <p className="text-xs text-text-muted">{t("contentEmpty")}</p>;
  return <div className="min-w-0 space-y-4">
    {content.companies.length > 0 && <section aria-label={t("ownedCompanies")}><h3 className="text-xs font-semibold text-text-secondary">{t("ownedCompanies")} ({content.companies.length})</h3><ul className="mt-2 space-y-2">{content.companies.map(company => <li key={company.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0 flex-1 basis-40 break-words [overflow-wrap:anywhere]"><p className="text-sm text-text-primary">{company.title || drafts("untitled")}</p><p className={`mt-1 text-xs ${company.published ? "text-success" : "text-text-muted"}`}>{t(company.published ? "contentPublic" : "contentPrivate")}</p></div><div className="flex flex-wrap gap-2"><Link href={reviewPath("company", company.id)} prefetch={false} className={actionClass}>{t(company.published ? "manageContent" : "reviewAndPublish")}</Link><SupportMessageAction targetType="company" targetId={company.id} /></div></li>)}</ul></section>}
    {content.listings.length > 0 && <section aria-label={t("createdListings")}><h3 className="text-xs font-semibold text-text-secondary">{t("createdListings")} ({content.listings.length})</h3><p className="mt-1 text-xs text-text-muted">{t("creatorNotice")}</p><ul className="mt-2 space-y-2">{content.listings.map(listing => <li key={listing.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0 flex-1 basis-40 break-words [overflow-wrap:anywhere]"><p className="text-sm text-text-primary">{listing.title || drafts("untitled")}</p><p className="mt-1 text-xs text-text-muted">{t("contentKinds." + (kinds.has(listing.type) ? listing.type : "other"))} · {listing.status === "draft" && !listing.published ? t("notSubmitted") : uiText("Ui.text_7c639bc99b8569", { value1: String(t(listing.published ? "contentPublic" : "contentPrivate")), value2: String(moderation("statuses." + listing.status)) })}</p></div><div className="flex flex-wrap gap-2"><Link href={reviewPath("listing", listing.id)} prefetch={false} className={actionClass}>{t(listing.published ? "manageContent" : "reviewAndPublish")}</Link><SupportMessageAction targetType="listing" targetId={listing.id} label={listing.status === "draft" && !listing.published ? t("remindSubmission") : undefined} preferredTemplate={listing.status === "draft" && !listing.published ? "resume_draft" : undefined} /></div></li>)}</ul></section>}
    {content.drafts.length > 0 && <section aria-label={t("privateDrafts")}><h3 className="text-xs font-semibold text-text-secondary">{t("privateDrafts")} ({content.drafts.length})</h3><p className="mt-1 text-xs text-text-muted">{t("draftNotice")}</p><ul className="mt-2 space-y-2">{content.drafts.map(draft => <li key={draft.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"><div className="min-w-0 flex-1 basis-40 break-words [overflow-wrap:anywhere]"><p className="text-sm text-text-primary">{draft.title || drafts("untitled")}</p><p className="mt-1 text-xs text-text-muted">{drafts("kinds." + draft.kind)} · {drafts("status")}</p></div><SupportMessageAction targetType="started_offer" targetId={draft.id} label={drafts("remind")} /></li>)}</ul></section>}
  </div>;
}
function AccountDetails({ userId }: { userId: string }) {
  const t = useTranslations("AdminAccounts");
  const layout = useTranslations("AdminClarity");
  const [result, setResult] = useState<Account | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    fetch("/api/admin/accounts?" + new URLSearchParams({ search: userId }), { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("details_failed");
        const data = await response.json();
        const account = data.accounts?.find((item: Account) => item.userId === userId);
        if (!account?.content) throw new Error("details_missing");
        if (active) { setResult(account); setError(false); }
      }).catch(() => { if (active) setError(true); }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [userId, retry]);
  const format = useFormatter();
  if (error) return <div role="alert" className="space-y-2 text-sm text-crimson-light"><p>{t("loadError")}</p><button type="button" className="min-h-11 rounded-lg border border-border px-3" onClick={() => { setError(false); setResult(null); setRetry(value => value + 1); }}>{t("refresh")}</button></div>;
  if (!result) return <p role="status" className="py-3 text-sm text-text-muted">{t("loading")}</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      {result.profileStatus !== "missing" && <AdminReviewLink kind="profile" id={userId} />}
      {result.profileUrl && <a href={result.profileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs text-text-secondary hover:text-gold">{t("openProfile")}</a>}
      <SupportMessageAction targetType="profile" targetId={userId} />
    </div>
    <p className="text-xs text-text-muted">{layout("lastActive")}: {result.lastSignInAt ? format.dateTime(result.lastSignInAt, { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
    <p className="break-all font-mono text-[10px] text-text-muted">{userId}</p>
    {(result.profileStatus !== "missing" || result.purposes.some(p => p === "crew" || p === "talent")) && <p className="text-xs text-text-muted">{t("profileStatus." + result.profileStatus)}</p>}
    {result.profileStatus === "missing" && !result.purposes.some(p => p === "crew" || p === "talent") && <p className="text-xs text-text-muted">{t("nonPersonalSetupNotice")}</p>}
    <AccountContents content={result.content} />
  </div>;
}

const PAGE_SIZE = 25;
export function AdminAccounts() {
  const t = useTranslations("AdminAccounts");
  const layout = useTranslations("AdminClarity");
  const format = useFormatter();
  const locale = useLocale();
  const [search, setSearch] = useViewState("admin.accountsSearch", "");
  const [area, setArea] = useViewState("admin.accountsArea", "all");
  const [setup, setSetup] = useViewState("admin.accountsSetup", "all");
  const [sort, setSort] = useViewState("admin.accountsSort", "newest");
  const [page, setPage] = useViewState("admin.accountsPage", 1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ accounts: DirectoryAccount[]; refresh: number } | null>(null);
  const [finishedRequest, setFinishedRequest] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const loading = finishedRequest !== refresh;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    readAccountDirectory(async currentPage => {
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch("/api/admin/account-directory?page=" + currentPage, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("directory_read_failed");
        return await response.json();
      } finally { clearTimeout(timeout); }
    }).then(accounts => {
      if (active) { setResult({ accounts, refresh }); setError(""); }
    }).catch(() => { if (active) setError(t("loadError")); })
      .finally(() => { if (active) setFinishedRequest(refresh); });
    return () => { active = false; controller.abort(); };
  }, [refresh, t]);
  const accounts = useMemo(() => selectDirectoryAccounts(result?.accounts ?? [], { search, area, setup, sort, locale }), [result, search, area, setup, sort, locale]);
  const pages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pages);
  const change = (set: (value: string) => void, value: string) => { set(value); setPage(1); setExpanded(null); };
  const inputClass = "min-h-11 w-full rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary";
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-text-secondary">{layout("accountIntro")}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={layout("area")}>
      {["all", ...ACCOUNT_AREAS].map(value => <button type="button" key={value} aria-pressed={area === value} onClick={() => change(setArea, value)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm ${area === value ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:text-text-primary"}`}>{layout("areas." + value)}</button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_12rem_12rem_auto]">
      <label className="relative self-end"><span className="sr-only">{t("search")}</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={search} onChange={event => change(setSearch, event.target.value)} placeholder={t("search")} className={inputClass + " pl-9"} /></label>
      <label className="space-y-1 text-xs text-text-muted"><span>{layout("setup")}</span><select value={setup} onChange={event => change(setSetup, event.target.value)} className={inputClass}>{["all", "open", "complete"].map(value => <option key={value} value={value}>{layout("statuses." + value)}</option>)}</select></label>
      <label className="space-y-1 text-xs text-text-muted"><span>{layout("sort")}</span><select value={sort} onChange={event => change(setSort, event.target.value)} className={inputClass}>{["newest", "oldest", "name", "active"].map(value => <option key={value} value={value}>{layout("sorting." + value)}</option>)}</select></label>
      <button type="button" disabled={loading} onClick={() => { setExpanded(null); setRefresh(value => value + 1); }} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl border border-border px-3 text-sm text-text-secondary disabled:opacity-50"><RefreshCw size={14} />{t("refresh")}</button>
    </div>
    {!loading && !error && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted"><span>{t("count", { count: accounts.length })}</span>{(area !== "all" || setup !== "all" || search) && <button type="button" className="min-h-11 text-gold underline underline-offset-4" onClick={() => { setArea("all"); setSetup("all"); setSearch(""); setPage(1); setExpanded(null); }}>{layout("reset")}</button>}</div>}
    {loading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" />{t("loading")}</p> : error ? <p role="alert" className="rounded-xl border border-crimson/30 p-4 text-sm text-crimson-light">{error}</p> : !accounts.length ? <p className="py-10 text-center text-sm text-text-muted">{t("empty")}</p> : <ul className="space-y-2">{accounts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(account => <li key={account.userId} className="min-w-0 rounded-xl border border-border bg-bg-secondary">
      <button type="button" aria-expanded={expanded === account.userId} aria-controls={"account-details-" + account.userId} onClick={() => setExpanded(value => value === account.userId ? null : account.userId)} className="flex min-h-11 w-full items-center gap-3 rounded-xl p-4 text-left hover:bg-bg-elevated">
        {account.avatarUrl ? <Image src={account.avatarUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated"><Users size={16} className="text-text-muted" /></span>}
        <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">{account.name || t("unnamed")}{account.profileVerified && <BadgeCheck size={16} className="text-gold" aria-label={layout("verified")} />}</span>
          <span className="mt-1 block text-xs text-text-muted">{account.email || t("noEmail")}</span>
          <span className="mt-2 flex flex-wrap gap-2 text-xs"><span className="text-text-secondary">{account.areas.map(value => layout("areas." + value)).join(" · ")}</span><span className={account.needsSetup ? "text-gold" : "text-success"}>{layout(account.needsSetup ? "statuses.open" : "statuses.complete")}</span></span>
        </span>
        <span className="hidden text-xs text-text-muted sm:block">{t("registered", { date: format.dateTime(account.createdAt, { dateStyle: "medium" }) })}</span>
        <ChevronDown size={18} className={"shrink-0 text-text-muted transition-transform " + (expanded === account.userId ? "rotate-180" : "")} />
      </button>
      {expanded === account.userId && <div id={"account-details-" + account.userId} className="space-y-3 border-t border-border p-4"><p className="text-xs text-text-muted sm:hidden">{t("registered", { date: format.dateTime(account.createdAt, { dateStyle: "medium" }) })}</p><AccountDetails userId={account.userId} /></div>}
    </li>)}</ul>}
    {!loading && !error && accounts.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted"><p>{t("page", { page: currentPage, pages })}</p><div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); setExpanded(null); }} aria-label={t("previous")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" disabled={currentPage >= pages} onClick={() => { setPage(currentPage + 1); setExpanded(null); }} aria-label={t("next")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}
  </div>;
}
