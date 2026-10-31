"use client";
import MarketplaceOfferSummary from "@/components/MarketplaceOfferSummary";
import { useTranslations, useLocale } from "next-intl";
import { marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import { listingPriceLabel, type ListingPriceMetadata } from "@/lib/listing-price";


import { useState, useEffect } from "react";
import Link from "next/link";
import ContextBackLink from "@/components/ContextBackLink";
import {
  ArrowLeft, Star, CheckCircle,
  MapPin, Package, Truck, Pencil,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsSection from "@/components/ReviewsSection";
import ReportButton from "@/components/ReportButton";
import { ProductionCreditsDisplay } from "@/components/ProductionCredits";
import type { ProductionCredit } from "@/lib/production-credits";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import ListingProviderCard from "@/components/ListingProviderCard";
import type { ListingProvider } from "@/lib/listing-provider";

type Prop = {
  id: string;
  title: string;
  category: string;
  vendor: string;
  location: string;
  dailyRate: number;
  pricing?: ListingPriceMetadata;
  image: string;
  condition: string;
  era: string | null;
  delivery: boolean;
  focalPoint?: { x: number; y: number } | null;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  provider: ListingProvider;
  extra_images?: string[];
  productionCredits?: ProductionCredit[];
};


const conditionColors: Record<string, string> = {
  "Neuwertig": "text-success border-success/30 bg-success/10",
  "Sehr gut": "text-gold border-gold/30 bg-gold-subtle",
  "Gut": "text-text-secondary border-border bg-bg-elevated",
  "Akzeptabel": "text-text-muted border-border bg-bg-elevated",
};

export default function PropDetail({ prop }: { prop: Prop }) {
  const { user } = useUser();
  const market=useTranslations("MarketplaceOffer"),catalog=useTranslations("MarketplaceCatalog"),locale=useLocale();
  const isOwner = !!user && user.id === prop.ownerId;

  const [liveRating, setLiveRating] = useState<{ avg: number; count: number } | null>(null);
  const [myRating, setMyRating] = useState<number>(0);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    fetch(`/api/listing-ratings?ids=${prop.id}`)
      .then(r => r.json())
      .then(({ ratings, myRatings, eligible: elig }) => {
        if (ratings?.[prop.id]) setLiveRating(ratings[prop.id]);
        if (myRatings?.[prop.id]) setMyRating(myRatings[prop.id]);
        setEligible((elig ?? []).includes(prop.id));
      })
      .catch(() => {});
  }, [prop.id]);

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
        body: JSON.stringify({ listing_id: prop.id, owner_id: prop.ownerId, rating: star }),
      });
    } catch {
      setMyRating(prev);
    }
  };

  const images = [prop.image, ...(prop.extra_images ?? [])].filter(Boolean) as string[];

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContextBackLink href="/props" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-6">
          <ArrowLeft size={14} /> Zurück zu Requisiten & Verleih
        </ContextBackLink>

        <header data-offer-heading className="mb-6 min-w-0">
            <div className="min-w-0 space-y-3 mb-3">
              <h1 className="min-w-0 break-words font-display text-3xl font-bold leading-tight text-text-primary sm:text-4xl [overflow-wrap:anywhere]">
                {prop.title}
              </h1>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="max-w-full break-words rounded-full border border-border bg-bg-secondary px-2.5 py-1 text-xs text-text-muted [overflow-wrap:anywhere]">
                {marketplaceCategoryLabel(prop.category,catalog)}
              </span>
              {prop.era && (
                <span className="px-2.5 py-1 bg-gold-subtle border border-gold/20 text-gold text-xs rounded-full">
                  {prop.era}
                </span>
              )}
              <span className={`px-2.5 py-1 border text-xs rounded-full font-medium ${conditionColors[prop.condition] ?? conditionColors["Gut"]}`}>
                {prop.condition}
              </span>
              {prop.delivery && (
                <span className="px-2.5 py-1 bg-success/10 border border-success/20 text-success text-xs rounded-full flex items-center gap-1">
                  <Truck size={11} /> Lieferung verfügbar
                </span>
              )}
            </div>



            </div>



        </header>

        <ListingPhotoGallery images={images} title={prop.title} label="Artikelgalerie" focalPoint={prop.focalPoint} />

        <div className="flex gap-10 flex-col lg:flex-row">
          {/* LEFT */}
          <div className="flex-1 min-w-0">
            <div data-offer-actions className="mb-5 min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-11 [&_button]:min-w-11">
                {isOwner && (
                  <Link href={`/dashboard?tab=listings`}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/40 text-gold text-xs font-medium rounded-lg hover:bg-gold/10 transition-colors">
                    <Pencil size={12} /> Bearbeiten
                  </Link>
                )}
                <FavoriteButton
                  listingId={prop.id}
                  listingType="prop"
                  listingTitle={prop.title}
                  listingCity={prop.location}
                  listingPrice={prop.dailyRate}
                  listingImage={prop.image}
                />
                <ReportButton listingId={prop.id} />
              </div>
            <div className="flex min-w-0 flex-wrap items-center gap-3 break-words text-sm text-text-muted mb-4 [&_svg]:shrink-0 [overflow-wrap:anywhere]">
              <span className="flex items-center gap-1"><Package size={14} className="text-gold" /> {prop.vendor}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><MapPin size={14} className="text-gold" /> {prop.location}</span>
            </div>
            </div>

            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-3">Über diesen Artikel</h2>
              {prop.description ? (
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">{prop.description}</p>
              ) : (
                <p className="text-text-muted italic text-sm">Keine Beschreibung vorhanden.</p>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 py-4 border-y border-border mb-6">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} type="button"
                    onClick={() => handleRate(s)}
                    disabled={!canRate}
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
                <span className="text-text-muted text-sm">{canRate ? "Jetzt als Erste/r bewerten" : user && !isOwner ? "Erst anfragen, dann bewerten" : "Noch keine Bewertungen"}</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: market("mode"), value: listingPriceLabel(prop.dailyRate,prop.pricing,"/Tag",locale,market) },
                { label: "Zustand", value: prop.condition || "—" },
                { label: "Kategorie", value: marketplaceCategoryLabel(prop.category,catalog) },
                { label: "Abholung / Lieferung", value: prop.pricing?.marketplace ? prop.pricing.marketplace.fulfilment.map(value=>market(value)).join(" · ") || "—" : prop.delivery ? "Beides möglich" : "Nur Abholung" },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 bg-bg-secondary border border-border rounded-xl text-center">
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</div>
                  <div className="text-sm font-semibold text-text-primary">{value}</div>
                </div>
              ))}
            </div>

            <MarketplaceOfferSummary category={prop.category} price={prop.dailyRate} metadata={prop.pricing} />


            <ProductionCreditsDisplay credits={prop.productionCredits ?? []} heading="Bei diesen Produktionen im Einsatz" />

            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-4">Im Lieferumfang enthalten</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Artikel wie beschrieben, gereinigt und einsatzbereit",
                  "Vollständiger Zustandsbericht mit Fotos",
                  "Grundlegende Bedienungsanleitung",
                  "Anbieter-Kontakt während der Produktion",
                  "Rückgabeverpackung / Koffer (falls vorhanden)",
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
              <ReviewsSection
                targetId={prop.id}
                targetType="prop"
                targetName={prop.title}
              />
            </div>

            <ListingProviderCard provider={prop.provider} />
          </div>

          {/* BOOKING SIDEBAR */}
          <div className="lg:w-[360px] shrink-0">
            <div className="sticky top-20">
              <div className="bg-bg-secondary border border-border rounded-xl p-6">
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-3xl font-bold font-display text-text-primary">{listingPriceLabel(prop.dailyRate,prop.pricing,"/Tag",locale,market)}</span>

                </div>

                {prop.ownerId ? (
                  <InquiryForm
                    listingId={prop.id}
                    listingTitle={prop.title}
                    listingType="prop"
                    ownerId={prop.ownerId}
                    ownerName={prop.ownerName ?? "Anbieter"}
                  />
                ) : (
                  <div className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-text-secondary">Kontakt und Buchungsanfrage sind vorübergehend nicht verfügbar, weil der Anbieter noch nicht zugeordnet ist.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
