"use client";
import MediaImage from "@/components/MediaImage";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { useFormRouter as useRouter } from "@/lib/use-form-router";
import { uiErrorMessage } from "@/lib/ui-error-message";


function getLocalizedPHASES(translate: (key: string) => string): { id: string; label: string; dateFields?: [keyof Project, keyof Project] }[] {
  return ([
  { id: "entwicklung",    label: translate("Ui.text_9f1efd4753f6eb") },
  { id: "finanzierung",   label: translate("Ui.text_afac8ce712a623") },
  { id: "vorbereitung",   label: translate("Ui.text_c82d8ceed809a7"), dateFields: ["prep_start",  "prep_end"]  },
  { id: "dreh",           label: translate("Ui.text_a17ffec6cba8a3"),         dateFields: ["shoot_start", "shoot_end"] },
  { id: "postproduktion", label: translate("menu.crewPost"),         dateFields: ["post_start",  "post_end"]  },
  { id: "fertiggestellt", label: translate("Ui.text_25d52d7e866503") },
  { id: "veroeffentlicht",label: translate("Ui.text_e020e3c67bd0c3") },
]);
}


function getLocalizedSTATUS_META(translate: (key: string) => string): Record<string, { label: string; color: string; pulse: boolean }> {
  return ({
  "entwicklung":     { label: translate("Ui.text_46c2dec1ce192d"),  color: "bg-slate-500/15 text-slate-300 border-slate-500/30",   pulse: false },
  "finanzierung":    { label: translate("Ui.text_afac8ce712a623"),     color: "bg-amber-500/15 text-amber-300 border-amber-500/30",   pulse: false },
  "vorbereitung":    { label: translate("Ui.text_c82d8ceed809a7"),     color: "bg-blue-500/15 text-blue-300 border-blue-500/30",      pulse: false },
  "dreh":            { label: translate("Ui.text_22519303a692d9"),          color: "bg-red-500/15 text-red-400 border-red-500/30",         pulse: true  },
  "postproduktion":  { label: translate("Ui.text_ae54002d0d4ac9"),  color: "bg-purple-500/15 text-purple-300 border-purple-500/30",pulse: false },
  "fertiggestellt":  { label: translate("Ui.text_aa6e9d4fa8b6b4"),   color: "bg-green-500/15 text-green-300 border-green-500/30",   pulse: false },
  "veroeffentlicht": { label: translate("OfferModeration.statuses.owner_published"),   color: "bg-gold/15 text-gold border-gold/30",                  pulse: false },
});
}


function getLocalizedFESTIVAL_STATUS_META(translate: (key: string) => string): Record<string, { label: string; color: string; Icon: LucideIcon }> {
  return ({
  "eingereicht":       { label: translate("Ui.text_7f8d92f4db8c8d"),        color: "bg-slate-500/15 text-slate-300 border-slate-500/30",  Icon: Send   },
  "offiziell":         { label: translate("Ui.text_585fa9381b848e"), color: "bg-blue-500/15 text-blue-300 border-blue-500/30",    Icon: Check  },
  "nominiert":         { label: translate("Ui.text_9a1afaee878006"),           color: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Star   },
  "gewonnen":          { label: translate("Ui.text_617df6e1a55eee"),            color: "bg-gold/15 text-gold border-gold/30",                Icon: Trophy },
  "nicht_ausgewaehlt": { label: translate("Ui.text_7a31cc99b9d532"),   color: "bg-border text-text-muted border-border",            Icon: X      },
});
}

function safeLink(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(normalized);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return normalized;
  } catch { return null; }
}

import { useFormDraft, useUnsavedForm } from "@/lib/use-form-draft";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import FormDraftStatus from "@/components/FormDraftStatus";
import { useState } from "react";
import { useTranslations , useLocale } from "next-intl";
import { useAuth } from "@clerk/nextjs";

