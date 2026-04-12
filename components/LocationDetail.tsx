"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  MapPin, Star, CheckCircle, Users, Zap, ArrowLeft,
  Shield, MessageSquare, ChevronRight,
  Wifi, Car, Zap as Power, Coffee, DoorOpen, Expand,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import ReviewsSection from "@/components/ReviewsSection";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";

const Lightbox = dynamic(() => import("@/components/Lightbox"), { ssr: false });

type Location = {
  id: string; title: string; type: string; city: string;
  price: number; priceUnit: string; rating: number; reviews: number;
  image: string; tags: string[]; instantBook: boolean; verified: boolean;
  sqft: number; capacity: number;
  description?: string;
  ownerId?: string; ownerName?: string;
};

const amenityIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "Wi-Fi": Wifi, "Parking": Car, "Power Supply": Power,
  "Kitchen": Coffee, "Restrooms": DoorOpen,
};

const dummyAmenities = ["Parking", "Power Supply", "Restrooms", "Wi-Fi", "Green Room", "Loading Bay"];
const dummyRules = [
  "Maximum crew size as stated — no exceptions",
  "No open flames or pyrotechnics without written approval",
  "All equipment must be removed within 2 hours of booking end",
  "No smoking inside the property",
  "Noise curfew: 10pm weekdays, 11pm weekends",
];

export default function LocationDetail({ location }: { location: Location }) {
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [bookingStart, setBookingStart] = useState<Date | null>(null);
  const [bookingEnd, setBookingEnd]     = useState<Date | null>(null);
  const [bookingDays, setBookingDays]   = useState(0);
  const router = useRouter();

  const handleCalendarSelect = (start: Date, end: Date, days: number) => {
    setBookingStart(start);
    setBookingEnd(end);
    setBookingDays(days);
  };

  const handleBook = () => {
    if (!bookingStart || !bookingEnd) return;
    router.push(
      `/booking/checkout?type=location&id=${location.id}` +
      `&title=${encodeURIComponent(location.title)}` +
      `&price=${location.price}` +
      `&days=${bookingDays}` +
      `&startDate=${bookingStart.toISOString().split("T")[0]}` +
      `&endDate=${bookingEnd.toISOString().split("T")[0]}`
    );
  };

  const images = [location.image].filter(Boolean) as string[];

  return (
    <div className="pt-16 min-h-screen">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link href="/locations" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-4">
          <ArrowLeft size={14} /> Zurück zu Drehorte
        </Link>
      </div>

      {/* Image gallery */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="relative grid grid-cols-4 gap-2 rounded-xl overflow-hidden h-80 sm:h-[420px]">
          <div className="col-span-2 row-span-2 relative overflow-hidden cursor-pointer" onClick={() => { setActiveImg(0); setLightboxOpen(true); }}>
            <Image src={images[0]} alt={location.title} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="50vw" priority />
          </div>
          {images.slice(1).map((img, i) => (
            <div key={i} className="relative overflow-hidden cursor-pointer" onClick={() => { setActiveImg(i + 1); setLightboxOpen(true); }}>
              <Image src={img} alt="" fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="25vw" />
            </div>
          ))}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all backdrop-blur-sm"
          >
            <Expand size={13} /> View All Photos
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          activeIndex={activeImg}
          alt={location.title}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
          onNext={() => setActiveImg((i) => (i + 1) % images.length)}
        />
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
                    <span key={t} className="px-2 py-0.5 bg-bg-secondary border border-border text-text-muted text-xs rounded">
                      {t}
                    </span>
                  ))}
                  {location.verified && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 border border-success/20 text-success text-xs rounded">
                      <CheckCircle size={11} /> Verified
                    </span>
                  )}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-1">
                  {location.title}
                </h1>
                <p className="text-text-secondary flex items-center gap-1.5">
                  <MapPin size={14} className="text-gold" /> {location.city} &middot; {location.type}
                </p>
              </div>
              <FavoriteButton
                listingId={location.id}
                listingType="location"
                listingTitle={location.title}
                listingCity={location.city}
                listingPrice={location.price}
                listingImage={location.image}
              />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 py-4 border-b border-border mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className={i < Math.floor(location.rating) ? "text-gold fill-gold" : "text-border"} />
                ))}
              </div>
              <span className="font-semibold text-text-primary">{location.rating}</span>
              <span className="text-text-muted text-sm">({location.reviews} reviews)</span>
            </div>

            {/* Key specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Size", value: `${location.sqft.toLocaleString()} sqft` },
                { label: "Max Crew", value: `${location.capacity} people` },
                { label: "Rate", value: `$${location.price.toLocaleString()}/${location.priceUnit}` },
                { label: "Booking", value: location.instantBook ? "Instant Book" : "Request to Book" },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 bg-bg-secondary border border-border rounded-xl text-center">
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</div>
                  <div className="text-sm font-semibold text-text-primary">{value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-3">Über diesen Drehort</h2>
              {location.description ? (
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{location.description}</p>
              ) : (
                <p className="text-text-muted italic text-sm">Keine Beschreibung vorhanden.</p>
              )}
            </div>

            {/* Amenities */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-4">Amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {dummyAmenities.map((a) => {
                  const Icon = amenityIcons[a] || CheckCircle;
                  return (
                    <div key={a} className="flex items-center gap-2.5 p-3 bg-bg-secondary border border-border rounded-lg">
                      <Icon size={15} className="text-gold shrink-0" />
                      <span className="text-sm text-text-secondary">{a}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* House Rules */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-4">House Rules</h2>
              <ul className="space-y-2">
                {dummyRules.map((r) => (
                  <li key={r} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <ChevronRight size={14} className="text-gold mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Reviews */}
            <ReviewsSection targetId={location.id} targetType="location" targetName={location.title} />
          </div>

          {/* Booking sidebar */}
          <div className="lg:w-[360px] shrink-0">
            <div className="sticky top-20 space-y-4">

              {/* Price header */}
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold font-display text-text-primary">
                    {location.price.toLocaleString()} €
                  </span>
                  <span className="text-text-muted mb-1">/{location.priceUnit}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-5">
                  <Star size={13} className="text-gold fill-gold" />
                  <span className="text-sm font-semibold text-text-primary">{location.rating}</span>
                  <span className="text-text-muted text-sm">· {location.reviews} Bewertungen</span>
                </div>

                {/* Calendar */}
                <AvailabilityCalendar
                  dailyRate={location.price}
                  onSelect={handleCalendarSelect}
                />

                {/* Book button */}
                <button
                  onClick={handleBook}
                  disabled={!bookingStart || !bookingEnd}
                  className={`w-full mt-4 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    bookingStart && bookingEnd
                      ? "bg-gold text-bg-primary hover:bg-gold-light cursor-pointer"
                      : "bg-border text-text-muted cursor-not-allowed"
                  }`}
                >
                  {location.instantBook
                    ? <><Zap size={15} /> Sofort buchen</>
                    : <><MessageSquare size={15} /> Buchung anfragen</>
                  }
                </button>
                <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1 mt-2">
                  <Shield size={11} /> Sichere Zahlung · Geld in Treuhand bis Bestätigung
                </p>
              </div>

              {/* Contact owner */}
              {location.ownerId ? (
                <InquiryForm
                  listingId={location.id}
                  listingTitle={location.title}
                  listingType="location"
                  ownerId={location.ownerId}
                  ownerName={location.ownerName ?? "Anbieter"}
                />
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
