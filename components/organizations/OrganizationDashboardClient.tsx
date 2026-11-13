"use client";

import { placeInputValue } from "@/lib/places/core";

import PlaceField from "@/components/PlaceField";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarDays, ExternalLink, ImagePlus, Loader2, Newspaper, Plus, Save, Trash2 } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import ResponsiblePersonFields from "@/components/ResponsiblePersonFields";
import OrganizationAccessPanel from "./OrganizationAccessPanel";
import FormDraftStatus from "@/components/FormDraftStatus";
import { useFormDraft } from "@/lib/use-form-draft";
import { ORGANIZATION_ENTRY_TYPES, ORGANIZATION_FORMATS, ORGANIZATION_TOPICS } from "@/lib/organization-taxonomy";
import { responsiblePersonDraft, type ResponsiblePerson } from "@/lib/responsible-person";

type Organization = {
  id: string; updated_at: string; slug: string; name: string; description: string; topics: string[]; city: string; region: string;
  website_url: string | null; public_contact_email: string | null; moderation_status: string; moderation_reason: string;
  responsible_person: ResponsiblePerson; logo_url: string | null;
};
type Entry = {
  id: string; updated_at: string; organization_id: string; slug: string; entry_type: string; title: string; summary: string; description: string;
  topic: string; format: string; city: string; venue: string; starts_at: string | null; ends_at: string | null;
  registration_url: string | null; external_url: string | null; image_url: string | null; moderation_status: string; moderation_reason: string;
};
type Workspace = { organizations: Organization[]; entries: Entry[] };
type OrganizationForm = { selected_place_city_id?: string; id: string; expectedUpdatedAt: string; name: string; description: string; topics: string[]; city: string; region: string; websiteUrl: string; publicContactEmail: string; logoUrl: string; responsiblePerson: ResponsiblePerson };
type EntryForm = { selected_place_city_id?: string; id: string; expectedUpdatedAt: string; organizationId: string; entryType: string; title: string; summary: string; description: string; topic: string; format: string; city: string; venue: string; startsAt: string; endsAt: string; registrationUrl: string; externalUrl: string; imageUrl: string };

