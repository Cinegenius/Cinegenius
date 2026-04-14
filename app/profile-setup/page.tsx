"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, Camera, CheckCircle } from "lucide-react";
import { getPresetForType, type ProfileType } from "@/lib/profile-types";

// ─── Rollenliste ──────────────────────────────────────────────────────────────

const FILMMAKER_ROLES: { type: ProfileType; label: string; emoji: string }[] = [
  // Talent
  { type: "actor",       label: "Schauspieler",    emoji: "🎭" },
  { type: "model",       label: "Model",            emoji: "📸" },
  { type: "extra",       label: "Komparse",         emoji: "🎬" },
  { type: "host",        label: "Moderator / Host", emoji: "🎤" },
  { type: "dancer",      label: "Tänzer",           emoji: "💃" },
  { type: "stunt",       label: "Stuntman/-frau",   emoji: "🔥" },
  { type: "voiceover",   label: "Sprecher",         emoji: "🎙" },
  { type: "creator",     label: "Content Creator",  emoji: "📱" },
  // Crew
  { type: "camera",               label: "Kamera",         emoji: "🎥" },
  { type: "director_of_photography", label: "DoP",         emoji: "🎞" },
  { type: "director",             label: "Regisseur",      emoji: "🎬" },
  { type: "production",           label: "Produktion",     emoji: "📋" },
  { type: "lighting",             label: "Licht",          emoji: "💡" },
  { type: "sound",                label: "Ton",            emoji: "🎚" },
  { type: "makeup",               label: "Maske",          emoji: "💄" },
  { type: "costume",              label: "Kostüm",         emoji: "👗" },
  { type: "postproduction",       label: "Schnitt / Post", emoji: "🖥" },
  { type: "vfx",                  label: "VFX",            emoji: "✨" },
  { type: "sfx",                  label: "SFX",            emoji: "💥" },
  { type: "art_department",       label: "Szenenbild",     emoji: "🏛" },
  { type: "broadcast",            label: "Broadcast",      emoji: "📡" },
  // Kreativ
  { type: "filmmaker",      label: "Filmemacher",     emoji: "🎬" },
  { type: "photographer",   label: "Fotograf",        emoji: "📷" },
  { type: "writer",         label: "Autor / Texter",  emoji: "✍️" },
  { type: "editor",         label: "Editor",          emoji: "✂️" },
  { type: "motion_designer",label: "Motion Design",   emoji: "🎨" },
  { type: "art_director",   label: "Art Director",    emoji: "🖌" },
];

const VENDOR_ROLES: { type: ProfileType; label: string; emoji: string }[] = [
  { type: "location",    label: "Location",     emoji: "📍" },
  { type: "equipment",   label: "Equipment",    emoji: "🔧" },
  { type: "studio",      label: "Studio",       emoji: "🏢" },
  { type: "vehicle",     label: "Fahrzeuge",    emoji: "🚐" },
  { type: "props",       label: "Props",        emoji: "🪄" },
];

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
      window.location.href = "/dashboard";
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
                Was machst du?
              </h1>
              <p className="text-sm text-text-muted">Wähle deine Rolle — du kannst sie später ändern.</p>
            </div>

            {/* Filmschaffende & Creator */}
            <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-2 px-1">
              Filmschaffende & Creator
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {FILMMAKER_ROLES.map(r => (
                <button
                  key={r.type}
                  onClick={() => setProfileType(r.type)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-95 ${
                    profileType === r.type
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border bg-bg-secondary text-text-secondary"
                  }`}
                >
                  <span className="text-xl leading-none">{r.emoji}</span>
                  <span className="text-sm font-medium leading-tight">{r.label}</span>
                  {profileType === r.type && (
                    <CheckCircle size={14} className="ml-auto shrink-0 text-gold" />
                  )}
                </button>
              ))}
            </div>

            {/* Anbieter */}
            <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-2 px-1">
              Ich vermiete / biete an
            </p>
            <div className="grid grid-cols-2 gap-2">
              {VENDOR_ROLES.map(r => (
                <button
                  key={r.type}
                  onClick={() => setProfileType(r.type)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-95 ${
                    profileType === r.type
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border bg-bg-secondary text-text-secondary"
                  }`}
                >
                  <span className="text-xl leading-none">{r.emoji}</span>
                  <span className="text-sm font-medium leading-tight">{r.label}</span>
                  {profileType === r.type && (
                    <CheckCircle size={14} className="ml-auto shrink-0 text-gold" />
                  )}
                </button>
              ))}
            </div>
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
