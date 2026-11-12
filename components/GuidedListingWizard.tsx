"use client";

import GenieWritingAssistant from "@/components/GenieWritingAssistant";

import { selectedPlaceId } from "@/lib/selected-place-id";
import { hasPlaceCity } from "@/lib/places/core";

import PrivateLocationEditor from "@/components/PrivateLocationEditor";
import PlaceField from "@/components/PlaceField";
import ContentUsageNotice from "@/components/ContentUsageNotice";
import MarketplaceOfferFields from "@/components/MarketplaceOfferFields";
import { marketplaceCategoryLabel, marketplaceDraft, marketplaceMetadataPatch, marketplaceBasePrice, serializeMarketplaceDraft, validateMarketplaceOffer, type MarketplaceDraft } from "@/lib/marketplace-offer";
import { marketplaceCategory } from "@/lib/marketplaceCategories";
import { useTranslations , useLocale } from "next-intl";
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
import { uiErrorMessage } from "@/lib/ui-error-message";

type Kind = "location" | "equipment";
type Draft = {
  responsible?: ResponsiblePerson;
  type: Kind; step: number; category: string; city: string; selected_place_city_id?: string; title: string; description: string;
  price: string; priceOnRequest: boolean; priceNegotiable?: boolean; imageUrls: string[];
  sqm: string; ceilingHeight: string; maxCrew: string; parkingSpots: string;
  indoorOutdoor: "innen" | "außen" | "beides"; powerAvailable: boolean; naturalLight: boolean;
  blackoutPossible: boolean; loadingAccess: boolean; accessNotes: string; shootingHours: string;
  availabilityNotes: string; amenities: string[];
  marketplace?: MarketplaceDraft;
  requestKey?: string;
};
const initial: Draft = {
  type: "location", step: 1, category: "", city: "", title: "", description: "", price: "", priceOnRequest: true, imageUrls: [],
  sqm: "", ceilingHeight: "", maxCrew: "", parkingSpots: "", indoorOutdoor: "innen", powerAvailable: false,
  naturalLight: false, blackoutPossible: false, loadingAccess: false, accessNotes: "", shootingHours: "", availabilityNotes: "", amenities: [],
};




function getLocalizedOptions(translate: (key: string) => string): Record<Kind, { label: string; category: string; help: string }[]> {
  return ({
  location: [
    { label: translate("Ui.text_24e4df32fb5119"), category: "Wohnen", help: translate("Ui.text_5e8a4235aba343") },
    { label: translate("Ui.text_cd7d5c905a64e2"), category: "Villa", help: translate("Ui.text_1a2d31d6b1a779") },
    { label: translate("Ui.text_a5328f2bbf0e12"), category: "Gastronomie", help: translate("Ui.text_703786d2214e4c") },
    { label: translate("Ui.text_9534867a47e416"), category: "Büro", help: translate("Ui.text_20a2c51597fc0f") },
    { label: translate("Ui.text_add8b805ff44bc"), category: "Industrie", help: translate("Ui.text_4dffe3e7ddd4fe") },
    { label: translate("Ui.text_302fbc18a9fd1c"), category: "Natur", help: translate("Ui.text_457345fc538608") },
    { label: translate("menu.locFilmStudio"), category: "Studio", help: translate("Ui.text_3d07274566dd50") },
    { label: translate("menu.locPhotoStudio"), category: "Fotostudio", help: translate("Ui.text_c33df18f459bc1") },
    { label: translate("Ui.text_472b1cc732230e"), category: "Speziallocation", help: translate("Ui.text_a38760b45e28b7") },
  ],
  equipment: [
    { label: translate("Ui.text_cc36de65a905b5"), category: "Kameraequipment", help: translate("Ui.text_c0c1f544a7969d") },
    { label: translate("menu.crewLight"), category: "Lichttechnik", help: translate("Ui.text_b6b4189873e361") },
    { label: translate("Ui.text_eeb6822165e195"), category: "Möbel / Szenenbild", help: translate("Ui.text_20d9133b1ad921") },
    { label: translate("Ui.text_b4d7759d60d8b9"), category: "Requisiten", help: translate("Ui.text_b565ded01eb1c2") },
    { label: translate("Ui.text_6ee06a9e4b3d9f"), category: "Kostüme", help: translate("Ui.text_78c5ffca4a8cfa") },
    { label: translate("MarketplaceCatalog.categories.ton"), category: "Ton & Audio", help: translate("Ui.text_1922fb356ab9a1") },
    { label: translate("AdminAccounts.contentKinds.vehicle"), category: "Bild-Fahrzeug", help: translate("Ui.text_7f3317b5231c13") },
    { label: translate("Ui.text_472b1cc732230e"), category: "Produktionsausstattung", help: translate("Ui.text_90bacff60a86a5") },
  ],
});
}

function stringValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Keep legacy fields and every category's unfinished specs in private recovery.
 * Only an exact, known category alias may resolve to a canonical subcategory. */
function marketplaceForDraft(input: Partial<Draft>): MarketplaceDraft {
  const category = typeof input.category === "string" ? input.category : "";
  const canonicalCategory = marketplaceCategory(category)?.subcategory ?? category;
  const legacy = marketplaceDraft(canonicalCategory);
  legacy.values.rent_mode = input.priceNegotiable ? "negotiable" : input.priceOnRequest !== false ? "request" : "fixed";
  legacy.values.rent_price = typeof input.price === "string" ? input.price : "";
  const saved = input.marketplace;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return legacy;
  const specs = saved.specsByCategory && typeof saved.specsByCategory === "object" && !Array.isArray(saved.specsByCategory)
    ? Object.fromEntries(Object.entries(saved.specsByCategory).map(([key, value]) => [key, stringValues(value)])) : {};
  return { category: canonicalCategory, values: { ...legacy.values, ...stringValues(saved.values) }, specsByCategory: { ...legacy.specsByCategory, ...specs } };
}

function normalizeDraft(value: unknown, kind: Kind): Draft {
  const input = value && typeof value === "object" ? value as Partial<Draft> : {};
  return {
    responsible: input.responsible ? responsiblePersonDraft(input.responsible) : { ...NEW_RESPONSIBLE_PERSON },
    type: kind, step: Math.max(1, Math.min(6, Number(input.step) || 1)),
    category: typeof input.category === "string" ? input.category.slice(0, 100) : "",
    requestKey: typeof input.requestKey === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.requestKey) ? input.requestKey : undefined,
    ...(kind === "equipment" ? { marketplace: marketplaceForDraft(input) } : {}),
    city: typeof input.city === "string" ? input.city.slice(0, 320) : "",
    selected_place_city_id: selectedPlaceId(input.selected_place_city_id),
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
  const uiPriceLocale = useLocale();
  const uiPriceText = useTranslations("MarketplaceOffer");

  const uiText = useTranslations();
  const uiTextRef = useRef(uiText);
  const titles = ["", uiText("Ui.text_cf1a717207b5ac"), uiText("Ui.text_d5d6495bca945c"), uiText("Ui.text_972e97b601b42a"), uiText("Ui.text_06cd7995fd5cb0"), uiText("Ui.text_368704a4d9f4e2"), uiText("Ui.text_7fa066dd5a38d3")];

  const uiOptionLabels: Record<string, string> = {
    "Fläche (m²)": uiText("AdminReview.fields.sqm"),
    "Deckenhöhe (m)": uiText("AdminReview.fields.ceiling_height_m"),
    "Crewgröße": uiText("Ui.text_17e6448cf7da66"),
    "Parkplätze": uiText("AdminReview.fields.parking_spots"),
    "Strom": uiText("Ui.text_7222c5506fcfbe"),
    "Tageslicht": uiText("AdminReview.fields.natural_light"),
    "Verdunkelbar": uiText("Ui.text_947f519f43195e"),
    "Be-/Entladung": uiText("Ui.text_78f3462ff79135"),
  };





  const options = getLocalizedOptions(uiText);


  const params = useSearchParams();
  const optionalMedia = useTranslations("OptionalMedia");
  const moderation = useTranslations("OfferModeration");
  const marketCatalog=useTranslations("MarketplaceCatalog");
  const marketplaceText = useTranslations("MarketplacePublishing");
  const navigationText = useTranslations("MarketplaceNavigation");
  const completionText = useTranslations("SetupOffers");
  const [publicNow, setPublicNow] = useState(false);
  const router = useRouter();
  const kind: Kind = params.get("type") === "equipment" ? "equipment" : "location";
  const [form, setForm] = useState<Draft>({ ...initial, type: kind });
  const [ready, setReady] = useState(false);
  const [loadedKind, setLoadedKind] = useState<Kind | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState("idle");
  const [responsibleErrors, setResponsibleErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [galleryState, setGalleryState] = useState({ uploading: false, failed: 0 });
  const [savingListing, setSavingListing] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationInFlight = useRef(false);
  const selected = options[kind].find((option) => option.category === form.category);
  const marketplace = marketplaceForDraft(form);

  useEffect(() => { uiTextRef.current = uiText; }, [uiText]);

  useEffect(() => {
    let active = true;
    fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? uiTextRef.current("Ui.text_26d738d49085c7"));
      return data.draft?.listingDrafts?.[kind] ?? (data.draft?.listingDraft?.type === kind ? data.draft.listingDraft : null);
    }).then((saved) => {
      if (!active) return;
      setForm(saved?.type === kind ? normalizeDraft(saved, kind) : { ...initial, type: kind });
      setLoadedKind(kind);
      setReady(true);
    }).catch((cause) => {
      if (active) { setError(uiErrorMessage(cause, uiTextRef.current("Ui.text_ccc99e9b5da8ea"))); setReady(true); }
    });
    return () => { active = false; };
  }, [kind, loadAttempt]);

  const saveDraft = useCallback(async (draft: Draft) => {
    setSaveState("saving");
    try {
      const body = JSON.stringify({ intent: kind, setupComplete: false, listingDraft: draft, updatedAt: new Date().toISOString() });
      // The existing private onboarding store has a 7,000-byte request ceiling.
      // Refuse an oversized snapshot without truncating it or replacing recovery.
      if (new TextEncoder().encode(body).byteLength > 7000) throw new Error(uiTextRef.current("System.m_699cf9afdb02"));
      const response = await fetch("/api/onboarding", { method: "PUT", headers: { "Content-Type": "application/json" }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? uiTextRef.current("Ui.text_dfb7e42ffb81ab"));
      setSaveState("saved");
      return true;
    } catch (cause) {
      setSaveState("error"); setError(uiErrorMessage(cause, uiTextRef.current("Ui.text_fd69a5ec9a3af7"))); return false;
    }
  }, [kind]);
  const saveQueue = useMemo(() => {
    // Queue construction stays pure; attach the ref-reading transport after
    // commit. Locale changes update the translator without replacing this queue.
    const writer: { run: ((draft: Draft) => Promise<boolean>) | null } = { run: null };
    return {
      ...createOnboardingSaveQueue<Draft>(draft => writer.run ? writer.run(draft) : Promise.resolve(false)),
      kind,
      setWriter(run: (draft: Draft) => Promise<boolean>) { writer.run = run; },
    };
  }, [kind]);
  useEffect(() => { saveQueue.setWriter(saveDraft); }, [saveQueue, saveDraft]);
  const persist = useCallback((snapshot: Draft) => saveQueue.save(snapshot), [saveQueue]);

  const draftProtection = useExistingDraftProtection({ value: form, ready: ready && loadedKind === kind, busy: galleryState.uploading || galleryState.failed > 0 || savingListing, save: persist, saved: saveQueue.matches, enabled: !createdId });

  useEffect(() => {
    if (!ready || loadedKind !== kind || createdId || savingListing) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(form); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [form, ready, loadedKind, kind, persist, createdId, savingListing]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((previous) => ({ ...previous, [key]: value })); setError("");
  }
  function updateMarketplace(value: MarketplaceDraft) {
    setForm(previous => ({ ...previous, category: value.category, marketplace: value })); setError("");
  }
  async function go(step: number) {
    const next = { ...form, step };
    setForm(next);
    if (await persist(next)) setError("");
  }
  async function next() {
    if (form.step === 3 && (galleryState.uploading || galleryState.failed > 0)) {
      setError(galleryState.uploading ? uiText("Ui.text_d729b5228d72f5") : uiText("Ui.text_c2bba14675a560"));
      return;
    }
    if (form.step === 1 && !form.category) { setError(uiText("Ui.text_ed4537659e1bcd")); return; }
    if (form.step === 1 && kind === "equipment" && marketplaceCategory(marketplace.category)?.subcategory !== marketplace.category) { setError(uiPriceText("invalidCategory")); return; }
    if (form.step === 2 && !hasPlaceCity(form.city)) { setError(uiText("Ui.text_cebf0bc6e8c171")); return; }
    if (form.step === 4 && !form.title.trim()) { setError(uiText("Ui.text_26849ab9086631")); return; }
    if (form.step === 5 && kind === "equipment") {
      const issue = validateMarketplaceOffer(marketplace.category, marketplaceCategory(marketplace.category)?.department === "fahrzeuge" ? "vehicle" : "prop", serializeMarketplaceDraft(marketplace));
      if (issue) { setError(uiPriceText(issue)); return; }
    }
    await go(Math.min(6, form.step + 1));
  }
  async function saveListing() {
    if (operationInFlight.current || createdId || loadedKind !== kind) return;
    if (!form.category || !hasPlaceCity(form.city) || !form.title.trim()) { setError(uiText("Ui.text_acb93cefe7b6a3")); return; }
    if (galleryState.uploading || galleryState.failed > 0) { setError(galleryState.uploading ? uiText("Ui.text_d729b5228d72f5") : uiText("Ui.text_c2bba14675a560")); return; }
    if (kind === "equipment") {
      const issue = validateMarketplaceOffer(marketplace.category, marketplaceCategory(marketplace.category)?.department === "fahrzeuge" ? "vehicle" : "prop", serializeMarketplaceDraft(marketplace));
      if (issue) { setError(uiPriceText(issue)); return; }
    }
    operationInFlight.current = true;
    setSavingListing(true); setError("");
    try {
      if (timer.current) clearTimeout(timer.current);
      await saveQueue.settle();
      const snapshot = form.requestKey ? form : { ...form, requestKey: crypto.randomUUID() };
      setForm(snapshot);
      // Persist the stable key before creation so a lost response can be retried.
      if (!saveQueue.matches(snapshot) && !await persist(snapshot)) return;
      const vehicle = kind === "equipment" && marketplaceCategory(marketplace.category)?.department === "fahrzeuge";
      const response = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type: vehicle ? "vehicle" : kind === "location" ? "location" : "prop", category: kind === "equipment" ? marketplace.category : form.category,
        title: form.title.trim(), city: form.city.trim(), selected_place_city_id: form.selected_place_city_id || undefined, description: form.description.trim(),
        price: kind === "equipment" ? marketplaceBasePrice(marketplace) : form.priceOnRequest ? 0 : Number(form.price) || 0, image_url: form.imageUrls[0] || null,
        extra_images: form.imageUrls.slice(1),
        draft: true,
        onboarding_request_key: snapshot.requestKey,
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
        } : marketplaceMetadataPatch(marketplace),
      }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.data?.id) throw new Error(data.error ?? uiText("Ui.text_7b1ab451381653"));
      draftProtection.complete();
      setCreatedId(data.data.id);
      if (data.data.published === true) { setPublished(true); setPublicNow(true); }
      else if (data.data.moderation_status === "pending") setPublished(true);
      try {
        const cleared = await fetch(`/api/onboarding?type=${kind}`, { method: "DELETE" });
        if (!cleared.ok) throw new Error("draft_cleanup_failed");
      } catch {
        setSaveState("error"); setCleanupFailed(true);
      }
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_7b1ab451381653"))); }
    finally { operationInFlight.current = false; setSavingListing(false); }
  }
  async function publish() {
    if (!createdId || operationInFlight.current) return;
    const errors = kind === "equipment" ? marketplaceResponsibleErrors(form.responsible) : responsiblePersonErrors(form.responsible); setResponsibleErrors(errors);
    if (Object.keys(errors).length) { focusResponsiblePerson(); return; }
    operationInFlight.current = true;
    setSavingListing(true); setError("");
    try {
      const saved = await fetch(`/api/listings/${createdId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responsible_person: form.responsible }) });
      if (!saved.ok) { const result = await saved.json(); throw new Error(result.error); }
      const response = await fetch(`/api/listings/${createdId}/publish`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? uiText("Ui.text_b8a82d14926aed"));
      setPublished(true); setPublicNow(data.published === true);
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_b8a82d14926aed"))); }
    finally { operationInFlight.current = false; setSavingListing(false); }
  }

  if (!ready) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted">{uiText.rich("Ui.text_87e90ec4d2d8a6", { part1: () => (<Loader2 className="mx-auto mb-3 animate-spin" />) })}</main>;
  if (loadedKind !== kind) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center"><p role="alert" className="mb-4 text-sm text-red-300">{error || uiText("Ui.text_ccc99e9b5da8ea")}</p><button type="button" onClick={() => { setError(""); setReady(false); setLoadAttempt(previous => previous + 1); }} className="min-h-12 rounded-xl border border-border px-5 text-sm text-text-primary">{uiText("setup.copy49")}</button></main>;
  if (createdId) return <main className="min-h-[75vh] bg-bg-primary px-4 pb-24 pt-28"><section className="mx-auto max-w-xl rounded-3xl border border-border bg-bg-secondary p-6 text-center sm:p-9"><CheckCircle2 size={42} className="mx-auto mb-4 text-gold" /><h1 className="mb-2 font-display text-3xl font-bold text-text-primary">{publicNow ? marketplaceText("publishedTitle") : published ? moderation("statuses.pending") : completionText("states.draft")}</h1><p className="mb-6 text-sm leading-6 text-text-muted">{publicNow ? marketplaceText("published") : moderation(published ? "submitted" : "privateNotice")}</p>{kind === "location" && !published && <PrivateLocationEditor key={createdId} id={createdId} />}{!published && <ResponsiblePersonFields value={form.responsible ?? NEW_RESPONSIBLE_PERSON} onChange={value => update("responsible", value)} errors={responsibleErrors} accountPrefill compactWhenProfile={kind === "equipment"} />}{(error || cleanupFailed) && <p role="alert" className="mb-4 text-sm text-red-300">{error || navigationText("draftCleanupFailed")}</p>}{!published ? <div className="flex flex-col justify-center gap-3 sm:flex-row"><button disabled={savingListing} onClick={() => void publish()} className="min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{!savingListing && kind === "equipment" && form.responsible?.profileName ? marketplaceText("publish") : moderation(savingListing ? "submitting" : "submit")}</button><button onClick={() => router.push("/dashboard?tab=inserate")} className="min-h-12 rounded-xl border border-border px-5 text-sm text-text-primary">{uiText("Ui.text_6f3ba904af0104")}</button></div> : <button onClick={() => router.push("/dashboard?tab=listings")} className="min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">{moderation("myOffers")}</button>}</section></main>;

  const heading = kind === "location" ? uiText("home.offerLocationAction") : uiText("Ui.text_bc4e17f7ec92f5");
  const Icon = kind === "location" ? MapPin : Package;
  return <main className="min-h-screen bg-bg-primary px-4 pb-24 pt-24 sm:pt-28"><div className="mx-auto max-w-2xl">
    <button onClick={() => router.push("/profile-setup")} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-text-primary">{uiText.rich("Ui.text_d787822cfc68d3", { part1: () => (<ArrowLeft size={16} />) })}</button>
    <div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><Icon size={20} /></span><div><p className="text-xs uppercase tracking-wider text-gold">{heading}</p><h1 className="font-display text-2xl font-bold text-text-primary">{titles[form.step]}</h1></div></div>
    <div className="mb-7"><div className="mb-2 flex justify-between text-xs text-text-muted">{uiText.rich("Ui.text_ace5b2a63f4c19", { value2: () => (form.step), part1: chunks => (<span>{chunks}</span>), value4: () => (saveState === "saving" ? uiText("setup.copy101") : saveState === "saved" ? uiText("profile.collabSaved") : saveState === "error" ? uiText("setup.saveFailed") : ""), part3: chunks => (<span>{chunks}</span>) })}</div><div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${form.step / 6 * 100}%` }} /></div></div>
    <section className="rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      {form.step === 1 && kind === "equipment" && <MarketplaceOfferFields value={marketplace} onChange={updateMarketplace} prices={false} details={false} />}
      {form.step === 1 && kind === "location" && <><p className="mb-5 text-sm text-text-muted">{kind === "location" ? uiText("Ui.text_216693ba7442e4") : uiText("Ui.text_4ef3562a0b08f8")}</p><div className="grid gap-2 sm:grid-cols-2">{options[kind].map((item) => <button key={item.category} onClick={() => update("category", item.category)} className={`min-h-16 rounded-xl border p-4 text-left transition ${form.category === item.category ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}><strong className="block text-sm text-text-primary">{item.label}</strong><span className="mt-1 block text-xs text-text-muted">{item.help}</span></button>)}</div></>}
      {form.step === 2 && <><p className="mb-4 text-sm leading-6 text-text-muted">{uiText("Ui.text_aac2e6903f35be")}</p><label htmlFor="city" className="mb-2 block text-sm font-medium text-text-primary">{uiText.rich("Ui.text_f95a1f19f341ce", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label><PlaceField value={form.city} onChange={(value, cityId) => setForm(current => ({ ...current, city: value, selected_place_city_id: cityId || "" }))} required />{kind === "location" && <p className="mt-3 text-xs text-text-muted">{uiText("Ui.text_5004f67dfeb4e7")}</p>}</>}
      {form.step === 3 && <><p className="mb-4 text-sm leading-6 text-text-muted">{optionalMedia("galleryHelp", { count: kind === "location" ? MAX_LOCATION_IMAGES : MAX_LISTING_IMAGES })}</p><ListingImageManager value={form.imageUrls} maxImages={kind === "location" ? MAX_LOCATION_IMAGES : MAX_LISTING_IMAGES} label={kind === "location" ? uiText("Ui.text_fdff84960c7129") : uiText("Ui.text_9f761f60e783ae")} onChange={(imageUrls) => update("imageUrls", imageUrls)} onStatusChange={setGalleryState} /><ContentUsageNotice context="offer" visibility="configured" /></>}
      {form.step === 4 && <div className="space-y-5"><p className="text-sm leading-6 text-text-muted">{uiText("Ui.text_09721293f49bb0")}</p><div><label htmlFor="title" className="mb-2 block text-sm font-medium text-text-primary">{uiText.rich("Ui.text_78c1a52ec8f3ee", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label><input id="title" maxLength={200} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder={kind === "location" ? uiText("Ui.text_e4e77f0bd4d21e") : uiText("Ui.text_d55cb9291e7b66")} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div><div><label htmlFor="description" className="mb-2 block text-sm font-medium text-text-primary">{uiText.rich("Ui.text_717ac9cf70b6b9", { part1: chunks => (<span className="text-text-muted">{chunks}</span>) })}</label><textarea id="description" rows={5} maxLength={3000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder={kind === "location" ? uiText("Ui.text_ef8ee43810e517") : uiText("Ui.text_b6e68f42fd1cd5")} className="w-full rounded-xl border border-border bg-bg-primary p-4 text-sm text-text-primary outline-none focus:border-gold" /><GenieWritingAssistant area={kind === "location" ? "location" : "marketplace"} value={form.description} onApply={(text) => update("description", text)} maxLength={3000} contextKey={`guided-listing:${kind}:description`} disabled={galleryState.uploading || savingListing} /></div>{kind === "location" && <div className="space-y-4 rounded-xl border border-border bg-bg-primary p-4"><h2 className="text-sm font-semibold text-text-primary">{uiText.rich("Ui.text_d0b2ec02ba7738", { part1: chunks => (<span className="font-normal text-text-muted">{chunks}</span>) })}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([["sqm", "Fläche (m²)"], ["ceilingHeight", "Deckenhöhe (m)"], ["maxCrew", "Crewgröße"], ["parkingSpots", "Parkplätze"]] as const).map(([key, label]) => <label key={key} className="text-xs text-text-muted">{(uiOptionLabels[label] ?? label)}<input type="number" min="0" step={key === "ceilingHeight" ? "0.1" : "1"} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /></label>)}</div><label className="block text-xs text-text-muted">{uiText("Ui.text_e10b1dcf3d4dea")}<select value={form.indoorOutdoor} onChange={(event) => update("indoorOutdoor", event.target.value as Draft["indoorOutdoor"])} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary"><option value="innen">{uiText("locations.filterInnen")}</option><option value="außen">{uiText("locations.filterAussen")}</option><option value="beides">{uiText("locations.filterInnenAussen")}</option></select></label><div className="flex flex-wrap gap-2">{([["powerAvailable", "Strom"], ["naturalLight", "Tageslicht"], ["blackoutPossible", "Verdunkelbar"], ["loadingAccess", "Be-/Entladung"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={form[key]} onClick={() => update(key, !form[key])} className={`min-h-10 rounded-lg border px-3 text-xs ${form[key] ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{form[key] ? "✓ " : ""}{(uiOptionLabels[label] ?? label)}</button>)}</div><input maxLength={160} value={form.shootingHours} onChange={(event) => update("shootingHours", event.target.value)} placeholder={uiText("AdminReview.fields.shooting_hours")} className="min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /><input maxLength={240} value={form.accessNotes} onChange={(event) => update("accessNotes", event.target.value)} placeholder={uiText("Ui.text_01231d096c526a")} className="min-h-10 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" /><textarea maxLength={500} rows={2} value={form.availabilityNotes} onChange={(event) => update("availabilityNotes", event.target.value)} placeholder={uiText("Ui.text_e6c48894da484b")} className="w-full rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-primary" /></div>}</div>}
      {form.step === 4 && kind === "equipment" && <MarketplaceOfferFields value={marketplace} onChange={updateMarketplace} category={false} prices={false} />}
      {form.step === 5 && kind === "equipment" && <MarketplaceOfferFields value={marketplace} onChange={updateMarketplace} category={false} details={false} />}
      {form.step === 5 && kind === "location" && <><p className="mb-5 text-sm leading-6 text-text-muted">{uiText("Ui.text_93b398e9998d25")}</p><div className="space-y-3"><ListingPriceOptions onRequest={form.priceOnRequest} negotiable={form.priceNegotiable === true} onChange={value => setForm(previous => ({...previous, ...value}))} />{!form.priceOnRequest && <div><label htmlFor="price" className="mb-2 block text-sm font-medium text-text-primary">{uiText("setup.copy43")}</label><input id="price" type="number" min="0" step="1" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder={uiText("setup.copy44")} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div>}</div></>}
      {form.step === 6 && <><ResponsiblePersonFields value={form.responsible ?? NEW_RESPONSIBLE_PERSON} onChange={value => update("responsible", value)} accountPrefill compactWhenProfile={kind === "equipment"} /><p className="mb-5 text-sm leading-6 text-text-muted">{uiText("Ui.text_e1fb1e1e7f2748")}</p><div className="space-y-3 rounded-xl border border-border bg-bg-primary p-4 text-sm"><div><span className="text-xs text-text-muted">{uiText("setup.kind")}</span><p className="text-text-primary">{kind === "equipment" ? marketplaceCategoryLabel(form.category,marketCatalog) : selected?.label ?? form.category}</p></div><div><span className="text-xs text-text-muted">{uiText("AdminReview.fields.city")}</span><p className="text-text-primary">{form.city}</p></div><div><span className="text-xs text-text-muted">{uiText("projects.colTitle")}</span><p className="text-text-primary">{form.title}</p></div><div><span className="text-xs text-text-muted">{uiText("setup.copy41")}</span><p className="text-text-primary">{listingPriceLabel(kind === "equipment" ? marketplaceBasePrice(marketplace) : Number(form.price), kind === "equipment" ? marketplaceMetadataPatch(marketplace) : {price_on_request:form.priceOnRequest,price_negotiable:form.priceNegotiable}, undefined, uiPriceLocale, uiPriceText)}</p></div>{kind === "location" && <div><span className="text-xs text-text-muted">{uiText("Ui.text_c34fa41b7de219")}</span><p className="text-text-primary">{[form.sqm && `${form.sqm} m²`, uiText(form.indoorOutdoor === "beides" ? "locations.filterInnenAussen" : form.indoorOutdoor === "innen" ? "locations.filterInnen" : "locations.filterAussen"), form.powerAvailable && uiText("Ui.text_7222c5506fcfbe"), form.naturalLight && uiText("AdminReview.fields.natural_light"), form.blackoutPossible && uiText("Ui.text_947f519f43195e"), form.loadingAccess && uiText("Ui.text_78f3462ff79135")].filter(Boolean).join(" · ") || uiText("Ui.text_7a4849b47c16de")}</p>{form.availabilityNotes && <p className="mt-1 whitespace-pre-wrap text-xs text-text-muted">{form.availabilityNotes}</p>}</div>}{form.description && <div><span className="text-xs text-text-muted">{uiText("setup.description")}</span><p className="whitespace-pre-wrap text-text-primary">{form.description}</p></div>}{form.imageUrls.length > 0 && <p className="text-text-secondary">{uiText.rich("Ui.text_1dfcd5e4ed9e57", { value1: () => (form.imageUrls.length), count2: form.imageUrls.length })}</p>}</div></>}
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 flex items-center justify-between gap-3"><button onClick={() => form.step === 1 ? router.push("/profile-setup") : void go(form.step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary">{uiText.rich("Ui.text_3c9cbf8b79d036", { part1: () => (<ArrowLeft size={16} />) })}</button>{form.step < 6 ? <button disabled={galleryState.uploading} onClick={() => void next()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{form.step === 3 && form.imageUrls.length === 0 ? optionalMedia("skip") : optionalMedia("continue")} <ArrowRight size={16} /></button> : <button disabled={savingListing || galleryState.uploading || galleryState.failed > 0} onClick={() => void saveListing()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{savingListing ? <>{uiText.rich("Ui.text_d63f436c6f6487", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</> : <>{uiText.rich("Ui.text_b03030fbfc4dc2", { part1: () => (<ArrowRight size={16} />) })}</>}</button>}</div>
    <p className="mt-4 text-center text-xs text-text-muted">{uiText("Ui.text_176c8b5e42e3bd")}</p>
  </div></main>;
}
