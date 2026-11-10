"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, Save } from "lucide-react";

type Setting = { listing_type: string; enabled: boolean; initial_days: number; followup_days: number; response_days: number };
type DraftSetting = Omit<Setting, "initial_days" | "followup_days" | "response_days"> & { initial_days: string; followup_days: string; response_days: string };
type View = "status" | "events";
type Item = {
  id?: string; listing_id: string | null;
  listing?: { title: string; type: string } | null;
  status?: string; action?: string;
  confirmed_at?: string | null; due_at?: string | null; response_deadline_at?: string | null;
  created_at?: string; actor_user_id?: string | null;
  metadata?: { reason?: string } | null;
};
type Payload = { settings: Setting[]; items: Item[]; total: number; page: number; pageSize: number; schedulerEnabled: boolean };

const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-60";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-40";
const toDraft = (settings: Setting[]): DraftSetting[] => settings.map(setting => ({ listing_type: setting.listing_type, enabled: setting.enabled, initial_days: String(setting.initial_days), followup_days: String(setting.followup_days), response_days: String(setting.response_days) }));

export default function AdminListingFreshness() {
  const t = useTranslations("AdminListingFreshness");
  const freshness = useTranslations("ListingFreshness");
  const format = useFormatter();
  const [view, setView] = useState<View>("status");
  const [pages, setPages] = useState({ status: 1, events: 1 });
  const [type, setType] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data: Payload } | null>(null);
  const [settings, setSettings] = useState<DraftSetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<"saved" | "saveError" | "invalidSettings" | "reasonRequired" | "conflict" | null>(null);
  const hasEdits = useRef(false);
  const savePending = useRef(false);
  const page = pages[view];
  const params = new URLSearchParams({ view, page: String(page) });
  if (type) params.set("type", type);
  const requestKey = params.toString();
  const current = snapshot?.key === requestKey ? snapshot.data : null;
  const pageCount = Math.max(1, Math.ceil((current?.total ?? 0) / (current?.pageSize || 25)));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/listing-freshness?${requestKey}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if ([401, 403].includes(response.status)) setSettings(null);
      if (!response.ok || !Array.isArray(data?.items) || !Array.isArray(data?.settings)) throw new Error("listing_freshness_load_failed");
      setSnapshot({ key: requestKey, data });
      if (!hasEdits.current) setSettings(toDraft(data.settings));
    }).catch(() => {
      if (!controller.signal.aborted) { setSnapshot(null); setLoadError(true); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestKey, refresh]);

  function reloadRows() { setLoading(true); setLoadError(false); setRefresh(value => value + 1); }
  function changeView(value: View) { if (value !== view) { setLoading(true); setLoadError(false); setView(value); } }
  function changeType(value: string) { if (value !== type) { setLoading(true); setLoadError(false); setType(value); setPages({ status: 1, events: 1 }); } }
  function movePage(offset: number) { setLoading(true); setLoadError(false); setPages(value => ({ ...value, [view]: Math.max(1, value[view] + offset) })); }

  function edit(index: number, field: keyof DraftSetting, value: string | boolean) {
    hasEdits.current = true;
    setDirty(true);
    setResult(null);
    setSettings(currentSettings => currentSettings?.map((setting, row) => row === index ? { ...setting, [field]: value } : setting) ?? null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || savePending.current || !dirty) return;
    const values = settings.map(setting => ({ ...setting, initial_days: Number(setting.initial_days), followup_days: Number(setting.followup_days), response_days: Number(setting.response_days) }));
    if (values.some(setting => !Number.isInteger(setting.initial_days) || setting.initial_days < 1 || setting.initial_days > 3650 || [setting.followup_days, setting.response_days].some(value => !Number.isInteger(value) || value < 1 || value > 730))) { setResult("invalidSettings"); return; }
    if (reason.trim().length < 5 || reason.trim().length > 500) { setResult("reasonRequired"); return; }
    savePending.current = true;
    setSaving(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/listing-freshness", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: values, reason: reason.trim() }) });
      if (!response.ok) { setResult(response.status === 409 ? "conflict" : "saveError"); return; }
      hasEdits.current = false;
      setDirty(false);
      setReason("");
      setResult("saved");
      reloadRows();
    } catch { setResult("saveError"); }
    finally { savePending.current = false; setSaving(false); }
  }

  function date(value: string | null | undefined) {
    const parsed = value ? new Date(value) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? format.dateTime(parsed, { dateStyle: "medium", timeStyle: "short" }) : t("notAvailable");
  }
  function typeName(value?: string) { return value && freshness.has(`types.${value}`) ? freshness(`types.${value}`) : t("otherType"); }
  function statusName(value?: string) { return value && freshness.has(`statuses.${value}`) ? freshness(`statuses.${value}`) : freshness("unknownStatus"); }
  function eventName(value?: string) { return value && t.has(`events.${value}`) ? t(`events.${value}`) : t("unknownEvent"); }

  return <main className="site-container min-h-screen space-y-6 pb-32 pt-24 sm:pt-28">
    <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm text-text-secondary hover:text-gold"><ArrowLeft size={17} aria-hidden="true" />{t("backAdmin")}</Link>
    <header className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><Clock3 size={21} aria-hidden="true" /></span>
      <div className="min-w-0"><h1 className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">{t("title")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{t("intro")}</p></div>
    </header>
    {snapshot?.data.schedulerEnabled === false && <p role="status" className="rounded-xl border border-border bg-bg-secondary p-4 text-sm leading-6 text-text-muted">{t("schedulerDisabled")}</p>}

    <section className="rounded-2xl border border-border bg-bg-secondary p-4 sm:p-6" aria-labelledby="freshness-settings-title">
      <h2 id="freshness-settings-title" className="text-lg font-semibold text-text-primary">{t("settingsTitle")}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{t("settingsHelp")}</p>
      {!settings ? <p role="status" className="mt-5 text-sm text-text-muted">{t(loading ? "loading" : "loadError")}</p> : <form onSubmit={event => void save(event)} className="mt-5 space-y-5">
        <fieldset disabled={saving} className="grid min-w-0 gap-4 lg:grid-cols-2">
          <legend className="sr-only">{t("settingsTitle")}</legend>
          {settings.map((setting, index) => <div key={setting.listing_type} className="min-w-0 space-y-4 rounded-xl border border-border bg-bg-primary/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-text-primary">{typeName(setting.listing_type)}</h3><label className="flex min-h-11 items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={setting.enabled} onChange={event => edit(index, "enabled", event.target.checked)} className="h-5 w-5 accent-gold" />{t("enabled")}</label></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["initial_days", "followup_days", "response_days"] as const).map(field => <label key={field} className="min-w-0 text-xs leading-5 text-text-secondary">{t(`fields.${field}`)}<input type="number" inputMode="numeric" min={1} max={field === "initial_days" ? 3650 : 730} step={1} required value={setting[field]} onChange={event => edit(index, field, event.target.value)} className={inputClass} /></label>)}
            </div>
          </div>)}
        </fieldset>
        <label className="block max-w-3xl text-sm text-text-secondary">{t("reasonLabel")}<textarea value={reason} onChange={event => { setReason(event.target.value); setResult(null); }} minLength={5} maxLength={500} required rows={2} disabled={saving} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-text-muted">{t("reasonHelp")}</span></label>
        <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={saving || !dirty} className={`${buttonClass} border-gold/30 bg-gold text-bg-primary`}>{saving ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}{t(saving ? "saving" : "save")}</button>{dirty && <p className="text-xs text-text-muted">{t("unsaved")}</p>}</div>
        {result && <p role={result === "saved" ? "status" : "alert"} className={`text-sm ${result === "saved" ? "text-success" : "text-red-400"}`}>{t(result)}</p>}
      </form>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-border bg-bg-secondary" aria-labelledby="freshness-status-title">
      <div className="space-y-4 border-b border-border p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="freshness-status-title" className="text-lg font-semibold text-text-primary">{t("recordsTitle")}</h2><button type="button" onClick={reloadRows} disabled={loading} className={buttonClass}><RefreshCw size={16} aria-hidden="true" />{t("refresh")}</button></div>
        <p className="text-xs leading-5 text-text-muted">{t("privateNotice")}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("viewLabel")}>{(["status", "events"] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => changeView(value)} className={`${buttonClass} ${view === value ? "border-gold/40 bg-gold/10 text-gold" : ""}`}>{t(`views.${value}`)}</button>)}</div>
          <label className="text-xs text-text-muted">{t("typeFilter")}<select value={type} onChange={event => changeType(event.target.value)} className={`${inputClass} sm:min-w-56`}><option value="">{t("allTypes")}</option>{(settings ?? []).map(setting => <option key={setting.listing_type} value={setting.listing_type}>{typeName(setting.listing_type)}</option>)}</select></label>
        </div>
      </div>
      {loadError && <p role="alert" className="px-4 py-5 text-sm text-red-400 sm:px-6">{t("loadError")}</p>}
      {loading ? <p role="status" className="flex items-center gap-2 p-6 text-sm text-text-muted"><Loader2 size={17} className="animate-spin" aria-hidden="true" />{t("loading")}</p> : current?.items.length ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t(`views.${view}`)}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-bg-primary/40 text-xs text-text-muted"><tr><th scope="col" className="px-4 py-3 sm:px-6">{t("listing")}</th><th scope="col" className="px-4 py-3">{t(view === "status" ? "status" : "event")}</th><th scope="col" className="px-4 py-3">{t(view === "status" ? "lastConfirmed" : "time")}</th><th scope="col" className="px-4 py-3">{t(view === "status" ? "nextCheck" : "actor")}</th><th scope="col" className="px-4 py-3">{t(view === "status" ? "deadline" : "reasonLabel")}</th></tr></thead>
          <tbody className="divide-y divide-border">{current.items.map((item, index) => <tr key={item.id ?? `${item.listing_id}-${index}`} className="align-top">
            <td className="max-w-80 px-4 py-4 sm:px-6">{item.listing_id ? <Link href={`/admin/review/listing/${encodeURIComponent(item.listing_id)}`} className="inline-block min-h-11 break-words font-medium text-text-primary hover:text-gold [overflow-wrap:anywhere]">{item.listing?.title || freshness("untitled")}</Link> : <span className="font-medium text-text-primary">{t("settingsTitle")}</span>}{item.listing?.type && <p className="mt-1 text-xs text-text-muted">{typeName(item.listing.type)}</p>}{item.listing_id && <p className="mt-1 break-all font-mono text-[10px] text-text-muted">{item.listing_id}</p>}</td>
            <td className="px-4 py-4 text-text-secondary">{view === "status" ? statusName(item.status) : eventName(item.action)}</td>
            <td className="px-4 py-4 text-text-secondary">{date(view === "status" ? item.confirmed_at : item.created_at)}</td>
            <td className="max-w-52 break-words px-4 py-4 text-text-secondary [overflow-wrap:anywhere]">{view === "status" ? date(item.due_at) : item.actor_user_id || t("systemActor")}</td>
            <td className="max-w-64 break-words px-4 py-4 text-text-secondary [overflow-wrap:anywhere]">{view === "status" ? date(item.response_deadline_at) : item.metadata?.reason || t("notAvailable")}</td>
          </tr>)}</tbody>
        </table>
      </div> : !loadError && <p className="p-6 text-sm text-text-muted">{t("empty")}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-sm sm:px-6"><p className="text-xs text-text-muted">{t("page", { page, pages: pageCount })}{current && <span className="ml-2">{t("total", { count: current.total })}</span>}</p><div className="flex gap-2"><button type="button" disabled={loading || page <= 1} onClick={() => movePage(-1)} className={buttonClass} aria-label={t("previous")}><ChevronLeft size={17} aria-hidden="true" /><span className="hidden sm:inline">{t("previous")}</span></button><button type="button" disabled={loading || !current || page >= pageCount} onClick={() => movePage(1)} className={buttonClass} aria-label={t("next")}><ChevronRight size={17} aria-hidden="true" /><span className="hidden sm:inline">{t("next")}</span></button></div></footer>
    </section>
  </main>;
}
