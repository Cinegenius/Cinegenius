"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { compressImage, compressAvatar, MAX_FUNCTION_UPLOAD_BYTES, safeObjectURL } from "@/lib/compressImage";
import {
  Camera, CheckCircle, User, Lock, Bell, CreditCard, Film,
  Plus, X, Save, Wallet, Upload, ShieldCheck, Clock, AlertCircle, Loader2,
  Globe, Plane, Video, Euro, Clapperboard, Link2, AtSign, PlayCircle, ExternalLink,
  Users2, Eye, EyeOff, Pencil, Check, Search, ChevronDown,
} from "lucide-react";
import LicensePicker from "@/components/LicensePicker";
import ExternalProfilesSection from "@/components/ExternalProfilesSection";
import { useToast } from "@/contexts/ToastContext";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";
import PrimaryOccupationPicker from "@/components/PrimaryOccupationPicker";
import { primaryOccupationForPositions, occupationReference, orderPositionsByPrimary, type PrimaryOccupation } from "@/lib/primary-occupation";
import ProfileCoverEditor from "@/components/ProfileCoverEditor";
import { profileCoverSettings } from "@/lib/profile-cover";
import { departments, deptColors, DEPARTMENT_TO_PROFILE_TYPE, getDepartmentRoleSearchTerms } from "@/lib/departments";
import { gripSearchTerms, GRIP_OCCUPATIONS, normalizeOccupation } from "@/lib/gripTaxonomy";
import RoleDropdown from "@/components/RoleDropdown";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { prepareProfileMediaFile, sendProfileMediaFile, PROFILE_MEDIA_ACCEPT, PROFILE_MEDIA_MAX_BYTES, PROFILE_MEDIA_SOURCE_MAX_BYTES } from "@/lib/profile-media-client";
import { publishProfileUpdated } from "@/lib/profile-update-events";
import { isAvatarUploadAssociated } from "@/lib/profile-avatar-persistence";
import { validateProfileSave, type ProfileSaveFieldErrors } from "@/lib/profile-save-validation";
import { PROFILE_EDITOR_STEPS, profileEditorRequiredMissing, profileEditorStepForErrors, profileEditorStepForHint, shouldResumeProfileEditorDraft, type ProfileEditorStep } from "@/lib/profile-editor-flow";

const ALL_CREW_ROLES = departments.flatMap((d) => d.roles);

