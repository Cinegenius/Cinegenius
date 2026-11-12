"use client";

import GenieWritingAssistant from "@/components/GenieWritingAssistant";

import PlaceField from "@/components/PlaceField";
import { placeInputValue } from "@/lib/places/core";
import { PROFILE_TRAIT_MESSAGE_KEYS, profileTraitLabel } from "@/lib/profile-trait-labels";
import ContentUsageNotice from "@/components/ContentUsageNotice";
import { useFormRouter as useRouter } from "@/lib/use-form-router";

import { useFormDraft } from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import { Suspense, useCallback, useState, useEffect, useRef } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { compressImage, compressAvatar, MAX_FUNCTION_UPLOAD_BYTES, safeObjectURL } from "@/lib/compressImage";
import {
  Camera, CheckCircle, User, Lock, Bell, Film,
  Plus, X, Save, Upload, ShieldCheck, Clock, AlertCircle, Loader2,
  Globe, Plane, Video, Euro, Clapperboard, Link2, AtSign, PlayCircle, ExternalLink,
  Users2, Eye, EyeOff, Pencil, Check, Search, ChevronDown,
} from "lucide-react";
import LicensePicker from "@/components/LicensePicker";
import ExternalProfilesSection from "@/components/ExternalProfilesSection";
import { useToast } from "@/contexts/ToastContext";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";
import PrimaryOccupationPicker from "@/components/PrimaryOccupationPicker";
import { selectedCrewOccupations } from "@/lib/crew-occupations";
import { removeProfilePosition, toggleProfileOccupation, type ProfileOccupationEdit } from "@/lib/profile-occupation-editor";
import { occupationId, primaryOccupationForPositions, occupationReference, orderPositionsByPrimary, type PrimaryOccupation } from "@/lib/primary-occupation";
import ProfileCoverEditor from "@/components/ProfileCoverEditor";
import { profileCoverSettings } from "@/lib/profile-cover";
import { getDeptLabel, getDepartmentRoleLabel, departments, deptColors, DEPARTMENT_TO_PROFILE_TYPE, getDepartmentRoleSearchTerms } from "@/lib/departments";
import { gripSearchTerms, GRIP_OCCUPATIONS, normalizeOccupation } from "@/lib/gripTaxonomy";
import RoleDropdown from "@/components/RoleDropdown";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { prepareProfileMediaFile, sendProfileMediaFile, PROFILE_MEDIA_ACCEPT, PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_SOURCE_MAX_BYTES } from "@/lib/profile-media-client";
import { publishProfileUpdated } from "@/lib/profile-update-events";
import { isAvatarUploadAssociated } from "@/lib/profile-avatar-persistence";
import { validateProfileSave, type ProfileSaveFieldErrors } from "@/lib/profile-save-validation";
import { PROFILE_EDITOR_STEPS, profileEditorAvailabilityConfig, profileEditorRequiredMissing, profileEditorStepForErrors, profileEditorStepForHint, shouldResumeProfileEditorDraft, type ProfileEditorStep } from "@/lib/profile-editor-flow";
import { uiErrorMessage } from "@/lib/ui-error-message";

const ALL_CREW_ROLES = departments.flatMap((d) => d.roles);

const PROJECT_TYPE_NORMALIZE: Record<string, string> = {
  "Werbefilm / Commercial": "Werbefilm",
  "Corporate Film": "Corporate",
  "Event / Live": "Event",
  "Foto / Shooting": "Shooting",
};
function getLocalizedProfileTypeLabels(translate: (key: string) => string): typeof PROFILE_TYPE_LABELS { return { actor: translate("menu.crewActors"), model: translate("MarketplaceOffer.fields.model"), extra: translate("Ui.text_359b6b495d37ee"), host: translate("Ui.text_0a95f0e5c8dfe9"), dancer: translate("Ui.text_edbf4c8ebb46d7"), stunt: translate("Ui.text_b84275027d70dc"), voiceover: translate("Ui.text_ecd65813175a41"), creator: translate("Ui.text_d952b2e69292db"), camera: translate("menu.crewCamera"), lighting: translate("Ui.text_df58636dc4a76c"), sound: translate("menu.crewSound"), director_of_photography: translate("Ui.text_e0e64895eb6431"), director: translate("menu.crewDirection"), production: translate("menu.crewProduction"), makeup: translate("Ui.text_93c744e1d17b9a"), costume: translate("Ui.text_a21ae87ef519df"), postproduction: translate("Ui.text_212f3b80ce86c2"), vfx: translate("Ui.text_23d20474305ac3"), sfx: translate("menu.marketSfx"), art_department: translate("Ui.text_a92fc587a90c16"), broadcast: translate("Ui.text_17bc9178343601"), filmmaker: translate("Ui.text_93ecd734fdc054"), writer: translate("Ui.text_fec099ea8a39bd"), photographer: translate("menu.crewPhotographer"), editor: translate("Ui.text_0e4eb4156e02e7"), motion_designer: translate("Ui.text_8213a51cdbc986"), art_director: translate("Ui.text_2d3b48143ed2b9"), location: translate("locations.vendorSection"), equipment: translate("props.vendorSection"), vehicle: translate("Ui.text_758a6eefc6f22f"), studio: translate("Ui.text_3e35f07c14a89e"), props: translate("Ui.text_54d1cc854cc30d") }; }

function normType(t: string | null | undefined): string | null {
  if (!t) return null;
  return PROJECT_TYPE_NORMALIZE[t] ?? t;
}
import {
  PROFILE_TYPE_LABELS,
  type ProfileImage,
  type ProfileType,
} from "@/lib/profile-types";
import { normalizeProfileTypes } from "@/lib/profile-display";
import ResilientPublicImage from "@/components/ResilientPublicImage";

function safeLink(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try { new URL(url); return url; } catch { return null; }
}

type ProfileMediaCopyKey = "uploadEmpty" | "uploadSourceTooBig" | "uploadUnsupported" | "uploadCompressedTooBig";

function profileMediaErrorText(
  error: "empty" | "source-too-large" | "unsupported" | "compressed-too-large",
  translate: (key: ProfileMediaCopyKey) => string,
) {
  const keys: Record<typeof error, ProfileMediaCopyKey> = {
    empty: "uploadEmpty",
    "source-too-large": "uploadSourceTooBig",
    unsupported: "uploadUnsupported",
    "compressed-too-large": "uploadCompressedTooBig",
  };
  return translate(keys[error]);
}

// The editor and dashboard share one completion calculation.

// ─── Chip-style type picker ───────────────────────────────────────────────────
const TALENT_CHIPS: [string, string][] = [
  ["actor",     "Schauspieler/in"],
  ["model",     "Model"],
  ["extra",     "Komparse"],
  ["host",      "Moderator/in"],
  ["dancer",    "Tänzer/in"],
  ["stunt",     "Stunt Performer"],
  ["voiceover", "Sprecher/in"],
  ["creator",   "Creator / Influencer"],
];

const ANBIETER_CHIPS: [string, string][] = [
  ["location",  "Location"],
  ["equipment", "Equipment"],
  ["vehicle",   "Fahrzeug"],
  ["studio",    "Studio"],
  ["props",     "Requisiten"],
];

const TALENT_TYPE_IDS  = new Set(TALENT_CHIPS.map(([id]) => id));
const ANBIETER_TYPE_IDS = new Set(ANBIETER_CHIPS.map(([id]) => id));

