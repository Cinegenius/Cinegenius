"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Camera, MapPin, Package, Search, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type Intent = "location" | "equipment" | "talent" | "search" | "company";
type SetupDraft = { intent?: Intent; companyDraft?: { updatedAt?: string } | null; profileDraft?: { step?: number } | null; listingDraft?: { type: "location" | "equipment"; step: number } | null; listingDrafts?: Partial<Record<"location" | "equipment", { type: "location" | "equipment"; step: number }>> } | null;

const choices: { id: Intent; title: string; detail: string; Icon: typeof MapPin; href: string }[] = [
  { id: "location", title: "Eine Location anbieten", detail: "Wohnung, Haus, Café oder Grundstück", Icon: MapPin, href: "/guided-listing?type=location" },
  { id: "equipment", title: "Equipment oder Gegenstände anbieten", detail: "Kamera, Licht, Möbel oder Fahrzeuge", Icon: Package, href: "/guided-listing?type=equipment" },
  { id: "talent", title: "Mich und meine Fähigkeiten anbieten", detail: "Kamera, Schauspiel, Model oder Komparserie", Icon: Camera, href: "/guided-profile" },
  { id: "search", title: "Für ein Projekt etwas finden", detail: "Menschen, Locations oder Equipment suchen", Icon: Search, href: "/search" },
  { id: "company", title: "Eine Firma präsentieren", detail: "Verleih, Studio oder Produktionsfirma", Icon: Building2, href: "/company-setup?onboarding=1" },
];

export default function ProfileSetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<SetupDraft>(null);
  const [loading, setLoading] = useState(true);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState("");
  const redirectTo = searchParams.get("redirect");

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/onboarding", { cache: "no-store" }).then(async (r) => {
        if (!r.ok) throw new Error("Der gespeicherte Fortschritt konnte nicht geladen werden.");
        return r.json();
      }),
      fetch("/api/profile", { cache: "no-store" }).then((r) => r.ok ? r.json() : null),
    ]).then(([setup, profile]) => {
      if (!live) return;
      setDraft(setup.draft ?? null);
      if (profile?.exists) router.replace(redirectTo || "/dashboard");
    }).catch(() => {
      if (live) setError("Dein gespeicherter Fortschritt ist gerade nicht erreichbar. Du kannst es gleich noch einmal versuchen.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [redirectTo, router]);

  async function choose(intent: Intent, href: string) {
    setSavingIntent(intent);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(draft ?? {}), intent, setupComplete: intent === "search", updatedAt: new Date().toISOString() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Der Fortschritt konnte nicht gespeichert werden.");
      setDraft((previous) => ({ ...(previous ?? {}), intent }));
      router.push(intent === "search" ? href : `${href}${redirectTo ? `${href.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(redirectTo)}` : ""}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Fortschritt konnte nicht gespeichert werden.");
    } finally {
      setSavingIntent(null);
    }
  }

  const savedListings = draft?.listingDrafts ?? (draft?.listingDraft ? { [draft.listingDraft.type]: draft.listingDraft } : {});

  return (
    <main className="min-h-[75vh] bg-bg-primary px-4 pb-24 pt-24 sm:pt-28">
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Dein Start auf CineGenius</p>
        <h1 className="mb-2 font-display text-3xl font-bold text-text-primary sm:text-4xl">Was möchtest du auf CineGenius machen?</h1>
        <p className="mb-8 max-w-2xl text-sm leading-6 text-text-muted">Wähle aus, was dich gerade hierherführt. Du kannst später jederzeit weitere Angaben ergänzen.</p>

        {Object.values(savedListings).map((saved) => saved && (
          <button key={saved.type} onClick={() => router.push(`/guided-listing?type=${saved.type}&resume=1`)} className="mb-3 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-left transition hover:bg-gold/15">
            <CheckCircle2 className="shrink-0 text-gold" size={22} />
            <span className="min-w-0 flex-1"><strong className="block text-sm text-text-primary">{saved.type === "location" ? "Location-Entwurf fortsetzen" : "Equipment-Entwurf fortsetzen"}</strong><span className="text-xs text-text-muted">Dein privater Angebotsentwurf ist gespeichert.</span></span>
            <ArrowRight className="shrink-0 text-gold" size={18} />
          </button>
        ))}
        {draft?.companyDraft && (
          <button onClick={() => router.push("/company-setup?onboarding=1&resume=1")} className="mb-3 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-left transition hover:bg-gold/15">
            <CheckCircle2 className="shrink-0 text-gold" size={22} />
            <span className="min-w-0 flex-1"><strong className="block text-sm text-text-primary">Firmenprofil fortsetzen</strong><span className="text-xs text-text-muted">Deine privaten Angaben sind gespeichert.</span></span>
            <ArrowRight className="shrink-0 text-gold" size={18} />
          </button>
        )}
        {draft?.profileDraft && (
          <button onClick={() => router.push("/guided-profile?resume=1")} className="mb-3 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-left transition hover:bg-gold/15">
            <CheckCircle2 className="shrink-0 text-gold" size={22} />
            <span className="min-w-0 flex-1"><strong className="block text-sm text-text-primary">Profilentwurf fortsetzen</strong><span className="text-xs text-text-muted">Deine privaten Angaben sind gespeichert.</span></span>
            <ArrowRight className="shrink-0 text-gold" size={18} />
          </button>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {choices.map(({ id, title, detail, Icon, href }) => (
            <button key={id} onClick={() => choose(id, href)} disabled={loading || savingIntent !== null}
              className="group flex min-h-24 items-center gap-4 rounded-2xl border border-border bg-bg-secondary p-5 text-left transition hover:border-gold/60 hover:bg-bg-elevated disabled:opacity-60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><Icon size={20} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm leading-5 text-text-primary">{title}</strong><span className="mt-1 block text-xs leading-5 text-text-muted">{detail}</span></span>
              {savingIntent === id ? <Loader2 className="shrink-0 animate-spin text-gold" size={18} /> : <ArrowRight className="shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-gold" size={18} />}
            </button>
          ))}
        </div>
        {loading && <p className="mt-5 flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" /> Gespeicherte Einrichtung wird geladen …</p>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      </div>
    </main>
  );
}
