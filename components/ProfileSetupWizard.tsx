"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowLeft, ArrowRight, Building2, Camera, CheckCircle2, Film, ImagePlus,
  Loader2, MapPin, Package, Search, Trash2, Lock, UserRound,
} from "lucide-react";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES } from "@/lib/compressImage";
import { departments, getDepartmentRoleSearchTerms } from "@/lib/departments";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { shouldSkipProfileSetup } from "@/lib/profile-setup-flow";
import {
  buildQuickStartScreens, createQuickStartIntentData, findQuickStartRoles, getQuickStartDepartments, getQuickStartIntroIntents,
  getQuickStartProfileTypesForRoles, normalizeQuickStartDraft, QUICK_START_CATEGORIES,
  QUICK_START_INTENT_LABELS, START_QUICK_START_DRAFT,
  validateQuickStartDraft, validateQuickStartScreen, validateQuickStartIntentDetails,
  type QuickStartDraft, type QuickStartIntent, type QuickStartIntentData,
  type QuickStartRoleSelection, type QuickStartScreen,
  type QuickStartProviderIntent,
} from "@/lib/quick-start-flow";
import CateringCompanyFields from "@/components/CateringCompanyFields";
import { CATERING_COMPANY_CATEGORY, EMPTY_CATERING_COMPANY_DETAILS, getCateringCompanySearchTerms } from "@/lib/catering-taxonomy";

const paths: { id: QuickStartIntent; detail: string; Icon: typeof MapPin }[] = [
  { id: "crew", detail: "Für Kamera, Licht, Ton, Regie und viele weitere Gewerke", Icon: Film },
  { id: "talent", detail: "Schauspiel, Model oder Komparserie", Icon: Camera },
  { id: "location", detail: "Zum Beispiel Wohnung, Haus, Café oder Studio", Icon: MapPin },
  { id: "equipment", detail: "Technik, Fahrzeuge oder Requisiten", Icon: Package },
  { id: "company", detail: "Zum Beispiel Catering, Verleih oder Studio", Icon: Building2 },
  { id: "search", detail: "Menschen, Orte oder Dinge für ein Projekt entdecken", Icon: Search },
];
const crewDepartments = getQuickStartDepartments();
const castDepartment = departments.find((department) => department.id === "cast");
const inputClass = "min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-base text-text-primary outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
const stepContent: Record<QuickStartScreen, { title: string; description: string }> = {
  name: { title: "Wie heißt du?", description: "Dein Name wird für dein CineGenius-Profil verwendet." },
  location: { title: "Wo bist du zu Hause?", description: "Stadt und Land helfen dabei, dich und deine Angebote in deiner Region zu finden. Für ein Angebot kannst du später einen anderen Ort angeben." },
  goals: { title: "Was möchtest du auf CineGenius machen?", description: "Du kannst später jederzeit weitere Bereiche ergänzen." },
  details: { title: "Was passt zu deiner Auswahl?", description: "Wir zeigen nur die Angaben für den Bereich, den du gerade einrichtest." },
  intro: { title: "Foto und kurze Vorstellung", description: "Diese Ergänzungen sind freiwillig. Du kannst sie jederzeit später hinzufügen." },
  review: { title: "Prüfen und abschließen", description: "Sieh dir an, was angelegt wird. Über „Ändern“ springst du direkt zum passenden Abschnitt." },
};
const countries = ["Deutschland", "Österreich", "Schweiz"];

type SaveState = "idle" | "saving" | "saved" | "error";

function primaryIntent(draft: QuickStartDraft): QuickStartIntent {
  return draft.intents.find((intent) => intent !== "search") ?? "search";
}

function intentForField(field: string): QuickStartIntent | null {
  if (field.startsWith("crew-")) return "crew";
  if (field.startsWith("talent-")) return "talent";
  if (field.startsWith("location-")) return "location";
  if (field.startsWith("equipment-")) return "equipment";
  if (field.startsWith("company-")) return "company";
  return null;
}

function screenForField(field: string): QuickStartScreen {
  if (field === "name") return "name";
  if (field === "personCity" || field === "personCountry") return "location";
  if (field === "goals") return "goals";
  if (field.endsWith("-price")) return "intro";
  if (field.startsWith("company-catering")) return "intro";
  if (field.startsWith("company-photo") || field.startsWith("location-photo") || field.startsWith("equipment-photo")) return "intro";
  if (intentForField(field)) return "details";
  return "review";
}

