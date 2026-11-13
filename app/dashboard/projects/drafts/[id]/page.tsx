"use client";

import { useFormNavigation } from "@/contexts/FormDraftContext";
import MediaImage from "@/components/MediaImage";
import ProjectMediaRightsFields from "@/components/ProjectMediaRightsFields";
import ProjectFlowSteps from "@/components/ProjectFlowSteps";
import RoleDropdown from "@/components/RoleDropdown";
import FormDraftStatus from "@/components/FormDraftStatus";
import { useExistingDraftProtection, type FormDraftStatus as DraftStatus } from "@/lib/use-form-draft";
import { normalizeProjectMediaRights, projectMediaUrls } from "@/lib/project-media-rights";
import { CountrySelect } from "@/components/BrowseGeography";
import { countryCode } from "@/lib/places/core";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { departments } from "@/lib/departments";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, Trash2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";

type Draft = { id: string; source_project_id: string | null; published_project_id?: string | null; updated_at: string; draft_data: Record<string, unknown> };
const TYPES = ["Spielfilm", "Kurzfilm", "Serie", "Dokumentation", "Werbefilm", "Imagefilm", "Musikvideo", "Corporate", "Social Media", "Foto / Shooting", "Event", "Sonstiges"];
const ROLES = [...new Set(departments.flatMap(department => department.roles))];
const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-gold focus:outline-none";
const buttonClass = "min-h-11 rounded-xl border border-border px-4 py-2 text-sm text-text-secondary disabled:opacity-50";

export default function ProjectDraftPreviewPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectDraftPreview key={id} id={id} />;
}

