"use client";
import ContentUsageNotice from "@/components/ContentUsageNotice";
import { useFormRouter as useRouter } from "@/lib/use-form-router";
import { useExistingDraftProtection } from "@/lib/use-form-draft";
import ResponsiblePersonFields, { focusResponsiblePerson } from "@/components/ResponsiblePersonFields";
import { EMPTY_RESPONSIBLE_PERSON, responsiblePersonErrors } from "@/lib/responsible-person";


import { useLocale, useTranslations } from "next-intl";
import { localizeSetupError, localizeSetupMessage } from "@/lib/i18n/setup-messages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";
import Image from "@/components/MediaImage";
import Link from "next/link";
import ListingPriceOptions from "@/components/ListingPriceOptions";
import { MarketplaceCategoryPicker } from "@/components/MarketplaceOfferFields";
import { marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import { marketplaceCategory } from "@/lib/marketplaceCategories";
import { listingPriceLabel } from "@/lib/listing-price";
import PrimaryOccupationPicker from "@/components/PrimaryOccupationPicker";
import { selectedCrewOccupations } from "@/lib/crew-occupations";
import { primaryOccupationForPositions, occupationReference, orderPositionsByPrimary } from "@/lib/primary-occupation";
import {
  ArrowLeft, ArrowRight, Building2, Camera, CheckCircle2, Film, ImagePlus,
  Loader2, MapPin, Package, Search, Trash2, Lock, UserRound,
} from "lucide-react";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES } from "@/lib/compressImage";
import { departments, getDeptLabel, getDepartmentRoleLabel, getDepartmentRoleSearchTerms } from "@/lib/departments";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { hasCompletedNonPersonalSetup, hasProfileBasics, shouldSkipProfileSetup } from "@/lib/profile-setup-flow";
import { createOnboardingSaveQueue, isQuickStartContentSaved } from "@/lib/onboarding-save";
import {
  buildQuickStartScreens, createQuickStartIntentData, findQuickStartRoles, getQuickStartDepartments, getQuickStartIntroIntents,
  getQuickStartProfileTypesForRoles, normalizeQuickStartDraft, QUICK_START_CATEGORIES,
  START_QUICK_START_DRAFT,
  validateQuickStartDraft, validateQuickStartScreen, validateQuickStartIntentDetails,
  type QuickStartDraft, type QuickStartIntent, type QuickStartIntentData,
  type QuickStartRoleSelection, type QuickStartScreen,
  type QuickStartProviderIntent,
} from "@/lib/quick-start-flow";
import AnimalCompanyFields, { AnimalCompanySummary } from "@/components/AnimalCompanyFields";
import { isAnimalCompany, animalCategoryLabel } from "@/lib/animal-taxonomy";
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
  const t = useTranslations("setup");
  const marketCatalog=useTranslations("MarketplaceCatalog");
  const locale = useLocale();
  const animals = useTranslations("FilmAnimals");
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const isNewRegistration = params.get("welcome") === "1";
  const resumeIncomplete = params.get("resume") === "1";
  const redirectTo = safeAuthRedirect(params.get("redirect") ?? undefined, "", ["/sign-in", "/sign-up", "/profile-setup", "/guided-profile", "/guided-listing", "/company-setup"]);
  const [responsibleErrors, setResponsibleErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<QuickStartDraft>(START_QUICK_START_DRAFT);
  const [finished, setFinished] = useState<QuickStartDraft | null>(null);
  const [profileIsPrivate, setProfileIsPrivate] = useState(false);
  const [profilePublic, setProfilePublic] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
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
  const savedCrew = useRef<Record<string, unknown>>({});
  const saveQueue = useMemo(() => createOnboardingSaveQueue(async (value) => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: primaryIntent(value), setupComplete: false, quickStart: value, updatedAt: new Date().toISOString() }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 429) setRetrySeconds(Number(response.headers.get("Retry-After")) || result.retryAfter || 10);
      if (!response.ok) throw new Error(result.error ?? "Dein Fortschritt konnte nicht gespeichert werden.");
      setSaveState("saved");
      return true;
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Dein Fortschritt konnte nicht gespeichert werden.");
      return false;
    }
  }), []);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timeout = setTimeout(() => setRetrySeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [retrySeconds]);

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
      setProfileExists(profile?.exists === true);
      savedCrew.current = profile?.profile?.crew ?? {};
      const profileComplete = hasProfileBasics(profile?.profile);
      const hasInProgressDraft = !!saved?.quickStart && saved.setupComplete !== true;
      if (saved?.setupComplete && (profileComplete || hasCompletedNonPersonalSetup(saved))) {
        router.replace(saved.intent === "search" ? (redirectTo || "/search") : (redirectTo || "/dashboard"));
        return;
      }
      if (shouldSkipProfileSetup({ hasExistingProfile: profileComplete, hasInProgressDraft, isNewRegistration })) {
        router.replace(redirectTo || "/dashboard");
        return;
      }
      const existingName = typeof profile?.profile?.display_name === "string" ? profile.profile.display_name : user?.fullName ?? "";
      let nextDraft = hasInProgressDraft
        ? normalizeQuickStartDraft(saved.quickStart)
        : { ...START_QUICK_START_DRAFT, name: existingName };
      if (hasInProgressDraft) saveQueue.acknowledge(normalizeQuickStartDraft(saved.quickStart));
      if (!profileComplete && nextDraft.completed.profile) nextDraft = { ...nextDraft, completed: { ...nextDraft.completed, profile: false } };
      if (resumeIncomplete && hasInProgressDraft) {
        const missing = validateQuickStartDraft(nextDraft);
        if (missing) nextDraft = { ...nextDraft, step: missing.field === "primaryOccupation" ? "review" : screenForField(missing.field), activeIntent: intentForField(missing.field) ?? nextDraft.activeIntent };
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
  }, [isNewRegistration, resumeIncomplete, loadAttempt, redirectTo, router, user?.fullName, saveQueue]);

  useEffect(() => {
    if (!ready || draft.name || !user?.fullName) return;
    setDraft((current) => current.name ? current : { ...current, name: user.fullName ?? "" });
  }, [ready, draft.name, user?.fullName]);

  const persist = useCallback((value: QuickStartDraft) => saveQueue.save(value), [saveQueue]);

  const draftProtection = useExistingDraftProtection({ value: draft, ready, busy: uploading || saving || retrySeconds > 0, save: persist, saved: saveQueue.matches, enabled: !finished && !completionPending });

  useEffect(() => {
    if (!ready || saving || finished || completionPending || retrySeconds > 0 || draft.welcomeAcknowledged === false) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(draft); }, 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, draft, persist, saving, finished, completionPending, retrySeconds]);

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
    return crewDepartments.filter((department) => !query || getDeptLabel(department, locale, animals).toLocaleLowerCase(locale).includes(query) || department.label.toLocaleLowerCase("de").includes(query) || department.roles.some((role) => getDepartmentRoleSearchTerms(department, role).some((term) => term.toLocaleLowerCase("de").includes(query))));
  }, [departmentSearch, locale]);
  const selectedIntentTitles = draft.intents.map((intent) => t(`${intent}Intent`));
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
    if (draft.step === "details" && activeIntent === "company") {
      const errors = responsiblePersonErrors(draft.sections.company?.responsible, true);
      setResponsibleErrors(errors); if (Object.keys(errors).length) { focusResponsiblePerson(); return; }
    }
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
    setCompletionPending(true);
    await saveQueue.settle();
    const response = await fetch("/api/onboarding?type=quick-start", { method: "DELETE" }).catch(() => {
      throw new Error("Deine Angaben sind bereits gespeichert. Die Verbindung wurde unterbrochen. Bitte versuche nur den Abschluss erneut.");
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 429) setRetrySeconds(Number(response.headers.get("Retry-After")) || body.retryAfter || 10);
    if (!response.ok || body.completed !== true) throw new Error(`Deine Angaben sind bereits gespeichert. ${body.error ?? "Die Einrichtung konnte noch nicht abgeschlossen werden. Bitte versuche den Abschluss erneut."}`);
    if (completedDraft.completed.profile) {
      try {
        const settingsResponse = await fetch("/api/user-settings", { cache: "no-store" });
        const settingsBody = await settingsResponse.json().catch(() => ({}));
        setProfilePublic(settingsResponse.ok && settingsBody.settings?.profile_visibility === "public");
      } catch { setProfilePublic(false); }
    }
    draftProtection.complete();
    setFinished(completedDraft);
    setSaveState("saved");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  async function finish() {
    if (saving || retrySeconds > 0) return;
    if (draft.intents.includes("company") && Object.keys(responsiblePersonErrors(draft.sections.company?.responsible, true)).length) {
      setDraft(current => ({ ...current, step: "details", activeIntent: "company" }));
      setResponsibleErrors(responsiblePersonErrors(draft.sections.company?.responsible, true));
      requestAnimationFrame(focusResponsiblePerson); return;
    }
    const validation = validateQuickStartDraft(draft);
    if (validation) {
      const firstBadScreen = validation.field === "primaryOccupation" ? "review" : screenForField(validation.field);
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
      if (!isQuickStartContentSaved(progress) && !(await persist(progress))) return;

      if ((progress.intents.includes("crew") || progress.intents.includes("talent")) && !progress.completed.profile) {
        const primary = primaryOccupationForPositions(progress.primaryOccupation, selectedRoles.map(role=>role.role));
        const positions = orderPositionsByPrimary(selectedRoles.map(role=>role.role), primary);
        const profileTypes = getQuickStartProfileTypesForRoles(selectedRoles);
        const profilePhoto = progress.sections.crew?.imageUrl || progress.sections.talent?.imageUrl || null;
        const response = await fetch("/api/profile", {
          method: profileExists ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: progress.name.trim(),
            location: [progress.personCity.trim(), progress.personCountry.trim()].filter(Boolean).join(", "),
            profile_types: profileTypes, profile_type: profileTypes[0] ?? null,
            positions,
            crew: { ...savedCrew.current, primaryOccupation: occupationReference(primary), occupations: selectedCrewOccupations(positions, selectedRoles.map(item => ({departmentId: item.departmentId, roleId: `${item.departmentId}/${encodeURIComponent(item.role)}`}))) },
            ...(!profileExists ? { bio: progress.talentIntro.trim(), avatar_url: profilePhoto, available: true } : {
              ...(progress.talentIntro.trim() ? { bio: progress.talentIntro.trim() } : {}),
              ...(profilePhoto ? { avatar_url: profilePhoto } : {}),
            }),
          }),
        });
        const result = await response.json().catch(() => ({}));
        const profileSaved = response.ok && (profileExists ? result.success === true : Boolean(result.profile?.user_id));
        if (!profileSaved) {
          const firstField = Object.keys(result.fieldErrors ?? {})[0];
          const field = firstField === "display_name" ? "name" : firstField === "location" ? "personCity" : firstField === "activity" ? "crew-roles" : null;
          if (field) { setDraft({ ...progress, step: screenForField(field), activeIntent: intentForField(field) ?? activeIntent }); focusValidation(field); }
          throw new Error(result.fieldErrors?.[firstField] ?? result.error ?? "Dein Profil konnte nicht erstellt werden.");
        }
        progress = { ...progress, completed: { ...progress.completed, profile: true } };
        setProfileExists(true);
        setDraft(progress);
        if (!isQuickStartContentSaved(progress) && !(await persist(progress))) throw new Error("Das Profil wurde erstellt, aber dein Einrichtungsstand konnte nicht aktualisiert werden. Bitte versuche es erneut.");
      }

      for (const intent of ["location", "equipment"] as const) {
        if (!progress.intents.includes(intent) || progress.completed.listings[intent]) continue;
        if (!progress.requestKeys[intent]) {
          progress = { ...progress, requestKeys: { ...progress.requestKeys, [intent]: crypto.randomUUID() } };
          setDraft(progress);
          if (!(await persist(progress))) throw new Error("Dein Fortschritt konnte vor dem Speichern des Angebots nicht gesichert werden.");
        }
        const section = progress.sections[intent] ?? createQuickStartIntentData();
        const vehicle = intent === "equipment" && marketplaceCategory(section.category)?.department === "fahrzeuge";
        const response = await fetch("/api/listings", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: vehicle ? "vehicle" : intent === "location" ? "location" : "prop",
            category: section.category, title: section.title.trim(), city: section.city.trim(),
            description: section.description.trim(), price: section.priceOnRequest ? 0 : Number(section.price) || 0,
            image_url: section.imageUrl || null, draft: true,
            metadata: { price_negotiable: section.priceNegotiable === true, price_on_request: section.priceOnRequest, onboarding_setup: true },
            responsible_person: section.responsible,
            onboarding_request_key: progress.requestKeys[intent],
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.data?.id) throw new Error(result.error ?? "Der private Angebotsentwurf konnte nicht gespeichert werden.");
        progress = { ...progress, completed: { ...progress.completed, listings: { ...progress.completed.listings, [intent]: String(result.data.id) } } };
        setDraft(progress);
        if (!isQuickStartContentSaved(progress) && !(await persist(progress))) throw new Error("Der Angebotsentwurf wurde gespeichert, aber dein Einrichtungsstand konnte nicht aktualisiert werden. Bitte versuche es erneut.");
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
            animal_details: section.animalDetails,
            responsible_person: section.responsible,
            website: section.website.trim() || null, email: section.contactEmail.trim() || null,
            phone: section.contactPhone.trim() || null,
            onboarding_request_key: progress.requestKeys.company,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.data?.id) throw new Error(result.error ?? "Das Firmenprofil konnte nicht gespeichert werden.");
        progress = { ...progress, completed: { ...progress.completed, company: String(result.data.id) } };
        setDraft(progress);
        if (!isQuickStartContentSaved(progress) && !(await persist(progress))) throw new Error("Das Firmenprofil wurde gespeichert, aber dein Einrichtungsstand konnte nicht aktualisiert werden. Bitte versuche es erneut.");
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
      <ContentUsageNotice context={intent === "company" ? "company" : intent === "crew" || intent === "talent" ? "profile" : "offer"} visibility="configured" />
      {data.imageUrl ? <div className="space-y-3"><Image src={data.imageUrl} alt={label} width={960} height={640} sizes="(max-width: 640px) 100vw, 720px" className="max-h-64 w-full rounded-xl border border-border object-contain" /><button type="button" onClick={() => updateSection(intent, { imageUrl: "" })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm text-text-secondary"><Trash2 size={15} /> {t("copy0")}</button></div> : <label className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-primary p-5 text-center hover:border-gold/50 ${uploading ? "pointer-events-none opacity-60" : ""}`}><ImagePlus className="text-gold" /><span className="text-sm font-medium text-text-primary">{uploading ? "Foto wird hochgeladen …" : label}</span><span className="text-xs text-text-muted">{t("copy1")}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(event) => { void upload(event.target.files?.[0], intent); event.currentTarget.value = ""; }} /></label>}
      {uploading && <p role="status" className="flex items-center gap-2 text-xs text-text-muted"><Loader2 size={14} className="animate-spin" /> {t("copy2")}</p>}
    </div>;
  }

  function renderRolePicker(intent: "crew" | "talent") {
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    const activeDepartments = intent === "crew" ? data.departmentIds : (castDepartment ? [castDepartment.id] : []);
    const roleFilter = intent === "crew" && activeDepartments.length ? activeDepartments : intent === "talent" ? activeDepartments : undefined;
    const matches = findQuickStartRoles(roleSearch, 50, roleFilter);
    return <div className="space-y-4">
      {intent === "crew" && <>
        <label htmlFor="quick-start-department-search" className="block text-sm font-medium text-text-primary">{t("copy3")}</label>
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-department-search" value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder={t("copy4")} className={`${inputClass} pl-10`} /></div>
        <div id="quick-start-crew-departments" tabIndex={-1} className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredDepartments.map((department) => {
            const selected = data.departmentIds.includes(department.id);
            return <button key={department.id} type="button" aria-pressed={selected} onClick={() => toggleDepartment(department.id)} className={`flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className="min-w-0 break-words text-sm text-text-primary">{department.emoji} {getDeptLabel(department, locale, animals)}</span><span className="shrink-0 text-xs text-text-muted">{department.roles.length}</span></button>;
          })}
          {!filteredDepartments.length && <p className="col-span-full rounded-xl border border-border p-3 text-sm text-text-muted">{t("copy5")}</p>}
        </div>
      </>}
      <div>
        <label htmlFor={`quick-start-${intent}-role-search`} className="mb-2 block text-sm font-medium text-text-primary">{intent === "crew" ? "2. Tätigkeit auswählen" : "Tätigkeit auswählen"}</label>
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id={`quick-start-${intent}-role-search`} autoComplete="off" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder={intent === "crew" ? "Zum Beispiel Key Grip oder Schnitt" : "Zum Beispiel Schauspiel, Model oder Komparserie"} className={`${inputClass} pl-10`} /></div>
        {roleSearch.trim() ? <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-bg-primary p-2">
          {matches.map((item) => {
            const selected = data.roles.some((role) => role.departmentId === item.departmentId && role.role === item.role);
            return <button key={`${item.departmentId}:${item.role}`} type="button" aria-pressed={selected} onClick={() => toggleRole(item, intent)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-gold/10 text-gold" : "text-text-primary hover:bg-bg-elevated"}`}><span className="min-w-0"><span className="block break-words text-sm font-medium">{getDepartmentRoleLabel(item.departmentId, item.role, locale, animals)}</span><span className="block text-xs text-text-muted">{getDeptLabel(departments.find(department=>department.id===item.departmentId)!, locale, animals)}</span></span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>;
          })}
          {!matches.length && <p className="px-3 py-4 text-sm text-text-muted">{t("copy6")}</p>}
        </div> : intent === "talent" ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(castDepartment?.roles ?? []).map((role) => { const selected = data.roles.some((item) => item.role === role); return <button key={role} type="button" aria-pressed={selected} onClick={() => toggleRole({ departmentId: "cast", role }, intent)} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm ${selected ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-primary text-text-primary"}`}><span className="break-words">{getDepartmentRoleLabel("cast", role, locale, animals)}</span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>; })}
        </div> : <div className="mt-3 space-y-2">
          {data.departmentIds.map((id, index) => {
            const department = departments.find((item) => item.id === id);
            if (!department) return null;
            const selectedCount = data.roles.filter((role) => role.departmentId === id).length;
            return <details key={id} className="rounded-xl border border-border bg-bg-primary" open={index === 0}><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text-primary"><span className="break-words">{department.emoji} {getDeptLabel(department, locale, animals)}</span><span className="shrink-0 text-xs font-normal text-text-muted">{selectedCount ? `${selectedCount} gewählt` : `${department.roles.length} Tätigkeiten`}</span></summary><div className="max-h-48 space-y-1 overflow-y-auto border-t border-border p-2">{[...new Set(department.roles)].map((role) => { const selected = data.roles.some((item) => item.departmentId === id && item.role === role); return <button key={role} type="button" aria-pressed={selected} onClick={() => toggleRole({ departmentId: id, role }, intent)} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${selected ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated"}`}><span className="break-words">{getDepartmentRoleLabel(id, role, locale, animals)}</span><span className="shrink-0">{selected ? "✓" : "+"}</span></button>; })}</div></details>;
          })}
          {!data.departmentIds.length && <p className="rounded-xl border border-border bg-bg-primary p-3 text-sm text-text-muted">{t("copy7")}</p>}
        </div>}
        <div className="mt-3 flex flex-wrap gap-2">{data.roles.map((item) => <span key={`${item.departmentId}:${item.role}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-2 text-xs text-gold"><span className="break-words">{item.role}</span><button type="button" aria-label={`${item.role} entfernen`} onClick={() => toggleRole(item, intent)} className="min-h-6 min-w-6 rounded-full hover:bg-bg-elevated">×</button></span>)}</div>
      </div>
    </div>;
  }

  function renderDetails() {
    if (activeIntent === "crew") return renderRolePicker("crew");
    if (activeIntent === "talent") return renderRolePicker("talent");
    if (activeIntent === "search") return <p className="rounded-xl border border-border bg-bg-primary p-5 text-sm leading-6 text-text-secondary">{t("copy8")}</p>;
    const intent = activeIntent;
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    if (intent === "location" || intent === "equipment") {
      const choices = QUICK_START_CATEGORIES[intent];
      return <div className="space-y-5">
        <ResponsiblePersonFields value={data.responsible ?? EMPTY_RESPONSIBLE_PERSON} onChange={value => updateSection(intent, { responsible: value })} accountPrefill compactWhenProfile={intent === "equipment"} />
        {intent === "equipment" ? <MarketplaceCategoryPicker value={data.category} onChange={value=>updateSection(intent,{category:value})} /> : <div><p className="mb-2 text-sm font-medium text-text-primary">{t("copy9")}</p><div id={`quick-start-${intent}-category`} tabIndex={-1} className="grid gap-2 sm:grid-cols-2">{choices.map((item) => <button key={item.value} type="button" aria-pressed={data.category === item.value} onClick={() => updateSection(intent, { category: item.value })} className={`min-h-14 min-w-0 rounded-xl border px-4 py-3 text-left ${data.category === item.value ? "border-gold bg-gold/10" : "border-border bg-bg-primary"}`}><span className="block break-words text-sm font-semibold text-text-primary">{item.label}</span><span className="mt-1 block break-words text-xs text-text-muted">{item.example}</span></button>)}</div></div>}
        <div><label htmlFor={`quick-start-${intent}-title`} className="mb-2 block text-sm font-medium text-text-primary">{t("copy10")}<span className="text-gold">*</span></label><input id={`quick-start-${intent}-title`} maxLength={200} value={data.title} onChange={(event) => updateSection(intent, { title: event.target.value })} placeholder={intent === "location" ? "Zum Beispiel Altbauwohnung mit Balkon" : "Zum Beispiel LED-Flächenleuchte"} className={inputClass} /></div>
        <div><label htmlFor={`quick-start-${intent}-city`} className="mb-2 block text-sm font-medium text-text-primary">{t("copy11")}<span className="text-gold">*</span></label><input id={`quick-start-${intent}-city`} autoComplete="address-level2" maxLength={100} value={data.city} onChange={(event) => updateSection(intent, { city: event.target.value })} placeholder={t("copy12")} className={inputClass} /></div>
      </div>;
    }
    const company = draft.sections.company ?? createQuickStartIntentData();
    const query = companyCategorySearch.trim().toLocaleLowerCase("de");
    const categories = QUICK_START_CATEGORIES.company.filter((category) => {
      const terms = `${animalCategoryLabel(category.value, category.label, animals)} ${category.example} ${category.value === CATERING_COMPANY_CATEGORY.id ? getCateringCompanySearchTerms().join(" ") : ""}`.toLocaleLowerCase("de");
      return !query || terms.includes(query);
    });
    return <div className="space-y-4">
      <ResponsiblePersonFields errors={responsibleErrors} company value={company.responsible ?? EMPTY_RESPONSIBLE_PERSON} onChange={value => updateSection("company", { responsible: value })} accountPrefill />
      <div><label htmlFor="quick-start-company-title" className="mb-2 block text-sm font-medium text-text-primary">{t("copy13")}<span className="text-gold">*</span></label><input id="quick-start-company-title" autoComplete="organization" maxLength={200} value={company.title} onChange={(event) => updateSection("company", { title: event.target.value })} placeholder={t("copy14")} className={inputClass} /></div>
      <div><label htmlFor="quick-start-company-city" className="mb-2 block text-sm font-medium text-text-primary">{t("copy15")}<span className="text-gold">*</span></label><input id="quick-start-company-city" autoComplete="address-level2" maxLength={100} value={company.city} onChange={(event) => updateSection("company", { city: event.target.value })} placeholder={t("copy12")} className={inputClass} /></div>
      <div><label htmlFor="quick-start-company-category-search" className="mb-2 block text-sm font-medium text-text-primary">{t("copy17")}<span className="text-gold">*</span></label><div className="relative mb-3"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-company-category-search" autoComplete="off" value={companyCategorySearch} onChange={(event) => setCompanyCategorySearch(event.target.value)} placeholder={t("copy18")} className={`${inputClass} pl-10`} /></div>
        <div id="quick-start-company-categories" tabIndex={-1} className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{categories.map((category) => { const selected = company.categoryIds.includes(category.value); return <button key={category.value} type="button" aria-pressed={selected} onClick={() => { const categoryIds = selected ? company.categoryIds.filter((id) => id !== category.value) : [...company.categoryIds, category.value]; updateSection("company", { categoryIds, ...(selected && category.value === CATERING_COMPANY_CATEGORY.id ? { cateringDetails: EMPTY_CATERING_COMPANY_DETAILS } : {}) }); }} className={`min-h-14 min-w-0 rounded-xl border px-4 py-3 text-left ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className="block break-words text-sm font-semibold text-text-primary">{animalCategoryLabel(category.value, category.label, animals)}</span><span className="mt-1 block break-words text-xs leading-5 text-text-muted">{isAnimalCompany([category.value]) ? animals("description") : category.example}</span></button>; })}{!categories.length && <p className="col-span-full rounded-xl border border-border p-4 text-sm text-text-muted">{t("copy19")}</p>}</div>
        <p className="mt-2 text-xs leading-5 text-text-muted">{t("copy20")}</p>
      </div>
    </div>;
  }

  function renderOptionalDetails() {
    if (activeIntent === "search") return <div className="rounded-xl border border-border bg-bg-primary p-5"><p className="text-sm leading-6 text-text-secondary">{t("copy21")}</p></div>;
    if (activeIntent === "crew" || activeIntent === "talent") {
      const intent = activeIntent;
      const data = draft.sections[intent] ?? createQuickStartIntentData();
      return <div className="space-y-5"><div><p className="mb-3 text-sm font-medium text-text-primary">{t("copy22")}<span className="text-text-muted">{t("copy23")}</span></p>{renderPhotoInput(intent, "Profilfoto auswählen")}</div><div><label htmlFor="quick-start-talent-intro" className="mb-2 block text-sm font-medium text-text-primary">{t("copy24")}<span className="text-text-muted">{t("copy23")}</span></label><textarea id="quick-start-talent-intro" rows={4} maxLength={1200} value={draft.talentIntro} onChange={(event) => update("talentIntro", event.target.value)} placeholder={t("copy26")} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-base text-text-primary outline-none focus:border-gold" /><p className="mt-1 text-xs text-text-muted">{t("copy27")}</p></div>{data.imageUrl && <p className="text-xs text-text-muted">{t("copy28")}</p>}</div>;
    }
    const intent = activeIntent;
    const data = draft.sections[intent] ?? createQuickStartIntentData();
    const isCompany = intent === "company";
    return <div className="space-y-5">
      <div><label htmlFor={`quick-start-${intent}-description`} className="mb-2 block text-sm font-medium text-text-primary">{t("copy29")}<span className="text-text-muted">{t("copy23")}</span></label><textarea id={`quick-start-${intent}-description`} rows={4} maxLength={3000} value={data.description} onChange={(event) => updateSection(intent, { description: event.target.value })} placeholder={isCompany ? "Was bietet deine Firma an?" : intent === "location" ? "Was ist an diesem Ort besonders?" : "Was ist enthalten und in welchem Zustand ist es?"} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-base text-text-primary outline-none focus:border-gold" /><p className="mt-1 text-xs text-text-muted">{t("copy31")}{isCompany ? "deinem Firmenprofil" : "diesem Angebotsentwurf"}.</p></div>
      <div><p className="mb-3 text-sm font-medium text-text-primary">{isCompany ? t("copy94") : "Foto für dein Angebot"} <span className="text-text-muted">{t("copy23")}</span></p>{renderPhotoInput(intent, isCompany ? "Firmenlogo auswählen" : "Angebotsfoto auswählen")}</div>
      {isCompany ? <div className="space-y-4 rounded-xl border border-border bg-bg-primary p-4"><p className="text-sm font-medium text-text-primary">{t("copy33")}<span className="text-text-muted">{t("copy23")}</span></p><div><label htmlFor="quick-start-company-email" className="mb-2 block text-sm text-text-primary">{t("copy35")}</label><input id="quick-start-company-email" type="email" autoComplete="email" maxLength={200} value={data.contactEmail} onChange={(event) => updateSection("company", { contactEmail: event.target.value })} placeholder={t("copy36")} className={inputClass} /></div><div><label htmlFor="quick-start-company-phone" className="mb-2 block text-sm text-text-primary">{t("copy37")}</label><input id="quick-start-company-phone" type="tel" autoComplete="tel" maxLength={80} value={data.contactPhone} onChange={(event) => updateSection("company", { contactPhone: event.target.value })} placeholder={t("copy38")} className={inputClass} /></div><div><label htmlFor="quick-start-company-website" className="mb-2 block text-sm text-text-primary">{t("copy39")}</label><input id="quick-start-company-website" type="url" autoComplete="url" maxLength={300} value={data.website} onChange={(event) => updateSection("company", { website: event.target.value })} placeholder={t("copy40")} className={inputClass} /></div></div> : <div className="rounded-xl border border-border bg-bg-primary p-4"><p className="mb-3 text-sm text-text-primary">{t("copy41")}<span className="text-text-muted">{t("copy23")}</span></p><div className="space-y-2"><ListingPriceOptions onRequest={data.priceOnRequest} negotiable={data.priceNegotiable === true} onChange={value => updateSection(intent, value)} />{!data.priceOnRequest && <div><label htmlFor={`quick-start-${intent}-price`} className="mb-2 mt-3 block text-sm text-text-primary">{t("copy43")}</label><input id={`quick-start-${intent}-price`} type="number" min="0" step="1" value={data.price} onChange={(event) => updateSection(intent, { price: event.target.value })} placeholder={t("copy44")} className={inputClass} /></div>}</div></div>}
      {isCompany && isAnimalCompany(data.categoryIds) && <AnimalCompanyFields value={data.animalDetails} onChange={animalDetails => updateSection("company", { animalDetails })} />}
      {isCompany && data.categoryIds.includes(CATERING_COMPANY_CATEGORY.id) && <div className="rounded-xl border border-border bg-bg-primary p-4"><p className="mb-3 text-sm font-medium text-text-primary">{t("copy45")}<span className="text-text-muted">{t("copy23")}</span></p><CateringCompanyFields value={data.cateringDetails} onChange={(cateringDetails) => updateSection("company", { cateringDetails })} /></div>}
    </div>;
  }

  if (!ready) return <div className="min-h-screen bg-bg-primary px-4 pt-20 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />{t("copy47")}</div>;
  if (loadError) return <div className="min-h-[75vh] bg-bg-primary px-4 pb-8 pt-8 sm:pt-12"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-6 text-center"><p role="alert" className="text-sm leading-6 text-red-300">{localizeSetupError(loadError, t, locale)}</p><p className="mt-2 text-xs leading-5 text-text-muted">{t("copy48")}</p><button type="button" onClick={() => { setReady(false); setLoadError(""); setLoadAttempt((value) => value + 1); }} className="mt-5 min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{t("copy49")}</button></section></div>;

  if (finished) return <div className="min-h-screen bg-bg-primary px-4 py-8 sm:py-12"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
    <CheckCircle2 size={36} className="mb-5 text-gold" />
    <p className="mb-2 text-xs font-semibold text-gold">{t("copy50")}</p>
    <h1 className="font-display text-2xl font-bold sm:text-3xl">{finished.completed.profile ? profilePublic ? "Dein Profil ist jetzt öffentlich sichtbar." : "Dein Profil ist erstellt." : finished.completed.company ? "Dein Firmenprofil ist erstellt." : finished.intents.every(intent => intent === "search") ? "Du kannst jetzt entdecken." : "Deine Angebotsentwürfe sind gespeichert."}</h1>
    <p className="mt-4 text-sm leading-6 text-text-secondary">{finished.completed.profile ? profilePublic ? "Andere können dich jetzt finden und dein Profil ansehen." : "Deine bisherigen Sichtbarkeitseinstellungen bleiben erhalten. Ein privates Profil bleibt privat." : finished.completed.company ? "Deine Firma wurde gespeichert. Etwaige Inserate haben einen eigenen Veröffentlichungsstatus." : "Deine Einrichtung ist abgeschlossen. Du kannst jederzeit weitere Bereiche ergänzen."}</p>
    <div className="mt-6 space-y-3">
      <Link href="/" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{t("copy51")}<ArrowRight size={16} /></Link>
      {finished.completed.profile && user?.id && <a href={`/profile/${encodeURIComponent(user.id)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold text-text-primary">{profilePublic ? "Öffentliches Profil ansehen" : "Profil ansehen"}<ArrowRight size={16} /></a>}
      {finished.completed.company && <a href={`/companies/${encodeURIComponent(finished.completed.company)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/30 px-5 text-sm font-semibold text-gold">{t("copy52")}<ArrowRight size={16} /></a>}
      {(finished.completed.listings.location || finished.completed.listings.equipment) && <><p className="rounded-xl border border-border bg-bg-primary p-4 text-xs leading-5 text-text-muted">{t("copy53")}</p>{Object.entries(finished.completed.listings).map(([kind, id]) => <a key={id} href={`/dashboard?tab=listings&editListing=${encodeURIComponent(id!)}`} className="flex min-h-12 items-center justify-center rounded-xl border border-border px-4 text-sm text-text-primary">{kind === "location" ? "Locationentwurf fortsetzen" : "Marktplatzentwurf fortsetzen"}</a>)}</>}
      {redirectTo && redirectTo !== "/dashboard" && <button type="button" onClick={() => router.replace(redirectTo)} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border px-4 text-sm text-text-primary">{t("copy54")}</button>}
    </div>
  </section></div>;
  if (draft.welcomeAcknowledged === false) return <div className="min-h-screen bg-bg-primary px-4 py-8 sm:py-12"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
    <CheckCircle2 size={32} className="mb-5 text-gold" /><p className="mb-2 text-xs font-semibold text-gold">{t("copy55")}</p>
    <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("copy56")}</h1>
    <p className="mt-4 text-sm leading-6 text-text-secondary">{t("copy57")}</p>
    <div className="mt-5 rounded-xl border border-border bg-bg-primary p-4"><p className="flex items-center gap-2 text-sm font-semibold"><UserRound size={17} className="text-gold" />{t("copy58")}</p><p className="mt-2 text-sm leading-6 text-text-muted">{t("copy59")}</p><p className="mt-2 text-xs leading-5 text-text-muted">{t("copy60")}</p></div>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{localizeSetupError(error, t, locale)}</p>}
    <button type="button" disabled={saving} onClick={async () => { setSaving(true); setError(""); const next = { ...draft, welcomeAcknowledged: true }; if (await persist(next)) setDraft(next); setSaving(false); }} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? t("copy101") : t("start")}<ArrowRight size={17} /></button>
    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-text-muted"><Lock size={14} className="mt-0.5 shrink-0" />{t("copy61")}</p>
  </section></div>;

  return <div className="min-h-screen bg-bg-primary px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:pt-10">
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">{t("copy62")}</p>
      <div className="mb-5 flex items-center justify-between gap-4" aria-label={t("stepCounter", {current:currentIndex+1,total:6})}><span className="text-sm font-semibold text-text-secondary">{t("stepCounter", {current:currentIndex+1,total:6})}</span><span role="status" aria-live="polite" className="text-xs text-text-muted">{localizeSetupMessage(saveLabel, t)}</span></div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${((currentIndex + 1) / 6) * 100}%` }} /></div>
      <h1 className="mb-2 break-words font-display text-2xl font-bold text-text-primary sm:text-3xl">{localizeSetupMessage(currentContent.title, t)}</h1>
      <p className="mb-6 max-w-2xl text-sm leading-6 text-text-muted">{localizeSetupMessage(currentContent.description, t)}</p>

      <section className="min-w-0 rounded-2xl border border-border bg-bg-secondary p-4 sm:p-7">
        {draft.step === "name" && <div><label htmlFor="quick-start-name" className="mb-2 block text-sm font-medium text-text-primary">{t("copy65")}<span className="text-gold">*</span></label><input id="quick-start-name" autoComplete="name" maxLength={120} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder={t("copy66")} className={inputClass} aria-describedby="quick-start-name-help" /><p id="quick-start-name-help" className="mt-2 text-xs leading-5 text-text-muted">{t("copy67")}</p></div>}

        {draft.step === "location" && <div className="space-y-4"><div><label htmlFor="quick-start-person-city" className="mb-2 block text-sm font-medium text-text-primary">{t("copy12")}{hasProfileIntent && <span className="text-gold">*</span>}</label><input id="quick-start-person-city" autoComplete="address-level2" maxLength={100} value={draft.personCity} onChange={(event) => update("personCity", event.target.value)} placeholder={t("copy69")} className={inputClass} /></div><div><label htmlFor="quick-start-person-country" className="mb-2 block text-sm font-medium text-text-primary">{t("copy70")}{hasProfileIntent && <span className="text-gold">*</span>}</label><select id="quick-start-person-country" value={countryOther ? "Andere" : draft.personCountry || t("copy71")} onChange={(event) => { const other = event.target.value === "Andere"; setCountryOther(other); update("personCountry", other ? "" : event.target.value); }} className={inputClass}><option>{t("copy71")}</option><option>{t("copy72")}</option><option>{t("copy73")}</option><option value="Andere">{t("copy74")}</option></select>{countryOther && <input aria-label={t("copy75")} autoComplete="country-name" maxLength={100} value={draft.personCountry} onChange={(event) => update("personCountry", event.target.value)} placeholder={t("copy75")} className={`${inputClass} mt-3`} />}</div>{!hasProfileIntent && <p className="text-xs leading-5 text-text-muted">{t("copy77")}</p>}</div>}

        {draft.step === "goals" && <div id="quick-start-goals" tabIndex={-1} className="grid gap-3 sm:grid-cols-2">{paths.map(({ id, detail, Icon }) => { const selected = draft.intents.includes(id); return <button key={id} type="button" aria-pressed={selected} onClick={() => toggleIntent(id)} className={`flex min-h-24 min-w-0 items-start gap-3 rounded-xl border p-4 text-left transition-colors ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/50"}`}><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-gold/15 text-gold" : "bg-bg-elevated text-text-muted"}`}><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-text-primary">{t(`${id}Intent`)}</span><span className="mt-1 block break-words text-xs leading-5 text-text-muted">{localizeSetupMessage(detail, t)}</span></span><span aria-hidden="true" className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${selected ? "border-gold bg-gold text-bg-primary" : "border-border text-transparent"}`}>✓</span></button>; })}</div>}

        {draft.step === "details" && <div>
          {detailIntents.length > 1 && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-primary px-3 py-2"><span className="text-xs text-text-muted">{t("areaCounter", {current:activeDetailIndex+1,total:detailIntents.length})}</span><span className="text-xs font-medium text-text-primary">{t(`${activeIntent}Intent`)}</span></div>}
          {renderDetails()}
        </div>}

        {draft.step === "intro" && <div>
          {introIntents.length > 1 && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg-primary px-3 py-2"><span className="text-xs text-text-muted">{t("additionCounter", {current:activeIntroIndex+1,total:introIntents.length})}</span><span className="text-xs font-medium text-text-primary">{activeIntent === "crew" && draft.intents.includes("talent") ? t("copy85") : t(`${activeIntent}Intent`)}</span></div>}
          {renderOptionalDetails()}
        </div>}

        {draft.step === "review" && <div className="space-y-4">
          <ReviewSection title={t("copy66")} onEdit={() => editReview("name")}><ReviewRow label={t("name")} value={draft.name} /></ReviewSection>
          <ReviewSection title={t("copy83")} onEdit={() => editReview("location")}><ReviewRow label={t("place")} value={[draft.personCity, draft.personCountry].filter(Boolean).join(", ")} /></ReviewSection>
          <ReviewSection title={t("copy84")} onEdit={() => editReview("goals")}><p className="break-words text-sm text-text-primary">{selectedIntentTitles.join(" · ") || "—"}</p></ReviewSection>
          {(draft.intents.includes("crew") || draft.intents.includes("talent")) && <>
            <ReviewSection title={t("copy85")} onEdit={() => editReview("details", draft.intents.includes("crew") ? "crew" : "talent")}><ReviewRow label={t("occupations")} value={selectedRoles.map((role) => role.role).join(", ")} /><PrimaryOccupationPicker id="quick-start-primary-occupation" positions={selectedRoles.map(role=>role.role)} value={draft.primaryOccupation ?? null} onChange={value=>update("primaryOccupation", value)} /><ReviewRow label={t("place")} value={[draft.personCity, draft.personCountry].filter(Boolean).join(", ")} /><p className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-xs leading-5 text-text-muted">{t("copy86")}</p></ReviewSection>
            <ReviewSection title={t("copy87")} onEdit={() => editReview("intro", draft.intents.includes("crew") ? "crew" : "talent")}>{draft.sections.crew?.imageUrl && <Image src={draft.sections.crew.imageUrl} alt={t("copy22")} width={240} height={240} className="h-20 w-20 rounded-xl object-cover" />}{draft.sections.talent?.imageUrl && <Image src={draft.sections.talent.imageUrl} alt={t("copy22")} width={240} height={240} className="h-20 w-20 rounded-xl object-cover" />}<ReviewRow label={t("introduction")} value={draft.talentIntro} /></ReviewSection>
          </>}
          {draft.intents.filter((intent) => intent === "location" || intent === "equipment").map((intent) => { const data = draft.sections[intent] ?? createQuickStartIntentData(); const categoryName = intent === "equipment" ? marketplaceCategoryLabel(data.category,marketCatalog) : QUICK_START_CATEGORIES[intent].find((item) => item.value === data.category)?.label ?? data.category; return <div key={intent} className="space-y-3"><ReviewSection title={t(`${intent}Intent`)} onEdit={() => editReview("details", intent)}><ReviewRow label={t("kind")} value={categoryName} /><ReviewRow label={t("listing")} value={data.title} /><ReviewRow label={t("place")} value={data.city} /></ReviewSection><ReviewSection title={`${t(`${intent}Intent`)}: Ergänzungen`} onEdit={() => editReview("intro", intent)}>{data.description && <ReviewRow label={t("description")} value={data.description} />}<ReviewRow label={t("copy41")} value={listingPriceLabel(Number(data.price), {price_on_request:data.priceOnRequest,price_negotiable:data.priceNegotiable})} />{data.imageUrl && <Image src={data.imageUrl} alt={t("copy90")} width={720} height={480} sizes="(max-width: 640px) 100vw, 640px" className="max-h-40 w-full rounded-lg object-contain" />}<p className="rounded-xl border border-border bg-bg-primary p-3 text-xs leading-5 text-text-muted">{t("copy91")}</p></ReviewSection></div>; })}
          {draft.intents.includes("company") && (() => { const data = draft.sections.company ?? createQuickStartIntentData(); const categoryLabels = QUICK_START_CATEGORIES.company.filter((category) => data.categoryIds.includes(category.value)).map((category) => animalCategoryLabel(category.value, category.label, animals)); const catering = data.cateringDetails; return <>
            <ReviewSection title={t("copy92")} onEdit={() => editReview("details", "company")}><ReviewRow label={t("name")} value={data.title} /><ReviewRow label={t("place")} value={data.city} /><ReviewRow label={t("industries")} value={categoryLabels.join(", ")} /></ReviewSection>
            <ReviewSection title={t("copy93")} onEdit={() => editReview("intro", "company")}>{data.description && <ReviewRow label={t("description")} value={data.description} />}{data.contactEmail && <ReviewRow label={t("copy35")} value={data.contactEmail} />}{data.contactPhone && <ReviewRow label={t("copy37")} value={data.contactPhone} />}{data.website && <ReviewRow label={t("copy39")} value={data.website} />}{isAnimalCompany(data.categoryIds) && <AnimalCompanySummary value={data.animalDetails} />}{data.categoryIds.includes(CATERING_COMPANY_CATEGORY.id) && catering.serviceTypes.length > 0 && <ReviewRow label={t("copy45")} value={catering.serviceTypes.join(", ")} />}{data.imageUrl && <Image src={data.imageUrl} alt={t("copy94")} width={320} height={160} sizes="320px" className="max-h-32 rounded-lg object-contain" />}</ReviewSection>
            <ReviewSection title={t("copy95")} onEdit={() => editReview("details", "company")}><p className="rounded-xl border border-gold/20 bg-gold/5 p-3 text-xs leading-5 text-text-secondary">{t("copy96")}</p></ReviewSection>
          </>; })()}
          {draft.intents.includes("search") && <p className="rounded-xl border border-border bg-bg-primary p-4 text-sm leading-6 text-text-secondary">{t("copy97")}</p>}
        </div>}
      </section>

      {completionPending && draft.completed.profile && <p role="status" className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4 text-sm text-text-primary">{t("copy98")}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300">{localizeSetupError(error, t, locale)}</p>}
      <div className="sticky bottom-0 z-30 -mx-4 mt-5 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border bg-bg-primary/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button type="button" disabled={saving || uploading || currentIndex === 0} onClick={() => void back()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={16} /> {t("copy99")}</button>
        {draft.step !== "review" ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">{draft.step === "intro" && <button type="button" disabled={saving || uploading || retrySeconds > 0} onClick={() => void skipOptional()} className="min-h-12 rounded-xl border border-border px-4 text-sm text-text-secondary disabled:opacity-50">{t("copy100")}</button>}<button type="button" disabled={saving || uploading || retrySeconds > 0} onClick={() => void next()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={16} className="animate-spin" /> {t("copy101")}</> : <>{t("copy102")}<ArrowRight size={16} /></>}</button></div> : <button type="button" disabled={saving || uploading || retrySeconds > 0} onClick={() => void finish()} className="inline-flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-center text-sm font-semibold leading-5 text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={17} className="shrink-0 animate-spin" /><span>{t("copy103")}</span></> : <><CheckCircle2 size={17} className="shrink-0" /><span>{retrySeconds > 0 ? t("retryFinish", {seconds:retrySeconds}) : completionPending ? t("finishPending") : completionActionLabel}</span></>}</button>}
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-text-muted">{t("copy104")}</p>
    </div>
  </div>;
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const t = useTranslations("setup");
  return <section className="min-w-0 space-y-3 rounded-xl border border-border bg-bg-primary p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-words text-sm font-semibold text-text-primary">{title}</h2><button type="button" onClick={onEdit} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-gold hover:bg-gold/10">{t("copy105")}</button></div>{children}</section>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-bg-secondary px-3 py-2"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 break-words whitespace-pre-wrap text-sm text-text-primary">{value || "—"}</p></div>;
}
