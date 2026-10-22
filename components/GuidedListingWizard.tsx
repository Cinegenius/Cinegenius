"use client";

import UnoptimizedImage from "@/components/UnoptimizedImage";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Loader2, MapPin, Package, Trash2 } from "lucide-react";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES } from "@/lib/compressImage";

type Kind = "location" | "equipment";
type Draft = { type: Kind; step: number; category: string; city: string; title: string; description: string; price: string; priceOnRequest: boolean; imageUrl: string };
const initial: Draft = { type: "location", step: 1, category: "", city: "", title: "", description: "", price: "", priceOnRequest: true, imageUrl: "" };
const options: Record<Kind, { label: string; category: string; help: string }[]> = {
  location: [
    { label: "Wohnung oder Haus", category: "Wohnen", help: "Innenräume, Garten oder Terrasse" },
    { label: "Café oder Gastronomie", category: "Gastronomie", help: "Café, Restaurant, Bar oder Küche" },
    { label: "Büro oder Gewerberaum", category: "Büro", help: "Arbeitsräume, Laden oder Werkstatt" },
    { label: "Außenfläche oder Grundstück", category: "Natur", help: "Hof, Garten, Feld oder freie Fläche" },
    { label: "Filmstudio", category: "Studio", help: "Studio oder Produktionsfläche" },
    { label: "Fotostudio", category: "Fotostudio", help: "Studio für Foto- und Videoaufnahmen" },
    { label: "Etwas anderes", category: "Speziallocation", help: "Ein anderer passender Ort" },
  ],
  equipment: [
    { label: "Kamera & Zubehör", category: "Kameraequipment", help: "Kamera, Objektive oder Zubehör" },
    { label: "Licht", category: "Lichttechnik", help: "Lampen, Leuchten oder Lichtformer" },
    { label: "Möbel & Einrichtung", category: "Möbel / Szenenbild", help: "Möbel und Einrichtungsstücke" },
    { label: "Requisiten & Dekoration", category: "Requisiten", help: "Gegenstände und Dekoration" },
    { label: "Kostüme & Kleidung", category: "Kostüme", help: "Kleidung und Kostümteile" },
    { label: "Ton & Audio", category: "Ton & Audio", help: "Mikrofone, Recorder und Zubehör" },
    { label: "Fahrzeug", category: "Bild-Fahrzeug", help: "Fahrzeug für Bild oder Produktion" },
    { label: "Etwas anderes", category: "Produktionsausstattung", help: "Anderes Equipment oder Setzubehör" },
  ],
};
const titles = ["", "Was möchtest du anbieten?", "Wo befindet es sich?", "Zeig dein Angebot", "Beschreibe das Wichtigste", "Preis festlegen", "Prüfen und als Entwurf speichern"];

function normalizeDraft(value: unknown, kind: Kind): Draft {
  const input = value && typeof value === "object" ? value as Partial<Draft> : {};
  return {
    type: kind, step: Math.max(1, Math.min(6, Number(input.step) || 1)),
    category: typeof input.category === "string" ? input.category.slice(0, 100) : "",
    city: typeof input.city === "string" ? input.city.slice(0, 100) : "",
    title: typeof input.title === "string" ? input.title.slice(0, 200) : "",
    description: typeof input.description === "string" ? input.description.slice(0, 3000) : "",
    price: typeof input.price === "string" ? input.price.slice(0, 20) : "",
    priceOnRequest: input.priceOnRequest !== false,
    imageUrl: typeof input.imageUrl === "string" ? input.imageUrl.slice(0, 1000) : "",
  };
}

