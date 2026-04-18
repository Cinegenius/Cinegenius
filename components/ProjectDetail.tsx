"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Clapperboard, Calendar, Users, Upload,
  Plus, X, Check, Loader2, Pencil, Save, ImageIcon,
  Film, Info, ExternalLink, Trophy, Award,
  UserRound, Megaphone, BookOpen, Briefcase, Video,
  Lightbulb, Wrench, Mic, Monitor, Shirt, Palette,
  Zap, Music2, Camera, Truck, Globe, Tv, Send, Star,
  Play, MapPin, ChevronDown, Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Lightbox from "@/components/Lightbox";
import RoleDropdown from "@/components/RoleDropdown";

type Credit = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile: {
    display_name: string;
    avatar_url: string | null;
    role: string | null;
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
  id: string;
  title: string;
  alt_title?: string | null;
  year: number | null;
  type: string | null;
  description: string | null;
  director: string | null;
  poster_url: string | null;
  images: string[];
  created_by: string | null;
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

// ─── Department mapping ───────────────────────────────────────────────────────
const DEPT_ORDER = [
  "Besetzung", "Regie", "Drehbuch", "Produktion", "Kamera", "Licht", "Ton",
  "Schnitt & Post", "Kostüm & Maske", "Szenenbild", "Stunts", "Musik",
  "Foto & Making-of", "Catering & Logistik", "Sonstiges",
];

const DEPT_MATCHERS: { name: string; regex: RegExp }[] = [
  { name: "Besetzung",          regex: /darstell|actor|actrice|schauspiel|hauptrolle|nebenrolle|statist|sprecher|synchron|cast/i },
  { name: "Regie",              regex: /regisseur|^regie$|regie[^a]|director(?!\s+of\s+photo)|1\.\s*ad|2\.\s*ad|assistenzregie|continuity|script\s+superv/i },
  { name: "Drehbuch",           regex: /drehbuch|autor|autorin|screenwriter|story|storyboard/i },
  { name: "Produktion",         regex: /produz|producer|produktionsleitung|produktionsassistenz|aufnahmeleitung|line\s*prod|koordinat|casting(?!\s+darstell)/i },
  { name: "Kamera",             regex: /kamera|camera|director\s+of\s+photo|dop|^dp$|focus\s*pull|dit|steadicam|drohn|crane\s*op/i },
  { name: "Licht",              regex: /licht|gaffer|beleuchter|best\s*boy|oberbeleuchter|lichtassistenz|rigging/i },
  { name: "Ton",                regex: /ton(?!set)|sound|audio|boom|mischer|tonmeister|tonassistenz/i },
  { name: "Schnitt & Post",     regex: /editor|schnitt|cutter|colorist|farb|vfx|composit|motion\s*graph|postprod|post\s+prod|grading/i },
  { name: "Kostüm & Maske",     regex: /kostüm|kostuen|costume|garderob|maske|makeup|make.up|haare?stylist/i },
  { name: "Szenenbild",         regex: /szenenbild|ausstatt|set\s*design|requisi|props|art\s*direct|dekorat|bühnenbild/i },
  { name: "Stunts",             regex: /stunt|action\s*coord|kampfchoreograf/i },
  { name: "Musik",              regex: /musik|komponist|composer|music\s*superv/i },
  { name: "Foto & Making-of",   regex: /still\s*photo|making.of|behind\s*the\s*scene|set\s*photo|epk/i },
  { name: "Catering & Logistik",regex: /catering|fahrer|transport|logistik|location\s*scout/i },
];

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

const PHASES: { id: string; label: string; dateFields?: [keyof Project, keyof Project] }[] = [
  { id: "entwicklung",    label: "Entwicklung" },
  { id: "finanzierung",   label: "Finanzierung" },
  { id: "vorbereitung",   label: "Vorbereitung", dateFields: ["prep_start",  "prep_end"]  },
  { id: "dreh",           label: "Dreh",         dateFields: ["shoot_start", "shoot_end"] },
  { id: "postproduktion", label: "Post",         dateFields: ["post_start",  "post_end"]  },
  { id: "fertiggestellt", label: "Fertig" },
  { id: "veroeffentlicht",label: "Release" },
];

const PHASE_INDEX: Record<string, number> = Object.fromEntries(PHASES.map((p, i) => [p.id, i]));

const STATUS_META: Record<string, { label: string; color: string; pulse: boolean }> = {
  "entwicklung":     { label: "In Entwicklung",  color: "bg-slate-500/15 text-slate-300 border-slate-500/30",   pulse: false },
  "finanzierung":    { label: "Finanzierung",     color: "bg-amber-500/15 text-amber-300 border-amber-500/30",   pulse: false },
  "vorbereitung":    { label: "Vorbereitung",     color: "bg-blue-500/15 text-blue-300 border-blue-500/30",      pulse: false },
  "dreh":            { label: "Im Dreh",          color: "bg-red-500/15 text-red-400 border-red-500/30",         pulse: true  },
  "postproduktion":  { label: "Post-Produktion",  color: "bg-purple-500/15 text-purple-300 border-purple-500/30",pulse: false },
  "fertiggestellt":  { label: "Fertiggestellt",   color: "bg-green-500/15 text-green-300 border-green-500/30",   pulse: false },
  "veroeffentlicht": { label: "Veröffentlicht",   color: "bg-gold/15 text-gold border-gold/30",                  pulse: false },
};

const FESTIVAL_STATUS_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  "eingereicht":       { label: "Eingereicht",        color: "bg-slate-500/15 text-slate-300 border-slate-500/30",  Icon: Send   },
  "offiziell":         { label: "Offizielle Auswahl", color: "bg-blue-500/15 text-blue-300 border-blue-500/30",    Icon: Check  },
  "nominiert":         { label: "Nominiert",           color: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Star   },
  "gewonnen":          { label: "Gewonnen",            color: "bg-gold/15 text-gold border-gold/30",                Icon: Trophy },
  "nicht_ausgewaehlt": { label: "Nicht ausgewählt",   color: "bg-border text-text-muted border-border",            Icon: X      },
};

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

