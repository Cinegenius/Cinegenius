"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Star, CheckCircle, MapPin, Shield,
  Truck, Expand, Pencil, PawPrint, Users, Zap,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsSection from "@/components/ReviewsSection";
import ReportButton from "@/components/ReportButton";

const Lightbox = dynamic(() => import("@/components/Lightbox"), { ssr: false });

const TRAINING_COLORS: Record<string, string> = {
  "Kinoprofi": "text-gold border-gold/30 bg-gold-subtle",
  "Erfahren": "text-success border-success/30 bg-success/10",
  "Grundgehorsam": "text-text-secondary border-border bg-bg-elevated",
  "Ungeübt": "text-text-muted border-border bg-bg-elevated",
};

type Animal = {
  id: string;
  title: string;
  category: string;
  location: string;
  dailyRate: number;
  image: string;
  trainingLevel: string | null;
  handlerIncluded: boolean;
  count: string;
  specialSkills: string | null;
  delivery: boolean;
  focalPoint?: { x: number; y: number } | null;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ownerAvatar?: string | null;
  ownerSlug?: string | null;
  extra_images?: string[];
};

export default function TiereDetail({ animal }: { animal: Animal }) {
  const { user } = useUser();
  const isOwner = !!user && user.id === animal.ownerId;

  const [liveRating, setLiveRating] = useState<{ avg: number; count: number } | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    fetch(`/api/listing-ratings?ids=${animal.id}`)
      .then(r => r.json())
      .then(({ ratings, myRatings, eligible: elig }) => {
        if (ratings?.[animal.id]) setLiveRating(ratings[animal.id]);
        if (myRatings?.[animal.id]) setMyRating(myRatings[animal.id]);
        setEligible((elig ?? []).includes(animal.id));
      })
      .catch(() => {});
  }, [animal.id]);

  const canRate = !!user && !isOwner && eligible;

  const handleRate = async (star: number) => {
    if (!canRate) return;
    const prev = myRating;
    setMyRating(star);
    setLiveRating(r => {
      const cur = r ?? { avg: 0, count: 0 };
      const newCount = prev ? cur.count : cur.count + 1;
      const newSum = prev ? cur.avg * cur.count - prev + star : cur.avg * cur.count + star;
      return { avg: Math.round((newSum / newCount) * 10) / 10, count: newCount };
    });
    try {
      await fetch("/api/listing-ratings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: animal.id, owner_id: animal.ownerId, rating: star }),
      });
    } catch {
      setMyRating(prev);
    }
  };

  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const images = [animal.image, ...(animal.extra_images ?? [])].filter(Boolean) as string[];

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/tiere" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-6">
          <ArrowLeft size={14} /> Zurück zu Film-Tieren
        </Link>

        {/* Gallery */}
        <div className="relative grid grid-cols-4 gap-2 rounded-xl overflow-hidden h-72 sm:h-96 mb-8">
          <div className="col-span-2 relative overflow-hidden cursor-pointer"
            onClick={() => { setActiveImg(0); setLightboxOpen(true); }}>
            {images[0] ? (
              <Image src={images[0]} alt={animal.title} fill priority
                className="object-cover hover:scale-105 transition-transform duration-500"
                style={{ objectPosition: animal.focalPoint ? `${animal.focalPoint.x}% ${animal.focalPoint.y}%` : "50% 40%" }}
                sizes="50vw" />
            ) : (
              <div className="w-full h-full bg-bg-elevated flex items-center justify-center">
                <PawPrint size={48} className="text-text-muted/20" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {images.slice(1).map((img, i) => (
                <div key={i} className={`relative overflow-hidden cursor-pointer rounded-sm ${i === 2 ? "col-span-2 h-24" : ""}`}
                  onClick={() => { setActiveImg(i + 1); setLightboxOpen(true); }}>
                  <Image src={img} alt="" fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="25vw" />
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all backdrop-blur-sm">
            <Expand size={13} /> Alle Fotos anzeigen
          </button>
        </div>

        {lightboxOpen && (
          <Lightbox images={images} activeIndex={activeImg} alt={animal.title}
            onClose={() => setLightboxOpen(false)}
            onPrev={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
            onNext={() => setActiveImg((i) => (i + 1) % images.length)} />
        )}

        <div className="flex gap-10 flex-col lg:flex-row">
          {/* LEFT */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2.5 py-1 bg-bg-secondary border border-border text-text-muted text-xs rounded-full flex items-center gap-1">
                <PawPrint size={11} /> {animal.category}
              </span>
              {animal.trainingLevel && (
                <span className={`px-2.5 py-1 border text-xs rounded-full font-medium ${TRAINING_COLORS[animal.trainingLevel] ?? TRAINING_COLORS["Grundgehorsam"]}`}>
                  {animal.trainingLevel}
                </span>
              )}
              {animal.delivery && (
                <span className="px-2.5 py-1 bg-success/10 border border-success/20 text-success text-xs rounded-full flex items-center gap-1">
                  <Truck size={11} /> Lieferung möglich
                </span>
              )}
              {animal.handlerIncluded && (
                <span className="px-2.5 py-1 bg-bg-secondary border border-border text-text-secondary text-xs rounded-full flex items-center gap-1">
                  <Users size={11} className="text-gold" /> Handler inklusive
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">{animal.title}</h1>
              <div className="flex items-center gap-1 shrink-0 mt-1">
                {isOwner && (
                  <Link href="/dashboard?tab=listings"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/40 text-gold text-xs font-medium rounded-lg hover:bg-gold/10 transition-colors">
                    <Pencil size={12} /> Bearbeiten
                  </Link>
                )}
                <FavoriteButton listingId={animal.id} listingType="animal"
                  listingTitle={animal.title} listingCity={animal.location}
                  listingPrice={animal.dailyRate} listingImage={animal.image} />
                <ReportButton listingId={animal.id} />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
              <MapPin size={14} className="text-gold" /> {animal.location || "Standort auf Anfrage"}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 py-4 border-y border-border mb-6">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} type="button" onClick={() => handleRate(s)} disabled={!canRate}
                    className={`transition-transform ${canRate ? "hover:scale-110 active:scale-125" : "cursor-default"}`}
                    title={!user ? "Einloggen zum Bewerten" : isOwner ? "Eigenes Inserat" : !eligible ? "Erst anfragen, dann bewerten" : `${s} Stern${s !== 1 ? "e" : ""}`}>
                    <Star size={18} className={`transition-colors ${s <= (myRating || Math.round(liveRating?.avg ?? 0)) ? "text-gold fill-gold" : "text-border fill-border"}`} />
                  </button>
                ))}
              </div>
              {liveRating && liveRating.count > 0 ? (
                <>
                  <span className="font-semibold text-text-primary">{liveRating.avg.toFixed(1)}</span>
                  <span className="text-text-muted text-sm">({liveRating.count} Bewertung{liveRating.count !== 1 ? "en" : ""})</span>
                </>
              ) : (
                <span className="text-text-muted text-sm">
                  {canRate ? "Jetzt als Erste/r bewerten" : user && !isOwner ? "Erst anfragen, dann bewerten" : "Noch keine Bewertungen"}
                </span>
              )}
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Tierart", value: animal.category, icon: <PawPrint size={14} className="text-gold" /> },
                { label: "Anzahl", value: animal.count, icon: <Users size={14} className="text-gold" /> },
                { label: "Tagesrate", value: animal.dailyRate > 0 ? `${animal.dailyRate.toLocaleString()} €` : "Auf Anfrage", icon: <Zap size={14} className="text-gold" /> },
                { label: "Lieferung", value: animal.delivery ? "Möglich" : "Nur Abholung", icon: <Truck size={14} className="text-gold" /> },
              ].map(({ label, value, icon }) => (
                <div key={label} className="p-4 bg-bg-secondary border border-border rounded-xl text-center">
                  <div className="flex justify-center mb-1">{icon}</div>
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</div>
                  <div className="text-sm font-semibold text-text-primary">{value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {animal.description && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">Über dieses Tier</h2>
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{animal.description}</p>
              </div>
            )}

            {/* Special skills */}
            {animal.specialSkills && (
              <div className="mb-8 p-4 bg-bg-secondary border border-border rounded-xl">
                <h2 className="font-display text-base font-bold text-text-primary mb-2 flex items-center gap-2">
                  <Star size={15} className="text-gold" /> Besondere Fähigkeiten
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">{animal.specialSkills}</p>
              </div>
            )}

            {/* What's included */}
            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-4">Im Lieferumfang</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Tier wie beschrieben, gepflegt und einsatzbereit",
                  ...(animal.handlerIncluded ? ["Professioneller Handler vor Ort"] : []),
                  "Grundlegende Verhaltensanweisungen",
                  "Anbieter-Kontakt während der Produktion",
                  "Digitaler Mietvertrag",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-8">
              <ReviewsSection targetId={animal.id} targetType="animal" targetName={animal.title} />
            </div>

            {/* Owner card */}
            {animal.ownerSlug ? (
              <Link href={`/profile/${animal.ownerSlug}`}
                className="group p-5 bg-bg-secondary border border-border rounded-xl flex items-center gap-4 hover:border-gold/40 hover:bg-bg-elevated transition-all">
                <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 overflow-hidden flex items-center justify-center shrink-0">
                  {animal.ownerAvatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={animal.ownerAvatar} alt={animal.ownerName} className="w-full h-full object-cover" />
                    : <PawPrint size={20} className="text-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary group-hover:text-gold transition-colors">{animal.ownerName}</p>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1"><MapPin size={11} /> {animal.location}</p>
                </div>
                <span className="text-xs text-text-muted group-hover:text-gold transition-colors shrink-0">Profil →</span>
              </Link>
            ) : (
              <div className="p-5 bg-bg-secondary border border-border rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <PawPrint size={20} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary">{animal.ownerName ?? "Anbieter"}</p>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1"><MapPin size={11} /> {animal.location}</p>
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="lg:w-[360px] shrink-0">
            <div className="sticky top-20">
              <div className="bg-bg-secondary border border-border rounded-xl p-6">
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-3xl font-bold font-display text-text-primary">
                    {animal.dailyRate > 0 ? `${animal.dailyRate.toLocaleString()} €` : "Auf Anfrage"}
                  </span>
                  {animal.dailyRate > 0 && <span className="text-text-muted mb-1">/Tag</span>}
                </div>

                {animal.ownerId ? (
                  <InquiryForm listingId={animal.id} listingTitle={animal.title}
                    listingType="animal" ownerId={animal.ownerId}
                    ownerName={animal.ownerName ?? "Anbieter"} />
                ) : (
                  <div className="py-8 text-center text-text-muted text-sm">Kein Anbieter verknüpft.</div>
                )}

                <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1 mt-4">
                  <Shield size={11} /> Sichere Zahlung · Keine Belastung vor Bestätigung
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
