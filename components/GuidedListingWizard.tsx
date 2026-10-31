"use client";
import ContentUsageNotice from "@/components/ContentUsageNotice";
import { MarketplaceCategoryPicker } from "@/components/MarketplaceOfferFields";
import { marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import { marketplaceCategory } from "@/lib/marketplaceCategories";
import { useTranslations } from "next-intl";
import { useFormRouter as useRouter } from "@/lib/use-form-router";
import { createOnboardingSaveQueue } from "@/lib/onboarding-save";
import { useExistingDraftProtection } from "@/lib/use-form-draft";
import ResponsiblePersonFields, { focusResponsiblePerson } from "@/components/ResponsiblePersonFields";
import { NEW_RESPONSIBLE_PERSON, responsiblePersonDraft, responsiblePersonErrors, marketplaceResponsibleErrors, type ResponsiblePerson } from "@/lib/responsible-person";

import ListingPriceOptions from "@/components/ListingPriceOptions";
import { listingPriceLabel } from "@/lib/listing-price";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MapPin, Package } from "lucide-react";
import ListingImageManager from "@/components/ListingImageManager";
import { MAX_LOCATION_IMAGES, MAX_LISTING_IMAGES } from "@/lib/listing-image-gallery";

type Kind = "location" | "equipment";
type Draft = {
  responsible?: ResponsiblePerson;
  type: Kind; step: number; category: string; city: string; title: string; description: string;
  price: string; priceOnRequest: boolean; priceNegotiable?: boolean; imageUrls: string[];
  sqm: string; ceilingHeight: string; maxCrew: string; parkingSpots: string;
  indoorOutdoor: "innen" | "außen" | "beides"; powerAvailable: boolean; naturalLight: boolean;
  blackoutPossible: boolean; loadingAccess: boolean; accessNotes: string; shootingHours: string;
  availabilityNotes: string; amenities: string[];
};
const initial: Draft = {
  type: "location", step: 1, category: "", city: "", title: "", description: "", price: "", priceOnRequest: true, imageUrls: [],
  sqm: "", ceilingHeight: "", maxCrew: "", parkingSpots: "", indoorOutdoor: "innen", powerAvailable: false,
  naturalLight: false, blackoutPossible: false, loadingAccess: false, accessNotes: "", shootingHours: "", availabilityNotes: "", amenities: [],
};
const options: Record<Kind, { label: string; category: string; help: string }[]> = {
  location: [
    { label: "Wohnung oder Haus", category: "Wohnen", help: "Innenräume, Garten oder Terrasse" },
    { label: "Villa oder besonderes Wohnhaus", category: "Villa", help: "Große Räume, Garten, Pool oder besondere Ausstattung" },
    { label: "Café oder Gastronomie", category: "Gastronomie", help: "Café, Restaurant, Bar oder Küche" },
    { label: "Büro oder Gewerberaum", category: "Büro", help: "Arbeitsräume, Laden oder Werkstatt" },
    { label: "Halle oder Industriefläche", category: "Industrie", help: "Lagerhalle, Werkstatt oder Produktionsfläche" },
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
    responsible: input.responsible ? responsiblePersonDraft(input.responsible) : { ...NEW_RESPONSIBLE_PERSON },
    type: kind, step: Math.max(1, Math.min(6, Number(input.step) || 1)),
    category: typeof input.category === "string" ? input.category.slice(0, 100) : "",
    city: typeof input.city === "string" ? input.city.slice(0, 100) : "",
    title: typeof input.title === "string" ? input.title.slice(0, 200) : "",
    description: typeof input.description === "string" ? input.description.slice(0, 3000) : "",
    price: typeof input.price === "string" ? input.price.slice(0, 20) : "",
    priceOnRequest: input.priceOnRequest !== false,
    priceNegotiable: input.priceNegotiable === true,
    sqm: typeof input.sqm === "string" ? input.sqm.slice(0, 20) : "",
    ceilingHeight: typeof input.ceilingHeight === "string" ? input.ceilingHeight.slice(0, 20) : "",
    maxCrew: typeof input.maxCrew === "string" ? input.maxCrew.slice(0, 20) : "",
    parkingSpots: typeof input.parkingSpots === "string" ? input.parkingSpots.slice(0, 20) : "",
    indoorOutdoor: ["innen", "außen", "beides"].includes(String(input.indoorOutdoor)) ? input.indoorOutdoor as Draft["indoorOutdoor"] : "innen",
    powerAvailable: input.powerAvailable === true,
    naturalLight: input.naturalLight === true,
    blackoutPossible: input.blackoutPossible === true,
    loadingAccess: input.loadingAccess === true,
    accessNotes: typeof input.accessNotes === "string" ? input.accessNotes.slice(0, 240) : "",
    shootingHours: typeof input.shootingHours === "string" ? input.shootingHours.slice(0, 160) : "",
    availabilityNotes: typeof input.availabilityNotes === "string" ? input.availabilityNotes.slice(0, 500) : "",
    amenities: Array.isArray(input.amenities) ? input.amenities.filter((value): value is string => typeof value === "string").slice(0, 80) : [],
    imageUrls: Array.isArray(input.imageUrls)
      ? input.imageUrls.filter((url): url is string => typeof url === "string").slice(0, kind === "location" ? MAX_LOCATION_IMAGES : MAX_LISTING_IMAGES)
      : typeof (input as { imageUrl?: unknown }).imageUrl === "string" ? [(input as { imageUrl: string }).imageUrl.slice(0, 1000)] : [],
  };
}