function TypeChipPicker({
  mode,
  selectedTypes,
  onTypesChange,
  positions,
  onPositionsChange,
  occupationSelections,
  onOccupationsChange,
}: {
  mode: "types" | "roles";
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  positions: string[];
  onPositionsChange: (p: string[]) => void;
  occupationSelections?: PrimaryOccupation[];
  onOccupationsChange?: (value: PrimaryOccupation[]) => void;
}) {
  const taxonomyText = useTranslations("Taxonomy");

  const uiText = useTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Schauspieler/in": uiText("menu.crewActors"),
    "Model": uiText("MarketplaceOffer.fields.model"),
    "Komparse": uiText("Ui.text_8049d2892a0908"),
    "Moderator/in": uiText("Ui.text_0a95f0e5c8dfe9"),
    "Tänzer/in": uiText("Ui.text_edbf4c8ebb46d7"),
    "Stunt Performer": uiText("Ui.text_b84275027d70dc"),
    "Sprecher/in": uiText("Ui.text_c8f0bb379aec76"),
    "Creator / Influencer": uiText("Ui.text_ee70984cb0ea7c"),
    "Location": uiText("profile.labelLocation"),
    "Equipment": uiText("companies.groupAusstattung"),
    "Fahrzeug": uiText("AdminAccounts.contentKinds.vehicle"),
    "Studio": uiText("Ui.text_0aa91af2ec4c1f"),
    "Requisiten": uiText("search.typeProps"),
  };






  const locale = useLocale();
  const animals = useTranslations("FilmAnimals");
  const [roleSearch, setRoleSearch] = useState("");
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});
  const [chosenDepartments, setChosenDepartments] = useState<string[]>([]);

  function applyOccupationEdit(next: ProfileOccupationEdit) {
    const current = selectedCrewOccupations(positions, occupationSelections);
    const currentIds = new Set(current.map(option => option.roleId));
    const nextIds = new Set(next.occupations.map(option => option.roleId));
    const changedDepartments = [...current.filter(option => !nextIds.has(option.roleId)), ...next.occupations.filter(option => !currentIds.has(option.roleId))].map(option => option.departmentId);
    const affectedTypes = new Set(changedDepartments.map(id => DEPARTMENT_TO_PROFILE_TYPE[id]).filter(Boolean));
    const remainingTypes = new Set(next.occupations.map(option => DEPARTMENT_TO_PROFILE_TYPE[option.departmentId]).filter(Boolean));
    const nextTypes = selectedTypes.filter(type => !affectedTypes.has(type) || remainingTypes.has(type));
    for (const type of affectedTypes) if (remainingTypes.has(type) && !nextTypes.includes(type)) nextTypes.push(type);
    onOccupationsChange?.(next.occupations);
    onPositionsChange(next.positions);
    if (nextTypes.join("|") !== selectedTypes.join("|")) onTypesChange(nextTypes);
  }

  function togglePosition(job: string, deptId: string) {
    applyOccupationEdit(toggleProfileOccupation(positions, occupationSelections, {departmentId: deptId, roleId: occupationId(deptId, job)}));
    setChosenDepartments(current => current.includes(deptId) ? current : [...current, deptId]);
  }

  function toggleType(type: string) {
    onTypesChange(selectedTypes.includes(type)
      ? selectedTypes.filter((selected) => selected !== type)
      : [...selectedTypes, type]);
  }

  const normalizedQuery = roleSearch.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de");
  const selectedOccupations = occupationSelections ?? selectedCrewOccupations(positions);
  const selectedRoleDepartments = [...new Set(selectedOccupations.map(option => option.departmentId))];
  const activeDepartmentIds = new Set([...chosenDepartments, ...selectedRoleDepartments]);
  const visibleDepartments = departments
    .map((dept) => ({
      dept,
      roles: dept.roles.filter((role) =>
        !normalizedQuery || [getDeptLabel(dept, locale, animals, taxonomyText), dept.label, ...Object.values(dept.labels)].some((label) => normalizeOccupation(label).includes(normalizeOccupation(normalizedQuery)))
        || getDepartmentRoleSearchTerms(dept, role, getDepartmentRoleLabel(dept.id, role, locale, animals, taxonomyText)).some((term) => normalizeOccupation(term).includes(normalizeOccupation(normalizedQuery)))
        || (dept.id === "grip" && gripSearchTerms(role).some((term) => normalizeOccupation(term).includes(normalizeOccupation(normalizedQuery)))),
      ),
    }))
    .filter(({ dept, roles }) => normalizedQuery ? roles.length > 0 : activeDepartmentIds.has(dept.id));

  if (mode === "types") {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-2.5 text-xs font-semibold text-text-primary">{uiText("Ui.text_eab9be960c0a8d")}</p>
          <p className="mb-3 text-xs leading-5 text-text-muted">{uiText("Ui.text_f023829e6f0b53")}</p>
          <div className="flex flex-wrap gap-2">
            {[...TALENT_CHIPS, ...ANBIETER_CHIPS].map(([id, label]) => {
              const active = selectedTypes.includes(id);
              return (
                <button key={id} type="button" aria-pressed={active} onClick={() => toggleType(id)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-gold/15 border-gold/50 text-gold" : "border-border text-text-muted hover:border-border-light hover:text-text-secondary"}`}>
                  {(uiOptionLabels[label] ?? label)}
                </button>
              );
            })}
          </div>
        </div>
        {(selectedTypes.some((type) => !TALENT_TYPE_IDS.has(type) && !ANBIETER_TYPE_IDS.has(type)) || positions.length > 0) && (
          <p className="rounded-lg border border-border bg-bg-primary/50 p-3 text-sm text-text-secondary">{uiText.rich("Ui.text_82162b4552dab6", { value1: () => (positions.length), value2: () => (positions.length === 1 ? uiText("Ui.text_0038a9cf86613c") : uiText("Ui.text_74fa1b2d740dc4")) })}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {positions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-primary">{uiText("Ui.text_c8e0c70f21214e")}</p>
          <div className="flex flex-wrap gap-2">
            {positions.map((position) => (
              <span key={position} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 text-sm text-gold">
                {position}
                <button type="button" onClick={() => {
                  applyOccupationEdit(removeProfilePosition(positions, occupationSelections, position));
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-500/10" aria-label={uiText("Ui.text_f10fe7a27ce274", { value1: String(position) })}><X size={14} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="search" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)}
          placeholder={uiText("Ui.text_fea778811305f9")} aria-label={uiText("Ui.text_b4f0607a19859b")}
          className="w-full rounded-xl border border-border bg-bg-primary py-3 pl-10 pr-4 text-base text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">{uiText("Ui.text_00ecd863c9281f")}</span>
        <select value="" onChange={(event) => {
          const id = event.target.value;
          if (id) {
            setChosenDepartments((current) => current.includes(id) ? current : [...current, id]);
            setExpandedDepartments((current) => ({ ...current, [id]: true }));
            setRoleSearch("");
          }
        }} className="min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary focus:border-gold focus:outline-none">
          <option value="">{uiText("Ui.text_f8eb121d675eae")}</option>
          {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.emoji} {getDeptLabel(dept, locale, animals, taxonomyText)}</option>)}
        </select>
      </label>
      <div className="space-y-3">
        {visibleDepartments.map(({ dept, roles }) => {
          const colors = deptColors(dept.color);
          const selectedCount = selectedOccupations.filter(option => option.departmentId === dept.id).length;
          const expanded = normalizedQuery ? expandedDepartments[dept.id] !== false : Boolean(expandedDepartments[dept.id] || selectedCount > 0);
          return (
            <section key={dept.id} className="overflow-hidden rounded-xl border border-border bg-bg-primary/50">
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedDepartments((current) => ({ ...current, [dept.id]: !expanded }))}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-elevated/60">
                <span className="min-w-0"><span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>{dept.emoji} {getDeptLabel(dept, locale, animals, taxonomyText)}</span><span className="ml-2 text-xs text-text-muted">{roles.length} {roles.length === 1 ? uiText("AdminReview.fields.role") : uiText("setup.occupations")}</span></span>
                <span className="flex shrink-0 items-center gap-2">{selectedCount > 0 && <span className={`rounded-full border px-2 py-1 text-[10px] ${colors.bg} ${colors.border} ${colors.text}`}>{uiText.rich("Ui.text_2936558f2682cd", { value1: () => (selectedCount) })}</span>}<ChevronDown size={15} className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
              </button>
              {expanded && <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                {dept.id === "grip" && <p className="mb-1 w-full text-xs leading-5 text-text-muted">{uiText("Ui.text_2cdb8c47738297")}</p>}
                {roles.map((role) => {
                  const active = selectedOccupations.some(option => option.roleId === occupationId(dept.id, role));
                  const explanation = GRIP_OCCUPATIONS.find((occupation) => occupation.label === role)?.description;
                  return <button key={role} type="button" aria-pressed={active} title={explanation} onClick={() => togglePosition(role, dept.id)}
                    className={`min-h-10 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${active ? `${colors.bg} ${colors.border} ${colors.text}` : "border-border text-text-muted hover:border-border-light hover:text-text-secondary"}`}>{getDepartmentRoleLabel(dept.id, role, locale, animals, taxonomyText)}</button>;
                })}
              </div>}
            </section>
          );
        })}
        {visibleDepartments.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">{normalizedQuery ? uiText("Ui.text_7982ace75ca2c1") : uiText("Ui.text_ca273a46a665c0")}</p>}
      </div>
    </div>
  );
}

// Category derived from profile_type — single source of truth
function getCategory(type: string): "talent" | "crew" | "creative" | "vendor" | null {
  const map: Record<string, "talent" | "crew" | "creative" | "vendor"> = {
    actor: "talent", model: "talent", extra: "talent", host: "talent",
    dancer: "talent", stunt: "talent", voiceover: "talent", creator: "talent",
    camera: "crew", lighting: "crew", sound: "crew", director_of_photography: "crew",
    production: "crew", makeup: "crew", costume: "crew", postproduction: "crew",
    vfx: "crew", sfx: "crew", art_department: "crew", broadcast: "crew",
    director: "creative", filmmaker: "creative", writer: "creative",
    photographer: "creative", editor: "creative", motion_designer: "creative",
    art_director: "creative",
    location: "vendor", equipment: "vendor", vehicle: "vendor",
    studio: "vendor", props: "vendor",
  };
  return map[type] ?? null;
}

// Tab labels are resolved inside the component using useTranslations
// We keep the IDs here and get labels from t() in the component
const TAB_IDS = [
  { id: "profile",        labelKey: "tabProfile",        icon: User        },
  { id: "projekte",       labelKey: "tabProjects",       icon: Clapperboard },
  { id: "inserate",       labelKey: "tabListings",       icon: Film        },
  { id: "netzwerk",       labelKey: "tabNetwork",        icon: Users2      },
  { id: "verification",   labelKey: "tabVerification",   icon: CheckCircle },
  { id: "security",       labelKey: "tabSecurity",       icon: Lock        },
  { id: "notifications",  labelKey: "tabNotifications",  icon: Bell        },
];

// ─── Verification Tab ────────────────────────────────────────────────────────

type VerifStatus = "none" | "pending" | "approved" | "rejected" | "loading";

function UploadZone({
  label, hint, accept, file, uploading, onFile,
}: {
  label: string; hint: string; accept: string;
  file: { name: string; url: string } | null;
  uploading: boolean;
  onFile: (f: File) => void;
}) {
  const uiText = useTranslations();

  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary mb-2">{label}</p>
      <div
        role="button" tabIndex={uploading ? -1 : 0} aria-disabled={uploading} aria-label={label}
        onClick={() => !uploading && ref.current?.click()}
        onKeyDown={event => { if (!uploading && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); ref.current?.click(); } }}
        className={`relative min-h-11 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          file ? "border-success/40 bg-success/5" : "border-border hover:border-gold/40"
        }`}
      >
        <input ref={ref} type="file" accept={accept} disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) onFile(f); }} />
        {uploading ? (
          <><Loader2 size={24} className="animate-spin text-gold mx-auto mb-2" /><p className="text-sm text-text-muted">{uiText("Ui.text_57c7dba7e17bc8")}</p></>
        ) : file ? (
          <><CheckCircle size={24} className="text-success mx-auto mb-2" /><p className="text-sm font-medium text-success truncate max-w-xs mx-auto">{file.name}</p></>
        ) : (
          <><Upload size={24} className="text-text-muted mx-auto mb-2" /><p className="text-sm text-text-muted">{hint}</p></>
        )}
      </div>
    </div>
  );
}

function VerificationTab() {
  const uiText = useTranslations();

  const { addToast } = useToast();
  const tV = useTranslations("profile");
  const [status, setStatus] = useState<VerifStatus>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [idFile, setIdFile] = useState<{ name: string; url: string } | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reload, setReload] = useState(0);
  const submitLock = useRef(false);
  const verificationText = useTranslations("VerificationReview");

  useEffect(() => {
    let active = true;
    setStatus("loading"); setLoadError("");
    fetch("/api/verification-requests", { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !["none", "pending", "approved", "rejected"].includes(result.status)) throw new Error(result.error || verificationText("statusError"));
        return result;
      })
      .then(result => { if (active) { setStatus(result.status); setReviewReason(result.data?.[0]?.review_reason ?? ""); } })
      .catch(error => { if (active) setLoadError(uiErrorMessage(error, verificationText("statusError"))); });
    return () => { active = false; };
  }, [reload, verificationText]);

  async function handleIdFile(file: File) {
    setIdUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error } = await res.json();
      if (!res.ok || !url) { addToast(error ?? tV("uploadFailed"), "error"); return; }
      setIdFile({ name: file.name, url });
    } catch { addToast(tV("uploadFailed"), "error"); }
    finally {
      setIdUploading(false);
    }
  }

  async function handleSubmit() {
    if (!idFile || idUploading || submitLock.current) return;
    submitLock.current = true; setSubmitting(true);
    try {
      const notes = JSON.stringify({ id_doc: idFile.url });
      const res = await fetch("/api/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === "approved" || data.status === "pending") { setStatus(data.status); return; }
        addToast(data.error ?? verificationText("requestFailed"), "error"); return;
      }
      setStatus("pending");
      addToast(tV("verifSubmit"), "success");
    } catch {
      addToast(tV("unknownError"), "error");
    } finally {
      submitLock.current = false; setSubmitting(false);
    }
  }

  if (loadError) return <div role="alert" className="min-w-0 rounded-xl border border-crimson/30 p-4 text-sm text-crimson-light"><p className="break-words">{loadError}</p><button onClick={() => setReload(value => value + 1)} className="mt-3 min-h-11 rounded-lg border border-border px-4 py-2 text-text-secondary">{verificationText("retry")}</button></div>;
  if (status === "loading") {
    return <div className="py-12 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-gold" /></div>;
  }

  if (status === "approved") {
    return (
      <div className="p-8 bg-success/5 border border-success/20 rounded-xl text-center space-y-4">
        <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck size={28} className="text-success" />
        </div>
        <h3 className="font-display text-xl font-bold text-text-primary">{tV("verifApproved")}</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
          {tV("verifApprovedDesc")}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 rounded-full text-success text-sm font-medium">
          <CheckCircle size={14} /> {tV("verifVerified")}
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="p-8 bg-bg-secondary border border-border rounded-xl text-center space-y-4">
        <div className="w-16 h-16 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center mx-auto">
          <Clock size={28} className="text-gold" />
        </div>
        <h3 className="font-display text-xl font-bold text-text-primary">{tV("verifPending")}</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
          {tV("verifPendingDesc")}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full text-gold text-sm font-medium">
          <Clock size={14} /> {tV("verifPendingStatus")}
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="space-y-5">
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl text-center space-y-3">
          <AlertCircle size={28} className="text-red-400 mx-auto" />
          <h3 className="font-semibold text-text-primary">{tV("verifRejected")}</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            {tV("verifRejectedDesc")}
          </p>
          {reviewReason && <p className="whitespace-pre-wrap break-words text-sm text-text-secondary [overflow-wrap:anywhere]">{reviewReason}</p>}
        </div>
        <button
          onClick={() => setStatus("none")}
          className="min-h-11 w-full py-3 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors"
        >
          {tV("verifRetry")}
        </button>
      </div>
    );
  }

  // status === "none"
  return (
    <div className="space-y-5">
      <UploadZone
        label={tV("verifIdLabel")}
        hint={tV("verifIdHint")}
        accept="image/jpeg,image/png,image/webp"
        file={idFile}
        uploading={idUploading}
        onFile={handleIdFile}
      />

      <div className="p-4 bg-bg-secondary border border-border rounded-xl flex items-start gap-2.5">
        <ShieldCheck size={15} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted leading-relaxed">
          {tV("verifPrivacy")}
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || idUploading || !idFile}
        className="min-h-11 w-full py-3 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? <><Loader2 size={15} className="animate-spin" /> {tV("verifSubmitting")}</> : <><ShieldCheck size={15} /> {tV("verifSubmit")}</>}
      </button>
    </div>
  );
}

function ProfileTabFromUrl({ onChange }: { onChange: (tab: string) => void }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const tab = requested && TAB_IDS.some(({ id }) => id === requested) ? requested : "profile";
  useEffect(() => { onChange(tab); }, [onChange, tab]);
  return null;
}

