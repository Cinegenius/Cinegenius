import { marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import { getLocale, getTranslations } from "next-intl/server";
import MarketplaceOfferSummary from "@/components/MarketplaceOfferSummary";
import { listingPriceLabel, listingPriceMetadata, listingStructuredOffers } from "@/lib/listing-price";
import Link from "next/link";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { auth } from "@clerk/nextjs/server";
import {
  MapPin, CheckCircle, Car, Calendar, Shield,
  ArrowRight, Zap, Pencil,
} from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsSection from "@/components/ReviewsSection";
import ReportButton from "@/components/ReportButton";
import VehicleImageGallery from "@/components/VehicleImageGallery";
import ListingProviderCard from "@/components/ListingProviderCard";
import { getListingProvider } from "@/lib/listing-provider";
import { getCompanyAccess } from "@/lib/company-access";

async function getVehicle(slug: string, viewerId?: string | null) {
  try {
    const { data, error } = await db
      .from("listings")
      .select("id, user_id, company_id, type, category, title, city, price, created_at, image_url, description, metadata, extra_images, responsible_person, published")
      .eq("id", slug)
      .eq("type", "vehicle")
      .maybeSingle();

    if (error) throw new Error(`Fahrzeug konnte nicht geladen werden: ${error.message}`);
    if (!data) { console.error("[getVehicle] no listing found for slug:", slug); return null; }
    if (data.published !== true) {
      const ownsPersonalListing = !!viewerId && !data.company_id && data.user_id === viewerId;
      const hasCompanyAccess = !!viewerId && !!data.company_id && !!(await getCompanyAccess(data.company_id, viewerId));
      if (!ownsPersonalListing && !hasCompanyAccess) return null;
    }

  const provider = await getListingProvider(data.user_id, data.company_id, viewerId ?? null, data.responsible_person);
  const ownerName = provider.name;

  const rawMetadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};
  const focalPoint = rawMetadata.focal_point && typeof rawMetadata.focal_point === "object"
    ? rawMetadata.focal_point as { x?: unknown; y?: unknown }
    : null;

  const catalog=await getTranslations("MarketplaceCatalog");
  return {
    id: data.id,
    title: data.title,
    type: marketplaceCategoryLabel(data.category ?? "Fahrzeug",catalog),
    make: ownerName,
    model: data.title,
    year: typeof rawMetadata.year === "number" ? rawMetadata.year : 0,
    color: typeof rawMetadata.color === "string" ? rawMetadata.color : "",
    era: typeof rawMetadata.era === "string" ? rawMetadata.era : null,
    condition: typeof rawMetadata.condition === "string" ? rawMetadata.condition : "Gut",
    location: data.city ?? "",
    vendor: ownerName,
    dailyRate: data.price ?? 0,
    pricing: listingPriceMetadata(rawMetadata),
      marketplaceCategory:data.category ?? "Bild-Fahrzeug",
    image: data.image_url ?? "",
    tags: (data.created_at && (Date.now() - new Date(data.created_at as string).getTime() < 3 * 24 * 60 * 60 * 1000) ? ["Neu"] : []) as string[],
    instantBook: false,
    verified: false,
    delivery: rawMetadata.delivery === true,
    focalPoint: typeof focalPoint?.x === "number" && typeof focalPoint?.y === "number"
      ? { x: focalPoint.x, y: focalPoint.y }
      : null,
    description: data.description ?? "",
    ownerId: provider.contactUserId ?? "",
    ownerName,
    provider,
    extra_images: data.extra_images ?? [],
  };
  } catch (error) {
    console.error("[getVehicle] failed:", error);
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const vehicle = await getVehicle(slug);
    const market=await getTranslations("MarketplaceOffer"),locale=await getLocale();
    if (!vehicle) return {};
    const title = vehicle.title ?? "Fahrzeug";
    return {
      title,
      description: `${vehicle.type} — ${listingPriceLabel(vehicle.dailyRate,vehicle.pricing,"/Tag",locale,market)}. Jetzt auf CineGenius für Filmproduktionen mieten.`,
      openGraph: {
        title: `${title} | CineGenius`,
        description: `${vehicle.type} mieten für Film & Foto.`,
        ...(vehicle.image ? { images: [{ url: vehicle.image, width: 800, height: 600, alt: title }] } : {}),
      },
    };
  } catch (e) {
    console.error("[vehicle generateMetadata]", e);
    return {};
  }
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();
  const vehicle = await getVehicle(slug, userId);
  const market=await getTranslations("MarketplaceOffer"),locale=await getLocale();
  if (!vehicle) notFound();
  const isOwner = !!userId && userId === vehicle.ownerId;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": vehicle.title,
    "description": vehicle.description || `${vehicle.type} für Filmproduktionen mieten`,
    "image": vehicle.image,
    "category": vehicle.type,
    offers:listingStructuredOffers(vehicle.dailyRate,vehicle.pricing),
  };

  return (
    <div className="pt-16 min-h-screen">
      <JsonLd data={jsonLd} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-6">
          <Link href="/" className="hover:text-gold transition-colors">Home</Link>
          <span>/</span>
          <Link href="/vehicles" className="hover:text-gold transition-colors">Fahrzeuge</Link>
          <span>/</span>
          <span className="text-text-secondary truncate">{vehicle.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              <VehicleImageGallery
                title={vehicle.title}
                image={vehicle.image}
                extraImages={vehicle.extra_images}
                focalPoint={vehicle.focalPoint}
              />
              <div className="absolute top-4 left-4 flex gap-2">
                {vehicle.instantBook && (
                  <span className="px-3 py-1 bg-gold text-bg-primary text-xs font-semibold rounded-full flex items-center gap-1">
                    <Zap size={11} /> Sofortbuchung
                  </span>
                )}
                {vehicle.verified && (
                  <span className="px-3 py-1 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded-full flex items-center gap-1">
                    <CheckCircle size={11} className="text-success" /> Verifiziert
                  </span>
                )}
              </div>
            </div>

            <div>
              <MarketplaceOfferSummary category={vehicle.marketplaceCategory} price={vehicle.dailyRate} metadata={vehicle.pricing} />
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-display text-3xl font-bold text-text-primary">{vehicle.title}</h1>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 bg-bg-elevated border border-border text-text-muted text-sm rounded-full">{vehicle.type}</span>
                  {isOwner && (
                    <Link href="/dashboard?tab=listings"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/40 text-gold text-xs font-medium rounded-lg hover:bg-gold/10 transition-colors">
                      <Pencil size={12} /> Bearbeiten
                    </Link>
                  )}
                  <FavoriteButton
                    listingId={vehicle.id}
                    listingType="vehicle"
                    listingTitle={vehicle.title}
                    listingCity={vehicle.location}
                    listingPrice={vehicle.dailyRate}
                    listingImage={vehicle.image}
                  />
                  <ReportButton listingId={vehicle.id} />
                </div>
              </div>
              <p className="text-text-muted flex items-center gap-1 mb-4">
                <MapPin size={14} /> {vehicle.location} · {vehicle.vendor}
              </p>
              <div className="flex flex-wrap gap-2">
                {vehicle.tags.map((t) => (
                  <span key={t} className="px-3 py-1 bg-bg-elevated border border-border text-text-secondary text-xs rounded-full">{t}</span>
                ))}
              </div>
            </div>

            {vehicle.make !== "Privatanbieter" && (
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Car size={16} className="text-gold" /> Fahrzeugdaten
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Marke", value: vehicle.make },
                    { label: "Modell", value: vehicle.model },
                    { label: "Baujahr", value: vehicle.year > 0 ? String(vehicle.year) : "—" },
                    { label: "Farbe", value: vehicle.color || "—" },
                    { label: "Ära", value: vehicle.era ?? "Modern" },
                    { label: "Zustand", value: vehicle.condition },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-1">{label}</p>
                      <p className="text-sm text-text-primary font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-5 rounded-xl border border-border bg-bg-secondary">
              <h2 className="font-semibold text-text-primary mb-3">Über dieses Fahrzeug</h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                {"description" in vehicle && vehicle.description
                  ? String(vehicle.description)
                  : `Dieses authentische ${vehicle.make} ${vehicle.model}${vehicle.year > 0 ? ` aus dem Jahr ${vehicle.year}` : ""} ist in ${vehicle.condition.toLowerCase()} Zustand und speziell für Film- und Fernsehproduktionen aufbereitet.${vehicle.delivery ? " Lieferung zum Set ist verfügbar — kontaktiere den Anbieter für Details." : vehicle.location ? ` Selbstabholung am Standort ${vehicle.location}.` : ""}`
                }
              </p>
            </div>

            {vehicle.delivery !== undefined && (
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-gold" /> Konditionen
                </h2>
                <div className="space-y-3 text-sm text-text-secondary">
                  <div className="flex justify-between py-2">
                    <span>Lieferung</span>
                    <span className={vehicle.delivery ? "text-success font-medium" : "text-text-muted"}>
                      {vehicle.delivery ? "Verfügbar" : "Selbstabholung"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                <div className="mb-5">
                  <span className="font-display text-3xl font-bold text-gold">{listingPriceLabel(vehicle.dailyRate,vehicle.pricing,"/Tag",locale,market)}</span>
                  <span className="text-text-muted text-sm"> / Tag</span>
                </div>

                {vehicle.ownerId ? <Link
                  href={`/booking/checkout?type=vehicle&id=${vehicle.id}&title=${encodeURIComponent(vehicle.title)}&price=${vehicle.dailyRate}`}
                  className="block w-full py-3.5 bg-gold text-bg-primary font-semibold text-center rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <Calendar size={16} /> Jetzt buchen
                </Link> : <p className="mb-3 rounded-lg border border-gold/30 bg-gold/10 p-3 text-xs leading-5 text-text-secondary">Buchungs- und Kontaktanfragen sind vorübergehend nicht möglich, weil der Anbieter noch nicht zugeordnet ist.</p>}

                {"ownerId" in vehicle && vehicle.ownerId ? (
                  <InquiryForm
                    listingId={vehicle.id}
                    listingTitle={vehicle.title}
                    listingType="vehicle"
                    ownerId={vehicle.ownerId as string}
                    ownerName={vehicle.ownerName as string}
                  />
                ) : (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-gold-subtle rounded-lg border border-gold/20">
                    <Shield size={14} className="text-gold shrink-0 mt-0.5" />
                    <p className="text-xs text-text-muted leading-relaxed">
                      Sichere Zahlung über CineGenius. Geld wird erst nach Abschluss freigegeben.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-text-primary text-sm">Anbieter</h3>
                <ListingProviderCard provider={vehicle.provider} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border mb-12">
          <ReviewsSection
            targetId={vehicle.id}
            targetType="vehicle"
            targetName={vehicle.title}
          />
        </div>

        <div className="mt-0 pt-8 border-t border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-text-primary">Ähnliche Fahrzeuge</h2>
            <Link href="/vehicles" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
