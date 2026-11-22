"use client";
import CurrencySelect from "@/components/CurrencySelect";
import { listingCurrency, formatOfferAmount } from "@/lib/currency";
import PersonalSettings from "@/components/PersonalSettings";
import PersonalAreaHome from "@/components/PersonalAreaHome";
import { dashboardLegacyDestination } from "@/lib/personal-area-navigation";
import JobEditorFields from "@/components/JobEditorFields";
import { jobEditValue, jobEditDescription } from "@/lib/job-editor";
import { parseJobDescription, jobSchedule } from "@/lib/job-metadata";

import GenieWritingAssistant from "@/components/GenieWritingAssistant";
import { locationRoomLabel } from "@/lib/location-rooms";

import { placeInputValue } from "@/lib/places/core";
import { listingPlaceEditFields } from "@/lib/listing-place-edit";

import PrivateLocationEditor from "@/components/PrivateLocationEditor";
import PlaceField from "@/components/PlaceField";
import ContentUsageNotice from "@/components/ContentUsageNotice";
import DashboardDate from "@/components/DashboardDate";
import ListingFreshnessSummary, { type ListingFreshnessPreview } from "@/components/ListingFreshnessSummary";
import { useTranslations, useLocale } from "next-intl";
import OfferModerationStatus from "@/components/OfferModerationStatus";
import { useFormRouter as useRouter } from "@/lib/use-form-router";
import ResponsiblePersonFields, { focusResponsiblePerson } from "@/components/ResponsiblePersonFields";
import { NEW_RESPONSIBLE_PERSON, responsiblePersonDraft, responsiblePersonErrors, marketplaceResponsibleErrors, type ResponsiblePerson } from "@/lib/responsible-person";

import MarketplaceOfferFields from "@/components/MarketplaceOfferFields";
import { marketplaceDraft, marketplaceMetadataPatch, serializeMarketplaceDraft, validateMarketplaceOffer } from "@/lib/marketplace-offer";
import ListingPriceOptions from "@/components/ListingPriceOptions";
import { listingPriceLabel } from "@/lib/listing-price";

import SetupStatusNotice from "@/components/SetupStatusNotice";

import UnoptimizedImage from "@/components/UnoptimizedImage";

import { useFormDraft } from "@/lib/use-form-draft";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import FormDraftStatus from "@/components/FormDraftStatus";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar, MessageSquare, BarChart2, Plus, Briefcase, CheckCircle, ChevronRight,
  ExternalLink, Pencil, Save, Loader2, Upload, Check, X, Clock, ShieldCheck,
  Building2, AlertCircle, FileText, ArrowLeft,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES } from "@/lib/compressImage";
import ListingImageManager from "@/components/ListingImageManager";
import { MAX_LOCATION_IMAGES, MAX_LISTING_IMAGES } from "@/lib/listing-image-gallery";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { useAuthenticatedInbox } from "@/lib/use-authenticated-inbox";
import { useNativeDashboardBootstrap } from "@/lib/use-native-dashboard-bootstrap";

type AnalyticsConversation = {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_type: string | null;
  created_at: string;
};

type Booking = {
  currency: string;
  id: string;
  ref: string;
  listing_title: string;
  listing_type: string;
  start_date: string;
  end_date: string;
  days: number;
  total: number;
  status: string;
  created_at: string;
};

type IncomingBooking = Booking & {
  user_id: string;
  listing_id: string;
  daily_rate: number;
  notes: string | null;
  booker_name: string;
};

const VALID_TABS = ["overview", "listings", "jobs", "bookings", "settings", "analytics"];


export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const uiText = useTranslations();
  const nativeBootstrap = useNativeDashboardBootstrap(useSearchParams().toString());
  if (!isLoaded || !user) return <div className="site-container py-24" role="status">{uiText("common.loading")}</div>;
  if (nativeBootstrap) return <div className="site-container py-24" role="status" data-native-dashboard-bootstrap="v1"><h1 className="sr-only">{uiText("common.loading")}</h1></div>;
  return <DashboardContent key={user.id} />;
}

