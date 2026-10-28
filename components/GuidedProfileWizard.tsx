"use client";
import { useFormRouter as useRouter } from "@/lib/use-form-router";
import { createOnboardingSaveQueue } from "@/lib/onboarding-save";
import { useExistingDraftProtection } from "@/lib/use-form-draft";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, Search, UserRound } from "lucide-react";
import {
  departments,
  getDepartmentRoleSearchTerms,
  type Department,
} from "@/lib/departments";
import { GRIP_OCCUPATIONS, gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";
import { getGuidedProfileTypes, normalizeGuidedProfileDraft, removeGuidedDepartment, START_GUIDED_PROFILE_DRAFT, type GuidedProfileDraft } from "@/lib/guided-profile-draft";

const stepTitles = ["", "Was machst du gern?", "Wie dürfen wir dich nennen?", "Erzähl kurz von dir", "Prüfen und Profil erstellen"];

function roleSearchTerms(department: Department, role: string) {
  const metadataTerms = getDepartmentRoleSearchTerms(department, role);
  // The established Grip aliases are richer than the legacy profile role strings.
  if (department.id === "grip") return [...new Set([...metadataTerms, ...gripSearchTerms(role)])];
  return metadataTerms;
}

export default function GuidedProfileWizard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [draft, setDraft] = useState<GuidedProfileDraft>(START_GUIDED_PROFILE_DRAFT);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingDepartmentRemoval, setPendingDepartmentRemoval] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Dein Entwurf konnte nicht geladen werden.");
      return result.draft?.profileDraft;
    }).then((previous) => {
      if (!active) return;
      setDraft(previous ? normalizeGuidedProfileDraft(previous) : START_GUIDED_PROFILE_DRAFT);
      setReady(true);
    }).catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Dein Entwurf konnte nicht geladen werden."); setReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || draft.name || !user?.fullName) return;
    setDraft((current) => current.name ? current : { ...current, name: user.fullName ?? "" });
  }, [ready, draft.name, user?.fullName]);

  const saveQueue = useMemo(() => createOnboardingSaveQueue(async (value: GuidedProfileDraft) => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: "talent", setupComplete: false, profileDraft: value, updatedAt: new Date().toISOString() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Der Fortschritt konnte nicht gespeichert werden.");
      setSaveState("saved"); return true;
    } catch (cause) { setSaveState("error"); setError(cause instanceof Error ? cause.message : "Der Fortschritt konnte nicht gespeichert werden."); return false; }
  }), []);
  const persist = useCallback((snapshot: GuidedProfileDraft) => saveQueue.save(snapshot), [saveQueue]);

  const draftProtection = useExistingDraftProtection({ value: draft, ready, busy: submitting, save: persist, saved: saveQueue.matches, enabled: !savedProfile });

  useEffect(() => {
    if (!ready || savedProfile || submitting) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(draft); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, savedProfile, draft, persist, submitting]);

  const normalizedSearch = normalizeOccupation(search.trim());
  const selectedDepartments = useMemo(() => departments.filter((department) => draft.departmentIds.includes(department.id)), [draft.departmentIds]);
  const visibleDepartments = useMemo(() => departments.flatMap((department) => {
    if (!normalizedSearch) return [{ department, roles: department.roles }];
    const departmentMatches = normalizeOccupation(department.label).includes(normalizedSearch)
      || normalizeOccupation(Object.values(department.labels).join(" ")).includes(normalizedSearch);
    const roles = department.roles.filter((role) => roleSearchTerms(department, role)
      .some((term) => normalizeOccupation(term).includes(normalizedSearch)));
    return departmentMatches || roles.length ? [{ department, roles: departmentMatches ? department.roles : roles }] : [];
  }), [normalizedSearch]);

  function update<K extends keyof GuidedProfileDraft>(key: K, value: GuidedProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value })); setError("");
  }
  async function move(step: number) {
    if (draft.step === 1 && draft.departmentIds.length === 0) { setError("Wähle mindestens ein Gewerk aus."); return; }
    if (draft.step === 2 && !draft.name.trim()) { setError("Bitte gib deinen Namen an."); return; }
    if (draft.step === 2 && !draft.city.trim()) { setError("Bitte gib deinen Wohnort oder deine Region an."); return; }
    const next = { ...draft, step };
    if (await persist(next)) setDraft(next);
  }
  function addDepartment(departmentId: string) {
    setDraft((current) => ({ ...current, departmentIds: [...new Set([...current.departmentIds, departmentId])] }));
    setError("");
  }
  function removeDepartment(departmentId: string) {
    setDraft((current) => removeGuidedDepartment(current, departmentId));
    setPendingDepartmentRemoval(null);
  }
  function toggleDepartment(departmentId: string) {
    if (!draft.departmentIds.includes(departmentId)) { addDepartment(departmentId); return; }
    const department = departments.find((item) => item.id === departmentId);
    const remainingDepartmentIds = draft.departmentIds.filter((id) => id !== departmentId);
    const remainingRoleLabels = new Set(remainingDepartmentIds.flatMap((id) => departments.find((item) => item.id === id)?.roles ?? []));
    const selectedCount = department?.roles.filter((role) => draft.positions.includes(role) && !remainingRoleLabels.has(role)).length ?? 0;
    if (selectedCount) setPendingDepartmentRemoval(departmentId);
    else removeDepartment(departmentId);
  }
  function togglePosition(department: Department, position: string) {
    setDraft((current) => ({
      ...current,
      departmentIds: [...new Set([...current.departmentIds, department.id])],
      positions: current.positions.includes(position)
        ? current.positions.filter((item) => item !== position)
        : [...current.positions, position],
    }));
    setError("");
  }
  async function createProfile() {
    const profileTypes = getGuidedProfileTypes(draft);
    setSubmitting(true); setError("");
    try {
      if (timer.current) clearTimeout(timer.current);
      await saveQueue.settle();
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        display_name: draft.name.trim(), location: draft.city.trim(), profile_types: profileTypes,
        profile_type: profileTypes[0] ?? null, positions: draft.positions, bio: draft.bio.trim(), available: true,
      }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Das Profil konnte nicht gespeichert werden.");
      await fetch("/api/onboarding?type=profile", { method: "DELETE" });
      draftProtection.complete();
      setSavedProfile(true);
      router.replace("/dashboard");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Das Profil konnte nicht gespeichert werden."); }
    finally { setSubmitting(false); }
  }

  if (!ready || !isLoaded) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Dein Start wird geladen …</main>;
  return <main className="min-h-screen bg-bg-primary px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-3xl">
    <button onClick={() => router.push("/profile-setup")} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-text-primary"><ArrowLeft size={16} /> Alle Wege</button>
    <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><UserRound size={20} /></span><div><p className="text-xs uppercase tracking-wider text-gold">Dein Crew-Profil</p><h1 className="font-display text-2xl font-bold text-text-primary">{stepTitles[draft.step]}</h1></div></div>
    <div className="mb-7"><div className="mb-2 flex justify-between text-xs text-text-muted"><span>Schritt {draft.step} von 4</span><span>{saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : ""}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${draft.step / 4 * 100}%` }} /></div></div>
    <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      {draft.step === 1 && <div>
        <p className="mb-4 text-sm leading-6 text-text-muted">Wähle alle Gewerke aus, die zu dir passen. Die Liste enthält auch die Berufe aus Crew-Suche, Profilbearbeitung sowie Job- und Projektausschreibungen.</p>
        <label className="relative mb-4 block"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Gewerk oder Beruf suchen …" aria-label="Gewerk oder Beruf suchen" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary pl-10 pr-4 text-sm text-text-primary outline-none focus:border-gold" /></label>
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDepartments.map(({ department }) => {
            const selected = draft.departmentIds.includes(department.id);
            const count = department.roles.filter((role) => draft.positions.includes(role)).length;
            return <button key={department.id} type="button" aria-pressed={selected} onClick={() => toggleDepartment(department.id)} className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}>
              <span className="min-w-0"><span className="block break-words text-sm font-medium text-text-primary">{selected ? "✓ " : "+ "}{department.label}</span><span className="text-[11px] text-text-muted">{department.roles.length} Tätigkeiten{count ? ` · ${count} gewählt` : ""}</span></span><ChevronDown size={15} className={`shrink-0 text-text-muted transition-transform ${selected ? "rotate-180" : ""}`} />
            </button>;
          })}
        </div>
        {pendingDepartmentRemoval && (() => {
          const department = departments.find((item) => item.id === pendingDepartmentRemoval);
          const remainingDepartmentIds = draft.departmentIds.filter((id) => id !== pendingDepartmentRemoval);
          const remainingRoleLabels = new Set(remainingDepartmentIds.flatMap((id) => departments.find((item) => item.id === id)?.roles ?? []));
          const count = department?.roles.filter((role) => draft.positions.includes(role) && !remainingRoleLabels.has(role)).length ?? 0;
          return <div role="group" aria-label="Gewerk entfernen" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-sm"><p className="text-text-primary">{count > 0 ? `Wenn du „${department?.label}“ entfernst, werden auch ${count} ausgewählte ${count === 1 ? "Tätigkeit" : "Tätigkeiten"} entfernt.` : `„${department?.label}“ entfernen? Gemeinsam genutzte Tätigkeiten bleiben erhalten.`}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => removeDepartment(pendingDepartmentRemoval)} className="min-h-11 rounded-lg bg-amber-400/20 px-3 text-xs font-semibold text-amber-100">Gewerk und Tätigkeiten entfernen</button><button type="button" onClick={() => setPendingDepartmentRemoval(null)} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-primary">Abbrechen</button></div></div>;
        })()}
        {(draft.departmentIds.length > 0 || (normalizedSearch && visibleDepartments.some(({ roles }) => roles.length > 0))) && <div className="space-y-3">
          {visibleDepartments.filter(({ department, roles }) => draft.departmentIds.includes(department.id) || (normalizedSearch && roles.length > 0)).map(({ department }) => {
            const matching = normalizedSearch
              ? department.roles.filter((role) => roleSearchTerms(department, role).some((term) => normalizeOccupation(term).includes(normalizedSearch)))
              : department.roles;
            const roleOptions = normalizedSearch && matching.length === 0 && normalizeOccupation(department.label).includes(normalizedSearch) ? department.roles : matching;
            if (normalizedSearch && roleOptions.length === 0) return null;
            return <section key={department.id} className="overflow-hidden rounded-xl border border-border bg-bg-primary/60">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="min-w-0 break-words text-sm font-semibold text-text-primary">{department.emoji} {department.label}</h2><span className="shrink-0 text-xs text-text-muted">{department.roles.filter((role) => draft.positions.includes(role)).length} gewählt</span></div>
              {department.id === "grip" && <p className="px-4 pt-3 text-xs leading-5 text-text-muted">Dazu gehören Kamerabühne, Dolly, Rigging und Kamera-Kransysteme. Die genaue Einordnung unterscheidet sich je nach Land und Produktion.</p>}
              <div className="flex flex-wrap gap-2 p-3">{roleOptions.map((role) => {
                const selected = draft.positions.includes(role);
                const explanation = GRIP_OCCUPATIONS.find((occupation) => occupation.label === role)?.description;
                return <button key={role} type="button" aria-pressed={selected} title={explanation} onClick={() => togglePosition(department, role)} className={`min-h-11 max-w-full break-words rounded-full border px-3 py-2 text-left text-xs font-medium transition ${selected ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-muted hover:border-gold/40 hover:text-text-primary"}`}>{selected ? "✓ " : "+ "}{role}</button>;
              })}</div>
            </section>;
          })}
        </div>}
        {normalizedSearch && visibleDepartments.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">Kein Gewerk oder Beruf gefunden. Prüfe auch englische oder geläufige alternative Bezeichnungen.</p>}
        {draft.departmentIds.length === 0 && !normalizedSearch && <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-muted">Wähle mindestens ein Gewerk aus. Alle Bereiche sind oben erreichbar.</p>}
      </div>}
      {draft.step === 2 && <div className="space-y-5"><p className="text-sm leading-6 text-text-muted">Nutze den Namen, unter dem man dich finden darf. Als Standort genügt Stadt oder Region; deine genaue Adresse wird nicht benötigt.</p><div><label htmlFor="display-name" className="mb-2 block text-sm font-medium text-text-primary">Name <span className="text-gold">*</span></label><input id="display-name" autoComplete="name" value={draft.name} onChange={(event) => update("name", event.target.value)} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div><div><label htmlFor="profile-city" className="mb-2 block text-sm font-medium text-text-primary">Wohnort oder Region <span className="text-gold">*</span></label><input id="profile-city" autoComplete="address-level2" value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="Zum Beispiel Nürnberg" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div></div>}
      {draft.step === 3 && <><p className="mb-4 text-sm leading-6 text-text-muted">Eine kurze Vorstellung ist hilfreich, aber freiwillig. Profilfoto, Showreel und weitere Angaben kannst du nach dem Start ergänzen.</p><label htmlFor="bio" className="mb-2 block text-sm font-medium text-text-primary">Kurz über dich <span className="text-text-muted">(optional)</span></label><textarea id="bio" rows={5} maxLength={1000} value={draft.bio} onChange={(event) => update("bio", event.target.value)} placeholder="Was machst du gern? Welche Art von Projekten interessiert dich?" className="w-full rounded-xl border border-border bg-bg-primary p-4 text-sm text-text-primary outline-none focus:border-gold" /></>}
      {draft.step === 4 && <><p className="mb-5 text-sm leading-6 text-text-muted">Prüfe deine Angaben. Mit „Profil erstellen“ wird dein Profil für andere CineGenius-Mitglieder sichtbar. Weitere Informationen und Bilder kannst du später ergänzen.</p><div className="space-y-3 rounded-xl border border-border bg-bg-primary p-4 text-sm"><div><span className="text-xs text-text-muted">Name</span><p className="text-text-primary">{draft.name}</p></div><div><span className="text-xs text-text-muted">Gewerke</span><p className="text-text-primary">{selectedDepartments.map((department) => department.label).join(" · ")}</p></div>{draft.positions.length > 0 && <div><span className="text-xs text-text-muted">Tätigkeiten</span><p className="text-text-primary">{draft.positions.join(" · ")}</p></div>}<div><span className="text-xs text-text-muted">Standort</span><p className="text-text-primary">{draft.city}</p></div>{draft.bio && <div><span className="text-xs text-text-muted">Vorstellung</span><p className="whitespace-pre-wrap text-text-primary">{draft.bio}</p></div>}</div></>}
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><button onClick={() => draft.step === 1 ? router.push("/profile-setup") : void move(draft.step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary"><ArrowLeft size={16} /> Zurück</button>{draft.step < 4 ? <button onClick={() => void move(draft.step + 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Weiter <ArrowRight size={16} /></button> : <button disabled={submitting} onClick={() => void createProfile()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{submitting ? <><Loader2 size={16} className="animate-spin" /> Profil wird erstellt …</> : <>Profil erstellen <ArrowRight size={16} /></>}</button>}</div>
    <p className="mt-4 text-center text-xs text-text-muted">Dein Fortschritt bleibt privat, bis du dein Profil ausdrücklich erstellst.</p>
  </div></main>;
}
