"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Loader2, Camera, CheckCircle,
  Drama, User, Users, Mic2, Music, Zap, Mic, Smartphone,
  Film, Clapperboard, ClipboardList, Lightbulb, Sparkles, Shirt,
  Monitor, Layers, Palette, Radio, Aperture, PenLine, Scissors,
  MapPin, Wrench, Building2, Car, Package,
} from "lucide-react";
import type { ElementType } from "react";
import { getPresetForType, type ProfileType } from "@/lib/profile-types";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";

// ─── Rollenliste ──────────────────────────────────────────────────────────────

const FILMMAKER_ROLES: { type: ProfileType; label: string; icon: ElementType }[] = [
  // Talent
  { type: "actor",                  label: "Schauspieler",    icon: Drama },
  { type: "model",                  label: "Model",            icon: User },
  { type: "extra",                  label: "Komparse",         icon: Users },
  { type: "host",                   label: "Moderator / Host", icon: Mic2 },
  { type: "dancer",                 label: "Tänzer",           icon: Music },
  { type: "stunt",                  label: "Stuntman/-frau",   icon: Zap },
  { type: "voiceover",              label: "Sprecher",         icon: Mic },
  { type: "creator",                label: "Content Creator",  icon: Smartphone },
  // Crew
  { type: "camera",                 label: "Kamera",           icon: Camera },
  { type: "director_of_photography",label: "DoP",              icon: Film },
  { type: "director",               label: "Regisseur",        icon: Clapperboard },
  { type: "production",             label: "Produktion",       icon: ClipboardList },
  { type: "lighting",               label: "Licht",            icon: Lightbulb },
  { type: "sound",                  label: "Ton",              icon: Mic },
  { type: "makeup",                 label: "Maske",            icon: Sparkles },
  { type: "costume",                label: "Kostüm",           icon: Shirt },
  { type: "postproduction",         label: "Schnitt / Post",   icon: Monitor },
  { type: "vfx",                    label: "VFX",              icon: Layers },
  { type: "sfx",                    label: "SFX",              icon: Zap },
  { type: "art_department",         label: "Szenenbild",       icon: Palette },
  { type: "broadcast",              label: "Broadcast",        icon: Radio },
  // Kreativ
  { type: "filmmaker",              label: "Filmemacher",      icon: Clapperboard },
  { type: "photographer",           label: "Fotograf",         icon: Aperture },
  { type: "writer",                 label: "Autor / Texter",   icon: PenLine },
  { type: "editor",                 label: "Editor",           icon: Scissors },
  { type: "motion_designer",        label: "Motion Design",    icon: Layers },
  { type: "art_director",           label: "Art Director",     icon: Palette },
];

const VENDOR_ROLES: { type: ProfileType; label: string; icon: ElementType }[] = [
  { type: "location",  label: "Location",   icon: MapPin },
  { type: "equipment", label: "Equipment",  icon: Wrench },
  { type: "studio",    label: "Studio",     icon: Building2 },
  { type: "vehicle",   label: "Fahrzeuge",  icon: Car },
  { type: "props",     label: "Props",      icon: Package },
];

// ─── Kategorien für 2-Stufen Auswahl ─────────────────────────────────────────

const CATEGORIES = [
  {
    id: "talent",
    label: "Talent",
    icon: Drama,
    desc: "Schauspieler, Model, Creator …",
    types: ["actor","model","extra","host","dancer","stunt","voiceover","creator"],
  },
  {
    id: "crew",
    label: "Filmcrew",
    icon: Clapperboard,
    desc: "Kamera, Licht, Ton, Regie …",
    types: ["camera","director_of_photography","director","production","lighting","sound","makeup","costume","postproduction","vfx","sfx","art_department","broadcast"],
  },
  {
    id: "kreativ",
    label: "Kreativ",
    icon: Palette,
    desc: "Fotograf, Editor, Art Director …",
    types: ["filmmaker","photographer","writer","editor","motion_designer","art_director"],
  },
  {
    id: "anbieter",
    label: "Anbieter",
    icon: Building2,
    desc: "Location, Equipment, Studio …",
    types: ["location","equipment","studio","vehicle","props"],
  },
] as const;

