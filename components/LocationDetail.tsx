"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  MapPin, Star, CheckCircle, Users, Zap, ArrowLeft,
  Shield, MessageSquare, ChevronRight, Expand,
  Wifi, Car, Zap as Power, Coffee, DoorOpen, Truck,
  Thermometer, Volume2, Wind, Accessibility, ArrowUpDown,
  FlipHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import ReviewsSection from "@/components/ReviewsSection";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";

const Lightbox = dynamic(() => import("@/components/Lightbox"), { ssr: false });

interface LocationMeta {
  sqm?: number | null;
  ceiling_height_m?: number | null;
  max_crew?: number | null;
  indoor_outdoor?: "innen" | "außen" | "beides" | string;
  power_available?: boolean;
  power_details?: string | null;
  parking_spots?: number | null;
  amenities?: string[];
}

type Location = {
  id: string; title: string; type: string; city: string;
  price: number; priceUnit: string; rating: number; reviews: number;
  image: string; tags: string[]; instantBook: boolean; verified: boolean;
  description?: string;
  ownerId?: string; ownerName?: string;
  metadata?: LocationMeta | null;
  blocked_dates?: string[];
  floor_plan_url?: string | null;
  extra_images?: string[];
  // Legacy fields
  sqft?: number; capacity?: number;
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi", restrooms: "WC / Sanitär", green_room: "Green Room",
  loading_bay: "Laderampe", kitchen: "Küche", changing_room: "Umkleide",
  generator: "Generator", sound_insulated: "Schallisoliert", ac: "Klimaanlage",
  heating: "Heizung", elevator: "Aufzug", disabled_access: "Barrierefreiheit",
};

const AMENITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  wifi: Wifi, restrooms: DoorOpen, green_room: Users, loading_bay: Truck,
  kitchen: Coffee, changing_room: Users, generator: Power, sound_insulated: Volume2,
  ac: Wind, heating: Thermometer, elevator: ArrowUpDown, disabled_access: Accessibility,
};