export default function GuidedListingWizard() {
  const params = useSearchParams();
  const optionalMedia = useTranslations("OptionalMedia");
  const moderation = useTranslations("OfferModeration");
  const marketCatalog=useTranslations("MarketplaceCatalog");
  const marketplaceText = useTranslations("MarketplacePublishing");
  const [publicNow, setPublicNow] = useState(false);
  const router = useRouter();
  const kind: Kind = params.get("type") === "equipment" ? "equipment" : "location";
  const [form, setForm] = useState<Draft>({ ...initial, type: kind });
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [responsibleErrors, setResponsibleErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [galleryState, setGalleryState] = useState({ uploading: false, failed: 0 });
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

  const saveQueue = useMemo(() => createOnboardingSaveQueue(async (draft: Draft) => {
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
  }), [kind]);
  const persist = useCallback((snapshot: Draft) => saveQueue.save(snapshot), [saveQueue]);

  const draftProtection = useExistingDraftProtection({ value: form, ready, busy: galleryState.uploading || galleryState.failed > 0 || savingListing, save: persist, saved: saveQueue.matches, enabled: !createdId });

  useEffect(() => {
    if (!ready || createdId || savingListing) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(form); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [form, ready, persist, createdId, savingListing]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((previous) => ({ ...previous, [key]: value })); setError("");
  }
  async function go(step: number) {
    const next = { ...form, step };
    setForm(next); await persist(next); setError("");
  }
  async function next() {
    if (form.step === 3 && (galleryState.uploading || galleryState.failed > 0)) {
      setError(galleryState.uploading ? "Bitte warte, bis die Fotos hochgeladen sind." : "Bitte lade fehlgeschlagene Fotos erneut hoch oder entferne sie.");
      return;
    }
    if (form.step === 1 && !form.category) { setError("Bitte wähle eine passende Kategorie."); return; }
    if (form.step === 2 && !form.city.trim()) { setError("Bitte gib eine Stadt oder einen Ort an."); return; }
    if (form.step === 4 && !form.title.trim()) { setError("Bitte gib deinem Angebot einen kurzen Titel."); return; }
    await go(Math.min(6, form.step + 1));
  }
  async function saveListing() {
    if (!form.category || !form.city.trim() || !form.title.trim()) { setError("Bitte prüfe Kategorie, Ort und Titel."); return; }
    if (galleryState.uploading || galleryState.failed > 0) { setError(galleryState.uploading ? "Bitte warte, bis die Fotos hochgeladen sind." : "Bitte lade fehlgeschlagene Fotos erneut hoch oder entferne sie."); return; }
    setSavingListing(true); setError("");
    try {
      if (timer.current) clearTimeout(timer.current);
      await saveQueue.settle();
      const vehicle = kind === "equipment" && marketplaceCategory(form.category)?.department === "fahrzeuge";
      const response = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type: vehicle ? "vehicle" : kind === "location" ? "location" : "prop", category: form.category,
        title: form.title.trim(), city: form.city.trim(), description: form.description.trim(),
        price: form.priceOnRequest ? 0 : Number(form.price) || 0, image_url: form.imageUrls[0] || null,
        extra_images: form.imageUrls.slice(1),
        draft: true,
        responsible_person: form.responsible,
        metadata: kind === "location" ? {
          price_negotiable: form.priceNegotiable === true, price_on_request: form.priceOnRequest,
          sqm: form.sqm ? Number(form.sqm) : null,
          ceiling_height_m: form.ceilingHeight ? Number(form.ceilingHeight) : null,
          max_crew: form.maxCrew ? Number(form.maxCrew) : null,
          parking_spots: form.parkingSpots ? Number(form.parkingSpots) : null,
          indoor_outdoor: form.indoorOutdoor,
          power_available: form.powerAvailable,
          natural_light: form.naturalLight,
          blackout_possible: form.blackoutPossible,
          loading_access: form.loadingAccess,
          access_notes: form.accessNotes,
          shooting_hours: form.shootingHours,
          availability_notes: form.availabilityNotes,
          amenities: form.amenities,
        } : { price_negotiable: form.priceNegotiable === true, price_on_request: form.priceOnRequest },
      }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.data?.id) throw new Error(data.error ?? "Der private Entwurf konnte nicht gespeichert werden.");
      draftProtection.complete();
      setCreatedId(data.data.id);
      const cleared = await fetch(`/api/onboarding?type=${kind}`, { method: "DELETE" });
      if (!cleared.ok) setSaveState("error");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der private Entwurf konnte nicht gespeichert werden."); }
    finally { setSavingListing(false); }
  }
  async function publish() {
    if (!createdId) return;
    const errors = kind === "equipment" ? marketplaceResponsibleErrors(form.responsible) : responsiblePersonErrors(form.responsible); setResponsibleErrors(errors);
    if (Object.keys(errors).length) { focusResponsiblePerson(); return; }
    setSavingListing(true); setError("");
    try {
      const saved = await fetch(`/api/listings/${createdId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsible_person: form.responsible }) });
      if (!saved.ok) { const result = await saved.json(); throw new Error(result.error); }
      const response = await fetch(`/api/listings/${createdId}/publish`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Veröffentlichung fehlgeschlagen.");
      setPublished(true); setPublicNow(data.published === true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Veröffentlichung fehlgeschlagen."); }
    finally { setSavingListing(false); }
  }

  if (!ready) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Einrichtung wird geladen …</main>;
  if (createdId) return <main className="min-h-[75vh] bg-bg-primary px-4 pb-24 pt-28"><section className="mx-auto max-w-xl rounded-3xl border border-border bg-bg-secondary p-6 text-center sm:p-9"><CheckCircle2 size={42} className="mx-auto mb-4 text-gold" /><h1 className="mb-2 font-display text-3xl font-bold text-text-primary">{publicNow ? marketplaceText("publishedTitle") : moderation(published ? "statuses.pending" : "draftSaved")}</h1><p className="mb-6 text-sm leading-6 text-text-muted">{publicNow ? marketplaceText("published") : moderation(published ? "submitted" : "privateNotice")}</p>{!published && <ResponsiblePersonFields value={form.responsible ?? NEW_RESPONSIBLE_PERSON} onChange={value => update("responsible", value)} errors={responsibleErrors} accountPrefill compactWhenProfile={kind === "equipment"} />}{error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}{!published ? <div className="flex flex-col justify-center gap-3 sm:flex-row"><button onClick={() => router.push("/dashboard?tab=inserate")} className="min-h-12 rounded-xl border border-border px-5 text-sm text-text-primary">Später weiterbearbeiten</button><button disabled={savingListing} onClick={() => void publish()} className="min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{!savingListing && kind === "equipment" && form.responsible?.profileName ? marketplaceText("publish") : moderation(savingListing ? "submitting" : "submit")}</button></div> : <button onClick={() => router.push("/dashboard?tab=listings")} className="min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{moderation("myOffers")}</button>}</section></main>;

  const heading = kind === "location" ? "Location anbieten" : "Equipment anbieten";
  const Icon = kind === "location" ? MapPin : Package;
  return <main className="min-h-screen bg-bg-primary px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-2xl">
    <button onClick={() => router.push("/profile-setup")} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-text-primary"><ArrowLeft size={16} /> Alle Wege</button>
    <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><Icon size={20} /></span><div><p className="text-xs uppercase tracking-wider text-gold">{heading}</p><h1 className="font-display text-2xl font-bold text-text-primary">{titles[form.step]}</h1></div></div>
    <div className="mb-7"><div className="mb-2 flex justify-between text-xs text-text-muted"><span>Schritt {form.step} von 6</span><span>{saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Speichern fehlgeschlagen" : ""}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${form.step / 6 * 100}%` }} /></div></div>
    <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      {form.step === 1 && kind === "equipment" && <MarketplaceCategoryPicker value={form.category} onChange={value=>update("category",value)} />}
      {form.step === 1 && kind === "location" && <><p className="mb-5 text-sm text-text-muted">{kind === "location" ? "Wähle die Beschreibung, die am besten passt." : "Wähle die passende Art. Du kannst später weitere Angebote ergänzen."}</p><div className="grid gap-2 sm:grid-cols-2">{options[kind].map((item) => <button key={item.category} onClick={() => update("category", item.category)} className={`min-h-16 rounded-xl border p-4 text-left transition ${form.category === item.category ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}><strong className="block text-sm text-text-primary">{item.label}</strong><span className="mt-1 block text-xs text-text-muted">{item.help}</span></button>)}</div></>}
      {form.step === 2 && <><p className="mb-4 text-sm leading-6 text-text-muted">Gib bitte nur Stadt oder Ort an. Eine genaue Privatadresse wird hier nicht benötigt oder veröffentlicht.</p><label htmlFor="city" className="mb-2 block text-sm font-medium text-text-primary">Stadt oder Ort <span className="text-gold">*</span></label><input id="city" autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} placeholder="Zum Beispiel Augsburg" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" />{kind === "location" && <p className="mt-3 text-xs text-text-muted">Die Stadt wird im Angebot angezeigt. Eine genaue Adresse kannst du später direkt mit Interessenten teilen.</p>}</>}
      {form.step === 3 && <><p className="mb-4 text-sm leading-6 text-text-muted">{optionalMedia("galleryHelp", { count: kind === "location" ? MAX_LOCATION_IMAGES : MAX_LISTING_IMAGES })}</p><ListingImageManager value={form.imageUrls} maxImages={kind === "location" ? MAX_LOCATION_IMAGES : MAX_LISTING_IMAGES} label={kind === "location" ? "Locationfotos" : "Angebotsfotos"} onChange={(imageUrls) => update("imageUrls", imageUrls)} onStatusChange={setGalleryState} /><ContentUsageNotice context="offer" visibility="configured" /></>}
      {form.step === 4 && <div className="space-y-5"><p className="text-sm leading-6 text-text-muted">Ein kurzer, klarer Titel reicht. Die zusätzlichen Locationangaben sind freiwillig und helfen Produktionen bei der Planung.</p><div><label htmlFor="title" className="mb-2 block text-sm font-medium text-text-primary">Titel <span className="text-gold">*</span></label><input id="title" maxLength={200} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder={kind === "location" ? "Zum Beispiel Helle Altbauwohnung mit Balkon" : "Zum Beispiel LED-Flächenleuchte"} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div><div><label htmlFor="description" className="mb-2 block text-sm font-medium text-text-primary">Kurze Beschreibung <span className="text-text-muted">(optional)</span></label><textarea id="description" rows={5} maxLength={3000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder={kind === "location" ? "Was sollte man über den Ort wissen?" : "Was ist enthalten und in welchem Zustand ist es?"} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-sm text-text-primary outline-none focus:border-gold" /></div>{kind === "location" && <div className="space-y-4 rounded-xl border border-border bg-bg-primary p-4"><h2 className="text-sm font-semibold text-text-primary">Ausstattung und Drehbedingungen <span className="font-normal text-text-muted">(optional)</span></h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([["sqm", "Fläche (m²)"], ["ceilingHeight", "Deckenhöhe (m)"], ["maxCrew", "Crewgröße"], ["parkingSpots", "Parkplätze"]] as const).map(([key, label]) => <label key={key} className="text-xs text-text-muted">{label}<input type="number" min="0" step={key === "ceilingHeight" ? "0.1" : "1"} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /></label>)}</div><label className="block text-xs text-text-muted">Innen- und Außenbereich<select value={form.indoorOutdoor} onChange={(event) => update("indoorOutdoor", event.target.value as Draft["indoorOutdoor"])} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary"><option value="innen">Innen</option><option value="außen">Außen</option><option value="beides">Innen & Außen</option></select></label><div className="flex flex-wrap gap-2">{([["powerAvailable", "Strom"], ["naturalLight", "Tageslicht"], ["blackoutPossible", "Verdunkelbar"], ["loadingAccess", "Be-/Entladung"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={form[key]} onClick={() => update(key, !form[key])} className={`min-h-10 rounded-lg border px-3 text-xs ${form[key] ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{form[key] ? "✓ " : ""}{label}</button>)}</div><input maxLength={160} value={form.shootingHours} onChange={(event) => update("shootingHours", event.target.value)} placeholder="Mögliche Drehzeiten" className="min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /><input maxLength={240} value={form.accessNotes} onChange={(event) => update("accessNotes", event.target.value)} placeholder="Anfahrt und Zugang, keine Privatadresse" className="min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /><textarea maxLength={500} rows={2} value={form.availabilityNotes} onChange={(event) => update("availabilityNotes", event.target.value)} placeholder="Verfügbarkeit und Einschränkungen" className="w-full rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-primary" /></div>}</div>}
      {form.step === 5 && <><p className="mb-5 text-sm leading-6 text-text-muted">Du kannst einen Tagespreis nennen oder zuerst Anfragen sammeln.</p><div className="space-y-3"><ListingPriceOptions onRequest={form.priceOnRequest} negotiable={form.priceNegotiable === true} onChange={value => setForm(previous => ({...previous, ...value}))} />{!form.priceOnRequest && <div><label htmlFor="price" className="mb-2 block text-sm font-medium text-text-primary">Preis pro Tag in Euro</label><input id="price" type="number" min="0" step="1" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="Zum Beispiel 150" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div>}</div></>}
      {form.step === 6 && <><ResponsiblePersonFields value={form.responsible ?? NEW_RESPONSIBLE_PERSON} onChange={value => update("responsible", value)} accountPrefill compactWhenProfile={kind === "equipment"} /><p className="mb-5 text-sm leading-6 text-text-muted">Prüfe die Angaben. Zuerst wird ein privater Entwurf gespeichert, den nur du sehen kannst. Veröffentlichen kannst du ihn anschließend ausdrücklich.</p><div className="space-y-3 rounded-xl border border-border bg-bg-primary p-4 text-sm"><div><span className="text-xs text-text-muted">Art</span><p className="text-text-primary">{kind === "equipment" ? marketplaceCategoryLabel(form.category,marketCatalog) : selected?.label ?? form.category}</p></div><div><span className="text-xs text-text-muted">Ort</span><p className="text-text-primary">{form.city}</p></div><div><span className="text-xs text-text-muted">Titel</span><p className="text-text-primary">{form.title}</p></div><div><span className="text-xs text-text-muted">Preis</span><p className="text-text-primary">{listingPriceLabel(Number(form.price), {price_on_request:form.priceOnRequest,price_negotiable:form.priceNegotiable})}</p></div>{kind === "location" && <div><span className="text-xs text-text-muted">Drehbedingungen</span><p className="text-text-primary">{[form.sqm && `${form.sqm} m²`, form.indoorOutdoor === "beides" ? "Innen & Außen" : form.indoorOutdoor, form.powerAvailable && "Strom", form.naturalLight && "Tageslicht", form.blackoutPossible && "Verdunkelbar", form.loadingAccess && "Be-/Entladung"].filter(Boolean).join(" · ") || "Noch keine freiwilligen Angaben"}</p>{form.availabilityNotes && <p className="mt-1 whitespace-pre-wrap text-xs text-text-muted">{form.availabilityNotes}</p>}</div>}{form.description && <div><span className="text-xs text-text-muted">Beschreibung</span><p className="whitespace-pre-wrap text-text-primary">{form.description}</p></div>}{form.imageUrls.length > 0 && <p className="text-text-secondary">{form.imageUrls.length} Foto{form.imageUrls.length === 1 ? "" : "s"} gespeichert</p>}</div></>}
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><button onClick={() => form.step === 1 ? router.push("/profile-setup") : void go(form.step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary"><ArrowLeft size={16} /> Zurück</button>{form.step < 6 ? <button disabled={galleryState.uploading} onClick={() => void next()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{form.step === 3 && form.imageUrls.length === 0 ? optionalMedia("skip") : optionalMedia("continue")} <ArrowRight size={16} /></button> : <button disabled={savingListing || galleryState.uploading || galleryState.failed > 0} onClick={() => void saveListing()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{savingListing ? <><Loader2 size={16} className="animate-spin" /> Wird gespeichert …</> : <>Privaten Entwurf speichern <ArrowRight size={16} /></>}</button>}</div>
    <p className="mt-4 text-center text-xs text-text-muted">Nicht alles fertig? Dein Fortschritt wird privat gespeichert.</p>
  </div></main>;
}
