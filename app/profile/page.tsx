"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Camera, CheckCircle, User, Lock, Bell, CreditCard, MapPin, Film,
  Plus, X, Save, Wallet, Upload, ShieldCheck, Clock, AlertCircle, Loader2,
  Globe, Plane, Video, Euro, Clapperboard, Link2, AtSign, PlayCircle, ExternalLink,
  Drama, Palette, Building2,
} from "lucide-react";
import type { ElementType } from "react";
import LicensePicker from "@/components/LicensePicker";
import { useToast } from "@/contexts/ToastContext";
import ProfileGuard from "@/components/ProfileGuard";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";
import { departments, deptColors } from "@/lib/departments";
import {
  PROFILE_CATEGORY_MAP,
  type ProfileImage,
} from "@/lib/profile-types";

function safeLink(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try { new URL(url); return url; } catch { return null; }
}

// ─── Completion score ─────────────────────────────────────────────────────────

type CompletionResult = { score: number; missing: string[] };

function getCompletion(opts: {
  name: string; avatarUrl: string; location: string; bio: string;
  images: string[]; videoLinks: string[]; profileType: string;
  physical: { height_cm?: string; hair_color?: string; playing_age_min?: string };
  crew: { positions: string[]; filmography: unknown[] };
  languages: string[];
}): CompletionResult {
  const checks: [boolean, string][] = [
    [!!opts.name,                        "Name eingeben"],
    [!!opts.avatarUrl,                   "Profilfoto hochladen"],
    [!!opts.location,                    "Stadt angeben"],
    [!!opts.bio,                         "Kurzbeschreibung schreiben"],
    [!!opts.profileType,                 "Profiltyp auswählen"],
    [opts.images.length >= 2,            "Mindestens 2 Fotos hochladen"],
    [opts.videoLinks.length > 0,         "Video / Showreel hinzufügen"],
    [opts.languages.length > 0,          "Sprachen eintragen"],
  ];
  const type = opts.profileType;
  const isTalent = ["actor","model","extra","host","dancer","stunt","voiceover","creator"].includes(type);
  const isCrew   = !isTalent && !!type && !["location","equipment","vehicle","studio","props"].includes(type);
  if (isTalent) {
    checks.push([!!opts.physical.height_cm, "Größe eintragen"]);
    checks.push([!!opts.physical.hair_color, "Haarfarbe eintragen"]);
    if (type === "actor") checks.push([!!opts.physical.playing_age_min, "Spielalter hinterlegen"]);
  }
  if (isCrew) {
    checks.push([opts.crew.positions.length > 0, "Gewerk / Rolle auswählen"]);
    checks.push([opts.crew.filmography.length > 0, "Credits hinzufügen"]);
  }
  const passed = checks.filter(([ok]) => ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    missing: checks.filter(([ok]) => !ok).map(([, msg]) => msg).slice(0, 3),
  };
}

// ─── Accordion role picker (same as profile-setup) ───────────────────────────
const ROLE_CATEGORIES: { id: string; label: string; icon: ElementType; color: string; bg: string; desc: string; types: readonly (readonly [string, string])[] }[] = [
  { id: "talent",   label: "Talent / Performance", icon: Drama,        color: "text-rose-400",    bg: "bg-rose-500/15",    desc: "Schauspieler, Model, Creator …",
    types: [["actor","Schauspieler/in"],["model","Model"],["extra","Komparse / Kleindarsteller"],["host","Moderator/in"],["dancer","Tänzer/in"],["stunt","Stunt Performer"],["voiceover","Synchronsprecher/in"],["creator","Influencer / Creator"]] },
  { id: "crew",     label: "Filmcrew / Technik",   icon: Clapperboard,  color: "text-sky-400",     bg: "bg-sky-500/15",     desc: "Kamera, Licht, Ton, Regie …",
    types: [["camera","Kamera"],["lighting","Licht / Gaffer"],["sound","Ton"],["director_of_photography","Director of Photography"],["director","Regie"],["production","Produktion"],["makeup","Maske"],["costume","Kostüm"],["postproduction","Postproduktion"],["vfx","VFX"],["sfx","SFX"],["art_department","Szenenbild"],["broadcast","Broadcast"]] },
  { id: "kreativ",  label: "Kreativ",               icon: Palette,       color: "text-violet-400",  bg: "bg-violet-500/15",  desc: "Fotograf, Editor, Art Director …",
    types: [["filmmaker","Regisseur/in"],["writer","Autor/in"],["photographer","Fotograf/in"],["editor","Editor/in"],["motion_designer","Motion Designer"],["art_director","Art Director"]] },
  { id: "anbieter", label: "Anbieter",              icon: Building2,     color: "text-amber-400",   bg: "bg-amber-500/15",   desc: "Location, Equipment, Studio …",
    types: [["location","Location"],["equipment","Equipment"],["vehicle","Fahrzeuge"],["studio","Studio"],["props","Requisiten"]] },
];