function RolePicker({
  filmmakerroles,
  vendorroles,
  selected,
  onSelect,
}: {
  filmmakerroles: { type: ProfileType; label: string; icon: ElementType }[];
  vendorroles: { type: ProfileType; label: string; icon: ElementType }[];
  selected: ProfileType | null;
  onSelect: (t: ProfileType) => void;
}) {
  const allRoles = [...filmmakerroles, ...vendorroles];
  const [openCat, setOpenCat] = useState<string | null>(() => {
    if (!selected) return null;
    return CATEGORIES.find(c => (c.types as readonly string[]).includes(selected))?.id ?? null;
  });

  return (
    <div className="space-y-3">
      {CATEGORIES.map(cat => {
        const isOpen = openCat === cat.id;
        const catRoles = allRoles.filter(r => (cat.types as readonly string[]).includes(r.type));
        const selectedInCat = catRoles.find(r => r.type === selected);

        return (
          <div key={cat.id} className="rounded-2xl border border-border overflow-hidden">
            {/* Kategorie-Header */}
            <button
              onClick={() => setOpenCat(isOpen ? null : cat.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors ${
                isOpen ? "bg-bg-elevated" : "bg-bg-secondary hover:bg-bg-elevated"
              }`}
            >
              <cat.icon size={22} className="text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm">{cat.label}</p>
                <p className="text-xs text-text-muted">
                  {selectedInCat ? <span className="text-gold">{selectedInCat.label} gewählt</span> : cat.desc}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedInCat && <CheckCircle size={16} className="text-gold" />}
                <span className={`text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </div>
            </button>

            {/* Unterrollen */}
            {isOpen && (
              <div className="border-t border-border px-3 py-3 grid grid-cols-2 gap-2 bg-bg-primary">
                {catRoles.map(r => (
                  <button
                    key={r.type}
                    onClick={() => onSelect(r.type)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                      selected === r.type
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border bg-bg-secondary text-text-secondary hover:border-border-light"
                    }`}
                  >
                    <r.icon size={14} className="shrink-0" />
                    <span className="text-xs font-medium leading-tight">{r.label}</span>
                    {selected === r.type && <CheckCircle size={12} className="ml-auto shrink-0 text-gold" />}
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

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function ProfileSetupPage() {
  const { user, isLoaded } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({ x: 50, y: 33 });
  const [focalPickerImage, setFocalPickerImage] = useState<string | null>(null);

  // Redirect wenn schon Profil vorhanden
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/profile").then(r => r.json()).then(({ exists }) => {
      if (exists) {
        // GET-Handler setzt das Cookie — hard redirect damit Middleware sofort durchlässt
        window.location.replace("/dashboard");
      }
    });
  }, [isLoaded, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Name aus Clerk vorausfüllen
  useEffect(() => {
    if (isLoaded && user) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (full) setDisplayName(full);
    }
  }, [isLoaded, user]);

  // ── Avatar Upload ────────────────────────────────────────────────────────
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
      setFocalPickerImage(url);
    } finally {
      setUploading(false);
    }
  }

  // ── Speichern ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!profileType || !displayName.trim() || !city.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          location: city.trim(),
          bio: "",
          avatar_url: avatarUrl || null,
          focal_point: avatarUrl ? focalPoint : undefined,
          skills: [],
          positions: [],
          account_type: "person",
          profile_types: [profileType],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[profile-setup] POST failed:", err);
        setSaving(false);
        return;
      }

      // Modules im Hintergrund — nicht blockierend
      const modules = getPresetForType(profileType);
      fetch("/api/profile/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_type: profileType, modules }),
      }).catch(() => {});

      // Hard redirect — das Cookie aus dem POST-Response wird mitgesendet,
      // Middleware lässt den User sofort durch ohne JWT-Wartezeit.
      window.location.href = "/dashboard?welcome=1";
    } catch (e) {
      console.error("[profile-setup] save error:", e);
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
      {focalPickerImage && (
        <FocalPointPicker
          imageUrl={focalPickerImage}
          initial={focalPoint}
          onSave={(pt) => { setFocalPoint(pt); setFocalPickerImage(null); }}
          onClose={() => setFocalPickerImage(null)}
        />
      )}

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-border">
        <div
          className="h-full bg-gold transition-all duration-500"
          style={{ width: step === 0 ? "50%" : "100%" }}
        />
      </div>

      {/* Logo */}
      <div className="pt-8 pb-4 text-center">
        <span className="font-display font-bold text-lg text-gold tracking-tight">CineGenius</span>
        <p className="text-xs text-text-muted mt-1">Schritt {step + 1} von 2</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-32 max-w-lg mx-auto w-full">

        {/* ── STEP 0: Rolle wählen ── */}
        {step === 0 && (
          <div>
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
                Ich bin …
              </h1>
              <p className="text-sm text-text-muted">Wähle deine Kategorie — du kannst sie später ändern.</p>
            </div>

            <RolePicker
              filmmakerroles={FILMMAKER_ROLES}
              vendorroles={VENDOR_ROLES}
              selected={profileType}
              onSelect={setProfileType}
            />
          </div>
        )}

        {/* ── STEP 1: Name & Foto ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
                Dein Profil
              </h1>
              <p className="text-sm text-text-muted">Kurz und fertig — alles andere später.</p>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative"
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-2 border-gold/40"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gold/10 border-2 border-gold/20 flex flex-col items-center justify-center gap-1">
                    <Camera size={20} className="text-gold/60" />
                    <span className="text-[10px] text-gold/60">Foto</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              <p className="text-xs text-text-muted">optional</p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest block mb-1.5">
                {profileType && VENDOR_ROLES.some(r => r.type === profileType) ? "Name / Firmenname *" : "Name / Künstlername *"}
              </label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={profileType && VENDOR_ROLES.some(r => r.type === profileType) ? "z.B. Studio Müller GmbH" : "Dein Anzeigename"}
                className="w-full bg-bg-secondary border border-border rounded-2xl px-4 py-3.5 text-base text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Vendor hint */}
            {profileType && VENDOR_ROLES.some(r => r.type === profileType) && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gold/5 border border-gold/20">
                <span className="text-lg leading-none mt-0.5">💡</span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Nach der Registrierung kannst du im Dashboard ein Inserat erstellen — damit erscheinst du im Marktplatz.
                </p>
              </div>
            )}

            {/* Stadt */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest block mb-1.5">
                Stadt *
              </label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="z.B. Wien, München, Berlin …"
                className="w-full bg-bg-secondary border border-border rounded-2xl px-4 py-3.5 text-base text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg-primary border-t border-border px-4 py-4 safe-area-pb">
        <div className="max-w-lg mx-auto flex gap-3">
          {step === 1 && (
            <button
              onClick={() => setStep(0)}
              className="px-5 py-3.5 rounded-2xl border border-border text-text-secondary text-sm font-semibold"
            >
              Zurück
            </button>
          )}

          {step === 0 && (
            <button
              onClick={() => setStep(1)}
              disabled={!profileType}
              className="flex-1 py-3.5 rounded-2xl bg-gold text-bg-primary font-bold text-base disabled:opacity-30 transition-opacity active:scale-95"
            >
              Weiter
            </button>
          )}

          {step === 1 && (
            <button
              onClick={handleSave}
              disabled={!displayName.trim() || !city.trim() || saving || uploading}
              className="flex-1 py-3.5 rounded-2xl bg-gold text-bg-primary font-bold text-base disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95"
            >
              {saving ? (
                <><Loader2 size={18} className="animate-spin" /> Speichern…</>
              ) : (
                "Profil erstellen"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
