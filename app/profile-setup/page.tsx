"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { compressAvatar } from "@/lib/compressImage";
import { useUser } from "@clerk/nextjs";
import {
  Loader2, Camera, CheckCircle,
  MapPin, Wrench, Users, Briefcase, ShoppingBag, ArrowRight,
} from "lucide-react";
import type { ElementType } from "react";
import { getPresetForType, type ProfileType } from "@/lib/profile-types";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";
import Link from "next/link";

// Only allow same-origin redirects to prevent open redirect after sign-up
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

// ─── Intent → ProfileType mapping ────────────────────────────────────────────

type Intent = {
  id: string;
  label: string;
  desc: string;
  icon: ElementType;
  profileType: ProfileType;
  browseHref: string;      // where "Angebote durchsuchen" links for this intent
};

const INTENTS: Intent[] = [
  {
    id: "location",
    label: "Meine Location vermieten",
    desc: "Wohnung, Loft, Halle, Studio — für Foto-, Video- oder Filmaufnahmen.",
    icon: MapPin,
    profileType: "location",
    browseHref: "/locations",
  },
  {
    id: "creative",
    label: "Aufträge finden (Foto / Video / Content)",
    desc: "Du fotografierst, filmst oder erstellst Content und suchst Kunden.",
    icon: Camera,
    profileType: "creator",
    browseHref: "/jobs",
  },
  {
    id: "crew",
    label: "Bei Filmprojekten mitarbeiten",
    desc: "Kamera, Licht, Ton, Regie, Schnitt — du willst Teil einer Produktion sein.",
    icon: Users,
    profileType: "camera",
    browseHref: "/jobs",
  },
  {
    id: "equipment",
    label: "Equipment vermieten",
    desc: "Kameras, Licht, Ton, Requisiten oder Fahrzeuge — tageweise vermieten.",
    icon: Wrench,
    profileType: "equipment",
    browseHref: "/props",
  },
  {
    id: "booker",
    label: "Etwas mieten oder buchen",
    desc: "Du suchst eine Location, Crew, Equipment oder Jobs für dein Projekt.",
    icon: ShoppingBag,
    profileType: "production",
    browseHref: "/locations",
  },
];

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function ProfileSetupPage() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [selectedIntents, setSelectedIntents] = useState<Intent[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({ x: 50, y: 33 });
  const [focalPickerImage, setFocalPickerImage] = useState<string | null>(null);

  // Redirect if profile already exists
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/profile").then(r => r.json()).then(({ exists }) => {
      if (exists) {
        window.location.replace(safeRedirect(searchParams.get("redirect")));
      }
    });
  }, [isLoaded, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill name from Clerk
  useEffect(() => {
    if (isLoaded && user) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (full) setDisplayName(full);
    }
  }, [isLoaded, user]);

  // ── Avatar Upload ─────────────────────────────────────────────────────────
  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview((prev) => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return objectUrl; });
    setUploading(true);
    try {
      const compressed = await compressAvatar(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      const { url } = await res.json();
      if (!url) throw new Error("Upload ohne URL");
      setAvatarUrl(url);
      setFocalPickerImage(url);
    } finally {
      setUploading(false);
    }
  }

  // ── Save profile + advance to step 2 ─────────────────────────────────────
  async function handleSave() {
    if (selectedIntents.length === 0 || !displayName.trim() || !city.trim()) return;
    setSaving(true);
    try {
      const profileTypes = selectedIntents.map((i) => i.profileType);
      const primaryType = profileTypes[0];
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
          profile_types: profileTypes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[profile-setup] POST failed:", err);
        setSaving(false);
        return;
      }

      // Save modules via the main profile PATCH (no separate /modules route needed)
      const modules = getPresetForType(primaryType);
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_type: primaryType, modules }),
      }).catch(() => {});

      setStep(2);
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

  const redirectTo = safeRedirect(searchParams.get("redirect"));

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
          style={{ width: step === 0 ? "33%" : step === 1 ? "66%" : "100%" }}
        />
      </div>

      {/* Logo */}
      <div className="pt-8 pb-4 text-center">
        <span className="font-display font-bold text-lg text-gold tracking-tight">CineGenius</span>
        {step < 2 && (
          <p className="text-xs text-text-muted mt-1">Schritt {step + 1} von 2</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-32 max-w-lg mx-auto w-full">

        {/* ── STEP 0: Intent selection ── */}
        {step === 0 && (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/20 rounded-full px-3 py-1 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                <span className="text-[11px] font-semibold text-gold uppercase tracking-widest">Schritt 1 von 2</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                Was möchtest du mit CineGenius machen?
              </h1>
              <p className="text-sm text-text-muted">
                Wähle das aus, das am besten zu dir passt — du kannst das später jederzeit ändern.
              </p>
            </div>

            <div className="space-y-2.5">
              {INTENTS.map((intent, i) => {
                const Icon = intent.icon;
                const isSelected = selectedIntents.some((s) => s.id === intent.id);
                return (
                  <button
                    key={intent.id}
                    onClick={() => setSelectedIntents((prev) =>
                      isSelected ? prev.filter((s) => s.id !== intent.id) : [...prev, intent]
                    )}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border text-left transition-all duration-150 active:scale-[0.985] ${
                      isSelected
                        ? "border-gold bg-gold/10 shadow-[0_0_0_1px_rgba(194,241,53,0.25),0_4px_20px_rgba(194,241,53,0.08)]"
                        : "border-border bg-bg-secondary hover:border-gold/30 hover:bg-bg-elevated"
                    }`}
                  >
                    {/* Number badge */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      isSelected ? "bg-gold text-bg-primary" : "bg-bg-elevated border border-border text-text-muted"
                    }`}>
                      {i + 1}
                    </div>

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-gold/20 border border-gold/40"
                        : "bg-bg-elevated border border-border group-hover:border-gold/20"
                    }`}>
                      <Icon size={18} className={isSelected ? "text-gold" : "text-text-secondary"} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm leading-tight ${isSelected ? "text-gold" : "text-text-primary"}`}>
                        {intent.label}
                      </p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isSelected ? "text-gold/60" : "text-text-muted"}`}>
                        {intent.desc}
                      </p>
                    </div>

                    {/* Check */}
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-gold border-gold"
                        : "border-border"
                    }`}>
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 1: Name, city, avatar ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                Fast geschafft
              </p>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
                Dein Profil dauert weniger als 1 Minute
              </h1>
              <p className="text-sm text-text-muted">
                Nur das Nötigste — alles andere kannst du später ergänzen.
              </p>
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
              <p className="text-xs text-text-muted">Profilfoto — optional</p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest block mb-1.5">
                Dein Name *
              </label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Wie sollen andere dich nennen?"
                className="w-full bg-bg-secondary border border-border rounded-2xl px-4 py-3.5 text-base text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Stadt */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest block mb-1.5">
                Deine Stadt *
              </label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="z.B. Wien, München, Berlin …"
                className="w-full bg-bg-secondary border border-border rounded-2xl px-4 py-3.5 text-base text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Intent summary */}
            {selectedIntents.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gold/5 border border-gold/20">
                <CheckCircle size={14} className="text-gold shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  {selectedIntents.map((s, i) => (
                    <span key={s.id}><span className="text-gold font-medium">{s.label}</span>{i < selectedIntents.length - 1 ? ", " : ""}</span>
                  ))}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: What next ── */}
        {step === 2 && (
          <div className="flex flex-col items-center text-center gap-6 pt-4">
            <div className="w-16 h-16 rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center">
              <CheckCircle size={30} className="text-gold" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                Dein Profil ist fertig!
              </h1>
              <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">
                Was möchtest du als Nächstes tun?
              </p>
            </div>

            <div className="w-full space-y-3 max-w-sm">
              <Link
                href="/inserat"
                className="flex items-center justify-between w-full px-5 py-4 bg-gold hover:bg-gold-light text-bg-primary font-semibold rounded-2xl transition-colors"
              >
                <span>Angebot erstellen</span>
                <ArrowRight size={16} />
              </Link>

              <Link
                href="/profile"
                className="flex items-center justify-between w-full px-5 py-4 border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated text-text-primary font-medium rounded-2xl transition-all"
              >
                <span>Profil vervollständigen</span>
                <ArrowRight size={16} className="text-text-muted" />
              </Link>

              <Link
                href={selectedIntents[0]?.browseHref ?? "/locations"}
                className="flex items-center justify-between w-full px-5 py-4 border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated text-text-primary font-medium rounded-2xl transition-all"
              >
                <span>Angebote durchsuchen</span>
                <ArrowRight size={16} className="text-text-muted" />
              </Link>

              <Link
                href={redirectTo}
                className="block text-xs text-text-muted hover:text-gold transition-colors text-center pt-2"
              >
                Zum Dashboard →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom nav — hidden on step 2 */}
      {step < 2 && (
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
                disabled={selectedIntents.length === 0}
                className="flex-1 py-3.5 rounded-2xl bg-gold text-bg-primary font-bold text-base disabled:opacity-30 transition-opacity active:scale-95"
              >
                Weiter {selectedIntents.length > 1 ? `(${selectedIntents.length})` : ""}
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
      )}
    </div>
  );
}