export default function LocationDetail({ location }: { location: Location }) {
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [bookingStart, setBookingStart] = useState<Date | null>(null);
  const [bookingEnd, setBookingEnd]     = useState<Date | null>(null);
  const [bookingDays, setBookingDays]   = useState(0);
  const router = useRouter();

  const meta = location.metadata ?? {};
  const amenities: string[] = meta.amenities ?? [];

  // Images: main + extra
  const allImages = [location.image, ...(location.extra_images ?? [])].filter(Boolean) as string[];

  const handleCalendarSelect = (start: Date, end: Date, days: number) => {
    setBookingStart(start); setBookingEnd(end); setBookingDays(days);
  };

  const handleBook = () => {
    if (!bookingStart || !bookingEnd) return;
    router.push(
      `/booking/checkout?type=location&id=${location.id}` +
      `&title=${encodeURIComponent(location.title)}` +
      `&price=${location.price}&days=${bookingDays}` +
      `&startDate=${bookingStart.toISOString().split("T")[0]}` +
      `&endDate=${bookingEnd.toISOString().split("T")[0]}`
    );
  };

  const lageLabel = meta.indoor_outdoor === "beides" ? "Innen & Außen"
    : meta.indoor_outdoor === "außen" ? "Außen"
    : meta.indoor_outdoor === "innen" ? "Innen"
    : null;

  return (
    <div className="pt-16 min-h-screen">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link href="/locations" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-4">
          <ArrowLeft size={14} /> Zurück zu Locations
        </Link>
      </div>

      {/* Image gallery */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className={`relative grid gap-2 rounded-xl overflow-hidden h-80 sm:h-[420px] ${allImages.length > 1 ? "grid-cols-4" : "grid-cols-1"}`}>
          <div className={`${allImages.length > 1 ? "col-span-2 row-span-2" : "col-span-4"} relative overflow-hidden cursor-pointer`}
            onClick={() => { setActiveImg(0); setLightboxOpen(true); }}>
            {allImages[0] ? (
              <Image src={allImages[0]} alt={location.title} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="50vw" priority />
            ) : (
              <div className="w-full h-full bg-bg-elevated flex items-center justify-center text-text-muted/20">
                <MapPin size={48} />
              </div>
            )}
          </div>
          {allImages.slice(1, 5).map((img, i) => (
            <div key={i} className="relative overflow-hidden cursor-pointer"
              onClick={() => { setActiveImg(i + 1); setLightboxOpen(true); }}>
              <Image src={img} alt="" fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="25vw" />
            </div>
          ))}
          {allImages.length > 1 && (
            <button onClick={() => setLightboxOpen(true)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all backdrop-blur-sm">
              <Expand size={13} /> Alle {allImages.length} Fotos
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox images={allImages} activeIndex={activeImg} alt={location.title}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setActiveImg((i) => (i - 1 + allImages.length) % allImages.length)}
          onNext={() => setActiveImg((i) => (i + 1) % allImages.length)} />
      )}

      {/* Content + sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex gap-10 flex-col lg:flex-row">
          {/* Left */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  {location.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-bg-secondary border border-border text-text-muted text-xs rounded">{t}</span>
                  ))}
                  {location.verified && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 border border-success/20 text-success text-xs rounded">
                      <CheckCircle size={11} /> Verifiziert
                    </span>
                  )}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-1">{location.title}</h1>
                <p className="text-text-secondary flex items-center gap-1.5">
                  <MapPin size={14} className="text-gold" /> {location.city} &middot; {location.type}
                </p>
              </div>
              <FavoriteButton listingId={location.id} listingType="location" listingTitle={location.title}
                listingCity={location.city} listingPrice={location.price} listingImage={location.image} />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 py-4 border-b border-border mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className={i < Math.floor(location.rating) ? "text-gold fill-gold" : "text-border"} />
                ))}
              </div>
              <span className="font-semibold text-text-primary">{location.rating}</span>
              <span className="text-text-muted text-sm">({location.reviews} Bewertungen)</span>
            </div>

            {/* Key specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                meta.sqm && { label: "Fläche", value: `${meta.sqm} m²` },
                meta.ceiling_height_m && { label: "Deckenhöhe", value: `${meta.ceiling_height_m} m` },
                meta.max_crew && { label: "Max. Crew", value: `${meta.max_crew} Personen` },
                meta.parking_spots != null && { label: "Parkplätze", value: String(meta.parking_spots) },
                lageLabel && { label: "Lage", value: lageLabel },
                { label: "Preis", value: `${location.price.toLocaleString()} €/Tag` },
              ].filter((x): x is { label: string; value: string } => !!x).map(({ label, value }) => (
                <div key={label} className="p-4 bg-bg-secondary border border-border rounded-xl text-center">
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</div>
                  <div className="text-sm font-semibold text-text-primary">{value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {location.description && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">Über diese Location</h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{location.description}</p>
              </div>
            )}

            {/* Strom */}
            {meta.power_available && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-bg-secondary border border-border rounded-xl">
                <Power size={16} className="text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Stromanschluss vorhanden</p>
                  {meta.power_details && <p className="text-xs text-text-muted mt-0.5">{meta.power_details}</p>}
                </div>
              </div>
            )}

            {/* Ausstattung */}
            {amenities.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-4">Ausstattung</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {amenities.map((a) => {
                    const Icon = AMENITY_ICONS[a] || CheckCircle;
                    return (
                      <div key={a} className="flex items-center gap-2.5 p-3 bg-bg-secondary border border-border rounded-lg">
                        <Icon size={15} className="text-gold shrink-0" />
                        <span className="text-sm text-text-secondary">{AMENITY_LABELS[a] ?? a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grundriss */}
            {location.floor_plan_url && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-4">
                  <FlipHorizontal size={18} className="inline mr-2 text-gold" />Grundriss
                </h2>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={location.floor_plan_url} alt="Grundriss" className="w-full max-w-lg rounded-xl border border-border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => { setActiveImg(allImages.length); setLightboxOpen(true); }} />
              </div>
            )}

            {/* Reviews */}
            <ReviewsSection targetId={location.id} targetType="location" targetName={location.title} />
          </div>

          {/* Booking sidebar */}
          <div className="lg:w-[360px] shrink-0">
            <div className="sticky top-20 space-y-4">
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold font-display text-text-primary">{location.price.toLocaleString()} €</span>
                  <span className="text-text-muted mb-1">/{location.priceUnit}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-5">
                  <Star size={13} className="text-gold fill-gold" />
                  <span className="text-sm font-semibold text-text-primary">{location.rating}</span>
                  <span className="text-text-muted text-sm">· {location.reviews} Bewertungen</span>
                </div>

                <AvailabilityCalendar
                  dailyRate={location.price}
                  onSelect={handleCalendarSelect}
                  blockedDates={location.blocked_dates}
                />

                <button onClick={handleBook} disabled={!bookingStart || !bookingEnd}
                  className={`w-full mt-4 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    bookingStart && bookingEnd ? "bg-gold text-bg-primary hover:bg-gold-light cursor-pointer" : "bg-border text-text-muted cursor-not-allowed"
                  }`}>
                  {location.instantBook ? <><Zap size={15} /> Sofort buchen</> : <><MessageSquare size={15} /> Buchung anfragen</>}
                </button>
                <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1 mt-2">
                  <Shield size={11} /> Sichere Zahlung · Geld in Treuhand bis Bestätigung
                </p>
              </div>

              {location.ownerId ? (
                <InquiryForm listingId={location.id} listingTitle={location.title} listingType="location"
                  ownerId={location.ownerId} ownerName={location.ownerName ?? "Anbieter"} />
              ) : (
                <div className="p-4 bg-bg-secondary border border-border rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                    <Users size={16} className="text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">Frage an den Anbieter?</p>
                    <p className="text-xs text-text-muted">Antwortet in der Regel in &lt;2h</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