const input = "min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-gold";
const emptyEntry = (organizationId = ""): EntryForm => ({ id: "", expectedUpdatedAt: "", organizationId, entryType: "news", title: "", summary: "", description: "", topic: "industry", format: "onsite", city: "", venue: "", startsAt: "", endsAt: "", registrationUrl: "", externalUrl: "", imageUrl: "" });

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function OrganizationDashboardClient({ initialWorkspace, responsiblePerson }: { initialWorkspace: Workspace; responsiblePerson: ResponsiblePerson }) {
  const uiText = useTranslations();

  const t = useTranslations("Organizations");
  const places = useTranslations("Places");
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [mode, setMode] = useState<"organization" | "entry">(initialWorkspace.organizations.length ? "entry" : "organization");
  const [organization, setOrganization] = useState<OrganizationForm>({ id: "", expectedUpdatedAt: "", name: "", description: "", topics: [], city: "", region: "", websiteUrl: "", publicContactEmail: "", logoUrl: "", responsiblePerson: responsiblePersonDraft(responsiblePerson) });
  const [entry, setEntry] = useState<EntryForm>(emptyEntry(initialWorkspace.organizations[0]?.id));
  const operationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"organization" | "entry" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const organizationDraft = useFormDraft({ formKey: `organization:${organization.id || "new"}`, value: organization, restore: setOrganization, enabled: mode === "organization", busy: busy || uploading !== null });
  const entryDraft = useFormDraft({ formKey: `organization-entry:${entry.id || "new"}`, value: entry, restore: setEntry, enabled: mode === "entry", busy: busy || uploading !== null });
  const entries = useMemo(() => workspace.entries.filter(item => !entry.organizationId || item.organization_id === entry.organizationId), [workspace.entries, entry.organizationId]);

  const leaveOrganization = (organizationId: string) => {
    // Access has already been revoked server-side. Remove the stale workspace
    // immediately, even if a subsequent network refresh would fail.
    setWorkspace(current => ({
      organizations: current.organizations.filter(item => item.id !== organizationId),
      entries: current.entries.filter(item => item.organization_id !== organizationId),
    }));
    if (entry.organizationId === organizationId) {
      void entryDraft.discard();
      setEntry(emptyEntry());
    }
    if (organization.id === organizationId) {
      void organizationDraft.discard();
      setOrganization({ id: "", expectedUpdatedAt: "", name: "", description: "", topics: [], city: "", region: "", websiteUrl: "", publicContactEmail: "", logoUrl: "", responsiblePerson: responsiblePersonDraft(responsiblePerson) });
    }
    setMode("organization");
  };

  const changeForm = async (change: () => void) => {
    if (operationPending.current || busy || uploading) return;
    operationPending.current = true;
    try {
      if (!await (mode === "organization" ? organizationDraft : entryDraft).flush()) {
        setMessage({ tone: "error", text: t("saveError") });
        return;
      }
      change();
    } finally { operationPending.current = false; }
  };
  const refresh = async () => {
    const response = await fetch("/api/organizations/workspace", { cache: "no-store" });
    if (response.ok) setWorkspace((await response.json()).workspace);
  };
  const save = async (kind: "organization" | "entry", submit: boolean) => {
    if (operationPending.current || uploading) return;
    operationPending.current = true;
    setBusy(true); setMessage(null);
    try {
      const value = kind === "organization" ? organization : entry;
      const payload = kind === "entry" ? { ...entry, startsAt: entry.startsAt ? new Date(entry.startsAt).toISOString() : "", endsAt: entry.endsAt ? new Date(entry.endsAt).toISOString() : "" } : organization;
      const response = await fetch(kind === "organization" ? "/api/organizations" : "/api/organizations/entries", {
        method: value.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, submit }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "save");
      if (kind === "organization") {
        await organizationDraft.complete();
        setOrganization(current => ({ ...current, id: result.organization.id, expectedUpdatedAt: result.organization.updated_at }));
        if (!entry.organizationId) setEntry(current => ({ ...current, organizationId: result.organization.id }));
      } else {
        await entryDraft.complete();
        setEntry(current => ({ ...current, id: result.entry.id, expectedUpdatedAt: result.entry.updated_at }));
      }
      // The write is confirmed; a failed list refresh must not report a failed save.
      await refresh().catch(() => {});
      setMessage({ tone: "ok", text: t((result.organization || result.entry).moderation_status === "submitted" ? "submitted" : "saved") });
    } catch (error) { setMessage({ tone: "error", text: t(error instanceof Error && error.message === "conflict" ? "conflict" : "saveError") }); }
    finally { operationPending.current = false; setBusy(false); }
  };
  const submit = (kind: "organization" | "entry", publish: boolean) => (event: FormEvent) => { event.preventDefault(); void save(kind, publish); };

  const uploadImage = async (kind: "organization" | "entry", file: File | null) => {
    if (!file || operationPending.current || uploading) return;
    (kind === "organization" ? organizationDraft : entryDraft).resume();
    setUploading(kind); setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.url !== "string") throw new Error("upload");
      if (kind === "organization") setOrganization(current => ({ ...current, logoUrl: result.url }));
      else setEntry(current => ({ ...current, imageUrl: result.url }));
    } catch { setMessage({ tone: "error", text: t("imageError") }); }
    finally { setUploading(null); }
  };

  const editOrganization = (item: Organization) => {
    if (mode === "organization" && organization.id === item.id) return;
    setOrganization({ id: item.id, expectedUpdatedAt: item.updated_at, name: item.name, description: item.description || "", topics: item.topics || [], city: placeInputValue(item,item.city || ""), selected_place_city_id: (item as {place_city_id?: string}).place_city_id || "", region: item.region || "", websiteUrl: item.website_url || "", publicContactEmail: item.public_contact_email || "", logoUrl: item.logo_url || "", responsiblePerson: responsiblePersonDraft(item.responsible_person) });
    setMode("organization"); setMessage(null);
  };
  const editEntry = (item: Entry) => {
    if (mode === "entry" && entry.id === item.id) return;
    setEntry({ id: item.id, expectedUpdatedAt: item.updated_at, organizationId: item.organization_id, entryType: item.entry_type, title: item.title, summary: item.summary || "", description: item.description || "", topic: item.topic, format: item.format, city: placeInputValue(item,item.city || ""), selected_place_city_id: (item as {place_city_id?: string}).place_city_id || "", venue: item.venue || "", startsAt: localDate(item.starts_at), endsAt: localDate(item.ends_at), registrationUrl: item.registration_url || "", externalUrl: item.external_url || "", imageUrl: item.image_url || "" });
    setMode("entry"); setMessage(null);
  };

  return <main className="site-container py-8 sm:py-12">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{t("dashboardEyebrow")}</p><h1 className="font-display text-4xl text-text-primary">{t("dashboardTitle")}</h1><p className="mt-2 max-w-2xl text-text-secondary">{t("dashboardDescription")}</p></div><Link href="/news" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 text-text-primary">{t("publicNews")} <ExternalLink size={16} /></Link></div>
    <div className="mb-6 flex flex-wrap gap-2"><button type="button" onClick={() => void changeForm(() => setMode("organization"))} className={`min-h-11 rounded-xl px-4 py-2 font-semibold ${mode === "organization" ? "bg-gold text-black" : "border border-border text-text-secondary"}`}>{t("organizations")}</button><button type="button" onClick={() => void changeForm(() => setMode("entry"))} disabled={!workspace.organizations.length} className={`min-h-11 rounded-xl px-4 py-2 font-semibold disabled:opacity-40 ${mode === "entry" ? "bg-gold text-black" : "border border-border text-text-secondary"}`}>{t("entries")}</button></div>
    {message && <p role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.tone === "ok" ? "border-success/30 bg-success/10 text-success" : "border-crimson/30 bg-crimson/10 text-crimson-light"}`}>{message.text}</p>}
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {mode === "organization" ? <form onInputCapture={organizationDraft.resume} onClickCapture={organizationDraft.resume} onSubmit={submit("organization", false)} className="min-w-0 space-y-5 rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
        <fieldset disabled={busy || uploading !== null} className="contents">
        <div className="flex items-center gap-2"><Newspaper className="text-gold" /><h2 className="text-xl font-semibold text-text-primary">{organization.id ? t("editOrganization") : t("createOrganization")}</h2></div>
        <label className="block text-sm text-text-primary">{t("name")} *<input className={`${input} mt-1`} required minLength={2} maxLength={140} value={organization.name} onChange={event => setOrganization({ ...organization, name: event.target.value })} /></label>
        <fieldset className="min-w-0 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm text-text-primary">{t("organizationLogo")}</legend>
          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-bg-primary">
              {organization.logoUrl ? <MediaImage src={organization.logoUrl} alt={t("logoAlt")} fill sizes="144px" className="object-contain p-2" /> : <ImagePlus className="absolute inset-0 m-auto text-text-muted" size={32} />}
            </div>
            <div className="space-y-3">
              <p className="text-xs leading-5 text-text-muted">{t("imageHelp")}</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-primary">
                  {uploading === "organization" ? <Loader2 className="animate-spin" size={17} /> : <ImagePlus size={17} />}
                  {uploading === "organization" ? t("uploadingImage") : t(organization.logoUrl ? "replaceImage" : "uploadImage")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading !== null} onChange={event => { void uploadImage("organization", event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
                </label>
                {organization.logoUrl && <button type="button" onClick={() => setOrganization(current => ({ ...current, logoUrl: "" }))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm text-crimson-light"><Trash2 size={17} />{t("removeImage")}</button>}
              </div>
            </div>
          </div>
        </fieldset>
        <label className="block text-sm text-text-primary">{t("description")}<textarea className={`${input} mt-1 min-h-36`} maxLength={5000} value={organization.description} onChange={event => setOrganization({ ...organization, description: event.target.value })} /></label>
        <fieldset><legend className="mb-2 text-sm text-text-primary">{t("topics")}</legend><div className="flex flex-wrap gap-2">{ORGANIZATION_TOPICS.map(topic => <label key={topic} className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${organization.topics.includes(topic) ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}><input type="checkbox" className="sr-only" checked={organization.topics.includes(topic)} onChange={() => setOrganization({ ...organization, topics: organization.topics.includes(topic) ? organization.topics.filter(value => value !== topic) : [...organization.topics, topic] })} />{t(`topic.${topic}`)}</label>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><PlaceField value={organization.city} onChange={(value, cityId) => setOrganization({ ...organization, city: value, selected_place_city_id: cityId || "" })} /><label className="block text-sm text-text-primary">{places("legacyArea")}<input className={`${input} mt-1`} value={organization.region} onChange={event => setOrganization({ ...organization, region: event.target.value })} /></label></div>
        <label className="block text-sm text-text-primary">{t("website")}<input type="url" className={`${input} mt-1`} value={organization.websiteUrl} onChange={event => setOrganization({ ...organization, websiteUrl: event.target.value })} /></label>
        <label className="block text-sm text-text-primary">{t("publicEmail")}<input type="email" className={`${input} mt-1`} value={organization.publicContactEmail} onChange={event => setOrganization({ ...organization, publicContactEmail: event.target.value })} /></label>
        <ResponsiblePersonFields value={organization.responsiblePerson} onChange={value => setOrganization({ ...organization, responsiblePerson: value })} company accountPrefill />
        <FormDraftStatus draft={organizationDraft} />
        <div className="flex flex-wrap gap-3"><button disabled={busy || uploading !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold text-text-primary disabled:opacity-50"><Save size={17} />{t("saveDraft")}</button><button type="button" disabled={busy || uploading !== null} onClick={() => void save("organization", true)} className="min-h-11 rounded-xl bg-gold px-4 py-2 font-semibold text-black disabled:opacity-50">{t("submitReview")}</button></div>
        </fieldset>
      </form> : <form onInputCapture={entryDraft.resume} onClickCapture={entryDraft.resume} onSubmit={submit("entry", false)} className="min-w-0 space-y-5 rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
        <fieldset disabled={busy || uploading !== null} className="contents">
        <div className="flex items-center gap-2"><CalendarDays className="text-gold" /><h2 className="text-xl font-semibold text-text-primary">{entry.id ? t("editEntry") : t("createEntry")}</h2></div>
        <label className="block text-sm text-text-primary">{t("organization")} *<select required disabled={!!entry.id} className={`${input} mt-1`} value={entry.organizationId} onChange={event => setEntry({ ...entry, organizationId: event.target.value })}><option value="">{t("choose")}</option>{workspace.organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-text-primary">{t("type")} *<select className={`${input} mt-1`} value={entry.entryType} onChange={event => setEntry({ ...entry, entryType: event.target.value })}>{ORGANIZATION_ENTRY_TYPES.map(value => <option key={value} value={value}>{t(`entryType.${value}`)}</option>)}</select></label><label className="text-sm text-text-primary">{t("topicLabel")} *<select className={`${input} mt-1`} value={entry.topic} onChange={event => setEntry({ ...entry, topic: event.target.value })}>{ORGANIZATION_TOPICS.map(value => <option key={value} value={value}>{t(`topic.${value}`)}</option>)}</select></label></div>
        <label className="block text-sm text-text-primary">{t("title")} *<input required minLength={2} maxLength={180} className={`${input} mt-1`} value={entry.title} onChange={event => setEntry({ ...entry, title: event.target.value })} /></label>
        <fieldset className="min-w-0 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm text-text-primary">{t("entryImage")}</legend>
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-bg-primary">
              {entry.imageUrl ? <MediaImage src={entry.imageUrl} alt={t("entryImageAlt")} fill sizes="192px" className="object-cover" /> : <ImagePlus className="absolute inset-0 m-auto text-text-muted" size={32} />}
            </div>
            <div className="space-y-3">
              <p className="text-xs leading-5 text-text-muted">{t("imageHelp")}</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-primary">
                  {uploading === "entry" ? <Loader2 className="animate-spin" size={17} /> : <ImagePlus size={17} />}
                  {uploading === "entry" ? t("uploadingImage") : t(entry.imageUrl ? "replaceImage" : "uploadImage")}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading !== null} onChange={event => { void uploadImage("entry", event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
                </label>
                {entry.imageUrl && <button type="button" onClick={() => setEntry(current => ({ ...current, imageUrl: "" }))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm text-crimson-light"><Trash2 size={17} />{t("removeImage")}</button>}
              </div>
            </div>
          </div>
        </fieldset>
        <label className="block text-sm text-text-primary">{t("summary")}<textarea maxLength={500} className={`${input} mt-1 min-h-24`} value={entry.summary} onChange={event => setEntry({ ...entry, summary: event.target.value })} /></label>
        <label className="block text-sm text-text-primary">{t("description")}<textarea maxLength={12000} className={`${input} mt-1 min-h-40`} value={entry.description} onChange={event => setEntry({ ...entry, description: event.target.value })} /></label>
        <PlaceField value={entry.city} onChange={(value, cityId) => setEntry({ ...entry, city: value, selected_place_city_id: cityId || "" })} />
        {entry.entryType !== "news" && <>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-text-primary">{t("formatLabel")}<select className={`${input} mt-1`} value={entry.format} onChange={event => setEntry({ ...entry, format: event.target.value })}>{ORGANIZATION_FORMATS.map(value => <option key={value} value={value}>{t(`format.${value}`)}</option>)}</select></label></div>
        <label className="block text-sm text-text-primary">{t("venue")}<input className={`${input} mt-1`} value={entry.venue} onChange={event => setEntry({ ...entry, venue: event.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-text-primary">{t("startsAt")}<input type="datetime-local" className={`${input} mt-1`} value={entry.startsAt} onChange={event => setEntry({ ...entry, startsAt: event.target.value })} /></label><label className="text-sm text-text-primary">{t("endsAt")}<input type="datetime-local" className={`${input} mt-1`} value={entry.endsAt} onChange={event => setEntry({ ...entry, endsAt: event.target.value })} /></label></div>
        <label className="block text-sm text-text-primary">{t("registrationUrl")}<input type="url" className={`${input} mt-1`} value={entry.registrationUrl} onChange={event => setEntry({ ...entry, registrationUrl: event.target.value })} /></label>
        <p className="text-xs leading-5 text-text-muted">{t("externalRegistrationNotice")}</p>
        </>}
        <label className="block text-sm text-text-primary">{t("externalUrl")}<input type="url" className={`${input} mt-1`} value={entry.externalUrl} onChange={event => setEntry({ ...entry, externalUrl: event.target.value })} /></label>
        <FormDraftStatus draft={entryDraft} />
        <div className="flex flex-wrap gap-3"><button disabled={busy || uploading !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold text-text-primary disabled:opacity-50"><Save size={17} />{t("saveDraft")}</button><button type="button" disabled={busy || uploading !== null} onClick={() => void save("entry", true)} className="min-h-11 rounded-xl bg-gold px-4 py-2 font-semibold text-black disabled:opacity-50">{t("submitReview")}</button></div>
        </fieldset>
      </form>}
      <aside className="min-w-0 space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold text-text-primary">{mode === "organization" ? t("yourOrganizations") : t("yourEntries")}</h2><button type="button" disabled={!(mode === "organization" ? organization.id : entry.id)} onClick={() => void changeForm(() => mode === "organization" ? setOrganization({ id: "", expectedUpdatedAt: "", name: "", description: "", topics: [], city: "", region: "", websiteUrl: "", publicContactEmail: "", logoUrl: "", responsiblePerson: responsiblePersonDraft(responsiblePerson) }) : setEntry(emptyEntry(workspace.organizations[0]?.id)))} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-gold"><Plus size={16} />{t("new")}</button></div>
        {(mode === "organization" ? workspace.organizations : entries).map(item => {
          const media = "name" in item ? item.logo_url : item.image_url;
          return <button type="button" key={item.id} onClick={() => void changeForm(() => mode === "organization" ? editOrganization(item as Organization) : editEntry(item as Entry))} className="flex w-full gap-3 rounded-xl border border-border bg-bg-secondary p-3 text-left">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-primary">{media ? <MediaImage src={media} alt="" fill sizes="56px" className={"name" in item ? "object-contain p-1" : "object-cover"} /> : <ImagePlus className="absolute inset-0 m-auto text-text-muted" size={20} />}</span>
            <span className="min-w-0"><span className="block truncate font-semibold text-text-primary">{"name" in item ? item.name : item.title}</span><span className="mt-1 block text-xs text-text-muted">{t(`status.${item.moderation_status}`)}</span>{item.moderation_reason && <span className="mt-2 block text-xs text-gold">{item.moderation_reason}</span>}</span>
          </button>;
        })}
        {!(mode === "organization" ? workspace.organizations : entries).length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-muted">{t("noneYet")}</p>}
      </aside>
    </div>
    {(mode === "organization" ? organization.id : entry.organizationId) && <OrganizationAccessPanel key={mode === "organization" ? organization.id : entry.organizationId} organizationId={mode === "organization" ? organization.id : entry.organizationId} onLeave={leaveOrganization} />}
  </main>;
}
