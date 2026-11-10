"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { CheckCircle2, Clock3, Loader2, RefreshCw } from "lucide-react";

type FreshnessState = {
  version: number;
  cycle: number;
  status: string;
  due_at: string | null;
  reminder_sent_at: string | null;
  followup_sent_at: string | null;
  response_deadline_at: string | null;
  confirmed_at?: string | null;
};
type StatusPayload = {
  listing: { id: string; title: string; type: string; href: string | null; published: boolean };
  state: FreshnessState | null;
  canRenew: boolean;
  canEnd: boolean;
};
type Action = "renew" | "end";
type Problem = "loadError" | "unavailable" | "signInRequired" | "saveError" | "conflict";

const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:cursor-not-allowed disabled:opacity-50";

export default function ListingFreshnessStatus({ listingId, initialAction }: { listingId: string; initialAction?: Action }) {
  const t = useTranslations("ListingFreshness");
  const format = useFormatter();
  const locale = useLocale();
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Action | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; requestId: string; locale: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const endpoint = `/api/listing-freshness/${encodeURIComponent(listingId)}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok || !data?.listing) {
        setPayload(null);
        setProblem(response.status === 401 ? "signInRequired" : [403, 404].includes(response.status) ? "unavailable" : "loadError");
        return;
      }
      setPayload(data as StatusPayload);
    }).catch(() => {
      if (!controller.signal.aborted) { setPayload(null); setProblem("loadError"); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, refresh]);

  useEffect(() => {
    if (!confirmEnd) return;
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    cancel.current?.focus();
    return () => { if (element.open) element.close(); };
  }, [confirmEnd]);

  async function respond(action: Action) {
    if (!payload?.state || loading || pending.current || problem === "conflict") return;
    if (action === "renew" ? !payload.canRenew : !payload.canEnd) return;
    pending.current = true;
    setBusy(true);
    setProblem(null);
    setSuccess(null);
    const version = payload.state.version;
    const cycle = payload.state.cycle;
    const key = JSON.stringify([listingId, version, cycle, action]);
    if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID(), locale };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version, cycle, requestId: attempt.current.requestId, locale: attempt.current.locale }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        setProblem(response.status === 409 ? "conflict" : response.status === 401 ? "signInRequired" : [403, 404].includes(response.status) ? "unavailable" : "saveError");
        if ([401, 403, 404].includes(response.status)) { setPayload(null); setConfirmEnd(false); }
        return;
      }
      attempt.current = null;
      setSuccess(action);
      setConfirmEnd(false);
      setPayload(current => current ? { ...current, state: data.state ?? null } : null);
      setLoading(true);
      setRefresh(value => value + 1);
    } catch { setProblem("saveError"); }
    finally { pending.current = false; setBusy(false); }
  }

  function date(value: string | null | undefined) {
    if (!value) return t("notAvailable");
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? format.dateTime(parsed, { dateStyle: "medium", timeStyle: "short" }) : t("notAvailable");
  }

  const title = payload?.listing.title || t("untitled");
  const state = payload?.state;
  const statusKey = state?.status && t.has(`statuses.${state.status}`) ? `statuses.${state.status}` : "unknownStatus";
  const disabled = loading || busy || problem === "conflict";
  return <main className="site-container min-h-screen pb-32 pt-24 sm:pt-28">
    <section className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-border bg-bg-secondary p-5 sm:p-8">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><Clock3 size={21} aria-hidden="true" /></span>
        <div className="min-w-0"><h1 className="font-display text-2xl font-semibold text-text-primary">{t("title")}</h1><p className="mt-2 text-sm leading-6 text-text-secondary">{t("intro")}</p></div>
      </header>
      {success && <p role="status" className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success"><CheckCircle2 size={19} className="shrink-0" aria-hidden="true" />{t(success === "renew" ? "renewSuccess" : "endSuccess")}</p>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={17} className="animate-spin" aria-hidden="true" />{t("loading")}</p>}
      {problem && <div role="alert" className="space-y-3 rounded-xl border border-crimson/30 bg-crimson/10 p-4 text-sm text-red-400">
        <p>{t(problem)}</p>
        {problem === "unavailable" && <p className="leading-6">{t("unavailableBody")}</p>}
        {problem === "signInRequired" ? <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/listing-status/${encodeURIComponent(listingId)}${initialAction ? `?action=${initialAction}` : ""}`)}`} className={`${actionClass} border border-border text-text-primary`}>{t("signIn")}</Link> : ["loadError", "conflict"].includes(problem) && <button type="button" disabled={busy} onClick={() => { setConfirmEnd(false); setLoading(true); setProblem(null); setRefresh(value => value + 1); }} className={`${actionClass} border border-border text-text-primary`}><RefreshCw size={16} aria-hidden="true" />{t("retry")}</button>}
      </div>}
      {payload && <>
        <div className="rounded-xl border border-border bg-bg-primary p-4 sm:p-5">
          <h2 className="break-words text-lg font-semibold text-text-primary [overflow-wrap:anywhere]">{title}</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-text-muted">{t("statusLabel")}</dt><dd className="mt-1 font-medium text-text-primary">{state ? t(statusKey) : t("notEnrolled")}</dd></div>
            {state?.confirmed_at && <div><dt className="text-text-muted">{t("lastConfirmed")}</dt><dd className="mt-1 text-text-primary">{date(state.confirmed_at)}</dd></div>}
            {state?.response_deadline_at && <div><dt className="text-text-muted">{t("deadlineLabel")}</dt><dd className="mt-1 font-medium text-gold">{date(state.response_deadline_at)}</dd></div>}
            {state?.due_at && <div><dt className="text-text-muted">{t("nextCheck")}</dt><dd className="mt-1 text-text-primary">{date(state.due_at)}</dd></div>}
          </dl>
        </div>
        <p className="text-sm leading-6 text-text-muted">{t("readOnlyNotice")}</p>
        {initialAction && <p className="text-sm leading-6 text-text-secondary">{t(initialAction === "end" ? "selectedEnd" : "selectedRenew")}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {payload.canRenew && <button type="button" disabled={disabled} onClick={() => void respond("renew")} className={`${actionClass} bg-gold text-bg-primary ${initialAction === "renew" ? "ring-2 ring-gold/40 ring-offset-2 ring-offset-bg-secondary" : ""}`}>{busy ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{busy ? t("saving") : t("renew")}</button>}
          {payload.canEnd && <button type="button" disabled={disabled} onClick={() => setConfirmEnd(true)} className={`${actionClass} border border-border text-text-primary ${initialAction === "end" ? "ring-2 ring-gold/40" : ""}`}>{t("end")}</button>}
        </div>
        {state && !payload.canRenew && !payload.canEnd && <p className="text-sm text-text-muted">{t("noAction")}</p>}
      </>}
      <footer className="border-t border-border pt-4"><Link href="/dashboard?tab=listings" className="inline-flex min-h-11 items-center text-sm font-medium text-gold hover:underline">{t("backDashboard")}</Link></footer>
    </section>
    {confirmEnd && <dialog ref={dialog} aria-labelledby="listing-end-title" aria-describedby="listing-end-description" onClose={event => { if (!event.currentTarget.open) setConfirmEnd(false); }} onCancel={event => { if (busy) event.preventDefault(); }} className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-bg-secondary p-5 text-text-primary shadow-2xl backdrop:bg-black/75 sm:p-7">
      <h2 id="listing-end-title" className="break-words text-xl font-semibold [overflow-wrap:anywhere]">{t("confirmEndTitle", { title })}</h2>
      <p id="listing-end-description" className="mt-3 text-sm leading-6 text-text-secondary">{t("confirmEndBody")}</p>
      {problem && <p role="alert" className="mt-4 text-sm text-red-400">{t(problem)}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" disabled={disabled} onClick={() => void respond("end")} className={`${actionClass} border border-crimson/40 bg-crimson/10 text-red-400`}>{busy ? t("saving") : t("confirmEnd")}</button>
        <button ref={cancel} type="button" disabled={busy} onClick={() => setConfirmEnd(false)} className={`${actionClass} border border-border text-text-primary`}>{t("cancel")}</button>
      </div>
    </dialog>}
  </main>;
}
