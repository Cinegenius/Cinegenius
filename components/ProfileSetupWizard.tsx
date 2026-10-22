"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowLeft, ArrowRight, Building2, Camera, CheckCircle2, Film, ImagePlus,
  Loader2, MapPin, Package, Search, Trash2,
} from "lucide-react";
import { compressImage } from "@/lib/compressImage";
import { departments } from "@/lib/departments";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { shouldSkipProfileSetup } from "@/lib/profile-setup-flow";
import {
  buildQuickStartScreens, createQuickStartIntentData, findQuickStartRoles, getFirstScreenForIntent, getQuickStartDepartments,
  getQuickStartProfileTypesForRoles, normalizeQuickStartDraft, QUICK_START_CATEGORIES,
  QUICK_START_INTENT_LABELS, START_QUICK_START_DRAFT, validateQuickStartDraft,
  validateQuickStartScreen, type QuickStartDraft, type QuickStartIntent, type QuickStartIntentData,
  type QuickStartRoleSelection, type QuickStartScreen,
} from "@/lib/quick-start-flow";

const paths: { id: QuickStartIntent; detail: string; Icon: typeof MapPin }[] = [
  { id: "crew", detail: "Für Kamera, Licht, Ton, Regie und viele weitere Gewerke", Icon: Film },
  { id: "talent", detail: "Für Schauspiel, Model, Komparserie und ähnliche Tätigkeiten", Icon: Camera },
  { id: "location", detail: "Zum Beispiel Wohnung, Haus, Café oder Studio", Icon: MapPin },
  { id: "equipment", detail: "Zum Beispiel Kamera, Licht, Kostüm oder Fahrzeug", Icon: Package },
  { id: "company", detail: "Zum Beispiel Verleih, Studio oder Agentur", Icon: Building2 },
  { id: "search", detail: "Menschen, Orte oder Dinge für ein Projekt entdecken", Icon: Search },
];
const crewDepartments = getQuickStartDepartments();
const castDepartment = departments.find((department) => department.id === "cast");
const inputClass = "min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-base text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const screenContent: Record<QuickStartScreen, { title: string; description: string }> = {
  name: { title: "Wie heißt du?", description: "Mit diesem Namen wirst du auf CineGenius angesprochen." },
  goals: { title: "Was möchtest du auf CineGenius machen?", description: "Wähle alles aus, was zu dir passt. Du kannst später jederzeit weitere Bereiche ergänzen." },
  "crew-departments": { title: "In welchen Bereichen arbeitest du?", description: "Wähle ein oder mehrere Gewerke. Danach zeigen wir dir nur die passenden Tätigkeiten." },
  "crew-roles": { title: "Was machst du in diesen Bereichen?", description: "Wähle alle Tätigkeiten aus, unter denen andere dich finden sollen." },
  "person-city": { title: "Wo bist du tätig?", description: "Eine Stadt oder Region genügt. Eine genaue Privatadresse ist nicht nötig." },
  "talent-roles": { title: "Welche Rollen passen zu dir?", description: "Wähle eine oder mehrere Tätigkeiten. Du kannst sie später jederzeit ergänzen." },
  "talent-intro": { title: "Möchtest du etwas über dich erzählen?", description: "Ein kurzer Satz hilft anderen, dich einzuordnen. Dieser Schritt ist freiwillig." },
  "location-category": { title: "Was für einen Ort bietest du an?", description: "Wähle die Beschreibung, die am besten passt." },
  "location-details": { title: "Erzähl uns das Wichtigste über den Ort", description: "Name und Stadt sind nötig. Eine kurze Beschreibung kannst du hinzufügen." },
  "location-photo": { title: "Möchtest du ein Foto hinzufügen?", description: "Ein Foto macht deinen Entwurf anschaulicher. Du kannst es auch später ergänzen." },
  "location-price": { title: "Wie möchtest du den Preis angeben?", description: "Du kannst einen Tagespreis nennen oder erst Anfragen sammeln." },
  "equipment-category": { title: "Was möchtest du anbieten?", description: "Wähle die passende Art von Equipment oder Gegenstand." },
  "equipment-details": { title: "Wie heißt dein Angebot und wo ist es?", description: "Ein kurzer Titel und die Stadt reichen für den Anfang." },
  "equipment-photo": { title: "Möchtest du ein Foto hinzufügen?", description: "Ein Foto macht deinen Entwurf anschaulicher. Du kannst es auch später ergänzen." },
  "equipment-price": { title: "Wie möchtest du den Preis angeben?", description: "Du kannst einen Tagespreis nennen oder erst Anfragen sammeln." },
  "company-details": { title: "Wie heißt deine Firma und wo ist sie?", description: "Nach dem Abschluss wird dein Firmenprofil öffentlich angezeigt. Du kannst es anschließend ergänzen." },
  "company-photo": { title: "Möchtest du ein Logo hinzufügen?", description: "Ein Logo ist freiwillig und kann später ergänzt werden." },
  review: { title: "Prüfen und loslegen", description: "Ändere einzelne Angaben, bevor wir dein Profil oder private Angebotsentwürfe anlegen." },
};

