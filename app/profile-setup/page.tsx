"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight, ArrowLeft, CheckCircle, Loader2, Camera, Upload, X,
  ChevronUp, ChevronDown, GripVertical, Eye, EyeOff, Sparkles,
} from "lucide-react";
import {
  PROFILE_TYPE_LABELS, PROFILE_CATEGORY_MAP, getPresetForType,
  type ProfileType, type ProfileModule, type ModuleType,
} from "@/lib/profile-types";

// ─── Konstanten ───────────────────────────────────────────────────────────────

const STEPS = ["Profiltyp", "Basics", "Details", "Medien", "Module"] as const;
type Step = 0 | 1 | 2 | 3 | 4;

const CATEGORIES = [
  {
    key: "talent", label: "Talent / Performance",
    desc: "Schauspieler, Model, Komparse, Tänzer …",
    types: ["actor","model","extra","host","dancer","stunt","voiceover","creator"] as ProfileType[],
  },
  {
    key: "crew", label: "Filmcrew / Technik",
    desc: "Kamera, Licht, Ton, Regie, Produktion …",
    types: ["camera","lighting","sound","director_of_photography","director","production","makeup","costume","postproduction","vfx","sfx","art_department","broadcast"] as ProfileType[],
  },
  {
    key: "creative", label: "Kreativ",
    desc: "Regisseur, Fotograf, Editor, Motion Designer …",
    types: ["filmmaker","writer","photographer","editor","motion_designer","art_director"] as ProfileType[],
  },
  {
    key: "vendor", label: "Anbieter",
    desc: "Location, Equipment, Fahrzeuge, Studio …",
    types: ["location","equipment","vehicle","studio","props"] as ProfileType[],
  },
];

const HAIR_COLORS = ["Schwarz","Dunkelbraun","Braun","Hellbraun","Blond","Hellblond","Rot","Grau","Weiß","Gefärbt"];
const EYE_COLORS  = ["Braun","Dunkelbraun","Grün","Blaugrün","Blau","Grau","Haselnuss","Schwarz"];
const BODY_TYPES  = [
  { id:"slim", label:"Schlank" }, { id:"athletic", label:"Athletisch" },
  { id:"normal", label:"Normal" }, { id:"strong", label:"Kräftig" },
  { id:"muscular", label:"Muskulös" }, { id:"curvy", label:"Kurvig" },
];
const DEPARTMENTS_CREW = [
  "Kamera","Licht","Ton","Regie","Produktion","Szenenbild",
  "Maske","Kostüm","Schnitt","VFX","SFX","Broadcast",
];