export default function GuidedListingWizard() {
  const params = useSearchParams();
  const router = useRouter();
  const kind: Kind = params.get("type") === "equipment" ? "equipment" : "location";
  const [form, setForm] = useState<Draft>({ ...initial, type: kind });
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingListing, setSavingListing] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = useMemo(() => options[kind].find((option) => option.category === form.category), [kind, form.category]);

  useEffect(() => {
    let active = true;
    fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Der gespeicherte Entwurf konnte nicht geladen werden.");
      return data.draft?.listingDrafts?.[kind] ?? (data.draft?.listingDraft?.type === kind ? data.draft.listingDraft : null);
    }).then((saved) => {
      if (!active) return;
      setForm(saved?.type === kind ? normalizeDraft(saved, kind) : { ...initial, type: kind });
      setReady(true);
    }).catch((cause) => {
      if (active) { setError(cause instanceof Error ? cause.message : "Der Entwurf konnte nicht geladen werden."); setReady(true); }
    });
    return () => { active = false; };
  }, [kind]);

  const persist = useCallback(async (draft: Draft) => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: kind, setupComplete: false, listingDraft: draft, updatedAt: new Date().toISOString() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      setSaveState("saved");
      return true;
    } catch (cause) {
      setSaveState("error"); setError(cause instanceof Error ? cause.message : "Der Fortschritt konnte nicht gespeichert werden."); return false;
    }
  }, [kind]);

  useEffect(() => {
    if (!ready || createdId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(form); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [form, ready, persist, createdId]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((previous) => ({ ...previous, [key]: value })); setError("");
  }
  async function go(step: number) {
    const next = { ...form, step };
    setForm(next); await persist(next); setError("");
  }
  async function next() {
    if (form.step === 1 && !form.category) { setError("Bitte wähle eine passende Kategorie."); return; }
    if (form.step === 2 && !form.city.trim()) { setError("Bitte gib eine Stadt oder einen Ort an."); return; }
    if (form.step === 4 && !form.title.trim()) { setError("Bitte gib deinem Angebot einen kurzen Titel."); return; }
    await go(Math.min(6, form.step + 1));
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Bitte wähle ein Bild aus."); return; }
    setUploading(true); setError("");
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, quality: 0.82, maxBytes: MAX_FUNCTION_UPLOAD_BYTES });
      const body = new FormData(); body.append("file", compressed);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error ?? "Der Bild-Upload ist fehlgeschlagen.");
      const nextForm = { ...form, imageUrl: data.url };
      setForm(nextForm); await persist(nextForm);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Bild-Upload ist fehlgeschlagen."); }
    finally { setUploading(false); }
  }
  async function saveListing() {
    if (!form.category || !form.city.trim() || !form.title.trim()) { setError("Bitte prüfe Kategorie, Ort und Titel."); return; }
    setSavingListing(true); setError("");
    try {
      const vehicle = kind === "equipment" && form.category === "Bild-Fahrzeug";
      const response = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type: vehicle ? "vehicle" : kind === "location" ? "location" : "prop", category: form.category,
        title: form.title.trim(), city: form.city.trim(), description: form.description.trim(),
        price: form.priceOnRequest ? 0 : Number(form.price) || 0, image_url: form.imageUrl || null,
        draft: true, metadata: { price_on_request: form.priceOnRequest },
      }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.data?.id) throw new Error(data.error ?? "Der private Entwurf konnte nicht gespeichert werden.");
      setCreatedId(data.data.id);
      const cleared = await fetch(`/api/onboarding?type=${kind}`, { method: "DELETE" });
      if (!cleared.ok) setSaveState("error");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der private Entwurf konnte nicht gespeichert werden."); }
    finally { setSavingListing(false); }
  }
  async function publish() {
    if (!createdId) return;
    setSavingListing(true); setError("");
    try {
      const response = await fetch(`/api/listings/${createdId}/publish`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Veröffentlichung fehlgeschlagen.");
      setPublished(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Veröffentlichung fehlgeschlagen."); }
    finally { setSavingListing(false); }
  }

  if (!ready) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Einrichtung wird geladen …</main>;
  if (createdId) return <main className="min-h-[75vh] bg-bg-primary px-4 pb-24 pt-28"><section className="mx-auto max-w-xl rounded-3xl border border-border bg-bg-secondary p-6 text-center sm:p-9"><CheckCircle2 size={42} className="mx-auto mb-4 text-gold" /><h1 className="mb-2 font-display text-3xl font-bold text-text-primary">{published ? "Dein Angebot ist veröffentlicht" : "Privater Entwurf gespeichert"}</h1><p className="mb-6 text-sm leading-6 text-text-muted">{published ? "Dein Angebot ist jetzt öffentlich sichtbar." : "Nur du kannst diesen Entwurf sehen. Veröffentliche ihn erst, wenn du mit den Angaben zufrieden bist."}</p>{error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}{!published ? <div className="flex flex-col justify-center gap-3 sm:flex-row"><button onClick={() => router.push("/dashboard?tab=inserate")} className="min-h-12 rounded-xl border border-border px-5 text-sm text-text-primary">Später weiterbearbeiten</button><button disabled={savingListing} onClick={() => void publish()} className="min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{savingListing ? "Wird veröffentlicht …" : "Jetzt veröffentlichen"}</button></div> : <button onClick={() => router.push(kind === "location" ? `/locations/${createdId}` : `/props/${createdId}`)} className="min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Angebot ansehen</button>}</section></main>;

  const heading = kind === "location" ? "Location anbieten" : "Equipment anbieten";
  const Icon = kind === "location" ? MapPin : Package;
  return <main className="min-h-screen bg-bg-primary px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-2xl">
    <button onClick={() => router.push("/profile-setup")} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-text-primary"><ArrowLeft size={16} /> Alle Wege</button>
    <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><Icon size={20} /></span><div><p className="text-xs uppercase tracking-wider text-gold">{heading}</p><h1 className="font-display text-2xl font-bold text-text-primary">{titles[form.step]}</h1></div></div>
    <div className="mb-7"><div className="mb-2 flex justify-between text-xs text-text-muted"><span>Schritt {form.step} von 6</span><span>{saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : ""}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${form.step / 6 * 100}%` }} /></div></div>
    <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      {form.step === 1 && <><p className="mb-5 text-sm text-text-muted">{kind === "location" ? "Wähle die Beschreibung, die am besten passt." : "Wähle die passende Art. Du kannst später weitere Angebote ergänzen."}</p><div className="grid gap-2 sm:grid-cols-2">{options[kind].map((item) => <button key={item.category} onClick={() => update("category", item.category)} className={`min-h-16 rounded-xl border p-4 text-left transition ${form.category === item.category ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}><strong className="block text-sm text-text-primary">{item.label}</strong><span className="mt-1 block text-xs text-text-muted">{item.help}</span></button>)}</div></>}
      {form.step === 2 && <><p className="mb-4 text-sm leading-6 text-text-muted">Gib bitte nur Stadt oder Ort an. Eine genaue Privatadresse wird hier nicht benötigt oder veröffentlicht.</p><label htmlFor="city" className="mb-2 block text-sm font-medium text-text-primary">Stadt oder Ort <span className="text-gold">*</span></label><input id="city" autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} placeholder="Zum Beispiel Augsburg" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" />{kind === "location" && <p className="mt-3 text-xs text-text-muted">Die Stadt wird im Angebot angezeigt. Eine genaue Adresse kannst du später direkt mit Interessenten teilen.</p>}</>}
      {form.step === 3 && <><p className="mb-4 text-sm leading-6 text-text-muted">Ein klares Foto hilft anderen, sich dein Angebot vorzustellen. Es ist optional und kann später ergänzt werden.</p>{form.imageUrl ? <div className="relative overflow-hidden rounded-xl border border-border"><UnoptimizedImage src={form.imageUrl} alt="Vorschau des ausgewählten Bildes" className="max-h-72 w-full object-cover" /><button onClick={() => update("imageUrl", "")} className="absolute right-3 top-3 flex min-h-11 items-center gap-2 rounded-full bg-bg-primary/90 px-3 text-xs text-text-primary"><Trash2 size={14} /> Entfernen</button></div> : <label className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-primary text-center hover:border-gold/50 ${uploading ? "pointer-events-none opacity-60" : ""}`}><ImagePlus className="text-gold" /><span className="text-sm text-text-primary">{uploading ? "Foto wird hochgeladen …" : "Foto auswählen"}</span><span className="text-xs text-text-muted">JPG, PNG, WEBP oder HEIC</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} /></label>}{uploading && <p className="mt-3 flex items-center gap-2 text-xs text-text-muted"><Loader2 size={14} className="animate-spin" /> Upload läuft …</p>}</>}
      {form.step === 4 && <div className="space-y-5"><p className="text-sm leading-6 text-text-muted">Ein kurzer, klarer Titel reicht. Du kannst Einzelheiten später ergänzen.</p><div><label htmlFor="title" className="mb-2 block text-sm font-medium text-text-primary">Titel <span className="text-gold">*</span></label><input id="title" maxLength={200} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder={kind === "location" ? "Zum Beispiel Helle Altbauwohnung mit Balkon" : "Zum Beispiel LED-Flächenleuchte"} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div><div><label htmlFor="description" className="mb-2 block text-sm font-medium text-text-primary">Kurze Beschreibung <span className="text-text-muted">(optional)</span></label><textarea id="description" rows={5} maxLength={3000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder={kind === "location" ? "Was sollte man über den Ort wissen?" : "Was ist enthalten und in welchem Zustand ist es?"} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-sm text-text-primary outline-none focus:border-gold" /></div></div>}
      {form.step === 5 && <><p className="mb-5 text-sm leading-6 text-text-muted">Du kannst einen Tagespreis nennen oder zuerst Anfragen sammeln.</p><div className="space-y-3"><button onClick={() => update("priceOnRequest", true)} className={`min-h-14 w-full rounded-xl border px-4 text-left text-sm ${form.priceOnRequest ? "border-gold bg-gold/10 text-text-primary" : "border-border bg-bg-primary text-text-secondary"}`}>Preis auf Anfrage</button><button onClick={() => update("priceOnRequest", false)} className={`min-h-14 w-full rounded-xl border px-4 text-left text-sm ${!form.priceOnRequest ? "border-gold bg-gold/10 text-text-primary" : "border-border bg-bg-primary text-text-secondary"}`}>Tagespreis angeben</button>{!form.priceOnRequest && <div><label htmlFor="price" className="mb-2 block text-sm font-medium text-text-primary">Preis pro Tag in Euro</label><input id="price" type="number" min="0" step="1" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="Zum Beispiel 150" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div>}</div></>}
      {form.step === 6 && <><p className="mb-5 text-sm leading-6 text-text-muted">Prüfe die Angaben. Zuerst wird ein privater Entwurf gespeichert, den nur du sehen kannst. Veröffentlichen kannst du ihn anschließend ausdrücklich.</p><div className="space-y-3 rounded-xl border border-border bg-bg-primary p-4 text-sm"><div><span className="text-xs text-text-muted">Art</span><p className="text-text-primary">{selected?.label ?? form.category}</p></div><div><span className="text-xs text-text-muted">Ort</span><p className="text-text-primary">{form.city}</p></div><div><span className="text-xs text-text-muted">Titel</span><p className="text-text-primary">{form.title}</p></div><div><span className="text-xs text-text-muted">Preis</span><p className="text-text-primary">{form.priceOnRequest ? "Preis auf Anfrage" : `${form.price || "0"} € pro Tag`}</p></div>{form.description && <div><span className="text-xs text-text-muted">Beschreibung</span><p className="whitespace-pre-wrap text-text-primary">{form.description}</p></div>}{form.imageUrl && <UnoptimizedImage src={form.imageUrl} alt="Angebotsfoto" className="max-h-40 rounded-lg object-cover" />}</div></>}
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><button onClick={() => form.step === 1 ? router.push("/profile-setup") : void go(form.step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary"><ArrowLeft size={16} /> Zurück</button>{form.step < 6 ? <button disabled={uploading} onClick={() => void next()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">Weiter <ArrowRight size={16} /></button> : <button disabled={savingListing || uploading} onClick={() => void saveListing()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{savingListing ? <><Loader2 size={16} className="animate-spin" /> Wird gespeichert …</> : <>Privaten Entwurf speichern <ArrowRight size={16} /></>}</button>}</div>
    <p className="mt-4 text-center text-xs text-text-muted">Nicht alles fertig? Dein Fortschritt wird privat gespeichert.</p>
  </div></main>;
}