const PROJECT_TYPE_NORMALIZE: Record<string, string> = {
  "Werbefilm / Commercial": "Werbefilm",
  "Corporate Film": "Corporate",
  "Event / Live": "Event",
  "Foto / Shooting": "Shooting",
};
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
}: {
  mode: "types" | "roles";
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  positions: string[];
  onPositionsChange: (p: string[]) => void;
}) {
  const [roleSearch, setRoleSearch] = useState("");
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});
  const [chosenDepartments, setChosenDepartments] = useState<string[]>([]);

  function togglePosition(job: string, deptId: string) {
    const isSel = positions.includes(job);
    const next = isSel ? positions.filter((x) => x !== job) : [...positions, job];
    onPositionsChange(next);
    setChosenDepartments((current) => current.includes(deptId) ? current : [...current, deptId]);
    const mapped = DEPARTMENT_TO_PROFILE_TYPE[deptId];
    if (!mapped) return;
    if (!isSel) {
      if (!selectedTypes.includes(mapped)) onTypesChange([...selectedTypes, mapped]);
    } else {
      const stillRepresented = departments.some((department) =>
        department.roles.some((role) => next.includes(role) && DEPARTMENT_TO_PROFILE_TYPE[department.id] === mapped),
      );
      if (!stillRepresented) onTypesChange(selectedTypes.filter((type) => type !== mapped));
    }
  }

  function toggleType(type: string) {
    onTypesChange(selectedTypes.includes(type)
      ? selectedTypes.filter((selected) => selected !== type)
      : [...selectedTypes, type]);
  }

  const normalizedQuery = roleSearch.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de");
  const selectedRoleDepartments = departments.filter((dept) => dept.roles.some((role) => positions.includes(role))).map((dept) => dept.id);
  const activeDepartmentIds = new Set([...chosenDepartments, ...selectedRoleDepartments]);
  const visibleDepartments = departments
    .map((dept) => ({
      dept,
      roles: dept.roles.filter((role) =>
        !normalizedQuery || getDepartmentRoleSearchTerms(dept, role).some((term) => normalizeOccupation(term).includes(normalizeOccupation(normalizedQuery)))
        || (dept.id === "grip" && gripSearchTerms(role).some((term) => normalizeOccupation(term).includes(normalizeOccupation(normalizedQuery)))),
      ),
    }))
    .filter(({ dept, roles }) => normalizedQuery ? roles.length > 0 : activeDepartmentIds.has(dept.id));

  if (mode === "types") {
    return (
      <div className="space-y-6">
        <div>
          <p className="mb-2.5 text-xs font-semibold text-text-primary">Talent und Anbieter</p>
          <p className="mb-3 text-xs leading-5 text-text-muted">Wähle alle passenden Bereiche. Filmcrew-Berufe suchst du im nächsten Schritt.</p>
          <div className="flex flex-wrap gap-2">
            {[...TALENT_CHIPS, ...ANBIETER_CHIPS].map(([id, label]) => {
              const active = selectedTypes.includes(id);
              return (
                <button key={id} type="button" aria-pressed={active} onClick={() => toggleType(id)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-gold/15 border-gold/50 text-gold" : "border-border text-text-muted hover:border-border-light hover:text-text-secondary"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {(selectedTypes.some((type) => !TALENT_TYPE_IDS.has(type) && !ANBIETER_TYPE_IDS.has(type)) || positions.length > 0) && (
          <p className="rounded-lg border border-border bg-bg-primary/50 p-3 text-sm text-text-secondary">
            Für deine Crew-Tätigkeiten sind {positions.length} {positions.length === 1 ? "Rolle" : "Rollen"} ausgewählt. Du kannst sie im nächsten Schritt ändern.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {positions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-primary">Ausgewählte Tätigkeiten</p>
          <div className="flex flex-wrap gap-2">
            {positions.map((position) => (
              <span key={position} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 text-sm text-gold">
                {position}
                <button type="button" onClick={() => {
                  const dept = departments.find((item) => item.roles.includes(position));
                  if (dept) togglePosition(position, dept.id);
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-500/10" aria-label={`${position} entfernen`}><X size={14} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="search" value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)}
          placeholder="Beruf oder Spezialisierung suchen …" aria-label="Beruf oder Spezialisierung suchen"
          className="w-full rounded-xl border border-border bg-bg-primary py-3 pl-10 pr-4 text-base text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Gewerk auswählen</span>
        <select value="" onChange={(event) => {
          const id = event.target.value;
          if (id) {
            setChosenDepartments((current) => current.includes(id) ? current : [...current, id]);
            setExpandedDepartments((current) => ({ ...current, [id]: true }));
            setRoleSearch("");
          }
        }} className="min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary focus:border-gold focus:outline-none">
          <option value="">Gewerk suchen oder auswählen …</option>
          {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.emoji} {dept.label}</option>)}
        </select>
      </label>
      <div className="space-y-3">
        {visibleDepartments.map(({ dept, roles }) => {
          const colors = deptColors(dept.color);
          const selectedCount = dept.roles.filter((role) => positions.includes(role)).length;
          const expanded = normalizedQuery ? expandedDepartments[dept.id] !== false : Boolean(expandedDepartments[dept.id] || selectedCount > 0);
          return (
            <section key={dept.id} className="overflow-hidden rounded-xl border border-border bg-bg-primary/50">
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedDepartments((current) => ({ ...current, [dept.id]: !expanded }))}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-elevated/60">
                <span className="min-w-0"><span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>{dept.emoji} {dept.label}</span><span className="ml-2 text-xs text-text-muted">{roles.length} {roles.length === 1 ? "Tätigkeit" : "Tätigkeiten"}</span></span>
                <span className="flex shrink-0 items-center gap-2">{selectedCount > 0 && <span className={`rounded-full border px-2 py-1 text-[10px] ${colors.bg} ${colors.border} ${colors.text}`}>{selectedCount} ausgewählt</span>}<ChevronDown size={15} className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
              </button>
              {expanded && <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                {dept.id === "grip" && <p className="mb-1 w-full text-xs leading-5 text-text-muted">Kamerabühne / Grip umfasst Kameraunterstützung wie Dolly, Schienen und Kräne. Zuständigkeiten können sich je nach Land und Produktion unterscheiden.</p>}
                {roles.map((role) => {
                  const active = positions.includes(role);
                  const explanation = GRIP_OCCUPATIONS.find((occupation) => occupation.label === role)?.description;
                  return <button key={role} type="button" aria-pressed={active} title={explanation} onClick={() => togglePosition(role, dept.id)}
                    className={`min-h-10 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${active ? `${colors.bg} ${colors.border} ${colors.text}` : "border-border text-text-muted hover:border-border-light hover:text-text-secondary"}`}>{role}</button>;
                })}
              </div>}
            </section>
          );
        })}
        {visibleDepartments.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">{normalizedQuery ? "Kein Gewerk oder Beruf gefunden. Probiere einen anderen Suchbegriff." : "Wähle ein Gewerk aus oder suche nach einer Tätigkeit."}</p>}
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
  { id: "billing",        labelKey: "tabBilling",        icon: CreditCard  },
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
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary mb-2">{label}</p>
      <div
        onClick={() => !uploading && ref.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          file ? "border-success/40 bg-success/5" : "border-border hover:border-gold/40"
        }`}
      >
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        {uploading ? (
          <><Loader2 size={24} className="animate-spin text-gold mx-auto mb-2" /><p className="text-sm text-text-muted">Hochladen…</p></>
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
  const { addToast } = useToast();
  const tV = useTranslations("profile");
  const [status, setStatus] = useState<VerifStatus>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [idFile, setIdFile] = useState<{ name: string; url: string } | null>(null);
  const [idUploading, setIdUploading] = useState(false);

  useEffect(() => {
    fetch("/api/verification-requests")
      .then(r => r.json())
      .then(({ data }) => {
        if (!data || data.length === 0) { setStatus("none"); return; }
        const own = Array.isArray(data) ? data[0] : data;
        setStatus((own?.status as VerifStatus) ?? "none");
      })
      .catch(() => setStatus("none"));
  }, []);

  async function handleIdFile(file: File) {
    setIdUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error } = await res.json();
      if (!res.ok || !url) { addToast(error ?? tV("uploadFailed"), "error"); return; }
      setIdFile({ name: file.name, url });
    } finally {
      setIdUploading(false);
    }
  }

  async function handleSubmit() {
    if (!idFile) return;
    setSubmitting(true);
    try {
      const notes = JSON.stringify({ id_doc: idFile.url });
      const res = await fetch("/api/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error ?? "Fehler beim Einreichen", "error"); return; }
      setStatus("pending");
      addToast(tV("verifSubmit"), "success");
    } catch {
      addToast(tV("unknownError"), "error");
    } finally {
      setSubmitting(false);
    }
  }

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
        </div>
        <button
          onClick={() => setStatus("none")}
          className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors"
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
        disabled={submitting || !idFile}
        className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? <><Loader2 size={15} className="animate-spin" /> {tV("verifSubmitting")}</> : <><ShieldCheck size={15} /> {tV("verifSubmit")}</>}
      </button>
    </div>
  );
}

type FilmEntry = { year: number | string; title: string; role: string; type: string; director?: string; imdb_url?: string };

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { user, isLoaded } = useUser();
  const t = useTranslations("profile");
  const profileMediaLimitsText = t("uploadMediaLimits", {
    sourceMaxMb: PROFILE_MEDIA_SOURCE_MAX_BYTES / (1024 * 1024),
    compressedMaxMb: PROFILE_MEDIA_MAX_BYTES / (1024 * 1024),
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("profile");
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && TAB_IDS.some(({ id }) => id === requestedTab)) setActiveTab(requestedTab);
  }, []);
  const selectProfileTab = (tab: string) => {
    setActiveTab(tab);
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
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [editorRevision, setEditorRevision] = useState(0);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftPausedRef = useRef(false);
  const draftSequenceRef = useRef(0);
  const draftQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
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
  const [newProject, setNewProject] = useState({ title: "", year: "", type: "", description: "", director: "", myRole: "", collaborator: "", poster_url: "", genre: "", productionCompany: "", location: "", equipment: "", link: "", alsoOnCrewUnited: false });
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
          if (!response.ok || result.error) throw new Error(result.error ?? `HTTP ${response.status}`);
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
        .catch((error) => setFriendsError(error instanceof Error ? error.message : "Bitte lade die Seite neu."))
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
        if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
        return result;
      })
      .then(({ settings }) => {
        if (!cancelled && settings) setMessageEmailsEnabled(settings.email_new_message !== false);
      })
      .catch((err) => {
        if (!cancelled) setNotificationError(`Benachrichtigungen konnten nicht geladen werden: ${err instanceof Error ? err.message : "Bitte lade die Seite neu."}`);
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
      if (!response.ok || result.error) throw new Error(result.error ?? `HTTP ${response.status}`);
      addToast("Benachrichtigungseinstellung gespeichert.", "success");
    } catch (err) {
      setMessageEmailsEnabled(previous);
      setNotificationError(`Einstellung wurde nicht gespeichert: ${err instanceof Error ? err.message : "Bitte versuche es erneut."}`);
    } finally {
      setNotificationLoading(false);
    }
  };

  // ── Load profile from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(result.error ?? `HTTP ${r.status}`);
        return result;
      })
      .then(({ profile, exists, unavailableFields = [] }) => {
        if (unavailableFields.length > 0) {
          addToast(`Einige Profilfelder fehlen noch in der Datenbank: ${unavailableFields.join(", ")}. Bitte die Datenbank aktualisieren lassen.`, "error");
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
          setForm({
            name:          profile.display_name        ?? "",
            city:          (profile.location ?? "").split(",")[0]?.trim() ?? "",
            country:       (profile.location ?? "").split(",")[1]?.trim() ?? "",
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
          setPrimaryOccupation(occupationReference(primaryOccupationForPositions(profile.crew?.primaryOccupation, profile.positions ?? [])));
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
        addToast("Profil konnte nicht geladen werden. Änderungen sind deshalb gesperrt, damit nichts überschrieben wird.", "error");
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
      const prepared = await prepareProfileMediaFile(file, compressAvatar);
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
          throw new Error(result.error ?? `HTTP ${response.status}`);
        }
        url = result.url as string;
      } else {
        // A not-yet-created profile has no row to associate yet. Keep the
        // upload as a draft and persist its URL with the first profile save.
        url = await sendProfileMediaFile(prepared.file);
      }
      setAvatarUrl(url);
      setAvatarPreview(url);
      markEditorChanged();
      if (profileExists) {
        publishProfileUpdated({ userId: user?.id, displayName: form.name, avatarUrl: url, previousAvatarUrl });
        addToast("Profilfoto gespeichert und deinem Profil zugeordnet.", "success");
      } else {
        addToast("Foto bereit. Es wird mit deinem Profil gespeichert, sobald du die Profildaten sicherst.", "success");
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
            addToast("Profilfoto wurde gespeichert. Die Bestätigung der Upload-Antwort war unterbrochen.", "success");
            return;
          }
        } catch {
          // If both the upload response and confirmation are unavailable, retain
          // the previous photo and let the user retry without losing it.
        }
      }
      addToast(`Profilfoto konnte nicht gespeichert werden: ${err instanceof Error ? err.message : t("uploadFailed")}`, "error");
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
      const prepared = await prepareProfileMediaFile(file, (source) => compressImage(source, { maxWidth: 1920, maxHeight: 1080, quality: 0.85, maxBytes: MAX_FUNCTION_UPLOAD_BYTES }));
      if (!prepared.file) throw new Error(profileMediaErrorText(prepared.error, t));
      const url = await sendProfileMediaFile(prepared.file);
      setCoverImageUrl(url);
      setCoverImagePreview(url);
      markEditorChanged();
      addToast("Titelbild bereit. Speichere dein Profil, damit es öffentlich übernommen wird.", "success");
      // Cover cropping has its own controls; never change the portrait focus.
      setFocalPoint(current => ({ ...current, cover: { x: 50, y: 50 } }));
    } catch (err) {
      addToast(`Titelbild konnte nicht gespeichert werden: ${err instanceof Error ? err.message : t("uploadFailed")}`, "error");
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
    if (/personal assistant|talent assistant|persönliche assistenz/.test(value)) return "z. B. betreute Schauspieler*in: Tom Hardy";
    if (/driver|fahrer/.test(value)) return "z. B. gefahrene Person: Adam Driver";
    if (/gaffer|beleucht|licht/.test(value)) return "z. B. Kameramann/-frau: Name";
    if (/kamera|cinematograph/.test(value)) return "z. B. Regie: Name";
    if (/kostüm|costume/.test(value)) return "z. B. Kostümbildner*in: Name";
    if (/runner/.test(value)) return "z. B. Set-Aufnahmeleitung: Name";
    return "z. B. Funktion: Name der Person";
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
        body: JSON.stringify({ ...newProject, myRole: roleWithCollaborator(newProject.myRole, newProject.collaborator) }),
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error, "error"); return; }
      if (!d.draft?.id) throw new Error("Der private Entwurf konnte nicht bestätigt werden.");
      setShowNewProject(false);
      setNewProject({ title: "", year: "", type: "", description: "", director: "", myRole: "", collaborator: "", poster_url: "", genre: "", productionCompany: "", location: "", equipment: "", link: "", alsoOnCrewUnited: false });
      addToast("Privater Entwurf gespeichert", "success");
      router.push(`/dashboard/projects/drafts/${d.draft.id}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Entwurf konnte nicht gespeichert werden.", "error");
    } finally {
      setCreatingProject(false);
    }
  };

  // ── Save profile ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (avatarUploading || coverUploading || profileUploading) {
      addToast("Warte bitte, bis alle Fotos hochgeladen sind, bevor du das Profil speicherst.", "error");
      return;
    }
    if (profileLoadError) {
      addToast("Profil konnte nicht geladen werden. Lade die Seite neu, bevor du Änderungen speicherst.", "error");
      return;
    }
    if (!draftLoaded) {
      addToast("Der private Entwurf wird noch geladen. Bitte warte kurz, bevor du speicherst.", "error");
      return;
    }
    const validationErrors = validateProfileSave({
      name: form.name,
      city: form.city,
      positions,
      profileTypes: currentProfileTypes,
    });
    if (positions.length && !primaryOccupationForPositions(primaryOccupation, positions)) validationErrors.activity = "Bitte wähle deine Haupttätigkeit aus. Deine weiteren Tätigkeiten bleiben erhalten.";
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
        availability_config: {
          weekends:      form.weekends,
          night_shoots:  form.nightShoots,
          short_notice:  form.shortNotice,
          work_radius_km: form.workRadius ? parseInt(form.workRadius) : null,
        },
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
        crew: { ...crewDataRef.current, certificates: crewCertificates, primaryOccupation: occupationReference(primaryOccupationForPositions(primaryOccupation, positions)) },
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
        addToast(`Speichern fehlgeschlagen: ${msg}`, "error");
        return;
      }
      if (isNew) setProfileExists(true);
      setProfileUpdatedAt(new Date().toISOString());
      setEditorStep(0);
      setEditorRevision(0);
      const url = avatarUrl || null;
      publishProfileUpdated({ userId: user?.id, displayName: form.name, avatarUrl: url });
      const unavailableFields: string[] = baseResult.unavailableFields ?? [];
      try {
        await fetch("/api/onboarding?type=profile-edit", { method: "DELETE" });
      } catch {
        // The newer public profile timestamp prevents an older private draft from being resumed.
      }
      setDraftSaveState("idle");

      physicalDataRef.current = physical ?? {};
      performanceDataRef.current = performance ?? {};

      if (unavailableFields.length > 0) {
        addToast(`Profil gespeichert. Diese Angaben konnten wegen fehlender Datenbankfelder nicht gespeichert werden: ${unavailableFields.join(", ")}.`, "error");
      } else {
        addToast(t("profileSaved"), "success");
      }
    } catch (err) {
      draftPausedRef.current = false;
      addToast(`Fehler: ${err instanceof Error ? err.message : String(err)}`, "error");
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
        (source) => compressImage(source, { maxWidth: 1600, quality: 0.82, maxBytes: MAX_FUNCTION_UPLOAD_BYTES }),
      )));
      const firstFailure = preparedFiles.find((prepared) => !prepared.file);
      if (firstFailure && !firstFailure.file) throw new Error(profileMediaErrorText(firstFailure.error, t));

      const uploaded: ProfileImage[] = [];
      for (const prepared of preparedFiles) {
        if (!prepared.file) continue;
        const url = await sendProfileMediaFile(prepared.file);
        uploaded.push({ url, featured: false });
      }

      // Merge with existing, auto-feature first if none set
      const merged = [...profileImages, ...uploaded];
      if (!merged.some((i) => i.featured)) merged[0] = { ...merged[0], featured: true };
      updateProfileImages(merged);
      markEditorChanged();

      addToast(`${uploaded.length} Foto(s) bereit. Speichere dein Profil, damit sie öffentlich übernommen werden.`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isBrowserBug = !msg || /did not match|pattern/i.test(msg);
      addToast(isBrowserBug ? t("uploadFailed") : msg, "error");
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
    setDraftSaveState("pending");
    setEditorRevision((revision) => revision + 1);
  }

  const buildEditorDraft = () => ({
    savedAt: new Date().toISOString(),
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
    currentProfileTypes,
    physicalData: physicalDataRef.current,
    performanceData: performanceDataRef.current,
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

  async function persistEditorDraft() {
    const sequence = ++draftSequenceRef.current;
    setDraftSaveState("saving");
    const snapshot = buildEditorDraft();
    const task = draftQueueRef.current.catch(() => {}).then(async () => {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileEditorDraft: snapshot }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.saved) throw new Error(result.error ?? `HTTP ${response.status}`);
    });
    draftQueueRef.current = task;
    try {
      await task;
      if (sequence === draftSequenceRef.current) setDraftSaveState("saved");
    } catch (error) {
      if (sequence === draftSequenceRef.current) {
        setDraftSaveState("error");
        addToast(`Privater Entwurf konnte nicht gespeichert werden: ${error instanceof Error ? error.message : "Bitte versuche es erneut."}`, "error");
      }
      throw error;
    }
  }

  const persistEditorDraftRef = useRef(persistEditorDraft);
  persistEditorDraftRef.current = persistEditorDraft;

  useEffect(() => {
    if (profileLoading) return;
    let cancelled = false;
    setDraftLoading(true);
    setDraftLoadError("");
    fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
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
          if (saved.form && typeof saved.form === "object") setForm((current) => ({ ...current, ...(saved.form as Partial<typeof current>) }));
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
          if (Array.isArray(saved.currentProfileTypes)) setCurrentProfileTypes(saved.currentProfileTypes.filter((item: unknown): item is string => typeof item === "string"));
          if (saved.physicalData && typeof saved.physicalData === "object") physicalDataRef.current = saved.physicalData as Record<string, unknown>;
          if (saved.performanceData && typeof saved.performanceData === "object") performanceDataRef.current = saved.performanceData as Record<string, unknown>;
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
          setDraftSaveState("saved");
        }
        setDraftLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Bitte lade die Seite neu.";
        setDraftLoadError(message);
        setDraftLoaded(false);
      })
      .finally(() => { if (!cancelled) setDraftLoading(false); });
    return () => { cancelled = true; };
  }, [profileLoading, profileExists, profileUpdatedAt]); // profile is loaded once; the private editor draft is then applied over it

  useEffect(() => {
    if (!draftLoaded || draftPausedRef.current || editorRevision === 0) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => { void persistEditorDraftRef.current().catch(() => {}); }, 700);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [editorRevision, draftLoaded]);

  function focusEditorField(field: "activity" | "name" | "city") {
    window.setTimeout(() => {
      const target = field === "activity" ? activityPickerRef.current : field === "name" ? nameInputRef.current : cityInputRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
    }, 80);
  }

  function goToEditorStep(step: ProfileEditorStep, focus?: "activity" | "name" | "city") {
    if (step > 0) draftPausedRef.current = false;
    setEditorStep(step);
    markEditorChanged();
    if (focus) focusEditorField(focus);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateEditorStep(step: ProfileEditorStep) {
    const errors: ProfileSaveFieldErrors = {};
    if (step === 2 && !positions.length && !currentProfileTypes.length) errors.activity = "Bitte wähle mindestens eine Tätigkeit aus.";
    if (step === 3) {
      if (!form.name.trim()) errors.name = "Bitte gib deinen Namen ein.";
      if (!form.city.trim()) errors.city = "Bitte gib deinen Standort ein.";
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
    setFocalPoint(current => ({ ...current, x: point.x, y: point.y }));
    setFocalPickerImage(null);
    markEditorChanged();
    addToast("Bildposition im Entwurf übernommen. Speichere dein Profil, um sie zu veröffentlichen.", "success");
  }

  return (
    <>
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
              <span className="sr-only">Profilbereich auswählen</span>
              <select value={activeTab} onChange={(event) => selectProfileTab(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary focus:border-gold focus:outline-none">
                {TAB_IDS.map(({ id, labelKey }) => <option key={id} value={id}>{t(labelKey as Parameters<typeof t>[0])}</option>)}
              </select>
            </label>
            {/* Desktop: vertical nav */}
            <nav aria-label="Profil- und Kontobereiche" className="hidden lg:block space-y-1">
              <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">Profil &amp; Konto</p>
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
                    <p>Dein gespeichertes Profil konnte nicht geladen werden. Das Formular bleibt gesperrt, damit vorhandene Daten nicht überschrieben werden. Lade die Seite neu und versuche es erneut.</p>
                  </div>
                )}

                {profileExists && editorStep === 0 && !draftLoading && !draftLoadError && (
                  <section className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-text-primary">Profilübersicht</h2>
                        <p className="mt-1 text-sm text-text-muted">{requiredMissing.length ? `Pflichtangaben noch offen: ${requiredMissing.map((field) => field === "activity" ? "Tätigkeit" : field === "name" ? "Name" : "Standort").join(", ")}.` : "Pflichtangaben vollständig. Alles Weitere ist freiwillig."}</p>
                      </div>
                      <span className="rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs text-text-secondary">Profilvollständigkeit {completion.score}%</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {[
                        { step: 1 as ProfileEditorStep, title: "Angebot", summary: currentProfileTypes.map((type) => PROFILE_TYPE_LABELS[type as ProfileType] ?? type).join(", ") || "Noch keine Tätigkeit ausgewählt" },
                        { step: 2 as ProfileEditorStep, title: "Tätigkeiten", summary: positions.slice(0, 3).join(", ") || "Berufe und Spezialisierungen" },
                        { step: 3 as ProfileEditorStep, title: "Name und Standort", summary: [form.name, form.city, form.country].filter(Boolean).join(" · ") || "Pflichtangaben ergänzen" },
                        { step: 4 as ProfileEditorStep, title: "Fotos und Vorstellung", summary: `${profileImages.length + (avatarUrl ? 1 : 0)} Foto(s) · ${form.bio.trim() ? "Vorstellung vorhanden" : "Vorstellung optional"}` },
                        { step: 5 as ProfileEditorStep, title: "Weitere Angaben", summary: "Verfügbarkeit, Erfahrungen und passende Zusatzangaben" },
                        { step: 6 as ProfileEditorStep, title: "Prüfen und speichern", summary: "Öffentliche Änderungen erst nach deiner Bestätigung" },
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
                        <p className="mb-2 text-xs font-semibold text-text-secondary">Freiwillige Profilverbesserungen</p>
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
                    <div className="flex items-center justify-between text-sm"><span className="font-semibold text-text-primary">Profilfortschritt</span><span className="tabular-nums text-text-muted">{completion.score}%</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${completion.score}%` }} /></div>
                    <p className="mt-2 text-xs text-text-muted">Die Prozentzahl umfasst auch freiwillige Angaben. Für die Veröffentlichung brauchst du nur Tätigkeit, Name und Standort.</p>
                  </div>
                )}

                {draftLoadError && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-text-primary">
                    <span>Privater Entwurf konnte nicht geprüft werden: {draftLoadError}. Damit nichts überschrieben wird, lade den Editor bitte neu.</span>
                    <button type="button" data-no-draft onClick={() => window.location.reload()} className="min-h-11 rounded-lg border border-border px-4 hover:border-gold">Neu laden</button>
                  </div>
                )}

                {draftLoading && <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-muted"><Loader2 size={15} className="animate-spin" /> Privaten Entwurf prüfen …</div>}

                {editorStep !== 6 && Object.keys(visibleFieldErrors).length > 1 && !draftLoading && !draftLoadError && (
                  <div role="alert" className="rounded-lg border border-error/30 bg-error/10 p-4">
                    <p className="mb-2 text-sm font-semibold text-error">Bitte ergänze noch diese Pflichtangaben:</p>
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
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-gold">Schritt {editorStep} von {PROFILE_EDITOR_STEPS.length}</p><h2 className="mt-1 font-display text-xl font-semibold text-text-primary">{PROFILE_EDITOR_STEPS[editorStep - 1].title}</h2><p className="mt-1 text-sm leading-6 text-text-muted">{PROFILE_EDITOR_STEPS[editorStep - 1].description}</p></div>
                      <span className="shrink-0 text-xs text-text-muted" aria-live="polite">{draftSaveState === "saving" ? "Entwurf wird gespeichert …" : draftSaveState === "saved" ? "Entwurf gespeichert" : draftSaveState === "error" ? "Entwurf nicht gespeichert" : draftSaveState === "pending" ? "Änderungen noch nicht gespeichert" : "Privater Entwurf"}</span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(editorStep / PROFILE_EDITOR_STEPS.length) * 100}%` }} /></div>
                    <nav aria-label="Profilabschnitte" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PROFILE_EDITOR_STEPS.map((step) => <button key={step.id} type="button" aria-current={editorStep === step.id ? "step" : undefined} onClick={() => goToEditorStep(step.id)}
                        className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${editorStep === step.id ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-text-muted hover:border-border-light hover:text-text-primary"}`}><span className="mr-1 font-semibold">{step.id}.</span>{step.title}</button>)}
                    </nav>
                  </section>
                )}

                {editorStep === 1 && !draftLoading && !draftLoadError && (
                  <div ref={activityPickerRef} tabIndex={-1} className="scroll-mt-28 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6 outline-none focus-visible:ring-2 focus-visible:ring-gold">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Dein Angebot <span className="text-gold">· Pflichtangabe</span></p>
                    <p className="mb-4 text-sm text-text-muted">Wähle Talent- oder Anbieterbereiche. Crew-Berufe findest du im nächsten Schritt.</p>
                    <TypeChipPicker mode="types" selectedTypes={currentProfileTypes} onTypesChange={(next) => {
                      setCurrentProfileTypes(next);
                      if (next.length > 0 || positions.length > 0) setFieldErrors((previous) => ({ ...previous, activity: undefined }));
                    }} positions={positions} onPositionsChange={setPositions} />
                    {fieldErrors.activity && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{fieldErrors.activity}</p>}
                  </div>
                )}
                {editorStep === 2 && !draftLoading && !draftLoadError && (
                  <div ref={activityPickerRef} tabIndex={-1} className="scroll-mt-28 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6 outline-none focus-visible:ring-2 focus-visible:ring-gold">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Filmcrew und Kreativberufe <span className="text-text-muted">· Weitere Tätigkeiten optional</span></p>
                    <TypeChipPicker mode="roles" selectedTypes={currentProfileTypes} onTypesChange={setCurrentProfileTypes} positions={positions} onPositionsChange={(next) => {
                      setPositions(next);
                      if (next.length > 0 || currentProfileTypes.length > 0) setFieldErrors((previous) => ({ ...previous, activity: undefined }));
                    }} />
                    <PrimaryOccupationPicker positions={positions} value={primaryOccupation} onChange={setPrimaryOccupation} />
                    {fieldErrors.activity && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{fieldErrors.activity}</p>}
                  </div>
                )}

                {editorStep === 4 && !draftLoading && !draftLoadError && <div className="space-y-6">
                <div className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                  <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="profile-bio" className="text-sm font-semibold text-text-primary">{t("fieldBio")}</label><span className="text-xs text-text-muted">Optional</span></div>
                  <textarea id="profile-bio" rows={4} value={form.bio ?? ""} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} maxLength={500} placeholder="Ein paar Sätze zu dir und deiner Arbeit …" className="w-full resize-y rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm focus:border-gold focus:outline-none" />
                  <p className="mt-1 text-right text-xs text-text-muted">{(form.bio ?? "").length} / 500</p>
                </div>
                {/* Avatar */}
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">{t("sectionAvatar")}</h2>
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarPreview} alt="Profil" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
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
                      <div className="flex gap-2">
                        <button onClick={() => fileRef.current?.click()}
                          disabled={avatarUploading}
                          className="px-3 py-1.5 text-xs border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors">
                          {avatarUploading ? "Foto wird gespeichert …" : t("photoUpload")}
                        </button>
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
                      <h2 className="font-semibold text-text-primary mb-0.5">{t("sectionPhotos")}</h2>
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
                          <ResilientPublicImage src={img.url} alt={`Foto ${i + 1}`} className="absolute inset-0" imageClassName="h-full w-full object-cover object-top" />
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5 bg-gradient-to-b from-black/60 to-transparent">
                            <button
                              type="button"
                              title="Als Hauptfoto"
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
                      <p className="text-xs text-text-muted mt-1">JPG, PNG, WEBP · mehrere gleichzeitig möglich</p>
                    </label>
                  )}
                </div>

                {/* Cover Image — only for crew/creative/vendor; talent uses profile_images as hero */}
                {!showTalentSections && <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-text-primary mb-0.5">{t("sectionCover")}</h2>
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
                      <p className="text-xs text-text-muted">JPG, PNG, WEBP · ideal 1500×500 px</p>
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
                        placeholder="https://…"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Telefon / WhatsApp
                      </label>
                      <input type="tel" value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+49 170 1234567"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      <p className="text-xs text-text-muted mt-1">Nur für eingeloggte Nutzer sichtbar</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Kontakt-E-Mail
                      </label>
                      <input type="email" value={form.contactEmail}
                        onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                        placeholder="kontakt@beispiel.de"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      <p className="text-xs text-text-muted mt-1">Öffentliche Kontakt-E-Mail (optional, kann von deiner Login-E-Mail abweichen)</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        {t("fieldCity")} <span className="text-crimson-light">*</span>
                      </label>
                      <input ref={cityInputRef} id="profile-city" type="text" value={form.city}
                        aria-invalid={!!fieldErrors.city}
                        aria-describedby={fieldErrors.city ? "profile-city-error" : undefined}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, city: e.target.value }));
                          if (e.target.value.trim()) setFieldErrors((previous) => ({ ...previous, city: undefined }));
                        }}
                        placeholder={t("fieldCityPlaceholder")}
                        className={`w-full bg-bg-elevated border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors ${fieldErrors.city ? "border-error" : "border-border"}`} />
                      {fieldErrors.city && <p id="profile-city-error" role="alert" className="mt-1.5 text-sm text-error">{fieldErrors.city}</p>}
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        {t("fieldCountry")}
                      </label>
                      <input type="text" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                        placeholder={t("fieldCountryPlaceholder")}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
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
                          placeholder="dein-name"
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
                        placeholder="z.B. 450"
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
                        { key: "weekends",    label: "Wochenenden",  desc: "Auch samstags/sonntags" },
                        { key: "nightShoots", label: "Nachtdrehs",   desc: "Bereit für Nachtaufnahmen" },
                        { key: "shortNotice", label: "Kurzfristig",  desc: "Verfügbar auf Kurzanfrage" },
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
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Arbeitsradius</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="5000"
                          value={form.workRadius}
                          onChange={(e) => setForm((p) => ({ ...p, workRadius: e.target.value }))}
                          placeholder="z.B. 100"
                          className="w-28 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                        <span className="text-xs text-text-muted">km vom Standort (leer = überall)</span>
                      </div>
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
                                    placeholder="Link…"
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
                                  <label className="block text-[10px] text-text-muted mb-1">{baseRole} · Mit wem hast du dabei gearbeitet?</label>
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
                                  <span className="text-xs text-text-muted ml-2">{proj.year ?? ""} {proj.type ? `· ${proj.type}` : ""}</span>
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
                                        aria-label="Mit wem hast du in diesem Projekt gearbeitet?"
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
                            placeholder="Das letzte Licht"
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
                              <option key={typeOpt} value={typeOpt}>{typeOpt}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelDirector")}</label>
                          <input type="text" value={newProject.director}
                            onChange={(e) => setNewProject((p) => ({ ...p, director: e.target.value }))}
                            placeholder="Anna K."
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelMyRole")} *</label>
                          <RoleDropdown value={newProject.myRole} onChange={(v) => setNewProject((p) => ({ ...p, myRole: v }))} options={[...new Set([...positions, ...ALL_CREW_ROLES])]} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Mit wem hast du dabei gearbeitet?</label>
                          <input type="text" maxLength={160} value={newProject.collaborator}
                            onChange={(e) => setNewProject((p) => ({ ...p, collaborator: e.target.value }))}
                            placeholder={roleCollaboratorHint(newProject.myRole)}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                          <p className="mt-1 text-[10px] text-text-muted">Name und Funktion, zum Beispiel die Schauspielerin, die du betreut hast, oder die Regie, mit der du gearbeitet hast.</p>
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
                              <img src={newProject.poster_url} alt="Poster" className="h-20 w-14 object-cover rounded-md border border-border" />
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
                                  else addToast(data.error ?? "Upload fehlgeschlagen", "error");
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
                            placeholder="Drama, Thriller…"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelProductionCompany")}</label>
                          <input type="text" value={newProject.productionCompany}
                            onChange={(e) => setNewProject((p) => ({ ...p, productionCompany: e.target.value }))}
                            placeholder="XY Film GmbH"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelLocation")}</label>
                          <input type="text" value={newProject.location}
                            onChange={(e) => setNewProject((p) => ({ ...p, location: e.target.value }))}
                            placeholder="München, Bayern"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{t("labelLink")}</label>
                          <input type="url" value={newProject.link}
                            onChange={(e) => setNewProject((p) => ({ ...p, link: e.target.value }))}
                            placeholder="https://…"
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
                      { label: "Instagram", icon: AtSign,      value: instagramUrl, set: setInstagramUrl, placeholder: "https://instagram.com/deinname" },
                      { label: "TikTok",    icon: PlayCircle,  value: tiktokUrl,    set: setTiktokUrl,    placeholder: "https://tiktok.com/@deinname" },
                      { label: "YouTube",   icon: Video,       value: youtubeUrl,   set: setYoutubeUrl,   placeholder: "https://youtube.com/@deinname" },
                      { label: "Vimeo",     icon: PlayCircle,  value: vimeoUrl,     set: setVimeoUrl,     placeholder: "https://vimeo.com/deinprofil" },
                      { label: "LinkedIn",  icon: Globe,       value: linkedinUrl,  set: setLinkedinUrl,  placeholder: "https://linkedin.com/in/deinname" },
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
                  <h2 className="font-semibold text-text-primary mb-1">Mitgliedschaften</h2>
                  <p className="text-xs text-text-muted mb-4">Gewerkschaften, Verbände, Agenturen (z.B. Verdi, IGLBM)</p>
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
                    <p className="text-xs text-text-muted mb-4">Noch keine Mitgliedschaften eingetragen.</p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder="z.B. Verdi, IGLBM, Agentur XY" value={newMembership}
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
                  const HAIR: { id: string; label: string }[] = [
                    { id: "black",       label: t("hairBlack") },
                    { id: "dark_brown",  label: t("hairDarkBrown") },
                    { id: "brown",       label: t("hairBrown") },
                    { id: "light_brown", label: t("hairLightBrown") },
                    { id: "blonde",      label: t("hairBlonde") },
                    { id: "light_blonde",label: t("hairLightBlonde") },
                    { id: "red",         label: t("hairRed") },
                    { id: "grey",        label: t("hairGrey") },
                    { id: "white",       label: t("hairWhite") },
                    { id: "dyed",        label: t("hairDyed") },
                  ];
                  const EYES: { id: string; label: string }[] = [
                    { id: "brown",      label: t("eyesBrown") },
                    { id: "dark_brown", label: t("eyesDarkBrown") },
                    { id: "green",      label: t("eyesGreen") },
                    { id: "blue_green", label: t("eyesBlueGreen") },
                    { id: "blue",       label: t("eyesBlue") },
                    { id: "grey",       label: t("eyesGrey") },
                    { id: "hazel",      label: t("eyesHazel") },
                    { id: "black",      label: t("eyesBlack") },
                  ];
                  const BODIES = [
                    { id:"slim",     label: t("bodySlim") },
                    { id:"athletic", label: t("bodyAthletic") },
                    { id:"normal",   label: t("bodyNormal") },
                    { id:"strong",   label: t("bodyStrong") },
                    { id:"muscular", label: t("bodyMuscular") },
                    { id:"curvy",    label: t("bodyCurvy") },
                  ];
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
                        <label className="block">
                          <span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Konfektionsgröße</span>
                          <input type="text" value={clothingSize} onChange={(event) => setClothingSize(event.target.value)}
                            placeholder="z. B. 38 / M" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                        </label>
                        <label className="block">
                          <span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Schuhgröße</span>
                          <input type="number" min="20" max="60" value={shoeSize} onChange={(event) => setShoeSize(event.target.value)}
                            placeholder="z. B. 39" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                        </label>
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
                        <label className="block">
                          <span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Dialekte</span>
                          <input type="text" value={dialectsText} onChange={(event) => setDialectsText(event.target.value)}
                            placeholder="z. B. Bayrisch, Berlinerisch" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                        </label>
                        <label className="block">
                          <span className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Führerscheine</span>
                          <input type="text" value={drivingLicensesText} onChange={(event) => setDrivingLicensesText(event.target.value)}
                            placeholder="z. B. B, BE" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                        </label>
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
                {!showCrewSections && !showTalentSections && <p className="rounded-xl border border-border bg-bg-secondary p-4 text-sm leading-6 text-text-muted">Für die ausgewählten Anbieterbereiche gibt es hier keine zusätzlichen Profilfelder. Verfügbarkeit und Kontaktangaben kannst du bei Bedarf in Schritt 3 ergänzen.</p>}
                </div>}

                {editorStep === 6 && !draftLoading && !draftLoadError && (
                  <section className="space-y-4 rounded-xl border border-border bg-bg-secondary p-4 sm:p-6">
                    <div><h2 className="font-semibold text-text-primary">Profil prüfen</h2><p className="mt-1 text-sm text-text-muted">Nur diese Angaben werden nach deiner Bestätigung öffentlich angezeigt.</p></div>
                    {Object.keys(visibleFieldErrors).length > 0 && <div role="alert" className="rounded-lg border border-error/30 bg-error/10 p-4">
                      <p className="mb-2 text-sm font-semibold text-error">Bitte prüfe diese Pflichtangaben:</p>
                      <ul className="space-y-1 text-sm text-text-primary">{Object.entries(visibleFieldErrors).map(([field, message]) => <li key={field}><button type="button" className="underline underline-offset-2" onClick={() => {
                        const target = field === "activity" ? 1 : 3;
                        goToEditorStep(target, field === "activity" ? "activity" : field === "name" ? "name" : "city");
                      }}>{message}</button></li>)}</ul>
                    </div>}
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">Tätigkeiten · Pflicht</dt><dd className="mt-1 break-words text-sm text-text-primary">{[...currentProfileTypes.map((type) => PROFILE_TYPE_LABELS[type as ProfileType] ?? type), ...positions].join(", ") || "Noch auswählen"}</dd></div>
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">Name · Pflicht</dt><dd className="mt-1 break-words text-sm text-text-primary">{form.name || "Noch eingeben"}</dd></div>
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">Standort · Pflicht</dt><dd className="mt-1 break-words text-sm text-text-primary">{[form.city, form.country].filter(Boolean).join(", ") || "Noch eingeben"}</dd></div>
                      <div className="rounded-lg border border-border bg-bg-primary p-3"><dt className="text-xs text-text-muted">Fotos und Vorstellung · freiwillig</dt><dd className="mt-1 break-words text-sm text-text-primary">{profileImages.length} Portfoliofoto(s){form.bio.trim() ? " · Vorstellung vorhanden" : ""}</dd></div>
                    </dl>
                    <p className="text-xs leading-5 text-text-muted">Unvollständige freiwillige Angaben verhindern das Speichern nicht. Nicht ausgefüllte Bereiche werden nicht angezeigt.</p>
                  </section>
                )}

                {editorStep > 0 && !draftLoading && !draftLoadError && (
                  <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {profileExists && <button type="button" data-no-draft onClick={() => goToEditorStep(0)} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:border-gold/40">Übersicht</button>}
                      <button type="button" data-no-draft disabled={draftSaveState === "saving" || !draftLoaded} onClick={() => void persistEditorDraft().catch(() => {})} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:border-gold/40 disabled:opacity-50">{draftSaveState === "saving" ? "Speichert …" : "Privaten Entwurf speichern"}</button>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {editorStep > 1 && <button type="button" data-no-draft onClick={() => goToEditorStep((editorStep - 1) as ProfileEditorStep)} className="min-h-11 rounded-lg border border-border px-5 text-sm text-text-secondary hover:border-gold/40">Zurück</button>}
                      {editorStep < 6 ? <>
                        {(editorStep === 4 || editorStep === 5) && <button type="button" data-no-draft onClick={() => goToEditorStep((editorStep + 1) as ProfileEditorStep)} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-muted hover:text-text-primary">Überspringen</button>}
                        <button type="button" data-no-draft onClick={() => { if (validateEditorStep(editorStep)) goToEditorStep((editorStep + 1) as ProfileEditorStep); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-bg-primary hover:bg-gold-light"><span>Weiter</span><span aria-hidden="true">→</span></button>
                      </> : <button type="button" data-no-draft onClick={handleSave} disabled={saving || profileLoading || profileLoadError || !draftLoaded || avatarUploading || coverUploading || profileUploading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold px-5 text-sm font-semibold text-bg-primary hover:bg-gold-light disabled:opacity-60">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? "Wird gespeichert …" : profileExists ? "Änderungen speichern" : "Profil veröffentlichen"}
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
                                    <span className="text-[10px] text-gold font-semibold shrink-0">{l.price.toLocaleString("de-DE")} €</span>
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
                  <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
                    Verbindungen konnten nicht geladen werden: {friendsError}
                  </p>
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
                                  if (!response.ok || result.error) throw new Error(result.error ?? `HTTP ${response.status}`);
                                  addToast(t("collabSaved"), "success");
                                } catch (err) {
                                  addToast(`${t("savingError")}: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`, "error");
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
                              {t("collabPreview")} <span className="text-gold">{fr.display_name}</span> · {edit.label.trim() || "Vernetzt"}
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
                <h2 className="font-semibold text-text-primary mb-2">Login & Sicherheit</h2>
                <p className="text-sm text-text-muted leading-relaxed">
                  Passwort und Zwei-Faktor-Authentifizierung werden über den Anmeldedienst verwaltet. Die früheren Eingabefelder auf dieser Seite waren noch nicht angebunden und haben nichts geändert.
                </p>
              </div>
            )}

            {/* ── BENACHRICHTIGUNGEN ── */}
            {activeTab === "notifications" && (
              <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl space-y-4">
                <div>
                  <h2 className="font-semibold text-text-primary mb-1">E-Mail bei neuen Nachrichten</h2>
                  <p className="text-sm text-text-muted">Diese Einstellung wird gespeichert und steuert die E-Mail-Benachrichtigung bei neuen Nachrichten.</p>
                </div>
                {notificationError && <p role="alert" className="text-sm text-red-300">{notificationError}</p>}
                <button
                  type="button"
                  role="switch"
                  aria-checked={messageEmailsEnabled}
                  aria-label="E-Mail bei neuen Nachrichten"
                  onClick={updateMessageEmails}
                  disabled={notificationLoading}
                  className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${messageEmailsEnabled ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${messageEmailsEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <p className="text-xs text-text-muted">Weitere Benachrichtigungsarten und Push-Mitteilungen werden derzeit noch nicht gespeichert.</p>
              </div>
            )}

            {/* ── ABRECHNUNG ── */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-text-primary flex items-center gap-2">
                      <Wallet size={16} className="text-gold" /> {t("billingTitle")}
                    </h2>
                  </div>
                  <p className="text-xs text-text-muted mb-5 leading-relaxed">
                    {t("billingDesc")}
                  </p>
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-text-secondary">
                    Auszahlungsdaten können hier derzeit nicht sicher gespeichert werden. Bitte gib hier keine IBAN oder Bankdaten ein.
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-text-primary">{t("myAccount")}</h2>
                    <span className="px-3 py-1 bg-success/10 border border-success/20 text-success text-xs font-semibold rounded-full">
                      {t("myAccountFree")}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {t("myAccountDesc")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
