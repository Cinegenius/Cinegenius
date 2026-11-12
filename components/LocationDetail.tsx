"use client";
import dynamic from "next/dynamic";
import { readPublicLocationArea } from "@/lib/location-privacy";
import { listingPriceLabel } from "@/lib/listing-price";
import { locationRoomLabel } from "@/lib/location-rooms";


import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations , useLocale } from "next-intl";
import { bookingDateKey } from "@/lib/booking-request";
import ContextBackLink from "@/components/ContextBackLink";
import {
  MapPin, Star, CheckCircle, Users, Zap, ArrowLeft,
  Shield, MessageSquare,
  Wifi, Car, Zap as Power, Coffee, DoorOpen, Truck,
  Thermometer, Volume2, Wind, Accessibility, ArrowUpDown,
  FlipHorizontal, Pencil, Maximize2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import ReviewsSection from "@/components/ReviewsSection";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReportButton from "@/components/ReportButton";
import { ProductionCreditsDisplay } from "@/components/ProductionCredits";
import { parseProductionCredits } from "@/lib/production-credits";
import ListingProviderCard from "@/components/ListingProviderCard";
import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import type { ListingProvider } from "@/lib/listing-provider";

interface LocationMeta {
  sqm?: number | null;
  ceiling_height_m?: number | null;
  max_crew?: number | null;
  indoor_outdoor?: "innen" | "außen" | "beides" | string;
  power_available?: boolean;
  power_details?: string | null;
  parking_spots?: number | null;
  amenities?: string[];
  rooms?: string[];
  natural_light?: boolean;
  blackout_possible?: boolean;
  loading_access?: boolean;
  access_notes?: string | null;
  shooting_hours?: string | null;
  availability_notes?: string | null;
  production_credits?: unknown;
}

const LocationAreaMap = dynamic(() => import("@/components/LocationMap"), { ssr: false });
const ignoreMapChange = () => {};

type Location = {
  id: string; title: string; type: string; city: string;
  lat: number | null; lng: number | null;
  price: number; priceUnit: string; rating: number; reviews: number;
  image: string; tags: string[]; instantBook: boolean; verified: boolean;
  description?: string;
  ownerId?: string; ownerName?: string;
  provider: ListingProvider;
  metadata?: LocationMeta | null;
  blocked_dates?: string[];
  floor_plan_url?: string | null;
  extra_images?: string[];
  focalPoint?: { x: number; y: number } | null;
  // Legacy fields
  sqft?: number; capacity?: number;
};



const AMENITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  wifi: Wifi, restrooms: DoorOpen, green_room: Users, loading_bay: Truck,
  kitchen: Coffee, changing_room: Users, generator: Power, sound_insulated: Volume2,
  ac: Wind, heating: Thermometer, elevator: ArrowUpDown, disabled_access: Accessibility,
};

function getLocalizedAMENITY_LABELS(translate: (key: string) => string): Record<string, string> { return ({
  wifi: translate("Ui.text_337253f2e8d4d1"), restrooms: translate("Ui.text_800e5612baf938"), green_room: translate("Ui.text_cd4db9724f65a4"),
  loading_bay: translate("Ui.text_7c8dc1fd90b6af"), kitchen: translate("Ui.text_a9ec872e661915"), changing_room: translate("Ui.text_6bb28e219f8023"),
  generator: translate("Ui.text_1ade60abe93f5c"), sound_insulated: translate("Ui.text_e60eee0f0e49fe"), ac: translate("Ui.text_ea0e1904f1726c"),
  heating: translate("Ui.text_744b4873e74c5c"), elevator: translate("Ui.text_02861aeff786cd"), disabled_access: translate("Ui.text_4e0b1087084fdb"),
}); }