function ProfileTypePicker({ selected, onSelect }: { selected: string; onSelect: (t: string) => void }) {
  const [openCat, setOpenCat] = useState<string | null>(() =>
    ROLE_CATEGORIES.find(c => c.types.some(([id]) => id === selected))?.id ?? null
  );
  return (
    <div className="space-y-2">
      {ROLE_CATEGORIES.map(cat => {
        const isOpen = openCat === cat.id;
        const selectedInCat = cat.types.find(([id]) => id === selected);
        return (
          <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
            <button type="button"
              onClick={() => setOpenCat(isOpen ? null : cat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isOpen ? "bg-bg-elevated" : "bg-bg-secondary hover:bg-bg-elevated"}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cat.bg}`}>
                <cat.icon size={18} className={cat.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{cat.label}</p>
                <p className="text-xs text-text-muted">
                  {selectedInCat ? <span className="text-gold">{selectedInCat[1]} gewählt</span> : cat.desc}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedInCat && <CheckCircle size={14} className="text-gold" />}
                <span className={`text-text-muted text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-3 grid grid-cols-2 gap-2 bg-bg-primary">
                {cat.types.map(([id, label]) => (
                  <button key={id} type="button"
                    onClick={() => onSelect(id === selected ? "" : id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-95 text-xs font-medium ${
                      selected === id ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-border-light"
                    }`}
                  >
                    <span className="leading-tight">{label}</span>
                    {selected === id && <CheckCircle size={11} className="ml-auto shrink-0 text-gold" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
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

const tabs = [
  { id: "profile",        label: "Profil",                icon: User        },
  { id: "verification",   label: "Verifizierung",          icon: CheckCircle },
  { id: "security",       label: "Sicherheit",             icon: Lock        },
  { id: "notifications",  label: "Benachrichtigungen",     icon: Bell        },
  { id: "billing",        label: "Abrechnung",             icon: CreditCard  },
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
      if (!res.ok || !url) { addToast(error ?? "Upload fehlgeschlagen", "error"); return; }
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
      addToast("Ausweis eingereicht", "success");
    } catch {
      addToast("Unbekannter Fehler", "error");
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
        <h3 className="font-display text-xl font-bold text-text-primary">Identität verifiziert</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
          Dein Profil trägt das verifizierte Badge.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 rounded-full text-success text-sm font-medium">
          <CheckCircle size={14} /> Verifiziert
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
        <h3 className="font-display text-xl font-bold text-text-primary">Wird geprüft</h3>
        <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
          Wir prüfen deinen Ausweis innerhalb von <strong className="text-text-primary">1–2 Werktagen</strong>.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 rounded-full text-gold text-sm font-medium">
          <Clock size={14} /> Ausstehend
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="space-y-5">
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl text-center space-y-3">
          <AlertCircle size={28} className="text-red-400 mx-auto" />
          <h3 className="font-semibold text-text-primary">Prüfung fehlgeschlagen</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            Dein Ausweis konnte nicht verifiziert werden. Bitte lade ein neues, gut lesbares Bild hoch.
          </p>
        </div>
        <button
          onClick={() => setStatus("none")}
          className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  // status === "none"
  return (
    <div className="space-y-5">
      <UploadZone
        label="Personalausweis oder Reisepass"
        hint="JPG, PNG oder WEBP · Vorder- und Rückseite · max. 10 MB"
        accept="image/jpeg,image/png,image/webp"
        file={idFile}
        uploading={idUploading}
        onFile={handleIdFile}
      />

      <div className="p-4 bg-bg-secondary border border-border rounded-xl flex items-start gap-2.5">
        <ShieldCheck size={15} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted leading-relaxed">
          Dein Ausweis wird ausschließlich zur Identitätsprüfung verwendet und vertraulich behandelt. Er ist für andere Nutzer nicht sichtbar.
        </p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !idFile}
        className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? <><Loader2 size={15} className="animate-spin" /> Einreichen…</> : <><ShieldCheck size={15} /> Ausweis einreichen</>}
      </button>
    </div>
  );
}

type FilmEntry = { year: number | string; title: string; role: string; type: string; director?: string; imdb_url?: string };

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { addToast } = useToast();
  const { user, isLoaded } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("profile");
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
    slug: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
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
  const [focalPickerImage, setFocalPickerImage] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [vimeoUrl, setVimeoUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [filmography, setFilmography] = useState<FilmEntry[]>([]);
  const [newFilm, setNewFilm] = useState<FilmEntry>({ year: "", title: "", role: "", type: "", director: "" });
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
  const [joiningProjectId, setJoiningProjectId] = useState<string | null>(null);
  const [joiningRole, setJoiningRole] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", year: "", type: "", description: "", director: "", myRole: "", poster_url: "" });
  const [creatingProject, setCreatingProject] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const [payout, setPayout] = useState({
    accountHolder: "",
    iban: "",
    bic: "",
    bank: "",
    vatId: "",
  });

  // ── Casting / Physical data ─────────────────────────────────────────────────
  const [currentProfileType, setCurrentProfileType] = useState<string>("");
  const [playingAgeMin, setPlayingAgeMin] = useState("");
  const [playingAgeMax, setPlayingAgeMax] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [beard, setBeard] = useState(false);
  const [tattoos, setTattoos] = useState(false);
  const [tattoosCoverable, setTattoosCoverable] = useState(false);

  // ── Load profile from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (profile) {
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
            slug:          profile.slug                ?? "",
          });
          setSkills(profile.skills ?? []);
          setPositions(profile.positions ?? []);
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((profile as any).focal_point) setFocalPoint((profile as any).focal_point);
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
          setCurrentProfileType(profile.profile_type ?? "");
          const phys = profile.physical ?? {};
          setPlayingAgeMin(phys.playing_age_min ? String(phys.playing_age_min) : "");
          setPlayingAgeMax(phys.playing_age_max ? String(phys.playing_age_max) : "");
          setHeightCm(phys.height_cm ? String(phys.height_cm) : "");
          setHairColor(phys.hair_color ?? "");
          setEyeColor(phys.eye_color ?? "");
          setBodyType(phys.body_type ?? "");
          setBeard(phys.beard ?? false);
          setTattoos(phys.tattoos ?? false);
          setTattoosCoverable(phys.tattoos_coverable ?? false);
        }
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
  }, [isLoaded]);

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
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      setAvatarUrl(url);
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      addToast("Profilfoto aktualisiert", "success");
      // Fokuspunkt setzen
      setFocalPickerImage(url);
    } catch {
      addToast("Upload fehlgeschlagen", "error");
      setAvatarPreview(avatarUrl); // revert
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarPreview("");
    setAvatarUrl("");
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: null }),
    });
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImagePreview(URL.createObjectURL(file));
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      setCoverImageUrl(url);
      addToast("Coverbild aktualisiert", "success");
      // Fokuspunkt setzen
      setFocalPickerImage(url);
    } catch {
      addToast("Upload fehlgeschlagen", "error");
      setCoverImagePreview(coverImageUrl);
    } finally {
      setCoverUploading(false);
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

  const joinProject = async (projectId: string) => {
    if (!joinRole.trim()) return;
    setJoiningRole(true);
    try {
      const r = await fetch("/api/project-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, role: joinRole }),
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error, "error"); return; }
      // Refresh credits
      const r2 = await fetch(`/api/project-credits?user_id=${user?.id}`);
      const d2 = await r2.json();
      setProjectCredits(d2.credits ?? []);
      setJoiningProjectId(null);
      setJoinRole("");
      setProjectSearch("");
      setProjectResults([]);
      addToast("Erfolgreich eingetragen!", "success");
    } finally {
      setJoiningRole(false);
    }
  };

  const leaveProject = async (projectId: string) => {
    await fetch(`/api/project-credits?project_id=${projectId}`, { method: "DELETE" });
    setProjectCredits((prev) => prev.filter((c) => c.project_id !== projectId));
    addToast("Aus Projekt ausgetragen", "success");
  };

  const createProject = async () => {
    if (!newProject.title.trim()) { addToast("Titel fehlt", "error"); return; }
    setCreatingProject(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });
      const d = await r.json();
      if (!r.ok) { addToast(d.error, "error"); return; }
      // Refresh credits
      const r2 = await fetch(`/api/project-credits?user_id=${user?.id}`);
      const d2 = await r2.json();
      setProjectCredits(d2.credits ?? []);
      setShowNewProject(false);
      setNewProject({ title: "", year: "", type: "", description: "", director: "", myRole: "", poster_url: "" });
      addToast("Projekt erstellt!", "success");
    } finally {
      setCreatingProject(false);
    }
  };

  // ── Save profile ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim() || !form.city.trim()) {
      addToast("Name und Stadt sind Pflichtfelder", "error");
      return;
    }
    setSaving(true);
    try {
      // Basisdaten speichern
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name:   form.name,
          slug:           form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null,
          location:       [form.city.trim(), form.country.trim()].filter(Boolean).join(", "),
          bio:            form.bio,
          role:           positions[0] ?? null,
          available:      form.available,
          skills,
          positions,
          languages,
          profile_images: profileImages,
          reel_url:       videoLinks[0] || null,
          available_from: form.availableFrom || null,
          travel_ready:   form.travelReady,
          cover_image_url: coverImageUrl || null,
          instagram_url:  instagramUrl || null,
          tiktok_url:     tiktokUrl || null,
          youtube_url:    youtubeUrl || null,
          vimeo_url:      vimeoUrl || null,
          linkedin_url:   linkedinUrl || null,
          website_url:    safeLink(form.website) || null,
          day_rate:       dayRate ? parseInt(dayRate) : null,
          filmography,
          video_links:    videoLinks,
          crew: { certificates: crewCertificates },
        }),
      });
      const baseResult = await res.json();
      if (!res.ok || baseResult.error) {
        const msg = baseResult.error ?? `HTTP ${res.status}`;
        addToast(`Speichern fehlgeschlagen: ${msg}`, "error");
        return;
      }

      // Profiltyp + Casting-Daten immer speichern (via RPC, kein Schema-Cache Problem)
      const physical = {
        playing_age_min:   playingAgeMin ? Number(playingAgeMin) : null,
        playing_age_max:   playingAgeMax ? Number(playingAgeMax) : null,
        height_cm:         heightCm ? Number(heightCm) : null,
        hair_color:        hairColor || null,
        eye_color:         eyeColor || null,
        body_type:         bodyType || null,
        beard:             beard || null,
        tattoos:           tattoos || null,
        tattoos_coverable: tattoosCoverable || null,
      };
      const physRes = await fetch("/api/profile/physical", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_type: currentProfileType || null, physical }),
      });
      const physResult = await physRes.json();
      console.log("[save] physical result:", JSON.stringify(physResult));
      if (!physRes.ok || physResult.error) {
        const msg = physResult.error ?? `HTTP ${physRes.status}`;
        addToast(`Casting-Daten: ${msg}`, "error");
        return;
      }

      addToast("Profil erfolgreich aktualisiert", "success");
    } catch (err) {
      addToast(`Fehler: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const persistProfileImages = async (images: ProfileImage[]) => {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_images: images }),
    });
  };

  const handleProfileImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setProfileUploading(true);
    try {
      const uploaded: ProfileImage[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        uploaded.push({ url: data.url, featured: false });
      }

      // Merge with existing, auto-feature first if none set
      const merged = [...profileImages, ...uploaded];
      if (!merged.some((i) => i.featured)) merged[0] = { ...merged[0], featured: true };
      setProfileImages(merged);

      // Immediately persist to DB — don't rely on main save button
      await persistProfileImages(merged);

      addToast(`${uploaded.length} Foto${uploaded.length > 1 ? "s" : ""} gespeichert`, "success");
    } catch (err) {
      console.error("[photo upload]", err);
      addToast(err instanceof Error ? err.message : "Upload fehlgeschlagen", "error");
    } finally {
      setProfileUploading(false);
      if (profileImagesRef.current) profileImagesRef.current.value = "";
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills((prev) => [...prev, s]);
      setNewSkill("");
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
  const profileCategory = getCategory(currentProfileType);
  const showCrewSections = !profileCategory || profileCategory === "crew" || profileCategory === "creative";
  const showTalentSections = profileCategory === "talent";
  const showVendorSections = profileCategory === "vendor";

  const completion: CompletionResult = profileLoading ? { score: 0, missing: [] } : getCompletion({
    name: form.name, avatarUrl, location: form.city, bio: form.bio,
    images: profileImages.map((i) => i.url), videoLinks, profileType: currentProfileType,
    physical: { height_cm: heightCm, hair_color: hairColor, playing_age_min: playingAgeMin },
    crew: { positions, filmography },
    languages,
  });
  const displayAvatarName = form.name || clerkEmail.split("@")[0] || "?";

  async function saveFocalPoint(point: FocalPoint) {
    setFocalPoint(point);
    setFocalPickerImage(null);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focal_point: point }),
    });
    addToast("Fokuspunkt gespeichert", "success");
  }

  return (
    <ProfileGuard>
    {focalPickerImage && (
      <FocalPointPicker
        imageUrl={focalPickerImage}
        initial={focalPoint}
        onSave={saveFocalPoint}
        onClose={() => setFocalPickerImage(null)}
      />
    )}
    <div className="pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mb-3"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              Zurück zum Dashboard
            </Link>
            <h1 className="font-display text-2xl font-bold text-text-primary">Öffentliches Profil</h1>
            <p className="text-sm text-text-muted mt-1">So wirst du anderen Nutzern auf CineGenius angezeigt.</p>
          </div>
          {user?.id && (
            <Link
              href={`/profile/${user.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:border-gold hover:text-gold transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              Profil ansehen
            </Link>
          )}
        </div>

        <div className="flex gap-8 flex-col lg:flex-row">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <nav className="space-y-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                    activeTab === id
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-transparent"
                  }`}>
                  <Icon size={15} /> {label}
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
              <div className="space-y-8">

                {/* ── Completion Score ── */}
                {completion.score < 100 && (
                  <div className="p-4 bg-bg-secondary border border-border rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-text-primary">Profil-Vollständigkeit</p>
                      <span className={`text-sm font-bold tabular-nums ${completion.score >= 70 ? "text-emerald-400" : completion.score >= 40 ? "text-gold" : "text-text-muted"}`}>
                        {completion.score}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${completion.score >= 70 ? "bg-emerald-400" : "bg-gold"}`}
                        style={{ width: `${completion.score}%` }}
                      />
                    </div>
                    {completion.missing.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {completion.missing.map((hint) => (
                          <span key={hint} className="text-[11px] px-2.5 py-1 bg-bg-elevated border border-border rounded-full text-text-muted">
                            + {hint}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Profiltyp ── */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">Ich bin …</h2>
                  <p className="text-xs text-text-muted mb-4">Dein Profiltyp bestimmt welche Felder sichtbar sind.</p>
                  <ProfileTypePicker
                    selected={currentProfileType}
                    onSelect={setCurrentProfileType}
                  />
                </div>

                {/* Avatar */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">Profilfoto</h2>
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
                        {[positions[0], form.city].filter(Boolean).join(" · ") || clerkEmail}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => fileRef.current?.click()}
                          className="px-3 py-1.5 text-xs border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-colors">
                          Foto hochladen
                        </button>
                        {avatarPreview && (
                          <button onClick={removeAvatar} className="px-3 py-1.5 text-xs text-text-muted hover:text-crimson-light transition-colors">
                            Entfernen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                {/* Profilfotos — direkt unter Avatar */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <input
                    ref={profileImagesRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleProfileImagesUpload}
                  />
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-semibold text-text-primary mb-0.5">Fotos</h2>
                      <p className="text-xs text-text-muted">
                        {showTalentSections
                          ? "Das Hauptfoto (★) erscheint groß, weitere als Seitenfotos auf deinem Profil."
                          : "Fotos für dein Portfolio. Mehrere Bilder möglich."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => profileImagesRef.current?.click()}
                      disabled={profileUploading}
                      className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60"
                    >
                      {profileUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {profileUploading ? "Lädt…" : "Fotos hochladen"}
                    </button>
                  </div>

                  {profileImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {profileImages.map((img, i) => (
                        <div key={img.url + i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border bg-bg-elevated">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover object-top" />
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5 bg-gradient-to-b from-black/60 to-transparent">
                            <button
                              type="button"
                              title="Als Hauptfoto"
                              onClick={() => {
                                const next = profileImages.map((im, j) => ({ ...im, featured: j === i }));
                                setProfileImages(next);
                                persistProfileImages(next);
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
                                setProfileImages(next);
                                persistProfileImages(next);
                              }}
                              className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white/70 hover:bg-red-600 hover:text-white transition-colors"
                            ><X size={11} /></button>
                          </div>
                          {img.featured && (
                            <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
                              <span className="px-2 py-0.5 bg-gold text-bg-primary text-[9px] font-bold rounded-full">Hauptfoto</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => profileImagesRef.current?.click()}
                        disabled={profileUploading}
                        className="aspect-[3/4] rounded-xl border-2 border-dashed border-border hover:border-gold/60 hover:bg-gold/5 flex flex-col items-center justify-center gap-2 text-text-muted hover:text-gold transition-all disabled:opacity-50"
                      >
                        {profileUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                        <span className="text-[10px] font-semibold uppercase tracking-wide">{profileUploading ? "Lädt…" : "Hinzufügen"}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => profileImagesRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-gold/50 hover:bg-gold/5 transition-all"
                    >
                      <Upload size={28} className="text-text-muted mb-3" />
                      <p className="text-sm font-medium text-text-secondary">Fotos hochladen</p>
                      <p className="text-xs text-text-muted mt-1">JPG, PNG, WEBP · mehrere gleichzeitig möglich</p>
                    </button>
                  )}
                </div>

                {/* Cover Image — only for crew/creative/vendor; talent uses profile_images as hero */}
                {!showTalentSections && <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-text-primary mb-0.5">Coverbild</h2>
                      <p className="text-xs text-text-muted">Großes Banner oben auf deinem Profil (16:9 empfohlen)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => coverRef.current?.click()}
                      disabled={coverUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/20 text-gold text-xs font-semibold rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-60"
                    >
                      {coverUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {coverUploading ? "Lädt..." : "Bild hochladen"}
                    </button>
                    <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </div>
                  {coverImagePreview ? (
                    <div className="relative rounded-xl overflow-hidden aspect-[3/1] border border-border group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverImagePreview} alt="Cover" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setCoverImagePreview(""); setCoverImageUrl(""); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-crimson-light"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => coverRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/40 transition-colors aspect-[3/1] flex flex-col items-center justify-center gap-2"
                    >
                      <Camera size={24} className="text-text-muted" />
                      <p className="text-sm text-text-muted">Coverbild hochladen</p>
                      <p className="text-xs text-text-muted">JPG, PNG, WEBP · ideal 1500×500 px</p>
                    </button>
                  )}
                </div>}

                {/* Basisinformationen */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">Basisinformationen</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Name <span className="text-crimson-light">*</span>
                      </label>
                      <input type="text" value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Website / Portfolio
                      </label>
                      <input type="url" value={form.website}
                        onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://…"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Stadt <span className="text-crimson-light">*</span>
                      </label>
                      <input type="text" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                        placeholder="z.B. München"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Land
                      </label>
                      <input type="text" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                        placeholder="z.B. Deutschland"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    {/* Profil-URL / Slug */}
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        Profil-URL
                      </label>
                      <div className="flex items-center gap-0 bg-bg-elevated border border-border rounded-lg overflow-hidden focus-within:border-gold transition-colors">
                        <span className="px-3 py-2.5 text-sm text-text-muted border-r border-border whitespace-nowrap select-none">
                          cinegenius.de/profile/
                        </span>
                        <input
                          type="text"
                          value={form.slug}
                          onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                          placeholder="dein-name"
                          className="flex-1 bg-transparent px-3 py-2.5 text-sm focus:outline-none"
                        />
                      </div>
                      <p className="text-xs text-text-muted mt-1">Nur Kleinbuchstaben, Zahlen und Bindestriche. Z.B. max-mustermann</p>
                    </div>
                    {/* E-Mail (read-only, from Clerk) */}
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                        E-Mail
                      </label>
                      <input type="email" value={clerkEmail} readOnly
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-muted cursor-not-allowed" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Bio</label>
                      <textarea rows={4} value={form.bio ?? ""}
                        onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                        maxLength={500}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
                      <p className="text-xs text-text-muted mt-1 text-right">{(form.bio ?? "").length} / 500</p>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5 flex items-center gap-1.5">
                        <Euro size={11} /> Tagessatz (€)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={dayRate}
                        onChange={(e) => setDayRate(e.target.value)}
                        placeholder="z.B. 450"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                      />
                      <p className="text-xs text-text-muted mt-1">Leer lassen = &quot;Nach Vereinbarung&quot;</p>
                    </div>
                  </div>

                  {/* Verfügbarkeit */}
                  <div className="mt-5 pt-5 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">Für Aufträge verfügbar</p>
                        <p className="text-xs text-text-muted">Verfügbarkeits-Badge auf deinem öffentlichen Profil anzeigen</p>
                      </div>
                      <button onClick={() => setForm((p) => ({ ...p, available: !p.available }))}
                        className={`w-11 h-6 rounded-full relative transition-colors ${form.available ? "bg-success" : "bg-bg-elevated border border-border"}`}>
                        <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                          style={{ left: form.available ? "calc(100% - 22px)" : "2px" }} />
                      </button>
                    </div>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Verfügbar ab</label>
                        <input
                          type="date"
                          value={form.availableFrom ?? ""}
                          onChange={(e) => setForm((p) => ({ ...p, availableFrom: e.target.value }))}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                        <p className="text-xs text-text-muted mt-1">Leer lassen wenn sofort verfügbar</p>
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
                              <Plane size={13} className="text-text-muted" /> Reisebereit
                            </p>
                            <p className="text-xs text-text-muted">Bereit für Drehs außerhalb deines Standorts</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Crew / Creative sections ─────────────────────────── */}
                {showCrewSections && <>

                {/* Beruf & Positionen */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">Beruf & Positionen <span className="text-crimson-light">*</span></h2>
                  <p className="text-xs text-text-muted mb-5">Wähle alle Positionen aus die auf dich zutreffen. Du kannst mehrere auswählen.</p>

                  {positions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                      {positions.map((p) => (
                        <span key={p} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-subtle border border-gold/20 rounded-full text-xs text-gold font-medium">
                          {p}
                          <button type="button" onClick={() => setPositions((prev) => prev.filter((x) => x !== p))} className="hover:text-crimson-light transition-colors">
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {departments.map((dept) => {
                      const colors = deptColors(dept.color);
                      const deptSelectedCount = dept.roles.filter((r) => positions.includes(r)).length;
                      return (
                        <div key={dept.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <p className={`text-[10px] uppercase tracking-widest font-semibold ${colors.text}`}>{dept.label}</p>
                            {deptSelectedCount > 0 && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.border} ${colors.text}`}>
                                {deptSelectedCount}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {dept.roles.map((job) => {
                              const selected = positions.includes(job);
                              return (
                                <button
                                  key={job}
                                  type="button"
                                  onClick={() => setPositions((prev) =>
                                    selected ? prev.filter((x) => x !== job) : [...prev, job]
                                  )}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                    selected
                                      ? `${colors.bg} ${colors.border} ${colors.text}`
                                      : "border-border text-text-muted hover:border-border-light hover:text-text-secondary"
                                  }`}
                                >
                                  {job}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filmografie — verknüpfte Projekte */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                    <Clapperboard size={15} className="text-gold" /> Filmografie
                  </h2>
                  <p className="text-xs text-text-muted mb-5">
                    Suche nach bestehenden Projekten oder erstelle ein neues — andere Crew-Mitglieder können sich ebenfalls eintragen.
                  </p>

                  {/* Manuelle Filmografie-Einträge (mit Link-Feld) */}
                  {filmography.length > 0 && (
                    <div className="space-y-2 mb-5">
                      <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Manuell eingetragen</p>
                      {filmography.map((film, idx) => (
                        <div key={idx} className="p-3 bg-bg-elevated border border-border rounded-lg space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">{film.title}</p>
                              <p className="text-xs text-text-muted">{film.year}{film.role ? ` · ${film.role}` : ""}</p>
                            </div>
                            <button type="button"
                              onClick={() => setFilmography((p) => p.filter((_, i) => i !== idx))}
                              className="text-text-muted hover:text-crimson-light transition-colors shrink-0 mt-0.5">
                              <X size={13} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 bg-bg-primary border border-border rounded px-2 focus-within:border-gold transition-colors">
                            <ExternalLink size={11} className="text-text-muted shrink-0" />
                            <input
                              type="url"
                              value={film.imdb_url ?? ""}
                              onChange={(e) => setFilmography((p) => p.map((f, i) => i === idx ? { ...f, imdb_url: e.target.value } : f))}
                              placeholder="Link (IMDb, Projektseite…)"
                              className="flex-1 bg-transparent border-none py-1.5 text-xs focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Existing credits */}
                  {projectCredits.length > 0 && (
                    <div className="space-y-2 mb-5">
                      {projectCredits.map((credit) => (
                        <div key={credit.id} className="flex items-center gap-3 p-3 bg-bg-elevated border border-border rounded-lg group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {credit.projects?.year && <span className="text-xs font-bold text-gold">{credit.projects.year}</span>}
                              <span className="text-sm font-semibold text-text-primary truncate">{credit.projects?.title}</span>
                              {credit.projects?.type && (
                                <span className="px-1.5 py-0.5 bg-gold/10 border border-gold/20 text-[10px] text-gold rounded font-medium">{credit.projects.type}</span>
                              )}
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5">{credit.role}{credit.projects?.director ? ` · Regie: ${credit.projects.director}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`/projects/${credit.project_id}`}
                              className="text-[11px] text-text-muted hover:text-gold transition-colors"
                              target="_blank" rel="noopener noreferrer"
                            >
                              Ansehen →
                            </a>
                            <button
                              type="button"
                              onClick={() => leaveProject(credit.project_id)}
                              className="text-text-muted hover:text-crimson-light transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
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
                          placeholder="Projekt suchen (z.B. Das letzte Licht)..."
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
                                    <input
                                      type="text"
                                      value={joinRole}
                                      onChange={(e) => setJoinRole(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && joinProject(proj.id)}
                                      placeholder="Deine Rolle"
                                      autoFocus
                                      className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-gold w-36"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => joinProject(proj.id)}
                                      disabled={joiningRole || !joinRole.trim()}
                                      className="p-1.5 bg-gold text-bg-primary rounded hover:bg-gold-light transition-colors disabled:opacity-60"
                                    >
                                      {joiningRole ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                    </button>
                                    <button type="button" onClick={() => setJoiningProjectId(null)}
                                      className="p-1.5 text-text-muted hover:text-crimson-light transition-colors">
                                      <X size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setJoiningProjectId(proj.id)}
                                    className="text-xs text-gold hover:text-gold-light font-medium transition-colors"
                                  >
                                    + Eintragen
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
                        <Plus size={13} /> Neues Projekt erstellen
                      </button>
                    </div>
                  )}

                  {/* Create new project form */}
                  {showNewProject && (
                    <div className="p-4 bg-bg-elevated border border-gold/20 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gold uppercase tracking-widest">Neues Projekt</p>
                        <button type="button" onClick={() => setShowNewProject(false)} className="text-text-muted hover:text-crimson-light"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Titel *</label>
                          <input type="text" value={newProject.title}
                            onChange={(e) => setNewProject((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Das letzte Licht"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Jahr</label>
                          <input type="number" value={newProject.year}
                            onChange={(e) => setNewProject((p) => ({ ...p, year: e.target.value }))}
                            placeholder="2024"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Typ</label>
                          <select value={newProject.type}
                            onChange={(e) => setNewProject((p) => ({ ...p, type: e.target.value }))}
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold">
                            <option value="">—</option>
                            {["Spielfilm","Kurzfilm","Serie","Dokumentation","Werbefilm","Musikvideo","Corporate"].map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Regie</label>
                          <input type="text" value={newProject.director}
                            onChange={(e) => setNewProject((p) => ({ ...p, director: e.target.value }))}
                            placeholder="Anna K."
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Meine Rolle *</label>
                          <input type="text" value={newProject.myRole}
                            onChange={(e) => setNewProject((p) => ({ ...p, myRole: e.target.value }))}
                            placeholder="Oberbeleuchter"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Kurzbeschreibung</label>
                          <textarea rows={2} value={newProject.description}
                            onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Worum geht es in diesem Projekt?"
                            className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold resize-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Poster</label>
                          {newProject.poster_url ? (
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={newProject.poster_url} alt="Poster" className="h-20 w-14 object-cover rounded-md border border-border" />
                              <button type="button" onClick={() => setNewProject((p) => ({ ...p, poster_url: "" }))}
                                className="text-xs text-text-muted hover:text-crimson-light">Entfernen</button>
                            </div>
                          ) : (
                            <label className={`flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-dashed border-border rounded-lg cursor-pointer hover:border-gold transition-colors text-sm text-text-muted ${uploadingPoster ? "opacity-60 pointer-events-none" : ""}`}>
                              {uploadingPoster ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                              {uploadingPoster ? "Wird hochgeladen…" : "Poster hochladen"}
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
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
                      </div>
                      <button
                        type="button"
                        onClick={createProject}
                        disabled={creatingProject || !newProject.title.trim()}
                        className="w-full py-2.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {creatingProject ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Projekt erstellen & eintragen
                      </button>
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">Social Media & Links</h2>
                  <p className="text-xs text-text-muted mb-5">Verlinke deine sozialen Profile — sie erscheinen als Buttons auf deinem Profil.</p>
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

                {/* Videos & Showreel */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">Videos & Showreel</h2>
                  <p className="text-xs text-text-muted mb-5">Der erste Link wird als Haupt-Showreel angezeigt. Weitere Links erscheinen als Video-Grid. YouTube oder Vimeo.</p>
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
                        placeholder="https://vimeo.com/... oder https://youtube.com/..."
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
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">Fähigkeiten & Spezialgebiete</h2>
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
                    <p className="text-xs text-text-muted mb-4">Noch keine Fähigkeiten eingetragen.</p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder="Fähigkeit hinzufügen..." value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSkill()}
                      className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors" />
                    <button onClick={addSkill}
                      className="px-3 py-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold/20 transition-colors">
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Sprachen */}
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">Sprachen</h2>
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
                    <p className="text-xs text-text-muted mb-4">Noch keine Sprachen eingetragen.</p>
                  )}
                  <div className="flex gap-2">
                    <input type="text" placeholder="Sprache hinzufügen (z.B. Deutsch, Englisch…)" value={newLanguage}
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
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">Lizenzen & Führerscheine</h2>
                  <p className="text-xs text-text-muted mb-4">Führerscheine, Drohnenlizenzen, Set-Zertifikate & mehr.</p>
                  <LicensePicker
                    selected={crewCertificates}
                    onChange={setCrewCertificates}
                  />
                </div>

                </> /* end crew-only */}

                {/* ── CASTING-DATEN ── */}
                {showTalentSections && (() => {
                  const HAIR = ["Schwarz","Dunkelbraun","Braun","Hellbraun","Blond","Hellblond","Rot","Grau","Weiß","Gefärbt"];
                  const EYES = ["Braun","Dunkelbraun","Grün","Blaugrün","Blau","Grau","Haselnuss","Schwarz"];
                  const BODIES = [
                    { id:"slim",label:"Schlank" },{ id:"athletic",label:"Athletisch" },
                    { id:"normal",label:"Normal" },{ id:"strong",label:"Kräftig" },
                    { id:"muscular",label:"Muskulös" },{ id:"curvy",label:"Kurvig" },
                  ];
                  return (
                    <div className="p-6 bg-bg-secondary border border-border rounded-xl space-y-6">
                      <h2 className="font-semibold text-text-primary">Casting-Daten</h2>

                      {/* Spielalter */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Spielalter</label>
                        <div className="flex items-center gap-3">
                          <input type="number" min="1" max="99" value={playingAgeMin}
                            onChange={e => setPlayingAgeMin(e.target.value)}
                            placeholder="von"
                            className="w-24 bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                          <span className="text-text-muted text-sm">–</span>
                          <input type="number" min="1" max="99" value={playingAgeMax}
                            onChange={e => setPlayingAgeMax(e.target.value)}
                            placeholder="bis"
                            className="w-24 bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                          <span className="text-text-muted text-sm">Jahre</span>
                        </div>
                      </div>

                      {/* Größe */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Größe (cm)</label>
                        <input type="number" min="100" max="220" value={heightCm}
                          onChange={e => setHeightCm(e.target.value)}
                          placeholder="170"
                          className="w-32 bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      </div>

                      {/* Haarfarbe */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Haarfarbe</label>
                        <div className="flex flex-wrap gap-2">
                          {HAIR.map(c => (
                            <button key={c} type="button" onClick={() => setHairColor(c === hairColor ? "" : c)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                hairColor === c ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"
                              }`}>{c}</button>
                          ))}
                        </div>
                      </div>

                      {/* Augenfarbe */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Augenfarbe</label>
                        <div className="flex flex-wrap gap-2">
                          {EYES.map(c => (
                            <button key={c} type="button" onClick={() => setEyeColor(c === eyeColor ? "" : c)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                eyeColor === c ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"
                              }`}>{c}</button>
                          ))}
                        </div>
                      </div>

                      {/* Körperbau */}
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">Körperbau</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {BODIES.map(b => (
                            <button key={b.id} type="button" onClick={() => setBodyType(b.id === bodyType ? "" : b.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                bodyType === b.id ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"
                              }`}>{b.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div onClick={() => setBeard(v => !v)}
                            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${beard ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${beard ? "left-5" : "left-0.5"}`} />
                          </div>
                          <span className="text-sm text-text-secondary">Bart vorhanden</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div onClick={() => setTattoos(v => !v)}
                            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${tattoos ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tattoos ? "left-5" : "left-0.5"}`} />
                          </div>
                          <span className="text-sm text-text-secondary">Tattoos vorhanden</span>
                        </label>
                        {tattoos && (
                          <label className="flex items-center gap-3 cursor-pointer ml-13">
                            <div onClick={() => setTattoosCoverable(v => !v)}
                              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${tattoosCoverable ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${tattoosCoverable ? "left-5" : "left-0.5"}`} />
                            </div>
                            <span className="text-sm text-text-muted">Tattoos abdeckbar</span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <button onClick={handleSave} disabled={saving}
                  className="w-full py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "Wird gespeichert..." : "Änderungen speichern"}
                </button>
              </div>
            )}

            {/* ── VERIFIZIERUNG ── */}
            {activeTab === "verification" && <VerificationTab />}

            {/* ── SICHERHEIT ── */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-5">Passwort ändern</h2>
                  <div className="space-y-4 max-w-sm">
                    {["Aktuelles Passwort", "Neues Passwort", "Neues Passwort bestätigen"].map((label) => (
                      <div key={label}>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{label}</label>
                        <input type="password" className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                      </div>
                    ))}
                    <button onClick={() => addToast("Passwort erfolgreich aktualisiert", "success")}
                      className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
                      Passwort aktualisieren
                    </button>
                  </div>
                </div>
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <h2 className="font-semibold text-text-primary mb-1">Zwei-Faktor-Authentifizierung</h2>
                  <p className="text-xs text-text-muted mb-5">Füge deinem Konto eine zusätzliche Sicherheitsebene hinzu.</p>
                  <div className="flex items-center justify-between p-4 bg-bg-elevated border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                        <CheckCircle size={15} className="text-success" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">Authentifikator-App</p>
                        <p className="text-xs text-text-muted">Google Authenticator</p>
                      </div>
                    </div>
                    <span className="text-xs text-success font-medium">Aktiviert</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── BENACHRICHTIGUNGEN ── */}
            {activeTab === "notifications" && (
              <div className="p-6 bg-bg-secondary border border-border rounded-xl space-y-6">
                <h2 className="font-semibold text-text-primary">Benachrichtigungseinstellungen</h2>
                {[
                  { section: "Buchungen & Anfragen", items: ["Neue Buchungsanfrage", "Buchung bestätigt", "Buchung storniert"] },
                  { section: "Nachrichten",          items: ["Neue Nachricht von einem Anbieter", "Nachricht von einer Produktion"] },
                  { section: "Marketing",            items: ["Plattform-Updates und neue Features", "Tipps für bessere Inserate"] },
                ].map(({ section, items }) => (
                  <div key={section}>
                    <h3 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">{section}</h3>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item} className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">{item}</span>
                          <div className="flex gap-4">
                            {["E-Mail", "Push"].map((ch) => (
                              <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" defaultChecked className="accent-gold" />
                                <span className="text-xs text-text-muted">{ch}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={() => addToast("Einstellungen gespeichert", "success")}
                  className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors">
                  Einstellungen speichern
                </button>
              </div>
            )}

            {/* ── ABRECHNUNG ── */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-text-primary flex items-center gap-2">
                      <Wallet size={16} className="text-gold" /> Auszahlungskonto
                    </h2>
                  </div>
                  <p className="text-xs text-text-muted mb-5 leading-relaxed">
                    Nach Abschluss einer Buchung wird deine Auszahlung (Buchungsbetrag minus Provision) auf dieses Konto überwiesen.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Kontoinhaber</label>
                      <input type="text" value={payout.accountHolder}
                        onChange={(e) => setPayout(p => ({ ...p, accountHolder: e.target.value }))}
                        placeholder={form.name || "Dein Name"}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">IBAN</label>
                      <input type="text" value={payout.iban}
                        onChange={(e) => setPayout(p => ({ ...p, iban: e.target.value }))}
                        placeholder="DE89 3704 0044 ..."
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">BIC / SWIFT</label>
                      <input type="text" value={payout.bic}
                        onChange={(e) => setPayout(p => ({ ...p, bic: e.target.value }))}
                        placeholder="COBADEFFXXX"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Bank</label>
                      <input type="text" value={payout.bank}
                        onChange={(e) => setPayout(p => ({ ...p, bank: e.target.value }))}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">USt-IdNr. <span className="font-normal normal-case tracking-normal text-text-muted">(optional)</span></label>
                      <input type="text" value={payout.vatId}
                        onChange={(e) => setPayout(p => ({ ...p, vatId: e.target.value }))}
                        placeholder="DE123456789"
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-5 pt-5 border-t border-border">
                    <button
                      onClick={async () => { setPayoutSaving(true); await new Promise(r => setTimeout(r, 700)); setPayoutSaving(false); addToast("Auszahlungskonto gespeichert", "success"); }}
                      disabled={payoutSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">
                      {payoutSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {payoutSaving ? "Wird gespeichert..." : "Konto speichern"}
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-bg-secondary border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-text-primary">Mein Konto</h2>
                    <span className="px-3 py-1 bg-success/10 border border-success/20 text-success text-xs font-semibold rounded-full">
                      Kostenlos · Aktiv
                    </span>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">
                    CineGenius ist komplett kostenlos. Du zahlst nur eine gestaffelte Provision bei erfolgreichen Buchungen — kein Abo, keine Grundgebühr.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </ProfileGuard>
  );
}
