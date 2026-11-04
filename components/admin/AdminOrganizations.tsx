"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Building2, CalendarDays, ExternalLink, RefreshCw, Search } from "lucide-react";
import MediaImage from "@/components/MediaImage";

type ModerationStatus = "draft" | "submitted" | "approved" | "changes_requested" | "rejected" | "hidden" | "ended";

type OrganizationItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo_url: string | null;
  topics: string[];
  city: string | null;
  region: string | null;
  website_url: string | null;
  public_contact_email: string | null;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  responsible_user_id: string;
  responsible_person: Record<string, unknown> | null;
  submitted_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type EntryItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  entry_type: "news" | "workshop" | "training" | "event";
  topic: string;
  format: string;
  city: string | null;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  registration_url: string | null;
  external_url: string | null;
  image_url: string | null;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  submitted_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  organization: { id: string; slug: string; name: string; moderation_status: ModerationStatus } | null;
};

type Payload = { organizations: OrganizationItem[]; entries: EntryItem[] };
type ItemKind = "organization" | "entry";

async function loadJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body as T;
}

function statusTone(status: ModerationStatus) {
  if (status === "approved") return "border-success/30 bg-success/10 text-success";
  if (status === "submitted") return "border-gold/30 bg-gold/10 text-gold";
  if (status === "rejected" || status === "hidden") return "border-crimson/30 bg-crimson/10 text-crimson-light";
  return "border-border bg-bg-elevated text-text-muted";
}

function adminMediaUrl(reference: string | null | undefined) {
  return reference ? `/api/admin/organizations/media?reference=${encodeURIComponent(reference)}` : null;
}

function responsibleName(value: Record<string, unknown> | null) {
  if (!value) return "";
  const firstName = typeof value.firstName === "string" ? value.firstName.trim() : "";
  const lastName = typeof value.lastName === "string" ? value.lastName.trim() : "";
  const profileName = typeof value.profileName === "string" ? value.profileName.trim() : "";
  return [firstName, lastName].filter(Boolean).join(" ") || profileName;
}