import Link from "next/link";
import ContextBackLink from "@/components/ContextBackLink";
import { splitProjectCreditRole } from "@/lib/project-credit-roles";
import ProjectCredits from "@/components/ProjectCredits";
import {
  ArrowLeft, Calendar, Users,
  Plus, X, Check, Loader2, Pencil, Save, ImageIcon, Trash2, ShieldCheck, ShieldAlert,
  Film, Info, ExternalLink, Trophy, Award,
  UserRound, Megaphone, BookOpen, Briefcase, Video,
  Lightbulb, Wrench, Mic, Monitor, Shirt, Palette,
  Zap, Music2, Camera, Truck, Globe, Tv, Send, Star,
  Play, MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Lightbox from "@/components/Lightbox";
import RoleDropdown from "@/components/RoleDropdown";

type Credit = {
  id: string;
  isCurrentUser?: boolean;
  role: string;
  created_at: string;
  profile: {
    display_name: string;
    avatar_url: string | null;
    role: string | null;
    slug: string | null;
  } | null;
  ghost?: {
    name: string;
    slug: string;
    avatar_url: string | null;
    primary_role: string | null;
  } | null;
};

type StreamingRelease = {
  platform: string;
  date: string;
  url: string | null;
  territory: string | null;
};

type TvRelease = {
  channel: string;
  date: string;
  territory: string | null;
  notes: string | null;
};

type Project = {
  updated_at?: string | null;
  id: string;
  title: string;
  alt_title?: string | null;
  year: number | null;
  type: string | null;
  description: string | null;
  director: string | null;
  poster_url: string | null;
  verified?: boolean | null;
  images: string[];
  image_credit?: string | null;
  // Status & story
  status?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  genres?: string[] | null;
  language?: string | null;
  country?: string | null;
  runtime_minutes?: number | null;
  // Production
  production_company?: string | null;
  co_producers?: string[] | null;
  budget?: number | null;
  budget_visible?: boolean | null;
  shoot_locations?: string[] | null;
  // Timeline dates
  prep_start?: string | null;
  prep_end?: string | null;
  shoot_start?: string | null;
  shoot_end?: string | null;
  post_start?: string | null;
  post_end?: string | null;
  // Distribution
  release_cinema?: string | null;
  release_cinema_countries?: string[] | null;
  release_streaming?: StreamingRelease[] | null;
  release_tv?: TvRelease[] | null;
  trailer_url?: string | null;
  teaser_url?: string | null;
};

type FestivalEntry = {
  id: string;
  project_id: string;
  festival_name: string;
  year: number;
  section: string | null;
  status: string;
  award_name: string | null;
  notes: string | null;
};

const DEPT_STYLES: Record<string, { bar: string; label: string; bg: string; icon: LucideIcon }> = {
  "Besetzung":           { bar: "bg-rose-400",    label: "text-rose-300",    bg: "bg-rose-500/8",    icon: UserRound },
  "Regie":               { bar: "bg-purple-400",  label: "text-purple-300",  bg: "bg-purple-500/8",  icon: Megaphone },
  "Drehbuch":            { bar: "bg-violet-400",  label: "text-violet-300",  bg: "bg-violet-500/8",  icon: BookOpen },
  "Produktion":          { bar: "bg-emerald-400", label: "text-emerald-300", bg: "bg-emerald-500/8", icon: Briefcase },
  "Kamera":              { bar: "bg-sky-400",     label: "text-sky-300",     bg: "bg-sky-500/8",     icon: Video },
  "Licht":               { bar: "bg-amber-400",   label: "text-amber-300",   bg: "bg-amber-500/8",   icon: Lightbulb },
  "Ton":                 { bar: "bg-teal-400",    label: "text-teal-300",    bg: "bg-teal-500/8",    icon: Mic },
  "Schnitt & Post":      { bar: "bg-blue-400",    label: "text-blue-300",    bg: "bg-blue-500/8",    icon: Monitor },
  "Kostüm & Maske":      { bar: "bg-pink-400",    label: "text-pink-300",    bg: "bg-pink-500/8",    icon: Shirt },
  "Szenenbild":          { bar: "bg-orange-400",  label: "text-orange-300",  bg: "bg-orange-500/8",  icon: Palette },
  "Stunts":              { bar: "bg-red-400",     label: "text-red-300",     bg: "bg-red-500/8",     icon: Zap },
  "Musik":               { bar: "bg-indigo-400",  label: "text-indigo-300",  bg: "bg-indigo-500/8",  icon: Music2 },
  "Foto & Making-of":    { bar: "bg-lime-400",    label: "text-lime-300",    bg: "bg-lime-500/8",    icon: Camera },
  "Catering & Logistik": { bar: "bg-cyan-400",    label: "text-cyan-300",    bg: "bg-cyan-500/8",    icon: Truck },
  "Sonstiges":           { bar: "bg-border",      label: "text-text-muted",  bg: "bg-bg-elevated",   icon: Wrench },
};

const PHASE_INDEX: Record<string, number> = Object.fromEntries(
  ["entwicklung", "finanzierung", "vorbereitung", "dreh", "postproduktion", "fertiggestellt", "veroeffentlicht"].map((id, index) => [id, index]),
);





const STREAMING_PLATFORMS = ["Netflix","Amazon Prime","Disney+","Apple TV+","Mubi","Joyn","ARD Mediathek","ZDF Mediathek","YouTube","Vimeo","Andere"];

const TYPE_COLORS: Record<string, string> = {
  Spielfilm:     "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Kurzfilm:      "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Serie:         "bg-green-500/15 text-green-300 border-green-500/30",
  Dokumentation: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Werbefilm:     "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Musikvideo:    "bg-red-500/15 text-red-300 border-red-500/30",
  Corporate:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

function formatDate(locale: string, d: string | null | undefined) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

type Tab = "stab" | "fotos" | "uebersicht" | "timeline" | "festivals" | "distribution";

const EMPTY_FESTIVAL_FORM = { festival_name: "", year: String(new Date().getFullYear()), section: "", status: "offiziell", award_name: "", notes: "" };
const EMPTY_STREAMING_FORM = { platform: "Netflix", date: "", url: "", territory: "" };
const EMPTY_TV_FORM        = { channel: "", date: "", territory: "", notes: "" };


export default function ProjectDetail({
  project: initialProject,
  credits: initialCredits,
  festivals: initialFestivals,
  currentUserId,
  initialIsCreator = false,
  myCredit: initialMyCredit,
  userPositions = [],
  userProfile = null,
  isAdmin = false,
}: {
  project: Project;
  credits: Credit[];
  festivals: FestivalEntry[];
  currentUserId: string | null;
  initialIsCreator?: boolean;
  myCredit: Credit | null;
  userPositions?: string[];
  userProfile?: { display_name: string | null; avatar_url: string | null } | null;
  isAdmin?: boolean;
}) {
  const uiFormattingLocale = useLocale();

  const uiText = useTranslations();
  const uiDisplayLabels: Record<string, string> = { "Besetzung": uiText("Ui.text_3d47f0217854a6"), "Regie": uiText("menu.crewDirection"), "Drehbuch": uiText("Ui.text_86d1055453748f"), "Produktion": uiText("menu.crewProduction"), "Kamera": uiText("menu.crewCamera"), "Licht": uiText("menu.crewLight"), "Ton": uiText("menu.crewSound"), "Schnitt & Post": uiText("Ui.text_583271cd5218e9"), "Kostüm & Maske": uiText("Ui.text_33a1f375da97c2"), "Szenenbild": uiText("Ui.text_03552f45d48cae"), "Stunts": uiText("Ui.text_55c57691a3f14f"), "Musik": uiText("Ui.text_8ff93160579529"), "Foto & Making-of": uiText("Ui.text_9bebf00accc6e1"), "Catering & Logistik": uiText("Ui.text_bef4d81ffbb138"), "Sonstiges": uiText("profile.typeOther"), "Crew": uiText("nav.crew"), "Fotos": uiText("profile.sectionPhotos"), "Logline": uiText("Ui.text_de976131fa0390"), "Laufzeit": uiText("Ui.text_956ba2f5f97188"), "Sprache": uiText("creators.filterLanguage"), "Land": uiText("creators.filterCountry"), "Budget": uiText("Ui.text_1c6225ec7092ad") };

  const uiOptionLabels: Record<string, string> = {
    "Spielfilm": uiText("Ui.text_031b1c1fc4b241"),
    "Kurzfilm": uiText("Ui.text_75b346d26e4973"),
    "Serie": uiText("Ui.text_ab7743a4ad9a44"),
    "Dokumentation": uiText("projects.catDokumentation"),
    "Werbefilm": uiText("Ui.text_5c634ccc3ba66d"),
    "Musikvideo": uiText("projects.catMusikvideo"),
    "Corporate": uiText("projects.catCorporate"),
    "Netflix": uiText("Ui.text_f09f149fa26808"),
    "Amazon Prime": uiText("Ui.text_d1cac591c672f9"),
    "Disney+": uiText("Ui.text_02dc2a9874362d"),
    "Apple TV+": uiText("Ui.text_b419c62e25213a"),
    "Mubi": uiText("Ui.text_8216730e774ea6"),
    "Joyn": uiText("Ui.text_38f6fdf1af4631"),
    "ARD Mediathek": uiText("Ui.text_3a01c2726a7481"),
    "ZDF Mediathek": uiText("Ui.text_f2220a0601cb80"),
    "YouTube": uiText("Ui.text_fb7accfff8c6f8"),
    "Vimeo": uiText("Ui.text_a7a93fd1930a61"),
    "Andere": uiText("Ui.text_e7aa6f052cee46"),
  };





  const PHASES = getLocalizedPHASES(uiText);
  const STATUS_META = getLocalizedSTATUS_META(uiText);
  const FESTIVAL_STATUS_META = getLocalizedFESTIVAL_STATUS_META(uiText);


  const optionalMedia = useTranslations("OptionalMedia");
  const mediaRightsText = useTranslations("ProjectMediaRights");
  const [project, setProject] = useState(initialProject);
  const [credits, setCredits] = useState(initialCredits);
  const [myCredit, setMyCredit] = useState(initialMyCredit);
  const [festivals, setFestivals] = useState(initialFestivals);
  const [activeTab, setActiveTab] = useState<Tab>("stab");

  // Join form
  const [joinRole, setJoinRole] = useState("");
  const [joinCharacter, setJoinCharacter] = useState("");
  const [joinNote, setJoinNote] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  // Header edit
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title:              project.title,
    year:               project.year ? String(project.year) : "",
    type:               project.type ?? "",
    description:        project.description ?? "",
    director:           project.director ?? "",
    status:             project.status ?? "",
    logline:            project.logline ?? "",
    production_company: project.production_company ?? "",
    runtime_minutes:    project.runtime_minutes ? String(project.runtime_minutes) : "",
    trailer_url:        project.trailer_url ?? "",
    release_cinema:     project.release_cinema ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Timeline dates edit
  const [editingTimeline, setEditingTimeline] = useState(false);
  const [timelineForm, setTimelineForm] = useState({
    prep_start:  project.prep_start  ?? "",
    prep_end:    project.prep_end    ?? "",
    shoot_start: project.shoot_start ?? "",
    shoot_end:   project.shoot_end   ?? "",
    post_start:  project.post_start  ?? "",
    post_end:    project.post_end    ?? "",
  });
  const [savingTimeline, setSavingTimeline] = useState(false);

  // Festival form
  const [showFestivalForm, setShowFestivalForm] = useState(false);
  const [festivalForm, setFestivalForm] = useState(EMPTY_FESTIVAL_FORM);
  const [savingFestival, setSavingFestival] = useState(false);
  const [festivalError, setFestivalError] = useState("");

  // Distribution
  const [showStreamingForm, setShowStreamingForm] = useState(false);
  const [streamingForm, setStreamingForm] = useState(EMPTY_STREAMING_FORM);
  const [savingStreaming, setSavingStreaming] = useState(false);
  const [showTvForm, setShowTvForm] = useState(false);
  const [tvForm, setTvForm] = useState(EMPTY_TV_FORM);
  const [savingTv, setSavingTv] = useState(false);

  const router = useRouter();
  const { userId: liveUserIdFromClerk, isLoaded } = useAuth();
  const liveUserId = isLoaded ? liveUserIdFromClerk ?? null : currentUserId;
  const isCreator = initialIsCreator && (!isLoaded || liveUserId === currentUserId);
  const isLoggedIn = !!liveUserId;
  const typeColor = project.type ? (TYPE_COLORS[project.type] ?? "bg-gold/10 text-gold border-gold/20") : "";
  const statusMeta = project.status ? STATUS_META[project.status] : null;
  const wonCount = festivals.filter((f) => f.status === "gewonnen").length;
  const currentPhaseIdx = project.status ? (PHASE_INDEX[project.status] ?? -1) : -1;
  const streamingList: StreamingRelease[] = project.release_streaming ?? [];
  const tvList: TvRelease[] = project.release_tv ?? [];

  const { leave: leaveProjectForm } = useFormNavigation();
  const projectFormDraft = useFormDraft({ formKey: `project:${project.id}`, enabled: isCreator && (editing || editingTimeline || showFestivalForm || showStreamingForm || showTvForm || showJoin),
    value: { editForm, timelineForm, festivalForm, streamingForm, tvForm, joinRole, joinCharacter, joinNote, editing, editingTimeline, showFestivalForm, showStreamingForm, showTvForm, showJoin },
    busy: saving || savingTimeline || savingFestival || savingStreaming || savingTv || joining,
    restore: draft => { setEditForm(draft.editForm); setTimelineForm(draft.timelineForm); setFestivalForm(draft.festivalForm); setStreamingForm(draft.streamingForm); setTvForm(draft.tvForm); setJoinRole(draft.joinRole); setJoinCharacter(draft.joinCharacter); setJoinNote(draft.joinNote); },
  });

  useUnsavedForm(!isCreator && showJoin && !!(joinRole || joinCharacter || joinNote));

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const deleteProject = async () => {
    if (!confirm(uiText("Ui.text_acbca47969da1f"))) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/projects");
    } else {
      alert(uiText("Ui.text_4049adacc8fd2f"));
    }
  };

  const saveDraftPatch = async (patch: Partial<Project>) => {
    setDraftError("");
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || uiText("System.requestFailed"));
      setDraftId(data.draftId);
      return true;
    } catch (reason) {
      setDraftError(uiErrorMessage(reason, uiText("System.requestFailed")));
      return false;
    }
  };

  const handleJoin = async () => {
    if (!joinRole.trim()) return;
    setJoining(true); setJoinError("");
    try {
      const roleValue = [
        joinCharacter.trim() ? `${joinRole.trim()} — ${joinCharacter.trim()}` : joinRole.trim(),
        joinNote.trim() ? `||${joinNote.trim()}` : "",
      ].join("");
      const res = await fetch("/api/project-credits", { method: myCredit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(myCredit ? { id: myCredit.id, role: roleValue } : { project_id: project.id, role: roleValue }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Add the new credit directly to local state — no second fetch needed
      const newCredit: Credit = {
        id: myCredit?.id ?? data.credit.id,
        isCurrentUser: true,
        role: roleValue,
        created_at: myCredit?.created_at ?? data.credit.created_at,
        profile: userProfile ? { display_name: userProfile.display_name ?? "", avatar_url: userProfile.avatar_url, role: null, slug: null } : null,
        ghost: null,
      };
      setCredits((prev) => myCredit ? prev.map(credit => credit.id === myCredit.id ? { ...credit, role: roleValue } : credit) : [...prev, newCredit]);
      setMyCredit(newCredit);
      setShowJoin(false); setJoinRole(""); setJoinCharacter(""); setJoinNote("");
    } catch (e: unknown) { setJoinError(uiErrorMessage(e, uiText("Ui.text_f6cc01cb7edbf0"))); }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    if (!confirm(uiText("Ui.text_d5f604b675d0f3"))) return;
    setJoining(true); setJoinError("");
    try {
      const response = await fetch(`/api/project-credits?project_id=${project.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("remove_failed");
      setMyCredit(null);
      setCredits(previous => previous.filter(credit => !credit.isCurrentUser));
      setShowJoin(false);
    } catch { setJoinError(uiText("System.requestFailed")); }
    finally { setJoining(false); }
  };

  const handleSaveEdit = async () => {
    if (!projectFormDraft.loaded) return;
    setSaving(true);
    const patch = {
      title:              editForm.title.trim(),
      year:               editForm.year ? parseInt(editForm.year) : null,
      type:               editForm.type || null,
      description:        editForm.description.trim() || null,
      director:           editForm.director.trim() || null,
      status:             editForm.status || null,
      logline:            editForm.logline.trim() || null,
      production_company: editForm.production_company.trim() || null,
      runtime_minutes:    editForm.runtime_minutes ? parseInt(editForm.runtime_minutes) : null,
      trailer_url:        editForm.trailer_url.trim() || null,
      release_cinema:     editForm.release_cinema.trim() || null,
    };
    if (await saveDraftPatch(patch)) { setProject((p) => ({ ...p, ...patch })); setEditing(false); }
    setSaving(false);
  };

  const handleSaveTimeline = async () => {
    if (!projectFormDraft.loaded) return;
    setSavingTimeline(true);
    const patch = {
      prep_start:  timelineForm.prep_start  || null,
      prep_end:    timelineForm.prep_end    || null,
      shoot_start: timelineForm.shoot_start || null,
      shoot_end:   timelineForm.shoot_end   || null,
      post_start:  timelineForm.post_start  || null,
      post_end:    timelineForm.post_end    || null,
    };
    if (await saveDraftPatch(patch)) { setProject((p) => ({ ...p, ...patch })); setEditingTimeline(false); }
    setSavingTimeline(false);
  };



  const removePhoto = async (url: string) => {
    const newImages = project.images.filter((i) => i !== url);
    if (await saveDraftPatch({ images: newImages })) setProject((p) => ({ ...p, images: newImages }));
  };

  const handleAddFestival = async () => {
    if (!festivalForm.festival_name.trim() || !festivalForm.year) return;
    setSavingFestival(true); setFestivalError("");
    try {
      const res = await fetch("/api/project-festivals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...festivalForm, project_id: project.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFestivals((prev) => [data.festival, ...prev].sort((a, b) => b.year - a.year));
      setShowFestivalForm(false); setFestivalForm(EMPTY_FESTIVAL_FORM);
    } catch (e: unknown) { setFestivalError(uiErrorMessage(e, uiText("Ui.text_f6cc01cb7edbf0"))); }
    finally { setSavingFestival(false); }
  };

  const handleDeleteFestival = async (id: string) => {
    if (!confirm(uiText("Ui.text_d8cef291c32b84"))) return;
    await fetch(`/api/project-festivals/${id}`, { method: "DELETE" });
    setFestivals((prev) => prev.filter((f) => f.id !== id));
  };

  const patchDistribution = async (patch: Partial<Project>) => {
    if (!await saveDraftPatch(patch)) return false;
    setProject((p) => ({ ...p, ...patch }));
    return true;
  };

  const handleAddStreaming = async () => {
    if (!streamingForm.platform || !streamingForm.date) return;
    setSavingStreaming(true);
    const entry: StreamingRelease = { platform: streamingForm.platform, date: streamingForm.date, url: streamingForm.url || null, territory: streamingForm.territory || null };
    const updated = [...streamingList, entry];
    if (await patchDistribution({ release_streaming: updated })) { setShowStreamingForm(false); setStreamingForm(EMPTY_STREAMING_FORM); }
    setSavingStreaming(false);
  };

  const handleRemoveStreaming = async (idx: number) => {
    const updated = streamingList.filter((_, i) => i !== idx);
    await patchDistribution({ release_streaming: updated });
  };

  const handleAddTv = async () => {
    if (!tvForm.channel || !tvForm.date) return;
    setSavingTv(true);
    const entry: TvRelease = { channel: tvForm.channel, date: tvForm.date, territory: tvForm.territory || null, notes: tvForm.notes || null };
    const updated = [...tvList, entry];
    if (await patchDistribution({ release_tv: updated })) { setShowTvForm(false); setTvForm(EMPTY_TV_FORM); }
    setSavingTv(false);
  };

  const handleRemoveTv = async (idx: number) => {
    const updated = tvList.filter((_, i) => i !== idx);
    await patchDistribution({ release_tv: updated });
  };

  // ─── Input helper ─────────────────────────────────────────────────────────────
  const inp = "w-full bg-bg-elevated border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold transition-colors";
  const label = (txt: string, opt = false) => (
    <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
      {txt}{opt && <span className="normal-case font-normal ml-1">{uiText("profile.billingVATOptional")}</span>}
    </label>
  );

  return (
    <div className="pt-16 min-h-screen bg-bg-primary mobile-bottom-nav-clear">
      <div className="site-container py-8 sm:py-10">

        <ContextBackLink href="/projects" className="inline-flex min-h-11 items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mb-6">{uiText.rich("Ui.text_6537e36e485dda", { part1: () => (<ArrowLeft size={13} />) })}</ContextBackLink>

        {draftId && (
          <div className="mb-6 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-text-secondary">{uiText("Ui.text_4465c5638e6b2e")}</p>
            <Link href={`/dashboard/projects/drafts/${draftId}`} className="min-h-11 shrink-0 inline-flex items-center justify-center rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary">{uiText("Ui.text_349b1ceed82879")}</Link>
          </div>
        )}
        {draftError && <p role="alert" className="mb-5 text-sm text-red-400">{draftError}</p>}

        {/* ════════ HEADER ════════ */}
        <div className="flex gap-8 mb-10 flex-col sm:flex-row">
          {project.poster_url && <div className="w-24 shrink-0 sm:w-40">
            <MediaImage src={project.poster_url} alt={project.title} width={160} height={240} className="aspect-[2/3] w-full rounded-xl border border-border object-cover object-top" />
            {project.image_credit && <p className="mt-2 break-words text-xs text-text-muted">{project.image_credit}</p>}
          </div>}

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex flex-col gap-3">
              <div className="flex-1 min-w-0">
                {editing
                  ? <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="font-display text-3xl sm:text-4xl font-bold bg-bg-secondary border border-gold rounded-xl px-4 py-2 w-full focus:outline-none mb-3" />
                  : <h1 className="break-words font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3 leading-tight">{project.title}</h1>
                }
                <div className="flex items-center gap-2.5 flex-wrap mb-4">
                  {project.type && <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${typeColor}`}>{projectTypeLabel(project.type, uiText)}</span>}
                  {project.year && <span className="flex items-center gap-1.5 text-sm text-text-muted"><Calendar size={14} />{project.year}</span>}
                  {statusMeta && (
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusMeta.color}`}>
                      {statusMeta.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                      {statusMeta.label}
                    </span>
                  )}
                  {wonCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border bg-gold/15 text-gold border-gold/30">{uiText.rich("Ui.text_91ee9368b5fe4d", { part1: () => (<Trophy size={11} />), value2: () => (wonCount), count3: wonCount })}</span>
                  )}
                  {project.verified && !draftId
                    ? <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border bg-gold/10 text-gold border-gold/20">{uiText.rich("Ui.text_712de43869af36", { part1: () => (<ShieldCheck size={11} />) })}</span>
                    : <span className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border bg-bg-elevated text-text-muted border-border">{uiText.rich("Ui.text_1bc7b76197852e", { part1: () => (<ShieldAlert size={11} />) })}</span>
                  }
                </div>
              </div>
              {(isCreator || isAdmin) && !editing && (
                <div className="flex max-w-full flex-wrap items-center gap-1">
                  {isCreator && (
                    <button onClick={() => setEditing(true)} aria-label={uiText("projects.editProject")} className="flex min-h-11 min-w-11 items-center justify-center p-2 text-text-muted hover:text-gold transition-colors">
                      <Pencil size={15} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      title={project.verified ? uiText("Ui.text_43277c4204c895") : uiText("Ui.text_33347561b7ed6b")}
                      disabled={verificationBusy || !!draftId}
                      onClick={async () => {
                        if (!confirm(uiText(project.verified ? "projects.unverifyPrompt" : "projects.verifyPrompt"))) return;
                        setVerificationBusy(true); setVerificationError("");
                        try {
                          const res = await fetch(`/api/projects/${project.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verified: !project.verified, expectedUpdatedAt: project.updated_at ?? null }) });
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error);
                          setProject(previous => ({ ...previous, verified: result.verified, updated_at: result.updatedAt }));
                        } catch (error) { setVerificationError(uiErrorMessage(error, uiText("System.requestFailed"))); }
                        finally { setVerificationBusy(false); }
                      }}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs text-text-secondary hover:text-gold disabled:opacity-50"
                    >
                      <ShieldCheck size={15} />{uiText(project.verified ? "projects.unverifyAction" : "projects.verifyAction")}
                    </button>
                  )}
                  {isCreator && (
                    <button onClick={deleteProject} aria-label={uiText("projects.deleteProject")} className="flex min-h-11 min-w-11 items-center justify-center p-2 text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {verificationError && <p role="alert" className="mb-4 text-sm text-crimson-light">{verificationError}</p>}
            <p className="mb-4 text-xs leading-relaxed text-text-muted">{uiText(draftId ? "projects.draftNotice" : project.verified ? "projects.verifiedExplanation" : "projects.unverifiedExplanation")}</p>

            {/* Meta */}
            <div className="space-y-2 mb-5">
              {[
                { key: "Regie",   val: project.director },
                { key: "Crew",    val: uiText("Ui.text_43e8d922aee3a4", { value1: String(credits.length) }) },
                { key: "Fotos",   val: project.images.length > 0 ? uiText("Ui.text_2efcc0193f915c", { value1: String(project.images.length) }) : null },
                { key: "Logline", val: project.logline },
              ].filter((r) => r.val).map(({ key, val }) => (
                <div key={uiDisplayLabels[key] ?? key} className="flex items-baseline gap-3">
                  <span className="text-xs uppercase tracking-widest text-text-muted font-semibold w-20 shrink-0">{uiDisplayLabels[key] ?? key}</span>
                  <span className="text-sm text-text-secondary">{val}</span>
                </div>
              ))}
            </div>

            {!editing && project.description && (
              <p className="text-sm text-text-secondary leading-relaxed max-w-xl border-t border-border pt-4">{project.description}</p>
            )}

            {(editing || editingTimeline) && <FormDraftStatus draft={projectFormDraft} />}
            {/* Edit form */}
            {editing && (
              <div className="space-y-3 mt-3 pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>{label(uiText("projects.filterYear"))}<input type="number" value={editForm.year} onChange={(e) => setEditForm((p) => ({ ...p, year: e.target.value }))} placeholder={String(new Date().getFullYear())} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label(uiText("projects.colType"))}<select value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"><option value="">—</option>{["Spielfilm","Kurzfilm","Serie","Dokumentation","Werbefilm","Musikvideo","Corporate"].map((t) => <option key={t} value={t}>{(uiOptionLabels[t] ?? t)}</option>)}</select></div>
                  <div>{label(uiText("Places.status"))}<select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"><option value="">—</option>{Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  <div>{label(uiText("menu.crewDirection"))}<input type="text" value={editForm.director} onChange={(e) => setEditForm((p) => ({ ...p, director: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label(uiText("profile.labelProductionCompany"))}<input type="text" value={editForm.production_company} onChange={(e) => setEditForm((p) => ({ ...p, production_company: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label(uiText("Ui.text_5369a3f1e67de2"))}<input type="number" value={editForm.runtime_minutes} onChange={(e) => setEditForm((p) => ({ ...p, runtime_minutes: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div className="col-span-2">{label(uiText("Ui.text_de976131fa0390"))}<input type="text" value={editForm.logline} onChange={(e) => setEditForm((p) => ({ ...p, logline: e.target.value }))} placeholder={uiText("Ui.text_daeed653851b63")} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div className="col-span-2">{label(uiText("Ui.text_76caf76da0cfb2"))}<textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none" /></div>
                  <div>{label(uiText("Ui.text_c4b831169af33c"))}<input type="text" value={editForm.release_cinema} onChange={(e) => setEditForm((p) => ({ ...p, release_cinema: e.target.value }))} placeholder={uiText("Ui.text_e95c3c737389a4")} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label(uiText("Ui.text_2b55006332bb93"))}<input type="url" value={editForm.trailer_url} onChange={(e) => setEditForm((p) => ({ ...p, trailer_url: e.target.value }))} placeholder={uiText("Ui.text_f167e87e1066c3")} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={saving} className="min-h-11 flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">{uiText.rich("Ui.text_74c465184b036f", { value1: () => (saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />) })}</button>
                  <button onClick={() => leaveProjectForm(() => setEditing(false))} className="min-h-11 px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
                </div>
              </div>
            )}

            {/* CTA */}
            {!editing && (
              <div className="flex gap-3 mt-5 flex-wrap">
                {isLoggedIn && !myCredit && (
                  <button onClick={() => setShowJoin(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_b30ce2b7455d16", { part1: () => (<Plus size={14} />) })}</button>
                )}
                {myCredit && (
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-gold/10 border border-gold/20 rounded-xl">
                    <Check size={14} className="text-gold" />
                    <span className="text-sm text-gold font-medium">{uiText.rich("Ui.text_912cd007084dc6", { value2: () => (myCredit.role), part1: chunks => (<strong>{chunks}</strong>) })}</span>
                    <button onClick={() => { const parsed = splitProjectCreditRole(myCredit.role); setJoinRole(parsed.role); setJoinCharacter(parsed.character); setJoinNote(parsed.note); setShowJoin(true); }} className="min-h-11 text-xs text-text-secondary hover:text-gold">{uiText("projects.editCredit")}</button>
                    <button onClick={handleLeave} disabled={joining} className="min-h-11 text-xs text-text-muted hover:text-crimson-light transition-colors ml-2 disabled:opacity-50">{uiText("Ui.text_ff1f4de2c978d7")}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {joinError && !showJoin && <p role="alert" className="mb-4 text-sm text-crimson-light">{joinError}</p>}
        {/* Join form */}
        {showJoin && (
          <div className="mb-8 p-5 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
            <p className="text-sm font-semibold text-text-primary">{uiText.rich("Ui.text_4eda27feac6362", { value1: () => (project.title) })}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>{label(uiText("Ui.text_c5d70daa002cac"))}
                <RoleDropdown value={joinRole} onChange={setJoinRole} options={userPositions} />
              </div>
              <div>{label(uiText("Ui.text_446cb1828991ea"), true)}<input type="text" value={joinCharacter} onChange={(e) => setJoinCharacter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder={uiText("Ui.text_a02b3f65d99c52")} className={inp} /></div>
              <div>{label(uiText("Ui.text_c5939cb300d228"), true)}<input type="text" value={joinNote} onChange={(e) => setJoinNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder={uiText("Ui.text_0e46502c0c4be8")} className={inp} /></div>
            </div>
            <p className="text-xs leading-relaxed text-text-muted">{uiText("projects.creditsNotice")}</p>
            {joinError && <p role="alert" className="text-xs text-crimson-light">{joinError}</p>}
            <div className="flex gap-2">
              <button onClick={handleJoin} disabled={joining || !joinRole.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">{uiText.rich(myCredit ? "Ui.text_74c465184b036f" : "Ui.text_436b4c755f2731", { value1: () => (joining ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />) })}</button>
              <button onClick={() => leaveProjectForm(() => { setShowJoin(false); setJoinRole(""); setJoinCharacter(""); setJoinNote(""); })} className="px-5 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
            </div>
          </div>
        )}

        {/* ════════ TABS ════════ */}
        <div className="border-b border-border mb-8">
          <div className="flex gap-0 overflow-x-auto">
            {([
              { id: "stab",         label: uiText("Ui.text_df571f1e3813ee"),  icon: Users,    count: credits.length },
              { id: "fotos",        label: uiText("profile.sectionPhotos"),              icon: ImageIcon,count: project.images.length },
              { id: "uebersicht",   label: uiText("nav.accountOverview"),          icon: Info,     count: null },
              { id: "timeline",     label: uiText("Ui.text_9dcff98e275f0c"),           icon: Calendar, count: null },
              { id: "festivals",    label: uiText("Ui.text_b3c735e56dea0f"), icon: Trophy,   count: festivals.length || null },
              { id: "distribution", label: uiText("Ui.text_72a23e549d099b"),       icon: Globe,    count: null },
            ] as { id: Tab; label: string; icon: React.ElementType; count: number | null }[]).map(({ id, label: lbl, icon: Icon, count }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
                  activeTab === id ? "border-gold text-gold" : "border-transparent text-text-muted hover:text-text-secondary"
                }`}>
                <Icon size={14} />
                {lbl}
                {count !== null && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === id ? "bg-gold/20 text-gold" : "bg-bg-elevated text-text-muted"}`}>{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "stab" && <ProjectCredits credits={credits} />}

        {/* ════════ TAB: FOTOS ════════ */}
        {activeTab === "fotos" && (
          <div>
            <Link href="/bildrechte" className="mb-4 inline-flex min-h-11 items-center text-xs text-gold hover:underline">{mediaRightsText("reportLink")}</Link>
            {isCreator && (
              <div className="flex justify-end mb-5">{uiText.rich("Ui.text_cd28e2d98c97dd", { part1: chunks => (<span className="text-xs text-text-muted">{chunks}</span>) })}</div>
            )}
            {project.images.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-4 text-text-muted">
                <Film size={24} className="shrink-0 opacity-50" aria-hidden="true" />
                <p className="text-sm">{optionalMedia("noPhotos")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {project.images.map((url, i) => (
                  <div key={url} className="relative group aspect-video rounded-xl overflow-hidden border border-border">
                    <button type="button" onClick={() => setLightboxIndex(i)} className="h-full w-full min-h-11" aria-label={uiText("Ui.text_31b5322f7aaa57", { value1: String(i + 1) })}><MediaImage width={320} height={180} src={url} alt={uiText("Ui.text_31b5322f7aaa57", { value1: String(i + 1) })} className="w-full h-full object-cover" /></button>
                    <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon size={20} className="text-white" /></div>
                    {isCreator && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removePhoto(url); }}
                        aria-label={uiText("Ui.text_e1d7608e0a6d0a")} className="absolute top-1 right-1 w-11 h-11 bg-black/70 rounded-full flex items-center justify-center text-white transition-colors hover:bg-crimson-light">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ TAB: ÜBERSICHT ════════ */}
        {activeTab === "uebersicht" && (
          <div className="max-w-2xl space-y-8">
            {project.logline && (
              <div>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-2">{uiText("Ui.text_de976131fa0390")}</h2>
                <p className="text-text-secondary italic leading-relaxed border-l-2 border-gold/30 pl-4">{project.logline}</p>
              </div>
            )}
            {(project.synopsis || project.description) && (
              <div>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{uiText("Ui.text_8eb3755381519d")}</h2>
                <p className="text-text-secondary leading-relaxed">{project.synopsis ?? project.description}</p>
              </div>
            )}
            {!project.synopsis && !project.description && !project.logline && (
              <p className="text-text-muted text-sm">{uiText.rich("Ui.text_94f61bb72f65ba", { value1: () => (isCreator && uiText("Ui.text_09092e7e952b15")) })}</p>
            )}
            {safeLink(project.trailer_url) && (
              <div>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{uiText("Ui.text_6a7b20d1da8aea")}</h2>
                <a href={safeLink(project.trailer_url)!} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">{uiText.rich("Ui.text_dccc8570685b1b", { part1: () => (<Play size={14} />), part2: () => (<ExternalLink size={11} className="text-text-muted" />) })}</a>
              </div>
            )}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4">{uiText("Ui.text_430266b0b0d3e2")}</h2>
              <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                {[
                  { lbl: uiText("Ui.text_d92244697af03f"),    val: project.title },
                  { lbl: uiText("Ui.text_96e8893bd0ddfb"),  val: project.alt_title },
                  { lbl: uiText("Ui.text_41b76a3bd3d28e"),  val: project.year },
                  { lbl: uiText("Organizations.formatLabel"),           val: project.type ? projectTypeLabel(project.type, uiText) : project.type },
                  { lbl: uiText("Places.status"),           val: project.status ? STATUS_META[project.status]?.label : null },
                  { lbl: uiText("Ui.text_3561abfe8067f3"),           val: project.genres?.join(", ") },
                  { lbl: uiText("creators.filterLanguage"),          val: project.language },
                  { lbl: uiText("creators.filterCountry"),             val: project.country },
                  { lbl: uiText("Ui.text_956ba2f5f97188"),         val: project.runtime_minutes ? uiText("Ui.text_34943731be3062", { value1: String(project.runtime_minutes) }) : null },
                  { lbl: uiText("menu.crewDirection"),            val: project.director },
                  { lbl: uiText("profile.labelProductionCompany"), val: project.production_company },
                  { lbl: uiText("Ui.text_ca9b8f9f16cc05"),   val: project.co_producers?.join(", ") },
                  { lbl: uiText("nav.locations"),         val: project.shoot_locations?.join(", ") },
                  { lbl: uiText("Ui.text_c4b831169af33c"),        val: project.release_cinema },
                  { lbl: uiText("Ui.text_7d0c7ccb916dc9"),  val: uiText("Ui.text_532dbfd6d3726d", { value1: String(credits.length) }) },
                  { lbl: uiText("profile.sectionPhotos"),            val: uiText("Ui.text_2efcc0193f915c", { value1: String(project.images.length) }) },
                ].filter((r) => r.val != null && r.val !== "").map(({ lbl: l, val: v }) => (
                  <div key={l} className="flex gap-6 px-5 py-3">
                    <span className="text-xs uppercase tracking-widest text-text-muted font-semibold w-36 shrink-0 pt-0.5">{l}</span>
                    <span className="text-sm text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: TIMELINE ════════ */}
        {activeTab === "timeline" && (
          <div className="max-w-3xl">
            {/* Stepper */}
            <div className="relative mb-10">
              {/* Connecting line */}
              <div className="absolute top-5 left-5 right-5 h-px bg-border" />
              <div className="flex justify-between relative">
                {PHASES.map((phase, idx) => {
                  const done    = currentPhaseIdx > idx;
                  const current = currentPhaseIdx === idx;
                  return (
                    <div key={phase.id} className="flex flex-col items-center gap-2 flex-1">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
                        done    ? "bg-gold border-gold text-bg-primary"
                        : current ? "bg-gold/10 border-gold text-gold"
                        : "bg-bg-secondary border-border text-text-muted"
                      }`}>
                        {done ? <Check size={14} /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                      </div>
                      <span className={`text-[9px] uppercase tracking-widest font-semibold text-center leading-tight ${current ? "text-gold" : done ? "text-text-secondary" : "text-text-muted"}`}>
                        {phase.label}
                      </span>
                      {current && <span className="text-[8px] text-gold/70 font-medium">{uiText("Ui.text_f4d865ae1b7722")}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date cards */}
            <div className="space-y-3 mb-6">
              {[
                { label: uiText("Ui.text_c82d8ceed809a7"), startKey: "prep_start",  endKey: "prep_end",   start: project.prep_start,  end: project.prep_end,  phase: "vorbereitung" },
                { label: uiText("Ui.text_a17ffec6cba8a3"),         startKey: "shoot_start", endKey: "shoot_end",  start: project.shoot_start, end: project.shoot_end, phase: "dreh"         },
                { label: uiText("menu.crewPost"),         startKey: "post_start",  endKey: "post_end",   start: project.post_start,  end: project.post_end,  phase: "postproduktion"},
              ].map(({ label: lbl, start, end, phase }) => {
                const s = DEPT_STYLES["Kamera"]; // reuse sky for dreh
                const phaseColors: Record<string, string> = {
                  vorbereitung: "border-blue-500/20 bg-blue-500/5",
                  dreh:         "border-red-500/20 bg-red-500/5",
                  postproduktion:"border-purple-500/20 bg-purple-500/5",
                };
                const labelColors: Record<string, string> = {
                  vorbereitung: "text-blue-300",
                  dreh:         "text-red-300",
                  postproduktion:"text-purple-300",
                };
                void s;
                return (
                  <div key={phase} className={`rounded-2xl border px-5 py-4 ${phaseColors[phase] ?? "border-border bg-bg-elevated"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-xs font-bold uppercase tracking-widest ${labelColors[phase] ?? "text-text-muted"}`}>{lbl}</span>
                      {(start || end) && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <Calendar size={12} className="text-text-muted" />
                          {formatDate(uiFormattingLocale, start) ?? "—"}
                          {end && <><span className="text-text-muted">→</span>{formatDate(uiFormattingLocale, end)}</>}
                        </div>
                      )}
                      {!start && !end && <span className="text-xs text-text-muted">{uiText("Ui.text_921283a6af83ee")}</span>}
                    </div>
                  </div>
                );
              })}

              {project.release_cinema && (
                <div className="rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">{uiText.rich("Ui.text_7fdad5ea12ef89", { part1: chunks => (<span className="text-xs font-bold uppercase tracking-widest text-gold">{chunks}</span>), value3: () => (project.release_cinema), part2: chunks => (<span className="text-sm text-text-secondary">{chunks}</span>) })}</div>
                </div>
              )}
            </div>

            {/* Edit dates */}
            {isCreator && !editingTimeline && (
              <button onClick={() => setEditingTimeline(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted border border-border rounded-xl hover:border-gold hover:text-gold transition-colors">{uiText.rich("Ui.text_589474e7c34e0a", { part1: () => (<Pencil size={13} />) })}</button>
            )}
            {editingTimeline && (
              <div className="p-5 bg-bg-secondary border border-gold/20 rounded-2xl space-y-4">
                <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_74548b97ccbc08")}</p>
                {[
                  { lbl: uiText("Ui.text_feb3a68aaa52bd"), key: "prep_start"  as const },
                  { lbl: uiText("Ui.text_877fd2196c8e3e"), key: "prep_end"    as const },
                  { lbl: uiText("Ui.text_b8e45623026be1"),         key: "shoot_start" as const },
                  { lbl: uiText("Ui.text_9b0bc94b8b1e63"),         key: "shoot_end"   as const },
                  { lbl: uiText("Ui.text_14bae3beaecfcc"),         key: "post_start"  as const },
                  { lbl: uiText("Ui.text_63106c09b22132"),         key: "post_end"    as const },
                ].reduce<{ lbl: string; key: keyof typeof timelineForm }[][]>((rows, item, i) => {
                  if (i % 2 === 0) rows.push([item]);
                  else rows[rows.length - 1].push(item);
                  return rows;
                }, []).map((pair, ri) => (
                  <div key={ri} className="grid grid-cols-2 gap-3">
                    {pair.map(({ lbl: l, key }) => (
                      <div key={uiDisplayLabels[key] ?? key}>
                        {label(l, true)}
                        <input type="date" value={timelineForm[key]} onChange={(e) => setTimelineForm((p) => ({ ...p, [key]: e.target.value }))} className={inp} />
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={handleSaveTimeline} disabled={savingTimeline} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">{uiText.rich("Ui.text_74c465184b036f", { value1: () => (savingTimeline ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />) })}</button>
                  <button onClick={() => leaveProjectForm(() => setEditingTimeline(false))} className="px-5 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ TAB: FESTIVALS & AWARDS ════════ */}
        {activeTab === "festivals" && (
          <div>
            {isCreator && (
              <div className="flex justify-end mb-5">
                <button onClick={() => setShowFestivalForm((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-gold/10 border border-gold/20 text-gold text-sm font-semibold rounded-xl hover:bg-gold/20 transition-colors">{uiText.rich("Ui.text_966c04b453b780", { part1: () => (<Plus size={14} />) })}</button>
              </div>
            )}
            {showFestivalForm && (
              <div className="mb-6 p-5 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
                <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_3b94618ffc3d16")}</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="col-span-2">{label(uiText("Ui.text_e8994798d7a096"))}<input type="text" value={festivalForm.festival_name} onChange={(e) => setFestivalForm((p) => ({ ...p, festival_name: e.target.value }))} placeholder={uiText("Ui.text_1a33eff994c1d5")} className={inp} autoFocus /></div>
                  <div>{label(uiText("Ui.text_5828cb15a8e584"))}<input type="number" value={festivalForm.year} onChange={(e) => setFestivalForm((p) => ({ ...p, year: e.target.value }))} className={inp} /></div>
                  <div>{label(uiText("Ui.text_ff498ea05d98b1"))}<select value={festivalForm.status} onChange={(e) => setFestivalForm((p) => ({ ...p, status: e.target.value }))} className={inp}>{Object.entries(FESTIVAL_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  <div>{label(uiText("Ui.text_e06d7d8e2cc715"), true)}<input type="text" value={festivalForm.section} onChange={(e) => setFestivalForm((p) => ({ ...p, section: e.target.value }))} placeholder={uiText("Ui.text_869fe7250e3ab9")} className={inp} /></div>
                  <div>{label(uiText("Ui.text_2f69d9f0a08abb"), true)}<input type="text" value={festivalForm.award_name} onChange={(e) => setFestivalForm((p) => ({ ...p, award_name: e.target.value }))} placeholder={uiText("Ui.text_709efb093eb1c9")} className={inp} /></div>
                  <div className="col-span-3 sm:col-span-1">{label(uiText("Ui.text_c5939cb300d228"), true)}<input type="text" value={festivalForm.notes} onChange={(e) => setFestivalForm((p) => ({ ...p, notes: e.target.value }))} className={inp} /></div>
                </div>
                {festivalError && <p className="text-xs text-crimson-light">{festivalError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleAddFestival} disabled={savingFestival || !festivalForm.festival_name.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">{uiText.rich("Ui.text_74c465184b036f", { value1: () => (savingFestival ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />) })}</button>
                  <button onClick={() => { setShowFestivalForm(false); setFestivalForm(EMPTY_FESTIVAL_FORM); }} className="px-5 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
                </div>
              </div>
            )}
            {festivals.length === 0 ? (
              <div className="text-center py-20 text-text-muted">
                <Award size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm mb-1">{uiText("Ui.text_4076b36a280951")}</p>
                {isCreator && <p className="text-xs opacity-60">{uiText("Ui.text_8d2d7d782225a9")}</p>}
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_1fr_auto] px-5 py-2.5 bg-bg-elevated border-b border-border gap-4">{uiText.rich("Ui.text_accf35dd0a1ab4", { part1: chunks => (<span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">{chunks}</span>), part2: chunks => (<span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">{chunks}</span>), part3: chunks => (<span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">{chunks}</span>), part4: () => (<span className="w-6" />) })}</div>
                {Array.from(new Set(festivals.map((f) => f.year))).map((year) => (
                  <div key={year}>
                    <div className="px-5 py-1.5 bg-bg-elevated/50 border-t border-border">
                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{year}</span>
                    </div>
                    {festivals.filter((f) => f.year === year).map((entry) => {
                      const sm = FESTIVAL_STATUS_META[entry.status] ?? FESTIVAL_STATUS_META["eingereicht"];
                      const FIcon = sm.Icon;
                      return (
                        <div key={entry.id} className="grid grid-cols-[1fr_2fr_1fr_auto] px-5 py-3 border-t border-border/30 hover:bg-bg-elevated/30 transition-colors items-center gap-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full border w-fit ${sm.color}`}><FIcon size={9} />{sm.label}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate font-medium">{entry.festival_name}</p>
                            {entry.section && <p className="text-xs text-text-muted truncate">{entry.section}</p>}
                            {entry.notes && <p className="text-xs text-text-muted truncate italic">{entry.notes}</p>}
                          </div>
                          <div className="min-w-0">
                            {entry.award_name
                              ? <span className="flex items-center gap-1 text-xs text-gold truncate"><Trophy size={10} />{entry.award_name}</span>
                              : <span className="text-xs text-text-muted">—</span>
                            }
                          </div>
                          {isCreator && (
                            <button onClick={() => handleDeleteFestival(entry.id)} className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors rounded-lg hover:bg-crimson-light/10">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ TAB: DISTRIBUTION ════════ */}
        {activeTab === "distribution" && (
          <div className="max-w-2xl space-y-8">

            {/* Kino */}
            <section>
              <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4 flex items-center gap-2">{uiText.rich("Ui.text_074932276ee179", { part1: () => (<Film size={13} />) })}</h2>
              {project.release_cinema ? (
                <div className="flex items-center gap-4 px-5 py-3.5 bg-bg-elevated border border-border rounded-2xl">
                  <MapPin size={14} className="text-text-muted shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-widest mb-0.5">{uiText("Ui.text_c4b831169af33c")}</p>
                    <p className="text-sm text-text-primary">{project.release_cinema}</p>
                    {project.release_cinema_countries && <p className="text-xs text-text-muted mt-0.5">{project.release_cinema_countries.join(", ")}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{uiText.rich("Ui.text_773c583e66c1cc", { value1: () => (isCreator && uiText("Ui.text_c87bdaf5675c62")) })}</p>
              )}
            </section>

            {/* Streaming */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold flex items-center gap-2">{uiText.rich("Ui.text_2e9d385349f0b4", { part1: () => (<Play size={13} />) })}</h2>
                {isCreator && (
                  <button onClick={() => setShowStreamingForm((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gold border border-gold/20 rounded-lg hover:bg-gold/10 transition-colors">{uiText.rich("Ui.text_d8c2126e8d292f", { part1: () => (<Plus size={11} />) })}</button>
                )}
              </div>
              {showStreamingForm && (
                <div className="mb-4 p-4 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>{label(uiText("Ui.text_3a0b7b15fe22f9"))}<select value={streamingForm.platform} onChange={(e) => setStreamingForm((p) => ({ ...p, platform: e.target.value }))} className={inp}>{STREAMING_PLATFORMS.map((pl) => <option key={pl} value={pl}>{(uiOptionLabels[pl] ?? pl)}</option>)}</select></div>
                    <div>{label(uiText("Ui.text_e32866ef0460fe"))}<input type="text" value={streamingForm.date} onChange={(e) => setStreamingForm((p) => ({ ...p, date: e.target.value }))} placeholder={uiText("Ui.text_62ec6bcc2ccb10")} className={inp} /></div>
                    <div>{label(uiText("Ui.text_397fcbd5025b73"), true)}<input type="text" value={streamingForm.territory} onChange={(e) => setStreamingForm((p) => ({ ...p, territory: e.target.value }))} placeholder={uiText("Ui.text_1fd5260dd29fb5")} className={inp} /></div>
                    <div>{label(uiText("Ui.text_a6a32dbc5618ea"), true)}<input type="url" value={streamingForm.url} onChange={(e) => setStreamingForm((p) => ({ ...p, url: e.target.value }))} placeholder={uiText("Ui.text_e98a62ef23bb46")} className={inp} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddStreaming} disabled={savingStreaming || !streamingForm.date} className="min-h-11 flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">{uiText.rich("Ui.text_74c465184b036f", { value1: () => (savingStreaming ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />) })}</button>
                    <button onClick={() => { setShowStreamingForm(false); setStreamingForm(EMPTY_STREAMING_FORM); }} className="min-h-11 px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
                  </div>
                </div>
              )}
              {streamingList.length === 0 ? (
                <p className="text-sm text-text-muted">{uiText("Ui.text_73a6d1c37e191e")}</p>
              ) : (
                <div className="space-y-2">
                  {streamingList.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 bg-bg-elevated border border-border rounded-xl group">
                      <Globe size={14} className="text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{s.platform}</p>
                        <p className="text-xs text-text-muted">{s.date}{s.territory && uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(s.territory) })}</p>
                      </div>
                      {safeLink(s.url) && (
                        <a href={safeLink(s.url)!} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-gold transition-colors"><ExternalLink size={13} /></a>
                      )}
                      {isCreator && (
                        <button onClick={() => handleRemoveStreaming(i)} className="min-h-11 min-w-11 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors"><X size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* TV */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold flex items-center gap-2">{uiText.rich("Ui.text_a46e8a2ad89fe3", { part1: () => (<Tv size={13} />) })}</h2>
                {isCreator && (
                  <button onClick={() => setShowTvForm((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gold border border-gold/20 rounded-lg hover:bg-gold/10 transition-colors">{uiText.rich("Ui.text_db6c72924e2dd4", { part1: () => (<Plus size={11} />) })}</button>
                )}
              </div>
              {showTvForm && (
                <div className="mb-4 p-4 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>{label(uiText("Ui.text_2968141c6eb9c6"))}<input type="text" value={tvForm.channel} onChange={(e) => setTvForm((p) => ({ ...p, channel: e.target.value }))} placeholder={uiText("Ui.text_54613321ec252b")} className={inp} /></div>
                    <div>{label(uiText("Ui.text_e32866ef0460fe"))}<input type="text" value={tvForm.date} onChange={(e) => setTvForm((p) => ({ ...p, date: e.target.value }))} placeholder={uiText("Ui.text_bd1ea0fa0a680e")} className={inp} /></div>
                    <div>{label(uiText("Ui.text_397fcbd5025b73"), true)}<input type="text" value={tvForm.territory} onChange={(e) => setTvForm((p) => ({ ...p, territory: e.target.value }))} placeholder={uiText("profile.fieldCountryPlaceholder")} className={inp} /></div>
                    <div>{label(uiText("Ui.text_c5939cb300d228"), true)}<input type="text" value={tvForm.notes} onChange={(e) => setTvForm((p) => ({ ...p, notes: e.target.value }))} placeholder={uiText("Ui.text_7ab41874303696")} className={inp} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddTv} disabled={savingTv || !tvForm.channel || !tvForm.date} className="min-h-11 flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">{uiText.rich("Ui.text_74c465184b036f", { value1: () => (savingTv ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />) })}</button>
                    <button onClick={() => { setShowTvForm(false); setTvForm(EMPTY_TV_FORM); }} className="min-h-11 px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-colors">{uiText("home.boardCancel")}</button>
                  </div>
                </div>
              )}
              {tvList.length === 0 ? (
                <p className="text-sm text-text-muted">{uiText("Ui.text_8274019e59c280")}</p>
              ) : (
                <div className="space-y-2">
                  {tvList.map((t, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 bg-bg-elevated border border-border rounded-xl group">
                      <Tv size={14} className="text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{t.channel}</p>
                        <p className="text-xs text-text-muted">{t.date}{t.territory && uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(t.territory) })}{t.notes && uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(t.notes) })}</p>
                      </div>
                      {isCreator && (
                        <button onClick={() => handleRemoveTv(i)} className="min-h-11 min-w-11 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors"><X size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Trailer */}
            {(safeLink(project.trailer_url) || safeLink(project.teaser_url)) && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4 flex items-center gap-2">{uiText.rich("Ui.text_967b1025217807", { part1: () => (<Play size={13} />) })}</h2>
                <div className="flex flex-wrap gap-3">
                  {safeLink(project.trailer_url) && (
                    <a href={safeLink(project.trailer_url)!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">{uiText.rich("Ui.text_9ff455704e8f49", { part1: () => (<Play size={13} />), part2: () => (<ExternalLink size={10} className="text-text-muted" />) })}</a>
                  )}
                  {safeLink(project.teaser_url) && (
                    <a href={safeLink(project.teaser_url)!} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">{uiText.rich("Ui.text_c5758ffda79baa", { part1: () => (<Play size={13} />), part2: () => (<ExternalLink size={10} className="text-text-muted" />) })}</a>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={project.images}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(project.images.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  );
}
