"use client";

import { useTranslations } from "next-intl";
import { animalSpecies } from "@/lib/animal-taxonomy";
import MediaImage from "@/components/MediaImage";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Star, MapPin,
  Truck, Pencil, PawPrint, Users,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsSection from "@/components/ReviewsSection";
import ReportButton from "@/components/ReportButton";

import ListingPhotoGallery from "@/components/ListingPhotoGallery";

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
  ownerHref?: string | null;
  canEdit?: boolean;
  privatePreview?: boolean;
  extra_images?: string[];
};

export default function TiereDetail({ animal }: { animal: Animal }) {
  const uiText = useTranslations();

  const { user } = useUser();
  const animals = useTranslations("FilmAnimals");

  const isOwner = animal.canEdit === true || (!!user && user.id === animal.ownerId);

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

  const images = [animal.image, ...(animal.extra_images ?? [])].filter(Boolean) as string[];

  return (
    <div className="pt-16 min-h-screen">
      {animal.privatePreview && <p role="status" className="site-container pt-8 text-sm text-gold">{animals("previewNotice")}</p>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/tiere" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-6">
          <ArrowLeft size={14} /> {animals("back")}
        </Link>

        <ListingPhotoGallery
          images={images}
          title={animal.title}
          label={animals("gallery")}
          focalPoint={animal.focalPoint}
          fallback={<PawPrint size={48} className="text-text-muted/20" />}
        />

        <div className="flex gap-10 flex-col lg:flex-row">
          {/* LEFT */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2.5 py-1 bg-bg-secondary border border-border text-text-muted text-xs rounded-full flex items-center gap-1">
                <PawPrint size={11} /> {animalSpecies(animal.category) ? animals(`species.${animalSpecies(animal.category)!.id}`) : animal.category}
              </span>
              {animal.trainingLevel && (
                <span className={`px-2.5 py-1 border text-xs rounded-full font-medium ${TRAINING_COLORS[animal.trainingLevel] ?? TRAINING_COLORS["Grundgehorsam"]}`}>
                  {animal.trainingLevel}
                </span>
              )}
              {animal.delivery && (
                <span className="px-2.5 py-1 bg-success/10 border border-success/20 text-success text-xs rounded-full flex items-center gap-1">{uiText.rich("Ui.text_912a49918ec6a8", { part1: () => (<Truck size={11} />) })}</span>
              )}
              {animal.handlerIncluded && (
                <span className="px-2.5 py-1 bg-bg-secondary border border-border text-text-secondary text-xs rounded-full flex items-center gap-1">
                  <Users size={11} className="text-gold" /> {animals("handler")}
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">{animal.title}</h1>
              <div className="flex items-center gap-1 shrink-0 mt-1">
                {isOwner && (
                  <Link href="/dashboard?tab=listings"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/40 text-gold text-xs font-medium rounded-lg hover:bg-gold/10 transition-colors">{uiText.rich("Ui.text_603ead2ae843f0", { part1: () => (<Pencil size={12} />) })}</Link>
                )}
                <FavoriteButton listingId={animal.id} listingType="animal"
                  listingTitle={animal.title} listingCity={animal.location}
                  listingPrice={animal.dailyRate} listingImage={animal.image} />
                <ReportButton listingId={animal.id} />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
              <MapPin size={14} className="text-gold" /> {animal.location || uiText("FilmAnimals.locationRequest")}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 py-4 border-y border-border mb-6">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} type="button" onClick={() => handleRate(s)} disabled={!canRate}
                    className={`transition-transform ${canRate ? "hover:scale-110 active:scale-125" : "cursor-default"}`}
                    title={!user ? uiText("Ui.text_0e87ce8126b5d8") : isOwner ? uiText("Ui.text_288d8b63c75378") : !eligible ? uiText("Ui.text_c05dd8c953b77c") : uiText("Ui.text_8dc8762909a7e9", { value1: String(s), value2: String(s !== 1 ? "e" : "") })}>
                    <Star size={18} className={`transition-colors ${s <= (myRating || Math.round(liveRating?.avg ?? 0)) ? "text-gold fill-gold" : "text-border fill-border"}`} />
                  </button>
                ))}
              </div>
              {liveRating && liveRating.count > 0 ? (
                <>{uiText.rich("Ui.text_eda0715004d2ec", { value2: () => (liveRating.avg.toFixed(1)), part1: chunks => (<span className="font-semibold text-text-primary">{chunks}</span>), value4: () => (liveRating.count), count5: liveRating.count, part3: chunks => (<span className="text-text-muted text-sm">{chunks}</span>) })}</>
              ) : (
                <span className="text-text-muted text-sm">
                  {canRate ? uiText("Ui.text_a375a02f805fef") : user && !isOwner ? uiText("Ui.text_c05dd8c953b77c") : uiText("home.reviewsEmpty")}
                </span>
              )}
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: animals("speciesField"), value: animalSpecies(animal.category) ? animals(`species.${animalSpecies(animal.category)!.id}`) : animal.category, icon: <PawPrint size={14} className="text-gold" /> },
                { label: animals("count"), value: animal.count, icon: <Users size={14} className="text-gold" /> },
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
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">{animals("about")}</h2>
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{animal.description}</p>
              </div>
            )}

            {/* Special skills */}
            {animal.specialSkills && (
              <div className="mb-8 p-4 bg-bg-secondary border border-border rounded-xl">
                <h2 className="font-display text-base font-bold text-text-primary mb-2 flex items-center gap-2">
                  <Star size={15} className="text-gold" /> {animals("skills")}
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">{animal.specialSkills}</p>
              </div>
            )}

            <p className="mb-8 text-sm leading-6 text-text-secondary">{animals("conditions")}</p>

            <div className="mb-8">
              <ReviewsSection targetId={animal.id} targetType="animal" targetName={animal.title} />
            </div>

            {/* Owner card */}
            {animal.ownerHref ? (
              <Link href={animal.ownerHref}
                className="group p-5 bg-bg-secondary border border-border rounded-xl flex items-center gap-4 hover:border-gold/40 hover:bg-bg-elevated transition-all">
                <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 overflow-hidden flex items-center justify-center shrink-0">
                  {animal.ownerAvatar
                    ? <MediaImage width={48} height={48} src={animal.ownerAvatar} alt={animal.ownerName ?? ""} className="w-full h-full object-cover" />
                    : <PawPrint size={20} className="text-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary group-hover:text-gold transition-colors">{animal.ownerName}</p>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1"><MapPin size={11} /> {animal.location}</p>
                </div>
                <span className="text-xs text-text-muted group-hover:text-gold transition-colors shrink-0">{animals("viewProvider")}</span>
              </Link>
            ) : (
              <div className="p-5 bg-bg-secondary border border-border rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <PawPrint size={20} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary">{animal.ownerName ?? uiText("profile.catAnbieterLabel")}</p>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1"><MapPin size={11} /> {animal.location}</p>
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="lg:w-[360px] shrink-0">
            <div className="sticky top-20">
              <div className="bg-bg-secondary border border-border rounded-xl p-6">
                <h2 className="mb-4 font-display text-2xl font-bold text-text-primary">{animals("inquire")}</h2>

                <p className="mb-4 text-xs leading-5 text-text-muted">{animals("conditions")}</p>
                {animal.ownerId && !isOwner ? <InquiryForm listingId={animal.id} listingTitle={animal.title} listingType="animal" ownerId={animal.ownerId} ownerName={animal.ownerName ?? ""} /> : !animal.ownerId ? <p className="text-sm text-text-muted">{animals("noProvider")}</p> : null}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