export function AdminOrganizations() {
  const t = useTranslations("AdminOrganizations");
  const locale = useLocale();
  const pendingLoad = useRef<AbortController | null>(null);
  const organizationText = useTranslations("Organizations");
  const ot = (key: string) => organizationText(key as Parameters<typeof organizationText>[0]);
  const [payload, setPayload] = useState<Payload>({ organizations: [], entries: [] });
  const [search, setSearch] = useState("");
  const [submittedOnly, setSubmittedOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    pendingLoad.current?.abort();
    const controller = new AbortController();
    pendingLoad.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ submittedOnly: String(submittedOnly) });
      if (search.trim()) params.set("search", search.trim());
      setPayload(await loadJson<Payload>(`/api/admin/organizations?${params}`, { signal: controller.signal }));
    } catch (loadError) {
      if (!controller.signal.aborted) setError(t("loadError"));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [search, submittedOnly, t]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => { window.clearTimeout(timer); pendingLoad.current?.abort(); };
  }, [load]);

  async function changeStatus(kind: ItemKind, id: string, status: ModerationStatus) {
    const item = (kind === "organization" ? payload.organizations : payload.entries).find(item => item.id === id);
    if (!item || acting) return;
    if (status === "approved" && !window.confirm(t("approveConfirm"))) return;
    const reason = status === "approved" ? "" : window.prompt(t("reasonPrompt"));
    if (reason === null) return;
    if (status !== "approved" && reason.trim().length < 5) {
      window.alert(t("reasonShort"));
      return;
    }
    setActing(`${kind}:${id}`);
    setMessage(null);
    try {
      await loadJson("/api/admin/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, status, reason: reason.trim(), reviewed: status === "approved", expectedUpdatedAt: item.updated_at }),
      });
      setMessage(t("saved"));
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error && actionError.message === "conflict" ? t("conflict") : actionError instanceof Error && actionError.message === "parent_required" ? t("parentRequired") : t("saveError"));
    } finally {
      setActing(null);
    }
  }

  const actionButtons = (kind: ItemKind, id: string, status: ModerationStatus) => {
    const disabled = acting === `${kind}:${id}`;
    return (
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && <button disabled={disabled} onClick={() => changeStatus(kind, id, "approved")} className="rounded-lg border border-success/30 px-3 py-2 text-xs font-semibold text-success disabled:opacity-50">{t("approve")}</button>}
        <button disabled={disabled} onClick={() => changeStatus(kind, id, "changes_requested")} className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold disabled:opacity-50">{t("requestChanges")}</button>
        <button disabled={disabled} onClick={() => changeStatus(kind, id, "rejected")} className="rounded-lg border border-crimson/30 px-3 py-2 text-xs font-semibold text-crimson-light disabled:opacity-50">{t("reject")}</button>
        {status !== "hidden" && <button disabled={disabled} onClick={() => changeStatus(kind, id, "hidden")} className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted disabled:opacity-50">{t("hide")}</button>}
        {kind === "entry" && status === "approved" && <button disabled={disabled} onClick={() => changeStatus(kind, id, "ended")} className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted disabled:opacity-50">{t("end")}</button>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">
        {t("description")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted" />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 text-sm text-text-secondary">
          <input type="checkbox" checked={submittedOnly} onChange={(event) => setSubmittedOnly(event.target.checked)} className="accent-gold" />
          {t("submittedOnly")}
        </label>
        <button onClick={load} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm text-text-secondary"><RefreshCw size={14} />{t("refresh")}</button>
      </div>
      {error && <div role="alert" className="rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson-light">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{message}</div>}
      {loading && <p className="py-8 text-center text-sm text-text-muted">{t("loading")}</p>}

      {!loading && <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-text-primary"><Building2 size={17} />{t("organizations")} <span className="text-sm font-normal text-text-muted">({payload.organizations.length})</span></h2>
        {!payload.organizations.length ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">{t("empty")}</p> : payload.organizations.map((organization) => (
          <article key={organization.id} className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-start">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-bg-primary">
                {adminMediaUrl(organization.logo_url) ? <MediaImage src={adminMediaUrl(organization.logo_url)!} alt={t("logoAlt")} fill sizes="112px" className="object-contain p-2" /> : <Building2 className="absolute inset-0 m-auto text-text-muted" size={30} />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-text-primary">{organization.name}</h3><span className={`rounded-full border px-2 py-1 text-[11px] ${statusTone(organization.moderation_status)}`}>{ot(`status.${organization.moderation_status}`)}</span></div>
                <p className="mt-1 text-xs text-text-muted">{[organization.city, organization.region].filter(Boolean).join(" · ") || t("noLocation")}</p>
                {organization.topics?.length > 0 && <p className="mt-2 text-xs text-text-secondary">{organization.topics.map((topic) => ot(`topic.${topic}`)).join(" · ")}</p>}
                {organization.description && <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("descriptionLabel")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{organization.description}</p></div>}
                <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs text-text-secondary sm:grid-cols-2">
                  <div><dt className="font-semibold text-text-muted">{t("responsiblePerson")}</dt><dd className="mt-0.5 break-all">{responsibleName(organization.responsible_person) || t("notProvided")} · {organization.responsible_user_id}</dd></div>
                  {organization.website_url && <div><dt className="font-semibold text-text-muted">{t("website")}</dt><dd className="mt-0.5"><a href={organization.website_url} target="_blank" rel="noreferrer" className="break-all text-gold">{organization.website_url}</a></dd></div>}
                  {organization.public_contact_email && <div><dt className="font-semibold text-text-muted">{t("publicEmail")}</dt><dd className="mt-0.5 break-all">{organization.public_contact_email}</dd></div>}
                </dl>
                {organization.moderation_reason && <p className="mt-2 text-xs text-gold">{organization.moderation_reason}</p>}
              </div>
              <div>{organization.moderation_status === "approved" && <Link href={`/organizations/${organization.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-gold">{t("openPublic")}<ExternalLink size={12} /></Link>}</div>
            </div>
            <div className="mt-4">{actionButtons("organization", organization.id, organization.moderation_status)}</div>
          </article>
        ))}
      </section>}

      {!loading && <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-text-primary"><CalendarDays size={17} />{t("entries")} <span className="text-sm font-normal text-text-muted">({payload.entries.length})</span></h2>
        {!payload.entries.length ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">{t("empty")}</p> : payload.entries.map((entry) => (
          <article key={entry.id} className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-start">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-bg-primary">
                {adminMediaUrl(entry.image_url) ? <MediaImage src={adminMediaUrl(entry.image_url)!} alt={t("imageAlt")} fill sizes="176px" className="object-cover" /> : <CalendarDays className="absolute inset-0 m-auto text-text-muted" size={30} />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-text-primary">{entry.title}</h3><span className={`rounded-full border px-2 py-1 text-[11px] ${statusTone(entry.moderation_status)}`}>{ot(`status.${entry.moderation_status}`)}</span></div>
                <p className="mt-1 text-xs text-text-muted">{ot(`entryType.${entry.entry_type}`)} · {entry.organization?.name ?? t("missingOrganization")}{entry.topic ? ` · ${ot(`topic.${entry.topic}`)}` : ""} · {ot(`format.${entry.format}`)}</p>
                {(entry.summary || entry.description) && <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("descriptionLabel")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{entry.summary || entry.description}</p>{entry.summary && entry.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{entry.description}</p>}</div>}
                <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs text-text-secondary sm:grid-cols-2">
                  <div><dt className="font-semibold text-text-muted">{t("venueLabel")}</dt><dd className="mt-0.5">{[entry.venue, entry.city].filter(Boolean).join(" · ") || t("noLocation")}</dd></div>
                  {entry.starts_at && <div><dt className="font-semibold text-text-muted">{ot("startsAt")}</dt><dd className="mt-0.5">{new Date(entry.starts_at).toLocaleString(locale)}{entry.ends_at ? ` – ${new Date(entry.ends_at).toLocaleString(locale)}` : ""}</dd></div>}
                  {entry.registration_url && <div><dt className="font-semibold text-text-muted">{t("registration")}</dt><dd className="mt-0.5"><a href={entry.registration_url} target="_blank" rel="noreferrer" className="break-all text-gold">{entry.registration_url}</a></dd></div>}
                  {entry.external_url && <div><dt className="font-semibold text-text-muted">{t("externalDetails")}</dt><dd className="mt-0.5"><a href={entry.external_url} target="_blank" rel="noreferrer" className="break-all text-gold">{entry.external_url}</a></dd></div>}
                </dl>
                {entry.moderation_reason && <p className="mt-2 text-xs text-gold">{entry.moderation_reason}</p>}
              </div>
              <div>{entry.moderation_status === "approved" && entry.organization && <Link href={`/news/${entry.organization.slug}/${entry.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-gold">{t("openPublic")}<ExternalLink size={12} /></Link>}</div>
            </div>
            <div className="mt-4">{actionButtons("entry", entry.id, entry.moderation_status)}</div>
          </article>
        ))}
      </section>}
    </div>
  );
}