type FilmEntry = { year: number | string; title: string; role: string; type: string; director?: string; imdb_url?: string };

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const uiText = useTranslations();
  const PROFILE_TYPE_LABELS = getLocalizedProfileTypeLabels(uiText);

  const uiOptionLabels: Record<string, string> = {
    "Spielfilm": uiText("Ui.text_031b1c1fc4b241"),
    "Kurzfilm": uiText("Ui.text_75b346d26e4973"),
    "Serie": uiText("Ui.text_ab7743a4ad9a44"),
    "Dokumentation": uiText("projects.catDokumentation"),
    "Werbefilm": uiText("Ui.text_5c634ccc3ba66d"),
    "Musikvideo": uiText("projects.catMusikvideo"),
    "Corporate": uiText("projects.catCorporate"),
  };





  const uiLocale = useLocale();

  const router = useRouter();
  const { addToast } = useToast();
  const { user, isLoaded } = useUser();
  const t = useTranslations("profile");
  const optionalMedia = useTranslations("OptionalMedia");
  const photoCropText = useTranslations("ProfilePhotoCrop");
  const profileMediaLimitsText = t("uploadMediaLimits", {
    sourceMaxMb: PROFILE_MEDIA_SOURCE_MAX_BYTES / (1024 * 1024),
    compressedMaxMb: PROFILE_MEDIA_MAX_BYTES / (1024 * 1024),
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("profile");
  const selectProfileTab = (tab: string) => {
    router.replace(`/profile?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ProfileSaveFieldErrors>({});
  const [profileExists, setProfileExists] = useState(false);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState("");
  const [editorStep, setEditorStep] = useState<ProfileEditorStep>(1);
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState("");
  const [, setEditorRevision] = useState(0);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPausedRef = useRef(false);
  const draftSequenceRef = useRef(0);
  const draftQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const activityPickerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [messageEmailsEnabled, setMessageEmailsEnabled] = useState(true);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  // My projects & listings
  type MyProject = { id: string; title: string; year: number | null; type: string | null; poster_url: string | null };
  type MyListing = { id: string; title: string; type: string; price: number | null; city: string; image_url: string | null; category: string | null };
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [myProjectsLoading, setMyProjectsLoading] = useState(false);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const myProjectsFetched = useRef(false);
  const myListingsFetched = useRef(false);

  // Netzwerk / Collaborations
  type FriendCollab = { friendship_id: string; user_id: string; display_name: string; avatar_url: string | null; role: string; collab_label: string | null; collab_public: boolean };
  const [friends, setFriends] = useState<FriendCollab[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState("");
  const [collabEdits, setCollabEdits] = useState<Record<string, { label: string; is_public: boolean; saving: boolean }>>({});
  const friendsFetched = useRef(false);

  const [form, setForm] = useState({
    name: "",
    city: "",
    country: "",
    selected_place_city_id: "",
    website: "",
    bio: "",
    available: true,
    imdbUrl: "",
    availableFrom: "",
    travelReady: false,
    weekends: false,
    nightShoots: false,
    shortNotice: false,
    workRadius: "",
    slug: "",
    phone: "",
    contactEmail: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [memberships, setMemberships] = useState<string[]>([]);
  const [newMembership, setNewMembership] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
  const [primaryOccupation, setPrimaryOccupation] = useState<PrimaryOccupation | null>(null);
  const crewDataRef = useRef<Record<string, unknown>>({});
  const [occupationSelections, setOccupationSelections] = useState<PrimaryOccupation[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [newLanguage, setNewLanguage] = useState("");
  const [profileImages, setProfileImages] = useState<ProfileImage[]>([]);
  const [profileUploading, setProfileUploading] = useState(false);
  const profileImagesRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImagePreview, setCoverImagePreview] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({ x: 50, y: 33 });
  const [coverOpacity, setCoverOpacity] = useState(0.4);
  const [focalPickerImage, setFocalPickerImage] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [vimeoUrl, setVimeoUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [filmography, setFilmography] = useState<FilmEntry[]>([]);
  const [videoLinks, setVideoLinks] = useState<string[]>([]);
  const [newVideoLink, setNewVideoLink] = useState("");
  const [crewCertificates, setCrewCertificates] = useState<string[]>([]);

  // Project credits (linked projects)
  type ProjectCredit = {
    id: string;
    role: string;
    project_id: string;
    projects: { id: string; title: string; year: number | null; type: string | null; director: string | null; poster_url: string | null };
  };
  const [projectCredits, setProjectCredits] = useState<ProjectCredit[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectResults, setProjectResults] = useState<{ id: string; title: string; year: number | null; type: string | null }[]>([]);
  const [searchingProjects, setSearchingProjects] = useState(false);
  const [joinRole, setJoinRole] = useState("");
  const [joinCollaborator, setJoinCollaborator] = useState("");
  const [joiningProjectId, setJoiningProjectId] = useState<string | null>(null);
  const [joiningRole, setJoiningRole] = useState(false);
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
  const [editingCollaborator, setEditingCollaborator] = useState("");
  const [savingCollaborator, setSavingCollaborator] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", year: "", type: "", description: "", director: "", myRole: "", collaborator: "", poster_url: "", genre: "", productionCompany: "", location: "", selected_place_city_id: "", equipment: "", link: "", alsoOnCrewUnited: false });
  const [creatingProject, setCreatingProject] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  // ── Casting / Physical data ─────────────────────────────────────────────────
  const [currentProfileTypes, setCurrentProfileTypes] = useState<string[]>([]);
  const primaryProfileType = currentProfileTypes[0] ?? "";
  const [playingAgeMin, setPlayingAgeMin] = useState("");
  const [playingAgeMax, setPlayingAgeMax] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [clothingSize, setClothingSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [dialectsText, setDialectsText] = useState("");
  const [drivingLicensesText, setDrivingLicensesText] = useState("");
  const [beard, setBeard] = useState(false);
  const [tattoos, setTattoos] = useState(false);
  const [tattoosCoverable, setTattoosCoverable] = useState(false);
  const physicalDataRef = useRef<Record<string, unknown>>({});
  const performanceDataRef = useRef<Record<string, unknown>>({});
  const availabilityConfigRef = useRef<Record<string, unknown>>({});
  const originalTravelReadyRef = useRef(false);

  // ── Lazy-load my projects, listings & friends ──────────────────────────────
  useEffect(() => {
    if (activeTab === "projekte" && !myProjectsFetched.current) {
      myProjectsFetched.current = true;
      setMyProjectsLoading(true);
      fetch("/api/projects?mine=true")
        .then((r) => r.json())
        .then(({ projects }) => setMyProjects(projects ?? []))
        .finally(() => setMyProjectsLoading(false));
    }
    if (activeTab === "inserate" && !myListingsFetched.current) {
      myListingsFetched.current = true;
      setMyListingsLoading(true);
      fetch("/api/listings?mine=true")
        .then((r) => r.json())
        .then(({ data }) => setMyListings(data ?? []))
        .finally(() => setMyListingsLoading(false));
    }
    if (activeTab === "netzwerk" && !friendsFetched.current) {
      friendsFetched.current = true;
      setFriendsLoading(true);
      setFriendsError("");
      fetch("/api/friendships")
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.error) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
          return result;
        })
        .then(({ friends: list }) => {
          const f: FriendCollab[] = list ?? [];
          setFriends(f);
          const edits: Record<string, { label: string; is_public: boolean; saving: boolean }> = {};
          f.forEach((fr) => {
            edits[fr.friendship_id] = { label: fr.collab_label ?? "", is_public: fr.collab_public ?? false, saving: false };
          });
          setCollabEdits(edits);
        })
        .catch((error) => setFriendsError(uiErrorMessage(error, uiText("Ui.text_0504c98fd2caa9"))))
        .finally(() => setFriendsLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "notifications") return;
    let cancelled = false;
    setNotificationLoading(true);
    setNotificationError("");
    fetch("/api/user-settings")
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
        return result;
      })
      .then(({ settings }) => {
        if (!cancelled && settings) setMessageEmailsEnabled(settings.email_new_message !== false);
      })
      .catch((err) => {
        if (!cancelled) setNotificationError(uiText("Ui.text_5ffc3443f37e9f", { value1: String(uiErrorMessage(err, uiText("Ui.text_0504c98fd2caa9"))) }));
      })
      .finally(() => { if (!cancelled) setNotificationLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  const updateMessageEmails = async () => {
    const previous = messageEmailsEnabled;
    const next = !previous;
    setNotificationError("");
    setMessageEmailsEnabled(next);
    setNotificationLoading(true);
    try {
      const response = await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_new_message: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
      addToast(uiText("Ui.text_d2a2301c3bb1ed"), "success");
    } catch (err) {
      setMessageEmailsEnabled(previous);
      setNotificationError(uiText("Ui.text_7d80e16f8158c3", { value1: String(uiErrorMessage(err, uiText("Ui.text_8760d6e61c65fe"))) }));
    } finally {
      setNotificationLoading(false);
    }
  };

  // ── Load profile from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(r.status) }));
        return result;
      })
      .then(({ profile, exists, unavailableFields = [] }) => {
        if (unavailableFields.length > 0) {
          addToast(uiText("Ui.text_e7f05d1a09c33f", { value1: String(unavailableFields.join(", ")) }), "error");
        }
        setProfileExists(!!exists);
        setEditorStep(exists ? 0 : 1);
        if (profile) {
          setProfileUpdatedAt(typeof profile.updated_at === "string" ? profile.updated_at : "");
          const availabilityConfig = profile.availability_config as {
            weekends?: boolean;
            night_shoots?: boolean;
            short_notice?: boolean;
            work_radius_km?: number | null;
          } | null;
          availabilityConfigRef.current = profile.availability_config && typeof profile.availability_config === "object" && !Array.isArray(profile.availability_config) ? { ...profile.availability_config } : {};
          originalTravelReadyRef.current = profile.travel_ready ?? false;
          setForm({
            name:          profile.display_name        ?? "",
            city:          placeInputValue(profile, profile.location ?? ""),
            country:       "",
            selected_place_city_id: typeof profile.place_city_id === "string" ? profile.place_city_id : "",
            website:       profile.website_url         ?? profile.portfolio_url ?? "",
            bio:           profile.bio                 ?? "",
            available:     profile.available           ?? true,
            imdbUrl:       profile.imdb_url            ?? "",
            availableFrom: profile.available_from      ?? "",
            travelReady:   profile.travel_ready        ?? false,
            weekends:      availabilityConfig?.weekends      ?? false,
            nightShoots:   availabilityConfig?.night_shoots  ?? false,
            shortNotice:   availabilityConfig?.short_notice  ?? false,
            workRadius:    String(availabilityConfig?.work_radius_km ?? ""),
            slug:          (profile.slug && profile.slug !== "null") ? profile.slug : "",
            phone:         profile.phone               ?? "",
            contactEmail:  profile.contact_email       ?? "",
          });
          setSkills(profile.skills ?? []);
          setMemberships(profile.memberships ?? []);
          setPositions(profile.positions ?? []);
          crewDataRef.current = profile.crew ?? {};
          setOccupationSelections(selectedCrewOccupations(profile.positions ?? [], profile.crew?.occupations, profile.role, profile.crew?.primaryOccupation));
          setPrimaryOccupation(occupationReference(primaryOccupationForPositions(profile.crew?.primaryOccupation, profile.positions ?? [], profile.role)));
          setLanguages(profile.languages ?? []);
          setProfileImages(profile.profile_images ?? []);
          if (profile.avatar_url) {
            setAvatarUrl(profile.avatar_url);
            setAvatarPreview(profile.avatar_url);
          }
          if (profile.cover_image_url) {
            setCoverImageUrl(profile.cover_image_url);
            setCoverImagePreview(profile.cover_image_url);
          }
          const storedFocalPoint = profile.focal_point as (FocalPoint & { opacity?: number }) | null;
          if (storedFocalPoint) {
            const fp = storedFocalPoint;
            setFocalPoint(fp);
            setCoverOpacity(profileCoverSettings(fp).brightness);
          }
          setInstagramUrl(profile.instagram_url ?? "");
          setTiktokUrl(profile.tiktok_url ?? "");
          setYoutubeUrl(profile.youtube_url ?? "");
          setVimeoUrl(profile.vimeo_url ?? "");
          setLinkedinUrl(profile.linkedin_url ?? "");
          setDayRate(profile.day_rate ? String(profile.day_rate) : "");
          setFilmography(profile.filmography ?? []);
          // Merge legacy reel_url / showreel_url into video_links so there's one list
          const storedLinks: string[] = profile.video_links ?? [];
          const legacyReel = profile.reel_url ?? profile.showreel_url ?? "";
          if (legacyReel && !storedLinks.includes(legacyReel)) {
            setVideoLinks([legacyReel, ...storedLinks]);
          } else {
            setVideoLinks(storedLinks);
          }
          setCrewCertificates(profile.crew?.certificates ?? []);
          const profileTypes = normalizeProfileTypes(profile.profile_types ?? [], profile.profile_type ?? null);
          setCurrentProfileTypes(profileTypes);
          const phys = profile.physical ?? {};
          physicalDataRef.current = { ...phys };
          const performance = profile.performance ?? {};
          performanceDataRef.current = { ...performance };
          setPlayingAgeMin(phys.playing_age_min ? String(phys.playing_age_min) : "");
          setPlayingAgeMax(phys.playing_age_max ? String(phys.playing_age_max) : "");
          setHeightCm(phys.height_cm ? String(phys.height_cm) : "");
          setClothingSize(phys.clothing_size ?? "");
          setShoeSize(phys.shoe_size ? String(phys.shoe_size) : "");
          setHairColor(phys.hair_color ?? "");
          setEyeColor(phys.eye_color ?? "");
          setBodyType(phys.body_type ?? "");
          setDialectsText((performance.dialects ?? []).join(", "));
          setDrivingLicensesText((performance.driving_licenses ?? []).join(", "));
          setBeard(phys.beard ?? false);
          setTattoos(phys.tattoos ?? false);
          setTattoosCoverable(phys.tattoos_coverable ?? false);
        }
        setProfileLoading(false);
      })
      .catch((err) => {
        console.error("[profile page] failed to load profile", err);
        setProfileLoadError(true);
        setProfileLoading(false);
        addToast(uiText("Ui.text_5365725d585528"), "error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load project credits separately
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`/api/project-credits?user_id=${user.id}`)
      .then((r) => r.json())
      .then(({ credits }) => { if (credits) setProjectCredits(credits); })
      .catch(() => {});
  }, [isLoaded, user]);

  // ── Avatar upload ───────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;
    const previousAvatarUrl = avatarUrl;
    let uploadId: string | null = null;
    const preview = safeObjectURL(file);
    if (preview) setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      const prepared = await prepareProfileMediaFile(file, (source) => compressAvatar(source, uiText));
      if (!prepared.file) throw new Error(profileMediaErrorText(prepared.error, t));
      let url: string;
      if (profileExists) {
        const body = new FormData();
        body.append("file", prepared.file);
        uploadId = crypto.randomUUID().replace(/-/g, "");
        body.append("uploadId", uploadId);
        const response = await fetch("/api/profile/avatar", { method: "POST", body, cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.url || result.saved !== true) {
          throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
        }
        url = result.url as string;
      } else {
        // A not-yet-created profile has no row to associate yet. Keep the
        // upload as a draft and persist its URL with the first profile save.
        url = await sendProfileMediaFile(prepared.file, uiText);
      }
      setAvatarUrl(url);
      setAvatarPreview(url);
      markEditorChanged();
      if (profileExists) {
        publishProfileUpdated({ userId: user?.id, displayName: form.name, avatarUrl: url, previousAvatarUrl });
        addToast(uiText("Ui.text_109abfbfca1583"), "success");
      } else {
        addToast(uiText("Ui.text_19c7a309277933"), "success");
      }
      // Fokuspunkt setzen
      setFocalPickerImage(url);
    } catch (err) {
      if (profileExists && uploadId) {
        try {
          const response = await fetch("/api/profile", { cache: "no-store" });
          const result = await response.json().catch(() => ({}));
          const savedUrl = result?.profile?.avatar_url;
          if (response.ok && isAvatarUploadAssociated(savedUrl, uploadId)) {
            setAvatarUrl(savedUrl);
            setAvatarPreview(savedUrl);
            markEditorChanged();
            publishProfileUpdated({ userId: user?.id, displayName: form.name, avatarUrl: savedUrl, previousAvatarUrl });
            addToast(uiText("Ui.text_ed4cfa434db291"), "success");
            return;
          }
        } catch {
          // If both the upload response and confirmation are unavailable, retain
          // the previous photo and let the user retry without losing it.
        }
      }
      addToast(uiText("Ui.text_b1195d7a229dd2", { value1: String(uiErrorMessage(err, t("uploadFailed"))) }), "error");
      setAvatarUrl(previousAvatarUrl);
      setAvatarPreview(previousAvatarUrl);
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setAvatarUploading(false);
      input.value = "";
    }
  };

  const removeAvatar = () => {
    setAvatarPreview("");
    setAvatarUrl("");
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;
    const _cp = safeObjectURL(file); if (_cp) setCoverImagePreview(_cp);
    setCoverUploading(true);
    try {
      const prepared = await prepareProfileMediaFile(file, (source) => compressImage(source, { maxWidth: 1920, maxHeight: 1080, quality: 0.85, maxBytes: MAX_FUNCTION_UPLOAD_BYTES , translate: uiText }));
      if (!prepared.file) throw new Error(profileMediaErrorText(prepared.error, t));
      const url = await sendProfileMediaFile(prepared.file, uiText);
      setCoverImageUrl(url);
      setCoverImagePreview(url);
      markEditorChanged();
      addToast(uiText("Ui.text_bae6fb5ab0b491"), "success");
      // Cover cropping has its own controls; never change the portrait focus.
      setFocalPoint(current => ({ ...current, cover: { x: 50, y: 50 } }));
    } catch (err) {
      addToast(uiText("Ui.text_99e8fcd5af3347", { value1: String(uiErrorMessage(err, t("uploadFailed"))) }), "error");
      setCoverImagePreview(coverImageUrl);
    } finally {
      setCoverUploading(false);
      input.value = "";
    }
  };

  // ── Project credit helpers ──────────────────────────────────────────────────
  const searchProjects = async (q: string) => {
    if (!q.trim()) { setProjectResults([]); return; }
    setSearchingProjects(true);
    try {
      const r = await fetch(`/api/projects?q=${encodeURIComponent(q)}&limit=8`);
      const { projects } = await r.json();
      setProjectResults(projects ?? []);
    } finally {
      setSearchingProjects(false);
    }
  };

  const roleCollaboratorHint = (role: string) => {
    const value = role.toLowerCase();
    if (/personal assistant|talent assistant|persönliche assistenz/.test(value)) return uiText("Ui.text_13b6461312a5d4");
    if (/driver|fahrer/.test(value)) return uiText("Ui.text_76648c97bedf99");
    if (/gaffer|beleucht|licht/.test(value)) return uiText("Ui.text_119eca3d18ed02");
    if (/kamera|cinematograph/.test(value)) return uiText("Ui.text_c7fcefa242b285");
    if (/kostüm|costume/.test(value)) return uiText("Ui.text_6a9ec7f4f48978");
    if (/runner/.test(value)) return uiText("Ui.text_26fb9c385868f2");
    return uiText("Ui.text_c19f97ac3231ff");
  };

  const roleWithCollaborator = (role: string, collaborator: string) => {
    const cleanRole = role.trim();
    const cleanCollaborator = collaborator.trim();
    if (!cleanRole) return "";
    return cleanCollaborator ? `${cleanRole}||${cleanCollaborator}` : cleanRole;
  };

  const joinProject = async (projectId: string) => {
    if (!joinRole.trim()) return;
    setJoiningRole(true);
    try {
      const r = await fetch("/api/project-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, role: roleWithCollaborator(joinRole, joinCollaborator) }),
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error, "error"); return; }
      // Refresh credits
      const r2 = await fetch(`/api/project-credits?user_id=${user?.id}`);
      const d2 = await r2.json();
      setProjectCredits(d2.credits ?? []);
      setJoiningProjectId(null);
      setJoinRole("");
      setJoinCollaborator("");
      setProjectSearch("");
      setProjectResults([]);
      addToast(t("joinedProject"), "success");
    } finally {
      setJoiningRole(false);
    }
  };

  const leaveProject = async (projectId: string) => {
    await fetch(`/api/project-credits?project_id=${projectId}`, { method: "DELETE" });
    setProjectCredits((prev) => prev.filter((c) => c.project_id !== projectId));
    addToast(t("leftProject"), "success");
  };

  const saveCollaborator = async (creditId: string) => {
    setSavingCollaborator(true);
    try {
      const res = await fetch("/api/project-credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: creditId, collaborator: editingCollaborator }),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.error, "error"); return; }
      setProjectCredits((prev) => prev.map((c) => c.id === creditId ? { ...c, role: d.role } : c));
      setEditingCreditId(null);
      setEditingCollaborator("");
    } finally {
      setSavingCollaborator(false);
    }
  };

  const createProject = async () => {
    if (!newProject.title.trim()) { addToast(t("titleMissing"), "error"); return; }
    setCreatingProject(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newProject, selected_place_city_id: newProject.selected_place_city_id || undefined, myRole: roleWithCollaborator(newProject.myRole, newProject.collaborator) }),
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error, "error"); return; }
      if (!d.draft?.id) throw new Error(uiText("Ui.text_bd88388ea3601a"));
      setShowNewProject(false);
      setNewProject({ title: "", year: "", type: "", description: "", director: "", myRole: "", collaborator: "", poster_url: "", genre: "", productionCompany: "", location: "", selected_place_city_id: "", equipment: "", link: "", alsoOnCrewUnited: false });
      addToast(uiText("FormDraft.saved"), "success");
      router.push(`/dashboard/projects/drafts/${d.draft.id}`);
    } catch (error) {
      addToast(uiErrorMessage(error, uiText("Ui.text_46dbd7a67ff42c")), "error");
    } finally {
      setCreatingProject(false);
    }
  };

  // ── Save profile ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (avatarUploading || coverUploading || profileUploading) {
      addToast(uiText("Ui.text_57b48356540c51"), "error");
      return;
    }
    if (profileLoadError) {
      addToast(uiText("Ui.text_d4435a545845cd"), "error");
      return;
    }
    if (!draftLoaded) {
      addToast(uiText("Ui.text_8f3a9ca2e9ef23"), "error");
      return;
    }
    const validationErrors = validateProfileSave({
      name: form.name,
      city: form.city,
      positions,
      profileTypes: currentProfileTypes,
    }, uiText);
    if (positions.length && !primaryOccupationForPositions(primaryOccupation, positions)) validationErrors.activity = uiText("Ui.text_89818eac599e88");
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const destination = profileEditorStepForErrors(Object.keys(validationErrors) as ("activity" | "name" | "city")[]);
      setEditorStep(destination);
      focusEditorField(validationErrors.activity ? "activity" : validationErrors.name ? "name" : "city");
      return;
    }
    draftPausedRef.current = true;
    draftSequenceRef.current += 1;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    setSaving(true);
    try {
      await draftQueueRef.current.catch(() => {});
      const location = [form.city.trim(), form.country.trim()].filter(Boolean).join(", ");
      const physicalValues = {
        ...physicalDataRef.current,
        playing_age_min:   playingAgeMin ? Number(playingAgeMin) : null,
        playing_age_max:   playingAgeMax ? Number(playingAgeMax) : null,
        height_cm:         heightCm ? Number(heightCm) : null,
        clothing_size:     clothingSize.trim() || null,
        shoe_size:         shoeSize ? Number(shoeSize) : null,
        hair_color:        hairColor || null,
        eye_color:         eyeColor || null,
        body_type:         bodyType || null,
        beard,
        tattoos,
        tattoos_coverable: tattoosCoverable,
      };
      const hasOptionalValue = (value: unknown): boolean => {
        if (value == null) return false;
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.values(value).some(hasOptionalValue);
        return value !== false && value !== 0;
      };
      const physical = Object.values(physicalValues).some(hasOptionalValue) ? physicalValues : null;
      const performanceValues = {
        ...performanceDataRef.current,
        dialects: dialectsText.split(",").map((value) => value.trim()).filter(Boolean),
        driving_licenses: drivingLicensesText.split(",").map((value) => value.trim()).filter(Boolean),
      };
      const performance = Object.values(performanceValues).some(hasOptionalValue) ? performanceValues : null;
      const commonPayload = {
        display_name:   form.name,
        avatar_url:     avatarUrl || null,
        location,
        selected_place_city_id: form.selected_place_city_id || undefined,
        bio:            form.bio,
        available:      form.available,
        skills,
        memberships,
        positions: (() => {
          const primary = primaryOccupationForPositions(primaryOccupation, positions);
          return orderPositionsByPrimary(positions, primary);
        })(),
        profile_types:  currentProfileTypes,
        profile_type:   primaryProfileType || null,
        physical,
        performance,
        languages,
        profile_images: profileImages,
        reel_url:       videoLinks[0] || null,
        available_from: form.availableFrom || null,
        travel_ready:   form.travelReady,
        availability_config: profileEditorAvailabilityConfig(availabilityConfigRef.current, { ...form, originalTravelReady: originalTravelReadyRef.current }),
        cover_image_url: coverImageUrl || null,
        focal_point: { ...focalPoint, opacity: coverOpacity },
        instagram_url:  instagramUrl || null,
        tiktok_url:     tiktokUrl || null,
        youtube_url:    youtubeUrl || null,
        vimeo_url:      vimeoUrl || null,
        linkedin_url:   linkedinUrl || null,
        website_url:    safeLink(form.website) || null,
        imdb_url:       safeLink(form.imdbUrl) || null,
        phone:          form.phone.trim() || null,
        contact_email:  form.contactEmail.trim() || null,
        day_rate:       dayRate ? parseInt(dayRate) : null,
        filmography,
        video_links:    videoLinks,
        crew: { ...crewDataRef.current, occupations: selectedCrewOccupations(positions, occupationSelections, null, primaryOccupation), certificates: crewCertificates, primaryOccupation: occupationReference(primaryOccupationForPositions(primaryOccupation, positions)) },
      };

      // First-time profile creation uses POST; subsequent edits use PATCH
      const isNew = !profileExists;
      const res = await fetch("/api/profile", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? {
          ...commonPayload,
          avatar_url:     avatarUrl || null,
          portfolio_images: [],
          experience:     "",
          slug:           form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null,
        } : {
          ...commonPayload,
          slug:           form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null,
        }),
      });
      const baseResult = await res.json().catch(() => ({}));
      if (!res.ok || baseResult.error) {
        draftPausedRef.current = false;
        const serverFieldErrors = baseResult.fieldErrors;
        if (serverFieldErrors && typeof serverFieldErrors === "object") {
          setFieldErrors({
            name: serverFieldErrors.display_name,
            city: serverFieldErrors.location,
            activity: serverFieldErrors.activity,
          });
          const destination = profileEditorStepForErrors(Object.keys(serverFieldErrors).flatMap((key) => key === "display_name" ? ["name" as const] : key === "location" ? ["city" as const] : key === "activity" ? ["activity" as const] : []));
          setEditorStep(destination);
          focusEditorField(destination === 1 ? "activity" : serverFieldErrors.display_name ? "name" : "city");
        }
        const msg = baseResult.error ?? `HTTP ${res.status}`;
        addToast(uiText("Ui.text_630b2e84aede8c", { value1: String(msg) }), "error");
        return;
      }
      if (isNew) setProfileExists(true);
      setProfileUpdatedAt(new Date().toISOString());
      setEditorStep(0);
      setEditorRevision(0);
      const url = avatarUrl || null;
      publishProfileUpdated({ userId: user?.id, displayName: form.name, avatarUrl: url, focalPoint });
      const unavailableFields: string[] = baseResult.unavailableFields ?? [];
      try {
        await fetch("/api/onboarding?type=profile-edit", { method: "DELETE" });
      } catch {
        // The newer public profile timestamp prevents an older private draft from being resumed.
      }
      await profileDraft.complete();


      physicalDataRef.current = physical ?? {};
      performanceDataRef.current = performance ?? {};
      availabilityConfigRef.current = commonPayload.availability_config;
      originalTravelReadyRef.current = form.travelReady;

      if (unavailableFields.length > 0) {
        addToast(uiText("Ui.text_5a5f71213f5b75", { value1: String(unavailableFields.join(", ")) }), "error");
      } else {
        addToast(t("profileSaved"), "success");
      }
    } catch (err) {
      draftPausedRef.current = false;
      addToast(uiText("Ui.text_dc4c94d7d3926e", { value1: String(uiErrorMessage(err, uiText("System.requestFailed"))) }), "error");
    } finally {
      setSaving(false);
      if (!draftPausedRef.current) markEditorChanged();
    }
  };

  const updateProfileImages = (images: ProfileImage[]) => {
    setProfileImages(images);
  };

  const handleProfileImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setProfileUploading(true);
    try {
      const preparedFiles = await Promise.all(files.map((file) => prepareProfileMediaFile(
        file,
        (source) => compressImage(source, { maxWidth: 1600, quality: 0.82, maxBytes: MAX_FUNCTION_UPLOAD_BYTES , translate: uiText }),
      )));
      const firstFailure = preparedFiles.find((prepared) => !prepared.file);
      if (firstFailure && !firstFailure.file) throw new Error(profileMediaErrorText(firstFailure.error, t));

      const uploaded: ProfileImage[] = [];
      for (const prepared of preparedFiles) {
        if (!prepared.file) continue;
        const url = await sendProfileMediaFile(prepared.file, uiText);
        uploaded.push({ url, featured: false });
      }

      // Merge with existing, auto-feature first if none set
      const merged = [...profileImages, ...uploaded];
      if (!merged.some((i) => i.featured)) merged[0] = { ...merged[0], featured: true };
      updateProfileImages(merged);
      markEditorChanged();

      addToast(uiText("Ui.text_76771fbaea1b09", { value1: String(uploaded.length) }), "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isBrowserBug = !msg || /did not match|pattern/i.test(msg);
      addToast(isBrowserBug ? t("uploadFailed") : uiErrorMessage(err, t("uploadFailed")), "error");
    } finally {
      setProfileUploading(false);
      input.value = "";
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills((prev) => [...prev, s]);
      setNewSkill("");
    }
  };

  const addMembership = () => {
    const m = newMembership.trim();
    if (m && !memberships.includes(m)) {
      setMemberships((prev) => [...prev, m]);
      setNewMembership("");
    }
  };

  const addLanguage = () => {
    const l = newLanguage.trim();
    if (l && !languages.includes(l)) {
      setLanguages((prev) => [...prev, l]);
      setNewLanguage("");
    }
  };

  // Derived values
  const clerkEmail = user?.emailAddresses[0]?.emailAddress ?? "";
  const selectedCategories = new Set(currentProfileTypes.map(getCategory).filter(Boolean));
  const showCrewSections = currentProfileTypes.length === 0 || selectedCategories.has("crew") || selectedCategories.has("creative");
  const showTalentSections = selectedCategories.has("talent");

  const completion = calculateProfileCompletion({
    name: form.name,
    avatarUrl,
    location: form.city,
    bio: form.bio,
    images: profileImages.map((image) => image.url),
    videoLinks,
    profileType: primaryProfileType,
    heightCm,
    hairColor,
    playingAgeMin,
    positions,
    filmography,
    languages,
  });
  const requiredMissing = profileEditorRequiredMissing({ name: form.name, city: form.city, positions, profileTypes: currentProfileTypes });
  const visibleFieldErrors = Object.fromEntries(Object.entries(fieldErrors).filter(([, message]) => Boolean(message))) as ProfileSaveFieldErrors;
  const completionHints: Record<string, string> = {
    name: t("hintName"), avatar: t("hintAvatar"), city: t("hintCity"), bio: t("hintBio"),
    type: t("hintType"), photos: t("hintPhotos"), video: t("hintVideo"), languages: t("hintLanguages"),
    height: t("hintHeight"), hair: t("hintHair"), age: t("hintAge"), role: t("hintRole"), credits: t("hintCredits"),
  };
  const completionMissing = completion.missing.slice(0, 3).map((key) => completionHints[key] ?? key);
  const displayAvatarName = form.name || clerkEmail.split("@")[0] || "?";

  function markEditorChanged() {

    setEditorRevision((revision) => revision + 1);
  }

  const buildEditorDraft = () => ({
    step: editorStep,
    form,
    skills,
    memberships,
    positions,
    languages,
    profileImages,
    avatarUrl,
    coverImageUrl,
    focalPoint,
    coverOpacity,
    instagramUrl,
    tiktokUrl,
    youtubeUrl,
    vimeoUrl,
    linkedinUrl,
    dayRate,
    filmography,
    videoLinks,
    crewCertificates,
    primaryOccupation,
    occupationSelections,
    currentProfileTypes,
    physicalData: physicalDataRef.current,
    performanceData: performanceDataRef.current,
    availabilityData: availabilityConfigRef.current,
    playingAgeMin,
    playingAgeMax,
    heightCm,
    clothingSize,
    shoeSize,
    hairColor,
    eyeColor,
    bodyType,
    dialectsText,
    drivingLicensesText,
    beard,
    tattoos,
    tattoosCoverable,
  });

  const restoreEditorDraft = useCallback((saved: ReturnType<typeof buildEditorDraft>) => {
          if (saved.form && typeof saved.form === "object") setForm((current) => ({ ...current, ...(saved.form as Partial<typeof current>), selected_place_city_id: typeof (saved.form as Partial<typeof current>).selected_place_city_id === "string" ? (saved.form as typeof current).selected_place_city_id : "" }));
          if (Array.isArray(saved.skills)) setSkills(saved.skills.filter((item: unknown): item is string => typeof item === "string"));
          if (Array.isArray(saved.memberships)) setMemberships(saved.memberships.filter((item: unknown): item is string => typeof item === "string"));
          if (Array.isArray(saved.positions)) setPositions(saved.positions.filter((item: unknown): item is string => typeof item === "string"));
          if (Array.isArray(saved.languages)) setLanguages(saved.languages.filter((item: unknown): item is string => typeof item === "string"));
          if (Array.isArray(saved.profileImages)) setProfileImages(saved.profileImages.filter((item: unknown) => !!item && typeof item === "object" && typeof (item as ProfileImage).url === "string"));
          if (typeof saved.avatarUrl === "string") { setAvatarUrl(saved.avatarUrl); setAvatarPreview(saved.avatarUrl); }
          if (typeof saved.coverImageUrl === "string") { setCoverImageUrl(saved.coverImageUrl); setCoverImagePreview(saved.coverImageUrl); }
          if (saved.focalPoint && typeof saved.focalPoint === "object") setFocalPoint(saved.focalPoint as FocalPoint);
          if (typeof saved.coverOpacity === "number") setCoverOpacity(saved.coverOpacity);
          if (typeof saved.instagramUrl === "string") setInstagramUrl(saved.instagramUrl);
          if (typeof saved.tiktokUrl === "string") setTiktokUrl(saved.tiktokUrl);
          if (typeof saved.youtubeUrl === "string") setYoutubeUrl(saved.youtubeUrl);
          if (typeof saved.vimeoUrl === "string") setVimeoUrl(saved.vimeoUrl);
          if (typeof saved.linkedinUrl === "string") setLinkedinUrl(saved.linkedinUrl);
          if (typeof saved.dayRate === "string") setDayRate(saved.dayRate);
          if (Array.isArray(saved.filmography)) setFilmography(saved.filmography);
          if (Array.isArray(saved.videoLinks)) setVideoLinks(saved.videoLinks.filter((item: unknown): item is string => typeof item === "string"));
          if (Object.hasOwn(saved, "primaryOccupation")) setPrimaryOccupation(occupationReference(primaryOccupationForPositions(saved.primaryOccupation, Array.isArray(saved.positions) ? saved.positions : [])));
          if (Array.isArray(saved.crewCertificates)) setCrewCertificates(saved.crewCertificates.filter((item: unknown): item is string => typeof item === "string"));
          if (Array.isArray(saved.occupationSelections)) setOccupationSelections(selectedCrewOccupations(Array.isArray(saved.positions) ? saved.positions : [], saved.occupationSelections));
          if (Array.isArray(saved.currentProfileTypes)) setCurrentProfileTypes(saved.currentProfileTypes.filter((item: unknown): item is string => typeof item === "string"));
          if (saved.physicalData && typeof saved.physicalData === "object") physicalDataRef.current = saved.physicalData as Record<string, unknown>;
          if (saved.performanceData && typeof saved.performanceData === "object") performanceDataRef.current = saved.performanceData as Record<string, unknown>;
          if (saved.availabilityData && typeof saved.availabilityData === "object" && !Array.isArray(saved.availabilityData)) availabilityConfigRef.current = saved.availabilityData as Record<string, unknown>;
          for (const [key, setter] of [
            ["playingAgeMin", setPlayingAgeMin], ["playingAgeMax", setPlayingAgeMax], ["heightCm", setHeightCm],
            ["clothingSize", setClothingSize], ["shoeSize", setShoeSize], ["hairColor", setHairColor],
            ["eyeColor", setEyeColor], ["bodyType", setBodyType], ["dialectsText", setDialectsText],
            ["drivingLicensesText", setDrivingLicensesText],
          ] as const) if (typeof saved[key] === "string") setter(saved[key] as never);
          if (typeof saved.beard === "boolean") setBeard(saved.beard);
          if (typeof saved.tattoos === "boolean") setTattoos(saved.tattoos);
          if (typeof saved.tattoosCoverable === "boolean") setTattoosCoverable(saved.tattoosCoverable);
          if ([1, 2, 3, 4, 5, 6].includes(Number(saved.step))) setEditorStep(Number(saved.step) as ProfileEditorStep);
  }, []);

  const tDraft = useTranslations("FormDraft");
  const profileDraft = useFormDraft({
    formKey: "profile:edit", value: buildEditorDraft(), ready: !profileLoading && draftLoaded,
    busy: avatarUploading || coverUploading || profileUploading || uploadingPoster || saving,
    restore: restoreEditorDraft,
  });
  async function persistEditorDraft() { await profileDraft.flush(); }

  useEffect(() => {
    if (profileLoading) return;
    let cancelled = false;
    setDraftLoading(true);
    setDraftLoadError("");
    fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
        return result;
      })
      .then(({ draft }) => {
        if (cancelled) return;
        const saved = draft?.profileEditorDraft;
        const shouldResume = saved && typeof saved === "object" && shouldResumeProfileEditorDraft({
          profileExists,
          draftUpdatedAt: String(draft?.profileEditorDraftUpdatedAt ?? saved?.savedAt ?? ""),
          profileUpdatedAt,
        });
        if (shouldResume) {
          restoreEditorDraft(saved);

        }
        setDraftLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = uiErrorMessage(error, uiText("Ui.text_0504c98fd2caa9"));
        setDraftLoadError(message);
        setDraftLoaded(false);
      })
      .finally(() => { if (!cancelled) setDraftLoading(false); });
    return () => { cancelled = true; };
  }, [profileLoading, profileExists, profileUpdatedAt, restoreEditorDraft]); // profile is loaded once; the private editor draft is then applied over it

  function focusEditorField(field: "activity" | "name" | "city") {
    window.setTimeout(() => {
      const target = field === "activity" ? activityPickerRef.current : field === "name" ? nameInputRef.current : document.getElementById("profile-city");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
    }, 80);
  }

  function goToEditorStep(step: ProfileEditorStep, focus?: "activity" | "name" | "city") {
    if (step > 0) { draftPausedRef.current = false; profileDraft.resume(); }
    setEditorStep(step);
    markEditorChanged();
    if (focus) focusEditorField(focus);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateEditorStep(step: ProfileEditorStep) {
    const errors: ProfileSaveFieldErrors = {};
    if (step === 2 && !positions.length && !currentProfileTypes.length) errors.activity = uiText("Ui.text_f25450253ed66e");
    if (step === 3) {
      if (!form.name.trim()) errors.name = uiText("Ui.text_f08a575aecfb55");
      if (!form.city.trim()) errors.city = uiText("Ui.text_a4789c8ce64209");
    }
    setFieldErrors((current) => ({ ...current, ...errors }));
    if (Object.keys(errors).length) {
      const destination = profileEditorStepForErrors(Object.keys(errors) as ("activity" | "name" | "city")[]);
      setEditorStep(destination);
      focusEditorField(errors.activity ? "activity" : errors.name ? "name" : "city");
      return false;
    }
    return true;
  }

  async function saveFocalPoint(point: FocalPoint) {
    setFocalPoint(current => ({ ...current, card: point.card }));
    setFocalPickerImage(null);
    markEditorChanged();
    addToast(photoCropText("savedDraft"), "success");
  }

  return (
    <>
    <Suspense fallback={null}><ProfileTabFromUrl onChange={setActiveTab} /></Suspense>
    {focalPickerImage && (
      <FocalPointPicker
        imageUrl={focalPickerImage}
        initial={focalPoint}
        onSave={saveFocalPoint}
        onClose={() => setFocalPickerImage(null)}
      />
    )}
    <div className="pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mb-3"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              {t("backToDashboard")}
            </Link>
            <h1 className="font-display text-2xl font-bold text-text-primary">{t("pageTitle")}</h1>
            <p className="text-sm text-text-muted mt-1">{t("pageSubtitle")}</p>
          </div>
          {user?.id && (
            <Link
              href={`/profile/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:border-gold hover:text-gold transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              {t("viewProfile")}
            </Link>
          )}
        </div>

        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Sidebar — vertical on desktop, horizontal scroll on mobile */}
          <aside className="lg:w-56 shrink-0">
            {/* Mobile: one compact, fully visible selector instead of a clipped tab row */}
            <label className="mb-4 block lg:hidden">
              <span className="sr-only">{uiText("Ui.text_0aef2c1fabf0a6")}</span>
              <select value={activeTab} onChange={(event) => selectProfileTab(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary focus:border-gold focus:outline-none">
                {TAB_IDS.map(({ id, labelKey }) => <option key={id} value={id}>{t(labelKey as Parameters<typeof t>[0])}</option>)}
              </select>
            </label>
            {/* Desktop: vertical nav */}
            <nav aria-label={uiText("Ui.text_4eafea0bf08b1e")} className="hidden lg:block space-y-1">
              <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">{uiText("Ui.text_e59812fd3c9fdc")}</p>
              {TAB_IDS.map(({ id, labelKey, icon: Icon }) => (
                <button key={id} onClick={() => selectProfileTab(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                    activeTab === id
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-transparent"
                  }`}>
                  <Icon size={15} /> {t(labelKey as Parameters<typeof t>[0])}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">

            {/* Loading skeleton */}
            {profileLoading && activeTab === "profile" && (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-gold" />
              </div>
            )}

            {/* ── PROFIL ── */}
            {activeTab === "profile" && !profileLoading && (
              <div className="space-y-6" onChangeCapture={markEditorChanged} onClickCapture={(event) => {
                if (!(event.target as HTMLElement).closest("[data-no-draft]")) markEditorChanged();
              }}>

                {profileLoadError && (
                  <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-text-primary">
                    <AlertCircle size={17} className="mt-0.5 shrink-0 text-error" />
                    <p>{uiText("Ui.text_e9e6828db6e13d")}</p>
                  </div>
                )}

                {profileExists && editorStep === 0 && !draftLoading && !draftLoadError && (
                  <section className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-text-primary">{uiText("Ui.text_f07c0fcf26dc03")}</h2>
                        <p className="mt-1 text-sm text-text-muted">{requiredMissing.length ? uiText("Ui.text_da5e0a84c0589e", { value1: String(requiredMissing.map((field) => field === "activity" ? uiText("AdminReview.fields.role") : field === "name" ? uiText("profile.fieldName") : uiText("setup.place")).join(", ")) }) : uiText("Ui.text_9f762458c9a321")}</p>
                      </div>
                      <span className="rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs text-text-secondary">{uiText.rich("Ui.text_1ca75155a0cc55", { value1: () => (completion.score) })}</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {[
                        { step: 1 as ProfileEditorStep, title: uiText("home.boardKind_offer"), summary: currentProfileTypes.map((type) => PROFILE_TYPE_LABELS[type as ProfileType] ?? type).join(", ") || uiText("Ui.text_d390a2e6c24904") },
                        { step: 2 as ProfileEditorStep, title: uiText("setup.occupations"), summary: positions.slice(0, 3).join(", ") || uiText("Ui.text_2799d3de20eb93") },
                        { step: 3 as ProfileEditorStep, title: uiText("Ui.text_69545035d1a655"), summary: [form.name, form.city, form.country].filter(Boolean).join(" · ") || uiText("Ui.text_07bf85dcf0efa5") },
                        { step: 4 as ProfileEditorStep, title: uiText("Ui.text_6ab49b7e8b018e"), summary: uiText("Ui.text_23365f0ff644c2", { value1: String(profileImages.length + (avatarUrl ? 1 : 0)), value2: String(form.bio.trim() ? uiText("Ui.text_55dbf55b89328c") : uiText("Ui.text_82301961452f5b")) }) },
                        { step: 5 as ProfileEditorStep, title: uiText("Ui.text_66fb159b3a4da4"), summary: uiText("Ui.text_da1228a8159999") },
                        { step: 6 as ProfileEditorStep, title: uiText("Ui.text_0a84ee5ec3f752"), summary: uiText("Ui.text_e22dc9b0f94b29") },
                      ].map((section) => (
                        <button key={section.step} type="button" data-no-draft onClick={() => goToEditorStep(section.step, section.step === 3 && !form.name.trim() ? "name" : undefined)}
                          className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-border bg-bg-primary px-4 py-3 text-left hover:border-gold/40">
                          <span className="min-w-0"><span className="block text-sm font-medium text-text-primary">{section.title}</span><span className="mt-1 block break-words text-xs text-text-muted">{section.summary}</span></span>
                          <Pencil size={15} className="shrink-0 text-text-muted" />
                        </button>
                      ))}
                    </div>
                    {completionMissing.length > 0 && (
                      <div className="mt-5 border-t border-border pt-4">
                        <p className="mb-2 text-xs font-semibold text-text-secondary">{uiText("Ui.text_53e8b01b497ab6")}</p>
                        <div className="flex flex-wrap gap-2">{completion.missing.slice(0, 5).map((key) => (
                          <button key={key} type="button" onClick={() => goToEditorStep(profileEditorStepForHint(key))}
                            className="min-h-10 rounded-full border border-border bg-bg-elevated px-3 py-2 text-xs text-text-muted hover:border-gold/40 hover:text-gold">+ {completionHints[key] ?? key}</button>
                        ))}</div>
                      </div>
                    )}
                  </section>
                )}

                {!profileExists && completion.score < 100 && editorStep > 0 && (
                  <div className="rounded-xl border border-border bg-bg-secondary p-4">
                    <div className="flex items-center justify-between text-sm">{uiText.rich("Ui.text_440a1966dad1a0", { part1: chunks => (<span className="font-semibold text-text-primary">{chunks}</span>), value3: () => (completion.score), part2: chunks => (<span className="tabular-nums text-text-muted">{chunks}</span>) })}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${completion.score}%` }} /></div>
                    <p className="mt-2 text-xs text-text-muted">{uiText("Ui.text_f37fa0f2f4027b")}</p>
                  </div>
                )}

                {draftLoadError && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-text-primary">
                    <span>{uiText.rich("Ui.text_8ba7377040e350", { value1: () => (draftLoadError) })}</span>
                    <button type="button" data-no-draft onClick={() => window.location.reload()} className="min-h-11 rounded-lg border border-border px-4 hover:border-gold">{uiText("Ui.text_55786148a69b44")}</button>
                  </div>
                )}

                {draftLoading && <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-muted">{uiText.rich("Ui.text_d4974da4dd0ab3", { part1: () => (<Loader2 size={15} className="animate-spin" />) })}</div>}

                {editorStep !== 6 && Object.keys(visibleFieldErrors).length > 1 && !draftLoading && !draftLoadError && (
                  <div role="alert" className="rounded-lg border border-error/30 bg-error/10 p-4">
                    <p className="mb-2 text-sm font-semibold text-error">{uiText("Ui.text_631c98f7bc044e")}</p>
                    <ul className="space-y-1 text-sm text-text-primary">{Object.entries(visibleFieldErrors).map(([field, message]) => (
                      <li key={field}><button type="button" className="min-h-8 text-left underline underline-offset-2" onClick={() => {
                        const target = field === "activity" ? 1 : 3;
                        goToEditorStep(target, field === "activity" ? "activity" : field === "name" ? "name" : "city");
                      }}>{message}</button></li>
                    ))}</ul>
                  </div>
                )}

                {editorStep > 0 && !draftLoading && !draftLoadError && (
                  <section className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-gold">{uiText.rich("Ui.text_97503dc1235f6c", { value1: () => (editorStep), value2: () => (PROFILE_EDITOR_STEPS.length) })}</p><h2 className="mt-1 font-display text-xl font-semibold text-text-primary">{PROFILE_EDITOR_STEPS[editorStep - 1].title}</h2><p className="mt-1 text-sm leading-6 text-text-muted">{PROFILE_EDITOR_STEPS[editorStep - 1].description}</p></div>
                      <FormDraftStatus draft={profileDraft} />
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(editorStep / PROFILE_EDITOR_STEPS.length) * 100}%` }} /></div>
                    <nav aria-label={uiText("Ui.text_95a93d113efe6a")} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PROFILE_EDITOR_STEPS.map((step) => <button key={step.id} type="button" aria-current={editorStep === step.id ? "step" : undefined} onClick={() => goToEditorStep(step.id)}
                        className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${editorStep === step.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-muted hover:border-border-light hover:text-text-primary"}`}><span className="mr-1 font-semibold">{step.id}.</span>{step.title}</button>)}
                    </nav>
                  </section>
                )}

                {editorStep === 1 && !draftLoading && !draftLoadError && (
                  <div ref={activityPickerRef} tabIndex={-1} className="scroll-mt-28 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6 outline-none focus-visible:ring-2 focus-visible:ring-gold">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{uiText.rich("Ui.text_fa2917535712c2", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</p>
                    <p className="mb-4 text-sm text-text-muted">{uiText("Ui.text_3796aa867f444c")}</p>
                    <TypeChipPicker mode="types" selectedTypes={currentProfileTypes} onTypesChange={(next) => {
                      setCurrentProfileTypes(next);
                      if (next.length > 0 || positions.length > 0) setFieldErrors((previous) => ({ ...previous, activity: undefined }));
                    }} positions={positions} onPositionsChange={setPositions} />
                    {fieldErrors.activity && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{fieldErrors.activity}</p>}
                  </div>
                )}
                {editorStep === 2 && !draftLoading && !draftLoadError && (
                  <div ref={activityPickerRef} tabIndex={-1} className="scroll-mt-28 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6 outline-none focus-visible:ring-2 focus-visible:ring-gold">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{uiText.rich("Ui.text_bb610c8cae7830", { part1: chunks => (<span className="text-text-muted">{chunks}</span>) })}</p>
                    <TypeChipPicker mode="roles" occupationSelections={occupationSelections} onOccupationsChange={setOccupationSelections} selectedTypes={currentProfileTypes} onTypesChange={setCurrentProfileTypes} positions={positions} onPositionsChange={(next) => {
                      setPositions(next);
                      setPrimaryOccupation(current => occupationReference(primaryOccupationForPositions(current, next)));
                      if (next.length > 0 || currentProfileTypes.length > 0) setFieldErrors((previous) => ({ ...previous, activity: undefined }));
                    }} />
                    <PrimaryOccupationPicker positions={positions} value={primaryOccupation} onChange={value => { setPrimaryOccupation(value); if (value) setOccupationSelections(current => selectedCrewOccupations(positions, [...current, value])); }} />
                    {fieldErrors.activity && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{fieldErrors.activity}</p>}
                  </div>
                )}

                {editorStep === 4 && !draftLoading && !draftLoadError && <div className="space-y-6">
                <ContentUsageNotice context="profile" visibility="configured" />
                <div className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                  <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="profile-bio" className="text-sm font-semibold text-text-primary">{t("fieldBio")}</label><span className="text-xs text-text-muted">{uiText("setup.copy38")}</span></div>
                  <textarea id="profile-bio" rows={4} value={form.bio ?? ""} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} maxLength={500} placeholder={uiText("Ui.text_c1a4c7a3ba9110")} className="w-full resize-y rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
                  <GenieWritingAssistant area="profile" value={form.bio ?? ""} onApply={(text) => setForm((current) => ({ ...current, bio: text }))} maxLength={500} contextKey={`profile:${user?.id ?? "pending"}:bio`} disabled={saving} />
                  <p className="mt-1 text-right text-xs text-text-muted">{(form.bio ?? "").length} / 500</p>
                </div>
                {/* Avatar */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">{t("sectionAvatar")} <span className="text-xs font-normal text-text-muted">({optionalMedia("optional")})</span></h2>
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarPreview} alt={uiText("profile.tabProfile")} className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gold/10 border-2 border-gold/20 flex items-center justify-center">
                          <span className="text-xl font-bold text-gold">
                            {displayAvatarName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <button onClick={() => fileRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute -bottom-1 -right-1 w-7 h-7 bg-gold rounded-full flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-60">
                        {avatarUploading
                          ? <Loader2 size={12} className="text-bg-primary animate-spin" />
                          : <Camera size={13} className="text-bg-primary" />}
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary mb-0.5">
                        {form.name || "—"}
                      </p>
                      <p className="text-xs text-text-muted mb-3">
                        {[positions[0] ?? PROFILE_TYPE_LABELS[primaryProfileType as ProfileType], form.city]
                          .filter(Boolean).join(" · ") || clerkEmail}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => fileRef.current?.click()}
                          disabled={avatarUploading}
                          className="px-3 py-1.5 text-xs border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors">
                          {avatarUploading ? uiText("Ui.text_59c8b25c60ab9c") : t("photoUpload")}
                        </button>
                        {avatarPreview && (
                          <button type="button" disabled={avatarUploading} onClick={() => setFocalPickerImage(avatarUrl || avatarPreview)} className="min-h-11 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:border-gold hover:text-gold disabled:opacity-50">
                            {photoCropText("edit")}
                          </button>
                        )}
                        {avatarPreview && (
                          <button onClick={removeAvatar} className="px-3 py-1.5 text-xs text-text-muted hover:text-crimson-light transition-colors">
                            {t("removePhoto")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept={PROFILE_MEDIA_ACCEPT} className="hidden" onChange={handleAvatarChange} />
                  <p className="mt-2 text-xs text-text-muted">{profileMediaLimitsText}</p>
                </div>

                {/* Profilfotos — direkt unter Avatar */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <input
                    id="profile-images-input"
                    ref={profileImagesRef}
                    type="file"
                    accept={PROFILE_MEDIA_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={handleProfileImagesUpload}
                    disabled={profileUploading}
                  />
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-semibold text-text-primary mb-0.5">{t("sectionPhotos")} <span className="text-xs font-normal text-text-muted">({optionalMedia("optional")})</span></h2>
                      <p className="text-xs text-text-muted">
                        {showTalentSections
                          ? t("sectionPhotosDescTalent")
                          : t("sectionPhotosDescDefault")}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{profileMediaLimitsText}</p>
                    </div>
                    <label
                      htmlFor="profile-images-input"
                      className={`shrink-0 flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors cursor-pointer ${profileUploading ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      {profileUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {profileUploading ? t("uploading") : t("uploadPhotos")}
                    </label>
                  </div>

                  {profileImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {profileImages.map((img, i) => (
                        <div key={img.url + i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-bg-elevated">
                          <ResilientPublicImage src={img.url} alt={uiText("Ui.text_31b5322f7aaa57", { value1: String(i + 1) })} className="absolute inset-0" imageClassName="h-full w-full object-cover object-top" />
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5 bg-gradient-to-b from-black/60 to-transparent">
                            <button
                              type="button"
                              title={uiText("profile.setMainPhoto")}
                              onClick={() => {
                                const next = profileImages.map((im, j) => ({ ...im, featured: j === i }));
                                updateProfileImages(next);
                              }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                                img.featured ? "bg-gold text-bg-primary" : "bg-black/50 text-white/70 hover:bg-gold hover:text-bg-primary"
                              }`}
                            >★</button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = profileImages.filter((_, j) => j !== i);
                                if (img.featured && next.length > 0 && !next.some((im) => im.featured)) next[0] = { ...next[0], featured: true };
                                updateProfileImages(next);
                              }}
                              className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white/70 hover:bg-red-600 hover:text-white transition-colors"
                            ><X size={11} /></button>
                          </div>
                          {img.featured && (
                            <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                              <span className="px-2 py-0.5 bg-gold text-bg-primary text-[9px] font-bold rounded-full">{t("mainPhoto")}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <label
                        htmlFor="profile-images-input"
                        className={`aspect-[3/4] rounded-xl border-2 border-dashed border-border hover:border-gold/60 hover:bg-gold/5 flex flex-col items-center justify-center gap-2 text-text-muted hover:text-gold transition-all cursor-pointer ${profileUploading ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        {profileUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{profileUploading ? t("uploading") : t("addPhoto")}</span>
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor="profile-images-input"
                      className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-gold/50 hover:bg-gold/5 transition-all cursor-pointer"
                    >
                      <Upload size={28} className="text-text-muted mb-3" />
                      <p className="text-sm font-medium text-text-secondary">{t("uploadPhotos")}</p>
                      <p className="text-xs text-text-muted mt-1">{uiText("Ui.text_ba50e1615dcc7e")}</p>
                    </label>
                  )}
                </div>

                {/* Cover Image — only for crew/creative/vendor; talent uses profile_images as hero */}
                {!showTalentSections && <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-text-primary mb-0.5">{t("sectionCover")} <span className="text-xs font-normal text-text-muted">({optionalMedia("optional")})</span></h2>
                    <p className="text-xs text-text-muted">{t("sectionCoverDesc")}</p>
                    <p className="mt-1 text-xs text-text-muted">{profileMediaLimitsText}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => coverRef.current?.click()}
                      disabled={coverUploading}
                      className="flex min-h-11 self-start items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 text-gold text-xs font-semibold rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-60"
                    >
                      {coverUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {coverUploading ? t("uploading") : t("uploadCover")}
                    </button>
                    <input ref={coverRef} type="file" accept={PROFILE_MEDIA_ACCEPT} className="hidden" onChange={handleCoverChange} />
                  </div>
                  {coverImagePreview ? (
                    <ProfileCoverEditor
                      src={coverImagePreview}
                      focalPoint={{ ...focalPoint, opacity: coverOpacity }}
                      onChange={next => {
                        setFocalPoint(next);
                        setCoverOpacity(profileCoverSettings(next).brightness);
                        markEditorChanged();
                      }}
                      onRemove={() => {
                        setCoverImagePreview("");
                        setCoverImageUrl("");
                        markEditorChanged();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => coverRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors aspect-[3/1] flex flex-col items-center justify-center gap-2"
                    >
                      <Camera size={24} className="text-text-muted" />
                      <p className="text-sm text-text-muted">{t("uploadCoverPlaceholder")}</p>
                      <p className="text-xs text-text-muted">{uiText("Ui.text_50631b89c1473b")}</p>
                    </button>
                  )}
                </div>}

                </div>}

                {editorStep === 3 && !draftLoading && !draftLoadError && <div className="space-y-6">
                {/* Basisinformationen */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">{t("sectionBasics")}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        {t("fieldName")} <span className="text-crimson-light">*</span>
                      </label>
                      <input ref={nameInputRef} id="profile-name" type="text" value={form.name}
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, name: e.target.value }));
                          if (e.target.value.trim()) setFieldErrors((previous) => ({ ...previous, name: undefined }));
                        }}
                        className={`w-full bg-bg-elevated border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors ${fieldErrors.name ? "border-error" : "border-border"}`} />
                      {fieldErrors.name && <p id="profile-name-error" role="alert" className="mt-1.5 text-sm text-error">{fieldErrors.name}</p>}
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        {t("fieldWebsite")}
                      </label>
                      <input type="url" value={form.website}
                        onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                        placeholder={uiText("setup.copy40")}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_5f95a53fd86ffa")}</label>
                      <input type="tel" value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+49 170 1234567"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      <p className="text-xs text-text-muted mt-1">{uiText("Ui.text_f81953350cf371")}</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("setup.copy35")}</label>
                      <input type="email" value={form.contactEmail}
                        onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                        placeholder={uiText("setup.copy36")}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      <p className="text-xs text-text-muted mt-1">{uiText("Ui.text_dc41a8ec6e6813")}</p>
                    </div>
                    <PlaceField id="profile-city" selectedCityId={form.selected_place_city_id} value={[form.city, form.country].filter(Boolean).join(", ")} onChange={(value,cityId) => { setForm(p => ({ ...p, city: value, country: "", selected_place_city_id: cityId ?? "" })); setFieldErrors(p => ({ ...p, city: undefined })); }} required />
                    {fieldErrors.city && <p id="profile-city-error" role="alert" className="text-sm text-error">{fieldErrors.city}</p>}
                    {/* Profil-URL / Slug */}
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        {t("fieldProfileUrl")}
                      </label>
                      <div className="flex items-center min-w-0 bg-bg-elevated border border-border rounded-lg overflow-hidden focus-within:border-gold transition-colors">
                        <span className="px-2.5 py-2.5 text-xs text-text-muted border-r border-border shrink-0 select-none">
                          /profile/
                        </span>
                        <input
                          type="text"
                          value={form.slug}
                          onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                          placeholder={uiText("Ui.text_273edb53b4aad3")}
                          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-text-muted mt-1">{t("fieldProfileUrlHint")}</p>
                    </div>
                    {/* E-Mail (read-only, from Clerk) */}
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        {t("fieldEmail")}
                      </label>
                      <input type="email" value={clerkEmail} readOnly
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-muted cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5 flex items-center gap-1.5">
                        <Euro size={11} /> {t("fieldDayRate")}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={dayRate}
                        onChange={(e) => setDayRate(e.target.value)}
                        placeholder="450"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                      />
                      <p className="text-xs text-text-muted mt-1">{t("fieldDayRateHint")}</p>
                    </div>
                  </div>

                  {/* Verfügbarkeit */}
                  <div className="mt-5 pt-5 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{t("fieldAvailable")}</p>
                        <p className="text-xs text-text-muted">{t("fieldAvailableDesc")}</p>
                      </div>
                      <button onClick={() => setForm((p) => ({ ...p, available: !p.available }))}
                        className={`w-11 h-6 rounded-full relative transition-colors ${form.available ? "bg-success" : "bg-bg-elevated border border-border"}`}>
                        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                          style={{ left: form.available ? "calc(100% - 22px)" : "2px" }} />
                      </button>
                    </div>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{t("fieldAvailableFrom")}</label>
                        <input
                          type="date"
                          value={form.availableFrom ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, availableFrom: e.target.value }))}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                        <p className="text-xs text-text-muted mt-1">{t("fieldAvailableFromHint")}</p>
                      </div>
                      <div className="flex items-center justify-between pt-6">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setForm((p) => ({ ...p, travelReady: !p.travelReady }))}
                            className={`w-11 h-6 rounded-full relative transition-colors ${form.travelReady ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                              style={{ left: form.travelReady ? "calc(100% - 22px)" : "2px" }} />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                              <Plane size={13} className="text-text-muted" /> {t("fieldTravelReady")}
                            </p>
                            <p className="text-xs text-text-muted">{t("fieldTravelReadyDesc")}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extra availability options */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                      {([
                        { key: "weekends",    label: uiText("Ui.text_fe3dd00105d06a"),  desc: uiText("Ui.text_bb74d69dd3e83d") },
                        { key: "nightShoots", label: uiText("Ui.text_94c1be269db94c"),   desc: uiText("Ui.text_54ac5f547bc5d8") },
                        { key: "shortNotice", label: uiText("Ui.text_da452aeb15b5c6"),  desc: uiText("Ui.text_749f157358ad0e") },
                      ] as const).map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, [key]: !p[key] }))}
                          className={`flex items-center justify-between gap-2 p-3 rounded-lg border text-left transition-colors ${form[key] ? "border-gold/40 bg-gold/5" : "border-border bg-bg-hover"}`}
                        >
                          <div>
                            <p className="text-xs font-semibold text-text-primary">{label}</p>
                            <p className="text-[10px] text-text-muted">{desc}</p>
                          </div>
                          <div className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${form[key] ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                            style={{ minWidth: "2rem", height: "1.125rem" }}>
                            <span className="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all"
                              style={{ left: form[key] ? "calc(100% - 16px)" : "1px" }} />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-2">
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{uiText("Ui.text_b1305da321fd5b")}</label>
                      <div className="flex items-center gap-2">{uiText.rich("Ui.text_f5fac00746ee36", { part1: () => (<input
                          type="number"
                          min="0"
                          max="5000"
                          value={form.workRadius}
                          onChange={(e) => setForm((p) => ({ ...p, workRadius: e.target.value }))}
                          placeholder="100"
                          className="w-28 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
                        />), part2: chunks => (<span className="text-xs text-text-muted">{chunks}</span>) })}</div>
                    </div>
                  </div>
                </div>

                </div>}

                {editorStep === 5 && !draftLoading && !draftLoadError && <div className="space-y-6">
                {/* ── Crew / Creative sections ─────────────────────────── */}
                {showCrewSections && <>

                {/* Filmografie — verknüpfte Projekte */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                    <Clapperboard size={15} className="text-gold" /> {t("sectionFilmography")}
                  </h2>
                  <p className="text-xs text-text-muted mb-5">
                    {t("sectionFilmographyDesc")}
                  </p>

                  {/* Manuelle Filmografie-Einträge (mit Link-Feld) */}
                  {filmography.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1.5">{t("manualEntries")}</p>
                      <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated">
                        {filmography.map((film, idx) => (
                          <div key={idx} className="border-b border-border last:border-b-0">
                            <div className="flex items-center gap-3 px-3 py-1.5">
                              <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{film.year || "—"}</span>
                              <span className="text-xs text-text-primary truncate flex-1">{film.title}</span>
                              {film.role && <span className="text-[10px] text-text-secondary shrink-0 truncate max-w-[30%]">{film.role}</span>}
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                <div className="flex items-center gap-1 bg-bg-primary border border-border rounded px-1.5 focus-within:border-gold transition-colors">
                                  <ExternalLink size={9} className="text-text-muted shrink-0" />
                                  <input
                                    type="url"
                                    value={film.imdb_url ?? ""}
                                    onChange={(e) => setFilmography((p) => p.map((f, i) => i === idx ? { ...f, imdb_url: e.target.value } : f))}
                                    placeholder={uiText("Ui.text_5c25e21e1ab74e")}
                                    className="w-20 bg-transparent border-none py-1 text-[10px] focus:outline-none"
                                  />
                                </div>
                                <button type="button"
                                  onClick={() => setFilmography((p) => p.filter((_, i) => i !== idx))}
                                  className="text-text-muted hover:text-crimson-light transition-colors">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing credits */}
                  {projectCredits.length > 0 && (
                    <div className="mb-5">
                      <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated">
                        {projectCredits.map((credit) => {
                          const [baseRole, collaborator] = credit.role?.split("||") ?? ["", ""];
                          const isEditing = editingCreditId === credit.id;
                          return (
                            <div key={credit.id} className="border-b border-border last:border-b-0">
                              <div className="group flex items-center gap-3 px-3 py-1.5 hover:bg-bg-secondary transition-colors">
                                <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{credit.projects?.year ?? "—"}</span>
                                <span className="text-xs text-text-primary truncate flex-1">{credit.projects?.title}</span>
                                {collaborator && <span className="text-[10px] text-text-muted shrink-0 truncate max-w-[25%]">{collaborator}</span>}
                                {normType(credit.projects?.type) && <span className="text-[10px] text-text-muted shrink-0">{normType(credit.projects?.type)}</span>}
                                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => { setEditingCreditId(isEditing ? null : credit.id); setEditingCollaborator(collaborator ?? ""); }} className="text-text-muted hover:text-gold transition-colors">
                                    <Pencil size={11} />
                                  </button>
                                  <a href={`/projects/${credit.project_id}`} className="text-[10px] text-text-muted hover:text-gold transition-colors" target="_blank" rel="noopener noreferrer">→</a>
                                  <button type="button" onClick={() => leaveProject(credit.project_id)} className="text-text-muted hover:text-crimson-light transition-colors">
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                              {isEditing && (
                                <div className="px-3 py-2 bg-bg-secondary border-t border-border">
                                  <label className="block text-[10px] text-text-muted mb-1">{uiText.rich("Ui.text_262283e7cfc096", { value1: () => (baseRole) })}</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      maxLength={160}
                                      value={editingCollaborator}
                                      onChange={(e) => setEditingCollaborator(e.target.value)}
                                      placeholder={roleCollaboratorHint(baseRole)}
                                      className="flex-1 min-w-0 bg-transparent text-xs py-1.5 focus:outline-none placeholder:text-text-muted/50"
                                      autoFocus
                                      onKeyDown={(e) => { if (e.key === "Enter") saveCollaborator(credit.id); if (e.key === "Escape") setEditingCreditId(null); }}
                                    />
                                  <button type="button" onClick={() => saveCollaborator(credit.id)} disabled={savingCollaborator} className="text-gold hover:text-gold-light transition-colors shrink-0">
                                    {savingCollaborator ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  </button>
                                  <button type="button" onClick={() => setEditingCreditId(null)} className="text-text-muted hover:text-text-primary transition-colors shrink-0">
                                    <X size={12} />
                                  </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search existing project */}
                  {!showNewProject && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
                        {searchingProjects
                          ? <Loader2 size={14} className="text-text-muted shrink-0 animate-spin" />
                          : <Film size={14} className="text-text-muted shrink-0" />}
                        <input
                          type="text"
                          value={projectSearch}
                          onChange={(e) => {
                            setProjectSearch(e.target.value);
                            searchProjects(e.target.value);
                          }}
                          placeholder={t("searchProjectPlaceholder")}
                          className="flex-1 bg-transparent border-none py-2.5 text-sm focus:outline-none"
                        />
                        {projectSearch && (
                          <button type="button" onClick={() => { setProjectSearch(""); setProjectResults([]); }}
                            className="text-text-muted hover:text-crimson-light transition-colors">
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Search results */}
                      {projectResults.length > 0 && (
                        <div className="border border-border rounded-lg overflow-hidden">
                          {projectResults.map((proj) => (
                            <div key={proj.id} className="border-b border-border last:border-b-0">
                              <div className="flex items-center justify-between p-3">
                                <div>
                                  <span className="text-sm font-medium text-text-primary">{proj.title}</span>
                                  <span className="text-xs text-text-muted ml-2">{proj.year ?? ""} {proj.type ? uiText("Ui.text_d610afc356daf3", { value1: String(proj.type) }) : ""}</span>
                                </div>
                                {joiningProjectId === proj.id ? (
                                  <div className="flex items-center gap-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1.2fr)_auto_auto] gap-2 sm:items-center sm:min-w-[38rem]">
                                      <RoleDropdown value={joinRole} onChange={setJoinRole} options={[...new Set([...positions, ...ALL_CREW_ROLES])]} />
                                      <input
                                        type="text"
                                        maxLength={160}
                                        value={joinCollaborator}
                                        onChange={(event) => setJoinCollaborator(event.target.value)}
                                        placeholder={roleCollaboratorHint(joinRole)}
                                        aria-label={uiText("Ui.text_000f4df5417c74")}
                                        className="w-full min-w-0 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
                                      />
                                    <button
                                      type="button"
                                      onClick={() => joinProject(proj.id)}
                                      disabled={joiningRole || !joinRole.trim()}
                                      className="p-1.5 bg-gold text-bg-primary rounded hover:bg-gold-light transition-colors disabled:opacity-60"
                                    >
                                      {joiningRole ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                    </button>
                                    <button type="button" onClick={() => { setJoiningProjectId(null); setJoinRole(""); setJoinCollaborator(""); }}
                                      className="p-1.5 text-text-muted hover:text-crimson-light transition-colors">
                                      <X size={11} />
                                    </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => { setJoiningProjectId(proj.id); setJoinRole(""); setJoinCollaborator(""); }}
                                    className="text-xs text-gold hover:text-gold-light font-medium transition-colors"
                                  >
                                    {t("addToProject")}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowNewProject(true)}
                        className="w-full py-2.5 border-2 border-dashed border-border hover:border-gold/40 text-text-muted hover:text-gold text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus size={13} /> {t("createNewProject")}
                      </button>
                    </div>
                  )}

                  {/* Create new project form */}
                  {showNewProject && (
                    <div className="p-4 bg-bg-elevated border border-gold/20 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gold uppercase tracking-widest">{t("newProjectTitle")}</p>
                        <button type="button" onClick={() => setShowNewProject(false)} className="text-text-muted hover:text-crimson-light"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelTitle")} *</label>
                          <input type="text" value={newProject.title}
                            onChange={(e) => setNewProject((p) => ({ ...p, title: e.target.value }))}
                            placeholder={uiText("Ui.text_22f5865c0b8fdc")}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelYear")}</label>
                          <input type="number" value={newProject.year}
                            onChange={(e) => setNewProject((p) => ({ ...p, year: e.target.value }))}
                            placeholder="2024"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelType")}</label>
                          <select value={newProject.type}
                            onChange={(e) => setNewProject((p) => ({ ...p, type: e.target.value }))}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold">
                            <option value="">—</option>
                            {["Spielfilm","Kurzfilm","Serie","Dokumentation","Werbefilm","Musikvideo","Corporate"].map((typeOpt) => (
                              <option key={typeOpt} value={typeOpt}>{(uiOptionLabels[typeOpt] ?? typeOpt)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelDirector")}</label>
                          <input type="text" value={newProject.director}
                            onChange={(e) => setNewProject((p) => ({ ...p, director: e.target.value }))}
                            placeholder={uiText("Ui.text_4544b81c5f6331")}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelMyRole")} *</label>
                          <RoleDropdown value={newProject.myRole} onChange={(v) => setNewProject((p) => ({ ...p, myRole: v }))} options={[...new Set([...positions, ...ALL_CREW_ROLES])]} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("Ui.text_3bc29bbee5eaf0")}</label>
                          <input type="text" maxLength={160} value={newProject.collaborator}
                            onChange={(e) => setNewProject((p) => ({ ...p, collaborator: e.target.value }))}
                            placeholder={roleCollaboratorHint(newProject.myRole)}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                          <p className="mt-1 text-[10px] text-text-muted">{uiText("Ui.text_7fd972cee84a2b")}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelDescription")}</label>
                          <textarea rows={2} value={newProject.description}
                            onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                            placeholder={t("newProjectPlaceholderDesc")}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelPoster")}</label>
                          {newProject.poster_url ? (
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={newProject.poster_url} alt={uiText("profile.labelPoster")} className="h-20 w-14 object-cover rounded-md border border-border" />
                              <button type="button" onClick={() => setNewProject((p) => ({ ...p, poster_url: "" }))}
                                className="text-xs text-text-muted hover:text-crimson-light">{t("removePhoto")}</button>
                            </div>
                          ) : (
                            <label className={`flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-dashed border-border rounded-lg cursor-pointer hover:border-gold transition-colors text-sm text-text-muted ${uploadingPoster ? "opacity-60 pointer-events-none" : ""}`}>
                              {uploadingPoster ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                              {uploadingPoster ? t("uploading") : t("labelPoster")}
                              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingPoster(true);
                                try {
                                  const fd = new FormData();
                                  fd.append("file", file);
                                  const res = await fetch("/api/upload", { method: "POST", body: fd });
                                  const data = await res.json();
                                  if (res.ok) setNewProject((p) => ({ ...p, poster_url: data.url }));
                                  else addToast(data.error ?? uiText("profile.uploadFailed"), "error");
                                } finally {
                                  setUploadingPoster(false);
                                }
                              }} />
                            </label>
                          )}
                        </div>

                        {/* Extended metadata */}
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelGenre")}</label>
                          <input type="text" value={newProject.genre}
                            onChange={(e) => setNewProject((p) => ({ ...p, genre: e.target.value }))}
                            placeholder={uiText("Ui.text_6ef462fdd831c2")}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelProductionCompany")}</label>
                          <input type="text" value={newProject.productionCompany}
                            onChange={(e) => setNewProject((p) => ({ ...p, productionCompany: e.target.value }))}
                            placeholder={uiText("Ui.text_eb4280048fc05a")}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelLocation")}</label>
                          <PlaceField value={newProject.location} onChange={(value,cityId) => setNewProject(p => ({...p,location:value,selected_place_city_id:cityId??""}))} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelLink")}</label>
                          <input type="url" value={newProject.link}
                            onChange={(e) => setNewProject((p) => ({ ...p, link: e.target.value }))}
                            placeholder={uiText("setup.copy40")}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div className="col-span-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <div
                              onClick={() => setNewProject((p) => ({ ...p, alsoOnCrewUnited: !p.alsoOnCrewUnited }))}
                              className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${newProject.alsoOnCrewUnited ? "bg-gold" : "bg-bg-primary border border-border"}`}
                            >
                              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                                style={{ left: newProject.alsoOnCrewUnited ? "calc(100% - 18px)" : "2px" }} />
                            </div>
                            <span className="text-xs text-text-secondary">{t("alsoOnCrewUnited")}</span>
                          </label>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={createProject}
                        disabled={creatingProject || !newProject.title.trim()}
                        className="w-full py-2.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {creatingProject ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        {t("createAndAdd")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">{t("sectionSocial")}</h2>
                  <p className="text-xs text-text-muted mb-5">{t("sectionSocialDesc")}</p>
                  <div className="space-y-3">
                    {[
                      { label: uiText("Ui.text_bad57ef7837c8e"), icon: AtSign,      value: instagramUrl, set: setInstagramUrl, placeholder: "https://instagram.com/deinname" },
                      { label: uiText("Ui.text_1bb6fcfbf1368a"),    icon: PlayCircle,  value: tiktokUrl,    set: setTiktokUrl,    placeholder: "https://tiktok.com/@deinname" },
                      { label: uiText("Ui.text_fb7accfff8c6f8"),   icon: Video,       value: youtubeUrl,   set: setYoutubeUrl,   placeholder: "https://youtube.com/@deinname" },
                      { label: uiText("Ui.text_a7a93fd1930a61"),     icon: PlayCircle,  value: vimeoUrl,     set: setVimeoUrl,     placeholder: "https://vimeo.com/deinprofil" },
                      { label: uiText("Ui.text_dd84425b72da12"),  icon: Globe,       value: linkedinUrl,  set: setLinkedinUrl,  placeholder: "https://linkedin.com/in/deinname" },
                    ].map(({ label, icon: Icon, value, set, placeholder }) => (
                      <div key={label}>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5 flex items-center gap-1.5">
                          <Icon size={11} /> {label}
                        </label>
                        <input
                          type="url"
                          value={value ?? ""}
                          onChange={(e) => set(e.target.value)}
                          placeholder={placeholder}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Externe Profile */}
                <ExternalProfilesSection />

                {/* Videos & Showreel */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">{t("sectionVideos")}</h2>
                  <p className="text-xs text-text-muted mb-5">{t("sectionVideosDesc")}</p>
                  {videoLinks.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {videoLinks.map((url, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 bg-bg-elevated border border-border rounded-lg">
                          <Video size={13} className="text-text-muted shrink-0" />
                          <span className="flex-1 text-xs text-text-secondary truncate">{url}</span>
                          <button
                            type="button"
                            onClick={() => setVideoLinks((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-text-muted hover:text-crimson-light transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
                      <Link2 size={13} className="text-text-muted shrink-0" />
                      <input
                        type="url"
                        value={newVideoLink}
                        onChange={(e) => setNewVideoLink(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newVideoLink.trim()) {
                            setVideoLinks((p) => [...p, newVideoLink.trim()]);
                            setNewVideoLink("");
                          }
                        }}
                        placeholder={t("videoLinkPlaceholder")}
                        className="flex-1 bg-transparent border-none py-2.5 text-sm focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newVideoLink.trim()) {
                          setVideoLinks((p) => [...p, newVideoLink.trim()]);
                          setNewVideoLink("");
                        }
                      }}
                      className="px-3 py-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold/20 transition-colors"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Fähigkeiten */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">{t("sectionSkills")}</h2>
                  {skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {skills.map((s) => (
                        <span key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-subtle border border-gold/20 rounded-full text-xs text-gold">
                          {s}
                          <button onClick={() => setSkills((p) => p.filter((x) => x !== s))}
                            className="hover:text-crimson-light transition-colors"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted mb-4">{t("noSkills")}</p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder={t("addSkillPlaceholder")} value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSkill()}
                      className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors" />
                    <button onClick={addSkill}
                      className="px-3 py-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold/20 transition-colors">
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Mitgliedschaften */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">{uiText("Ui.text_f96bf692d5a4c5")}</h2>
                  <p className="text-xs text-text-muted mb-4">{uiText("Ui.text_0d11b982d31df6")}</p>
                  {memberships.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {memberships.map((m) => (
                        <span key={m} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-subtle border border-gold/20 rounded-full text-xs text-gold">
                          {m}
                          <button onClick={() => setMemberships((p) => p.filter((x) => x !== m))}
                            className="hover:text-crimson-light transition-colors"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted mb-4">{uiText("Ui.text_f45b3fb55311b3")}</p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder={uiText("Ui.text_5904ca4654180f")} value={newMembership}
                      onChange={(e) => setNewMembership(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addMembership()}
                      className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors" />
                    <button onClick={addMembership}
                      className="px-3 py-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold/20 transition-colors">
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Sprachen */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">{t("sectionLanguages")}</h2>
                  {languages.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {languages.map((l) => (
                        <span key={l} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-subtle border border-gold/20 rounded-full text-xs text-gold">
                          {l}
                          <button onClick={() => setLanguages((p) => p.filter((x) => x !== l))}
                            className="hover:text-crimson-light transition-colors"><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted mb-4">{t("noLanguages")}</p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder={t("addLanguagePlaceholder")} value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addLanguage()}
                      className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors" />
                    <button onClick={addLanguage}
                      className="px-3 py-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold/20 transition-colors">
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Lizenzen & Führerscheine */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">{t("sectionLicenses")}</h2>
                  <p className="text-xs text-text-muted mb-4">{t("sectionLicensesDesc")}</p>
                  <LicensePicker
                    selected={crewCertificates}
                    onChange={setCrewCertificates}
                  />
                </div>

                </> /* end crew-only */}

                {/* ── CASTING-DATEN ── */}
                {showTalentSections && (() => {
                  // Use stable IDs for storage, display translated labels
                  const HAIR = Object.keys(PROFILE_TRAIT_MESSAGE_KEYS.hair).map(id => ({ id, label: profileTraitLabel("hair", id, t) }));
                  const EYES = Object.keys(PROFILE_TRAIT_MESSAGE_KEYS.eyes).map(id => ({ id, label: profileTraitLabel("eyes", id, t) }));
                  const BODIES = Object.keys(PROFILE_TRAIT_MESSAGE_KEYS.body).map(id => ({ id, label: profileTraitLabel("body", id, t) }));
                  return (
                    <div className="p-6 bg-bg-secondary border border-border rounded-xl space-y-6">
                      <h2 className="font-semibold text-text-primary">{t("sectionCasting")}</h2>

                      {/* Spielalter */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{t("castingAge")}</label>
                        <div className="flex items-center gap-3">
                          <input type="number" min="1" max="99" value={playingAgeMin}
                            onChange={e => setPlayingAgeMin(e.target.value)}
                            placeholder={t("ageFrom")}
                            className="w-24 bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                          <span className="text-text-muted text-sm">–</span>
                          <input type="number" min="1" max="99" value={playingAgeMax}
                            onChange={e => setPlayingAgeMax(e.target.value)}
                            placeholder={t("ageTo")}
                            className="w-24 bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                          <span className="text-text-muted text-sm">{t("castingAgeUnit")}</span>
                        </div>
                      </div>

                      {/* Größe */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{t("castingHeight")}</label>
                        <input type="number" min="100" max="220" value={heightCm}
                          onChange={e => setHeightCm(e.target.value)}
                          placeholder="170"
                          className="w-32 bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block">{uiText.rich("Ui.text_d81e9f83d777b9", { part1: chunks => (<span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{chunks}</span>), part2: () => (<input type="text" value={clothingSize} onChange={(event) => setClothingSize(event.target.value)}
                            placeholder="38 / M" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />) })}</label>
                        <label className="block">{uiText.rich("Ui.text_d3df48ad2edf62", { part1: chunks => (<span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{chunks}</span>), part2: () => (<input type="number" min="20" max="60" value={shoeSize} onChange={(event) => setShoeSize(event.target.value)}
                            placeholder="39" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />) })}</label>
                      </div>

                      {/* Haarfarbe */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{t("castingHair")}</label>
                        <div className="flex flex-wrap gap-2">
                          {HAIR.map(c => (
                            <button key={c.id} type="button" onClick={() => setHairColor(c.id === hairColor ? "" : c.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                hairColor === c.id ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"
                              }`}>{c.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Augenfarbe */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{t("castingEyes")}</label>
                        <div className="flex flex-wrap gap-2">
                          {EYES.map(c => (
                            <button key={c.id} type="button" onClick={() => setEyeColor(c.id === eyeColor ? "" : c.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                eyeColor === c.id ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"
                              }`}>{c.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Körperbau */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{t("castingBody")}</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {BODIES.map(b => (
                            <button key={b.id} type="button" onClick={() => setBodyType(b.id === bodyType ? "" : b.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                bodyType === b.id ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"
                              }`}>{b.label}</button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block">{uiText.rich("Ui.text_407f9c15cfb350", { part1: chunks => (<span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{chunks}</span>), part2: () => (<input type="text" value={dialectsText} onChange={(event) => setDialectsText(event.target.value)}
                            placeholder={uiText("Ui.text_f61fedfba8d46e")} className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />) })}</label>
                        <label className="block">{uiText.rich("Ui.text_29d8da98554ac3", { part1: chunks => (<span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{chunks}</span>), part2: () => (<input type="text" value={drivingLicensesText} onChange={(event) => setDrivingLicensesText(event.target.value)}
                            placeholder={uiText("Ui.text_e165d69b5c6477")} className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />) })}</label>
                      </div>

                      {/* Toggles */}
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div onClick={() => setBeard(v => !v)}
                            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${beard ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${beard ? "left-5" : "left-0.5"}`} />
                          </div>
                          <span className="text-sm text-text-secondary">{t("castingBeard")}</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div onClick={() => setTattoos(v => !v)}
                            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${tattoos ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tattoos ? "left-5" : "left-0.5"}`} />
                          </div>
                          <span className="text-sm text-text-secondary">{t("castingTattoos")}</span>
                        </label>
                        {tattoos && (
                          <label className="flex items-center gap-3 cursor-pointer ml-13">
                            <div onClick={() => setTattoosCoverable(v => !v)}
                              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${tattoosCoverable ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tattoosCoverable ? "left-5" : "left-0.5"}`} />
                            </div>
                            <span className="text-sm text-text-muted">{t("castingTattoosHide")}</span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {!showCrewSections && !showTalentSections && <p className="rounded-xl border border-border bg-bg-secondary p-4 text-sm leading-6 text-text-muted">{uiText("Ui.text_dd891e313e3663")}</p>}
                </div>}

                {editorStep === 6 && !draftLoading && !draftLoadError && (
                  <section className="space-y-4 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                    <div><h2 className="font-semibold text-text-primary">{uiText("Ui.text_ee338d4efbad49")}</h2><p className="mt-1 text-sm text-text-muted">{uiText("Ui.text_c5e8ec1a211bb7")}</p></div>
                    {Object.keys(visibleFieldErrors).length > 0 && <div role="alert" className="rounded-lg border border-error/30 bg-error/10 p-4">
                      <p className="mb-2 text-sm font-semibold text-error">{uiText("Ui.text_3fe31495a2c318")}</p>
                      <ul className="space-y-1 text-sm text-text-primary">{Object.entries(visibleFieldErrors).map(([field, message]) => <li key={field}><button type="button" className="underline underline-offset-2" onClick={() => {
                        const target = field === "activity" ? 1 : 3;
                        goToEditorStep(target, field === "activity" ? "activity" : field === "name" ? "name" : "city");
                      }}>{message}</button></li>)}</ul>
                    </div>}
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">{uiText("Ui.text_62049891f11b03")}</dt><dd className="mt-1 break-words text-sm text-text-primary">{[...currentProfileTypes.map((type) => PROFILE_TYPE_LABELS[type as ProfileType] ?? type), ...positions].join(", ") || uiText("Ui.text_d58bd3ad5bd550")}</dd></div>
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">{uiText("Ui.text_43c189da96f3d6")}</dt><dd className="mt-1 break-words text-sm text-text-primary">{form.name || uiText("Ui.text_5e250f0283f955")}</dd></div>
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">{uiText("Ui.text_1508a39cda673a")}</dt><dd className="mt-1 break-words text-sm text-text-primary">{[form.city, form.country].filter(Boolean).join(", ") || uiText("Ui.text_5e250f0283f955")}</dd></div>
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">{uiText("Ui.text_2f2d903e3b8533")}</dt><dd className="mt-1 break-words text-sm text-text-primary">{uiText.rich("Ui.text_95319f0d1b1bb3", { value1: () => (profileImages.length), value2: () => (form.bio.trim() ? uiText("Ui.text_35efcfbeba4dd5") : "") })}</dd></div>
                    </dl>
                    <p className="text-xs leading-5 text-text-muted">{uiText("Ui.text_0da35a644cef0d")}</p>
                  </section>
                )}

                {editorStep > 0 && !draftLoading && !draftLoadError && (
                  <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {profileExists && <button type="button" data-no-draft onClick={() => goToEditorStep(0)} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:border-gold/40">{uiText("nav.accountOverview")}</button>}
                      <button type="button" data-no-draft disabled={profileDraft.status === "saving" || !profileDraft.loaded} onClick={() => void persistEditorDraft().catch(() => {})} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:border-gold/40 disabled:opacity-50">{tDraft("manualSave")}</button>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {editorStep > 1 && <button type="button" data-no-draft onClick={() => goToEditorStep((editorStep - 1) as ProfileEditorStep)} className="min-h-11 rounded-lg border border-border px-5 text-sm text-text-secondary hover:border-gold/40">{uiText("setup.copy99")}</button>}
                      {editorStep < 6 ? <>
                        {(editorStep === 4 || editorStep === 5) && <button type="button" data-no-draft onClick={() => goToEditorStep((editorStep + 1) as ProfileEditorStep)} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-muted hover:text-text-primary">{uiText("Ui.text_8e463fdd540e0b")}</button>}
                        <button type="button" data-no-draft onClick={() => { if (validateEditorStep(editorStep)) goToEditorStep((editorStep + 1) as ProfileEditorStep); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-bg-primary hover:bg-gold-light">{uiText.rich("Ui.text_9b3df3ffb77b5d", { part1: chunks => (<span>{chunks}</span>), part2: chunks => (<span aria-hidden="true">{chunks}</span>) })}</button>
                      </> : <button type="button" data-no-draft onClick={handleSave} disabled={!profileDraft.loaded || saving || profileLoading || profileLoadError || !draftLoaded || avatarUploading || coverUploading || profileUploading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-bg-primary hover:bg-gold-light disabled:opacity-60">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? uiText("setup.copy103") : profileExists ? uiText("profile.saveChanges") : uiText("setup.publishProfile")}
                      </button>}
                    </div>
                  </footer>
                )}
              </div>
            )}

            {/* ── PROJEKTE ── */}
            {activeTab === "projekte" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">{t("sectionMyProjects")}</h2>
                  <Link href="/dashboard/projects/new"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">
                    <Plus size={12} /> {t("addProjectBtn")}
                  </Link>
                </div>
                {myProjectsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
                ) : myProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl text-center">
                    <Clapperboard size={32} className="text-text-muted mb-3" />
                    <p className="text-text-muted text-sm mb-4">{t("noProjects")}</p>
                    <Link href="/dashboard/projects/new"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
                      <Plus size={14} /> {t("addFirstProject")}
                    </Link>
                  </div>
                ) : (() => {
                  const grouped = myProjects.reduce<Record<string, MyProject[]>>((acc, p) => {
                    const key = p.type ?? t("typeOther");
                    (acc[key] = acc[key] ?? []).push(p);
                    return acc;
                  }, {});
                  return (
                    <div className="space-y-3">
                      {Object.entries(grouped).map(([type, items]) => (
                        <div key={type}>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-lime mb-1.5">{type}</p>
                          <div className="border border-border rounded-lg overflow-hidden bg-bg-secondary">
                            {[...items].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).map((p) => (
                              <Link key={p.id} href={`/projects/${p.id}`}
                                className="group flex items-center gap-3 px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors">
                                <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{p.year ?? "—"}</span>
                                <span className="text-xs text-text-primary truncate flex-1 group-hover:text-gold transition-colors">{p.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── INSERATE ── */}
            {activeTab === "inserate" && (() => {
              const TYPE_META: Record<string, { label: string; href: string; color: string }> = {
                job:      { label: t("listingTypeJobs"),      href: "/jobs",      color: "text-gold" },
                prop:     { label: t("listingTypeMarket"),    href: "/props",     color: "text-violet-400" },
                location: { label: t("listingTypeLocations"), href: "/locations", color: "text-emerald-400" },
                vehicle:  { label: t("listingTypeVehicles"),  href: "/vehicles",  color: "text-sky-400" },
                creator:  { label: t("listingTypeCreator"),   href: "/creators",  color: "text-rose-400" },
              };
              const grouped = myListings.reduce<Record<string, MyListing[]>>((acc, l) => {
                (acc[l.type] = acc[l.type] ?? []).push(l);
                return acc;
              }, {});

              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-text-primary">{t("sectionMyListings")}</h2>
                    <Link href="/inserat"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">
                      <Plus size={12} /> {t("addListingBtn")}
                    </Link>
                  </div>

                  {myListingsLoading ? (
                    <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
                  ) : myListings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl text-center">
                      <Film size={32} className="text-text-muted mb-3" />
                      <p className="text-text-muted text-sm mb-4">{t("noListings")}</p>
                      <Link href="/inserat"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
                        <Plus size={14} /> {t("addFirstListing")}
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(grouped).map(([type, items]) => {
                        const meta = TYPE_META[type] ?? { label: type, href: "/inserat", color: "text-text-muted" };
                        return (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className={`text-[9px] font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</p>
                              <span className="text-[10px] text-text-muted">{items.length}</span>
                            </div>
                            <div className="border border-border rounded-lg overflow-hidden bg-bg-secondary">
                              {items.map((l) => (
                                <div key={l.id} className="flex items-center gap-3 px-3 py-1.5 border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors">
                                  <span className="text-xs text-text-primary truncate flex-1">{l.title}</span>
                                  {l.category && <span className="text-[10px] text-text-primary shrink-0 hidden sm:inline">{l.category}</span>}
                                  {l.city && <span className="text-[10px] text-text-primary shrink-0">{l.city}</span>}
                                  {l.price != null && l.price > 0 && (
                                    <span className="text-[10px] text-gold font-semibold shrink-0">{l.price.toLocaleString(uiLocale)} €</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NETZWERK ── */}
            {activeTab === "netzwerk" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-semibold text-text-primary">{t("sectionNetwork")}</h2>
                  <p className="text-xs text-text-muted mt-1">
                    {t("networkDesc")}
                  </p>
                </div>

                {friendsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
                ) : friendsError ? (
                  <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{uiText.rich("Ui.text_e2c98ea562f5fe", { value1: () => (friendsError) })}</p>
                ) : friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl text-center">
                    <Users2 size={32} className="text-text-muted mb-3" />
                    <p className="text-text-muted text-sm mb-2">{t("noConnections")}</p>
                    <p className="text-xs text-text-muted">{t("noConnectionsDesc")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {friends.map((fr) => {
                      const edit = collabEdits[fr.friendship_id] ?? { label: "", is_public: false, saving: false };
                      return (
                        <div key={fr.friendship_id} className="p-4 bg-bg-secondary border border-border rounded-xl">
                          <div className="flex items-center gap-3 mb-3">
                            {fr.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={fr.avatar_url} alt={fr.display_name} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                                <Users2 size={16} className="text-text-muted" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-text-primary truncate">{fr.display_name}</p>
                              <p className="text-xs text-text-muted truncate">{fr.role}</p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={edit.label}
                              onChange={(e) => setCollabEdits((prev) => ({ ...prev, [fr.friendship_id]: { ...edit, label: e.target.value } }))}
                              placeholder={t("collabRolePlaceholder")}
                              className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder:text-text-muted"
                            />
                            <button
                              type="button"
                              onClick={() => setCollabEdits((prev) => ({ ...prev, [fr.friendship_id]: { ...edit, is_public: !edit.is_public } }))}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors shrink-0 ${
                                edit.is_public
                                  ? "bg-gold/10 border-gold/30 text-gold"
                                  : "bg-bg-elevated border-border text-text-muted hover:border-gold/30 hover:text-gold"
                              }`}
                            >
                              {edit.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                              {edit.is_public ? t("collabVisible") : t("collabHidden")}
                            </button>
                            <button
                              type="button"
                              disabled={edit.saving}
                              onClick={async () => {
                                setCollabEdits((prev) => ({ ...prev, [fr.friendship_id]: { ...edit, saving: true } }));
                                try {
                                  const response = await fetch(`/api/friendships/${fr.friendship_id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "collab", label: edit.label || null, is_public: edit.is_public }),
                                  });
                                  const result = await response.json().catch(() => ({}));
                                  if (!response.ok || result.error) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
                                  addToast(t("collabSaved"), "success");
                                } catch (err) {
                                  addToast(uiText("Ui.text_efae3eb968ceb3", { value1: String(t("savingError")), value2: String(uiErrorMessage(err, uiText("profile.unknownError"))) }), "error");
                                } finally {
                                  setCollabEdits((prev) => ({ ...prev, [fr.friendship_id]: { ...edit, saving: false } }));
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60 shrink-0"
                            >
                              {edit.saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                              {t("save")}
                            </button>
                          </div>
                          {edit.is_public && (
                            <p className="text-[10px] text-text-muted mt-2">
                              {t("collabPreview")} <span className="text-gold">{fr.display_name}</span> · {edit.label.trim() || uiText("Ui.text_feff0dfb77ca7d")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── VERIFIZIERUNG ── */}
            {activeTab === "verification" && <VerificationTab />}

            {/* ── SICHERHEIT ── */}
            {activeTab === "security" && (
              <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                <h2 className="font-semibold text-text-primary mb-2">{uiText("Ui.text_963cfc38ed1ec7")}</h2>
                <p className="text-sm text-text-muted leading-relaxed">{uiText("Ui.text_5ff108d7be9af1")}</p>
              </div>
            )}

            {/* ── BENACHRICHTIGUNGEN ── */}
            {activeTab === "notifications" && (
              <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl space-y-4">
                <div>
                  <h2 className="font-semibold text-text-primary mb-1">{uiText("Ui.text_bf85ba7a2da053")}</h2>
                  <p className="text-sm text-text-muted">{uiText("Ui.text_dcc686a995d142")}</p>
                </div>
                {notificationError && <p role="alert" className="text-sm text-red-300">{notificationError}</p>}
                <button
                  type="button"
                  role="switch"
                  aria-checked={messageEmailsEnabled}
                  aria-label={uiText("Ui.text_bf85ba7a2da053")}
                  onClick={updateMessageEmails}
                  disabled={notificationLoading}
                  className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${messageEmailsEnabled ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${messageEmailsEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <p className="text-xs text-text-muted">{uiText("Ui.text_c4b78c69ae463f")}</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
    </>
  );
}
