"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Loader2, UserRound } from "lucide-react";
import { GRIP_DEPARTMENT_LABEL, GRIP_OCCUPATIONS, buildGuidedGripProfileOccupations } from "@/lib/gripTaxonomy";

const roles = [
  { id: "actor", label: "Schauspiel", help: "Rollen vor der Kamera" },
  { id: "model", label: "Model", help: "Foto-, Mode- oder Werbeaufnahmen" },
  { id: "extra", label: "Komparserie", help: "Komparserie und Kleindarstellung" },
  { id: "camera", label: "Kamera", help: "Kameraarbeit und Bildgestaltung" },
  { id: "grip", label: GRIP_DEPARTMENT_LABEL, help: "Kameradolly, Schienen, Rigging und Kamera-Kransysteme" },
  { id: "lighting", label: "Licht", help: "Beleuchtung am Set" },
  { id: "sound", label: "Ton", help: "Aufnahme und Ton am Set" },
  { id: "director", label: "Regie", help: "Idee und Ablauf eines Drehs" },
  { id: "editor", label: "Schnitt", help: "Film- und Videoschnitt" },
  { id: "makeup", label: "Maske", help: "Make-up und Frisuren" },
  { id: "costume", label: "Kostüm", help: "Kleidung und Kostümgestaltung" },
  { id: "production", label: "Produktion", help: "Planung und Organisation" },
  { id: "photographer", label: "Fotografie", help: "Fotoaufnahmen und Bildbearbeitung" },
];
type Draft = { step: number; name: string; city: string; types: string[]; bio: string; gripPositions: string[] };
const start: Draft = { step: 1, name: "", city: "", types: [], bio: "", gripPositions: [] };
const stepTitles = ["", "Was machst du gern?", "Wie dürfen wir dich nennen?", "Erzähl kurz von dir", "Prüfen und Profil erstellen"];