export default function LocationDetail({ location }: { location: Location }) {
  const uiPriceLocale = useLocale();
  const uiPriceText = useTranslations("MarketplaceOffer");

  const uiText = useTranslations();
  const AMENITY_LABELS = getLocalizedAMENITY_LABELS(uiText);


  const bookingCopy = useTranslations("BookingRequest");
  const { user } = useUser();
  const isOwner = !!user && user.id === location.ownerId;

  const [liveRating, setLiveRating] = useState<{ avg: number; count: number } | null>(() => ({
    avg: location.rating,
    count: location.reviews,
  }));
  const [myRating, setMyRating] = useState<number>(0);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    fetch(`/api/listing-ratings?ids=${location.id}`)
      .then(r => r.json())
      .then(({ ratings, myRatings, eligible: elig }) => {
        if (ratings?.[location.id]) setLiveRating(ratings[location.id]);
        if (myRatings?.[location.id]) setMyRating(myRatings[location.id]);
        setEligible((elig ?? []).includes(location.id));
      })
      .catch(() => {});
  }, [location.id]);

  const canRate = !!user && !isOwner && eligible;
  const ratingSummary = liveRating ?? { avg: location.rating, count: location.reviews };

  const handleRate = async (star: number) => {
    if (!canRate) return;
    const prev = myRating;
    const prevSummary = ratingSummary;
    setMyRating(star);
    setLiveRating(r => {
      const cur = r ?? { avg: location.rating, count: location.reviews };
      const newCount = prev ? cur.count : cur.count + 1;
      const newSum = prev ? cur.avg * cur.count - prev + star : cur.avg * cur.count + star;
      return { avg: Math.round((newSum / newCount) * 10) / 10, count: newCount };
    });
    try {
      const response = await fetch("/api/listing-ratings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: location.id, owner_id: location.ownerId, rating: star }),
      });
      if (!response.ok) throw new Error(uiText("Ui.text_1463df4649db2c"));
    } catch {
      setMyRating(prev);
      setLiveRating(prevSummary);
    }
  };
  const [bookingStart, setBookingStart] = useState<Date | null>(null);
  const [bookingEnd, setBookingEnd]     = useState<Date | null>(null);
  const [bookingDays, setBookingDays]   = useState(0);
  const router = useRouter();

  const meta = location.metadata ?? {};
  const amenities: string[] = meta.amenities ?? [];
  const productionCredits = parseProductionCredits(meta.production_credits);

  // Images: main + extra
  const allImages = [...new Set([location.image, ...(location.extra_images ?? [])].filter((image): image is string => typeof image === "string" && !!image.trim()))];

  const handleCalendarSelect = (start: Date, end: Date, days: number) => {
    setBookingStart(start); setBookingEnd(end); setBookingDays(days);
  };

  const handleBook = () => {
    if (!bookingStart || !bookingEnd) return;
    router.push(
      `/booking/checkout?type=location&id=${location.id}` +
      `&title=${encodeURIComponent(location.title)}` +
      `&price=${location.price}&days=${bookingDays}` +
      `&startDate=${bookingDateKey(bookingStart)}` +
      `&endDate=${bookingDateKey(bookingEnd)}`
    );
  };

  const lageLabel = meta.indoor_outdoor === "beides" ? uiText("locations.filterInnenAussen")
    : meta.indoor_outdoor === "außen" ? uiText("locations.filterAussen")
    : meta.indoor_outdoor === "innen" ? uiText("locations.filterInnen")
    : null;

  return (
    <div className="pt-16 min-h-screen">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <ContextBackLink href="/locations" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-4">{uiText.rich("Ui.text_bbd0c5ecf20e22", { part1: () => (<ArrowLeft size={14} />) })}</ContextBackLink>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <ListingPhotoGallery
          images={allImages}
          title={location.title}
          label={uiText("Ui.text_e6ba89e6f89b71")}
          alt={uiText("Ui.text_46e748668f5e7a", { value1: String(location.title) })}
          focalPoint={location.focalPoint}
          fallback={<MapPin size={42} aria-hidden="true" />}
        />
      </div>

      {/* Content + sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 lg:pb-20">
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
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 border border-success/20 text-success text-xs rounded">{uiText.rich("Ui.text_712de43869af36", { part1: () => (<CheckCircle size={11} />) })}</span>
                  )}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-1">{location.title}</h1>
                <p className="text-text-secondary flex items-center gap-1.5">{uiText.rich("Ui.text_97a14078c43165", { part1: () => (<MapPin size={14} className="text-gold" />), value2: () => (location.city), value3: () => (location.type) })}</p>
              </div>
              <div className="flex items-center gap-1">
                {isOwner && (
                  <Link href={`/dashboard?tab=listings`}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/40 text-gold text-xs font-medium rounded-lg hover:bg-gold/10 transition-colors">{uiText.rich("Ui.text_603ead2ae843f0", { part1: () => (<Pencil size={12} />) })}</Link>
                )}
                <FavoriteButton listingId={location.id} listingType="location" listingTitle={location.title}
                  listingCity={location.city} listingPrice={location.price} listingImage={location.image} />
                <ReportButton listingId={location.id} />
              </div>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 py-4 border-b border-border mb-6">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <button key={s} type="button"
                    onClick={() => handleRate(s)}
                    disabled={!canRate}
                    className={`transition-transform ${canRate ? "hover:scale-110 active:scale-125" : "cursor-default"}`}
                    title={!user ? uiText("Ui.text_0e87ce8126b5d8") : isOwner ? uiText("Ui.text_f05767e24ef119") : !eligible ? uiText("Ui.text_c05dd8c953b77c") : uiText("Ui.text_8dc8762909a7e9", { value1: String(s), value2: String(s !== 1 ? "e" : "") })}>
                    <Star size={18} className={`transition-colors ${s <= (myRating || Math.round(ratingSummary.avg)) ? "text-gold fill-gold" : "text-border fill-border"}`} />
                  </button>
                ))}
              </div>
              {ratingSummary.count > 0 ? (
                <>{uiText.rich("Ui.text_eda0715004d2ec", { value2: () => (ratingSummary.avg.toFixed(1)), part1: chunks => (<span className="font-semibold text-text-primary">{chunks}</span>), value4: () => (ratingSummary.count), count5: ratingSummary.count, part3: chunks => (<span className="text-text-muted text-sm">{chunks}</span>) })}</>
              ) : (
                <span className="text-text-muted text-sm">{canRate ? uiText("Ui.text_a375a02f805fef") : user && !isOwner ? uiText("Ui.text_c05dd8c953b77c") : uiText("home.reviewsEmpty")}</span>
              )}
            </div>

            {readPublicLocationArea(location.metadata) && <section className="mb-8 space-y-3">
              <h2 className="text-lg font-semibold text-text-primary">{uiText("locationPrivacy.publicArea")}</h2>
              <div className="h-80"><LocationAreaMap readOnly locations={[{ ...location, metadata: location.metadata as Record<string, unknown> }]} activeId={null} onHover={ignoreMapChange} userLocation={null} radiusKm={0} appliedBounds={null} onApplyBounds={ignoreMapChange} /></div>
            </section>}
            {/* Key specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {(() => {
                const specIcons: Record<string, React.ReactNode> = {
                  [uiText("Ui.text_858a56aaf92c35")]: <Maximize2 size={14} className="text-gold" />,
                  [uiText("Ui.text_2097c8965823f2")]: <ArrowUpDown size={14} className="text-gold" />,
                  [uiText("Ui.text_8c95b59cdc03d1")]: <Users size={14} className="text-gold" />,
                  [uiText("AdminReview.fields.parking_spots")]: <Car size={14} className="text-gold" />,
                  [uiText("Ui.text_295029201d603e")]: <MapPin size={14} className="text-gold" />,
                  [uiText("setup.copy41")]: <Zap size={14} className="text-gold" />,
                };
                return [
                  meta.sqm && { label: uiText("Ui.text_858a56aaf92c35"), value: `${meta.sqm} m²` },
                  meta.ceiling_height_m && { label: uiText("Ui.text_2097c8965823f2"), value: `${meta.ceiling_height_m} m` },
                  meta.max_crew && { label: uiText("Ui.text_8c95b59cdc03d1"), value: uiText("Ui.text_c245b9e060f31e", { value1: String(meta.max_crew) }) },
                  meta.parking_spots != null && { label: uiText("AdminReview.fields.parking_spots"), value: String(meta.parking_spots) },
                  lageLabel && { label: uiText("Ui.text_295029201d603e"), value: lageLabel },
                  meta.natural_light && { label: uiText("AdminReview.fields.natural_light"), value: uiText("Ui.text_35d918eac1e8e2") },
                  meta.blackout_possible && { label: uiText("Ui.text_71f7048b9c1392"), value: uiText("Ui.text_00cc54c4d91fa1") },
                  meta.loading_access && { label: uiText("Ui.text_78f3462ff79135"), value: uiText("Ui.text_6f775dde6e8764") },
                  location.price > 0 && { label: uiText("setup.copy41"), value: listingPriceLabel(location.price,location.metadata, undefined, uiPriceLocale, uiPriceText) },
                ].filter((x): x is { label: string; value: string } => !!x).map(({ label, value }) => (
                  <div key={label} className="p-3 bg-bg-secondary border border-border rounded-xl flex flex-col items-center gap-1.5 text-center">
                    {specIcons[label] ?? null}
                    <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
                    <div className="text-sm font-semibold text-text-primary">{value}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Description */}
            {location.description && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">{uiText("Ui.text_802131a6b63644")}</h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{location.description}</p>
              </div>
            )}

            <ProductionCreditsDisplay credits={productionCredits} heading={uiText("Ui.text_308ba00501fe58")} />

            {/* Strom */}
            {meta.power_available && (
              <div className="mb-6 flex items-start gap-3 p-4 bg-bg-secondary border border-border rounded-xl">
                <Power size={16} className="text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{uiText("Ui.text_ef4eb59f4ec025")}</p>
                  {meta.power_details && <p className="text-xs text-text-muted mt-0.5">{meta.power_details}</p>}
                </div>
              </div>
            )}

            {/* Ausstattung */}
            {amenities.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-4">{uiText("companies.groupAusstattung")}</h2>
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

            {Array.isArray(meta.rooms) && meta.rooms.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-4">{uiText("Ui.text_78ff90932bddd6")}</h2>
                <div className="flex flex-wrap gap-2">
                  {meta.rooms.map((room) => (
                    <span key={room} className="rounded-full border border-border bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary">
                      {locationRoomLabel(room, location.type, uiText)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(meta.shooting_hours || meta.access_notes || meta.availability_notes) && (
              <div className="mb-8 rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">{uiText("Ui.text_c34fa41b7de219")}</h2>
                <dl className="space-y-3 text-sm">
                  {meta.shooting_hours && <div><dt className="text-xs text-text-muted">{uiText("AdminReview.fields.shooting_hours")}</dt><dd className="mt-0.5 text-text-secondary">{meta.shooting_hours}</dd></div>}
                  {meta.access_notes && <div><dt className="text-xs text-text-muted">{uiText("Ui.text_9c68248af7b8fc")}</dt><dd className="mt-0.5 text-text-secondary">{meta.access_notes}</dd></div>}
                  {meta.availability_notes && <div><dt className="text-xs text-text-muted">{uiText("Ui.text_e6c48894da484b")}</dt><dd className="mt-0.5 whitespace-pre-line text-text-secondary">{meta.availability_notes}</dd></div>}
                </dl>
              </div>
            )}

            {/* Grundriss */}
            {location.floor_plan_url && (
              <div className="mb-8">
                <h2 className="font-display text-xl font-bold text-text-primary mb-4">{uiText.rich("Ui.text_17f586ed48be9a", { part1: () => (<FlipHorizontal size={18} className="inline mr-2 text-gold" />) })}</h2>
                <a href={location.floor_plan_url} target="_blank" rel="noreferrer" className="block w-full max-w-lg overflow-hidden rounded-xl border border-border hover:opacity-90 transition-opacity" aria-label={uiText("Ui.text_4a0d5497ac0eb2")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={location.floor_plan_url} alt={uiText("Ui.text_4a0d5497ac0eb2")} className="max-h-96 w-full object-contain" />
                </a>
              </div>
            )}

            {/* Reviews */}
            <ReviewsSection targetId={location.id} targetType="location" targetName={location.title} />
          </div>

          {/* Booking sidebar */}
          <div className="lg:w-[360px] shrink-0">
            <div id="booking-sidebar" className="sticky top-20 space-y-4">
              <div className="bg-bg-secondary border border-border rounded-xl p-5">
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold font-display text-text-primary">
                    {listingPriceLabel(location.price,location.metadata, undefined, uiPriceLocale, uiPriceText)}
                  </span>

                </div>
                <div className="flex items-center gap-1.5 mb-5">
                  {ratingSummary.count > 0 ? (
                    <>{uiText.rich("Ui.text_5e2e88ffc13e83", { part1: () => (<Star size={13} className="text-gold fill-gold" />), value3: () => (ratingSummary.avg.toFixed(1)), part2: chunks => (<span className="text-sm font-semibold text-text-primary">{chunks}</span>), value5: () => (ratingSummary.count), count6: ratingSummary.count, part4: chunks => (<span className="text-text-muted text-sm">{chunks}</span>) })}</>
                  ) : <span className="text-text-muted text-sm">{uiText("home.reviewsEmpty")}</span>}
                </div>

                <AvailabilityCalendar
                  dailyRate={location.price}
                  onSelect={handleCalendarSelect}
                  onReset={() => {setBookingStart(null); setBookingEnd(null); setBookingDays(0);}}
                  blockedDates={location.blocked_dates}
                />

                <button onClick={handleBook} disabled={!location.ownerId || !bookingStart || !bookingEnd}
                  className={`w-full mt-4 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    location.ownerId && bookingStart && bookingEnd ? "bg-gold text-bg-primary hover:bg-gold-light cursor-pointer" : "bg-border text-text-muted cursor-not-allowed"
                  }`}>
                  <MessageSquare size={15} /> {bookingCopy("request")}
                </button>
                <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1 mt-2">
                  <Shield size={11} /> {bookingCopy("directTerms")}
                </p>
              </div>

              <ListingProviderCard provider={location.provider} />
              {location.ownerId ? <InquiryForm listingId={location.id} listingTitle={location.title} listingType="location"
                ownerId={location.ownerId} ownerName={location.ownerName ?? "Anbieter"} /> : <p className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-xs leading-5 text-text-secondary">{uiText("Ui.text_5a8432095e77f2")}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-primary/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-lg font-bold font-display text-text-primary">
            {listingPriceLabel(location.price,location.metadata, undefined, uiPriceLocale, uiPriceText)}

          </div>
          <div className="flex items-center gap-1">
            {ratingSummary.count > 0 ? (
              <>{uiText.rich("Ui.text_27e8dc5cef9291", { part1: () => (<Star size={11} className="text-gold fill-gold" />), value3: () => (ratingSummary.avg.toFixed(1)), value4: () => (ratingSummary.count), count5: ratingSummary.count, part2: chunks => (<span className="text-xs text-text-secondary">{chunks}</span>) })}</>
            ) : <span className="text-xs text-text-secondary">{uiText("home.reviewsEmpty")}</span>}
          </div>
        </div>
        <button
          onClick={() => {
            const sidebar = document.getElementById("booking-sidebar");
            if (sidebar) sidebar.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-gold text-bg-primary font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gold-light transition-colors shrink-0"
        >
          {location.instantBook ? uiText("Ui.text_4a1f597b972d57") : uiText("Ui.text_5dfb5bcd667e78")}
        </button>
      </div>
    </div>
  );
}
