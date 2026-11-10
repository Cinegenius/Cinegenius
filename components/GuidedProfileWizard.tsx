"use client";

import { hasPlaceCity } from "@/lib/places/core";

import PlaceField from "@/components/PlaceField";
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
 getDeptLabel, getDepartmentRoleLabel } from "@/lib/departments";
import { GRIP_OCCUPATIONS, gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";
import { getGuidedProfileTypes, normalizeGuidedProfileDraft, removeGuidedDepartment, START_GUIDED_PROFILE_DRAFT, type GuidedProfileDraft } from "@/lib/guided-profile-draft";
import { useTranslations , useLocale } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";





function getLocalizedStepTitles(translate: (key: string) => string) { return (["", translate("Ui.text_ba4ccc486e5a31"), translate("Ui.text_b74120111272a1"), translate("Ui.text_d16accfa84240b"), translate("Ui.text_ce8a406e6bf52e")]); }

function roleSearchTerms(department: Department, role: string, displayLabel?: string) {
  const metadataTerms = getDepartmentRoleSearchTerms(department, role, displayLabel);
  // The established Grip aliases are richer than the legacy profile role strings.
  if (department.id === "grip") return [...new Set([...metadataTerms, ...gripSearchTerms(role)])];
  return metadataTerms;
}

export default function GuidedProfileWizard() {
  const locale = useLocale();
  const taxonomyText = useTranslations("Taxonomy");
  const animals = useTranslations("FilmAnimals");
  const roleLabel = (role: string) => {
    const department = departments.find(item => item.roles.includes(role));
    return department ? getDepartmentRoleLabel(department.id, role, locale, animals, taxonomyText) : role;
  };

  const uiText = useTranslations();
  const stepTitles = getLocalizedStepTitles(uiText);


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
      if (!response.ok) throw new Error(result.error ?? uiText("Ui.text_f33c9647a1028a"));
      return result.draft?.profileDraft;
    }).then((previous) => {
      if (!active) return;
      setDraft(previous ? normalizeGuidedProfileDraft(previous) : START_GUIDED_PROFILE_DRAFT);
      setReady(true);
    }).catch((cause) => { if (active) { setError(uiErrorMessage(cause, uiText("Ui.text_f33c9647a1028a"))); setReady(true); } });
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
      if (!response.ok) throw new Error(result.error ?? uiText("Ui.text_fd69a5ec9a3af7"));
      setSaveState("saved"); return true;
    } catch (cause) { setSaveState("error"); setError(uiErrorMessage(cause, uiText("Ui.text_fd69a5ec9a3af7"))); return false; }
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
    const departmentMatches = normalizeOccupation((department ? getDeptLabel(department, locale, animals, taxonomyText) : "")).includes(normalizedSearch)
      || normalizeOccupation(Object.values(department.labels).join(" ")).includes(normalizedSearch);
    const roles = department.roles.filter((role) => roleSearchTerms(department, role, getDepartmentRoleLabel(department.id, role, locale, animals, taxonomyText))
      .some((term) => normalizeOccupation(term).includes(normalizedSearch)));
    return departmentMatches || roles.length ? [{ department, roles: departmentMatches ? department.roles : roles }] : [];
  }), [normalizedSearch, locale, animals, taxonomyText]);

  function update<K extends keyof GuidedProfileDraft>(key: K, value: GuidedProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value })); setError("");
  }
  async function move(step: number) {
    if (draft.step === 1 && draft.departmentIds.length === 0) { setError(uiText("setup.departmentRequired")); return; }
    if (draft.step === 2 && !draft.name.trim()) { setError(uiText("Ui.text_54c595e7b5b2c0")); return; }
    if (draft.step === 2 && !hasPlaceCity(draft.city)) { setError(uiText("Ui.text_71160fb0f5bf74")); return; }
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
        display_name: draft.name.trim(), location: draft.city.trim(), selected_place_city_id: draft.selected_place_city_id || undefined, profile_types: profileTypes,
        profile_type: profileTypes[0] ?? null, positions: draft.positions, bio: draft.bio.trim(), available: true,
      }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? uiText("Ui.text_9794b4e8304d0a"));
      await fetch("/api/onboarding?type=profile", { method: "DELETE" });
      draftProtection.complete();
      setSavedProfile(true);
      router.replace("/dashboard");
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_9794b4e8304d0a"))); }
    finally { setSubmitting(false); }
  }

  if (!ready || !isLoaded) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">{uiText.rich("Ui.text_6aa63960f7c8b1", { part1: () => (<Loader2 className="mx-auto mb-3 animate-spin" />) })}</main>;
  return <main className="min-h-screen bg-bg-primary px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-3xl">
    <button onClick={() => router.push("/profile-setup")} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-text-primary">{uiText.rich("Ui.text_d787822cfc68d3", { part1: () => (<ArrowLeft size={16} />) })}</button>
    <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><UserRound size={20} /></span><div><p className="text-xs uppercase tracking-wider text-gold">{uiText("Ui.text_c3abe932bf44c0")}</p><h1 className="font-display text-2xl font-bold text-text-primary">{stepTitles[draft.step]}</h1></div></div>
    <div className="mb-7"><div className="mb-2 flex justify-between text-xs text-text-muted">{uiText.rich("Ui.text_5006f2c2909af0", { value2: () => (draft.step), part1: chunks => (<span>{chunks}</span>), value4: () => (saveState === "saving" ? uiText("setup.copy101") : saveState === "saved" ? uiText("profile.collabSaved") : saveState === "error" ? uiText("setup.saveFailed") : ""), part3: chunks => (<span>{chunks}</span>) })}</div><div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${draft.step / 4 * 100}%` }} /></div></div>
    <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      {draft.step === 1 && <div>
        <p className="mb-4 text-sm leading-6 text-text-muted">{uiText("Ui.text_824aee2d03b416")}</p>
        <label className="relative mb-4 block"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={uiText("Ui.text_334b4f0aca01f9")} aria-label={uiText("Ui.text_4fef63d5d3224d")} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary pl-10 pr-4 text-sm text-text-primary outline-none focus:border-gold" /></label>
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleDepartments.map(({ department }) => {
            const selected = draft.departmentIds.includes(department.id);
            const count = department.roles.filter((role) => draft.positions.includes(role)).length;
            return <button key={department.id} type="button" aria-pressed={selected} onClick={() => toggleDepartment(department.id)} className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}>{uiText.rich("Ui.text_6ac556206bf828", { value3: () => (selected ? "✓ " : "+ "), value4: () => ((department ? getDeptLabel(department, locale, animals, taxonomyText) : "")), part2: chunks => (<span className="block break-words text-sm font-medium text-text-primary">{chunks}</span>), value6: () => (department.roles.length), value7: () => (count ? uiText("Ui.text_118c5f8c59c1bf", { value1: String(count) }) : ""), part5: chunks => (<span className="text-[11px] text-text-muted">{chunks}</span>), part1: chunks => (<span className="min-w-0">{chunks}</span>), part8: () => (<ChevronDown size={15} className={`shrink-0 text-text-muted transition-transform ${selected ? "rotate-180" : ""}`} />) })}</button>;
          })}
        </div>
        {pendingDepartmentRemoval && (() => {
          const department = departments.find((item) => item.id === pendingDepartmentRemoval);
          const remainingDepartmentIds = draft.departmentIds.filter((id) => id !== pendingDepartmentRemoval);
          const remainingRoleLabels = new Set(remainingDepartmentIds.flatMap((id) => departments.find((item) => item.id === id)?.roles ?? []));
          const count = department?.roles.filter((role) => draft.positions.includes(role) && !remainingRoleLabels.has(role)).length ?? 0;
          return <div role="group" aria-label={uiText("Ui.text_fc819bfeb3206f")} className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-sm"><p className="text-text-primary">{count > 0 ? uiText("Ui.text_53e6ce7ee7aa14", { value1: String((department ? getDeptLabel(department, locale, animals, taxonomyText) : "")), value2: String(count), value3: String(count === 1 ? uiText("AdminReview.fields.role") : uiText("setup.occupations")) }) : uiText("Ui.text_228100085ac4f2", { value1: String((department ? getDeptLabel(department, locale, animals, taxonomyText) : "")) })}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => removeDepartment(pendingDepartmentRemoval)} className="min-h-11 rounded-lg bg-amber-400/20 px-3 text-xs font-semibold text-amber-100">{uiText("Ui.text_6d6e65f8f88197")}</button><button type="button" onClick={() => setPendingDepartmentRemoval(null)} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-primary">{uiText("home.boardCancel")}</button></div></div>;
        })()}
        {(draft.departmentIds.length > 0 || (normalizedSearch && visibleDepartments.some(({ roles }) => roles.length > 0))) && <div className="space-y-3">
          {visibleDepartments.filter(({ department, roles }) => draft.departmentIds.includes(department.id) || (normalizedSearch && roles.length > 0)).map(({ department }) => {
            const matching = normalizedSearch
              ? department.roles.filter((role) => roleSearchTerms(department, role, getDepartmentRoleLabel(department.id, role, locale, animals, taxonomyText)).some((term) => normalizeOccupation(term).includes(normalizedSearch)))
              : department.roles;
            const roleOptions = normalizedSearch && matching.length === 0 && normalizeOccupation((department ? getDeptLabel(department, locale, animals, taxonomyText) : "")).includes(normalizedSearch) ? department.roles : matching;
            if (normalizedSearch && roleOptions.length === 0) return null;
            return <section key={department.id} className="overflow-hidden rounded-xl border border-border bg-bg-primary/60">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="min-w-0 break-words text-sm font-semibold text-text-primary">{department.emoji} {(department ? getDeptLabel(department, locale, animals, taxonomyText) : "")}</h2><span className="shrink-0 text-xs text-text-muted">{uiText.rich("Ui.text_0016ba114933b2", { value1: () => (department.roles.filter((role) => draft.positions.includes(role)).length) })}</span></div>
              {department.id === "grip" && <p className="px-4 pt-3 text-xs leading-5 text-text-muted">{uiText("Ui.text_8cd311da13eece")}</p>}
              <div className="flex flex-wrap gap-2 p-3">{roleOptions.map((role) => {
                const selected = draft.positions.includes(role);
                const explanation = GRIP_OCCUPATIONS.find((occupation) => occupation.label === role)?.description;
                return <button key={getDepartmentRoleLabel(department.id, role, locale, animals, taxonomyText)} type="button" aria-pressed={selected} title={explanation} onClick={() => togglePosition(department, role)} className={`min-h-11 max-w-full break-words rounded-full border px-3 py-2 text-left text-xs font-medium transition ${selected ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-muted hover:border-gold/40 hover:text-text-primary"}`}>{selected ? "✓ " : "+ "}{getDepartmentRoleLabel(department.id, role, locale, animals, taxonomyText)}</button>;
              })}</div>
            </section>;
          })}
        </div>}
        {normalizedSearch && visibleDepartments.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">{uiText("Ui.text_d03a3ce4243227")}</p>}
        {draft.departmentIds.length === 0 && !normalizedSearch && <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-muted">{uiText("Ui.text_6e5cc80aa99a21")}</p>}
      </div>}
      {draft.step === 2 && <div className="space-y-5"><p className="text-sm leading-6 text-text-muted">{uiText("Ui.text_0bd6a60fa92705")}</p><div><label htmlFor="display-name" className="mb-2 block text-sm font-medium text-text-primary">{uiText.rich("Ui.text_1c3cd2adb4a719", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label><input id="display-name" autoComplete="name" value={draft.name} onChange={(event) => update("name", event.target.value)} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div><div><label htmlFor="profile-city" className="mb-2 block text-sm font-medium text-text-primary">{uiText.rich("Ui.text_8006d3d1d105f5", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label><PlaceField id="profile-city" selectedCityId={draft.selected_place_city_id} value={draft.city} onChange={(value, cityId) => setDraft(current => ({ ...current, city: value, selected_place_city_id: cityId || "" }))} required /></div></div>}
      {draft.step === 3 && <><p className="mb-4 text-sm leading-6 text-text-muted">{uiText("Ui.text_2e4119cc8ade84")}</p><label htmlFor="bio" className="mb-2 block text-sm font-medium text-text-primary">{uiText.rich("Ui.text_3e6cd4cf1f8212", { part1: chunks => (<span className="text-text-muted">{chunks}</span>) })}</label><textarea id="bio" rows={5} maxLength={1000} value={draft.bio} onChange={(event) => update("bio", event.target.value)} placeholder={uiText("Ui.text_0e62bd42482853")} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-sm text-text-primary outline-none focus:border-gold" /></>}
      {draft.step === 4 && <><p className="mb-5 text-sm leading-6 text-text-muted">{uiText("Ui.text_bd3dc26c94a62b")}</p><div className="space-y-3 rounded-xl border border-border bg-bg-primary p-4 text-sm"><div><span className="text-xs text-text-muted">{uiText("profile.fieldName")}</span><p className="text-text-primary">{draft.name}</p></div><div><span className="text-xs text-text-muted">{uiText("Ui.text_5d0a42d835ca34")}</span><p className="text-text-primary">{selectedDepartments.map((department) => (department ? getDeptLabel(department, locale, animals, taxonomyText) : "")).join(" · ")}</p></div>{draft.positions.length > 0 && <div><span className="text-xs text-text-muted">{uiText("setup.occupations")}</span><p className="text-text-primary">{draft.positions.map(roleLabel).join(" · ")}</p></div>}<div><span className="text-xs text-text-muted">{uiText("setup.place")}</span><p className="text-text-primary">{draft.city}</p></div>{draft.bio && <div><span className="text-xs text-text-muted">{uiText("setup.introduction")}</span><p className="whitespace-pre-wrap text-text-primary">{draft.bio}</p></div>}</div></>}
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><button onClick={() => draft.step === 1 ? router.push("/profile-setup") : void move(draft.step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary">{uiText.rich("Ui.text_3c9cbf8b79d036", { part1: () => (<ArrowLeft size={16} />) })}</button>{draft.step < 4 ? <button onClick={() => void move(draft.step + 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{uiText.rich("Ui.text_71f09a8b7c811b", { part1: () => (<ArrowRight size={16} />) })}</button> : <button disabled={submitting} onClick={() => void createProfile()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{submitting ? <>{uiText.rich("Ui.text_c92ba34c0c3b92", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</> : <>{uiText.rich("Ui.text_5d63896787f560", { part1: () => (<ArrowRight size={16} />) })}</>}</button>}</div>
    <p className="mt-4 text-center text-xs text-text-muted">{uiText("Ui.text_c44af18d55e816")}</p>
  </div></main>;
}