function ProjectDraftPreview({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { leave } = useFormNavigation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<DraftStatus>("idle");
  const saved = useRef("");
  const inFlight = useRef<Promise<boolean> | null>(null);
  const generation = useRef(0);

  const persist = useCallback(async (value: Record<string, unknown>): Promise<boolean> => {
    if (inFlight.current && !await inFlight.current) return false;
    if (saved.current === JSON.stringify(value)) return true;
    // The draft API omits incomplete crew entries. Do not acknowledge a save
    // that would drop a name while its input is temporarily being edited.
    if (Array.isArray(value.crew_entries) && value.crew_entries.some(entry =>
      !entry || typeof entry.name !== "string" || !entry.name.trim() || typeof entry.role !== "string" || !entry.role.trim())) {
      setStatus("error"); setError(t("System.m_0e4698bf4051")); return false;
    }
    const current = draftRef.current;
    if (!current || current.id !== id || current.published_project_id) return false;
    const token = generation.current;
    const request = (async () => {
      setStatus("saving");
      try {
        const response = await fetch(`/api/project-drafts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftData: value, expectedUpdatedAt: current.updated_at }) });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || t("System.requestFailed"));
        if (generation.current !== token) return false;
        draftRef.current = json.draft; setDraft(json.draft);
        saved.current = JSON.stringify(value); setStatus("saved"); setError("");
        return true;
      } catch (reason) {
        if (generation.current === token) { setStatus("error"); setError(uiErrorMessage(reason, t("System.requestFailed"))); }
        return false;
      }
    })();
    inFlight.current = request;
    try { return await request; } finally { if (inFlight.current === request) inFlight.current = null; }
  }, [id, t]);
  const protection = useExistingDraftProtection({ value: data, ready: !!draft && !loading, busy, enabled: !draft?.published_project_id,
    save: persist, saved: value => saved.current === JSON.stringify(value) });

  useEffect(() => {
    const controller = new AbortController();
    generation.current += 1; draftRef.current = null;
    fetch(`/api/project-drafts/${id}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("System.requestFailed"));
      if (controller.signal.aborted) return;
      draftRef.current = json.draft; setDraft(json.draft); setData(json.draft.draft_data);
      saved.current = JSON.stringify(json.draft.draft_data);
    }).catch(reason => { if (!controller.signal.aborted) setError(uiErrorMessage(reason, t("System.requestFailed"))); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); generation.current += 1; };
    // Locale changes must not reload a draft over unsaved input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  useEffect(() => {
    if (!draft || loading || busy || draft.published_project_id || saved.current === JSON.stringify(data)) return;
    setStatus("pending");
    const timer = setTimeout(() => { void persist(data); }, 900);
    return () => clearTimeout(timer);
  }, [data, draft, loading, busy, persist]);

  async function publish() {
    if (!draft || busy) return;
    setBusy(true); setError("");
    try {
      if (!await persist(data)) return;
      const response = await fetch(`/api/project-drafts/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: draftRef.current?.updated_at, mediaRights: data.mediaRights }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("System.requestFailed"));
      protection.complete(); router.push(`/projects/${json.projectId}`);
    } catch (reason) { setError(uiErrorMessage(reason, t("System.requestFailed"))); }
    finally { setBusy(false); }
  }
  async function removeDraft() {
    if (!confirm(t("Ui.text_77b13be3999d11"))) return;
    setBusy(true); setError("");
    try {
      if (inFlight.current) await inFlight.current;
      const response = await fetch(`/api/project-drafts/${id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("System.requestFailed"));
      protection.complete(); router.push("/projects");
    } catch (reason) { setError(uiErrorMessage(reason, t("System.requestFailed"))); }
    finally { setBusy(false); }
  }
  const text = (key: string) => typeof data[key] === "string" || typeof data[key] === "number" ? String(data[key]) : "";
  const change = (key: string, value: unknown) => setData(previous => ({ ...previous, [key]: value, ...(key === "productionCompany" ? { production_company: value } : {}) }));
  const crew = Array.isArray(data.crew_entries) ? data.crew_entries.filter((entry): entry is { name: string; role: string } =>
    !!entry && typeof entry === "object" && typeof entry.name === "string" && typeof entry.role === "string") : [];
  const types = TYPES.includes(text("type")) || !text("type") ? TYPES : [text("type"), ...TYPES];

  return <main className="pt-16 min-h-screen bg-bg-primary mobile-bottom-nav-clear">
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href={draft?.source_project_id ? `/projects/${draft.source_project_id}` : "/projects"} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-gold">
        {t.rich("Ui.text_3c9cbf8b79d036", { part1: () => <ArrowLeft size={16} /> })}
      </Link>
      <ProjectFlowSteps current={editing ? 1 : 2} />
      {loading ? <div className="flex justify-center p-12" role="status"><Loader2 className="animate-spin" aria-label={t("common.loading")} /></div> : !draft ?
        <div role="alert" className="rounded-2xl border border-border p-5"><p>{error}</p><button className={`${buttonClass} mt-3`} onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>{t("setup.copy49")}</button></div> :
        <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-8">
          <p className="mb-5 text-sm leading-relaxed text-text-muted">{t(draft.published_project_id ? "projects.viewPublished" : "projects.draftNotice")}</p>
          <div className="flex items-start gap-4">
            {text("poster_url") && <MediaImage src={text("poster_url")} alt="" width={64} height={88} className="h-22 w-16 shrink-0 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1"><h1 className="break-words font-display text-2xl text-text-primary">{text("title")}</h1>
              <p className="mt-2 text-sm text-text-muted">{[projectTypeLabel(text("type"), t), text("year"), text("director")].filter(Boolean).join(" · ")}</p></div>
          </div>
          {editing ? <fieldset disabled={busy} className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
            {([["title", "projects.colTitle"], ["director", "projects.filterDirector"], ["year", "projects.filterYear"], ["productionCompany", "profile.labelProductionCompany"]] as const).map(([key, label]) =>
              <label key={key} className="min-w-0 text-sm text-text-secondary">{t(label)}<input className={`${inputClass} mt-1`} value={key === "productionCompany" ? text("production_company") || text(key) : text(key)} type={key === "year" ? "number" : "text"} min={key === "year" ? 1900 : undefined} max={key === "year" ? new Date().getFullYear() + 5 : undefined} onChange={event => change(key, event.target.value)} /></label>)}
            <label className="min-w-0 text-sm text-text-secondary">{t("projects.colType")}<select value={text("type")} onChange={event => change("type", event.target.value)} className={`${inputClass} mt-1`}><option value="">—</option>{types.map(type => <option key={type} value={type}>{projectTypeLabel(type, t)}</option>)}</select></label>
            <div className="min-w-0 text-sm text-text-secondary"><p className="mb-1">{t("Ui.text_c5d70daa002cac")}</p><RoleDropdown value={text("myRole")} onChange={value => change("myRole", value)} options={ROLES} /></div>
            <CountrySelect emptyLabel={t("Places.chooseCountry")} value={countryCode(text("country"))} onChange={value => change("country", value)} />
            <label className="min-w-0 text-sm text-text-secondary sm:col-span-2">{t("Ui.text_76caf76da0cfb2")}<textarea rows={5} value={text("description")} onChange={event => change("description", event.target.value)} className={`${inputClass} mt-1`} /></label>
          </fieldset> : text("description") && <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">{text("description")}</p>}
          {crew.length > 0 && <section className="mt-6"><h2 className="mb-3 text-sm font-semibold text-text-primary">{t("projects.colCrew")}</h2><ul className="space-y-3">{crew.map((entry, index) => <li key={index} className="min-w-0 text-sm text-text-secondary">
            {editing ? <div className="grid min-w-0 gap-2 sm:grid-cols-2"><input aria-label={t("profile.fieldName")} value={entry.name} className={inputClass} onChange={event => change("crew_entries", crew.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /><RoleDropdown value={entry.role} onChange={role => change("crew_entries", crew.map((item, i) => i === index ? { ...item, role } : item))} options={ROLES} /></div> : <>{entry.name} · {entry.role}</>}
          </li>)}</ul></section>}
          {!draft.published_project_id && <>
            <button className={`${buttonClass} mt-5 inline-flex items-center gap-2`} disabled={busy} onClick={async () => { if (!editing || await persist(data)) setEditing(value => !value); }}><Pencil size={15} />{t(editing ? "projects.stepReview" : "projects.editProject")}</button>
            {projectMediaUrls(data).length > 0 && <ProjectMediaRightsFields value={normalizeProjectMediaRights(data.mediaRights)} onChange={value => change("mediaRights", value)} disabled={busy} />}
            <FormDraftStatus draft={{ status, error, loaded: true, flush: () => persist(data), reload: () => {} }} />
            {error && <div className="mt-4"><p role="alert" className="text-sm text-crimson-light">{error}</p><button type="button" className={`${buttonClass} mt-2`} disabled={busy} onClick={() => leave(() => { setDraft(null); setLoading(true); setAttempt(value => value + 1); })}>{t("FormDraft.reload")}</button></div>}
            <p className="mt-5 text-xs leading-relaxed text-text-muted">{t("projects.creditsNotice")}</p>
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
              <button onClick={removeDraft} disabled={busy} className={`${buttonClass} inline-flex items-center justify-center gap-2`}>{t.rich("Ui.text_8f874ba50a2326", { part1: () => <Trash2 size={15} /> })}</button>
              <button onClick={publish} disabled={busy || editing || !text("title").trim() || !text("type").trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-bg-primary disabled:opacity-50">{t.rich("Ui.text_c29814c8b13836", { value1: () => busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} /> })}</button>
            </div>
          </>}
          {(draft.published_project_id || draft.source_project_id) && <Link href={`/projects/${draft.published_project_id || draft.source_project_id}`} className="mt-4 inline-flex min-h-11 items-center text-sm text-gold">{t("projects.viewPublished")}</Link>}
        </section>}
    </div>
  </main>;
}