const MODULE_LABELS: Record<ModuleType, string> = {
  hero:"Hero (Header)", facts:"Kerndaten", portfolio:"Portfolio / Fotos",
  showreel:"Showreel / Video", about:"Über mich", skills:"Fähigkeiten",
  filmography:"Filmografie", awards:"Auszeichnungen", listings:"Inserate",
  availability:"Verfügbarkeit", downloads:"Downloads / Sedcard",
  agency:"Agentur / Management", contact:"Kontakt",
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function ProfileSetupPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 0 – Profiltyp
  const [profileType, setProfileType] = useState<ProfileType | null>(null);

  // Step 1 – Basics
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [tagline, setTagline] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");

  // Step 2 – Details (talent)
  const [playingAgeMin, setPlayingAgeMin] = useState("");
  const [playingAgeMax, setPlayingAgeMax] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [bodyType, setBodyType] = useState("");
  // Step 2 – Details (crew/creative)
  const [department, setDepartment] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
  const [newPosition, setNewPosition] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [ownEquipment, setOwnEquipment] = useState(false);
  // Step 2 – Details (vendor)
  const [companyName, setCompanyName] = useState("");
  const [serviceRadius, setServiceRadius] = useState("");
  const [deliveryPossible, setDeliveryPossible] = useState(false);

  // Step 3 – Medien
  const [showreelUrl, setShowreelUrl] = useState("");

  // Step 4 – Module
  const [modules, setModules] = useState<ProfileModule[]>([]);

  // Redirect wenn schon Profil vorhanden
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/profile").then(r => r.json()).then(({ exists }) => {
      if (exists) router.replace("/dashboard");
    });
  }, [isLoaded, user, router]);

  // Name aus Clerk vorausfüllen
  useEffect(() => {
    if (isLoaded && user) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (full) setDisplayName(full);
    }
  }, [isLoaded, user]);

  // Module laden wenn Profiltyp gewählt
  useEffect(() => {
    if (profileType) setModules(getPresetForType(profileType));
  }, [profileType]);

  const category = profileType ? PROFILE_CATEGORY_MAP[profileType] : null;

  // ── Avatar Upload ──────────────────────────────────────────────────────────
  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const { url } = await res.json();
      setAvatarUrl(url);
    } finally {
      setUploading(false);
    }
  }

  // ── Module toggle / reorder ────────────────────────────────────────────────
  function toggle(type: ModuleType) {
    setModules(prev => prev.map(m =>
      m.type === type && !m.locked ? { ...m, enabled: !m.enabled } : m
    ));
  }
  function moveUp(type: ModuleType) {
    setModules(prev => {
      const i = prev.findIndex(m => m.type === type);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i-1], next[i]] = [next[i], next[i-1]];
      return next.map((m, j) => ({ ...m, order: j }));
    });
  }
  function moveDown(type: ModuleType) {
    setModules(prev => {
      const i = prev.findIndex(m => m.type === type);
      if (i < 0 || i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i+1]] = [next[i+1], next[i]];
      return next.map((m, j) => ({ ...m, order: j }));
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 0) return !!profileType;
    if (step === 1) return displayName.trim().length >= 2 && city.trim().length >= 2;
    return true;
  }

  function next() {
    if (step < 4) setStep((step + 1) as Step);
  }
  function back() {
    if (step > 0) setStep((step - 1) as Step);
  }

  // ── Speichern ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!profileType) return;
    setSaving(true);
    try {
      const physical = category === "talent" ? {
        height_cm: heightCm ? Number(heightCm) : undefined,
        hair_color: hairColor || undefined,
        eye_color: eyeColor || undefined,
        body_type: bodyType || undefined,
        playing_age_min: playingAgeMin ? Number(playingAgeMin) : undefined,
        playing_age_max: playingAgeMax ? Number(playingAgeMax) : undefined,
      } : undefined;

      const crew = (category === "crew" || category === "creative") ? {
        department: department || undefined,
        positions: positions.length ? positions : undefined,
        experience_years: experienceYears ? Number(experienceYears) : undefined,
        day_rate: dayRate ? Number(dayRate) : undefined,
        own_equipment: ownEquipment || undefined,
      } : undefined;

      const vendor = category === "vendor" ? {
        company_name: companyName || undefined,
        vendor_category: profileType,
        service_radius_km: serviceRadius ? Number(serviceRadius) : undefined,
        delivery_possible: deliveryPossible || undefined,
      } : undefined;

      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          location: city.trim(),
          bio: "",
          avatar_url: avatarUrl || null,
          skills: [],
          positions,
        }),
      });

      await fetch("/api/profile/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_type: profileType, modules }),
      });

      // Erweiterte Felder via PATCH
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagline: tagline.trim() || undefined,
          showreel_url: showreelUrl.trim() || undefined,
          ...(physical && { physical }),
          ...(crew && { crew }),
          ...(vendor && { vendor }),
        }),
      });

      router.push("/dashboard");
    } catch {
      setSaving(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="h-0.5 bg-border">
          <div
            className="h-full bg-gold transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Header */}
      <div className="pt-8 pb-2 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="font-display font-bold text-xl text-gold tracking-tight">CineGenius</span>
        </div>
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1 mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all ${
                i < step ? "bg-gold text-bg-primary" :
                i === step ? "bg-gold/20 text-gold border border-gold" :
                "bg-bg-elevated text-text-muted border border-border"
              }`}>
                {i < step ? <CheckCircle size={12} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px transition-colors ${i < step ? "bg-gold" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted">{STEPS[step]}</p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl">

          {/* ── STEP 0: Profiltyp ── */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <Sparkles size={32} className="text-gold mx-auto mb-3" />
                <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                  Was bist du auf CineGenius?
                </h1>
                <p className="text-sm text-text-muted">
                  Wähle deinen Hauptbereich — du kannst später weitere hinzufügen.
                </p>
              </div>

              {CATEGORIES.map(cat => (
                <div key={cat.key}>
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{cat.label}</p>
                    <p className="text-xs text-text-muted/70 mt-0.5">{cat.desc}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {cat.types.map(t => (
                      <button
                        key={t}
                        onClick={() => setProfileType(t)}
                        className={`px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          profileType === t
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40 hover:text-text-primary"
                        }`}
                      >
                        {profileType === t && <CheckCircle size={11} className="inline mr-1.5 -mt-0.5" />}
                        {PROFILE_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 1: Basics ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                  Dein öffentliches Profil
                </h1>
                <p className="text-sm text-text-muted">
                  Diese Infos sehen andere Nutzer als Erstes.
                </p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 p-6 bg-bg-secondary border border-border rounded-xl">
                <div className="relative">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gold/10 border-2 border-gold/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gold">
                        {displayName.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-gold rounded-full flex items-center justify-center hover:bg-gold-light transition-colors"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin text-bg-primary" /> : <Camera size={13} className="text-bg-primary" />}
                  </button>
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-xs text-text-muted hover:text-gold transition-colors">
                  <Upload size={12} className="inline mr-1" /> Foto hochladen
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Name / Künstlername *
                </label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Dein Anzeigename"
                  className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Stadt *
                </label>
                <input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="z.B. München, Berlin …"
                  className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  Kurzheadline
                </label>
                <input
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder={
                    category === "talent" ? "z.B. Schauspielerin · München · verfügbar" :
                    category === "crew"   ? "z.B. DoP · 10 Jahre Erfahrung · ARRI zertifiziert" :
                    category === "vendor" ? "z.B. Lofts & Fabrikhallen in Berlin" :
                    "Dein Kurzprofil in einem Satz"
                  }
                  maxLength={80}
                  className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
                <p className="text-[11px] text-text-muted mt-1 text-right">{tagline.length}/80</p>
              </div>
            </div>
          )}

          {/* ── STEP 2: Details ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                  {category === "talent" ? "Casting-Daten" :
                   category === "vendor" ? "Anbieter-Infos" : "Berufsdetails"}
                </h1>
                <p className="text-sm text-text-muted">
                  Diese Daten machen dich suchbar und filterbar.
                </p>
              </div>

              {/* Talent */}
              {category === "talent" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Spielalter von</label>
                      <input type="number" min="1" max="99" value={playingAgeMin} onChange={e => setPlayingAgeMin(e.target.value)}
                        placeholder="18" className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Spielalter bis</label>
                      <input type="number" min="1" max="99" value={playingAgeMax} onChange={e => setPlayingAgeMax(e.target.value)}
                        placeholder="35" className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Größe (cm)</label>
                    <input type="number" min="100" max="220" value={heightCm} onChange={e => setHeightCm(e.target.value)}
                      placeholder="170" className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Haarfarbe</label>
                    <div className="flex flex-wrap gap-2">
                      {HAIR_COLORS.map(c => (
                        <button key={c} onClick={() => setHairColor(c === hairColor ? "" : c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            hairColor === c ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40"
                          }`}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Augenfarbe</label>
                    <div className="flex flex-wrap gap-2">
                      {EYE_COLORS.map(c => (
                        <button key={c} onClick={() => setEyeColor(c === eyeColor ? "" : c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            eyeColor === c ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40"
                          }`}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Körperbau</label>
                    <div className="grid grid-cols-3 gap-2">
                      {BODY_TYPES.map(b => (
                        <button key={b.id} onClick={() => setBodyType(b.id === bodyType ? "" : b.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            bodyType === b.id ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40"
                          }`}>{b.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Crew / Creative */}
              {(category === "crew" || category === "creative") && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                      {category === "creative" ? "Bereich" : "Gewerk / Department"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENTS_CREW.map(d => (
                        <button key={d} onClick={() => setDepartment(d === department ? "" : d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            department === d ? "border-gold bg-gold/10 text-gold" : "border-border bg-bg-secondary text-text-secondary hover:border-gold/40"
                          }`}>{d}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Positionen / Rollen</label>
                    <div className="flex gap-2 mb-2">
                      <input value={newPosition} onChange={e => setNewPosition(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && newPosition.trim()) { setPositions(p => [...p, newPosition.trim()]); setNewPosition(""); }}}
                        placeholder="z.B. Kameramann, Focus Puller …"
                        className="flex-1 bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                      <button onClick={() => { if (newPosition.trim()) { setPositions(p => [...p, newPosition.trim()]); setNewPosition(""); }}}
                        className="px-4 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors">+</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {positions.map(p => (
                        <span key={p} className="inline-flex items-center gap-1 px-3 py-1 bg-bg-elevated border border-border rounded-full text-xs text-text-secondary">
                          {p}
                          <button onClick={() => setPositions(prev => prev.filter(x => x !== p))}><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Erfahrung (Jahre)</label>
                      <input type="number" min="0" max="50" value={experienceYears} onChange={e => setExperienceYears(e.target.value)}
                        placeholder="5"
                        className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Tagesgage (€)</label>
                      <input type="number" min="0" value={dayRate} onChange={e => setDayRate(e.target.value)}
                        placeholder="600"
                        className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setOwnEquipment(v => !v)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${ownEquipment ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ownEquipment ? "left-5" : "left-0.5"}`} />
                    </div>
                    <span className="text-sm text-text-secondary">Eigenes Equipment vorhanden</span>
                  </label>
                </div>
              )}

              {/* Vendor */}
              {category === "vendor" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Firmen- oder Anbietername</label>
                    <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                      placeholder="z.B. Studio Müller GmbH"
                      className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Einzugsgebiet (km)</label>
                    <input type="number" min="0" value={serviceRadius} onChange={e => setServiceRadius(e.target.value)}
                      placeholder="50"
                      className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => setDeliveryPossible(v => !v)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${deliveryPossible ? "bg-gold" : "bg-bg-elevated border border-border"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${deliveryPossible ? "left-5" : "left-0.5"}`} />
                    </div>
                    <span className="text-sm text-text-secondary">Lieferung / Transport möglich</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Medien ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Showreel & Video</h1>
                <p className="text-sm text-text-muted">
                  Ein Showreel erhöht deine Buchungsrate erheblich.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
                  YouTube oder Vimeo Link
                </label>
                <input
                  value={showreelUrl}
                  onChange={e => setShowreelUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>

              <div className="p-5 bg-gold/5 border border-gold/20 rounded-xl">
                <p className="text-xs text-text-muted leading-relaxed">
                  <strong className="text-text-secondary">Tipp:</strong> Fotos kannst du nach dem Onboarding im Dashboard hochladen — dort hast du mehr Platz und kannst sie besser organisieren.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 4: Module ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Dein Profil-Layout</h1>
                <p className="text-sm text-text-muted">
                  Wähle welche Bereiche sichtbar sein sollen. Du kannst das jederzeit ändern.
                </p>
              </div>

              <div className="space-y-2">
                {modules.map((mod, i) => (
                  <div key={mod.type}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      mod.enabled ? "border-border bg-bg-secondary" : "border-border/40 bg-bg-primary opacity-50"
                    }`}
                  >
                    <GripVertical size={13} className="text-text-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${mod.enabled ? "text-text-primary" : "text-text-muted"}`}>
                        {MODULE_LABELS[mod.type]}
                        {mod.locked && <span className="ml-2 text-[10px] text-gold/60 uppercase tracking-wider">immer aktiv</span>}
                      </p>
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button onClick={() => moveUp(mod.type)} disabled={i === 0}
                        className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-20 transition-colors">
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => moveDown(mod.type)} disabled={i === modules.length - 1}
                        className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-20 transition-colors">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <button onClick={() => toggle(mod.type)} disabled={!!mod.locked}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        mod.locked ? "opacity-20 cursor-not-allowed" :
                        mod.enabled ? "bg-gold/10 text-gold hover:bg-gold/20" : "bg-bg-elevated text-text-muted hover:bg-bg-secondary"
                      }`}>
                      {mod.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="flex items-center gap-3 mt-10">
            {step > 0 && (
              <button onClick={back}
                className="flex items-center gap-2 px-5 py-3 border border-border text-text-secondary text-sm font-medium rounded-xl hover:border-gold/40 hover:text-text-primary transition-colors">
                <ArrowLeft size={15} /> Zurück
              </button>
            )}

            {step < 4 ? (
              <button onClick={next} disabled={!canAdvance()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40">
                Weiter <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {saving ? "Wird erstellt…" : "Profil erstellen"}
              </button>
            )}
          </div>

          {/* Skip */}
          {step >= 2 && step < 4 && (
            <button onClick={next} className="w-full text-center text-xs text-text-muted hover:text-text-secondary mt-3 transition-colors py-2">
              Überspringen →
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
