"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { compressAvatar, safeObjectURL } from "@/lib/compressImage";
import { useUser } from "@clerk/nextjs";
import { Loader2, Camera, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import FocalPointPicker, { type FocalPoint } from "@/components/FocalPointPicker";
import Link from "next/link";

function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function ProfileSetupPage() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({ x: 50, y: 33 });
  const [focalPickerImage, setFocalPickerImage] = useState<string | null>(null);

  // Redirect if profile already exists — with abort controller to prevent race conditions
  useEffect(() => {
    if (!isLoaded || !user) return;
    const controller = new AbortController();
    fetch("/api/profile", { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.exists) window.location.replace(safeRedirect(searchParams.get("redirect")));
      })
      .catch(() => {}); // Network error: stay on page, user can still create profile
    return () => controller.abort();
  }, [isLoaded, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill name from Clerk
  useEffect(() => {
    if (isLoaded && user) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (full) setDisplayName(full);
    }
  }, [isLoaded, user]);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = safeObjectURL(file);
    if (objectUrl) {
      setAvatarPreview((prev) => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return objectUrl; });
    }
    setUploading(true);
    setErrorMsg("");
    try {
      const compressed = await compressAvatar(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload fehlgeschlagen");
      if (!data.url) throw new Error("Kein URL erhalten");
      setAvatarUrl(data.url);
      setFocalPickerImage(data.url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fehler beim Foto-Upload — du kannst trotzdem weitermachen.");
      setAvatarPreview("");
      setAvatarUrl("");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!displayName.trim() || !city.trim()) return;
    setSaving(true);
    setErrorMsg("");
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
          profile_types: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Profil konnte nicht erstellt werden. Bitte versuche es erneut.");
        return;
      }
      setDone(true);
    } catch {
      setErrorMsg("Verbindungsfehler. Bitte prüfe deine Internetverbindung und versuche es erneut.");
    } finally {
      setSaving(false);
    }
  }

  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const canSave = displayName.trim().length > 0 && city.trim().length > 0 && !saving && !uploading;

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
        <div className="h-full bg-gold transition-all duration-500" style={{ width: done ? "100%" : "50%" }} />
      </div>

      {/* Logo */}
      <div className="pt-8 pb-4 text-center">
        <span className="font-display font-bold text-lg text-gold tracking-tight">CineGenius</span>
      </div>

      <div className="flex-1 px-4 pb-32 max-w-lg mx-auto w-full">

        {/* ── Form ── */}
        {!done && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                Profil erstellen
              </h1>
              <p className="text-sm text-text-muted">
                Nur das Nötigste — den Rest kannst du später ergänzen.
              </p>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="relative">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-gold/40" />
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
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatar} />
              <p className="text-xs text-text-muted">Profilfoto — optional</p>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest block mb-1.5">
                Dein Name *
              </label>
              <input
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setErrorMsg(""); }}
                placeholder="Wie sollen andere dich nennen?"
                maxLength={100}
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
                onChange={e => { setCity(e.target.value); setErrorMsg(""); }}
                placeholder="z.B. Wien, München, Berlin …"
                maxLength={100}
                className="w-full bg-bg-secondary border border-border rounded-2xl px-4 py-3.5 text-base text-text-primary focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {done && (
          <div className="flex flex-col items-center text-center gap-6 pt-4">
            <div className="w-16 h-16 rounded-full bg-gold/15 border-2 border-gold/30 flex items-center justify-center">
              <CheckCircle size={30} className="text-gold" />
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
                Willkommen bei CineGenius!
              </h1>
              <p className="text-sm text-text-muted max-w-xs mx-auto leading-relaxed">
                Dein Profil ist erstellt. Was möchtest du als Nächstes tun?
              </p>
            </div>

            <div className="w-full space-y-3 max-w-sm">
              <Link
                href="/inserat"
                className="flex items-center justify-between w-full px-5 py-4 bg-gold hover:bg-gold-light text-bg-primary font-semibold rounded-2xl transition-colors"
              >
                <span>Inserat erstellen</span>
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
                href="/creators"
                className="flex items-center justify-between w-full px-5 py-4 border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated text-text-primary font-medium rounded-2xl transition-all"
              >
                <span>Plattform entdecken</span>
                <ArrowRight size={16} className="text-text-muted" />
              </Link>

              <Link href={redirectTo} className="block text-xs text-text-muted hover:text-gold transition-colors text-center pt-2">
                Zum Dashboard →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      {!done && (
        <div className="fixed bottom-0 left-0 right-0 bg-bg-primary border-t border-border px-4 py-4 safe-area-pb">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 ${
                canSave ? "bg-gold text-bg-primary" : "bg-bg-elevated border border-border text-text-muted cursor-not-allowed"
              }`}
            >
              {saving ? (
                <><Loader2 size={18} className="animate-spin" /> Speichern…</>
              ) : (
                "Profil erstellen"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
