"use client";

import GenieWritingAssistant from "@/components/GenieWritingAssistant";
import { locationRoomLabel } from "@/lib/location-rooms";

import { placeInputValue } from "@/lib/places/core";
import { listingPlaceEditFields } from "@/lib/listing-place-edit";

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
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  List, Calendar, MessageSquare,
  BarChart2, Plus, Eye,
  Briefcase, CheckCircle, ChevronRight, ExternalLink,
  User, Send,
  Pencil, Save, Loader2, Upload, Heart, MapPin, Car, Package, Trash2,
  Users, UserPlus, Check, X, Globe, Lock, Clock, ShieldCheck,
  Building2, AlertCircle, FileText, ArrowLeft, Search,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import { applyReadReceiptTimestamps, incomingUnreadMessageIds } from "@/lib/message-read-state";
import { mergeMessagesById } from "@/lib/conversation-logic";
import { notifyMessagesRead, subscribeToMessageReads } from "@/lib/message-read-sync";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES } from "@/lib/compressImage";
import ListingImageManager from "@/components/ListingImageManager";
import { MAX_LOCATION_IMAGES, MAX_LISTING_IMAGES } from "@/lib/listing-image-gallery";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";
import { DASHBOARD_MESSAGES_FALLBACK_REFRESH_MS } from "@/lib/message-refresh-policy";
import { uiErrorMessage } from "@/lib/ui-error-message";