function DashboardContent() {
  const uiText = useTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Fläche (m²)": uiText("AdminReview.fields.sqm"),
    "Deckenhöhe (m)": uiText("AdminReview.fields.ceiling_height_m"),
    "Max. Crew": uiText("Ui.text_8c95b59cdc03d1"),
    "Parkplätze": uiText("AdminReview.fields.parking_spots"),
    "Stromanschluss": uiText("Ui.text_10056226f273bf"),
    "Tageslicht": uiText("AdminReview.fields.natural_light"),
    "Verdunkelbar": uiText("Ui.text_947f519f43195e"),
    "Be-/Entladung": uiText("Ui.text_78f3462ff79135"),
    "WC / Sanitär": uiText("Ui.text_800e5612baf938"),
    "Aufenthaltsraum": uiText("Ui.text_d1f40e3882943e"),
    "Küche": uiText("Ui.text_a9ec872e661915"),
    "Umkleide": uiText("Ui.text_6bb28e219f8023"),
    "Laderampe": uiText("Ui.text_7c8dc1fd90b6af"),
    "Wi-Fi": uiText("Ui.text_337253f2e8d4d1"),
    "Kontakt-E-Mail": uiText("setup.copy35"),
    "Telefonnummer": uiText("Ui.text_b6b44c97f89cbc"),
  };





  const uiLocale = useLocale();

  const moderation = useTranslations("OfferModeration");
  const marketplaceText = useTranslations("MarketplacePublishing");
  const animals = useTranslations("FilmAnimals");
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? "";
  const legacyDestination = dashboardLegacyDestination(searchParams);
  useEffect(() => {
    if (legacyDestination) router.replace(legacyDestination);
  }, [legacyDestination, router]);
  const editListingParam = searchParams.get("editListing");
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : "overview";

  // Real listings from Supabase
  const [myListings, setMyListings] = useState<{ id: string; type: string; category?: string; title: string; city: string; price: number; published: boolean; moderation_status?: string; moderation_reason?: string | null; freshness?: ListingFreshnessPreview | null; responsible_person?: ResponsiblePerson & { userId: string }; created_at: string; image_url: string | null; extra_images?: string[] | null; blocked_dates?: string[] | null; description: string; metadata?: Record<string, unknown> | null }[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");

  const [profileDisplayName, setProfileDisplayName] = useState("");
  const profileUpdateRevision = useRef(0);
  const inbox = useAuthenticatedInbox();
  const { user } = useUser();

  const navigateDashboardTab = (tab: string) => leaveEditor(() => {
    const destination = dashboardLegacyDestination(new URLSearchParams({ tab }));
    if (destination) { router.push(destination); return; }
    router.push(`/dashboard?tab=${encodeURIComponent(tab)}`, { scroll: true });
  });

  useEffect(() => {
    return subscribeToProfileUpdated((detail) => {
      if (!user?.id || detail.userId !== user.id) return;
      profileUpdateRevision.current += 1;
      if (typeof detail.displayName === "string") setProfileDisplayName(detail.displayName);
    });
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "overview" || legacyDestination) return;
    const controller = new AbortController();
    const revision = profileUpdateRevision.current;
    void fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) return null; return response.json(); })
      .then(result => {
        if (controller.signal.aborted || revision !== profileUpdateRevision.current || !result) return;
        if (typeof result.profile?.display_name === "string") setProfileDisplayName(result.profile.display_name);
      })
      .catch(() => { /* The authenticated account name remains available as a fallback. */ });
    return () => controller.abort();
  }, [activeTab, legacyDestination]);

  useEffect(() => {
    if (legacyDestination || activeTab !== "listings" && activeTab !== "analytics") return;
    setListingsLoading(true);
    fetch("/api/listings?mine=true")
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (error) { setListingsError(error); return; }
        setMyListings(data ?? []);
      })
      .catch(() => setListingsError(uiText("Ui.text_69f5153e4a2bea")))
      .finally(() => setListingsLoading(false));
  }, [activeTab, legacyDestination, uiText]);

  const togglePublished = async (id: string, current: boolean) => {
    const response = current
      ? await fetch(`/api/listings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: false }),
        })
      : await fetch(`/api/listings/${id}/publish`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      window.alert(result.error ?? uiText("Ui.text_184d93ab838f25"));
      return;
    }
    setMyListings((prev) => prev.map((l) => l.id === id ? { ...l, published: result.published ?? result.data?.published ?? false, moderation_status: result.moderation_status ?? result.data?.moderation_status ?? (current ? "hidden" : "pending") } : l));
  };

  const deleteListing = async (id: string) => {
    if (!confirm(uiText("Ui.text_b677e093ba0044"))) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    setMyListings((prev) => prev.filter((l) => l.id !== id));
  };

  const [editResponsible, setEditResponsible] = useState<ResponsiblePerson>(NEW_RESPONSIBLE_PERSON);
  const [editResponsibleErrors, setEditResponsibleErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnimalMeta, setEditAnimalMeta] = useState({ training_level: "", special_skills: "", count: "1", handler_included: true });
  const [editMarketplace,setEditMarketplace]=useState(()=>marketplaceDraft());
  const marketText=useTranslations("MarketplaceOffer"),marketLocale=useLocale();
  const [editJob, setEditJob] = useState(() => jobEditValue(""));
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", currency: "EUR", city: "", selected_place_city_id: "", image_url: "" });
  const [editGallery, setEditGallery] = useState<string[]>([]);
  const [editBlockedDates, setEditBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [editLocationMeta, setEditLocationMeta] = useState({
    indoor_outdoor: "innen", sqm: "", ceiling_height_m: "", max_crew: "", parking_spots: "",
    power_available: false, power_details: "", natural_light: false, blackout_possible: false,
    loading_access: false, access_notes: "", shooting_hours: "", availability_notes: "", price_on_request: true, price_negotiable: false,
    rooms: [] as string[], amenities: [] as string[],
  });
  const [editGalleryState, setEditGalleryState] = useState({ uploading: false, failed: 0 });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editUploading, setEditUploading] = useState(false);

  const { leave: leaveEditor } = useFormNavigation();
  const editDraft = useFormDraft({ formKey: `listing:${editingId ?? "new"}`, enabled: !!editingId,
    value: { job: editJob, marketplace:editMarketplace, form: editForm, responsible: editResponsible, gallery: editGallery, blockedDates: editBlockedDates, locationMeta: editLocationMeta, animalMeta: editAnimalMeta, newBlockedDate },
    busy: editUploading || editGalleryState.uploading || editGalleryState.failed > 0 || editSaving,
    restore: draft => {
      const listing = myListings.find(item => item.id === editingId);
      if (listing?.type === "job") {
        setEditJob(draft.job ?? jobEditValue(draft.form.description, listing.metadata));
        setEditForm({ ...draft.form, description: draft.job ? draft.form.description : parseJobDescription(draft.form.description).description });
      } else setEditForm(draft.form);
      if(draft.marketplace)setEditMarketplace(draft.marketplace); setEditResponsible(draft.responsible); setEditGallery(draft.gallery); setEditBlockedDates(draft.blockedDates); setEditLocationMeta(draft.locationMeta);
      if (draft.animalMeta) setEditAnimalMeta(draft.animalMeta); setNewBlockedDate(draft.newBlockedDate); },
  });

  const startEdit = useCallback((l: typeof myListings[number]) => {
    setEditingId(l.id);
    setEditResponsible(responsiblePersonDraft(l.responsible_person));
    setEditResponsibleErrors({});
    setEditJob(jobEditValue(l.description ?? "", l.metadata));
    setEditForm({ title: l.title, description: l.type === "job" ? parseJobDescription(l.description ?? "").description : l.description ?? "", price: String(l.price), currency: listingCurrency(l.metadata), city: placeInputValue(l, l.city), selected_place_city_id: (l as {place_city_id?: string}).place_city_id || "", image_url: l.image_url ?? "" });
    setEditGallery([l.image_url, ...(l.extra_images ?? [])].filter((url): url is string => typeof url === "string" && !!url));
    setEditBlockedDates(Array.isArray(l.blocked_dates) ? l.blocked_dates.filter((date): date is string => typeof date === "string") : []);
    setNewBlockedDate("");
    const meta = l.metadata ?? {};
    setEditMarketplace(marketplaceDraft(l.category??"",l.price,meta));
    setEditAnimalMeta({training_level:String(meta.training_level ?? ""),special_skills:String(meta.special_skills ?? ""),count:String(meta.count ?? "1"),handler_included:meta.handler_included === true});
    setEditLocationMeta({
      indoor_outdoor: typeof meta.indoor_outdoor === "string" ? meta.indoor_outdoor : "innen",
      sqm: meta.sqm == null ? "" : String(meta.sqm),
      ceiling_height_m: meta.ceiling_height_m == null ? "" : String(meta.ceiling_height_m),
      max_crew: meta.max_crew == null ? "" : String(meta.max_crew),
      parking_spots: meta.parking_spots == null ? "" : String(meta.parking_spots),
      power_available: meta.power_available === true,
      power_details: typeof meta.power_details === "string" ? meta.power_details : "",
      natural_light: meta.natural_light === true,
      blackout_possible: meta.blackout_possible === true,
      loading_access: meta.loading_access === true,
      access_notes: typeof meta.access_notes === "string" ? meta.access_notes : "",
      shooting_hours: typeof meta.shooting_hours === "string" ? meta.shooting_hours : "",
      availability_notes: typeof meta.availability_notes === "string" ? meta.availability_notes : "",
      price_on_request: meta.price_negotiable !== true && (meta.price_on_request === true || l.price <= 0),
      price_negotiable: meta.price_negotiable === true,
      rooms: Array.isArray(meta.rooms) ? meta.rooms.filter((value): value is string => typeof value === "string") : [],
      amenities: Array.isArray(meta.amenities) ? meta.amenities.filter((value): value is string => typeof value === "string") : [],
    });
    setEditGalleryState({ uploading: false, failed: 0 });
    setEditError("");
  }, [setEditingId, setEditResponsible, setEditResponsibleErrors, setEditJob, setEditForm, setEditGallery, setEditBlockedDates, setNewBlockedDate, setEditMarketplace, setEditAnimalMeta, setEditLocationMeta, setEditGalleryState, setEditError]);

  useEffect(() => {
    if (!editListingParam || activeTab !== "listings" || listingsLoading || editingId) return;
    const listing = myListings.find((item) => item.id === editListingParam);
    if (!listing) return;
    startEdit(listing);
    router.replace("/dashboard?tab=listings", { scroll: false });
    window.setTimeout(() => document.getElementById(`listing-${editListingParam}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }, [activeTab, editListingParam, editingId, listingsLoading, myListings, router, startEdit]);

  const uploadEditImage = async (file: File) => {
    setEditUploading(true);
    setEditError("");
    try {
      const compressed = await compressImage(file, { maxWidth: 1920, quality: 0.82, maxBytes: MAX_FUNCTION_UPLOAD_BYTES , translate: uiText });
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) {
        throw new Error(r.status === 413
          ? uiText("Ui.text_465670f7328f1c")
          : d.error ?? uiText("Ui.text_70f8fac9177f96"));
      }
      setEditForm((p) => ({ ...p, image_url: d.url }));
    } catch (cause) {
      setEditError(uiErrorMessage(cause, uiText("Organizations.imageError")));
    } finally { setEditUploading(false); }
  };

  const saveEdit = async () => {
    if (!editDraft.loaded || !editingId || editUploading || editGalleryState.uploading) return;
    if (editGalleryState.failed > 0) {
      setEditError(uiText("Ui.text_e0466ed245c931"));
      return;
    }
    const personErrors = (["prop", "vehicle"].includes(myListings.find(item => item.id === editingId)?.type ?? "")) ? marketplaceResponsibleErrors(editResponsible) : responsiblePersonErrors(editResponsible);
    setEditResponsibleErrors(personErrors);
    if (Object.keys(personErrors).length && myListings.find(item => item.id === editingId)?.published) { focusResponsiblePerson(); return; }
    const editingListing = myListings.find(item=>item.id===editingId);
    const placeEdit = listingPlaceEditFields(editingListing, editForm.city, editForm.selected_place_city_id);
    if (editingListing?.type === "job" && !jobSchedule({ employmentType: editJob.employmentType, startDate: editJob.startDate, endDate: editJob.endDate })) { setEditError(uiText("System.requestFailed")); return; }
    const savedDescription = editingListing?.type === "job" ? jobEditDescription(editJob, editForm.description, uiLocale) : editForm.description;
    if(editingListing?.type === "prop" || editingListing?.type === "vehicle"){
      const issue=validateMarketplaceOffer(editMarketplace.category,editingListing.type,serializeMarketplaceDraft(editMarketplace),editingListing.published);
      if(issue && (JSON.stringify(editMarketplace)!==JSON.stringify(marketplaceDraft(editingListing.category??"",editingListing.price,editingListing.metadata)) || !!editingListing.metadata?.marketplace)){setEditError(marketText(issue));return;}
    }
    if (!editForm.title.trim() || !editForm.city.trim()) {
      setEditError(uiText("Ui.text_c5e4681b4d4ef3"));
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {

      const usesGallery = editingListing?.type === "prop" || editingListing?.type === "vehicle" || editingListing?.type === "animal" || editingListing?.type === "location";
      const res = await fetch(`/api/listings/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: savedDescription,
          price: ["location", "prop", "vehicle"].includes(editingListing?.type ?? "") && editLocationMeta.price_on_request ? 0 : parseFloat(editForm.price) || 0,
          ...placeEdit,
          responsible_person: editResponsible,
          image_url: usesGallery ? editGallery[0] ?? null : editForm.image_url || null,
          ...(usesGallery ? { extra_images: editGallery.slice(1) } : {}),
          ...(editingListing?.type === "location" ? { blocked_dates: editBlockedDates } : {}),
          ...(editingListing?.type === "location" ? { metadata: {
            indoor_outdoor: editLocationMeta.indoor_outdoor,
            sqm: editLocationMeta.sqm ? Number(editLocationMeta.sqm) : null,
            ceiling_height_m: editLocationMeta.ceiling_height_m ? Number(editLocationMeta.ceiling_height_m) : null,
            max_crew: editLocationMeta.max_crew ? Number(editLocationMeta.max_crew) : null,
            parking_spots: editLocationMeta.parking_spots ? Number(editLocationMeta.parking_spots) : null,
            power_available: editLocationMeta.power_available,
            power_details: editLocationMeta.power_details,
            natural_light: editLocationMeta.natural_light,
            blackout_possible: editLocationMeta.blackout_possible,
            loading_access: editLocationMeta.loading_access,
            access_notes: editLocationMeta.access_notes,
            shooting_hours: editLocationMeta.shooting_hours,
            availability_notes: editLocationMeta.availability_notes,
            price_on_request: editLocationMeta.price_on_request,
            price_currency: editForm.currency, price_negotiable: editLocationMeta.price_negotiable,
            rooms: editLocationMeta.rooms,
            amenities: editLocationMeta.amenities,
          } } : editingListing?.type === "creator" ? {metadata:{price_currency:editForm.currency}} : editingListing?.type === "job" ? { metadata: { price_currency: editForm.currency, job: { employmentType: editJob.employmentType, startDate: editJob.startDate, endDate: editJob.endDate } } } : editingListing?.type === "animal" ? {metadata:editAnimalMeta} : usesGallery ? (validateMarketplaceOffer(editMarketplace.category,editingListing?.type??"",serializeMarketplaceDraft(editMarketplace),editingListing?.published) ? {} : {category:editMarketplace.category,metadata:marketplaceMetadataPatch(editMarketplace)}) : {}),
        }),
      });
      const { error, publicationError, data: savedListing } = await res.json();
      if (error) throw new Error(error);
      setMyListings((prev) => prev.map((l) =>
        l.id === editingId
          ? {
              ...l,
              ...(savedListing ?? {}),
              published: savedListing?.published ?? l.published,
              moderation_status: savedListing?.moderation_status ?? l.moderation_status,
              moderation_reason: savedListing?.moderation_reason ?? null,
              title: editForm.title.trim(),
              description: savedDescription,
              city: savedListing?.city ?? placeEdit.city ?? l.city,
              price: ["location", "prop", "vehicle"].includes(l.type) && editLocationMeta.price_on_request ? 0 : parseFloat(editForm.price) || 0,
              ...(l.type === "location" ? { metadata: {
                ...(l.metadata ?? {}),
                indoor_outdoor: editLocationMeta.indoor_outdoor,
                sqm: editLocationMeta.sqm ? Number(editLocationMeta.sqm) : null,
                ceiling_height_m: editLocationMeta.ceiling_height_m ? Number(editLocationMeta.ceiling_height_m) : null,
                max_crew: editLocationMeta.max_crew ? Number(editLocationMeta.max_crew) : null,
                parking_spots: editLocationMeta.parking_spots ? Number(editLocationMeta.parking_spots) : null,
                power_available: editLocationMeta.power_available,
                power_details: editLocationMeta.power_details,
                natural_light: editLocationMeta.natural_light,
                blackout_possible: editLocationMeta.blackout_possible,
                loading_access: editLocationMeta.loading_access,
                access_notes: editLocationMeta.access_notes,
                shooting_hours: editLocationMeta.shooting_hours,
                availability_notes: editLocationMeta.availability_notes,
                price_on_request: editLocationMeta.price_on_request,
            price_currency: editForm.currency, price_negotiable: editLocationMeta.price_negotiable,
                rooms: editLocationMeta.rooms,
                amenities: editLocationMeta.amenities,
              } } : l.type === "animal" ? { metadata: { ...l.metadata, ...editAnimalMeta } } : ["prop", "vehicle"].includes(l.type) ? {metadata:{...l.metadata,...marketplaceMetadataPatch(editMarketplace)}} : {}),
              ...(savedListing ? {category:savedListing.category,price:savedListing.price,metadata:savedListing.metadata} : {}),
              ...(l.type === "location" ? { blocked_dates: editBlockedDates } : {}),
              ...(l.type === "prop" || l.type === "vehicle" || l.type === "animal" || l.type === "location" ? { image_url: editGallery[0] ?? null, extra_images: editGallery.slice(1) } : { image_url: editForm.image_url || null }),
            }
          : l
      ));
      if (publicationError) { setEditError(publicationError); return; }
      await editDraft.complete();
      setEditingId(null);
    } catch (err) {
      setEditError(uiErrorMessage(err, uiText("profile.savingError")));
    } finally {
      setEditSaving(false);
    }
  };

  const typeLabel: Record<string, string> = {
    location: "Location",
    prop: "Marktplatz",
    vehicle: "Fahrzeug",
    animal: animals("portfolio"),
    job: "Job",
    creator: "Creator",
  };

  const typeHref = (l: { id: string; type: string }) => {
    if (l.type === "location") return `/locations/${l.id}`;
    if (l.type === "prop") return `/props/${l.id}`;
    if (l.type === "vehicle") return `/vehicles/${l.id}`;
    if (l.type === "animal") return `/tiere/${l.id}`;
    if (l.type === "job") return `/jobs/${l.id}`;
    if (l.type === "creator") return `/creators/${l.id}`;
    return "#";
  };

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [incomingBookings, setIncomingBookings] = useState<IncomingBooking[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [incomingError, setIncomingError] = useState(false);
  const [incomingReload, setIncomingReload] = useState(0);
  const [respondingBooking, setRespondingBooking] = useState<string | null>(null);

  const [applications, setApplications] = useState<{ id: string; job_id: string; job_title: string; status: string; day_rate: string | null; created_at: string }[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [incomingApplications, setIncomingApplications] = useState<{ id: string; job_id: string; job_title: string; applicant_id: string; applicant_name: string; applicant_avatar: string | null; message: string; portfolio_url: string | null; day_rate: string | null; status: string; created_at: string }[]>([]);
  const [incomingAppsLoading, setIncomingAppsLoading] = useState(false);
  const [respondingApp, setRespondingApp] = useState<string | null>(null);

  // My posted jobs
  const [myJobs, setMyJobs] = useState<{ id: string; title: string; published: boolean; moderation_status?: string; moderation_reason?: string | null; city: string | null; created_at: string }[]>([]);
  const [myJobsLoading, setMyJobsLoading] = useState(false);

  useEffect(() => {
    if (legacyDestination || activeTab !== "jobs") return;
    setMyJobsLoading(true);
    fetch("/api/listings?mine=true")
      .then(r => r.json())
      .then(({ data }) => setMyJobs((data ?? []).filter((l: { type: string }) => l.type === "job")))
      .catch(() => {})
      .finally(() => setMyJobsLoading(false));
  }, [activeTab, legacyDestination]);

  // Verification request state
  const [verifStatus, setVerifStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [verifError, setVerifError] = useState("");
  const [verifReason, setVerifReason] = useState("");
  const [verifReload, setVerifReload] = useState(0);
  const verifLock = useRef(false);
  const verificationText = useTranslations("VerificationReview");
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifSubmitting, setVerifSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab !== "settings") return;
    let cancelled = false;
    // A failed lookup must never appear as an unverified account or a fresh application.
    setVerifLoading(true); setVerifError("");
    fetch("/api/verification-requests", { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !["none", "pending", "approved", "rejected"].includes(result.status)) throw new Error(result.error || verificationText("statusError"));
        return result;
      })
      .then(result => { if (!cancelled) { setVerifStatus(result.status); setVerifReason(result.data?.[0]?.review_reason ?? ""); } })
      .catch(error => { if (!cancelled) setVerifError(uiErrorMessage(error, verificationText("statusError"))); })
      .finally(() => { if (!cancelled) setVerifLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, verifReload, verificationText]);

  const [conversations, setConversations] = useState<AnalyticsConversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [conversationsReady, setConversationsReady] = useState(false);
  const [conversationsLoadError, setConversationsLoadError] = useState(false);
  const [analyticsReload, setAnalyticsReload] = useState(0);

  useEffect(() => {
    if (legacyDestination || activeTab !== "bookings") return;
    setBookingsLoading(true);
    fetch("/api/bookings")
      .then(r => r.json())
      .then(({ bookings: data }) => setBookings(data ?? []))
      .catch(() => {})
      .finally(() => setBookingsLoading(false));
  }, [activeTab, legacyDestination]);

  useEffect(() => {
    if (legacyDestination || activeTab !== "bookings" && activeTab !== "overview") return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setIncomingLoading(true); setIncomingError(false); } });
    void fetch("/api/bookings?incoming=true", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.bookings)) throw new Error("unavailable");
        return result.bookings as IncomingBooking[];
      })
      .then(data => { if (!controller.signal.aborted) setIncomingBookings(data); })
      .catch(() => { if (!controller.signal.aborted) setIncomingError(true); })
      .finally(() => { if (!controller.signal.aborted) setIncomingLoading(false); });
    return () => controller.abort();
  }, [activeTab, legacyDestination, incomingReload]);

  const respondBooking = async (id: string, status: "confirmed" | "rejected") => {
    setRespondingBooking(id);
    try {
      await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setIncomingBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } finally {
      setRespondingBooking(null);
    }
  };

  useEffect(() => {
    if (legacyDestination || activeTab !== "bookings") return;
    setApplicationsLoading(true);
    fetch("/api/applications")
      .then(r => r.json())
      .then(({ applications: data }) => setApplications(data ?? []))
      .catch(() => {})
      .finally(() => setApplicationsLoading(false));
  }, [activeTab, legacyDestination]);

  useEffect(() => {
    if (activeTab !== "jobs") return;
    setIncomingAppsLoading(true);
    fetch("/api/applications?incoming=true")
      .then(r => r.json())
      .then(({ applications: data }) => setIncomingApplications(data ?? []))
      .catch(() => {})
      .finally(() => setIncomingAppsLoading(false));
  }, [activeTab]);

  const respondApplication = async (id: string, status: "accepted" | "rejected") => {
    setRespondingApp(id);
    try {
      await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setIncomingApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } finally {
      setRespondingApp(null);
    }
  };

  useEffect(() => {
    if (legacyDestination || activeTab !== "analytics") return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) { setConvsLoading(true); setConversationsLoadError(false); }
    });
    void fetch("/api/conversations", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.data)) throw new Error("unavailable");
        return result.data as AnalyticsConversation[];
      })
      .then(data => { if (!controller.signal.aborted) { setConversations(data); setConversationsReady(true); } })
      .catch(() => { if (!controller.signal.aborted) setConversationsLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setConvsLoading(false); });
    return () => controller.abort();
  }, [activeTab, legacyDestination, analyticsReload]);

  const unreadCount = inbox.status === "ready" ? inbox.count ?? 0 : 0;

  const tabTitle = () => {
    const keys: Record<string, string> = {
      overview: "nav.personalArea", listings: "nav.myOffers", jobs: "nav.myOffers",
      bookings: "nav.bookings", analytics: "nav.analytics", settings: "PersonalArea.settings",
    };
    return uiText(keys[activeTab] ?? "nav.personalArea");
  };

  if (legacyDestination) return <div className="site-container py-24" role="status">{uiText("common.loading")}</div>;

  return (
    <div className="min-h-screen w-full min-w-0 pt-16">
      {/* Hauptinhalt */}
      <div className="min-w-0 flex-1">
        {/* Top-Leiste */}
        <div data-personal-area-heading="v1" className="sticky top-[var(--site-header-height)] z-30 bg-bg-primary/80 backdrop-blur-nav border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {activeTab !== "overview" && <Link href="/dashboard" aria-label={uiText("nav.personalArea")} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-muted hover:bg-bg-elevated"><ArrowLeft size={19} aria-hidden="true" /></Link>}
            <h1 className="min-w-0 break-words text-base font-semibold text-text-primary">{tabTitle()}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">{uiText.rich("Ui.text_d4ad4f9e5b7d76", { part2: () => (<Plus size={13} />), part3: chunks => (<span className="hidden sm:inline">{chunks}</span>), part1: chunks => (<Link href="/inserat" className="min-h-11 px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors whitespace-nowrap">{chunks}</Link>) })}</div>
        </div>

        {(activeTab === "listings" || activeTab === "jobs") && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
            <button onClick={() => navigateDashboardTab("listings")} className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors ${activeTab === "listings" ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-text-secondary hover:text-text-primary"}`}>{uiText("profile.tabListings")}</button>
            <button onClick={() => navigateDashboardTab("jobs")} className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors ${activeTab === "jobs" ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-text-secondary hover:text-text-primary"}`}>{uiText("Ui.text_4012fde18eb1f5")}</button>
            <Link href="/dashboard?tab=analytics" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-text-secondary hover:bg-bg-elevated"><BarChart2 size={16} aria-hidden="true" />{uiText("nav.analytics")}</Link>
            <Link href="/company-dashboard" className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary transition-colors hover:border-gold/40 hover:text-gold">{uiText.rich("Ui.text_70ede6b97ecfb0", { part1: () => (<Building2 size={15} />) })}</Link>
          </div>
        )}


        <div className="min-w-0 w-full p-4 sm:p-6 pb-24 lg:pb-6">
          {activeTab === "overview" && (
            <div className="mx-auto w-full max-w-3xl space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-text-primary">{profileDisplayName || user?.firstName || user?.fullName || uiText("nav.personalArea")}</h2>
                <p className="mt-1 text-sm text-text-muted"><DashboardDate /></p>
              </div>
              {(unreadCount > 0 || incomingBookings.some(booking => booking.status === "pending")) && <section aria-label={uiText("Ui.text_a4ba73300ac027")} className="space-y-2">
                {unreadCount > 0 && <Link href="/messages" className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm"><MessageSquare size={18} className="shrink-0 text-gold" /><span className="min-w-0 flex-1 break-words">{uiText("notifications.newMessages", { count: unreadCount })}</span><ChevronRight size={16} className="shrink-0 text-text-muted" /></Link>}
                {incomingBookings.some(booking => booking.status === "pending") && <Link href="/dashboard?tab=bookings" className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm"><Calendar size={18} className="shrink-0 text-gold" /><span className="min-w-0 flex-1 break-words">{uiText("nav.bookings")}</span><span className="text-gold">{incomingBookings.filter(booking => booking.status === "pending").length}</span><ChevronRight size={16} className="shrink-0 text-text-muted" /></Link>}
              </section>}
              {(inbox.status === "error" || inbox.status === "expired") && <Link href="/messages" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm text-text-secondary"><span>{uiText("nav.messages")}</span><span>{uiText("common.unavailable")}</span></Link>}
              {incomingError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3 text-sm text-text-secondary"><span>{uiText("nav.bookings")}: {uiText("common.unavailable")}</span><button type="button" onClick={() => setIncomingReload(value => value + 1)} className="min-h-11 rounded-lg border border-border px-3 text-text-primary">{uiText("PrivacySettings.retry")}</button></div>}
              <SetupStatusNotice />
              <PersonalAreaHome />
            </div>
          )}

          {/* ── JOBS VERWALTEN ── */}
          {activeTab === "jobs" && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  {myJobsLoading ? uiText("Ui.text_7a72dd7b9d46f7") : (
                    <>{uiText.rich("Ui.text_dadac5c68780b4", { value2: () => (myJobs.length), part1: chunks => (<span className="text-text-primary font-semibold">{chunks}</span>), value3: () => (myJobs.length === 1 ? uiText("AdminAccounts.contentKinds.job") : uiText("nav.jobs")) })}</>
                  )}
                </p>
                <a href="/inserat?group=jobs" className="min-h-11 px-3 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_cdb4a69a5b9f1f", { part1: () => (<Plus size={12} />) })}</a>
              </div>

              {myJobsLoading && (
                <div className="flex items-center gap-3 text-sm text-text-muted py-4">{uiText.rich("Ui.text_e68bc26b2fc6f2", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</div>
              )}

              {!myJobsLoading && myJobs.length === 0 && (
                <div className="text-center py-14 border border-dashed border-border rounded-2xl space-y-4">
                  <div className="w-14 h-14 mx-auto bg-bg-secondary border border-border rounded-2xl flex items-center justify-center">
                    <Briefcase size={24} className="text-text-muted opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-secondary">{uiText("jobs.emptyTitle")}</p>
                    <p className="text-xs text-text-muted mt-1">{uiText("Ui.text_3cf15f201498d9")}</p>
                  </div>
                  <a href="/inserat?group=jobs" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_cdb4a69a5b9f1f", { part1: () => (<Plus size={13} />) })}</a>
                </div>
              )}

              {!myJobsLoading && myJobs.map((job) => (
                <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-elevated transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    <Briefcase size={16} className="text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-semibold text-sm text-text-primary truncate">{job.title}</p>
                      <OfferModerationStatus item={job} />
                    </div>
                    <p className="text-xs text-text-muted">
                      {[job.city].filter(Boolean).join(" · ")} · {new Date(job.created_at).toLocaleDateString(uiLocale)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">{uiText.rich("Ui.text_d960f86ce558e1", { part1: chunks => (<a href={`/jobs/${job.id}${job.published ? "" : "?preview=1"}`} target="_blank" rel="noopener noreferrer"
                      className="min-h-11 px-3 py-2 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center">{chunks}</a>), part3: () => (<Pencil size={10} />), part2: chunks => (<a href={`/dashboard?tab=listings&editListing=${job.id}`}
                      className="min-h-11 px-3 py-2 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center flex items-center gap-1 justify-center">{chunks}</a>) })}</div>
                </div>
              ))}

              {/* Eingegangene Bewerbungen */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden mt-6">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary text-sm">{uiText("Ui.text_34c2cdc13ab479")}</h3>
                  {incomingApplications.filter(a => a.status === "pending").length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gold/15 text-gold border border-gold/30">{uiText.rich("Ui.text_488b93937e6625", { value1: () => (incomingApplications.filter(a => a.status === "pending").length) })}</span>
                  )}
                </div>
                {incomingAppsLoading && <div className="p-8 text-center text-xs text-text-muted">{uiText("Ui.text_b89b8cdb9d6d6f")}</div>}
                {!incomingAppsLoading && incomingApplications.length === 0 && (
                  <div className="p-8 text-center space-y-2">
                    <FileText size={24} className="mx-auto text-text-muted opacity-20" />
                    <p className="text-sm text-text-muted">{uiText("Ui.text_f1e852a8804982")}</p>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {incomingApplications.map((a) => (
                    <div key={a.id} className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        {a.applicant_avatar ? (
                          <UnoptimizedImage src={a.applicant_avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-text-muted">{a.applicant_name[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">{uiText.rich("Ui.text_b247060e171e82", { value2: () => (a.applicant_name), part1: chunks => (<Link href={`/profile/${a.applicant_id}`} className="text-sm font-semibold text-text-primary hover:text-gold transition-colors">{chunks}</Link>), part3: chunks => (<span className="text-xs text-text-muted">{chunks}</span>), value5: () => (a.job_title), part4: chunks => (<Link href={`/jobs/${a.job_id}`} className="text-xs text-gold hover:text-gold-light transition-colors truncate max-w-[160px]">{chunks}</Link>), value6: () => (a.day_rate && <span className="text-xs text-text-muted">· {a.day_rate}</span>) })}</div>
                          <p className="text-xs text-text-muted mt-1">{new Date(a.created_at).toLocaleDateString(uiLocale)}</p>
                        </div>
                        <div className="shrink-0">
                          {a.status === "pending" ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => respondApplication(a.id, "accepted")}
                                disabled={respondingApp === a.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors disabled:opacity-50"
                              >{uiText.rich("Ui.text_048edf533fa6f4", { part1: () => (<Check size={11} />) })}</button>
                              <button
                                onClick={() => respondApplication(a.id, "rejected")}
                                disabled={respondingApp === a.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-crimson/10 text-crimson-light border border-crimson/30 hover:bg-crimson/20 transition-colors disabled:opacity-50"
                              >{uiText.rich("Ui.text_2424239b7d6d6c", { part1: () => (<X size={11} />) })}</button>
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                              a.status === "accepted" ? "border-success/30 bg-success/10 text-success" : "border-crimson/30 bg-crimson/10 text-crimson-light"
                            }`}>
                              {a.status === "accepted" ? uiText("Ui.text_5fb36cf9e74bd2") : uiText("OfferModeration.statuses.rejected")}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 pl-12">{a.message}</p>
                      {a.portfolio_url && (
                        <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gold hover:text-gold-light transition-colors pl-12">{uiText.rich("Ui.text_774fce08c2d43b", { part1: () => (<ExternalLink size={10} />) })}</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── INSERATE ── */}
          {activeTab === "listings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                  {listingsLoading ? uiText("Ui.text_7a72dd7b9d46f7") : (
                    <><span className="text-text-primary font-semibold">{myListings.length}</span> {myListings.length === 1 ? uiText("AdminAccounts.contentKinds.other") : uiText("profile.tabListings")}</>
                  )}
                </p>
                <Link href="/inserat" className="min-h-11 px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_8ba166e3d0597a", { part1: () => (<Plus size={12} />) })}</Link>
              </div>

              {listingsError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{listingsError}</p>
              )}

              {!listingsLoading && myListings.length === 0 && !listingsError && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <p className="text-text-muted mb-4">{uiText("Ui.text_a4fdb924988e08")}</p>
                  <Link href="/inserat" className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors inline-flex items-center gap-2">{uiText.rich("Ui.text_7ec80552729795", { part1: () => (<Plus size={14} />) })}</Link>
                </div>
              )}

              {myListings.map((l) => (
                <div key={l.id} id={`listing-${l.id}`}>
                <div className={`flex items-center gap-4 p-5 rounded-xl border bg-bg-secondary transition-colors ${editingId === l.id ? "border-gold/30" : "border-border hover:bg-bg-elevated"}`}>
                  <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 overflow-hidden text-2xl">
                    {l.image_url
                      ? <UnoptimizedImage src={l.image_url} alt={l.title} className="w-full h-full object-cover" />
                      : (l.type === "location" ? "📍" : l.type === "vehicle" ? "🚗" : l.type === "job" ? "💼" : l.type === "creator" ? "🎬" : "📦")
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-text-primary">{l.title}</h3>
                    </div>
                    <OfferModerationStatus item={l} explain /><p className="text-xs text-text-muted mb-1">{typeLabel[l.type] ?? l.type} · {l.city}</p>
                    <p className="text-xs text-text-muted">{uiText.rich("Ui.text_35a1b4ab0d266c", { value1: () => (listingPriceLabel(l.price,l.metadata,"/Tag",marketLocale,marketText)), value2: () => (new Date(l.created_at).toLocaleDateString(uiLocale)) })}</p>
                    <ListingFreshnessSummary listingId={l.id} state={l.freshness} onNavigate={() => router.push(`/listing-status/${encodeURIComponent(l.id)}`)} />
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      href={typeHref(l)}
                      className="px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:border-gold hover:text-gold rounded-md transition-all text-center"
                    >{uiText("Ui.text_8e31363947a6c7")}</Link>
                    <button
                      onClick={() => leaveEditor(() => editingId === l.id ? setEditingId(null) : startEdit(l))}
                      disabled={editingId === l.id && (editGalleryState.uploading || editUploading)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                        editingId === l.id
                          ? "border border-gold bg-gold/10 text-gold"
                          : "border border-border text-text-secondary hover:border-gold hover:text-gold"
                      }`}
                    >{uiText.rich("Ui.text_603ead2ae843f0", { part1: () => (<Pencil size={10} />) })}</button>
                    <button
                      onClick={() => togglePublished(l.id, l.published)}
                      disabled={l.moderation_status === "pending" && l.type !== "prop" && l.type !== "vehicle"}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        l.published
                          ? "border border-gold/30 text-gold hover:bg-gold/10"
                          : "border border-success/30 text-success hover:bg-success/10"
                      }`}
                    >
                      {!l.published && (l.type === "prop" || l.type === "vehicle") ? marketplaceText("publish") : moderation(l.published ? "hide" : l.moderation_status === "pending" ? "statuses.pending" : "submit")}
                    </button>
                    <button
                      onClick={() => deleteListing(l.id)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                    >{uiText("common.clearFilter")}</button>
                  </div>
                </div>

                {/* ── Inline Edit Panel ── */}
                {editingId === l.id && (
                  <div className="mt-3 p-4 rounded-xl border border-gold/20 bg-gold/5 space-y-3">
                    <p className="text-xs font-semibold text-gold uppercase tracking-widest">{uiText("Ui.text_9f452b430cd77c")}</p>
                    <p className="mb-3 text-xs leading-5 text-text-muted">{moderation("editNotice")}</p><FormDraftStatus draft={editDraft} />
                    {editError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{editError}</p>
                    )}
                    {l.type === "location" && <PrivateLocationEditor key={l.id} id={l.id} onSaved={() => { void fetch("/api/listings?mine=true", { cache: "no-store" }).then(r => r.json()).then(body => { if (Array.isArray(body.data)) setMyListings(body.data); }).catch(() => {}); }} />}
                    {/* Image upload */}
                    {l.type === "prop" || l.type === "vehicle" || l.type === "animal" || l.type === "location" ? (
                      <ListingImageManager
                        value={editGallery}
                        maxImages={l.type === "location" ? MAX_LOCATION_IMAGES : MAX_LISTING_IMAGES}
                        onChange={(urls) => {
                          setEditGallery(urls);
                          setEditForm((current) => ({ ...current, image_url: urls[0] ?? "" }));
                        }}
                        onStatusChange={setEditGalleryState}
                        label={l.type === "location" ? uiText("Ui.text_fdff84960c7129") : uiText("Ui.text_62e0c060c11ffc")}
                      />
                    ) : <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("Ui.text_375e84034b8ff2")}</label>
                      <div className="flex items-center gap-3">
                        {editForm.image_url && (
                          <UnoptimizedImage src={editForm.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                        )}
                        <label className={`flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs text-text-secondary hover:border-gold hover:text-gold transition-colors cursor-pointer ${editUploading ? "opacity-50 pointer-events-none" : ""}`}>
                          {editUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          {editUploading ? uiText("Ui.text_7596def5825b62") : uiText("Ui.text_6fc3fbbc479537")}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadEditImage(f); e.currentTarget.value = ""; }} />
                        </label>
                        {editForm.image_url && (
                          <button onClick={() => setEditForm((p) => ({ ...p, image_url: "" }))} className="text-xs text-red-400 hover:text-red-300 transition-colors">{uiText("profile.removePhoto")}</button>
                        )}
                      </div>
                    </div>}
                    <ContentUsageNotice context="offer" visibility="configured" />

                    {l.type === "location" && (
                      <div className="space-y-3 rounded-lg border border-border bg-bg-secondary p-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{uiText("Ui.text_1fe7c4ccc363a4")}</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {([
                            ["sqm", "Fläche (m²)"], ["ceiling_height_m", "Deckenhöhe (m)"],
                            ["max_crew", "Max. Crew"], ["parking_spots", "Parkplätze"],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="text-[11px] text-text-muted">{(uiOptionLabels[label] ?? label)}
                              <input type="number" min="0" step={key === "ceiling_height_m" ? "0.1" : "1"} value={editLocationMeta[key]} onChange={(event) => setEditLocationMeta((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-elevated px-2.5 text-sm text-text-primary" />
                            </label>
                          ))}
                          <label className="text-[11px] text-text-muted">{uiText("Ui.text_422e70802caa3e")}<select value={editLocationMeta.indoor_outdoor} onChange={(event) => setEditLocationMeta((current) => ({ ...current, indoor_outdoor: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-elevated px-2.5 text-sm text-text-primary">
                              <option value="innen">{uiText("locations.filterInnen")}</option><option value="außen">{uiText("locations.filterAussen")}</option><option value="beides">{uiText("locations.filterInnenAussen")}</option>
                            </select>
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {([
                            ["power_available", "Stromanschluss"], ["natural_light", "Tageslicht"],
                            ["blackout_possible", "Verdunkelbar"], ["loading_access", "Be-/Entladung"],
                          ] as const).map(([key, label]) => (
                            <button key={key} type="button" aria-pressed={editLocationMeta[key]} onClick={() => setEditLocationMeta((current) => ({ ...current, [key]: !current[key] }))} className={`min-h-11 rounded-lg border px-3 text-xs ${editLocationMeta[key] ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{editLocationMeta[key] ? "✓ " : ""}{(uiOptionLabels[label] ?? label)}</button>
                          ))}
                        </div>
                        {editLocationMeta.power_available && <input maxLength={160} value={editLocationMeta.power_details} onChange={(event) => setEditLocationMeta((current) => ({ ...current, power_details: event.target.value }))} placeholder={uiText("Ui.text_45387017a0e70b")} className="min-h-10 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input maxLength={160} value={editLocationMeta.shooting_hours} onChange={(event) => setEditLocationMeta((current) => ({ ...current, shooting_hours: event.target.value }))} placeholder={uiText("AdminReview.fields.shooting_hours")} className="min-h-11 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />
                          <input maxLength={240} value={editLocationMeta.access_notes} onChange={(event) => setEditLocationMeta((current) => ({ ...current, access_notes: event.target.value }))} placeholder={uiText("Ui.text_01231d096c526a")} className="min-h-11 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />
                        </div>
                        <textarea maxLength={500} rows={2} value={editLocationMeta.availability_notes} onChange={(event) => setEditLocationMeta((current) => ({ ...current, availability_notes: event.target.value }))} placeholder={uiText("Ui.text_e6c48894da484b")} className="w-full rounded-lg border border-border bg-bg-elevated p-3 text-sm text-text-primary" />
                        <div>
                          <label className="mb-2 block text-xs text-text-muted">{uiText("Ui.text_29f202bb606cb9")}</label>
                          <div className="flex flex-wrap gap-2">
                            <input type="date" value={newBlockedDate} onChange={(event) => setNewBlockedDate(event.target.value)} className="min-h-11 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />
                            <button type="button" disabled={!newBlockedDate || editBlockedDates.includes(newBlockedDate)} onClick={() => { setEditBlockedDates((dates) => [...dates, newBlockedDate].sort()); setNewBlockedDate(""); }} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-secondary hover:border-gold hover:text-gold disabled:opacity-50">{uiText("Ui.text_cab5a16e99fc42")}</button>
                          </div>
                          {editBlockedDates.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{editBlockedDates.map((date) => <button key={date} type="button" onClick={() => setEditBlockedDates((dates) => dates.filter((item) => item !== date))} aria-label={uiText("Ui.text_88099c029f3803", { value1: String(date) })} className="min-h-8 rounded-full border border-crimson/30 bg-crimson/10 px-3 text-xs text-crimson-light">{new Date(`${date}T00:00:00`).toLocaleDateString(uiLocale)} ×</button>)}</div> : <p className="mt-2 text-[11px] text-text-muted">{uiText("Ui.text_e7d710d709332d")}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {[["restrooms", "WC / Sanitär"], ["green_room", "Aufenthaltsraum"], ["kitchen", "Küche"], ["changing_room", "Umkleide"], ["loading_bay", "Laderampe"], ["wifi", "Wi-Fi"]].map(([key, label]) => {
                            const active = editLocationMeta.amenities.includes(key);
                            return <button key={key} type="button" aria-pressed={active} onClick={() => setEditLocationMeta((current) => ({ ...current, amenities: active ? current.amenities.filter((item) => item !== key) : [...current.amenities, key] }))} className={`min-h-11 rounded-lg border px-2 text-xs ${active ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{active ? "✓ " : ""}{(uiOptionLabels[label] ?? label)}</button>;
                          })}
                        </div>
                        {editLocationMeta.rooms.length > 0 && <p className="text-[11px] text-text-muted">{uiText.rich("Ui.text_086e921432683e", { value1: () => (editLocationMeta.rooms.map((room) => locationRoomLabel(room, l.category ?? "", uiText)).join(" · ")) })}</p>}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {l.type === "animal" && <fieldset className="space-y-3 rounded-xl border border-border p-4"><legend className="px-1 text-sm text-text-primary">{animals("portfolioDetails")}</legend><label className="block text-sm">{animals("training")}<input value={editAnimalMeta.training_level} maxLength={120} onChange={event=>setEditAnimalMeta(value=>({...value,training_level:event.target.value}))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3" /></label><label className="block text-sm">{animals("skills")}<textarea value={editAnimalMeta.special_skills} maxLength={2000} onChange={event=>setEditAnimalMeta(value=>({...value,special_skills:event.target.value}))} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-bg-primary p-3" /></label><p className="text-xs text-text-muted">{animals("conditions")}</p></fieldset>}
                      <ResponsiblePersonFields compactWhenProfile={l.type === "prop" || l.type === "vehicle"} value={editResponsible} onChange={setEditResponsible} errors={editResponsibleErrors} accountPrefill={!l.responsible_person || l.responsible_person.userId === user?.id} disabled={Boolean(l.responsible_person && l.responsible_person.userId !== user?.id)} />
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("Ui.text_fe0fc68dab2d5b")}</label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                          className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
                          placeholder={uiText("Ui.text_5c76bbf6fd35eb")}
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("Ui.text_a7f3095e67f2ba")}</label>
                        <PlaceField value={editForm.city} onChange={(value, cityId) => setEditForm(p => ({ ...p, city: value, selected_place_city_id: cityId || "" }))} required />
                      </div>
                    </div>
                    <div>
                      {["prop","vehicle"].includes(l.type) && <MarketplaceOfferFields value={editMarketplace} vehicleOnly={l.type === "vehicle"} onChange={setEditMarketplace} />}
                      {["location", "job", "creator"].includes(l.type) && <CurrencySelect value={editForm.currency} onChange={currency => setEditForm(p => ({...p, currency}))} />}
                      {l.type === "location" && <ListingPriceOptions onRequest={editLocationMeta.price_on_request} negotiable={editLocationMeta.price_negotiable} onChange={value=>setEditLocationMeta(current=>({...current,price_on_request:value.priceOnRequest,price_negotiable:value.priceNegotiable}))} />}
                      {["prop","vehicle"].includes(l.type) ? null : l.type === "animal" ? <p className="text-xs text-text-muted">{animals("conditions")}</p> : !editLocationMeta.price_on_request || !["location", "prop", "vehicle"].includes(l.type) ? <>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">{l.type === "location" ? uiText("Ui.text_2d78239ac0e617") : uiText("Ui.text_177ce41dae81c2")}</label>
                        <input type="number" min="0" value={editForm.price} onChange={(e) => { setEditLocationMeta((current) => ({ ...current, price_on_request: false })); setEditForm((p) => ({ ...p, price: e.target.value })); }} className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm transition-colors focus:border-gold focus:outline-none" placeholder="500" />
                      </> : <p className="text-xs text-text-muted">{uiText("Ui.text_aabd03635f4100")}</p>}
                    </div>
                    {l.type === "job" && <JobEditorFields value={editJob} onChange={setEditJob} />}
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("setup.description")}</label>
                      <textarea
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
                        placeholder={uiText("Ui.text_f2b04667fff22d")}
                      />
                      {(l.type === "location" || l.type === "prop" || l.type === "vehicle") && <GenieWritingAssistant area={l.type === "location" ? "location" : "marketplace"} value={editForm.description} onApply={(text) => setEditForm((current) => ({ ...current, description: text }))} maxLength={2000} contextKey={`listing-edit:${editingId}:description`} disabled={editSaving || editUploading || editGalleryState.uploading} />}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => leaveEditor(() => setEditingId(null))}
                        disabled={editGalleryState.uploading || editUploading}
                        className="px-4 py-2 text-xs font-medium border border-border text-text-secondary hover:text-text-primary rounded-lg transition-all"
                      >{uiText("home.boardCancel")}</button>
                      <button
                        onClick={saveEdit}
                        disabled={!editDraft.loaded || editSaving || editUploading || editGalleryState.uploading || editGalleryState.failed > 0}
                        className="px-4 py-2 text-xs font-semibold bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors flex items-center gap-1.5 disabled:opacity-60"
                      >{uiText.rich("Ui.text_577b2220b25dbe", { value1: () => (editSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />) })}</button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}

          {/* ── BUCHUNGEN ── */}
          {activeTab === "bookings" && (
            <div className="space-y-6">
              {incomingError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><span>{uiText("common.unavailable")}</span><button type="button" onClick={() => setIncomingReload(value => value + 1)} className="min-h-11 rounded-lg border border-border px-3 text-text-primary">{uiText("PrivacySettings.retry")}</button></div>}
              {/* Stats row */}
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: uiText("Ui.text_07b314aaa3295b"), value: bookingsLoading ? "…" : String(bookings.length) },
                  { label: uiText("Places.verified"), value: bookingsLoading ? "…" : String(bookings.filter(b => b.status === "confirmed").length) },
                  { label: uiText("Ui.text_f154c270e3bd85"), value: incomingLoading ? "…" : String(incomingBookings.length) },
                  { label: uiText("profile.verifPendingStatus"), value: incomingLoading ? "…" : String(incomingBookings.filter(b => b.status === "pending").length), highlight: incomingBookings.filter(b => b.status === "pending").length > 0 },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className={`p-4 rounded-xl border bg-bg-secondary ${highlight ? "border-gold/40 bg-gold/5" : "border-border"}`}>
                    <p className="text-xs text-text-muted uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-xl font-bold font-display ${highlight ? "text-gold" : "text-text-primary"}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Eingehende Buchungsanfragen ── */}
              {(incomingLoading || incomingBookings.length > 0) && (
                <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-semibold text-text-primary">{uiText("Ui.text_18378fcd910064")}</h2>
                    {incomingBookings.filter(b => b.status === "pending").length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gold/15 text-gold border border-gold/30">{uiText.rich("Ui.text_9ff22fb6846fab", { value1: () => (incomingBookings.filter(b => b.status === "pending").length) })}</span>
                    )}
                  </div>
                  {incomingLoading && <div className="p-8 text-center text-xs text-text-muted">{uiText("Ui.text_b89b8cdb9d6d6f")}</div>}
                  <div className="divide-y divide-border">
                    {incomingBookings.map((b) => (
                      <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                        <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0 text-lg">
                          {b.listing_type === "location" ? "📍" : b.listing_type === "vehicle" ? "🚗" : b.listing_type === "creator" ? "🎬" : b.listing_type === "job" ? "💼" : "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{b.listing_title}</p>
                          <p className="text-xs text-text-muted">{uiText.rich("Ui.text_769af32128cf5d", { value2: () => (b.booker_name), part1: chunks => (<span className="text-text-secondary font-medium">{chunks}</span>), value3: () => (new Date(b.start_date).toLocaleDateString(uiLocale, { day: "numeric", month: "short" })), value4: () => (new Date(b.end_date).toLocaleDateString(uiLocale, { day: "numeric", month: "short", year: "numeric" })), value5: () => (b.days), count6: b.days })}</p>
                          {b.notes && <p className="text-xs text-text-muted mt-1 italic line-clamp-1">„{b.notes}”</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm font-semibold text-text-primary mr-1">{formatOfferAmount(b.total, b.currency, uiLocale)}</p>
                          {b.status === "pending" ? (
                            <>
                              <button
                                onClick={() => respondBooking(b.id, "confirmed")}
                                disabled={respondingBooking === b.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors disabled:opacity-50"
                              >{uiText.rich("Ui.text_048edf533fa6f4", { part1: () => (<Check size={12} />) })}</button>
                              <button
                                onClick={() => respondBooking(b.id, "rejected")}
                                disabled={respondingBooking === b.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-crimson/10 text-crimson-light border border-crimson/30 hover:bg-crimson/20 transition-colors disabled:opacity-50"
                              >{uiText.rich("Ui.text_2424239b7d6d6c", { part1: () => (<X size={12} />) })}</button>
                            </>
                          ) : (
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                              b.status === "confirmed"
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-crimson/30 bg-crimson/10 text-crimson-light"
                            }`}>
                              {b.status === "confirmed" ? uiText("Ui.text_5fb36cf9e74bd2") : uiText("OfferModeration.statuses.rejected")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookings list */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-text-primary">{uiText("Ui.text_07b314aaa3295b")}</h2>
                </div>
                {bookingsLoading && (
                  <div className="p-8 text-center text-xs text-text-muted">{uiText("Ui.text_b89b8cdb9d6d6f")}</div>
                )}
                {!bookingsLoading && bookings.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <Calendar size={32} className="mx-auto text-text-muted opacity-20" />
                    <p className="text-text-muted text-sm">{uiText("Ui.text_43bc3914441afe")}</p>
                    <p className="text-xs text-text-muted">{uiText("Ui.text_d9239010d75f1d")}</p>
                    <div className="flex gap-2 justify-center pt-1">{uiText.rich("Ui.text_1e3a01a7fdd097", { part1: chunks => (<Link href="/locations" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">{chunks}</Link>), part2: chunks => (<Link href="/vehicles" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">{chunks}</Link>), part3: chunks => (<Link href="/props" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors">{chunks}</Link>) })}</div>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {bookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-lg">
                        {b.listing_type === "location" ? "📍" : b.listing_type === "vehicle" ? "🚗" : b.listing_type === "creator" ? "🎬" : b.listing_type === "job" ? "💼" : "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{b.listing_title}</p>
                        <p className="text-xs text-text-muted">{uiText.rich("Ui.text_0e057549877a43", { value1: () => (new Date(b.start_date).toLocaleDateString(uiLocale, { day: "numeric", month: "short" })), value2: () => (new Date(b.end_date).toLocaleDateString(uiLocale, { day: "numeric", month: "short", year: "numeric" })), value3: () => (b.days), count4: b.days })}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-semibold text-text-primary">{formatOfferAmount(b.total, b.currency, uiLocale)}</p>
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                          b.status === "confirmed" ? "border-success/30 bg-success/10 text-success" :
                          b.status === "rejected" ? "border-crimson/30 bg-crimson/10 text-crimson-light" :
                          "border-gold/30 bg-gold/10 text-gold"
                        }`}>
                          {b.status === "confirmed" ? uiText("Places.verified") : b.status === "rejected" ? uiText("OfferModeration.statuses.rejected") : uiText("profile.verifPendingStatus")}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted font-mono shrink-0 hidden sm:block">{b.ref}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Applications */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">{uiText("Ui.text_c070d2846d0c1c")}</h2>
                  {applications.length > 0 && (
                    <span className="text-xs text-text-muted">{uiText.rich("Ui.text_4af0acf46d1609", { value1: () => (applications.length) })}</span>
                  )}
                </div>
                {applicationsLoading && <div className="p-8 text-center text-xs text-text-muted">{uiText("Ui.text_b89b8cdb9d6d6f")}</div>}
                {!applicationsLoading && applications.length === 0 && (
                  <div className="text-center py-10 space-y-2">
                    <Briefcase size={28} className="mx-auto text-text-muted opacity-20" />
                    <p className="text-sm text-text-muted">{uiText("Ui.text_2e4e8be62f4a5d")}</p>
                    <Link href="/jobs" className="text-xs text-gold hover:text-gold-light transition-colors">{uiText("Ui.text_8b90b8520c109d")}</Link>
                  </div>
                )}
                <div className="divide-y divide-border">
                  {applications.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                        <Briefcase size={16} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{a.job_title}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(a.created_at).toLocaleDateString(uiLocale, { day: "numeric", month: "short", year: "numeric" })}
                          {a.day_rate ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(a.day_rate) }) : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${
                        a.status === "accepted" ? "border-success/30 bg-success/10 text-success" :
                        a.status === "rejected" ? "border-crimson/30 bg-crimson/10 text-crimson-light" :
                        "border-gold/30 bg-gold/10 text-gold"
                      }`}>
                        {a.status === "accepted" ? uiText("Ui.text_5fb36cf9e74bd2") : a.status === "rejected" ? uiText("OfferModeration.statuses.rejected") : uiText("profile.verifPendingStatus")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYSEN ── */}
          {activeTab === "analytics" && (() => {
            // Compute top listings by inquiry count from real conversations
            const inquiryMap = conversations.reduce<Record<string, { title: string; type: string; count: number }>>((acc, c) => {
              if (!c.listing_id) return acc;
              if (!acc[c.listing_id]) acc[c.listing_id] = { title: c.listing_title ?? uiText("Ui.text_276ffa1fb4f970"), type: c.listing_type ?? "", count: 0 };
              acc[c.listing_id].count++;
              return acc;
            }, {});
            const topByInquiries = Object.entries(inquiryMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
            // Fall back to real listings if no conversations yet
            const topListings = topByInquiries.length > 0
              ? topByInquiries.map(([id, d]) => ({ id, title: d.title, type: d.type, count: d.count }))
              : myListings.slice(0, 5).map((l) => ({ id: l.id, title: l.title, type: l.type, count: 0 }));
            const maxCount = Math.max(...topListings.map(l => l.count), 1);

            const listingsWithInquiries = new Set(conversations.map(c => c.listing_id).filter(Boolean)).size;

            return (
              <div className="space-y-6">
                {conversationsLoadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><span>{uiText("common.unavailable")}</span><button type="button" onClick={() => setAnalyticsReload(value => value + 1)} className="min-h-11 rounded-lg border border-border px-4 text-text-primary">{uiText("PrivacySettings.retry")}</button></div>}
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    {
                      label: uiText("Ui.text_3e85ef1a96ad89"),
                      value: convsLoading ? "…" : !conversationsReady ? "—" : String(conversations.length),
                      sub: conversationsLoadError ? uiText("common.unavailable") : !conversationsReady ? uiText("creators.loading") : unreadCount > 0 ? uiText("Ui.text_f7c1688df1fc46", { value1: String(unreadCount) }) : uiText("notifications.markAllRead"),
                    },
                    {
                      label: uiText("Ui.text_67ed1256b3af19"),
                      value: listingsLoading ? "…" : String(myListings.filter(l => l.published).length),
                      sub: uiText("Ui.text_888c0247e6c804", { value1: String(myListings.length) }),
                    },
                    {
                      label: uiText("Ui.text_de005465742f1c"),
                      value: convsLoading ? "…" : !conversationsReady ? "—" : String(listingsWithInquiries),
                      sub: myListings.length > 0 ? uiText("Ui.text_31f02718f6b03e", { value1: String(myListings.length) }) : uiText("Ui.text_c9636816421535"),
                    },
                    {
                      label: uiText("Ui.text_de3a80218e65be"),
                      value: inbox.status === "ready" ? String(unreadCount) : inbox.status === "error" || inbox.status === "expired" ? "—" : "…",
                      sub: conversationsLoadError ? uiText("common.unavailable") : !conversationsReady ? uiText("creators.loading") : unreadCount > 0 ? uiText("Ui.text_4aadfb7b596d7b") : uiText("Ui.text_2fa1e634d924d7"),
                    },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="p-5 rounded-xl border border-border bg-bg-secondary">
                      <p className="text-xs text-text-muted uppercase tracking-widest mb-2">{label}</p>
                      <p className="text-2xl font-bold font-display text-gold">{value}</p>
                      <p className="text-xs text-text-muted mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">{uiText.rich("Ui.text_c733b930779dfd", { part1: () => (<BarChart2 size={16} className="text-gold" />) })}</h3>
                  {conversations.length === 0 ? (
                    <div className="flex items-end gap-2 h-28 opacity-30">
                      {[0, 0, 0, 0, 0, 0, 0].map((_, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t bg-gold/30" style={{ height: "4px" }} />
                          <span className="text-[10px] text-text-muted">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}</span>
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    // Count conversations per day over last 7 days
                    const days: number[] = Array(7).fill(0);
                    const now = new Date();
                    conversations.forEach((c) => {
                      const d = new Date(c.created_at);
                      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
                      if (diff >= 0 && diff < 7) days[6 - diff]++;
                    });
                    const maxDay = Math.max(...days, 1);
                    return (
                      <div className="flex items-end gap-2 h-28">
                        {days.map((v, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t bg-gold/40 hover:bg-gold/70 transition-colors"
                              style={{ height: `${Math.max((v / maxDay) * 100, v > 0 ? 8 : 2)}%` }}
                            />
                            <span className="text-[10px] text-text-muted">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                  <h3 className="font-semibold text-text-primary mb-4">
                    {topByInquiries.length > 0 ? uiText("Ui.text_dfb05272966bf6") : uiText("profile.sectionMyListings")}
                  </h3>
                  {topListings.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-4">{uiText.rich("Ui.text_7dbba572473a9c", { part1: chunks => (<Link href="/inserat" className="text-gold hover:text-gold-light transition-colors">{chunks}</Link>) })}</p>
                  ) : (
                    <div className="space-y-3">
                      {topListings.map((l, i) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <span className="text-xs text-text-muted w-4 shrink-0">{i + 1}</span>
                          <div className="w-8 h-8 rounded bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 text-base">
                            {l.type === "location" ? "📍" : l.type === "vehicle" ? "🚗" : l.type === "job" ? "💼" : l.type === "creator" ? "🎬" : "📦"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary truncate">{l.title}</p>
                            <div className="w-full bg-bg-elevated rounded-full h-1.5 mt-1">
                              <div
                                className="bg-gold h-1.5 rounded-full transition-all"
                                style={{ width: `${(l.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-sm font-mono text-text-secondary shrink-0">
                            {l.count} {l.count === 1 ? uiText("Ui.text_d131ffcac53b09") : uiText("Ui.text_5dfb5bcd667e78")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === "settings" && <div className="mx-auto max-w-3xl">
            <PersonalSettings accountId={user?.id ?? null}
              verification={(
<div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">{uiText.rich("Ui.text_ea23f7824c8628", { part1: () => (<ShieldCheck size={16} className={verifStatus === "approved" ? "text-success" : "text-text-muted"} />) })}</h3>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">{uiText("Ui.text_b35d9de7e46840")}</p>
                {verifLoading ? (
                  <Loader2 size={16} className="animate-spin text-text-muted" />
                ) : verifError ? (
                  <div role="alert" className="text-sm text-crimson-light"><p>{verifError}</p><button onClick={() => setVerifReload(value => value + 1)} className="mt-2 min-h-11 rounded-lg border border-border px-4 py-2 text-text-secondary">{verificationText("retry")}</button></div>
                ) : verifStatus === "approved" ? (
                  <div className="flex items-center gap-2 text-success text-sm font-medium">{uiText.rich("Ui.text_6280e60d3e6b8b", { part1: () => (<CheckCircle size={16} />) })}</div>
                ) : verifStatus === "pending" ? (
                  <div className="flex items-center gap-2 text-gold text-sm">{uiText.rich("Ui.text_f04af96360a699", { part1: () => (<Clock size={16} />) })}</div>
                ) : (
                  <div>{verifStatus === "rejected" && <p className="mb-3 text-sm leading-6 text-text-secondary">{verificationText("rejectionHelp")}</p>}
                  {verifReason && <p className="mb-3 whitespace-pre-wrap break-words text-sm text-text-secondary [overflow-wrap:anywhere]">{verifReason}</p>}
                  <button
                    disabled={verifSubmitting}
                    onClick={async () => {
                      if (verifLock.current) return;
                      verifLock.current = true; setVerifSubmitting(true); setVerifError("");
                      try {
                        const response = await fetch("/api/verification-requests", { method: "POST" });
                        const result = await response.json();
                        if (!response.ok) {
                          if (["approved", "pending"].includes(result.status)) { setVerifStatus(result.status); return; }
                          throw new Error(result.error || verificationText("requestFailed"));
                        }
                        setVerifStatus("pending"); setVerifReason("");
                      } catch (error) { setVerifError(uiErrorMessage(error, verificationText("requestFailed"))); }
                      finally { verifLock.current = false; setVerifSubmitting(false); }
                    }}
                    className="min-h-11 px-4 py-2 text-sm font-semibold border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors flex items-center gap-1.5 disabled:opacity-40"
                  >{verifSubmitting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}{verificationText(verifStatus === "rejected" ? "reapply" : "submit")}</button></div>
                )}
              </div>
              )}
              dangerZone={(
<div className="p-5 rounded-xl border border-red-500/30 bg-red-500/5">
                <h3 className="font-semibold text-red-400 mb-1 text-sm flex items-center gap-2">{uiText.rich("Ui.text_206d32a820ac8e", { part1: () => (<AlertCircle size={15} />) })}</h3>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">{uiText("Ui.text_2d70493dc36394")}</p>
                <button
                  onClick={async () => {
                    const confirmed = window.confirm(
                      uiText("Ui.text_da4afae146f61c")
                    );
                    if (!confirmed) return;
                    const res = await fetch("/api/account", { method: "DELETE" });
                    if (res.ok) {
                      window.location.href = "/";
                    } else {
                      alert(uiText("Ui.text_4049adacc8fd2f"));
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
                >{uiText("Ui.text_73fc53cbf7c175")}</button>
              </div>
              )}
            />
          </div>}
        </div>
      </div>


    </div>
  );
}
