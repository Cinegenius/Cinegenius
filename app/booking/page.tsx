"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ArrowLeft, Send, Calendar, FileText, Euro, User,
  CheckCircle, Loader2, AlertCircle,
} from "lucide-react";

type ProfileSnippet = {
  display_name: string | null;
  avatar_url: string | null;
  slug: string | null;
};

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const profileId = searchParams.get("profile");

  const [profile, setProfile] = useState<ProfileSnippet | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(!!profileId);

  // Form state
  const [projectTitle, setProjectTitle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/profile/by-id?id=${profileId}`)
      .then((r) => r.json())
      .then(({ profile: p }) => {
        setProfile(p ?? null);
        setLoadingProfile(false);
      })
      .catch(() => setLoadingProfile(false));
  }, [profileId]);

  const canSubmit =
    projectTitle.trim() &&
    description.trim() &&
    !sending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !profileId || !user) return;
    setSending(true);
    setError("");

    const lines = [
      `**Buchungsanfrage: ${projectTitle}**`,
      projectType ? `Projekttyp: ${projectType}` : null,
      startDate ? `Von: ${startDate}` : null,
      endDate ? `Bis: ${endDate}` : null,
      budget ? `Budget/Tagesgage: ${budget} €` : null,
      "",
      description,
    ]
      .filter((l) => l !== null)
      .join("\n");

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: profileId, content: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setSent(true);
      setTimeout(() => {
        router.push(`/messages`);
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSending(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle size={32} className="text-gold" />
        <h2 className="font-display text-xl font-bold text-text-primary">Anmeldung erforderlich</h2>
        <p className="text-text-muted text-sm">Bitte melde dich an, um eine Buchungsanfrage zu stellen.</p>
        <Link href="/sign-in" className="px-6 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl text-sm hover:bg-gold-light transition-colors">
          Anmelden
        </Link>
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle size={32} className="text-gold" />
        <h2 className="font-display text-xl font-bold text-text-primary">Kein Profil angegeben</h2>
        <p className="text-text-muted text-sm">Diese Seite benötigt einen Profil-Parameter.</p>
        <Link href="/creators" className="text-gold hover:text-gold-light text-sm">
          Zu den Filmschaffenden
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle size={28} className="text-emerald-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary">Anfrage gesendet!</h2>
        <p className="text-text-muted text-sm max-w-xs">
          Deine Buchungsanfrage wurde als Nachricht gesendet. Du wirst gleich zu deinen Nachrichten weitergeleitet.
        </p>
        <Loader2 size={16} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const recipientName = loadingProfile
    ? "Lädt..."
    : (profile?.display_name ?? "Unbekannt");

  return (
    <div className="min-h-screen bg-bg-primary pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:border-gold hover:text-gold transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Buchungsanfrage</h1>
            <p className="text-xs text-text-muted">Anfrage direkt per Nachricht stellen</p>
          </div>
        </div>

        {/* Recipient */}
        <div className="flex items-center gap-3 p-4 bg-bg-secondary border border-border rounded-2xl mb-8">
          <div className="w-11 h-11 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-text-muted" />
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-text-muted font-semibold">Anfrage an</p>
            <p className="text-sm font-semibold text-text-primary">{recipientName}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">
              Projekttitel *
            </label>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="z.B. Kurzfilm »Licht & Schatten«"
                className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">
              Projekttyp
            </label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
            >
              <option value="">Bitte wählen…</option>
              <option value="Kurzfilm">Kurzfilm</option>
              <option value="Spielfilm">Spielfilm</option>
              <option value="Werbespot">Werbespot</option>
              <option value="Musikvideo">Musikvideo</option>
              <option value="Dokumentation">Dokumentation</option>
              <option value="Serie / TV">Serie / TV</option>
              <option value="Fotoshooting">Fotoshooting</option>
              <option value="Social Media Content">Social Media Content</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">
                Startdatum
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">
                Enddatum
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">
              Budget / Tagesgage (€)
            </label>
            <div className="relative">
              <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="z.B. 800"
                className="w-full pl-9 pr-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-text-muted font-semibold mb-1.5">
              Projektbeschreibung *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibe dein Projekt, die Rolle, besondere Anforderungen, Location usw."
              rows={5}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-3 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {sending ? (
                <><Loader2 size={15} className="animate-spin" /> Wird gesendet…</>
              ) : (
                <><Send size={15} /> Anfrage senden</>
              )}
            </button>
          </div>

          <p className="text-xs text-text-muted text-center">
            Die Anfrage wird als Nachricht gesendet.{" "}
            <Link href="/messages" className="text-gold hover:text-gold-light">Zu meinen Nachrichten →</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-text-muted">Laden...</div>}>
      <BookingContent />
    </Suspense>
  );
}