type SaveState = "idle" | "saving" | "saved" | "error";

function primaryIntent(draft: QuickStartDraft): QuickStartIntent {
  return draft.intents.find((intent) => intent !== "search") ?? "search";
}

function screenForField(field: string, draft: QuickStartDraft): QuickStartScreen {
  if (field === "name") return "name";
  if (field === "goals") return "goals";
  if (field === "crew-departments") return "crew-departments";
  if (field === "crew-roles") return "crew-roles";
  if (field === "talent-roles") return "talent-roles";
  if (field === "personCity") return "person-city";
  if (field.startsWith("location-category")) return "location-category";
  if (field.startsWith("location-price")) return "location-price";
  if (field.startsWith("location-")) return "location-details";
  if (field.startsWith("equipment-category")) return "equipment-category";
  if (field.startsWith("equipment-price")) return "equipment-price";
  if (field.startsWith("equipment-")) return "equipment-details";
  if (field.startsWith("company-")) return "company-details";
  return buildQuickStartScreens(draft)[0]?.id ?? "name";
}

export default function ProfileSetupWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const isNewRegistration = params.get("welcome") === "1";
  const redirectTo = safeAuthRedirect(params.get("redirect") ?? undefined, "", ["/sign-in", "/sign-up", "/profile-setup", "/guided-profile", "/guided-listing", "/company-setup"]);
  const [draft, setDraft] = useState<QuickStartDraft>(START_QUICK_START_DRAFT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Der gespeicherte Fortschritt konnte nicht geladen werden.");
        return result.draft;
      }),
      fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Dein Profilstatus konnte nicht geprüft werden.");
        return result;
      }),
    ]).then(([saved, profile]) => {
      if (!active) return;
      const hasInProgressDraft = !!saved?.quickStart && saved.setupComplete !== true;
      if (saved?.setupComplete) {
        router.replace(saved.intent === "search" ? (redirectTo ?? "/search") : (redirectTo ?? "/dashboard"));
        return;
      }
      if (shouldSkipProfileSetup({
        hasExistingProfile: profile?.exists === true,
        hasInProgressDraft,
        isNewRegistration,
      })) {
        router.replace(redirectTo ?? "/dashboard");
        return;
      }
      const existingName = typeof profile?.profile?.display_name === "string" ? profile.profile.display_name : user?.fullName ?? "";
      setDraft(hasInProgressDraft
        ? normalizeQuickStartDraft(saved.quickStart)
        : { ...START_QUICK_START_DRAFT, name: existingName });
      setReady(true);
    }).catch((cause) => {
      if (!active) return;
      setLoadError(cause instanceof Error ? cause.message : "Dein Start konnte nicht geladen werden.");
      setReady(true);
    });
    return () => { active = false; };
  }, [isNewRegistration, loadAttempt, redirectTo, router, user?.fullName]);

  useEffect(() => {
    if (!ready || draft.name || !user?.fullName) return;
    setDraft((current) => current.name ? current : { ...current, name: user.fullName ?? "" });
  }, [ready, draft.name, user?.fullName]);

  const persist = useCallback((value: QuickStartDraft) => {
    setSaveState("saving");
    const queued = saveQueue.current.catch(() => false).then(async () => {
      try {
        const response = await fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: primaryIntent(value), setupComplete: false, quickStart: value, updatedAt: new Date().toISOString() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Dein Fortschritt konnte nicht gespeichert werden.");
        setSaveState("saved");
        return true;
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Dein Fortschritt konnte nicht gespeichert werden.");
        return false;
      }
    });
    saveQueue.current = queued;
    return queued;
  }, []);

  useEffect(() => {
    if (!ready || (!draft.name.trim() && draft.intents.length === 0)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(draft); }, 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, draft, persist]);

  const screens = useMemo(() => buildQuickStartScreens(draft), [draft]);
  const currentIndex = Math.max(0, screens.findIndex((screen) => screen.id === draft.step));
  const currentDefinition = screens[currentIndex] ?? screens[0];
  const stepContent = screenContent[currentDefinition?.id ?? "name"];
  const saveLabel = saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : "";
  const selectedRoles = useMemo(() => [
    ...(draft.sections.crew?.roles ?? []),
    ...(draft.sections.talent?.roles ?? []),
  ].filter((role, index, list) => list.findIndex((other) => other.departmentId === role.departmentId && other.role === role.role) === index), [draft.sections.crew?.roles, draft.sections.talent?.roles]);
  const departmentFilter = useMemo(() => draft.step === "talent-roles"
    ? (castDepartment ? [castDepartment.id] : [])
    : (draft.sections.crew?.departmentIds ?? []), [draft.step, draft.sections.crew?.departmentIds]);
  const roleMatches = useMemo(() => findQuickStartRoles(roleSearch, 50, departmentFilter), [roleSearch, departmentFilter]);
  const filteredDepartments = useMemo(() => {
    const query = departmentSearch.trim().toLocaleLowerCase("de");
    return crewDepartments.filter((department) => !query || department.label.toLocaleLowerCase("de").includes(query) || department.roles.some((role) => role.toLocaleLowerCase("de").includes(query)));
  }, [departmentSearch]);

  function update<K extends keyof QuickStartDraft>(key: K, value: QuickStartDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateSection(intent: QuickStartIntent, value: Partial<QuickStartIntentData>) {
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [intent]: { ...createQuickStartIntentData(), ...current.sections[intent], ...value },
      },
    }));
    setError("");
  }

  function toggleIntent(intent: QuickStartIntent) {
    setDraft((current) => {
      const selected = current.intents.includes(intent);
      return { ...current, intents: selected ? current.intents.filter((item) => item !== intent) : [...current.intents, intent] };
    });
    setError("");
  }

  function toggleDepartment(departmentId: string) {
    const current = draft.sections.crew ?? createQuickStartIntentData();
    const selected = current.departmentIds.includes(departmentId);
    updateSection("crew", {
      departmentIds: selected ? current.departmentIds.filter((item) => item !== departmentId) : [...current.departmentIds, departmentId],
      roles: selected ? current.roles.filter((role) => role.departmentId !== departmentId) : current.roles,
    });
  }

  function toggleRole(item: QuickStartRoleSelection) {
    const intent = draft.step === "talent-roles" ? "talent" : "crew";
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    const alreadySelected = data.roles.some((role) => role.departmentId === item.departmentId && role.role === item.role);
    updateSection(intent, { roles: alreadySelected ? data.roles.filter((role) => role.departmentId !== item.departmentId || role.role !== item.role) : [...data.roles, item] });
  }

  function focusValidation(field: string) {
    requestAnimationFrame(() => {
      const target = document.getElementById(`quick-start-${field}`) ?? document.querySelector<HTMLElement>("[data-quick-start-invalid='true']");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }

  async function goTo(step: QuickStartScreen) {
    setError("");
    const next = { ...draft, step };
    if (await persist(next)) setDraft(next);
  }

  async function next() {
    setError("");
    const validation = validateQuickStartScreen(draft, draft.step);
    if (validation) {
      setError(validation.message);
      focusValidation(validation.field);
      return;
    }
    const nextScreen = screens[Math.min(currentIndex + 1, screens.length - 1)]?.id ?? "review";
    const nextDraft = { ...draft, step: nextScreen };
    if (await persist(nextDraft)) setDraft(nextDraft);
  }

  async function back() {
    if (currentIndex === 0) return;
    const previousScreen = screens[currentIndex - 1]?.id ?? "name";
    await goTo(previousScreen);
  }

  async function skipOptional() {
    if (!currentDefinition?.optional) return;
    const nextScreen = screens[Math.min(currentIndex + 1, screens.length - 1)]?.id ?? "review";
    await goTo(nextScreen);
  }

  async function upload(file: File | undefined, intent: QuickStartIntent) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Bitte wähle eine Bilddatei aus."); return; }
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, quality: 0.82 });
      const form = new FormData();
      form.append("file", compressed);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error ?? "Das Foto konnte nicht hochgeladen werden.");
      const nextDraft = {
        ...draft,
        sections: { ...draft.sections, [intent]: { ...createQuickStartIntentData(), ...draft.sections[intent], imageUrl: result.url } },
      };
      setDraft(nextDraft);
      if (!(await persist(nextDraft))) setError("Das Foto wurde hochgeladen, aber der Fortschritt konnte nicht gespeichert werden. Bitte bleib auf dieser Seite und versuche es erneut.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Das Foto konnte nicht hochgeladen werden.");
    } finally { setUploading(false); }
  }

  async function clearAndContinue(completedDraft: QuickStartDraft) {
    const response = await fetch("/api/onboarding?type=quick-start", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Dein Einrichtungsstand konnte nicht abgeschlossen werden.");
    const destination = completedDraft.intents.some((intent) => intent !== "search") ? (redirectTo ?? "/dashboard") : (redirectTo ?? "/search");
    router.replace(destination);
  }

  async function finish() {
    const validation = validateQuickStartDraft(draft);
    if (validation) {
      const firstBadScreen = screenForField(validation.field, draft);
      setError(validation.message);
      const corrected = { ...draft, step: firstBadScreen };
      setDraft(corrected);
      focusValidation(validation.field);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    setError("");
    try {
      let progress: QuickStartDraft = {
        ...draft,
        step: "review",
        completed: { ...draft.completed, listings: { ...draft.completed.listings } },
      };
      if (!(await persist(progress))) return;

      if ((progress.intents.includes("crew") || progress.intents.includes("talent")) && !progress.completed.profile) {
        const positions = selectedRoles.map((role) => role.role);
        const profileTypes = getQuickStartProfileTypesForRoles(selectedRoles);
        const response = await fetch("/api/profile", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: progress.name.trim(), location: progress.personCity.trim(),
            profile_types: profileTypes, profile_type: profileTypes[0] ?? null,
            positions, bio: progress.talentIntro.trim(), available: true,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Dein Profil konnte nicht erstellt werden.");
        progress = { ...progress, completed: { ...progress.completed, profile: true } };
        setDraft(progress);
        if (!(await persist(progress))) throw new Error("Das Profil wurde erstellt, aber dein Einrichtungsstand konnte nicht aktualisiert werden. Bitte versuche es erneut.");
      }

      for (const intent of ["location", "equipment"] as const) {
        if (!progress.intents.includes(intent) || progress.completed.listings[intent]) continue;
        if (!progress.requestKeys[intent]) {
          progress = { ...progress, requestKeys: { ...progress.requestKeys, [intent]: crypto.randomUUID() } };
          setDraft(progress);
          if (!(await persist(progress))) throw new Error("Dein Fortschritt konnte vor dem Speichern des Angebots nicht gesichert werden.");
        }
        const section = progress.sections[intent] ?? createQuickStartIntentData();
        const vehicle = intent === "equipment" && section.category === "Bild-Fahrzeug";
        const response = await fetch("/api/listings", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: vehicle ? "vehicle" : intent === "location" ? "location" : "prop",
            category: section.category, title: section.title.trim(), city: section.city.trim(),
            description: section.description.trim(), price: section.priceOnRequest ? 0 : Number(section.price) || 0,
            image_url: section.imageUrl || null, draft: true,
            metadata: { price_on_request: section.priceOnRequest, onboarding_setup: true },
            onboarding_request_key: progress.requestKeys[intent],
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.data?.id) throw new Error(result.error ?? "Der private Angebotsentwurf konnte nicht gespeichert werden.");
        progress = { ...progress, completed: { ...progress.completed, listings: { ...progress.completed.listings, [intent]: String(result.data.id) } } };
        setDraft(progress);
        if (!(await persist(progress))) throw new Error("Der Angebotsentwurf wurde gespeichert, aber dein Einrichtungsstand konnte nicht aktualisiert werden. Bitte versuche es erneut.");
      }

      if (progress.intents.includes("company") && !progress.completed.company) {
        if (!progress.requestKeys.company) {
          progress = { ...progress, requestKeys: { ...progress.requestKeys, company: crypto.randomUUID() } };
          setDraft(progress);
          if (!(await persist(progress))) throw new Error("Dein Fortschritt konnte vor dem Speichern des Firmenprofils nicht gesichert werden.");
        }
        const section = progress.sections.company ?? createQuickStartIntentData();
        const response = await fetch("/api/companies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: section.title.trim(), city: section.city.trim(), description: section.description.trim(), logo_url: section.imageUrl || null, onboarding_request_key: progress.requestKeys.company }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.data?.id) throw new Error(result.error ?? "Das Firmenprofil konnte nicht gespeichert werden.");
        progress = { ...progress, completed: { ...progress.completed, company: String(result.data.id) } };
        setDraft(progress);
        if (!(await persist(progress))) throw new Error("Das Firmenprofil wurde gespeichert, aber dein Einrichtungsstand konnte nicht aktualisiert werden. Bitte versuche es erneut.");
      }

      await clearAndContinue(progress);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deine Angaben konnten nicht vollständig gespeichert werden.");
    } finally { setSaving(false); }
  }

  const selectedIntentTitles = draft.intents.map((intent) => QUICK_START_INTENT_LABELS[intent]);
  const hasProfileIntent = draft.intents.includes("crew") || draft.intents.includes("talent");
  const hasCompanyIntent = draft.intents.includes("company");
  const hasOfferIntent = draft.intents.includes("location") || draft.intents.includes("equipment");
  const completionActionLabel = hasProfileIntent
    ? hasCompanyIntent && hasOfferIntent ? "Profil & Firma erstellen, Angebote speichern"
      : hasCompanyIntent ? "Profil & Firma öffentlich erstellen"
      : hasOfferIntent ? "Profil öffentlich erstellen & Angebote speichern"
      : "Profil öffentlich erstellen"
    : hasCompanyIntent
      ? hasOfferIntent ? "Firma öffentlich eintragen & Angebote speichern" : "Firma öffentlich eintragen"
      : hasOfferIntent ? "Private Angebotsentwürfe speichern" : "Los zur Suche";
  const reviewEditingIntent = (intent: QuickStartIntent) => { void goTo(getFirstScreenForIntent(draft, intent)); };

  if (!ready) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Dein Start wird geladen …</main>;
  if (loadError) return <main className="min-h-[75vh] bg-bg-primary px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 sm:pt-28"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-6 text-center"><p role="alert" className="text-sm leading-6 text-red-300">{loadError}</p><p className="mt-2 text-xs leading-5 text-text-muted">Damit kein gespeicherter Fortschritt verloren geht, starte bitte erst weiter, wenn der Status geladen wurde.</p><button type="button" onClick={() => { setReady(false); setLoadError(""); setLoadAttempt((value) => value + 1); }} className="mt-5 min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Erneut versuchen</button></section></main>;

  return (
    <main className="min-h-[75vh] bg-bg-primary px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-24 sm:pt-28">
      <div className="mx-auto w-full max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Dein Start auf CineGenius</p>
        <h1 className="mb-2 break-words font-display text-3xl font-bold text-text-primary sm:text-4xl">{stepContent.title}</h1>
        <p className="mb-6 max-w-2xl text-sm leading-6 text-text-muted">{stepContent.description}</p>

        <div className="mb-6" aria-label={`Schritt ${currentIndex + 1} von ${screens.length}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <span>Schritt {currentIndex + 1} von {screens.length} · {currentDefinition?.id === "review" ? "Vorschau" : currentDefinition?.intent ? QUICK_START_INTENT_LABELS[currentDefinition.intent] : currentDefinition?.id === "goals" ? "Deine Auswahl" : "Dein Name"}</span>
            <span role="status" aria-live="polite">{saveLabel}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${((currentIndex + 1) / screens.length) * 100}%` }} /></div>
        </div>

        <section className="min-w-0 rounded-2xl border border-border bg-bg-secondary p-4 sm:p-7">
          {draft.step === "name" && <div>
            <label htmlFor="quick-start-name" className="mb-2 block text-sm font-medium text-text-primary">Dein Name <span className="text-gold">*</span></label>
            <input id="quick-start-name" autoComplete="name" maxLength={120} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Vor- und Nachname oder Künstlername" className={inputClass} aria-describedby="quick-start-name-help" />
            <p id="quick-start-name-help" className="mt-2 text-xs leading-5 text-text-muted">Du kannst später festlegen, welche Angaben öffentlich sichtbar sind.</p>
          </div>}

          {draft.step === "goals" && <div id="quick-start-goals" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">
            {paths.map(({ id, detail, Icon }) => {
              const selected = draft.intents.includes(id);
              return <button key={id} type="button" aria-pressed={selected} onClick={() => toggleIntent(id)} className={`flex min-h-24 min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition-colors ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}>
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-gold/15 text-gold" : "bg-bg-elevated text-text-muted"}`}><Icon size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-text-primary">{QUICK_START_INTENT_LABELS[id]}</span><span className="mt-1 block break-words text-xs leading-5 text-text-muted">{detail}</span></span>
                <span aria-hidden="true" className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-gold bg-gold text-bg-primary" : "border-border text-transparent"}`}>✓</span>
              </button>;
            })}
          </div>}

          {draft.step === "crew-departments" && <div>
            <label htmlFor="quick-start-department-search" className="mb-2 block text-sm font-medium text-text-primary">Gewerk suchen</label>
            <div className="relative mb-4"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-department-search" value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Zum Beispiel Kamera, Ton oder Grip" className={`${inputClass} pl-10`} /></div>
            {draft.sections.crew?.departmentIds.length ? <p className="mb-3 text-xs leading-5 text-text-muted">Ausgewählt: {draft.sections.crew.departmentIds.map((id) => departments.find((item) => item.id === id)?.label).filter(Boolean).join(", " )}. Wenn du ein Gewerk entfernst, werden nur dessen Tätigkeiten abgewählt.</p> : null}
            <div id="quick-start-crew-departments" tabIndex={-1} className="grid gap-2 sm:grid-cols-2">
              {filteredDepartments.map((department) => {
                const selected = draft.sections.crew?.departmentIds.includes(department.id) ?? false;
                return <button key={department.id} type="button" aria-pressed={selected} onClick={() => toggleDepartment(department.id)} className={`flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className="min-w-0 break-words text-sm font-medium text-text-primary">{department.emoji} {department.label}</span><span className="shrink-0 text-xs text-text-muted">{department.roles.length} Tätigkeiten</span></button>;
              })}
              {!filteredDepartments.length && <p className="col-span-full rounded-xl border border-border p-4 text-sm text-text-muted">Kein Gewerk gefunden. Suche nach einer Tätigkeit oder einem anderen Begriff.</p>}
            </div>
          </div>}

          {(draft.step === "crew-roles" || draft.step === "talent-roles") && <div>
            {draft.step === "crew-roles" && <div className="mb-4 flex flex-wrap gap-2">{(draft.sections.crew?.departmentIds ?? []).map((id) => { const department = departments.find((item) => item.id === id); return department ? <span key={id} className="rounded-full border border-gold/35 bg-gold/10 px-3 py-2 text-xs text-gold">{department.emoji} {department.label}</span> : null; })}</div>}
            <label htmlFor="quick-start-role-search" className="mb-2 block text-sm font-medium text-text-primary">Tätigkeit suchen</label>
            <div className="relative mb-4"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-role-search" autoComplete="off" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Zum Beispiel Key Grip, Schnitt oder Model" className={`${inputClass} pl-10`} /></div>
            {roleSearch.trim() ? <div className="mb-4 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border bg-bg-primary p-2">
              {roleMatches.map((item, index) => {
                const data = draft.step === "talent-roles" ? draft.sections.talent : draft.sections.crew;
                const selected = data?.roles.some((role) => role.departmentId === item.departmentId && role.role === item.role) ?? false;
                return <button id={index === 0 ? `quick-start-${draft.step}` : undefined} key={`${item.departmentId}:${item.role}`} type="button" aria-pressed={selected} onClick={() => toggleRole(item)} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-gold/10 text-gold" : "text-text-primary hover:bg-bg-elevated"}`}><span className="min-w-0"><span className="block break-words text-sm font-medium">{item.role}</span><span className="block text-xs text-text-muted">{item.departmentLabel}</span></span><span aria-hidden="true" className="shrink-0">{selected ? "✓" : "+"}</span></button>;
              })}
              {!roleMatches.length && <p className="px-3 py-4 text-sm text-text-muted">Keine passende Tätigkeit gefunden. Versuche einen anderen Begriff.</p>}
            </div> : draft.step === "talent-roles" ? <div id="quick-start-talent-roles" tabIndex={-1} className="grid gap-2 sm:grid-cols-2">{(castDepartment?.roles ?? []).map((role) => { const selected = draft.sections.talent?.roles.some((item) => item.role === role) ?? false; return <button key={role} type="button" aria-pressed={selected} onClick={() => toggleRole({ departmentId: "cast", role })} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm ${selected ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-primary text-text-primary"}`}><span className="break-words">{role}</span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>; })}</div> : <div className="space-y-3" id="quick-start-crew-roles" tabIndex={-1}>
              {(draft.sections.crew?.departmentIds ?? []).map((id) => {
                const department = departments.find((item) => item.id === id);
                if (!department) return null;
                const roleOptions = [...new Set(department.roles)];
                return <details key={id} className="group rounded-xl border border-border bg-bg-primary" open={(draft.sections.crew?.departmentIds.length ?? 0) === 1 ? true : undefined}><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text-primary"><span className="break-words">{department.emoji} {department.label}</span><span className="shrink-0 text-xs font-normal text-text-muted">{roleOptions.length} Tätigkeiten</span></summary><div className="max-h-72 space-y-1 overflow-y-auto border-t border-border p-2">{roleOptions.map((role) => { const selected = draft.sections.crew?.roles.some((item) => item.departmentId === id && item.role === role) ?? false; return <button key={role} type="button" aria-pressed={selected} onClick={() => toggleRole({ departmentId: id, role })} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${selected ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated"}`}><span className="break-words">{role}</span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>; })}</div></details>;
              })}
            </div>}
            <div className="mt-4 flex flex-wrap gap-2">{(draft.step === "talent-roles" ? draft.sections.talent?.roles : draft.sections.crew?.roles)?.map((item) => <span key={`${item.departmentId}:${item.role}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-2 text-xs text-gold"><span className="break-words">{item.role}</span><button type="button" aria-label={`${item.role} entfernen`} onClick={() => toggleRole(item)} className="min-h-6 min-w-6 rounded-full hover:bg-bg-elevated">×</button></span>)}</div>
          </div>}

          {draft.step === "person-city" && <div><label htmlFor="quick-start-person-city" className="mb-2 block text-sm font-medium text-text-primary">Stadt oder Region <span className="text-gold">*</span></label><input id="quick-start-person-city" autoComplete="address-level2" maxLength={100} value={draft.personCity} onChange={(event) => update("personCity", event.target.value)} placeholder="Zum Beispiel Leipzig" className={inputClass} /></div>}

          {draft.step === "talent-intro" && <div><label htmlFor="quick-start-talent-intro" className="mb-2 block text-sm font-medium text-text-primary">Kurze Vorstellung <span className="text-text-muted">(freiwillig)</span></label><textarea id="quick-start-talent-intro" rows={5} maxLength={1200} value={draft.talentIntro} onChange={(event) => update("talentIntro", event.target.value)} placeholder="Was sollten andere über dich wissen?" className="w-full rounded-xl border border-border bg-bg-primary p-4 text-base text-text-primary outline-none focus:border-gold" /></div>}

          {(draft.step === "location-category" || draft.step === "equipment-category") && (() => {
            const intent = draft.step.startsWith("location") ? "location" : "equipment";
            const options = QUICK_START_CATEGORIES[intent];
            const category = draft.sections[intent]?.category;
            return <div id={`quick-start-${intent}-category`} tabIndex={-1} className="grid gap-2 sm:grid-cols-2">{options.map((option) => <button key={option.value} type="button" aria-pressed={category === option.value} onClick={() => updateSection(intent, { category: option.value })} className={`min-h-16 min-w-0 rounded-xl border px-4 py-3 text-left ${category === option.value ? "border-gold bg-gold/10" : "border-border bg-bg-primary"}`}><span className="block break-words text-sm font-semibold text-text-primary">{option.label}</span><span className="mt-1 block break-words text-xs text-text-muted">{option.example}</span></button>)}</div>;
          })()}

          {(draft.step === "location-details" || draft.step === "equipment-details" || draft.step === "company-details") && (() => {
            const intent = draft.step.startsWith("location") ? "location" : draft.step.startsWith("equipment") ? "equipment" : "company";
            const data = draft.sections[intent] ?? createQuickStartIntentData();
            const isCompany = intent === "company";
            return <div className="space-y-4">
              <div><label htmlFor={`quick-start-${intent}-title`} className="mb-2 block text-sm font-medium text-text-primary">{isCompany ? "Firmenname" : "Name des Angebots"} <span className="text-gold">*</span></label><input id={`quick-start-${intent}-title`} autoComplete={isCompany ? "organization" : "off"} maxLength={200} value={data.title} onChange={(event) => updateSection(intent, { title: event.target.value })} placeholder={isCompany ? "Zum Beispiel Lichtverleih Müller" : intent === "location" ? "Zum Beispiel Altbauwohnung mit Balkon" : "Zum Beispiel LED-Flächenleuchte"} className={inputClass} /></div>
              <div><label htmlFor={`quick-start-${intent}-city`} className="mb-2 block text-sm font-medium text-text-primary">Stadt oder Region <span className="text-gold">*</span></label><input id={`quick-start-${intent}-city`} autoComplete="address-level2" maxLength={100} value={data.city} onChange={(event) => updateSection(intent, { city: event.target.value })} placeholder="Zum Beispiel Leipzig" className={inputClass} /></div>
              <div><label htmlFor={`quick-start-${intent}-description`} className="mb-2 block text-sm font-medium text-text-primary">Kurze Beschreibung <span className="text-text-muted">(freiwillig)</span></label><textarea id={`quick-start-${intent}-description`} rows={4} maxLength={3000} value={data.description} onChange={(event) => updateSection(intent, { description: event.target.value })} placeholder={isCompany ? "Was bietet deine Firma an?" : intent === "location" ? "Was ist an diesem Ort besonders?" : "Was ist enthalten und in welchem Zustand ist es?"} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-base text-text-primary outline-none focus:border-gold" /></div>
            </div>;
          })()}

          {(draft.step === "location-photo" || draft.step === "equipment-photo" || draft.step === "company-photo") && (() => {
            const intent: QuickStartIntent = draft.step.startsWith("location") ? "location" : draft.step.startsWith("equipment") ? "equipment" : "company";
            const data = draft.sections[intent] ?? createQuickStartIntentData();
            return <div>
              {data.imageUrl ? <div className="space-y-3"><Image src={data.imageUrl} alt={intent === "company" ? "Vorschau des Firmenlogos" : "Vorschau des Angebotsfotos"} width={960} height={640} sizes="(max-width: 640px) 100vw, 720px" className="max-h-64 w-full rounded-xl border border-border object-cover" /><button type="button" onClick={() => updateSection(intent, { imageUrl: "" })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm text-text-secondary"><Trash2 size={15} /> Foto entfernen</button></div> : <label className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-primary p-5 text-center hover:border-gold/50 ${uploading ? "pointer-events-none opacity-60" : ""}`}><ImagePlus className="text-gold" /><span className="text-sm font-medium text-text-primary">{uploading ? "Foto wird hochgeladen …" : intent === "company" ? "Logo auswählen" : "Foto auswählen"}</span><span className="text-xs text-text-muted">JPG, PNG oder WEBP</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(event) => void upload(event.target.files?.[0], intent)} /></label>}
              {uploading && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-text-muted"><Loader2 size={14} className="animate-spin" /> Upload läuft …</p>}
            </div>;
          })()}

          {(draft.step === "location-price" || draft.step === "equipment-price") && (() => {
            const intent = draft.step.startsWith("location") ? "location" : "equipment";
            const data = draft.sections[intent] ?? createQuickStartIntentData();
            return <div className="space-y-3">
              <button type="button" aria-pressed={data.priceOnRequest} onClick={() => updateSection(intent, { priceOnRequest: true })} className={`min-h-14 w-full rounded-xl border px-4 text-left text-sm ${data.priceOnRequest ? "border-gold bg-gold/10 text-text-primary" : "border-border bg-bg-primary text-text-secondary"}`}>Preis auf Anfrage</button>
              <button type="button" aria-pressed={!data.priceOnRequest} onClick={() => updateSection(intent, { priceOnRequest: false })} className={`min-h-14 w-full rounded-xl border px-4 text-left text-sm ${!data.priceOnRequest ? "border-gold bg-gold/10 text-text-primary" : "border-border bg-bg-primary text-text-secondary"}`}>Tagespreis angeben</button>
              {!data.priceOnRequest && <div><label htmlFor={`quick-start-${intent}-price`} className="mb-2 block text-sm font-medium text-text-primary">Preis pro Tag in Euro</label><input id={`quick-start-${intent}-price`} type="number" min="0" step="1" value={data.price} onChange={(event) => updateSection(intent, { price: event.target.value })} placeholder="Zum Beispiel 150" className={inputClass} /></div>}
            </div>;
          })()}

          {draft.step === "review" && <div className="space-y-4">
            <ReviewSection title="Dein Name" onEdit={() => void goTo("name")}><ReviewRow label="Name" value={draft.name} /></ReviewSection>
            <ReviewSection title="Deine Auswahl" onEdit={() => void goTo("goals")}><p className="break-words text-sm text-text-primary">{selectedIntentTitles.join(" · ") || "—"}</p></ReviewSection>
            {(draft.intents.includes("crew") || draft.intents.includes("talent")) && <ReviewSection title="Dein Profil" onEdit={() => reviewEditingIntent(draft.intents.includes("crew") ? "crew" : "talent")}>
              <ReviewRow label="Tätigkeiten" value={selectedRoles.map((role) => role.role).join(", ")} />
              <ReviewRow label="Standort" value={draft.personCity} />
              {draft.talentIntro.trim() && <ReviewRow label="Vorstellung" value={draft.talentIntro} />}
              <p className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-xs leading-5 text-text-muted">Mit „Profil öffentlich erstellen“ werden deine Angaben für andere Mitglieder sichtbar. Du kannst dein Profil danach weiterbearbeiten.</p>
            </ReviewSection>}
            {draft.intents.filter((intent) => intent === "location" || intent === "equipment").map((intent) => {
              const data = draft.sections[intent] ?? createQuickStartIntentData();
              const categoryOptions = QUICK_START_CATEGORIES[intent];
              const categoryName = categoryOptions.find((item) => item.value === data.category)?.label ?? data.category;
              return <ReviewSection key={intent} title={QUICK_START_INTENT_LABELS[intent]} onEdit={() => reviewEditingIntent(intent)}>
                <ReviewRow label="Art" value={categoryName} /><ReviewRow label="Angebot" value={data.title} /><ReviewRow label="Standort" value={data.city} />
                {data.description.trim() && <ReviewRow label="Beschreibung" value={data.description} />}
                <ReviewRow label="Preis" value={data.priceOnRequest ? "Auf Anfrage" : `${data.price} € pro Tag`} />
                {data.imageUrl && <Image src={data.imageUrl} alt="Vorschau des Angebotsfotos" width={720} height={480} sizes="(max-width: 640px) 100vw, 640px" className="max-h-40 w-full rounded-lg object-cover" />}
                <p className="rounded-xl border border-border bg-bg-primary p-3 text-xs leading-5 text-text-muted">Wir speichern das Angebot zunächst privat als Entwurf. Erst im nächsten Schritt kannst du es mit „Angebot veröffentlichen“ öffentlich sichtbar machen.</p>
              </ReviewSection>;
            })}
            {draft.intents.includes("company") && (() => { const data = draft.sections.company ?? createQuickStartIntentData(); return <ReviewSection title={QUICK_START_INTENT_LABELS.company} onEdit={() => reviewEditingIntent("company")}><ReviewRow label="Firma" value={data.title} /><ReviewRow label="Standort" value={data.city} />{data.description && <ReviewRow label="Beschreibung" value={data.description} />}{data.imageUrl && <Image src={data.imageUrl} alt="Vorschau des Firmenlogos" width={320} height={160} sizes="320px" className="max-h-32 rounded-lg object-contain" />}<p className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-xs leading-5 text-text-secondary">Mit „{completionActionLabel}“ wird dein Firmenprofil direkt öffentlich auf CineGenius angezeigt. Firmenprofile kannst du danach jederzeit bearbeiten. Angebote bleiben private Entwürfe, bis du sie selbst veröffentlichst.</p></ReviewSection>; })()}
            {draft.intents.includes("search") && <p className="rounded-xl border border-border bg-bg-primary p-4 text-sm leading-6 text-text-secondary">Du kannst nach dem Abschluss direkt Personen, Orte und Angebote entdecken.</p>}
          </div>}
        </section>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300">{error}</p>}

        <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <button type="button" disabled={saving || uploading || currentIndex === 0} onClick={() => void back()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={16} /> Zurück</button>
          {draft.step !== "review" ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {currentDefinition?.optional && <button type="button" disabled={saving || uploading} onClick={() => void skipOptional()} className="min-h-12 rounded-xl border border-border px-4 text-sm text-text-secondary disabled:opacity-50">Später ergänzen</button>}
            <button type="button" disabled={saving || uploading} onClick={() => void next()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={16} className="animate-spin" /> Speichert …</> : <>Weiter <ArrowRight size={16} /></>}</button>
          </div> : <button type="button" disabled={saving || uploading} onClick={() => void finish()} className="inline-flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-center text-sm font-semibold leading-5 text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={16} className="shrink-0 animate-spin" /><span>Wird gespeichert …</span></> : <><CheckCircle2 size={17} className="shrink-0" /><span>{completionActionLabel}</span></>}</button>}
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-text-muted">Dein Fortschritt wird privat gespeichert. Du kannst später an dieser Stelle weitermachen.</p>
      </div>
    </main>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return <section className="min-w-0 space-y-3 rounded-xl border border-border bg-bg-primary p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-words text-sm font-semibold text-text-primary">{title}</h2><button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-gold hover:bg-gold/10">Ändern</button></div>{children}</section>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-bg-secondary px-3 py-2"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 break-words whitespace-pre-wrap text-sm text-text-primary">{value || "—"}</p></div>;
}