type RealMessage = {
  id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type RealConversation = {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_type: string | null;
  kind?: "direct" | "group" | "support";
  group_name?: string | null;
  sender_id: string;
  receiver_id: string | null;
  created_at: string;
  updated_at: string;
  messages: RealMessage[];
  unread_count: number;
  otherName?: string;
  otherAvatar?: string | null;
};

type Booking = {
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

const VALID_TABS = ["overview", "listings", "jobs", "favorites", "messages", "bookings", "friends", "firma", "settings", "analytics"];


export default function DashboardPage() {
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
  const dashboardMessageText = useTranslations("messagesNavigation");
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? "";
  const editListingParam = searchParams.get("editListing");
  const [activeTab, setActiveTab] = useState(VALID_TABS.includes(tabParam) ? tabParam : "overview");

  // Real listings from Supabase
  const [myListings, setMyListings] = useState<{ id: string; type: string; category?: string; title: string; city: string; price: number; published: boolean; moderation_status?: string; moderation_reason?: string | null; freshness?: ListingFreshnessPreview | null; responsible_person?: ResponsiblePerson & { userId: string }; created_at: string; image_url: string | null; extra_images?: string[] | null; blocked_dates?: string[] | null; description: string; metadata?: Record<string, unknown> | null }[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");

  // Profile sidebar data
  const [profileRole, setProfileRole] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [profileMissingFields, setProfileMissingFields] = useState<string[]>([]);
  const [profileCompletionChecks, setProfileCompletionChecks] = useState<{ label: string; ok: boolean }[]>([]);
  const profileUpdateRevision = useRef(0);

  // Analytics
  const [viewStats, setViewStats] = useState<{ views7: number; views14: number; trend: number; daily: number[] } | null>(null);
  const [photoStats, setPhotoStats] = useState<{ total: number; avg: number; best: string | null } | null>(null);
  const { user } = useUser();

  useEffect(() => {
    if (tabParam === "profil") {
      router.replace("/profile");
      return;
    }
    setActiveTab(VALID_TABS.includes(tabParam) ? tabParam : "overview");
  }, [router, tabParam]);

  const navigateDashboardTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/dashboard?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };

  useEffect(() => {
    return subscribeToProfileUpdated((detail) => {
      if (!user?.id || detail.userId !== user.id) return;
      profileUpdateRevision.current += 1;
      if (typeof detail.displayName === "string") setProfileDisplayName(detail.displayName);
      if (detail.avatarUrl !== undefined) setProfileAvatarUrl(detail.avatarUrl ?? "");
    });
  }, [user?.id]);

  useEffect(() => {
    // Profile + Completeness
    const initialProfileUpdateRevision = profileUpdateRevision.current;
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(uiText("Ui.text_2669fecc698980", { value1: String(r.status) }))))
      .then(({ profile, exists }) => {
        if (initialProfileUpdateRevision !== profileUpdateRevision.current) return;
        if (!exists) {
          setProfileDisplayName(user?.fullName ?? "");
          setProfileCompleteness(0);

          return;
        }
        if (profile?.display_name) setProfileDisplayName(profile.display_name);
        if (profile?.avatar_url) setProfileAvatarUrl(profile.avatar_url);
        if (profile?.role) setProfileRole(profile.role);
        else if (profile?.positions?.[0]) setProfileRole(profile.positions[0]);

        const fieldLabels: Record<string, string> = {
          name: uiText("Ui.text_3ab2eacdba9077"), avatar: uiText("profile.sectionAvatar"), city: uiText("setup.place"), bio: uiText("Ui.text_496d212f59c4b2"),
          type: uiText("creators.filterProfileType"), photos: uiText("Ui.text_bbbd463cd1d02f"), video: uiText("Ui.text_affe2a4a4bb3f8"), languages: uiText("profile.sectionLanguages"),
          height: uiText("Ui.text_c9485b2c2af82d"), hair: uiText("creators.filterHairColor"), age: uiText("creators.filterAge"), role: uiText("Ui.text_9289e267f44a90"), credits: uiText("profile.sectionFilmography"),
        };
        const profileImages = Array.isArray(profile?.profile_images)
          ? profile.profile_images.map((image: string | { url?: string | null } | null) => typeof image === "string" ? image : image?.url ?? "")
          : [];
        const completion = calculateProfileCompletion({
          name: profile?.display_name,
          avatarUrl: profile?.avatar_url,
          location: profile?.location,
          bio: profile?.bio,
          profileType: profile?.profile_type,
          images: profileImages,
          videoLinks: [...(Array.isArray(profile?.video_links) ? profile.video_links : []), profile?.reel_url, profile?.showreel_url],
          languages: profile?.languages,
          heightCm: profile?.physical?.height_cm,
          hairColor: profile?.physical?.hair_color,
          playingAgeMin: profile?.physical?.playing_age_min,
          positions: profile?.positions,
          filmography: profile?.filmography,
        });
        setProfileCompleteness(completion.score);
        setProfileMissingFields(completion.missing.map((key) => fieldLabels[key] ?? key));
        setProfileCompletionChecks(completion.checks.map(({ key, complete }) => ({ label: fieldLabels[key] ?? key, ok: complete })));
      })
      .catch(() => {});

    // Profilaufrufe
    fetch("/api/profile-views")
      .then((r) => r.json())
      .then((data) => setViewStats(data))
      .catch(() => {});

  }, [user?.fullName]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/profile-image-likes?profile_id=${user.id}`)
      .then((r) => r.json())
      .then(({ ratings }: { ratings: Record<string, { avg: number; count: number }> }) => {
        const entries = Object.entries(ratings ?? {});
        if (!entries.length) return;
        const total = entries.reduce((s, [, v]) => s + v.count, 0);
        const weightedSum = entries.reduce((s, [, v]) => s + v.avg * v.count, 0);
        const avg = Math.round((weightedSum / total) * 10) / 10;
        const best = [...entries].sort((a, b) => b[1].avg - a[1].avg)[0]?.[0] ?? null;
        setPhotoStats({ total, avg, best });
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "listings" && activeTab !== "overview" && activeTab !== "analytics") return;
    setListingsLoading(true);
    fetch("/api/listings?mine=true")
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (error) { setListingsError(error); return; }
        setMyListings(data ?? []);
      })
      .catch(() => setListingsError(uiText("Ui.text_69f5153e4a2bea")))
      .finally(() => setListingsLoading(false));
  }, [activeTab]);

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
  const [editForm, setEditForm] = useState({ title: "", description: "", price: "", city: "", selected_place_city_id: "", image_url: "" });
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
    value: { marketplace:editMarketplace, form: editForm, responsible: editResponsible, gallery: editGallery, blockedDates: editBlockedDates, locationMeta: editLocationMeta, animalMeta: editAnimalMeta, newBlockedDate },
    busy: editUploading || editGalleryState.uploading || editGalleryState.failed > 0 || editSaving,
    restore: draft => { setEditForm(draft.form);if(draft.marketplace)setEditMarketplace(draft.marketplace); setEditResponsible(draft.responsible); setEditGallery(draft.gallery); setEditBlockedDates(draft.blockedDates); setEditLocationMeta(draft.locationMeta);
      if (draft.animalMeta) setEditAnimalMeta(draft.animalMeta); setNewBlockedDate(draft.newBlockedDate); },
  });

  const startEdit = useCallback((l: typeof myListings[number]) => {
    setEditingId(l.id);
    setEditResponsible(responsiblePersonDraft(l.responsible_person));
    setEditResponsibleErrors({});
    setEditForm({ title: l.title, description: l.description ?? "", price: String(l.price), city: placeInputValue(l, l.city), selected_place_city_id: (l as {place_city_id?: string}).place_city_id || "", image_url: l.image_url ?? "" });
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
  }, []);

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
          description: editForm.description,
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
            price_negotiable: editLocationMeta.price_negotiable,
            rooms: editLocationMeta.rooms,
            amenities: editLocationMeta.amenities,
          } } : editingListing?.type === "animal" ? {metadata:editAnimalMeta} : usesGallery ? (validateMarketplaceOffer(editMarketplace.category,editingListing?.type??"",serializeMarketplaceDraft(editMarketplace),editingListing?.published) ? {} : {category:editMarketplace.category,metadata:marketplaceMetadataPatch(editMarketplace)}) : {}),
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
              description: editForm.description,
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
            price_negotiable: editLocationMeta.price_negotiable,
                rooms: editLocationMeta.rooms,
                amenities: editLocationMeta.amenities,
              } } : l.type === "animal" ? { metadata: { ...l.metadata, ...editAnimalMeta } } : ["prop", "vehicle"].includes(l.type) ? {metadata:{...l.metadata,...marketplaceMetadataPatch(editMarketplace)}} : {}),
              ...(["prop","vehicle"].includes(l.type) && savedListing ? {category:savedListing.category,price:savedListing.price,metadata:savedListing.metadata} : {}),
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
  const [respondingBooking, setRespondingBooking] = useState<string | null>(null);

  const [applications, setApplications] = useState<{ id: string; job_id: string; job_title: string; status: string; day_rate: string | null; created_at: string }[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [incomingApplications, setIncomingApplications] = useState<{ id: string; job_id: string; job_title: string; applicant_id: string; applicant_name: string; applicant_avatar: string | null; message: string; portfolio_url: string | null; day_rate: string | null; status: string; created_at: string }[]>([]);
  const [incomingAppsLoading, setIncomingAppsLoading] = useState(false);
  const [respondingApp, setRespondingApp] = useState<string | null>(null);

  // Company
  type MyCompany = {
    id: string; slug: string; name: string; logo_url: string | null;
    published: boolean; categories: string[]; city: string | null;
    tagline: string | null; description: string | null;
    social_links: Record<string, string> | null;
  };
  const [myCompany, setMyCompany] = useState<MyCompany | null | "loading">("loading");

  useEffect(() => {
    fetch("/api/companies?mine=true")
      .then(r => r.json())
      .then(({ data }) => setMyCompany(data?.[0] ?? null))
      .catch(() => setMyCompany(null));
  }, []);

  // My posted jobs
  const [myJobs, setMyJobs] = useState<{ id: string; title: string; published: boolean; moderation_status?: string; moderation_reason?: string | null; role: string | null; location: string | null; employment_type: string | null; created_at: string }[]>([]);
  const [myJobsLoading, setMyJobsLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "jobs" && activeTab !== "overview") return;
    setMyJobsLoading(true);
    fetch("/api/listings?mine=true")
      .then(r => r.json())
      .then(({ data }) => setMyJobs((data ?? []).filter((l: { type: string }) => l.type === "job")))
      .catch(() => {})
      .finally(() => setMyJobsLoading(false));
  }, [activeTab]);

  // Favorites
  type Favorite = {
    id: string; listing_id: string; listing_type: string;
    listing_title: string | null; listing_city: string | null;
    priceLabel?:string; listing_price: number | null; listing_image: string | null; created_at: string;
  };
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [removingFav, setRemovingFav] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "favorites" && activeTab !== "overview") return;
    if (favorites.length > 0) return;
    setFavoritesLoading(true);
    fetch("/api/favorites")
      .then(r => r.json())
      .then(({ favorites: data }) => setFavorites(data ?? []))
      .catch(() => {})
      .finally(() => setFavoritesLoading(false));
  }, [activeTab, favorites.length]);

  const removeFavorite = async (fav: Favorite) => {
    setRemovingFav(fav.listing_id);
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: fav.listing_id, listing_type: fav.listing_type }),
      });
      setFavorites(prev => prev.filter(f => f.listing_id !== fav.listing_id));
    } finally {
      setRemovingFav(null);
    }
  };

  const favTypeConfig: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; href: (id: string) => string; color: string }> = {
    location: { label: uiText("profile.labelLocation"),    icon: MapPin,    href: (id) => `/locations/${id}`, color: "text-sky-400" },
    vehicle:  { label: uiText("AdminAccounts.contentKinds.vehicle"),   icon: Car,       href: (id) => `/vehicles/${id}`,  color: "text-orange-400" },
    prop:     { label: uiText("Ui.text_27c673e10176f0"),  icon: Package,   href: (id) => `/props/${id}`,     color: "text-violet-400" },
    job:      { label: uiText("AdminAccounts.contentKinds.job"),        icon: Briefcase, href: (id) => `/jobs/${id}`,      color: "text-emerald-400" },
    creator:  { label: uiText("creators.defaultRole"), icon: User, href: (id) => `/profile/${id}`, color: "text-gold" },
  };

  // Friends
  type FriendEntry = { friendship_id: string; user_id: string; display_name: string; avatar_url: string | null; role: string };
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendsIncoming, setFriendsIncoming] = useState<FriendEntry[]>([]);
  const [friendsOutgoing, setFriendsOutgoing] = useState<FriendEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsTab, setFriendsTab] = useState<"friends" | "incoming" | "outgoing">("incoming");
  const [friendSearch, setFriendSearch] = useState("");

  const doLoadFriends = (showSpinner: boolean) => {
    if (showSpinner) setFriendsLoading(true);
    fetch("/api/friendships")
      .then(r => r.json())
      .then(({ friends: f, incoming: i, outgoing: o }) => {
        setFriends(f ?? []);
        setFriendsIncoming(i ?? []);
        setFriendsOutgoing(o ?? []);
      })
      .catch(() => {})
      .finally(() => setFriendsLoading(false));
  };

  // Load on mount for sidebar badge
  useEffect(() => { doLoadFriends(false); }, []);

  // Reload with spinner when the friends tab is opened
  useEffect(() => {
    if (activeTab !== "friends") return;
    doLoadFriends(true);
  }, [activeTab]);

  const acceptFriend = async (id: string) => {
    await fetch(`/api/friendships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    doLoadFriends(true);
  };

  const rejectFriend = async (id: string) => {
    await fetch(`/api/friendships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    doLoadFriends(true);
  };

  const removeFriendEntry = async (id: string) => {
    await fetch(`/api/friendships/${id}`, { method: "DELETE" });
    doLoadFriends(true);
  };

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState<{ profile_visibility: string; message_permission: string; email_new_message: boolean; phone_visibility: string; contact_email_visibility: string }>({
    profile_visibility: "public",
    message_permission: "everyone",
    email_new_message: true,
    phone_visibility: "hidden",
    contact_email_visibility: "hidden",
  });
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyError, setPrivacyError] = useState("");

  // Verification request state
  const [verifStatus, setVerifStatus] = useState<"none" | "pending" | "approved">("none");
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifSubmitting, setVerifSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab !== "settings") return;
    let cancelled = false;
    setPrivacyLoading(true);
    setPrivacyError("");
    fetch("/api/user-settings")
      .then(async r => {
        const result = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(r.status) }));
        return result;
      })
      .then(({ settings }) => { if (!cancelled && settings) setPrivacySettings(settings); })
      .catch((err) => {
        if (!cancelled) setPrivacyError(uiText("Ui.text_a71e57dc22fe15", { value1: String(uiErrorMessage(err, uiText("Ui.text_0504c98fd2caa9"))) }));
      })
      .finally(() => { if (!cancelled) setPrivacyLoading(false); });
    // Load verification status
    setVerifLoading(true);
    fetch("/api/verification-requests")
      .then(r => r.json())
      .then(({ data }) => {
        const latest = data?.[0];
        if (!latest) setVerifStatus("none");
        else if (latest.status === "approved") setVerifStatus("approved");
        else setVerifStatus("pending");
      })
      .catch(() => {})
      .finally(() => setVerifLoading(false));
    return () => { cancelled = true; };
  }, [activeTab]);

  const updatePrivacy = async (key: string, value: string | boolean) => {
    const previousSettings = privacySettings;
    setPrivacyError("");
    setPrivacySettings(prev => ({ ...prev, [key]: value }));
    setPrivacyLoading(true);
    try {
      const response = await fetch("/api/user-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error(result.error ?? uiText("Ui.text_2669fecc698980", { value1: String(response.status) }));
    } catch (err) {
      setPrivacySettings(previousSettings);
      setPrivacyError(uiText("Ui.text_7d80e16f8158c3", { value1: String(uiErrorMessage(err, uiText("Ui.text_8760d6e61c65fe"))) }));
    } finally {
      setPrivacyLoading(false);
    }
  };

  const [conversations, setConversations] = useState<RealConversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [conversationsReady, setConversationsReady] = useState(false);
  const [conversationsLoadError, setConversationsLoadError] = useState(false);
  const conversationsHasLoadedRef = useRef(false);
  const [unreadMessagesTotal, setUnreadMessagesTotal] = useState(0);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<RealMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [messageLoadError, setMessageLoadError] = useState("");
  const [messageReloadVersion, setMessageReloadVersion] = useState(0);
  const messageViewRef = useRef<{ userId: string; conversationId: string } | null>(null);
  const messageSendPendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const view = user?.id && selectedConversation
      ? { userId: user.id, conversationId: selectedConversation }
      : null;
    messageViewRef.current = view;
    return () => { if (messageViewRef.current === view) messageViewRef.current = null; };
  }, [selectedConversation, user?.id]);

  useEffect(() => {
    if (activeTab !== "bookings" && activeTab !== "overview") return;
    setBookingsLoading(true);
    fetch("/api/bookings")
      .then(r => r.json())
      .then(({ bookings: data }) => setBookings(data ?? []))
      .catch(() => {})
      .finally(() => setBookingsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "bookings" && activeTab !== "overview") return;
    setIncomingLoading(true);
    fetch("/api/bookings?incoming=true")
      .then(r => r.json())
      .then(({ bookings: data }) => setIncomingBookings(data ?? []))
      .catch(() => {})
      .finally(() => setIncomingLoading(false));
  }, [activeTab]);

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
    if (activeTab !== "bookings" && activeTab !== "jobs") return;
    setApplicationsLoading(true);
    fetch("/api/applications")
      .then(r => r.json())
      .then(({ applications: data }) => setApplications(data ?? []))
      .catch(() => {})
      .finally(() => setApplicationsLoading(false));
  }, [activeTab]);

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

  const loadDashboardConversations = useCallback(async () => {
    if (!conversationsHasLoadedRef.current) {
      setConvsLoading(true);
      setConversationsReady(false);
    }
    setConversationsLoadError(false);
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) throw new Error(uiText("Ui.text_8358f771d24abf"));
      const { data, unreadCount } = await response.json();
      setConversations(data ?? []);
      setUnreadMessagesTotal(Number(unreadCount) || 0);
      conversationsHasLoadedRef.current = true;
      setConversationsReady(true);
    } catch {
      setConversationsLoadError(true);
      if (!conversationsHasLoadedRef.current) {
        setConversations([]);
        setUnreadMessagesTotal(0);
      }
    } finally {
      setConvsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "messages" && activeTab !== "overview" && activeTab !== "analytics" && activeTab !== "bookings") return;
    void loadDashboardConversations();
  }, [activeTab, loadDashboardConversations]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeToMessageReads(user.id, () => { void loadDashboardConversations(); });
  }, [user?.id, loadDashboardConversations]);

  useEffect(() => {
    // The overview is already refreshed on entry and by read events. Only the
    // open messages tab needs a periodic safety refresh.
    if (!user?.id || activeTab !== "messages") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadDashboardConversations();
    }, DASHBOARD_MESSAGES_FALLBACK_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [user?.id, activeTab, loadDashboardConversations]);

  useEffect(() => {
    const view = messageViewRef.current;
    let cancelled = false;
    const controller = new AbortController();
    const isCurrent = () => !cancelled && messageViewRef.current === view;
    setActiveMessages([]);
    setMessageLoadError("");
    setReplyError("");
    if (!view || !selectedConversation || !user?.id) {
      setMessagesLoading(false);
      return;
    }
    const { userId: owner, conversationId } = view;
    setMessagesLoading(true);
    async function load() {
      try {
        const response = await fetch(`/api/conversations/${conversationId}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(uiText("Ui.text_e2085ad6e6ac21"));
        const { messages } = await response.json();
        if (!isCurrent()) return;
        if (!Array.isArray(messages)) throw new Error();
        const loadedMessages = messages as RealMessage[];
        setActiveMessages(current => mergeMessagesById(loadedMessages, current));
        const messageIds = incomingUnreadMessageIds(loadedMessages, owner);
        if (messageIds.length > 0) {
          try {
            const readResponse = await fetch(`/api/conversations/${conversationId}/read`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              signal: controller.signal,
              body: JSON.stringify({ message_ids: messageIds }),
            });
            if (readResponse.ok) {
              const readState = await readResponse.json();
              if (!isCurrent()) return;
              const readMessages = Array.isArray(readState.readMessages) ? readState.readMessages : [];
              setActiveMessages((current) => applyReadReceiptTimestamps(current, readMessages));
              setConversations((current) => current.map((conversation) => conversation.id !== conversationId ? conversation : {
                ...conversation,
                unread_count: readState.byConversation?.[conversationId] ?? conversation.unread_count,
                messages: applyReadReceiptTimestamps(conversation.messages, readMessages),
              }));
              setUnreadMessagesTotal(Number(readState.count) || 0);
              setConversationsReady(true);
              notifyMessagesRead(owner);
            }
          } catch { /* read receipts are best effort; keep the loaded messages visible */ }
        }
        setTimeout(() => { if (isCurrent()) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
      } catch {
        if (isCurrent()) setMessageLoadError(dashboardMessageText("messageLoadError"));
      } finally {
        if (isCurrent()) setMessagesLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [selectedConversation, user?.id, messageReloadVersion, dashboardMessageText]);

  const sendReply = async () => {
    const view = messageViewRef.current;
    if (!replyText.trim() || !selectedConversation || !view || view.conversationId !== selectedConversation || view.userId !== user?.id || sending || messageSendPendingRef.current) return;
    const isCurrent = () => messageViewRef.current === view;
    const draftAtSend = replyText;
    messageSendPendingRef.current = true;
    setSending(true);
    setReplyError("");
    try {
      const response = await fetch(`/api/conversations/${view.conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draftAtSend.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.error || !payload.message?.id) {
        if (isCurrent()) setReplyError(typeof payload.error === "string" && payload.error ? payload.error : dashboardMessageText("sendError"));
        return;
      }
      if (!isCurrent()) { void loadDashboardConversations(); return; }
      setReplyText(current => current === draftAtSend ? "" : current);
      setActiveMessages(current => mergeMessagesById(current, [payload.message as RealMessage]));
      setTimeout(() => { if (isCurrent()) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
      void loadDashboardConversations();
    } catch {
      if (isCurrent()) setReplyError(dashboardMessageText("sendError"));
    } finally {
      messageSendPendingRef.current = false;
      setSending(false);
    }
  };

  const formatMsgTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return uiText("Ui.text_d5f879f6819f21");
    if (diffMin < 60) return uiText("Ui.text_675c446178ebb6", { value1: String(diffMin) });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return uiText("Ui.text_d4ade1ff4f04c0", { value1: String(diffH) });
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "Gestern";
    return d.toLocaleDateString(uiLocale, { day: "numeric", month: "short" });
  };

  const unreadCount = conversationsReady ? unreadMessagesTotal : 0;

  const tabTitle = () => {
    const map: Record<string, string> = {
      overview: "Übersicht",
      profil: "Mein Profil",
      firma: "Meine Firma",
      listings: "Meine Angebote",
      jobs: "Meine Angebote",
      bookings: "Buchungen",
      messages: "Nachrichten",
      analytics: "Analysen",
      favorites: "Merkliste",
      friends: "Freunde",
      settings: "Einstellungen",
    };
    return map[activeTab] ?? activeTab;
  };

  return (
    <div className="pt-16 min-h-screen flex w-full min-w-0">
      {/* Hauptinhalt */}
      <div className="min-w-0 flex-1">
        {/* Top-Leiste */}
        <div className="sticky top-16 z-30 bg-bg-primary/80 backdrop-blur-nav border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3 lg:top-28">
          <h1 className="font-display text-sm sm:text-base font-bold text-text-primary truncate">{tabTitle()}</h1>
          <div className="flex items-center gap-2 shrink-0">{uiText.rich("Ui.text_d4ad4f9e5b7d76", { part2: () => (<Plus size={13} />), part3: chunks => (<span className="hidden sm:inline">{chunks}</span>), part1: chunks => (<Link href="/inserat" className="px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors whitespace-nowrap">{chunks}</Link>) })}</div>
        </div>

        {(activeTab === "listings" || activeTab === "jobs") && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
            <button onClick={() => navigateDashboardTab("listings")} className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${activeTab === "listings" ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-text-secondary hover:text-text-primary"}`}>{uiText("profile.tabListings")}</button>
            <button onClick={() => navigateDashboardTab("jobs")} className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${activeTab === "jobs" ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-text-secondary hover:text-text-primary"}`}>{uiText("Ui.text_4012fde18eb1f5")}</button>
            <Link href="/company-dashboard" className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary transition-colors hover:border-gold/40 hover:text-gold">{uiText.rich("Ui.text_70ede6b97ecfb0", { part1: () => (<Building2 size={15} />) })}</Link>
          </div>
        )}


        <div className="min-w-0 w-full p-4 sm:p-6 pb-24 lg:pb-6">
          {/* ── ÜBERSICHT ── */}
          {activeTab === "overview" && (
            <div className="min-w-0 w-full space-y-8 max-w-4xl">

              {/* ── Begrüßung ── */}
              <div>
                <h2 className="font-display text-2xl font-bold text-text-primary">{uiText.rich("Ui.text_9822f89b9cd21d", { value1: () => (profileDisplayName || user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "") })}</h2>
                <p className="text-text-muted text-sm mt-1">
                  <DashboardDate />
                </p>
              </div>

              {(unreadCount > 0 || incomingBookings.some((booking) => booking.status === "pending") || profileMissingFields.length > 0) && (
                <section aria-label={uiText("Ui.text_a4ba73300ac027")} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {unreadCount > 0 && (
                    <Link href="/messages" className="flex min-h-20 items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4 transition-colors hover:border-gold/60">{uiText.rich("Ui.text_0f50761594768c", { part2: () => (<MessageSquare size={18} />), part1: chunks => (<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">{chunks}</span>), value5: () => (unreadCount), count6: unreadCount, part4: chunks => (<span className="block text-sm font-semibold text-text-primary">{chunks}</span>), part7: chunks => (<span className="block text-xs text-text-muted">{chunks}</span>), part3: chunks => (<span className="min-w-0">{chunks}</span>), part8: () => (<ChevronRight size={15} className="ml-auto shrink-0 text-gold" />) })}</Link>
                  )}
                  {incomingBookings.some((booking) => booking.status === "pending") && (
                    <button onClick={() => navigateDashboardTab("bookings")} className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-bg-secondary p-4 text-left transition-colors hover:border-gold/40">{uiText.rich("Ui.text_5f536500158e21", { part2: () => (<Calendar size={18} />), part1: chunks => (<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">{chunks}</span>), part4: chunks => (<span className="block text-sm font-semibold text-text-primary">{chunks}</span>), part5: chunks => (<span className="block text-xs text-text-muted">{chunks}</span>), part3: chunks => (<span className="min-w-0">{chunks}</span>), part6: () => (<ChevronRight size={15} className="ml-auto shrink-0 text-text-muted" />) })}</button>
                  )}
                  {profileMissingFields.length > 0 && (
                    <Link href="/profile" className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-bg-secondary p-4 transition-colors hover:border-gold/40">{uiText.rich("Ui.text_4986c0991fc326", { part2: () => (<User size={18} />), part1: chunks => (<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">{chunks}</span>), part4: chunks => (<span className="block text-sm font-semibold text-text-primary">{chunks}</span>), value6: () => (profileMissingFields[0]), part5: chunks => (<span className="block truncate text-xs text-text-muted">{chunks}</span>), part3: chunks => (<span className="min-w-0">{chunks}</span>), part7: () => (<ChevronRight size={15} className="ml-auto shrink-0 text-text-muted" />) })}</Link>
                  )}
                </section>
              )}

              <SetupStatusNotice />

              {/* ── Stats-Kacheln ── */}
              {(viewStats || photoStats) && (
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {viewStats && (
                  <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">{uiText.rich("Ui.text_a854758025488a", { part1: () => (<Eye size={12} />) })}</p>
                    <p className="text-2xl font-bold font-mono text-text-primary">{viewStats.views7}</p>
                    <div className="flex items-center gap-1 mt-1">{uiText.rich("Ui.text_e0a31345c2f534", { value2: () => (viewStats.trend > 0 ? uiText("Ui.text_1d732d182540bf", { value1: String(viewStats.trend) }) : viewStats.trend < 0 ? uiText("Ui.text_6a53a571fa6641", { value1: String(viewStats.trend) }) : "—"), part1: chunks => (<span className={`text-xs font-medium ${viewStats.trend > 0 ? "text-success" : viewStats.trend < 0 ? "text-red-400" : "text-text-muted"}`}>{chunks}</span>), part3: chunks => (<span className="text-xs text-text-muted">{chunks}</span>) })}</div>
                    {/* Sparkline */}
                    <div className="flex items-end gap-0.5 mt-3 h-8">
                      {viewStats.daily.map((v, i) => {
                        const max = Math.max(...viewStats.daily, 1);
                        return (
                          <div key={i} className="flex-1 bg-gold/30 rounded-sm transition-all hover:bg-gold/60"
                            style={{ height: `${Math.max((v / max) * 100, 8)}%` }} />
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">{uiText("Ui.text_df1140f6b738ec")}</p>
                  </div>
                  )}
                  <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">{uiText.rich("Ui.text_cffd736d7cb60e", { part1: () => (<List size={12} />) })}</p>
                    <p className="text-2xl font-bold font-mono text-text-primary">
                      {myListings.filter((l) => l.published).length}
                    </p>
                    <p className="text-xs text-text-muted mt-1">{uiText.rich("Ui.text_0a1283e7df1e88", { value1: () => (myListings.length) })}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">{uiText.rich("Ui.text_81d121dfcf2181", { part1: () => (<MessageSquare size={12} />) })}</p>
                    <p className="text-2xl font-bold font-mono text-text-primary">{conversationsReady ? unreadCount : conversationsLoadError ? "—" : "…"}</p>
                    <p className="text-xs text-text-muted mt-1">{conversationsReady ? uiText("Ui.text_58d5c21a442c7d") : conversationsLoadError ? uiText("common.unavailable") : uiText("creators.loading")}</p>
                  </div>
                  {photoStats && (
                    <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                      <p className="text-xs text-text-muted mb-1 flex items-center gap-1.5">{uiText.rich("Ui.text_f658ec20200b90", { part1: chunks => (<span className="text-gold text-xs leading-none">{chunks}</span>) })}</p>
                      <p className="text-2xl font-bold font-mono text-text-primary">{photoStats.avg.toFixed(1)}</p>
                      <p className="text-xs text-text-muted mt-1">{uiText.rich("Ui.text_b6b7c6071b1bf8", { value1: () => (photoStats.total), count2: photoStats.total })}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Primäre CTA ── */}
              {!listingsLoading && myListings.length === 0 ? (
                <Link
                  href="/inserat"
                  className="group flex items-center gap-5 p-6 rounded-2xl border-2 border-gold/40 bg-gold-subtle hover:border-gold hover:bg-gold/10 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold text-bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Plus size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-text-primary">{uiText("Ui.text_094c838d419299")}</p>
                    <p className="text-sm text-text-muted mt-0.5">{uiText("Ui.text_a64e52f53b5e58")}</p>
                  </div>
                  <ChevronRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : !user?.imageUrl ? (
                <Link
                  href="/profile"
                  className="group flex items-center gap-5 p-6 rounded-2xl border-2 border-gold/40 bg-gold-subtle hover:border-gold hover:bg-gold/10 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold text-bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <User size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-text-primary">{uiText("Ui.text_78693b435178f9")}</p>
                    <p className="text-sm text-text-muted mt-0.5">{uiText("Ui.text_2a6d329003520a")}</p>
                  </div>
                  <ChevronRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : conversationsReady && unreadCount > 0 ? (
                <button
                  onClick={() => navigateDashboardTab("messages")}
                  className="group w-full flex items-center gap-5 p-6 rounded-2xl border-2 border-gold/40 bg-gold-subtle hover:border-gold hover:bg-gold/10 transition-all text-left"
                >
                  <div className="w-14 h-14 rounded-xl bg-gold text-bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform relative">
                    <MessageSquare size={26} />
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-crimson text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-text-primary">{uiText.rich("Ui.text_a7f21b0f74229f", { value1: () => (unreadCount), count2: unreadCount })}</p>
                    <p className="text-sm text-text-muted mt-0.5">{uiText("Ui.text_0e4ed6d7c34f4d")}</p>
                  </div>
                  <ChevronRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : null}

              {/* ── Profilstärke ── */}
              {profileCompleteness < 100 && (
                <div className="p-5 rounded-2xl border border-border bg-bg-secondary">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_83e186228760e1")}</p>
                      <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_ee9b8b1c714a68")}</p>
                    </div>
                    <span className={`text-lg font-bold font-mono ${profileCompleteness >= 75 ? "text-success" : profileCompleteness >= 50 ? "text-gold" : "text-text-secondary"}`}>
                      {profileCompleteness}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${profileCompleteness >= 75 ? "bg-success" : profileCompleteness >= 50 ? "bg-gold" : "bg-text-muted"}`}
                      style={{ width: `${profileCompleteness}%` }}
                    />
                  </div>
                  {profileMissingFields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {profileMissingFields.slice(0, 4).map((f) => (
                        <span key={f} className="px-2 py-0.5 bg-bg-elevated border border-border text-xs text-text-muted rounded-full">
                          + {f}
                        </span>
                      ))}
                      {profileMissingFields.length > 4 && (
                        <span className="px-2 py-0.5 text-xs text-text-muted">{uiText.rich("Ui.text_4527b0695b24a0", { value1: () => (profileMissingFields.length - 4) })}</span>
                      )}
                    </div>
                  )}
                  <Link href="/profile" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-light transition-colors">{uiText.rich("Ui.text_e845088715995b", { part1: () => (<ChevronRight size={12} />) })}</Link>
                </div>
              )}

              {/* ── Meine Inserate ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-text-primary">{uiText("nav.myOffers")}</h3>
                  <div className="flex items-center gap-2">
                    {myListings.length > 0 && (
                      <button onClick={() => navigateDashboardTab("listings")} className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">{uiText.rich("Ui.text_8e04f826a45436", { part1: () => (<ChevronRight size={12} />) })}</button>
                    )}
                  </div>
                </div>

                {listingsLoading && (
                  <div className="flex items-center gap-3 text-sm text-text-muted py-4">{uiText.rich("Ui.text_e68bc26b2fc6f2", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</div>
                )}

                {!listingsLoading && myListings.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border text-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
                      <List size={20} className="text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary">{uiText("Ui.text_c9636816421535")}</p>
                      <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_1c1fd85686d901")}</p>
                    </div>
                    <Link href="/inserat" className="mt-1 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center gap-1.5">{uiText.rich("Ui.text_7ec80552729795", { part1: () => (<Plus size={12} />) })}</Link>
                  </div>
                )}

                {!listingsLoading && myListings.length > 0 && (
                  <div className="space-y-3">
                    {myListings.slice(0, 4).map((l) => (
                      <Link key={l.id} href={typeHref(l)} className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated transition-all">
                        {/* Bild */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-bg-elevated border border-border">
                          {l.image_url ? (
                            <UnoptimizedImage src={l.image_url} alt={l.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {l.type === "location" ? "📍" : l.type === "vehicle" ? "🚗" : l.type === "job" ? "💼" : l.type === "creator" ? "🎬" : "📦"}
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{l.title}</p>
                            <OfferModerationStatus item={l} />
                          </div>
                          <p className="text-xs text-text-muted">{typeLabel[l.type] ?? l.type} · {l.city}</p>
                          <ListingFreshnessSummary listingId={l.id} state={l.freshness} showLink={false} />
                        </div>
                        {/* Preis */}
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-gold font-display">
                            {listingPriceLabel(l.price,l.metadata,"/Tag",marketLocale,marketText)}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">{uiText("common.perDay")}</p>
                        </div>
                        <ChevronRight size={14} className="text-text-muted group-hover:text-gold transition-colors shrink-0" />
                      </Link>
                    ))}
                    {myListings.length > 4 && (
                      <button onClick={() => navigateDashboardTab("listings")} className="w-full py-3 rounded-xl border border-dashed border-border text-xs text-text-muted hover:border-gold hover:text-gold transition-colors">{uiText.rich("Ui.text_8801408b7ec682", { value1: () => (myListings.length - 4) })}</button>
                    )}
                  </div>
                )}
              </div>

              {/* ── Nachrichten & Anfragen (kombiniert) ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-text-primary">{uiText.rich("Ui.text_f933a8195fccc6", { value1: () => (conversationsReady && unreadCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-gold text-bg-primary font-bold rounded-full">{unreadCount}</span>
                    )) })}</h3>
                  {conversations.length > 0 && (
                    <button onClick={() => navigateDashboardTab("messages")} className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">{uiText.rich("Ui.text_78a12822c8e85a", { part1: () => (<ChevronRight size={12} />) })}</button>
                  )}
                </div>

                {convsLoading && (
                  <div className="flex items-center gap-3 text-sm text-text-muted py-4">{uiText.rich("Ui.text_e68bc26b2fc6f2", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</div>
                )}

                {!convsLoading && conversationsLoadError && (
                  <div role="status" className="p-5 rounded-xl border border-border bg-bg-secondary text-sm text-text-muted">{uiText("Ui.text_bbd327fb803af8")}</div>
                )}

                {!convsLoading && conversationsReady && conversations.length === 0 && (
                  <div className="flex items-center gap-4 p-5 rounded-xl border border-dashed border-border text-text-muted">
                    <MessageSquare size={20} className="shrink-0 opacity-40" />
                    <p className="text-sm">{uiText("Ui.text_54d1d23a08ec91")}</p>
                  </div>
                )}

                {!convsLoading && conversations.length > 0 && (
                  <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden divide-y divide-border">
                    {conversations.slice(0, 5).map((conv) => {
                      const lastMsg = conv.messages[0];
                      const hasUnread = conv.unread_count > 0;
                      return (
                        <button
                          key={conv.id}
                          onClick={() => { navigateDashboardTab("messages"); setSelectedConversation(conv.id); }}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors text-left"
                        >
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center overflow-hidden">
                              {conv.otherAvatar
                                ? <UnoptimizedImage src={conv.otherAvatar} alt="" className="w-full h-full object-cover" />
                                : <User size={15} className="text-gold" />}
                            </div>
                            {hasUnread && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gold rounded-full border-2 border-bg-secondary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${hasUnread ? "text-text-primary" : "text-text-secondary"}`}>
                              {conv.otherName ?? uiText("Ui.text_276ffa1fb4f970")}
                            </p>
                            <p className="text-xs text-text-muted truncate mt-0.5">
                              {conv.listing_title ? uiText("Ui.text_210eac6879f747", { value1: String(conv.listing_title) }) : ""}{lastMsg?.content ?? "…"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {hasUnread && (
                              <span className="inline-block mb-1 px-1.5 py-0.5 text-[10px] bg-gold text-bg-primary font-bold rounded-full">{uiText("common.newBadge")}</span>
                            )}
                            <p className="text-[10px] text-text-muted">{formatMsgTime(conv.updated_at)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Firmenprofil ── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold text-text-primary">{uiText("Ui.text_92b8b0ccb4a7b1")}</h3>
                  <Link href="/company-dashboard" className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">{uiText.rich("Ui.text_5bdc9ba7941520", { part1: () => (<ChevronRight size={12} />) })}</Link>
                </div>
                <Link href="/company-invitations" className="mb-4 inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light">{uiText("Ui.text_355f8d66616bb0")}</Link>
                {myCompany === "loading" && (
                  <div className="flex items-center gap-3 text-sm text-text-muted py-4">{uiText.rich("Ui.text_e68bc26b2fc6f2", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</div>
                )}
                {myCompany === null && (
                  <Link href="/company-setup"
                    className="group flex items-center gap-4 w-full p-4 rounded-xl border border-dashed border-border hover:border-gold/40 hover:bg-bg-elevated transition-all text-left">
                    <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-text-muted group-hover:text-gold transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">{uiText("Ui.text_32ae0a5fd4c809")}</p>
                      <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_826a6da5f6ed29")}</p>
                    </div>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-gold transition-colors ml-auto shrink-0" />
                  </Link>
                )}
                {myCompany && myCompany !== "loading" && (
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 hover:bg-bg-elevated transition-all">
                    <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {myCompany.logo_url
                        ? <UnoptimizedImage src={myCompany.logo_url} alt={myCompany.name} className="w-full h-full object-contain p-1" />
                        : <Building2 size={20} className="text-text-muted opacity-40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-text-primary text-sm truncate">{myCompany.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-semibold ${myCompany.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border"}`}>
                          {myCompany.published ? uiText("Ui.text_8163454f378f08") : uiText("OfferModeration.statuses.draft")}
                        </span>
                      </div>
                      {myCompany.city && <p className="text-xs text-text-muted">{myCompany.city}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">{uiText.rich("Ui.text_da9be6811d4742", { part1: chunks => (<Link href="/company-dashboard" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all">{chunks}</Link>), part3: () => (<ExternalLink size={10} />), part2: chunks => (<a href={`/companies/${myCompany.slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center flex items-center gap-1 justify-center">{chunks}</a>) })}</div>
                  </div>
                )}
              </div>

              {/* ── Schnellzugriff ── */}
              <div>
                <h3 className="font-display text-lg font-bold text-text-primary mb-4">{uiText("Ui.text_5c79c2d6162809")}</h3>
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { icon: User,         label: uiText("nav.myProfile"),  sub: uiText("Ui.text_2fa256a0eff196", { value1: String(profileCompleteness) }), id: "profil" },
                    { icon: Calendar,     label: uiText("nav.bookings"),    sub: bookings.length > 0 ? uiText("Ui.text_888c0247e6c804", { value1: String(bookings.length) }) : uiText("Ui.text_8a572015c49b20"), id: "bookings" },
                    { icon: MessageSquare,label: uiText("nav.messages"),  sub: conversationsLoadError ? uiText("common.unavailable") : !conversationsReady ? uiText("creators.loading") : unreadCount > 0 ? uiText("Ui.text_f7c1688df1fc46", { value1: String(unreadCount) }) : uiText("notifications.markAllRead"), id: "messages" },
                    { icon: BarChart2,    label: uiText("nav.analytics"),     sub: uiText("Ui.text_b77f497caa3075", { value1: String(conversations.length) }), id: "analytics" },
                  ].map(({ icon: Icon, label, sub, id }) => (
                    <button
                      key={id}
                      onClick={() => id === "profil" ? router.push("/profile") : navigateDashboardTab(id)}
                      className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/40 hover:bg-bg-elevated transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                        <Icon size={15} className="text-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{label}</p>
                        <p className="text-xs text-text-muted mt-0.5">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── PROFIL ── */}
          {activeTab === "profil" && (
            <div className="space-y-6 max-w-2xl">
              {/* Header */}
              {(() => {
                const avatarSrc = profileAvatarUrl || user?.imageUrl || "";
                const displayName = profileDisplayName || (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "") || "—";
                return (
                  <div className="flex items-start gap-5 p-6 rounded-2xl border border-border bg-bg-secondary">
                    <div className="shrink-0">
                      {avatarSrc ? (
                        <UnoptimizedImage src={avatarSrc} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gold/30" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gold/20 border-2 border-gold/30 flex items-center justify-center">
                          <span className="text-gold font-bold text-xl">{displayName[0]?.toUpperCase() ?? "?"}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg font-bold text-text-primary leading-tight">{displayName}</p>
                      <p className="text-sm text-text-muted mt-0.5 mb-4">{profileRole || uiText("Ui.text_51fb8dfa65e81e")}</p>
                      <div className="flex flex-wrap gap-2">{uiText.rich("Ui.text_e8649d1a41ba68", { part2: () => (<Pencil size={12} />), part1: chunks => (<Link href="/profile" className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">{chunks}</Link>), part4: () => (<ExternalLink size={12} />), part3: chunks => (<Link href={user?.id ? `/profile/${user.id}` : "/profile"} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">{chunks}</Link>) })}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Vollständigkeit */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_83e186228760e1")}</p>
                    <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_25bd3907ad1c76")}</p>
                  </div>
                  <span className={`text-xl font-bold font-mono ${profileCompleteness >= 75 ? "text-success" : profileCompleteness >= 50 ? "text-gold" : "text-text-secondary"}`}>
                    {profileCompleteness}%
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden mb-4">
                  <div className={`h-full rounded-full transition-all duration-700 ${profileCompleteness >= 75 ? "bg-success" : profileCompleteness >= 50 ? "bg-gold" : "bg-text-muted"}`}
                    style={{ width: `${profileCompleteness}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profileMissingFields.map((f) => (
                    <Link key={f} href="/profile"
                      className="flex items-center gap-2 text-xs text-text-muted hover:text-gold transition-colors group">{uiText.rich("Ui.text_bfe5f8c2639704", { part1: () => (<AlertCircle size={12} className="shrink-0 group-hover:text-gold" />), value3: () => (f), part2: chunks => (<span>{chunks}</span>) })}</Link>
                  ))}
                  {profileMissingFields.length === 0 && (
                    <p className="flex items-center gap-2 text-xs text-success col-span-2">{uiText.rich("Ui.text_07f044860551c6", { part1: () => (<CheckCircle size={12} />) })}</p>
                  )}
                </div>
              </div>

              {/* Profilaufrufe */}
              {viewStats && (
                <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                  <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">{uiText.rich("Ui.text_1ae821d0161836", { part1: () => (<Eye size={15} className="text-gold" />) })}</p>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-3xl font-bold font-display text-text-primary">{viewStats.views7}</p>
                      <p className={`text-xs font-medium mt-1 ${viewStats.trend > 0 ? "text-success" : viewStats.trend < 0 ? "text-red-400" : "text-text-muted"}`}>{uiText.rich("Ui.text_9facc7b997b7f4", { value1: () => (viewStats.trend > 0 ? uiText("Ui.text_1d732d182540bf", { value1: String(viewStats.trend) }) : viewStats.trend < 0 ? uiText("Ui.text_6a53a571fa6641", { value1: String(viewStats.trend) }) : uiText("Ui.text_353ef7a543290a")) })}</p>
                    </div>
                    <div className="flex items-end gap-0.5 h-10 flex-1">
                      {viewStats.daily.map((v, i) => {
                        const max = Math.max(...viewStats.daily, 1);
                        return <div key={i} className="flex-1 bg-gold/30 rounded-sm hover:bg-gold/60" style={{ height: `${Math.max((v / max) * 100, 8)}%` }} />;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Foto-Bewertungen */}
              {photoStats && (
                <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                  <p className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">{uiText.rich("Ui.text_f658ec20200b90", { part1: chunks => (<span className="text-gold text-sm">{chunks}</span>) })}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-3xl font-bold font-display text-text-primary">{photoStats.avg.toFixed(1)}</p>
                      <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map((s) => (
                          <span key={s} className={`text-sm ${s <= Math.round(photoStats.avg) ? "text-gold" : "text-text-muted/30"}`}>★</span>
                        ))}
                      </div>
                      <p className="text-xs text-text-muted mt-1">{uiText.rich("Ui.text_8c8cd0823c74c4", { value1: () => (photoStats.total), count2: photoStats.total })}</p>
                    </div>
                    {photoStats.best && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-gold/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoStats.best} alt={uiText("Ui.text_d984bbc26c2239")} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Schnelle Felder-Übersicht */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_ab242651b32579")}</p>
                  <Link href="/profile" className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">{uiText.rich("Ui.text_9be3200810d234", { part1: () => (<ChevronRight size={11} />) })}</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profileCompletionChecks.map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      {ok
                        ? <CheckCircle size={12} className="text-success shrink-0" />
                        : <AlertCircle size={12} className="text-text-muted shrink-0" />}
                      <span className={ok ? "text-text-secondary" : "text-text-muted"}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── FIRMA ── */}
          {activeTab === "firma" && (
            <div className="space-y-6 max-w-2xl">
              {myCompany === "loading" && (
                <div className="flex items-center gap-3 text-sm text-text-muted py-8">{uiText.rich("Ui.text_e68bc26b2fc6f2", { part1: () => (<Loader2 size={16} className="animate-spin" />) })}</div>
              )}

              {myCompany === null && (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl space-y-4">
                  <div className="w-16 h-16 mx-auto bg-bg-secondary border border-border rounded-2xl flex items-center justify-center">
                    <Building2 size={28} className="text-text-muted opacity-40" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-text-primary mb-2">{uiText("Ui.text_32ae0a5fd4c809")}</h3>
                    <p className="text-sm text-text-muted max-w-sm mx-auto">{uiText("Ui.text_800b9ab4851306")}</p>
                  </div>
                  <a href="/company-setup"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary text-sm font-semibold rounded-xl hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_555dba2841672a", { part1: () => (<Plus size={16} />) })}</a>
                </div>
              )}

              {myCompany && myCompany !== "loading" && (
                <>
                  {/* Company Header */}
                  <div className="flex items-start gap-5 p-6 rounded-2xl border border-border bg-bg-secondary">
                    <div className="w-16 h-16 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {myCompany.logo_url
                        ? <UnoptimizedImage src={myCompany.logo_url} alt={myCompany.name} className="w-full h-full object-contain p-1.5" />
                        : <Building2 size={24} className="text-text-muted opacity-40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-display text-lg font-bold text-text-primary">{myCompany.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${myCompany.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border"}`}>
                          {myCompany.published ? uiText("OfferModeration.statuses.owner_published") : uiText("OfferModeration.statuses.draft")}
                        </span>
                      </div>
                      {myCompany.city && <p className="text-xs text-text-muted mb-3">{myCompany.city}</p>}
                      {myCompany.tagline && <p className="text-sm text-text-secondary italic mb-3">{uiText.rich("Ui.text_df436a1f2b679a", { value1: () => (myCompany.tagline) })}</p>}
                      <div className="flex flex-wrap gap-2">{uiText.rich("Ui.text_04436355fa8f56", { part2: () => (<Pencil size={12} />), part1: chunks => (<a href="/company-setup"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">{chunks}</a>), part4: () => (<BarChart2 size={12} />), part3: chunks => (<a href="/company-dashboard"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">{chunks}</a>), part6: () => (<ExternalLink size={12} />), part5: chunks => (<a href={`/companies/${myCompany.slug}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors">{chunks}</a>) })}</div>
                    </div>
                  </div>

                  {/* Checkliste */}
                  <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-sm font-semibold text-text-primary mb-3">{uiText("profile.completionTitle")}</p>
                    <div className="space-y-2">
                      {[
                        { label: uiText("Ui.text_d7188d45e384f6"),          done: !!myCompany.logo_url },
                        { label: uiText("Ui.text_ca253d14c2ae91"),    done: !!(myCompany.tagline?.trim() || myCompany.description?.trim()) },
                        { label: uiText("Ui.text_12230e294b2d81"),   done: !!(myCompany.social_links && Object.values(myCompany.social_links).some(v => v?.trim())) },
                        { label: uiText("Ui.text_0642ef8281f506"),     done: myCompany.published },
                      ].map(({ label, done }) => (
                        <div key={label} className="flex items-center gap-2 text-sm">
                          {done
                            ? <CheckCircle size={14} className="text-success shrink-0" />
                            : <AlertCircle size={14} className="text-text-muted shrink-0" />}
                          <span className={done ? "text-text-secondary" : "text-text-muted"}>{label}</span>
                          {!done && (
                            <a href="/company-setup" className="ml-auto text-xs text-gold hover:underline">{uiText("Ui.text_18d4d9168461df")}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Links */}
                  <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-sm font-semibold text-text-primary mb-3">{uiText("Ui.text_db8644e777eb2e")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { label: uiText("Ui.text_47b6cd91a8fc94"),    href: "/company-dashboard?tab=services",  desc: uiText("Ui.text_d92cf7207c5ce5") },
                        { label: uiText("Ui.text_866a24cf1da9e0"),   href: "/company-dashboard?tab=equipment", desc: uiText("Ui.text_7bacef8c556d15") },
                        { label: uiText("Ui.text_a42e219c711da7"),        href: "/company-dashboard?tab=team",      desc: uiText("Ui.text_5c497fa20add72") },
                        { label: uiText("Ui.text_59d7fcdeacc6d4"), href: "/company-setup",                 desc: uiText("Ui.text_87871d9df9854d") },
                      ].map(({ label, href, desc }) => (
                        <a key={label} href={href}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-bg-elevated transition-all group">
                          <ChevronRight size={14} className="text-text-muted group-hover:text-gold mt-0.5 shrink-0 transition-colors" />
                          <div>
                            <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">{label}</p>
                            <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
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
                <a href="/inserat" className="px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_cdb4a69a5b9f1f", { part1: () => (<Plus size={12} />) })}</a>
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
                  <a href="/inserat" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_cdb4a69a5b9f1f", { part1: () => (<Plus size={13} />) })}</a>
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
                      {[job.role, job.location].filter(Boolean).join(" · ")} · {new Date(job.created_at).toLocaleDateString(uiLocale)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">{uiText.rich("Ui.text_d960f86ce558e1", { part1: chunks => (<a href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center">{chunks}</a>), part3: () => (<Pencil size={10} />), part2: chunks => (<a href={`/jobs/${job.id}/edit`}
                      className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all text-center flex items-center gap-1 justify-center">{chunks}</a>) })}</div>
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
                <Link href="/inserat" className="px-3 py-1.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-gold-light transition-colors">{uiText.rich("Ui.text_8ba166e3d0597a", { part1: () => (<Plus size={12} />) })}</Link>
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
                            <button key={key} type="button" aria-pressed={editLocationMeta[key]} onClick={() => setEditLocationMeta((current) => ({ ...current, [key]: !current[key] }))} className={`min-h-10 rounded-lg border px-3 text-xs ${editLocationMeta[key] ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{editLocationMeta[key] ? "✓ " : ""}{(uiOptionLabels[label] ?? label)}</button>
                          ))}
                        </div>
                        {editLocationMeta.power_available && <input maxLength={160} value={editLocationMeta.power_details} onChange={(event) => setEditLocationMeta((current) => ({ ...current, power_details: event.target.value }))} placeholder={uiText("Ui.text_45387017a0e70b")} className="min-h-10 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input maxLength={160} value={editLocationMeta.shooting_hours} onChange={(event) => setEditLocationMeta((current) => ({ ...current, shooting_hours: event.target.value }))} placeholder={uiText("AdminReview.fields.shooting_hours")} className="min-h-10 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />
                          <input maxLength={240} value={editLocationMeta.access_notes} onChange={(event) => setEditLocationMeta((current) => ({ ...current, access_notes: event.target.value }))} placeholder={uiText("Ui.text_01231d096c526a")} className="min-h-10 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />
                        </div>
                        <textarea maxLength={500} rows={2} value={editLocationMeta.availability_notes} onChange={(event) => setEditLocationMeta((current) => ({ ...current, availability_notes: event.target.value }))} placeholder={uiText("Ui.text_e6c48894da484b")} className="w-full rounded-lg border border-border bg-bg-elevated p-3 text-sm text-text-primary" />
                        <div>
                          <label className="mb-2 block text-xs text-text-muted">{uiText("Ui.text_29f202bb606cb9")}</label>
                          <div className="flex flex-wrap gap-2">
                            <input type="date" value={newBlockedDate} onChange={(event) => setNewBlockedDate(event.target.value)} className="min-h-10 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-primary" />
                            <button type="button" disabled={!newBlockedDate || editBlockedDates.includes(newBlockedDate)} onClick={() => { setEditBlockedDates((dates) => [...dates, newBlockedDate].sort()); setNewBlockedDate(""); }} className="min-h-10 rounded-lg border border-border px-3 text-xs text-text-secondary hover:border-gold hover:text-gold disabled:opacity-50">{uiText("Ui.text_cab5a16e99fc42")}</button>
                          </div>
                          {editBlockedDates.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{editBlockedDates.map((date) => <button key={date} type="button" onClick={() => setEditBlockedDates((dates) => dates.filter((item) => item !== date))} aria-label={uiText("Ui.text_88099c029f3803", { value1: String(date) })} className="min-h-8 rounded-full border border-crimson/30 bg-crimson/10 px-3 text-xs text-crimson-light">{new Date(`${date}T00:00:00`).toLocaleDateString(uiLocale)} ×</button>)}</div> : <p className="mt-2 text-[11px] text-text-muted">{uiText("Ui.text_e7d710d709332d")}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {[["restrooms", "WC / Sanitär"], ["green_room", "Aufenthaltsraum"], ["kitchen", "Küche"], ["changing_room", "Umkleide"], ["loading_bay", "Laderampe"], ["wifi", "Wi-Fi"]].map(([key, label]) => {
                            const active = editLocationMeta.amenities.includes(key);
                            return <button key={key} type="button" aria-pressed={active} onClick={() => setEditLocationMeta((current) => ({ ...current, amenities: active ? current.amenities.filter((item) => item !== key) : [...current.amenities, key] }))} className={`min-h-10 rounded-lg border px-2 text-xs ${active ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{active ? "✓ " : ""}{(uiOptionLabels[label] ?? label)}</button>;
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
                      {l.type === "location" && <ListingPriceOptions onRequest={editLocationMeta.price_on_request} negotiable={editLocationMeta.price_negotiable} onChange={value=>setEditLocationMeta(current=>({...current,price_on_request:value.priceOnRequest,price_negotiable:value.priceNegotiable}))} />}
                      {["prop","vehicle"].includes(l.type) ? null : l.type === "animal" ? <p className="text-xs text-text-muted">{animals("conditions")}</p> : !editLocationMeta.price_on_request || !["location", "prop", "vehicle"].includes(l.type) ? <>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1">{l.type === "location" ? uiText("Ui.text_2d78239ac0e617") : uiText("Ui.text_177ce41dae81c2")}</label>
                        <input type="number" min="0" value={editForm.price} onChange={(e) => { setEditLocationMeta((current) => ({ ...current, price_on_request: false })); setEditForm((p) => ({ ...p, price: e.target.value })); }} className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm transition-colors focus:border-gold focus:outline-none" placeholder="500" />
                      </> : <p className="text-xs text-text-muted">{uiText("Ui.text_aabd03635f4100")}</p>}
                    </div>
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

          {/* ── NACHRICHTEN ── */}
          {activeTab === "messages" && (
            <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden flex h-[680px]">
              {/* Conversation list */}
              <div className={`w-full sm:w-72 shrink-0 border-r border-border flex-col ${selectedConversation ? "hidden sm:flex" : "flex"}`}>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-text-muted font-semibold">{uiText("nav.messages")}</p>
                  {conversationsReady && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-gold text-bg-primary text-[10px] font-bold rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {convsLoading && (
                    <div className="p-4 text-center text-xs text-text-muted">{uiText("Ui.text_b89b8cdb9d6d6f")}</div>
                  )}
                  {!convsLoading && conversations.length === 0 && (
                    <div className="p-6 text-center text-xs text-text-muted">{uiText.rich("Ui.text_ffe16d6d46e013", { part1: () => (<MessageSquare size={24} className="mx-auto mb-2 opacity-30" />) })}</div>
                  )}
                  {conversations.map((conv) => {
                    const lastMsg = conv.messages[0];
                    const hasUnread = conv.unread_count > 0;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full flex items-start gap-3 p-4 text-left hover:bg-bg-elevated transition-colors ${
                          selectedConversation === conv.id ? "bg-bg-elevated border-l-2 border-l-gold" : ""
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center overflow-hidden">
                            {conv.otherAvatar
                              ? <UnoptimizedImage src={conv.otherAvatar} alt="" className="w-full h-full object-cover" />
                              : <User size={16} className="text-gold" />}
                          </div>
                          {hasUnread && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gold rounded-full border-2 border-bg-secondary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold text-text-primary truncate">
                              {conv.otherName ?? uiText("Ui.text_276ffa1fb4f970")}
                            </span>
                            <span className="text-[10px] text-text-muted shrink-0 ml-1">
                              {formatMsgTime(conv.updated_at)}
                            </span>
                          </div>
                          {conv.listing_type && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] bg-bg-elevated border border-border text-text-muted rounded mb-0.5">
                              {conv.listing_type}
                            </span>
                          )}
                          {lastMsg && (
                            <p className="text-[11px] text-text-muted truncate">{lastMsg.content}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right panel */}
              {!selectedConversation ? (
                <div className="flex-1 hidden sm:flex items-center justify-center text-text-muted text-sm">
                  <div className="text-center">{uiText.rich("Ui.text_e8d7b43e614730", { part1: () => (<MessageSquare size={32} className="mx-auto mb-2 opacity-20" />) })}</div>
                </div>
              ) : (() => {
                const conv = conversations.find(c => c.id === selectedConversation);
                if (!conv) return null;
                return (
                  <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border bg-bg-elevated flex items-center gap-3">
                      <button
                        onClick={() => setSelectedConversation(null)}
                        className="sm:hidden flex items-center justify-center w-7 h-7 rounded-lg hover:bg-bg-secondary transition-colors shrink-0"
                      >
                        <ArrowLeft size={16} className="text-text-muted" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary leading-tight truncate">
                          {conv.otherName ?? uiText("Ui.text_276ffa1fb4f970")}
                        </p>
                        {(conv.listing_title || conv.listing_type) && (
                          <p className="text-xs text-text-muted mt-0.5 truncate">
                            {[conv.listing_type, conv.listing_title].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                      {messagesLoading && (
                        <div className="text-center text-xs text-text-muted py-4">{uiText("Ui.text_bed1a3a89cb15c")}</div>
                      )}
                      {messageLoadError && <div role="alert" className="py-3 text-xs text-red-400">
                        <p>{messageLoadError}</p>
                        <button type="button" onClick={() => setMessageReloadVersion(value => value + 1)} className="min-h-11 text-gold">{dashboardMessageText("retry")}</button>
                      </div>}
                      {!messagesLoading && !messageLoadError && activeMessages.length === 0 && (
                        <div className="text-center text-xs text-text-muted py-4">{uiText("Ui.text_d7d4b6f053e077")}</div>
                      )}
                      {activeMessages.map((msg) => {
                        const mine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              mine
                                ? "bg-gold text-bg-primary rounded-br-sm"
                                : "bg-bg-elevated border border-border text-text-secondary rounded-bl-sm"
                            }`}>
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <p className={`text-[10px] mt-1 ${mine ? "text-bg-primary/60" : "text-text-muted"}`}>
                                {formatMsgTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply input */}
                    <div className="p-3 border-t border-border">
                      {replyError && <p role="alert" className="mb-2 text-xs text-red-400">{replyError}</p>}
                      <div className="flex items-end gap-2">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={uiText("Ui.text_b43afc27e348f2")}
                        className="flex-1 bg-bg-elevated border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      />
                      <button
                        onClick={sendReply}
                        disabled={!replyText.trim() || sending}
                        className="w-9 h-9 bg-gold rounded-xl flex items-center justify-center hover:bg-gold-light transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={15} className="text-bg-primary" />
                      </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── BUCHUNGEN ── */}
          {activeTab === "bookings" && (
            <div className="space-y-6">
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
                          <p className="text-sm font-semibold text-text-primary mr-1">{b.total.toLocaleString(uiLocale)} €</p>
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
                        <p className="text-sm font-semibold text-text-primary">{b.total.toLocaleString(uiLocale)} €</p>
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
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    {
                      label: uiText("Ui.text_3e85ef1a96ad89"),
                      value: listingsLoading || convsLoading ? "…" : String(conversations.length),
                      sub: conversationsLoadError ? uiText("common.unavailable") : !conversationsReady ? uiText("creators.loading") : unreadCount > 0 ? uiText("Ui.text_f7c1688df1fc46", { value1: String(unreadCount) }) : uiText("notifications.markAllRead"),
                    },
                    {
                      label: uiText("Ui.text_67ed1256b3af19"),
                      value: listingsLoading ? "…" : String(myListings.filter(l => l.published).length),
                      sub: uiText("Ui.text_888c0247e6c804", { value1: String(myListings.length) }),
                    },
                    {
                      label: uiText("Ui.text_de005465742f1c"),
                      value: convsLoading ? "…" : String(listingsWithInquiries),
                      sub: myListings.length > 0 ? uiText("Ui.text_31f02718f6b03e", { value1: String(myListings.length) }) : uiText("Ui.text_c9636816421535"),
                    },
                    {
                      label: uiText("Ui.text_de3a80218e65be"),
                      value: conversationsReady ? String(unreadCount) : conversationsLoadError ? "—" : "…",
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

          {/* ── EINSTELLUNGEN ── */}
          {activeTab === "settings" && (
            <div className="max-w-xl space-y-5">
              {privacyError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {privacyError}
                </p>
              )}

              {/* Öffentliches Profil */}
              {(() => {
                const avatarSrc = profileAvatarUrl || user?.imageUrl || "";
                const displayName = profileDisplayName || (user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "") || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "—";
                return (
              <div className="flex items-start gap-5 p-6 rounded-2xl border-2 border-gold/30 bg-gold-subtle">
                <div className="shrink-0">
                  {avatarSrc ? (
                    <UnoptimizedImage src={avatarSrc} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gold/30" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gold/20 border-2 border-gold/30 flex items-center justify-center">
                      <span className="text-gold font-bold text-lg">{displayName[0]?.toUpperCase() ?? "?"}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base font-bold text-text-primary leading-tight">{displayName}</p>
                  <p className="text-xs text-text-muted mt-0.5 mb-4">{profileRole || uiText("Ui.text_51fb8dfa65e81e")}</p>
                  <div className="flex flex-wrap gap-2">{uiText.rich("Ui.text_e8649d1a41ba68", { part2: () => (<Pencil size={12} />), part1: chunks => (<Link
                      href="/profile"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors"
                    >{chunks}</Link>), part4: () => (<ExternalLink size={12} />), part3: chunks => (<Link
                      href={user?.id ? `/profile/${user.id}` : "/profile"}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-colors"
                    >{chunks}</Link>) })}</div>
                </div>
              </div>
                );
              })()}

              {/* Konto-Info (read-only) */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-4">{uiText("AdminAccounts.accountOnly")}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("profile.fieldEmail")}</label>
                    <p className="text-sm text-text-secondary">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{uiText("Ui.text_20885d30c494f4")}</p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold block mb-1">{uiText("Ui.text_0c876006fd6261")}</label>
                    <p className="text-sm text-text-secondary">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(uiLocale, { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Privatsphäre */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-1">{uiText("Ui.text_e1a0d1dd340a2b")}</h3>
                <p className="text-xs text-text-muted mb-4">{uiText("Ui.text_2eaccd2ccb08f9")}</p>
                <div className="space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {privacySettings.profile_visibility === "private"
                          ? <Lock size={16} className="text-gold" />
                          : <Globe size={16} className="text-text-muted" />}
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary font-medium">{uiText("AdminAccounts.profileStatus.private")}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {privacySettings.profile_visibility === "private"
                            ? uiText("Ui.text_319df907eec5c4")
                            : uiText("Ui.text_f00642ae07a01e")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePrivacy("profile_visibility", privacySettings.profile_visibility === "private" ? "public" : "private")}
                      disabled={privacyLoading}
                      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${privacySettings.profile_visibility === "private" ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${privacySettings.profile_visibility === "private" ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </label>
                  <div className="border-t border-border" />
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {privacySettings.message_permission === "friends_only"
                          ? <Lock size={16} className="text-gold" />
                          : <Globe size={16} className="text-text-muted" />}
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary font-medium">{uiText("Ui.text_ea78c6f63ee699")}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {privacySettings.message_permission === "friends_only"
                            ? uiText("Ui.text_64706adaeb4ba9")
                            : uiText("Ui.text_6a99309250cc5b")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePrivacy("message_permission", privacySettings.message_permission === "friends_only" ? "everyone" : "friends_only")}
                      disabled={privacyLoading}
                      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${privacySettings.message_permission === "friends_only" ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${privacySettings.message_permission === "friends_only" ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </label>
                  <div className="border-t border-border" />
                  <div>
                    <p className="text-sm text-text-secondary font-medium">{uiText("Ui.text_362c64c73e26ee")}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{uiText("Ui.text_b0700c88f48c24")}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {([
                        ["contact_email_visibility", "Kontakt-E-Mail"],
                        ["phone_visibility", "Telefonnummer"],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="block text-xs text-text-muted">
                          <span className="mb-1.5 block">{(uiOptionLabels[label] ?? label)}</span>
                          <select
                            value={privacySettings[key]}
                            onChange={(event) => updatePrivacy(key, event.target.value)}
                            disabled={privacyLoading}
                            className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold/60 disabled:opacity-60"
                          >
                            <option value="hidden">{uiText("Ui.text_6720edc12a568c")}</option>
                            <option value="members">{uiText("Ui.text_dbb65504ccd522")}</option>
                            <option value="public">{uiText("Ui.text_a010b3180a613f")}</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Benachrichtigungen */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-1">{uiText("Ui.text_2687f5bbc0624e")}</h3>
                <p className="text-xs text-text-muted mb-4">{uiText("Ui.text_069c81016363a4")}</p>
                <div className="space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <MessageSquare size={16} className={privacySettings.email_new_message ? "text-gold" : "text-text-muted"} />
                      </div>
                      <div>
                        <p className="text-sm text-text-secondary font-medium">{uiText("Ui.text_4aadfb7b596d7b")}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {privacySettings.email_new_message
                            ? uiText("Ui.text_1d9fa328e47307")
                            : uiText("Ui.text_4c30935ebf9103")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updatePrivacy("email_new_message", !privacySettings.email_new_message)}
                      disabled={privacyLoading}
                      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${privacySettings.email_new_message ? "bg-gold" : "bg-bg-elevated border border-border"}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${privacySettings.email_new_message ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </label>
                </div>
              </div>

              {/* Verifizierung */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">{uiText.rich("Ui.text_ea23f7824c8628", { part1: () => (<ShieldCheck size={16} className={verifStatus === "approved" ? "text-success" : "text-text-muted"} />) })}</h3>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">{uiText("Ui.text_b35d9de7e46840")}</p>
                {verifLoading ? (
                  <Loader2 size={16} className="animate-spin text-text-muted" />
                ) : verifStatus === "approved" ? (
                  <div className="flex items-center gap-2 text-success text-sm font-medium">{uiText.rich("Ui.text_6280e60d3e6b8b", { part1: () => (<CheckCircle size={16} />) })}</div>
                ) : verifStatus === "pending" ? (
                  <div className="flex items-center gap-2 text-gold text-sm">{uiText.rich("Ui.text_f04af96360a699", { part1: () => (<Clock size={16} />) })}</div>
                ) : (
                  <button
                    disabled={verifSubmitting}
                    onClick={async () => {
                      setVerifSubmitting(true);
                      try {
                        const res = await fetch("/api/verification-requests", { method: "POST" });
                        if (res.ok) setVerifStatus("pending");
                      } finally {
                        setVerifSubmitting(false);
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors flex items-center gap-1.5 disabled:opacity-40"
                  >{uiText.rich("Ui.text_425e143ec6d501", { value1: () => (verifSubmitting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />) })}</button>
                )}
              </div>

              {/* ── DANGER ZONE ── */}
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

            </div>
          )}
          {/* ── FREUNDE ── */}
          {activeTab === "friends" && (
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">{uiText.rich("Ui.text_d1d7a8f9a56576", { part1: () => (<Users size={18} className="text-gold" />) })}</h2>
                  <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_273e11a42338a7")}</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 p-1 bg-bg-secondary border border-border rounded-xl w-fit">
                {(["incoming", "friends", "outgoing"] as const).map((t) => {
                  const labels = { incoming: uiText("Ui.text_5dfb5bcd667e78"), friends: uiText("Ui.text_f72d71d3376f5f"), outgoing: uiText("Ui.text_4b6a7afab7b4c4") };
                  const counts = { incoming: friendsIncoming.length, friends: friends.length, outgoing: friendsOutgoing.length };
                  return (
                    <button
                      key={t}
                      onClick={() => setFriendsTab(t)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                        friendsTab === t ? "bg-gold text-bg-primary" : "text-text-secondary hover:text-gold"
                      }`}
                    >
                      {labels[t]}
                      {counts[t] > 0 && (
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${friendsTab === t ? "bg-bg-primary/20" : "bg-gold/10 text-gold"}`}>
                          {counts[t]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {friendsLoading && (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-bg-secondary border border-border rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!friendsLoading && friendsTab === "incoming" && (
                <>
                  {friendsIncoming.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                      <UserPlus size={24} className="mx-auto text-text-muted opacity-30 mb-3" />
                      <p className="text-sm text-text-muted">{uiText("Ui.text_f701875e725fdf")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendsIncoming.map(f => (
                        <div key={f.friendship_id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary">
                          <div className="shrink-0">
                            {f.avatar_url ? (
                              <UnoptimizedImage src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                                <span className="text-gold font-bold text-base">{f.display_name[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary text-sm truncate">{f.display_name}</p>
                            <p className="text-xs text-text-muted truncate">{f.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => acceptFriend(f.friendship_id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors">{uiText.rich("Ui.text_048edf533fa6f4", { part1: () => (<Check size={12} />) })}</button>
                            <button onClick={() => rejectFriend(f.friendship_id)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-border text-text-muted text-xs rounded-lg hover:border-red-400 hover:text-red-400 transition-colors">{uiText.rich("Ui.text_2424239b7d6d6c", { part1: () => (<X size={12} />) })}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!friendsLoading && friendsTab === "friends" && (() => {
                const q = friendSearch.trim().toLowerCase();
                const filtered = friends.filter(f =>
                  !q || f.display_name.toLowerCase().includes(q) || (f.role ?? "").toLowerCase().includes(q)
                );
                const grouped = filtered.reduce<Record<string, typeof friends>>((acc, f) => {
                  const key = f.role?.trim() || "Sonstige";
                  (acc[key] ??= []).push(f);
                  return acc;
                }, {});
                const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, uiLocale));
                sortedGroups.forEach(([, members]) => members.sort((a, b) => a.display_name.localeCompare(b.display_name, uiLocale)));

                return (
                  <>
                    {friends.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                        <Users size={24} className="mx-auto text-text-muted opacity-30 mb-3" />
                        <p className="text-sm text-text-muted">{uiText("Ui.text_1678f937aa7e48")}</p>
                        <p className="text-xs text-text-muted mt-1">{uiText("Ui.text_6838f11e8b59bd")}</p>
                      </div>
                    ) : (
                      <>
                        <div className="relative mb-4">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            value={friendSearch}
                            onChange={e => setFriendSearch(e.target.value)}
                            placeholder={uiText("Ui.text_cf85b51103ffa9")}
                            className="w-full pl-9 pr-4 py-2 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/50 transition-colors"
                          />
                        </div>
                        {filtered.length === 0 ? (
                          <p className="text-sm text-text-muted text-center py-8">{uiText.rich("Ui.text_9da7cfdab9c3a6", { value1: () => (friendSearch) })}</p>
                        ) : (
                          <div className="space-y-5">
                            {sortedGroups.map(([role, members]) => (
                              <div key={role}>
                                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{role}</p>
                                <div className="space-y-2">
                                  {members.map(f => (
                                    <div key={f.friendship_id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-colors">
                                      <div className="shrink-0">
                                        {f.avatar_url ? (
                                          <UnoptimizedImage src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
                                        ) : (
                                          <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                                            <span className="text-gold font-bold text-base">{f.display_name[0]?.toUpperCase()}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-text-primary text-sm truncate">{f.display_name}</p>
                                        <p className="text-xs text-text-muted truncate">{f.role}</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Link href={`/profile/${f.user_id}`} className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all">{uiText("profile.tabProfile")}</Link>
                                        <button onClick={() => removeFriendEntry(f.friendship_id)}
                                          className="px-3 py-1.5 text-xs border border-border text-text-muted rounded-lg hover:border-red-400 hover:text-red-400 transition-all">{uiText("profile.removePhoto")}</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}

              {!friendsLoading && friendsTab === "outgoing" && (
                <>
                  {friendsOutgoing.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                      <UserPlus size={24} className="mx-auto text-text-muted opacity-30 mb-3" />
                      <p className="text-sm text-text-muted">{uiText("Ui.text_ad7ed3b7d627b8")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendsOutgoing.map(f => (
                        <div key={f.friendship_id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary">
                          <div className="shrink-0">
                            {f.avatar_url ? (
                              <UnoptimizedImage src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center">
                                <span className="text-gold font-bold text-base">{f.display_name[0]?.toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-text-primary text-sm truncate">{f.display_name}</p>
                            <p className="text-xs text-text-muted truncate">{f.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-muted flex items-center gap-1 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg">{uiText.rich("Ui.text_19b8ad14754fa2", { part1: () => (<Clock size={11} />) })}</span>
                            <button onClick={() => removeFriendEntry(f.friendship_id)}
                              className="px-3 py-1.5 text-xs border border-border text-text-muted rounded-lg hover:border-red-400 hover:text-red-400 transition-all">{uiText("OrganizationAccess.withdraw")}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── MERKLISTE ── */}
          {activeTab === "favorites" && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">{uiText.rich("Ui.text_1e756fbcc73cec", { part1: () => (<Heart size={18} className="text-crimson-light fill-current" />) })}</h2>
                  <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_d788252801aefd")}</p>
                </div>
                {!favoritesLoading && favorites.length > 0 && (
                  <span className="px-3 py-1 bg-bg-secondary border border-border text-text-muted text-xs rounded-full">
                    {favorites.length} {favorites.length === 1 ? uiText("Ui.text_99b9259f15b10b") : uiText("Ui.text_b46a6b65c674c7")}
                  </span>
                )}
              </div>

              {favoritesLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-bg-secondary border border-border rounded-xl animate-pulse" />
                  ))}
                </div>
              )}

              {!favoritesLoading && favorites.length === 0 && (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl space-y-4">
                  <div className="w-14 h-14 mx-auto bg-bg-secondary border border-border rounded-full flex items-center justify-center">
                    <Heart size={22} className="text-text-muted opacity-30" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-1">{uiText("Ui.text_bf33b5684b2765")}</h3>
                    <p className="text-sm text-text-muted max-w-xs mx-auto">{uiText("Ui.text_632dbf951dd528")}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">{uiText.rich("Ui.text_7788914955afcd", { part1: chunks => (<Link href="/locations" className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all">{chunks}</Link>), part2: chunks => (<Link href="/creators" className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all">{chunks}</Link>), part3: chunks => (<Link href="/jobs" className="px-4 py-2 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all">{chunks}</Link>) })}</div>
                </div>
              )}

              {!favoritesLoading && favorites.length > 0 && (
                <div className="space-y-3">
                  {favorites.map(fav => {
                    const config = favTypeConfig[fav.listing_type];
                    if (!config) return null;
                    const Icon = config.icon;
                    const isRemoving = removingFav === fav.listing_id;
                    return (
                      <div key={fav.id} className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:border-gold/30 transition-all ${isRemoving ? "opacity-50" : ""}`}>
                        <Link href={config.href(fav.listing_id)} className="shrink-0">
                          {fav.listing_image ? (
                            <UnoptimizedImage src={fav.listing_image} alt={fav.listing_title ?? ""} className="w-14 h-14 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                              <Icon size={20} className={config.color} />
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={config.href(fav.listing_id)} className="hover:text-gold transition-colors">
                            <p className="font-semibold text-text-primary truncate">{fav.listing_title ?? uiText("AdminAccounts.contentKinds.other")}</p>
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`flex items-center gap-1 text-xs ${config.color}`}>
                              <Icon size={10} /> {config.label}
                            </span>
                            {fav.listing_city && <span className="text-xs text-text-muted">{fav.listing_city}</span>}
                          </div>
                        </div>
                        {(fav.priceLabel || (fav.listing_price != null && fav.listing_price > 0)) && (
                          <div className="text-right shrink-0 hidden sm:block">
                            <p className="text-sm font-semibold text-gold font-mono">{fav.priceLabel ?? uiText("Ui.text_4a44946c8fc283", { value1: String(fav.listing_price?.toLocaleString(uiLocale)) })}</p>
                            <p className="text-xs text-text-muted">{uiText("Ui.text_2bf4c50be2aec3")}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={config.href(fav.listing_id)} className="px-3 py-1.5 text-xs border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-all">{uiText("Ui.text_8e31363947a6c7")}</Link>
                          <button onClick={() => removeFavorite(fav)} disabled={isRemoving}
                            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-crimson-light transition-colors disabled:opacity-40" title={uiText("profile.removePhoto")}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>


    </div>
  );
}