function getDepartment(role: string): string {
  for (const m of DEPT_MATCHERS) {
    if (m.regex.test(role)) return m.name;
  }
  return "Sonstiges";
}

function groupCredits(credits: Credit[]): { dept: string; members: Credit[] }[] {
  const map = new Map<string, Credit[]>();
  for (const c of credits) {
    const dept = getDepartment(c.role);
    if (!map.has(dept)) map.set(dept, []);
    map.get(dept)!.push(c);
  }
  return [...map.entries()]
    .sort(([a], [b]) => DEPT_ORDER.indexOf(a) - DEPT_ORDER.indexOf(b))
    .map(([dept, members]) => ({ dept, members }));
}

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }); }
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
  myCredit: initialMyCredit,
  userPositions = [],
}: {
  project: Project;
  credits: Credit[];
  festivals: FestivalEntry[];
  currentUserId: string | null;
  myCredit: Credit | null;
  userPositions?: string[];
}) {
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
  const [showJoin, setShowJoin] = useState(false);

  // Header edit
  const [uploadingPoster, setUploadingPoster] = useState(false);
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
  const [uploading, setUploading] = useState(false);
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

  const isCreator = currentUserId === project.created_by;
  const isLoggedIn = !!currentUserId;
  const typeColor = project.type ? (TYPE_COLORS[project.type] ?? "bg-gold/10 text-gold border-gold/20") : "";
  const statusMeta = project.status ? STATUS_META[project.status] : null;
  const grouped = groupCredits(credits);
  const wonCount = festivals.filter((f) => f.status === "gewonnen").length;
  const currentPhaseIdx = project.status ? (PHASE_INDEX[project.status] ?? -1) : -1;
  const streamingList: StreamingRelease[] = project.release_streaming ?? [];
  const tvList: TvRelease[] = project.release_tv ?? [];

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const uploadPoster = async (file: File) => {
    setUploadingPoster(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) return;
      await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poster_url: data.url }) });
      setProject((p) => ({ ...p, poster_url: data.url }));
    } finally { setUploadingPoster(false); }
  };

  const handleJoin = async () => {
    if (!joinRole.trim()) return;
    setJoining(true); setJoinError("");
    try {
      const roleValue = [
        joinCharacter.trim() ? `${joinRole.trim()} — ${joinCharacter.trim()}` : joinRole.trim(),
        joinNote.trim() ? `||${joinNote.trim()}` : "",
      ].join("");
      const res = await fetch("/api/project-credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: project.id, role: roleValue }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const r2 = await fetch(`/api/projects/${project.id}`);
      const d2 = await r2.json();
      setCredits(d2.credits);
      setMyCredit(d2.credits.find((c: Credit) => c.user_id === currentUserId) ?? null);
      setShowJoin(false); setJoinRole(""); setJoinCharacter(""); setJoinNote("");
    } catch (e: unknown) { setJoinError(e instanceof Error ? e.message : "Fehler"); }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    if (!confirm("Aus diesem Projekt austragen?")) return;
    await fetch(`/api/project-credits?project_id=${project.id}`, { method: "DELETE" });
    setMyCredit(null);
    setCredits((prev) => prev.filter((c) => c.user_id !== currentUserId));
  };

  const handleSaveEdit = async () => {
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
    const res = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (res.ok) { setProject((p) => ({ ...p, ...patch })); setEditing(false); }
    setSaving(false);
  };

  const handleSaveTimeline = async () => {
    setSavingTimeline(true);
    const patch = {
      prep_start:  timelineForm.prep_start  || null,
      prep_end:    timelineForm.prep_end    || null,
      shoot_start: timelineForm.shoot_start || null,
      shoot_end:   timelineForm.shoot_end   || null,
      post_start:  timelineForm.post_start  || null,
      post_end:    timelineForm.post_end    || null,
    };
    const res = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (res.ok) { setProject((p) => ({ ...p, ...patch })); setEditingTimeline(false); }
    setSavingTimeline(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const { url } = await r.json();
      if (url) uploaded.push(url);
    }
    if (uploaded.length > 0) {
      const newImages = [...project.images, ...uploaded];
      await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: newImages }) });
      setProject((p) => ({ ...p, images: newImages }));
    }
    setUploading(false);
  };

  const removePhoto = async (url: string) => {
    const newImages = project.images.filter((i) => i !== url);
    await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: newImages }) });
    setProject((p) => ({ ...p, images: newImages }));
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
    } catch (e: unknown) { setFestivalError(e instanceof Error ? e.message : "Fehler"); }
    finally { setSavingFestival(false); }
  };

  const handleDeleteFestival = async (id: string) => {
    if (!confirm("Eintrag löschen?")) return;
    await fetch(`/api/project-festivals/${id}`, { method: "DELETE" });
    setFestivals((prev) => prev.filter((f) => f.id !== id));
  };

  const patchDistribution = async (patch: Partial<Project>) => {
    await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setProject((p) => ({ ...p, ...patch }));
  };

  const handleAddStreaming = async () => {
    if (!streamingForm.platform || !streamingForm.date) return;
    setSavingStreaming(true);
    const entry: StreamingRelease = { platform: streamingForm.platform, date: streamingForm.date, url: streamingForm.url || null, territory: streamingForm.territory || null };
    const updated = [...streamingList, entry];
    await patchDistribution({ release_streaming: updated });
    setShowStreamingForm(false); setStreamingForm(EMPTY_STREAMING_FORM);
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
    await patchDistribution({ release_tv: updated });
    setShowTvForm(false); setTvForm(EMPTY_TV_FORM);
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
      {txt}{opt && <span className="normal-case font-normal ml-1">(optional)</span>}
    </label>
  );

  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-6xl mx-auto px-4 py-10">

        <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mb-8">
          <ArrowLeft size={13} /> Alle Projekte
        </Link>

        {/* ════════ HEADER ════════ */}
        <div className="flex gap-8 mb-10 flex-col sm:flex-row">
          {/* Poster */}
          <div className="shrink-0 w-40 sm:w-48">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-bg-secondary border border-border shadow-2xl shadow-black/40 flex items-center justify-center">
              {project.poster_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={project.poster_url} alt={project.title} className="w-full h-full object-cover object-top" />
                : isCreator
                  ? <label className="flex flex-col items-center gap-2 text-text-muted cursor-pointer hover:text-gold transition-colors w-full h-full justify-center">
                      {uploadingPoster ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                      <span className="text-[10px] text-center px-2">{uploadingPoster ? "Wird hochgeladen…" : "Poster hochladen"}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingPoster} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPoster(f); }} />
                    </label>
                  : <div className="flex flex-col items-center gap-2 text-text-muted"><Clapperboard size={32} /></div>
              }
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editing
                  ? <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="font-display text-3xl sm:text-4xl font-bold bg-bg-secondary border border-gold rounded-xl px-4 py-2 w-full focus:outline-none mb-3" />
                  : <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3 leading-tight">{project.title}</h1>
                }
                <div className="flex items-center gap-2.5 flex-wrap mb-4">
                  {project.type && <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${typeColor}`}>{project.type}</span>}
                  {project.year && <span className="flex items-center gap-1.5 text-sm text-text-muted"><Calendar size={14} />{project.year}</span>}
                  {statusMeta && (
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${statusMeta.color}`}>
                      {statusMeta.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                      {statusMeta.label}
                    </span>
                  )}
                  {wonCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border bg-gold/15 text-gold border-gold/30">
                      <Trophy size={11} /> {wonCount} Award{wonCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              {isCreator && !editing && (
                <button onClick={() => setEditing(true)} className="p-2 text-text-muted hover:text-gold transition-colors shrink-0">
                  <Pencil size={15} />
                </button>
              )}
            </div>

            {/* Meta */}
            <div className="space-y-2 mb-5">
              {[
                { key: "Regie",   val: project.director },
                { key: "Crew",    val: `${credits.length} Personen eingetragen` },
                { key: "Fotos",   val: project.images.length > 0 ? `${project.images.length} Fotos` : null },
                { key: "Logline", val: project.logline },
              ].filter((r) => r.val).map(({ key, val }) => (
                <div key={key} className="flex items-baseline gap-3">
                  <span className="text-xs uppercase tracking-widest text-text-muted font-semibold w-20 shrink-0">{key}</span>
                  <span className="text-sm text-text-secondary">{val}</span>
                </div>
              ))}
            </div>

            {!editing && project.description && (
              <p className="text-sm text-text-secondary leading-relaxed max-w-xl border-t border-border pt-4">{project.description}</p>
            )}

            {/* Edit form */}
            {editing && (
              <div className="space-y-3 mt-3 pt-3 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>{label("Jahr")}<input type="number" value={editForm.year} onChange={(e) => setEditForm((p) => ({ ...p, year: e.target.value }))} placeholder="2024" className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label("Typ")}<select value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"><option value="">—</option>{["Spielfilm","Kurzfilm","Serie","Dokumentation","Werbefilm","Musikvideo","Corporate"].map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div>{label("Status")}<select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold"><option value="">—</option>{Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  <div>{label("Regie")}<input type="text" value={editForm.director} onChange={(e) => setEditForm((p) => ({ ...p, director: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label("Produktionsfirma")}<input type="text" value={editForm.production_company} onChange={(e) => setEditForm((p) => ({ ...p, production_company: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label("Laufzeit (Min)")}<input type="number" value={editForm.runtime_minutes} onChange={(e) => setEditForm((p) => ({ ...p, runtime_minutes: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div className="col-span-2">{label("Logline")}<input type="text" value={editForm.logline} onChange={(e) => setEditForm((p) => ({ ...p, logline: e.target.value }))} placeholder="Ein Satz, der den Film beschreibt" className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div className="col-span-2">{label("Beschreibung / Synopsis")}<textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none" /></div>
                  <div>{label("Kinostart")}<input type="text" value={editForm.release_cinema} onChange={(e) => setEditForm((p) => ({ ...p, release_cinema: e.target.value }))} placeholder="z.B. 15. März 2025" className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                  <div>{label("Trailer URL")}<input type="url" value={editForm.trailer_url} onChange={(e) => setEditForm((p) => ({ ...p, trailer_url: e.target.value }))} placeholder="https://youtube.com/..." className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Speichern
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
                </div>
              </div>
            )}

            {/* CTA */}
            {!editing && (
              <div className="flex gap-3 mt-5 flex-wrap">
                {isLoggedIn && !myCredit && (
                  <button onClick={() => setShowJoin(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors">
                    <Plus size={14} /> Ich war dabei
                  </button>
                )}
                {myCredit && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gold/10 border border-gold/20 rounded-xl">
                    <Check size={14} className="text-gold" />
                    <span className="text-sm text-gold font-medium">Eingetragen als <strong>{myCredit.role}</strong></span>
                    <button onClick={handleLeave} className="text-xs text-text-muted hover:text-crimson-light transition-colors ml-2">Austragen</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Join form */}
        {showJoin && !myCredit && (
          <div className="mb-8 p-5 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
            <p className="text-sm font-semibold text-text-primary">Deine Rolle bei &quot;{project.title}&quot;</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>{label("Tätigkeit / Rolle *")}
                <RoleDropdown value={joinRole} onChange={setJoinRole} options={userPositions} />
              </div>
              <div>{label("Figur", true)}<input type="text" value={joinCharacter} onChange={(e) => setJoinCharacter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder="z.B. Max Mustermann..." className={inp} /></div>
              <div>{label("Anmerkung", true)}<input type="text" value={joinNote} onChange={(e) => setJoinNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder="z.B. nur Ibiza-Drehtage..." className={inp} /></div>
            </div>
            {joinError && <p className="text-xs text-crimson-light">{joinError}</p>}
            <div className="flex gap-2">
              <button onClick={handleJoin} disabled={joining || !joinRole.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">
                {joining ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Eintragen
              </button>
              <button onClick={() => { setShowJoin(false); setJoinRole(""); setJoinCharacter(""); setJoinNote(""); }} className="px-5 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
            </div>
          </div>
        )}

        {/* ════════ TABS ════════ */}
        <div className="border-b border-border mb-8">
          <div className="flex gap-0 overflow-x-auto">
            {([
              { id: "stab",         label: "Besetzung & Stab",  icon: Users,    count: credits.length },
              { id: "fotos",        label: "Fotos",              icon: ImageIcon,count: project.images.length },
              { id: "uebersicht",   label: "Übersicht",          icon: Info,     count: null },
              { id: "timeline",     label: "Timeline",           icon: Calendar, count: null },
              { id: "festivals",    label: "Festivals & Awards", icon: Trophy,   count: festivals.length || null },
              { id: "distribution", label: "Distribution",       icon: Globe,    count: null },
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

        {/* ════════ TAB: BESETZUNG & STAB ════════ */}
        {activeTab === "stab" && (
          <div>
            {credits.length === 0 ? (
              <div className="text-center py-20 text-text-muted">
                <Users size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm mb-1">Noch keine Crew eingetragen</p>
                <p className="text-xs opacity-60">Klicke auf &quot;Ich war dabei&quot; um dich einzutragen</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.filter(({ dept }) => dept === "Besetzung").map(({ members }) => (
                  <div key="besetzung" className="rounded-2xl border border-rose-500/15 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-5 py-2 bg-rose-500/8 border-b border-rose-500/15">
                      <span className="w-1 h-4 rounded-full bg-rose-400 shrink-0" />
                      <UserRound size={12} className="text-rose-300" />
                      <span className="text-xs font-bold uppercase tracking-widest text-rose-300">Besetzung</span>
                      <span className="ml-1 text-[10px] text-text-muted bg-bg-secondary border border-border/60 px-1.5 py-0.5 rounded-full">{members.length}</span>
                    </div>
                    {members.map((credit) => {
                      const [roleAndChar, note] = credit.role.split("||");
                      const [roleLabel, characterName] = (roleAndChar ?? "").split(" — ");
                      const badge = /hauptdarstell|hauptrolle/i.test(roleLabel) ? { text: "HR", cls: "bg-gold/15 text-gold border-gold/30" }
                        : /nebendarstell|nebenrolle/i.test(roleLabel) ? { text: "NR", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" }
                        : /statist|komparse|extra/i.test(roleLabel) ? { text: "ST", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" }
                        : /stunt/i.test(roleLabel) ? { text: "SX", cls: "bg-red-500/15 text-red-300 border-red-500/30" }
                        : /sprecher|voice/i.test(roleLabel) ? { text: "VO", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" }
                        : null;
                      return (
                        <div key={credit.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-border/30 hover:bg-rose-500/4 transition-colors">
                          {badge
                            ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 w-8 text-center ${badge.cls}`}>{badge.text}</span>
                            : <span className="text-[10px] text-text-muted shrink-0 w-8 truncate text-center" title={roleLabel}>{roleLabel?.substring(0, 3).toUpperCase()}</span>
                          }
                          <Link href={`/creators/${credit.user_id}`} className="flex items-center gap-2 min-w-0 flex-1 group/link">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-elevated border border-border shrink-0">
                              {credit.profile?.avatar_url
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={credit.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center bg-rose-500/10"><span className="text-[8px] font-bold text-rose-300">{(credit.profile?.display_name ?? "?").charAt(0).toUpperCase()}</span></div>
                              }
                            </div>
                            <span className="text-sm text-text-primary group-hover/link:text-rose-300 transition-colors truncate">{credit.profile?.display_name ?? "Unbekannt"}</span>
                            <ExternalLink size={10} className="text-text-muted shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </Link>
                          {characterName
                            ? <span className="text-xs text-rose-400/80 shrink-0 truncate max-w-[140px]">als {characterName}</span>
                            : <span className="w-[140px] shrink-0" />
                          }
                          <span className="text-xs text-text-muted shrink-0 truncate max-w-[120px] text-right">{note ?? ""}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {grouped.filter(({ dept }) => dept !== "Besetzung").length > 0 && (
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <div className="grid grid-cols-[1fr_1.5fr_1fr] px-5 py-2.5 bg-bg-elevated border-b border-border">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Tätigkeit</span>
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Name</span>
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Anmerkung</span>
                    </div>
                    {grouped.filter(({ dept }) => dept !== "Besetzung").map(({ dept, members }) => {
                      const s = DEPT_STYLES[dept] ?? DEPT_STYLES["Sonstiges"];
                      const Icon = s.icon;
                      return (
                        <div key={dept}>
                          <div className={`flex items-center gap-2.5 px-5 py-2 border-t border-border ${s.bg}`}>
                            <span className={`w-1 h-4 rounded-full shrink-0 ${s.bar}`} />
                            <Icon size={12} className={s.label} />
                            <span className={`text-xs font-bold uppercase tracking-widest ${s.label}`}>{dept}</span>
                            <span className="ml-1 text-[10px] text-text-muted bg-bg-secondary border border-border/60 px-1.5 py-0.5 rounded-full">{members.length}</span>
                          </div>
                          {members.map((credit) => {
                            const [roleLabel, note] = credit.role.split("||");
                            return (
                              <div key={credit.id} className="grid grid-cols-[1fr_1.5fr_1fr] px-5 py-2.5 border-t border-border/30 hover:bg-bg-elevated/40 transition-colors items-center">
                                <span className="text-xs text-text-muted truncate pr-4">{roleLabel}</span>
                                <Link href={`/creators/${credit.user_id}`} className="flex items-center gap-2.5 min-w-0 group/link">
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-elevated border border-border shrink-0">
                                    {credit.profile?.avatar_url
                                      // eslint-disable-next-line @next/next/no-img-element
                                      ? <img src={credit.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                      : <div className="w-full h-full flex items-center justify-center bg-gold/10"><span className="text-[8px] font-bold text-gold">{(credit.profile?.display_name ?? "?").charAt(0).toUpperCase()}</span></div>
                                    }
                                  </div>
                                  <span className="text-sm text-text-primary group-hover/link:text-gold transition-colors truncate">{credit.profile?.display_name ?? "Unbekannt"}</span>
                                  <ExternalLink size={10} className="text-text-muted shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity ml-0.5" />
                                </Link>
                                <span className="text-xs text-text-muted truncate pl-2">{note ?? ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════ TAB: FOTOS ════════ */}
        {activeTab === "fotos" && (
          <div>
            {isCreator && (
              <div className="flex justify-end mb-5">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-gold/10 border border-gold/20 text-gold text-sm font-semibold rounded-xl hover:bg-gold/20 transition-colors cursor-pointer">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Wird hochgeladen..." : "Fotos hochladen"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            )}
            {project.images.length === 0 ? (
              <div className="text-center py-20">
                <Film size={40} className="mx-auto mb-4 text-text-muted opacity-20" />
                <p className="text-sm text-text-muted">{isCreator ? "Lade Set-Fotos, Stills oder Behind-the-Scenes-Bilder hoch" : "Noch keine Fotos vorhanden"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {project.images.map((url, i) => (
                  <div key={url} className="relative group aspect-video rounded-xl overflow-hidden border border-border cursor-pointer" onClick={() => setLightboxIndex(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon size={20} className="text-white" /></div>
                    {isCreator && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removePhoto(url); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-crimson-light">
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
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-2">Logline</h2>
                <p className="text-text-secondary italic leading-relaxed border-l-2 border-gold/30 pl-4">{project.logline}</p>
              </div>
            )}
            {(project.synopsis || project.description) && (
              <div>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Synopsis</h2>
                <p className="text-text-secondary leading-relaxed">{project.synopsis ?? project.description}</p>
              </div>
            )}
            {!project.synopsis && !project.description && !project.logline && (
              <p className="text-text-muted text-sm">Noch keine Beschreibung vorhanden.{isCreator && " Klicke auf ✎ um eine hinzuzufügen."}</p>
            )}
            {project.trailer_url && (
              <div>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">Trailer</h2>
                <a href={project.trailer_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                  <Play size={14} /> Trailer ansehen <ExternalLink size={11} className="text-text-muted" />
                </a>
              </div>
            )}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4">Projektdetails</h2>
              <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                {[
                  { lbl: "Originaltitel",    val: project.title },
                  { lbl: "Alternativtitel",  val: project.alt_title },
                  { lbl: "Produktionsjahr",  val: project.year },
                  { lbl: "Format",           val: project.type },
                  { lbl: "Status",           val: project.status ? STATUS_META[project.status]?.label : null },
                  { lbl: "Genres",           val: project.genres?.join(", ") },
                  { lbl: "Sprache",          val: project.language },
                  { lbl: "Land",             val: project.country },
                  { lbl: "Laufzeit",         val: project.runtime_minutes ? `${project.runtime_minutes} Min.` : null },
                  { lbl: "Regie",            val: project.director },
                  { lbl: "Produktionsfirma", val: project.production_company },
                  { lbl: "Co-Produzenten",   val: project.co_producers?.join(", ") },
                  { lbl: "Locations",         val: project.shoot_locations?.join(", ") },
                  { lbl: "Kinostart",        val: project.release_cinema },
                  { lbl: "Crew-Mitglieder",  val: `${credits.length} eingetragene Personen` },
                  { lbl: "Fotos",            val: `${project.images.length} Fotos` },
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
                      {current && <span className="text-[8px] text-gold/70 font-medium">Aktuell</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date cards */}
            <div className="space-y-3 mb-6">
              {[
                { label: "Vorbereitung", startKey: "prep_start",  endKey: "prep_end",   start: project.prep_start,  end: project.prep_end,  phase: "vorbereitung" },
                { label: "Dreh",         startKey: "shoot_start", endKey: "shoot_end",  start: project.shoot_start, end: project.shoot_end, phase: "dreh"         },
                { label: "Post",         startKey: "post_start",  endKey: "post_end",   start: project.post_start,  end: project.post_end,  phase: "postproduktion"},
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
                          {formatDate(start) ?? "—"}
                          {end && <><span className="text-text-muted">→</span>{formatDate(end)}</>}
                        </div>
                      )}
                      {!start && !end && <span className="text-xs text-text-muted">Keine Daten eingetragen</span>}
                    </div>
                  </div>
                );
              })}

              {project.release_cinema && (
                <div className="rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gold">Kinostart</span>
                    <span className="text-sm text-text-secondary">{project.release_cinema}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Edit dates */}
            {isCreator && !editingTimeline && (
              <button onClick={() => setEditingTimeline(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted border border-border rounded-xl hover:border-gold hover:text-gold transition-colors">
                <Pencil size={13} /> Zeitraum bearbeiten
              </button>
            )}
            {editingTimeline && (
              <div className="p-5 bg-bg-secondary border border-gold/20 rounded-2xl space-y-4">
                <p className="text-sm font-semibold text-text-primary">Produktionszeiträume</p>
                {[
                  { lbl: "Vorbereitung von", key: "prep_start"  as const },
                  { lbl: "Vorbereitung bis", key: "prep_end"    as const },
                  { lbl: "Dreh von",         key: "shoot_start" as const },
                  { lbl: "Dreh bis",         key: "shoot_end"   as const },
                  { lbl: "Post von",         key: "post_start"  as const },
                  { lbl: "Post bis",         key: "post_end"    as const },
                ].reduce<{ lbl: string; key: keyof typeof timelineForm }[][]>((rows, item, i) => {
                  if (i % 2 === 0) rows.push([item]);
                  else rows[rows.length - 1].push(item);
                  return rows;
                }, []).map((pair, ri) => (
                  <div key={ri} className="grid grid-cols-2 gap-3">
                    {pair.map(({ lbl: l, key }) => (
                      <div key={key}>
                        {label(l, true)}
                        <input type="date" value={timelineForm[key]} onChange={(e) => setTimelineForm((p) => ({ ...p, [key]: e.target.value }))} className={inp} />
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={handleSaveTimeline} disabled={savingTimeline} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">
                    {savingTimeline ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Speichern
                  </button>
                  <button onClick={() => setEditingTimeline(false)} className="px-5 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
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
                <button onClick={() => setShowFestivalForm((v) => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-gold/10 border border-gold/20 text-gold text-sm font-semibold rounded-xl hover:bg-gold/20 transition-colors">
                  <Plus size={14} /> Festival / Award eintragen
                </button>
              </div>
            )}
            {showFestivalForm && (
              <div className="mb-6 p-5 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
                <p className="text-sm font-semibold text-text-primary">Neuer Festivaleintrag</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="col-span-2">{label("Festival / Veranstaltung *")}<input type="text" value={festivalForm.festival_name} onChange={(e) => setFestivalForm((p) => ({ ...p, festival_name: e.target.value }))} placeholder="z.B. Berlinale, Tribeca..." className={inp} autoFocus /></div>
                  <div>{label("Jahr *")}<input type="number" value={festivalForm.year} onChange={(e) => setFestivalForm((p) => ({ ...p, year: e.target.value }))} className={inp} /></div>
                  <div>{label("Status *")}<select value={festivalForm.status} onChange={(e) => setFestivalForm((p) => ({ ...p, status: e.target.value }))} className={inp}>{Object.entries(FESTIVAL_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  <div>{label("Sektion", true)}<input type="text" value={festivalForm.section} onChange={(e) => setFestivalForm((p) => ({ ...p, section: e.target.value }))} placeholder="z.B. Wettbewerb..." className={inp} /></div>
                  <div>{label("Award-Name", true)}<input type="text" value={festivalForm.award_name} onChange={(e) => setFestivalForm((p) => ({ ...p, award_name: e.target.value }))} placeholder="z.B. Bester Kurzfilm..." className={inp} /></div>
                  <div className="col-span-3 sm:col-span-1">{label("Anmerkung", true)}<input type="text" value={festivalForm.notes} onChange={(e) => setFestivalForm((p) => ({ ...p, notes: e.target.value }))} className={inp} /></div>
                </div>
                {festivalError && <p className="text-xs text-crimson-light">{festivalError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleAddFestival} disabled={savingFestival || !festivalForm.festival_name.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">
                    {savingFestival ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Speichern
                  </button>
                  <button onClick={() => { setShowFestivalForm(false); setFestivalForm(EMPTY_FESTIVAL_FORM); }} className="px-5 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
                </div>
              </div>
            )}
            {festivals.length === 0 ? (
              <div className="text-center py-20 text-text-muted">
                <Award size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm mb-1">Noch keine Festivaleinträge</p>
                {isCreator && <p className="text-xs opacity-60">Trage Festivals, Screenings und Awards ein</p>}
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_1fr_auto] px-5 py-2.5 bg-bg-elevated border-b border-border gap-4">
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Status</span>
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Festival</span>
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Award</span>
                  <span className="w-6" />
                </div>
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
                            <button onClick={() => handleDeleteFestival(entry.id)} className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors rounded-lg hover:bg-crimson-light/10">
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
              <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4 flex items-center gap-2"><Film size={13} /> Kino</h2>
              {project.release_cinema ? (
                <div className="flex items-center gap-4 px-5 py-3.5 bg-bg-elevated border border-border rounded-2xl">
                  <MapPin size={14} className="text-text-muted shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-widest mb-0.5">Kinostart</p>
                    <p className="text-sm text-text-primary">{project.release_cinema}</p>
                    {project.release_cinema_countries && <p className="text-xs text-text-muted mt-0.5">{project.release_cinema_countries.join(", ")}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">Kein Kinostart eingetragen.{isCreator && " Im Übersicht-Tab bearbeiten."}</p>
              )}
            </section>

            {/* Streaming */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold flex items-center gap-2"><Play size={13} /> Streaming</h2>
                {isCreator && (
                  <button onClick={() => setShowStreamingForm((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gold border border-gold/20 rounded-lg hover:bg-gold/10 transition-colors">
                    <Plus size={11} /> Plattform hinzufügen
                  </button>
                )}
              </div>
              {showStreamingForm && (
                <div className="mb-4 p-4 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>{label("Plattform *")}<select value={streamingForm.platform} onChange={(e) => setStreamingForm((p) => ({ ...p, platform: e.target.value }))} className={inp}>{STREAMING_PLATFORMS.map((pl) => <option key={pl} value={pl}>{pl}</option>)}</select></div>
                    <div>{label("Datum *")}<input type="text" value={streamingForm.date} onChange={(e) => setStreamingForm((p) => ({ ...p, date: e.target.value }))} placeholder="z.B. 1. April 2025" className={inp} /></div>
                    <div>{label("Territorium", true)}<input type="text" value={streamingForm.territory} onChange={(e) => setStreamingForm((p) => ({ ...p, territory: e.target.value }))} placeholder="z.B. DE, AT, CH" className={inp} /></div>
                    <div>{label("Link", true)}<input type="url" value={streamingForm.url} onChange={(e) => setStreamingForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." className={inp} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddStreaming} disabled={savingStreaming || !streamingForm.date} className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">
                      {savingStreaming ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Speichern
                    </button>
                    <button onClick={() => { setShowStreamingForm(false); setStreamingForm(EMPTY_STREAMING_FORM); }} className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
                  </div>
                </div>
              )}
              {streamingList.length === 0 ? (
                <p className="text-sm text-text-muted">Noch keine Streaming-Veröffentlichungen.</p>
              ) : (
                <div className="space-y-2">
                  {streamingList.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 bg-bg-elevated border border-border rounded-xl group">
                      <Globe size={14} className="text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{s.platform}</p>
                        <p className="text-xs text-text-muted">{s.date}{s.territory && ` · ${s.territory}`}</p>
                      </div>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-gold transition-colors"><ExternalLink size={13} /></a>
                      )}
                      {isCreator && (
                        <button onClick={() => handleRemoveStreaming(i)} className="text-text-muted hover:text-crimson-light transition-colors opacity-0 group-hover:opacity-100"><X size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* TV */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold flex items-center gap-2"><Tv size={13} /> TV-Ausstrahlung</h2>
                {isCreator && (
                  <button onClick={() => setShowTvForm((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gold border border-gold/20 rounded-lg hover:bg-gold/10 transition-colors">
                    <Plus size={11} /> Sender hinzufügen
                  </button>
                )}
              </div>
              {showTvForm && (
                <div className="mb-4 p-4 bg-bg-secondary border border-gold/20 rounded-2xl space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>{label("Sender *")}<input type="text" value={tvForm.channel} onChange={(e) => setTvForm((p) => ({ ...p, channel: e.target.value }))} placeholder="z.B. ARD, ZDF, ORF..." className={inp} /></div>
                    <div>{label("Datum *")}<input type="text" value={tvForm.date} onChange={(e) => setTvForm((p) => ({ ...p, date: e.target.value }))} placeholder="z.B. 20. April 2025, 20:15" className={inp} /></div>
                    <div>{label("Territorium", true)}<input type="text" value={tvForm.territory} onChange={(e) => setTvForm((p) => ({ ...p, territory: e.target.value }))} placeholder="z.B. Deutschland" className={inp} /></div>
                    <div>{label("Anmerkung", true)}<input type="text" value={tvForm.notes} onChange={(e) => setTvForm((p) => ({ ...p, notes: e.target.value }))} placeholder="z.B. Erstausstrahlung" className={inp} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddTv} disabled={savingTv || !tvForm.channel || !tvForm.date} className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">
                      {savingTv ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Speichern
                    </button>
                    <button onClick={() => { setShowTvForm(false); setTvForm(EMPTY_TV_FORM); }} className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-colors">Abbrechen</button>
                  </div>
                </div>
              )}
              {tvList.length === 0 ? (
                <p className="text-sm text-text-muted">Noch keine TV-Ausstrahlungen eingetragen.</p>
              ) : (
                <div className="space-y-2">
                  {tvList.map((t, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 bg-bg-elevated border border-border rounded-xl group">
                      <Tv size={14} className="text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium">{t.channel}</p>
                        <p className="text-xs text-text-muted">{t.date}{t.territory && ` · ${t.territory}`}{t.notes && ` · ${t.notes}`}</p>
                      </div>
                      {isCreator && (
                        <button onClick={() => handleRemoveTv(i)} className="text-text-muted hover:text-crimson-light transition-colors opacity-0 group-hover:opacity-100"><X size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Trailer */}
            {(project.trailer_url || project.teaser_url) && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-4 flex items-center gap-2"><Play size={13} /> Trailer & Teaser</h2>
                <div className="flex flex-wrap gap-3">
                  {project.trailer_url && (
                    <a href={project.trailer_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                      <Play size={13} /> Trailer <ExternalLink size={10} className="text-text-muted" />
                    </a>
                  )}
                  {project.teaser_url && (
                    <a href={project.teaser_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                      <Play size={13} /> Teaser <ExternalLink size={10} className="text-text-muted" />
                    </a>
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