export default function ProfileSetupWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const isNewRegistration = params.get("welcome") === "1";
  const resumeIncomplete = params.get("resume") === "1";
  const redirectTo = safeAuthRedirect(params.get("redirect") ?? undefined, "", ["/sign-in", "/sign-up", "/profile-setup", "/guided-profile", "/guided-listing", "/company-setup"]);
  const [draft, setDraft] = useState<QuickStartDraft>(START_QUICK_START_DRAFT);
  const [finished, setFinished] = useState<QuickStartDraft | null>(null);
  const [profileIsPrivate, setProfileIsPrivate] = useState(false);
  const [profilePublic, setProfilePublic] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [companyCategorySearch, setCompanyCategorySearch] = useState("");
  const [countryOther, setCountryOther] = useState(false);
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
      fetch("/api/user-settings", { cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null),
    ]).then(([saved, profile, settings]) => {
      if (!active) return;
      setProfileIsPrivate(settings?.settings?.profile_visibility === "private");
      const hasInProgressDraft = !!saved?.quickStart && saved.setupComplete !== true;
      if (saved?.setupComplete) {
        router.replace(saved.intent === "search" ? (redirectTo || "/search") : (redirectTo || "/dashboard"));
        return;
      }
      if (shouldSkipProfileSetup({ hasExistingProfile: profile?.exists === true, hasInProgressDraft, isNewRegistration })) {
        router.replace(redirectTo || "/dashboard");
        return;
      }
      const existingName = typeof profile?.profile?.display_name === "string" ? profile.profile.display_name : user?.fullName ?? "";
      let nextDraft = hasInProgressDraft
        ? normalizeQuickStartDraft(saved.quickStart)
        : { ...START_QUICK_START_DRAFT, name: existingName };
      if (resumeIncomplete && hasInProgressDraft) {
        const missing = validateQuickStartDraft(nextDraft);
        if (missing) nextDraft = { ...nextDraft, step: screenForField(missing.field), activeIntent: intentForField(missing.field) ?? nextDraft.activeIntent };
      }
      setDraft(nextDraft);
      setCountryOther(!countries.includes(nextDraft.personCountry));
      setReady(true);
    }).catch((cause) => {
      if (!active) return;
      setLoadError(cause instanceof Error ? cause.message : "Dein Start konnte nicht geladen werden.");
      setReady(true);
    });
    return () => { active = false; };
  }, [isNewRegistration, resumeIncomplete, loadAttempt, redirectTo, router, user?.fullName]);

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
    if (!ready || saving || finished || draft.welcomeAcknowledged === false) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(draft); }, 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, draft, persist, saving, finished]);

  const screens = useMemo(() => buildQuickStartScreens(draft), [draft]);
  const currentIndex = Math.max(0, screens.findIndex((screen) => screen.id === draft.step));
  const currentContent = stepContent[draft.step];
  const saveLabel = saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : "";
  const detailIntents = draft.intents.filter((intent): intent is QuickStartProviderIntent => intent !== "search");
  const introIntents = getQuickStartIntroIntents(draft.intents);
  const activeIntent = draft.activeIntent && draft.intents.includes(draft.activeIntent)
    ? draft.activeIntent
    : detailIntents[0] ?? "search";
  const activeDetailIndex = activeIntent === "search" ? 0 : Math.max(0, detailIntents.indexOf(activeIntent));
  const activeIntroIndex = Math.max(0, introIntents.indexOf(activeIntent));
  useEffect(() => {
    setRoleSearch("");
    setDepartmentSearch("");
    setCompanyCategorySearch("");
  }, [activeIntent]);
  const selectedRoles = useMemo(() => [
    ...(draft.sections.crew?.roles ?? []),
    ...(draft.sections.talent?.roles ?? []),
  ].filter((role, index, list) => list.findIndex((other) => other.departmentId === role.departmentId && other.role === role.role) === index), [draft.sections.crew?.roles, draft.sections.talent?.roles]);
  const filteredDepartments = useMemo(() => {
    const query = departmentSearch.trim().toLocaleLowerCase("de");
    return crewDepartments.filter((department) => !query || department.label.toLocaleLowerCase("de").includes(query) || department.roles.some((role) => getDepartmentRoleSearchTerms(department, role).some((term) => term.toLocaleLowerCase("de").includes(query))));
  }, [departmentSearch]);
  const selectedIntentTitles = draft.intents.map((intent) => QUICK_START_INTENT_LABELS[intent]);
  const hasProfileIntent = draft.intents.includes("crew") || draft.intents.includes("talent");
  const hasCompanyIntent = draft.intents.includes("company");
  const hasOfferIntent = draft.intents.includes("location") || draft.intents.includes("equipment");
  const completionActionLabel = hasProfileIntent
    ? profileIsPrivate ? "Privates Profil speichern und Einrichtung abschließen" : hasCompanyIntent && hasOfferIntent ? "Profil und Firma veröffentlichen, Entwürfe speichern"
      : hasCompanyIntent ? "Profil und Firma veröffentlichen"
        : hasOfferIntent ? "Profil veröffentlichen und Entwürfe speichern"
          : "Profil veröffentlichen"
    : hasCompanyIntent
      ? hasOfferIntent ? "Firma eintragen und Angebote speichern" : "Firma eintragen"
      : hasOfferIntent ? "Private Angebotsentwürfe speichern" : "Los zur Suche";

  function update<K extends keyof QuickStartDraft>(key: K, value: QuickStartDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateSection(intent: QuickStartIntent, value: Partial<QuickStartIntentData>) {
    setDraft((current) => ({ ...current, sections: { ...current.sections, [intent]: { ...createQuickStartIntentData(), ...current.sections[intent], ...value } } }));
    setError("");
  }

  function toggleIntent(intent: QuickStartIntent) {
    setDraft((current) => {
      const selected = current.intents.includes(intent);
      const intents = selected ? current.intents.filter((item) => item !== intent) : [...current.intents, intent];
      const active = current.activeIntent && intents.includes(current.activeIntent)
        ? current.activeIntent
        : intents.find((item) => item !== "search") ?? "search";
      return { ...current, intents, activeIntent: active, sections: !selected && !current.sections[intent]
        ? { ...current.sections, [intent]: createQuickStartIntentData() }
        : current.sections };
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

  function toggleRole(item: QuickStartRoleSelection, intent: "crew" | "talent") {
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    const alreadySelected = data.roles.some((role) => role.departmentId === item.departmentId && role.role === item.role);
    const departmentIds = intent === "crew" && !data.departmentIds.includes(item.departmentId)
      ? [...data.departmentIds, item.departmentId]
      : data.departmentIds;
    updateSection(intent, {
      departmentIds,
      roles: alreadySelected ? data.roles.filter((role) => role.departmentId !== item.departmentId || role.role !== item.role) : [...data.roles, item],
    });
  }

  function focusValidation(field: string) {
    requestAnimationFrame(() => {
      const fieldIds: Record<string, string> = {
        personCity: "quick-start-person-city",
        personCountry: "quick-start-person-country",
        "crew-roles": "quick-start-crew-role-search",
        "talent-roles": "quick-start-talent-role-search",
      };
      const target = document.getElementById(fieldIds[field] ?? `quick-start-${field}`) ?? document.querySelector<HTMLElement>("[data-quick-start-invalid='true']");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }

  async function transition(step: QuickStartScreen, intent = activeIntent) {
    if (saving) return;
    setError("");
    const next = { ...draft, step, activeIntent: intent };
    setSaving(true);
    try {
      if (await persist(next)) {
        setDraft(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    setError("");
    const validation = draft.step === "details"
      ? validateQuickStartIntentDetails(draft, activeIntent)
      : validateQuickStartScreen(draft, draft.step, activeIntent);
    if (validation) {
      setError(validation.message);
      const matchingIntent = intentForField(validation.field) ?? activeIntent;
      if (matchingIntent !== activeIntent) setDraft((current) => ({ ...current, activeIntent: matchingIntent }));
      focusValidation(validation.field);
      return;
    }

    if (draft.step === "details") {
      if (activeDetailIndex < detailIntents.length - 1) {
        await transition("details", detailIntents[activeDetailIndex + 1]);
      } else {
        await transition("intro", introIntents[0] ?? "search");
      }
      return;
    }
    if (draft.step === "intro") {
      if (activeIntroIndex < introIntents.length - 1) await transition("intro", introIntents[activeIntroIndex + 1]);
      else await transition("review", detailIntents[0] ?? "search");
      return;
    }
    await transition(screens[Math.min(currentIndex + 1, screens.length - 1)]?.id ?? "review", detailIntents[0] ?? "search");
  }

  async function back() {
    if (draft.step === "details" && activeDetailIndex > 0) {
      await transition("details", detailIntents[activeDetailIndex - 1]);
      return;
    }
    if (draft.step === "intro" && activeIntroIndex > 0) {
      await transition("intro", introIntents[activeIntroIndex - 1]);
      return;
    }
    if (draft.step === "intro") {
      await transition("details", detailIntents.at(-1) ?? "search");
      return;
    }
    if (draft.step === "review") {
      await transition("intro", introIntents.at(-1) ?? "search");
      return;
    }
    if (currentIndex > 0) await transition(screens[currentIndex - 1].id, detailIntents[0] ?? "search");
  }

  async function skipOptional() {
    if (draft.step !== "intro") return;
    if (activeIntroIndex < introIntents.length - 1) await transition("intro", introIntents[activeIntroIndex + 1]);
    else await transition("review", detailIntents[0] ?? "search");
  }

  async function upload(file: File | undefined, intent: QuickStartIntent) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Bitte wähle eine Bilddatei aus."); return; }
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, quality: 0.82, maxBytes: MAX_FUNCTION_UPLOAD_BYTES });
      const form = new FormData();
      form.append("file", compressed);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error ?? "Das Foto konnte nicht hochgeladen werden.");
      const nextDraft = { ...draft, sections: { ...draft.sections, [intent]: { ...createQuickStartIntentData(), ...draft.sections[intent], imageUrl: result.url } } };
      setDraft(nextDraft);
      if (!(await persist(nextDraft))) setError("Das Foto wurde hochgeladen, aber dein Fortschritt konnte nicht gespeichert werden. Bitte bleib auf dieser Seite und versuche es erneut.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Das Foto konnte nicht hochgeladen werden.");
    } finally { setUploading(false); }
  }

  async function clearAndContinue(completedDraft: QuickStartDraft) {
    const response = await fetch("/api/onboarding?type=quick-start", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Dein Einrichtungsstand konnte nicht abgeschlossen werden.");
    if (completedDraft.completed.profile) {
      try {
        const settingsResponse = await fetch("/api/user-settings", { cache: "no-store" });
        const settingsBody = await settingsResponse.json().catch(() => ({}));
        setProfilePublic(settingsResponse.ok && settingsBody.settings?.profile_visibility === "public");
      } catch { setProfilePublic(false); }
    }
    setFinished(completedDraft);
    setSaveState("saved");
  }

  async function finish() {
    const validation = validateQuickStartDraft(draft);
    if (validation) {
      const firstBadScreen = screenForField(validation.field);
      setError(validation.message);
      const matchingIntent = intentForField(validation.field) ?? activeIntent;
      const corrected = { ...draft, step: firstBadScreen, activeIntent: matchingIntent };
      setDraft(corrected);
      focusValidation(validation.field);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    setError("");
    try {
      let progress: QuickStartDraft = { ...draft, step: "review", completed: { ...draft.completed, listings: { ...draft.completed.listings } } };
      if (!(await persist(progress))) return;

      if ((progress.intents.includes("crew") || progress.intents.includes("talent")) && !progress.completed.profile) {
        const positions = selectedRoles.map((role) => role.role);
        const profileTypes = getQuickStartProfileTypesForRoles(selectedRoles);
        const profilePhoto = progress.sections.crew?.imageUrl || progress.sections.talent?.imageUrl || null;
        const response = await fetch("/api/profile", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: progress.name.trim(),
            location: [progress.personCity.trim(), progress.personCountry.trim()].filter(Boolean).join(", "),
            profile_types: profileTypes, profile_type: profileTypes[0] ?? null,
            positions, bio: progress.talentIntro.trim(), avatar_url: profilePhoto, available: true,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.profile?.user_id) {
          const firstField = Object.keys(result.fieldErrors ?? {})[0];
          const field = firstField === "display_name" ? "name" : firstField === "location" ? "personCity" : firstField === "activity" ? "crew-roles" : null;
          if (field) { setDraft({ ...progress, step: screenForField(field), activeIntent: intentForField(field) ?? activeIntent }); focusValidation(field); }
          throw new Error(result.fieldErrors?.[firstField] ?? result.error ?? "Dein Profil konnte nicht erstellt werden.");
        }
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
          body: JSON.stringify({
            name: section.title.trim(), city: section.city.trim(), description: section.description.trim(),
            logo_url: section.imageUrl || null, categories: section.categoryIds,
            catering_details: section.cateringDetails,
            website: section.website.trim() || null, email: section.contactEmail.trim() || null,
            phone: section.contactPhone.trim() || null,
            onboarding_request_key: progress.requestKeys.company,
          }),
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

  function editReview(step: QuickStartScreen, intent?: QuickStartIntent) {
    void transition(step, intent ?? activeIntent);
  }

  function renderPhotoInput(intent: QuickStartIntent, label: string) {
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    return <div className="space-y-3">
      {data.imageUrl ? <div className="space-y-3"><Image src={data.imageUrl} alt={label} width={960} height={640} sizes="(max-width: 640px) 100vw, 720px" className="max-h-64 w-full rounded-xl border border-border object-contain" /><button type="button" onClick={() => updateSection(intent, { imageUrl: "" })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm text-text-secondary"><Trash2 size={15} /> Foto entfernen</button></div> : <label className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-primary p-5 text-center hover:border-gold/50 ${uploading ? "pointer-events-none opacity-60" : ""}`}><ImagePlus className="text-gold" /><span className="text-sm font-medium text-text-primary">{uploading ? "Foto wird hochgeladen …" : label}</span><span className="text-xs text-text-muted">JPG, PNG, WEBP oder HEIC · freiwillig</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(event) => { void upload(event.target.files?.[0], intent); event.currentTarget.value = ""; }} /></label>}
      {uploading && <p role="status" className="flex items-center gap-2 text-xs text-text-muted"><Loader2 size={14} className="animate-spin" /> Upload läuft …</p>}
    </div>;
  }

  function renderRolePicker(intent: "crew" | "talent") {
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    const activeDepartments = intent === "crew" ? data.departmentIds : (castDepartment ? [castDepartment.id] : []);
    const roleFilter = intent === "crew" && activeDepartments.length ? activeDepartments : intent === "talent" ? activeDepartments : undefined;
    const matches = findQuickStartRoles(roleSearch, 50, roleFilter);
    return <div className="space-y-4">
      {intent === "crew" && <>
        <label htmlFor="quick-start-department-search" className="block text-sm font-medium text-text-primary">1. Gewerk oder Hauptgruppe wählen</label>
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-department-search" value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Zum Beispiel Kamera, Ton oder Grip" className={`${inputClass} pl-10`} /></div>
        <div id="quick-start-crew-departments" tabIndex={-1} className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredDepartments.map((department) => {
            const selected = data.departmentIds.includes(department.id);
            return <button key={department.id} type="button" aria-pressed={selected} onClick={() => toggleDepartment(department.id)} className={`flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className="min-w-0 break-words text-sm text-text-primary">{department.emoji} {department.label}</span><span className="shrink-0 text-xs text-text-muted">{department.roles.length}</span></button>;
          })}
          {!filteredDepartments.length && <p className="col-span-full rounded-xl border border-border p-3 text-sm text-text-muted">Kein Gewerk gefunden.</p>}
        </div>
      </>}
      <div>
        <label htmlFor={`quick-start-${intent}-role-search`} className="mb-2 block text-sm font-medium text-text-primary">{intent === "crew" ? "2. Tätigkeit auswählen" : "Tätigkeit auswählen"}</label>
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id={`quick-start-${intent}-role-search`} autoComplete="off" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder={intent === "crew" ? "Zum Beispiel Key Grip oder Schnitt" : "Zum Beispiel Schauspiel, Model oder Komparserie"} className={`${inputClass} pl-10`} /></div>
        {roleSearch.trim() ? <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-bg-primary p-2">
          {matches.map((item) => {
            const selected = data.roles.some((role) => role.departmentId === item.departmentId && role.role === item.role);
            return <button key={`${item.departmentId}:${item.role}`} type="button" aria-pressed={selected} onClick={() => toggleRole(item, intent)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-gold/10 text-gold" : "text-text-primary hover:bg-bg-elevated"}`}><span className="min-w-0"><span className="block break-words text-sm font-medium">{item.role}</span><span className="block text-xs text-text-muted">{item.departmentLabel}</span></span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>;
          })}
          {!matches.length && <p className="px-3 py-4 text-sm text-text-muted">Keine passende Tätigkeit gefunden. Versuche einen anderen Begriff.</p>}
        </div> : intent === "talent" ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(castDepartment?.roles ?? []).map((role) => { const selected = data.roles.some((item) => item.role === role); return <button key={role} type="button" aria-pressed={selected} onClick={() => toggleRole({ departmentId: "cast", role }, intent)} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${selected ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-primary text-text-primary"}`}><span className="break-words">{role}</span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>; })}
        </div> : <div className="mt-3 space-y-2">
          {data.departmentIds.map((id, index) => {
            const department = departments.find((item) => item.id === id);
            if (!department) return null;
            const selectedCount = data.roles.filter((role) => role.departmentId === id).length;
            return <details key={id} className="rounded-xl border border-border bg-bg-primary" open={index === 0}><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text-primary"><span className="break-words">{department.emoji} {department.label}</span><span className="shrink-0 text-xs font-normal text-text-muted">{selectedCount ? `${selectedCount} gewählt` : `${department.roles.length} Tätigkeiten`}</span></summary><div className="max-h-48 space-y-1 overflow-y-auto border-t border-border p-2">{[...new Set(department.roles)].map((role) => { const selected = data.roles.some((item) => item.departmentId === id && item.role === role); return <button key={role} type="button" aria-pressed={selected} onClick={() => toggleRole({ departmentId: id, role }, intent)} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${selected ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated"}`}><span className="break-words">{role}</span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>; })}</div></details>;
          })}
          {!data.departmentIds.length && <p className="rounded-xl border border-border bg-bg-primary p-3 text-sm text-text-muted">Wähle zuerst ein Gewerk. Du kannst auch oben direkt nach einer Tätigkeit suchen.</p>}
        </div>}
        <div className="mt-3 flex flex-wrap gap-2">{data.roles.map((item) => <span key={`${item.departmentId}:${item.role}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-2 text-xs text-gold"><span className="break-words">{item.role}</span><button type="button" aria-label={`${item.role} entfernen`} onClick={() => toggleRole(item, intent)} className="min-h-6 min-w-6 rounded-full hover:bg-bg-elevated">×</button></span>)}</div>
      </div>
    </div>;
  }

  function renderDetails() {
    if (activeIntent === "crew") return renderRolePicker("crew");
    if (activeIntent === "talent") return renderRolePicker("talent");
    if (activeIntent === "search") return <p className="rounded-xl border border-border bg-bg-primary p-5 text-sm leading-6 text-text-secondary">Du möchtest suchen. Dafür musst du kein eigenes Profil und kein Angebot anlegen. Wähle im nächsten Schritt nur, ob du noch freiwillige Angaben ergänzen möchtest.</p>;
    const intent = activeIntent;
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    if (intent === "location" || intent === "equipment") {
      const choices = QUICK_START_CATEGORIES[intent];
      return <div className="space-y-5">
        <div><p className="mb-2 text-sm font-medium text-text-primary">Welche Art möchtest du anbieten?</p><div id={`quick-start-${intent}-category`} tabIndex={-1} className="grid gap-2 sm:grid-cols-2">{choices.map((item) => <button key={item.value} type="button" aria-pressed={data.category === item.value} onClick={() => updateSection(intent, { category: item.value })} className={`min-h-14 min-w-0 rounded-xl border px-4 py-3 text-left ${data.category === item.value ? "border-gold bg-gold/10" : "border-border bg-bg-primary"}`}><span className="block break-words text-sm font-semibold text-text-primary">{item.label}</span><span className="mt-1 block break-words text-xs text-text-muted">{item.example}</span></button>)}</div></div>
        <div><label htmlFor={`quick-start-${intent}-title`} className="mb-2 block text-sm font-medium text-text-primary">Wie soll dein Angebot heißen? <span className="text-gold">*</span></label><input id={`quick-start-${intent}-title`} maxLength={200} value={data.title} onChange={(event) => updateSection(intent, { title: event.target.value })} placeholder={intent === "location" ? "Zum Beispiel Altbauwohnung mit Balkon" : "Zum Beispiel LED-Flächenleuchte"} className={inputClass} /></div>
        <div><label htmlFor={`quick-start-${intent}-city`} className="mb-2 block text-sm font-medium text-text-primary">Wo ist es? <span className="text-gold">*</span></label><input id={`quick-start-${intent}-city`} autoComplete="address-level2" maxLength={100} value={data.city} onChange={(event) => updateSection(intent, { city: event.target.value })} placeholder="Stadt oder Region" className={inputClass} /></div>
      </div>;
    }
    const company = draft.sections.company ?? createQuickStartIntentData();
    const query = companyCategorySearch.trim().toLocaleLowerCase("de");
    const categories = QUICK_START_CATEGORIES.company.filter((category) => {
      const terms = `${category.label} ${category.example} ${category.value === CATERING_COMPANY_CATEGORY.id ? getCateringCompanySearchTerms().join(" ") : ""}`.toLocaleLowerCase("de");
      return !query || terms.includes(query);
    });
    return <div className="space-y-4">
      <div><label htmlFor="quick-start-company-title" className="mb-2 block text-sm font-medium text-text-primary">Wie heißt deine Firma oder Dienstleistung? <span className="text-gold">*</span></label><input id="quick-start-company-title" autoComplete="organization" maxLength={200} value={company.title} onChange={(event) => updateSection("company", { title: event.target.value })} placeholder="Zum Beispiel Selection Catering" className={inputClass} /></div>
      <div><label htmlFor="quick-start-company-city" className="mb-2 block text-sm font-medium text-text-primary">Wo ist dein Firmenstandort? <span className="text-gold">*</span></label><input id="quick-start-company-city" autoComplete="address-level2" maxLength={100} value={company.city} onChange={(event) => updateSection("company", { city: event.target.value })} placeholder="Stadt oder Region" className={inputClass} /></div>
      <div><label htmlFor="quick-start-company-category-search" className="mb-2 block text-sm font-medium text-text-primary">Welche Branche passt? <span className="text-gold">*</span></label><div className="relative mb-3"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-company-category-search" autoComplete="off" value={companyCategorySearch} onChange={(event) => setCompanyCategorySearch(event.target.value)} placeholder="Catering, Studio, Verleih …" className={`${inputClass} pl-10`} /></div>
        <div id="quick-start-company-categories" tabIndex={-1} className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{categories.map((category) => { const selected = company.categoryIds.includes(category.value); return <button key={category.value} type="button" aria-pressed={selected} onClick={() => { const categoryIds = selected ? company.categoryIds.filter((id) => id !== category.value) : [...company.categoryIds, category.value]; updateSection("company", { categoryIds, ...(selected && category.value === CATERING_COMPANY_CATEGORY.id ? { cateringDetails: EMPTY_CATERING_COMPANY_DETAILS } : {}) }); }} className={`min-h-14 min-w-0 rounded-xl border px-4 py-3 text-left ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className="block break-words text-sm font-semibold text-text-primary">{category.label}</span><span className="mt-1 block break-words text-xs leading-5 text-text-muted">{category.example}</span></button>; })}{!categories.length && <p className="col-span-full rounded-xl border border-border p-4 text-sm text-text-muted">Keine passende Branche gefunden.</p>}</div>
        <p className="mt-2 text-xs leading-5 text-text-muted">Du kannst mehrere Branchen auswählen.</p>
      </div>
    </div>;
  }

  function renderOptionalDetails() {
    if (activeIntent === "search") return <div className="rounded-xl border border-border bg-bg-primary p-5"><p className="text-sm leading-6 text-text-secondary">Für die Suche sind keine weiteren Angaben nötig. Du kannst direkt zur Zusammenfassung gehen.</p></div>;
    if (activeIntent === "crew" || activeIntent === "talent") {
      const intent = activeIntent;
      const data = draft.sections[intent] ?? createQuickStartIntentData();
      return <div className="space-y-5"><div><p className="mb-3 text-sm font-medium text-text-primary">Profilfoto <span className="text-text-muted">(freiwillig)</span></p>{renderPhotoInput(intent, "Profilfoto auswählen")}</div><div><label htmlFor="quick-start-talent-intro" className="mb-2 block text-sm font-medium text-text-primary">Kurze Vorstellung <span className="text-text-muted">(freiwillig)</span></label><textarea id="quick-start-talent-intro" rows={4} maxLength={1200} value={draft.talentIntro} onChange={(event) => update("talentIntro", event.target.value)} placeholder="Was sollten andere über dich wissen?" className="w-full rounded-xl border border-border bg-bg-primary p-4 text-base text-text-primary outline-none focus:border-gold" /><p className="mt-1 text-xs text-text-muted">Die Vorstellung gehört zu deinem persönlichen Profil.</p></div>{data.imageUrl && <p className="text-xs text-text-muted">Das Foto wird deinem persönlichen Profil zugeordnet.</p>}</div>;
    }
    const intent = activeIntent;
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    const isCompany = intent === "company";
    return <div className="space-y-5">
      <div><label htmlFor={`quick-start-${intent}-description`} className="mb-2 block text-sm font-medium text-text-primary">Kurze Beschreibung <span className="text-text-muted">(freiwillig)</span></label><textarea id={`quick-start-${intent}-description`} rows={4} maxLength={3000} value={data.description} onChange={(event) => updateSection(intent, { description: event.target.value })} placeholder={isCompany ? "Was bietet deine Firma an?" : intent === "location" ? "Was ist an diesem Ort besonders?" : "Was ist enthalten und in welchem Zustand ist es?"} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-base text-text-primary outline-none focus:border-gold" /><p className="mt-1 text-xs text-text-muted">Die Beschreibung gehört zu {isCompany ? "deinem Firmenprofil" : "diesem Angebotsentwurf"}.</p></div>
      <div><p className="mb-3 text-sm font-medium text-text-primary">{isCompany ? "Firmenlogo" : "Foto für dein Angebot"} <span className="text-text-muted">(freiwillig)</span></p>{renderPhotoInput(intent, isCompany ? "Firmenlogo auswählen" : "Angebotsfoto auswählen")}</div>
      {isCompany ? <div className="space-y-4 rounded-xl border border-border bg-bg-primary p-4"><p className="text-sm font-medium text-text-primary">Kontaktangaben <span className="text-text-muted">(freiwillig)</span></p><div><label htmlFor="quick-start-company-email" className="mb-2 block text-sm text-text-primary">Kontakt-E-Mail</label><input id="quick-start-company-email" type="email" autoComplete="email" maxLength={200} value={data.contactEmail} onChange={(event) => updateSection("company", { contactEmail: event.target.value })} placeholder="kontakt@beispiel.de" className={inputClass} /></div><div><label htmlFor="quick-start-company-phone" className="mb-2 block text-sm text-text-primary">Telefon</label><input id="quick-start-company-phone" type="tel" autoComplete="tel" maxLength={80} value={data.contactPhone} onChange={(event) => updateSection("company", { contactPhone: event.target.value })} placeholder="Optional" className={inputClass} /></div><div><label htmlFor="quick-start-company-website" className="mb-2 block text-sm text-text-primary">Webseite</label><input id="quick-start-company-website" type="url" autoComplete="url" maxLength={300} value={data.website} onChange={(event) => updateSection("company", { website: event.target.value })} placeholder="https://…" className={inputClass} /></div></div> : <div className="rounded-xl border border-border bg-bg-primary p-4"><p className="mb-3 text-sm text-text-primary">Preis <span className="text-text-muted">(freiwillig)</span></p><div className="space-y-2"><button type="button" aria-pressed={data.priceOnRequest} onClick={() => updateSection(intent, { priceOnRequest: true })} className={`min-h-12 w-full rounded-xl border px-4 text-left text-sm ${data.priceOnRequest ? "border-gold bg-gold/10 text-text-primary" : "border-border text-text-secondary"}`}>Preis auf Anfrage</button><button type="button" aria-pressed={!data.priceOnRequest} onClick={() => updateSection(intent, { priceOnRequest: false })} className={`min-h-12 w-full rounded-xl border px-4 text-left text-sm ${!data.priceOnRequest ? "border-gold bg-gold/10 text-text-primary" : "border-border text-text-secondary"}`}>Tagespreis angeben</button>{!data.priceOnRequest && <div><label htmlFor={`quick-start-${intent}-price`} className="mb-2 mt-3 block text-sm text-text-primary">Preis pro Tag in Euro</label><input id={`quick-start-${intent}-price`} type="number" min="0" step="1" value={data.price} onChange={(event) => updateSection(intent, { price: event.target.value })} placeholder="Zum Beispiel 150" className={inputClass} /></div>}</div></div>}
      {isCompany && data.categoryIds.includes(CATERING_COMPANY_CATEGORY.id) && <div className="rounded-xl border border-border bg-bg-primary p-4"><p className="mb-3 text-sm font-medium text-text-primary">Catering-Leistungen <span className="text-text-muted">(freiwillig)</span></p><CateringCompanyFields value={data.cateringDetails} onChange={(cateringDetails) => updateSection("company", { cateringDetails })} /></div>}
    </div>;
  }

  if (!ready) return <div className="min-h-screen bg-bg-primary px-4 pt-20 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Dein Start wird geladen …</div>;
  if (loadError) return <div className="min-h-[75vh] bg-bg-primary px-4 pb-8 pt-8 sm:pt-12"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-6 text-center"><p role="alert" className="text-sm leading-6 text-red-300">{loadError}</p><p className="mt-2 text-xs leading-5 text-text-muted">Damit kein gespeicherter Fortschritt verloren geht, starte bitte erst weiter, wenn der Status geladen wurde.</p><button type="button" onClick={() => { setReady(false); setLoadError(""); setLoadAttempt((value) => value + 1); }} className="mt-5 min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Erneut versuchen</button></section></div>;

  if (finished) return <div className="min-h-screen bg-bg-primary px-4 py-8 sm:py-12"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
    <CheckCircle2 size={36} className="mb-5 text-gold" />
    <p className="mb-2 text-xs font-semibold text-gold">Erfolgreich gespeichert</p>
    <h1 className="font-display text-2xl font-bold sm:text-3xl">{finished.completed.profile ? profilePublic ? "Dein Profil ist jetzt öffentlich sichtbar." : "Dein Profil ist erstellt." : finished.completed.company ? "Dein Firmenprofil ist erstellt." : finished.intents.every(intent => intent === "search") ? "Du kannst jetzt entdecken." : "Deine Angebotsentwürfe sind gespeichert."}</h1>
    <p className="mt-4 text-sm leading-6 text-text-secondary">{finished.completed.profile ? profilePublic ? "Andere können dich jetzt finden und dein Profil ansehen." : "Deine bisherigen Sichtbarkeitseinstellungen bleiben erhalten. Ein privates Profil bleibt privat." : finished.completed.company ? "Deine Firma wurde gespeichert. Etwaige Inserate haben einen eigenen Veröffentlichungsstatus." : "Deine Einrichtung ist abgeschlossen. Du kannst jederzeit weitere Bereiche ergänzen."}</p>
    <div className="mt-6 space-y-3">
      {finished.completed.profile && user?.id && <a href={`/profile/${encodeURIComponent(user.id)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{profilePublic ? "Öffentliches Profil ansehen" : "Profil ansehen"}<ArrowRight size={16} /></a>}
      {finished.completed.company && <a href={`/companies/${encodeURIComponent(finished.completed.company)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/30 px-5 text-sm font-semibold text-gold">Firmenprofil ansehen<ArrowRight size={16} /></a>}
      {(finished.completed.listings.location || finished.completed.listings.equipment) && <><p className="rounded-xl border border-border bg-bg-primary p-4 text-xs leading-5 text-text-muted">Deine Location- und Marktplatzangebote bleiben private Entwürfe. Vervollständige sie und veröffentliche sie anschließend ausdrücklich.</p>{Object.entries(finished.completed.listings).map(([kind, id]) => <a key={id} href={`/dashboard?tab=listings&editListing=${encodeURIComponent(id!)}`} className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 text-sm text-text-primary">{kind === "location" ? "Locationentwurf fortsetzen" : "Marktplatzentwurf fortsetzen"}</a>)}</>}
      <button type="button" onClick={() => router.replace(redirectTo || (finished.intents.every(intent => intent === "search") ? "/search" : "/dashboard"))} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border px-4 text-sm text-text-primary">{finished.intents.every(intent => intent === "search") ? "Jetzt suchen" : "Zu Mein Bereich"}</button>
    </div>
  </section></div>;
  if (draft.welcomeAcknowledged === false) return <div className="min-h-screen bg-bg-primary px-4 py-8 sm:py-12"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
    <CheckCircle2 size={32} className="mb-5 text-gold" /><p className="mb-2 text-xs font-semibold text-gold">Konto erstellt</p>
    <h1 className="font-display text-2xl font-bold sm:text-3xl">Willkommen bei CineGenius!</h1>
    <p className="mt-4 text-sm leading-6 text-text-secondary">Dein Konto ist erstellt. Damit andere dich oder dein Angebot finden können, ergänze jetzt die wichtigsten Angaben.</p>
    <div className="mt-5 rounded-xl border border-border bg-bg-primary p-4"><p className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-gold" />Ein Schritt nach dem anderen</p><p className="mt-2 text-sm leading-6 text-text-muted">Zuerst dein Name und Ort. Danach wählst du, wofür du CineGenius nutzen möchtest.</p><p className="mt-2 text-xs leading-5 text-text-muted">Du kannst dich, eine Firma oder ein Angebot einrichten – oder einfach nur suchen.</p></div>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <button type="button" disabled={saving} onClick={async () => { setSaving(true); setError(""); const next = { ...draft, welcomeAcknowledged: true }; if (await persist(next)) setDraft(next); setSaving(false); }} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? "Speichert …" : "Jetzt starten"}<ArrowRight size={17} /></button>
    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-text-muted"><Lock size={14} className="mt-0.5 shrink-0" />Deine Eingaben bleiben zunächst privat. Du entscheidest ausdrücklich, was veröffentlicht wird.</p>
  </section></div>;

  return <div className="min-h-screen bg-bg-primary px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:pt-10">
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Dein Start auf CineGenius</p>
      <div className="mb-5 flex items-center justify-between gap-4" aria-label={`Schritt ${currentIndex + 1} von 6`}><span className="text-sm font-semibold text-text-secondary">Schritt {currentIndex + 1} von 6</span><span role="status" aria-live="polite" className="text-xs text-text-muted">{saveLabel}</span></div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${((currentIndex + 1) / 6) * 100}%` }} /></div>
      <h1 className="mb-2 break-words font-display text-2xl font-bold text-text-primary sm:text-3xl">{currentContent.title}</h1>
      <p className="mb-6 max-w-2xl text-sm leading-6 text-text-muted">{currentContent.description}</p>

      <section className="min-w-0 rounded-2xl border border-border bg-bg-secondary p-4 sm:p-7">
        {draft.step === "name" && <div><label htmlFor="quick-start-name" className="mb-2 block text-sm font-medium text-text-primary">Vor- und Nachname oder Künstlername <span className="text-gold">*</span></label><input id="quick-start-name" autoComplete="name" maxLength={120} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Dein Name" className={inputClass} aria-describedby="quick-start-name-help" /><p id="quick-start-name-help" className="mt-2 text-xs leading-5 text-text-muted">Du kannst später festlegen, welche Angaben öffentlich sichtbar sind.</p></div>}

        {draft.step === "location" && <div className="space-y-4"><div><label htmlFor="quick-start-person-city" className="mb-2 block text-sm font-medium text-text-primary">Stadt oder Region {hasProfileIntent && <span className="text-gold">*</span>}</label><input id="quick-start-person-city" autoComplete="address-level2" maxLength={100} value={draft.personCity} onChange={(event) => update("personCity", event.target.value)} placeholder="Zum Beispiel Leipzig" className={inputClass} /></div><div><label htmlFor="quick-start-person-country" className="mb-2 block text-sm font-medium text-text-primary">Land {hasProfileIntent && <span className="text-gold">*</span>}</label><select id="quick-start-person-country" value={countryOther ? "Andere" : draft.personCountry || "Deutschland"} onChange={(event) => { const other = event.target.value === "Andere"; setCountryOther(other); update("personCountry", other ? "" : event.target.value); }} className={inputClass}><option>Deutschland</option><option>Österreich</option><option>Schweiz</option><option value="Andere">Anderes Land</option></select>{countryOther && <input aria-label="Land eingeben" autoComplete="country-name" maxLength={100} value={draft.personCountry} onChange={(event) => update("personCountry", event.target.value)} placeholder="Land eingeben" className={`${inputClass} mt-3`} />}</div>{!hasProfileIntent && <p className="text-xs leading-5 text-text-muted">Diese Angabe ist freiwillig, wenn du nur suchen möchtest.</p>}</div>}

        {draft.step === "goals" && <div id="quick-start-goals" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">{paths.map(({ id, detail, Icon }) => { const selected = draft.intents.includes(id); return <button key={id} type="button" aria-pressed={selected} onClick={() => toggleIntent(id)} className={`flex min-h-24 min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition-colors ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-gold/15 text-gold" : "bg-bg-elevated text-text-muted"}`}><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-text-primary">{QUICK_START_INTENT_LABELS[id]}</span><span className="mt-1 block break-words text-xs leading-5 text-text-muted">{detail}</span></span><span aria-hidden="true" className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-gold bg-gold text-bg-primary" : "border-border text-transparent"}`}>✓</span></button>; })}</div>}

        {draft.step === "details" && <div>
          {detailIntents.length > 1 && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-primary px-3 py-2"><span className="text-xs text-text-muted">Bereich {activeDetailIndex + 1} von {detailIntents.length}</span><span className="text-xs font-medium text-text-primary">{QUICK_START_INTENT_LABELS[activeIntent]}</span></div>}
          {renderDetails()}
        </div>}

        {draft.step === "intro" && <div>
          {introIntents.length > 1 && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-primary px-3 py-2"><span className="text-xs text-text-muted">Ergänzung {activeIntroIndex + 1} von {introIntents.length}</span><span className="text-xs font-medium text-text-primary">{activeIntent === "crew" && draft.intents.includes("talent") ? "Dein persönliches Profil" : QUICK_START_INTENT_LABELS[activeIntent]}</span></div>}
          {renderOptionalDetails()}
        </div>}

        {draft.step === "review" && <div className="space-y-4">
          <ReviewSection title="Dein Name" onEdit={() => editReview("name")}><ReviewRow label="Name" value={draft.name} /></ReviewSection>
          <ReviewSection title="Dein Ort" onEdit={() => editReview("location")}><ReviewRow label="Standort" value={[draft.personCity, draft.personCountry].filter(Boolean).join(", ")} /></ReviewSection>
          <ReviewSection title="Deine Auswahl" onEdit={() => editReview("goals")}><p className="break-words text-sm text-text-primary">{selectedIntentTitles.join(" · ") || "—"}</p></ReviewSection>
          {(draft.intents.includes("crew") || draft.intents.includes("talent")) && <>
            <ReviewSection title="Dein persönliches Profil" onEdit={() => editReview("details", draft.intents.includes("crew") ? "crew" : "talent")}><ReviewRow label="Tätigkeiten" value={selectedRoles.map((role) => role.role).join(", ")} /><ReviewRow label="Standort" value={[draft.personCity, draft.personCountry].filter(Boolean).join(", ")} /><p className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-xs leading-5 text-text-muted">Mit „Profil veröffentlichen“ erstellst du dein Profil. Deine gespeicherten Sichtbarkeitseinstellungen bleiben erhalten.</p></ReviewSection>
            <ReviewSection title="Foto und Vorstellung" onEdit={() => editReview("intro", draft.intents.includes("crew") ? "crew" : "talent")}>{draft.sections.crew?.imageUrl && <Image src={draft.sections.crew.imageUrl} alt="Profilfoto" width={240} height={240} className="h-20 w-20 rounded-xl object-cover" />}{draft.sections.talent?.imageUrl && <Image src={draft.sections.talent.imageUrl} alt="Profilfoto" width={240} height={240} className="h-20 w-20 rounded-xl object-cover" />}<ReviewRow label="Vorstellung" value={draft.talentIntro} /></ReviewSection>
          </>}
          {draft.intents.filter((intent) => intent === "location" || intent === "equipment").map((intent) => { const data = draft.sections[intent] ?? createQuickStartIntentData(); const categoryName = QUICK_START_CATEGORIES[intent].find((item) => item.value === data.category)?.label ?? data.category; return <div key={intent} className="space-y-3"><ReviewSection title={QUICK_START_INTENT_LABELS[intent]} onEdit={() => editReview("details", intent)}><ReviewRow label="Art" value={categoryName} /><ReviewRow label="Angebot" value={data.title} /><ReviewRow label="Standort" value={data.city} /></ReviewSection><ReviewSection title={`${QUICK_START_INTENT_LABELS[intent]}: Ergänzungen`} onEdit={() => editReview("intro", intent)}>{data.description && <ReviewRow label="Beschreibung" value={data.description} />}<ReviewRow label="Preis" value={data.priceOnRequest ? "Auf Anfrage" : `${data.price} € pro Tag`} />{data.imageUrl && <Image src={data.imageUrl} alt="Angebotsfoto" width={720} height={480} sizes="(max-width: 640px) 100vw, 640px" className="max-h-40 w-full rounded-lg object-contain" />}<p className="rounded-xl border border-border bg-bg-primary p-3 text-xs leading-5 text-text-muted">Dein Angebot wird als privater Entwurf gespeichert. Du entscheidest später ausdrücklich, ob du es veröffentlichst.</p></ReviewSection></div>; })}
          {draft.intents.includes("company") && (() => { const data = draft.sections.company ?? createQuickStartIntentData(); const categoryLabels = QUICK_START_CATEGORIES.company.filter((category) => data.categoryIds.includes(category.value)).map((category) => category.label); const catering = data.cateringDetails; return <>
            <ReviewSection title="Deine Firma oder Dienstleistung" onEdit={() => editReview("details", "company")}><ReviewRow label="Name" value={data.title} /><ReviewRow label="Standort" value={data.city} /><ReviewRow label="Branchen" value={categoryLabels.join(", ")} /></ReviewSection>
            <ReviewSection title="Firmenbeschreibung und Kontakt" onEdit={() => editReview("intro", "company")}>{data.description && <ReviewRow label="Beschreibung" value={data.description} />}{data.contactEmail && <ReviewRow label="Kontakt-E-Mail" value={data.contactEmail} />}{data.contactPhone && <ReviewRow label="Telefon" value={data.contactPhone} />}{data.website && <ReviewRow label="Webseite" value={data.website} />}{data.categoryIds.includes(CATERING_COMPANY_CATEGORY.id) && catering.serviceTypes.length > 0 && <ReviewRow label="Catering-Leistungen" value={catering.serviceTypes.join(", ")} />}{data.imageUrl && <Image src={data.imageUrl} alt="Firmenlogo" width={320} height={160} sizes="320px" className="max-h-32 rounded-lg object-contain" />}</ReviewSection>
            <ReviewSection title="Sichtbarkeit deiner Firma" onEdit={() => editReview("details", "company")}><p className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-xs leading-5 text-text-secondary">Wenn du abschließt, wird dein Firmenprofil öffentlich auf CineGenius angezeigt. Firmenprofile kannst du danach bearbeiten. Etwaige Location- und Marktplatzangebote bleiben private Entwürfe, bis du sie ausdrücklich veröffentlichst.</p></ReviewSection>
          </>; })()}
          {draft.intents.includes("search") && <p className="rounded-xl border border-border bg-bg-primary p-4 text-sm leading-6 text-text-secondary">Du kannst nach dem Abschluss direkt Personen, Orte und Angebote entdecken.</p>}
        </div>}
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300">{error}</p>}
      <div className="sticky bottom-0 z-30 -mx-4 mt-5 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border bg-bg-primary/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button type="button" disabled={saving || uploading || currentIndex === 0} onClick={() => void back()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={16} /> Zurück</button>
        {draft.step !== "review" ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">{draft.step === "intro" && <button type="button" disabled={saving || uploading} onClick={() => void skipOptional()} className="min-h-12 rounded-xl border border-border px-4 text-sm text-text-secondary disabled:opacity-50">Später ergänzen</button>}<button type="button" disabled={saving || uploading} onClick={() => void next()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={16} className="animate-spin" /> Speichert …</> : <>Weiter <ArrowRight size={16} /></>}</button></div> : <button type="button" disabled={saving || uploading} onClick={() => void finish()} className="inline-flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-center text-sm font-semibold leading-5 text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={17} className="shrink-0 animate-spin" /><span>Wird gespeichert …</span></> : <><CheckCircle2 size={17} className="shrink-0" /><span>{completionActionLabel}</span></>}</button>}
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-text-muted">Dein Fortschritt wird privat gespeichert. Nach einer Unterbrechung geht es hier weiter.</p>
    </div>
  </div>;
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return <section className="min-w-0 space-y-3 rounded-xl border border-border bg-bg-primary p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-words text-sm font-semibold text-text-primary">{title}</h2><button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-gold hover:bg-gold/10">Ändern</button></div>{children}</section>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-bg-secondary px-3 py-2"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 break-words whitespace-pre-wrap text-sm text-text-primary">{value || "—"}</p></div>;
}