export default function GuidedProfileWizard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [draft, setDraft] = useState<Draft>(start);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Dein Entwurf konnte nicht geladen werden.");
      return result.draft?.profileDraft;
    }).then((previous) => {
      if (!active) return;
      setDraft(previous ? { ...start, ...previous, step: Math.max(1, Math.min(4, Number(previous.step) || 1)) } : start);
      setReady(true);
    }).catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Dein Entwurf konnte nicht geladen werden."); setReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || draft.name || !user?.fullName) return;
    setDraft((current) => current.name ? current : { ...current, name: user.fullName ?? "" });
  }, [ready, draft.name, user?.fullName]);

  const persist = useCallback(async (value: Draft) => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: "talent", setupComplete: false, profileDraft: value, updatedAt: new Date().toISOString() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Der Fortschritt konnte nicht gespeichert werden.");
      setSaveState("saved"); return true;
    } catch (cause) { setSaveState("error"); setError(cause instanceof Error ? cause.message : "Der Fortschritt konnte nicht gespeichert werden."); return false; }
  }, []);

  useEffect(() => {
    if (!ready || savedProfile) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(draft); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, savedProfile, draft, persist]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value })); setError("");
  }
  async function move(step: number) {
    if (draft.step === 1 && draft.types.length === 0) { setError("Wähle mindestens einen Bereich aus."); return; }
    if (draft.step === 2 && !draft.name.trim()) { setError("Bitte gib deinen Namen an."); return; }
    if (draft.step === 2 && !draft.city.trim()) { setError("Bitte gib deinen Wohnort oder deine Region an."); return; }
    const next = { ...draft, step };
    if (await persist(next)) setDraft(next);
  }
  function toggle(id: string) {
    const nextTypes = draft.types.includes(id) ? draft.types.filter((item) => item !== id) : [...draft.types, id];
    setDraft((current) => ({ ...current, types: nextTypes, ...(id === "grip" && !nextTypes.includes("grip") ? { gripPositions: [] } : {}) }));
    setError("");
  }
  function toggleGripPosition(position: string) {
    setDraft((current) => ({
      ...current,
      gripPositions: current.gripPositions.includes(position)
        ? current.gripPositions.filter((item) => item !== position)
        : [...current.gripPositions, position],
    }));
    setError("");
  }
  async function createProfile() {
    const { profileTypes, positions } = buildGuidedGripProfileOccupations(
      draft.types,
      Object.fromEntries(roles.map((role) => [role.id, role.label])),
      draft.gripPositions,
    );
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        display_name: draft.name.trim(), location: draft.city.trim(), profile_types: profileTypes,
        profile_type: profileTypes[0] ?? null, positions, bio: draft.bio.trim(), available: true,
      }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Das Profil konnte nicht gespeichert werden.");
      await fetch("/api/onboarding?type=profile", { method: "DELETE" });
      setSavedProfile(true);
      router.replace("/dashboard");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Das Profil konnte nicht gespeichert werden."); }
    finally { setSubmitting(false); }
  }

  if (!ready || !isLoaded) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Dein Start wird geladen …</main>;
  return <main className="min-h-screen bg-bg-primary px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-2xl">
    <button onClick={() => router.push("/profile-setup")} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-text-primary"><ArrowLeft size={16} /> Alle Wege</button>
    <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><UserRound size={20} /></span><div><p className="text-xs uppercase tracking-wider text-gold">Dein Crew-Profil</p><h1 className="font-display text-2xl font-bold text-text-primary">{stepTitles[draft.step]}</h1></div></div>
    <div className="mb-7"><div className="mb-2 flex justify-between text-xs text-text-muted"><span>Schritt {draft.step} von 4</span><span>{saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : ""}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${draft.step / 4 * 100}%` }} /></div></div>
    <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      {draft.step === 1 && <><p className="mb-5 text-sm leading-6 text-text-muted">Wähle alles aus, was zu dir passt. Du kannst mehrere Bereiche angeben und später weitere ergänzen.</p><div className="grid gap-2 sm:grid-cols-2">{roles.map((role) => <button key={role.id} onClick={() => toggle(role.id)} aria-pressed={draft.types.includes(role.id)} className={`min-h-16 rounded-xl border p-4 text-left transition ${draft.types.includes(role.id) ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}><strong className="block text-sm text-text-primary">{draft.types.includes(role.id) ? "✓ " : "+ "}{role.label}</strong><span className="mt-1 block text-xs text-text-muted">{role.help}</span></button>)}</div>{draft.types.includes("grip") && <div className="mt-5 rounded-xl border border-border p-4"><h2 className="text-sm font-semibold text-text-primary">Welche Tätigkeiten passen zu dir?</h2><p className="mt-1 text-xs leading-5 text-text-muted">Die Begriffe variieren je nach Land und Produktion. Du kannst mehrere auswählen.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{GRIP_OCCUPATIONS.map((occupation) => { const selected = draft.gripPositions.includes(occupation.label); return <button key={occupation.id} type="button" onClick={() => toggleGripPosition(occupation.label)} aria-pressed={selected} className={`rounded-lg border p-3 text-left ${selected ? "border-gold bg-gold/10" : "border-border bg-bg-primary"}`}><span className="block text-xs font-medium text-text-primary">{selected ? "✓ " : "+ "}{occupation.label}</span><span className="mt-1 block text-[11px] text-text-muted">{occupation.description}</span><span className="mt-1 block text-[10px] text-text-muted/70">{occupation.labelEn}</span></button>; })}</div></div>}</>}
      {draft.step === 2 && <div className="space-y-5"><p className="text-sm leading-6 text-text-muted">Nutze den Namen, unter dem man dich finden darf. Als Standort genügt Stadt oder Region; deine genaue Adresse wird nicht benötigt.</p><div><label htmlFor="display-name" className="mb-2 block text-sm font-medium text-text-primary">Name <span className="text-gold">*</span></label><input id="display-name" autoComplete="name" value={draft.name} onChange={(event) => update("name", event.target.value)} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div><div><label htmlFor="profile-city" className="mb-2 block text-sm font-medium text-text-primary">Wohnort oder Region <span className="text-gold">*</span></label><input id="profile-city" autoComplete="address-level2" value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="Zum Beispiel Nürnberg" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div></div>}
      {draft.step === 3 && <><p className="mb-4 text-sm leading-6 text-text-muted">Eine kurze Vorstellung ist hilfreich, aber freiwillig. Profilfoto, Showreel und weitere Angaben kannst du nach dem Start ergänzen.</p><label htmlFor="bio" className="mb-2 block text-sm font-medium text-text-primary">Kurz über dich <span className="text-text-muted">(optional)</span></label><textarea id="bio" rows={5} maxLength={1000} value={draft.bio} onChange={(event) => update("bio", event.target.value)} placeholder="Was machst du gern? Welche Art von Projekten interessiert dich?" className="w-full rounded-xl border border-border bg-bg-primary p-4 text-sm text-text-primary outline-none focus:border-gold" /></>}
      {draft.step === 4 && <><p className="mb-5 text-sm leading-6 text-text-muted">Prüfe deine Angaben. Mit „Profil erstellen“ wird dein Profil für andere CineGenius-Mitglieder sichtbar. Weitere Informationen und Bilder kannst du später ergänzen.</p><div className="space-y-3 rounded-xl border border-border bg-bg-primary p-4 text-sm"><div><span className="text-xs text-text-muted">Name</span><p className="text-text-primary">{draft.name}</p></div><div><span className="text-xs text-text-muted">Bereiche</span><p className="text-text-primary">{draft.types.map((id) => roles.find((role) => role.id === id)?.label).filter(Boolean).join(" · ")}</p></div>{draft.gripPositions.length > 0 && <div><span className="text-xs text-text-muted">Kamerabühne / Grip</span><p className="text-text-primary">{draft.gripPositions.join(" · ")}</p></div>}<div><span className="text-xs text-text-muted">Standort</span><p className="text-text-primary">{draft.city}</p></div>{draft.bio && <div><span className="text-xs text-text-muted">Vorstellung</span><p className="whitespace-pre-wrap text-text-primary">{draft.bio}</p></div>}</div></>}
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><button onClick={() => draft.step === 1 ? router.push("/profile-setup") : void move(draft.step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary"><ArrowLeft size={16} /> Zurück</button>{draft.step < 4 ? <button onClick={() => void move(draft.step + 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Weiter <ArrowRight size={16} /></button> : <button disabled={submitting} onClick={() => void createProfile()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{submitting ? <><Loader2 size={16} className="animate-spin" /> Profil wird erstellt …</> : <>Profil erstellen <ArrowRight size={16} /></>}</button>}</div>
    <p className="mt-4 text-center text-xs text-text-muted">Dein Fortschritt bleibt privat, bis du dein Profil ausdrücklich erstellst.</p>
  </div></main>;
}
