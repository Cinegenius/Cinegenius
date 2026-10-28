import { canEditListing } from "@/lib/listing-access";
import JsonLd from "@/components/JsonLd";
import { listingPriceLabel } from "@/lib/listing-price";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import LocationDetail from "@/components/LocationDetail";
import { fetchRatingSummaries } from "@/lib/ratings";
import { getListingProvider } from "@/lib/listing-provider";
import { auth } from "@clerk/nextjs/server";

async function geocodeCity(city: string): Promise<{ lat: number; lng: number }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      {
        headers: { "User-Agent": "CineGenius/1.0 (contact@cinegenius.de)" },
        next: { revalidate: 86400 },
      }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return { lat: 48.1351, lng: 11.5820 };
}

async function getLocation(slug: string, viewerId: string | null = null) {
  const { data, error } = await db
    .from("listings")
    .select("id, user_id, company_id, type, category, title, city, price, created_at, image_url, description, metadata, blocked_dates, floor_plan_url, extra_images, responsible_person, published")
    .eq("id", slug)
    .eq("type", "location")
    .maybeSingle();

  if (error) throw new Error(`Location konnte nicht geladen werden: ${error.message}`);
  if (!data) return null;
  if (data.published !== true && (!viewerId || !await canEditListing(viewerId, data))) return null;

  const [{ lat, lng }, provider, ratingMap] = await Promise.all([
    geocodeCity(data.city ?? ""),
    getListingProvider(data.user_id, data.company_id, viewerId, data.responsible_person),
    fetchRatingSummaries([data.id], "listing"),
  ]);
  const summary = ratingMap[data.id] ?? { rating: 0, reviews: 0, ratingOnly: 0 };
  const rawMetadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};
  const publicMetadata = Object.fromEntries(
    ["sqm", "ceiling_height_m", "max_crew", "indoor_outdoor", "power_available", "power_details", "parking_spots", "amenities", "rooms", "natural_light", "blackout_possible", "loading_access", "access_notes", "shooting_hours", "availability_notes", "price_on_request", "price_negotiable", "production_credits"]
      .filter((key) => key in rawMetadata)
      .map((key) => [key, key === "production_credits" && Array.isArray(rawMetadata[key])
        ? rawMetadata[key].filter((entry: unknown) => !entry || typeof entry !== "object" || ((entry as { visibility?: string }).visibility !== "private" && (entry as { public?: boolean }).public !== false))
        : rawMetadata[key]])
  );
  const focalPoint = rawMetadata.focal_point && typeof rawMetadata.focal_point === "object"
    ? rawMetadata.focal_point as { x?: unknown; y?: unknown }
    : null;

  return {
      id: data.id,
      title: data.title ?? "Location",
      type: data.category ?? "Speziallocation",
      city: data.city ?? "",
      price: rawMetadata.price_on_request === true ? 0 : data.price ?? 0,
      priceUnit: "day" as const,
      rating: summary.rating,
      reviews: summary.reviews,
      image: data.image_url ?? "",
      tags: data.created_at && (Date.now() - new Date(data.created_at as string).getTime() < 3 * 24 * 60 * 60 * 1000) ? ["Neu"] : [],
      instantBook: false,
      verified: false,
      sqft: 0,
      capacity: 0,
      lat,
      lng,
      description: data.description ?? "",
      ownerId: provider.contactUserId ?? "",
      ownerName: provider.name,
      provider,
      isReal: true,
      focalPoint: typeof focalPoint?.x === "number" && typeof focalPoint?.y === "number"
        ? { x: focalPoint.x, y: focalPoint.y }
        : null,
      metadata: publicMetadata,
      blocked_dates: data.blocked_dates ?? [],
      floor_plan_url: data.floor_plan_url ?? null,
      extra_images: data.extra_images ?? [],
    };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { userId } = await auth();
  const location = await getLocation(slug, userId);
  if (!location) return {};
  return {
    title: location.title,
    description: `${location.type} in ${location.city} — ${listingPriceLabel(location.price,location.metadata)}.`,
    openGraph: {
      title: `${location.title} | CineGenius`,
      description: `${location.type} in ${location.city} — jetzt für Film & Foto buchen.`,
      ...(location.image ? { images: [{ url: location.image, width: 800, height: 600, alt: location.title }] } : {}),
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const location = await getLocation(slug);
  if (!location) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    "name": location.title,
    "description": ("description" in location && location.description) ? String(location.description) : `${location.type} in ${location.city}`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": location.city,
      "addressCountry": "DE",
    },
    "image": location.image || undefined,
    ...(location.price > 0 && !location.metadata.price_negotiable && !location.metadata.price_on_request ? { "offers": {
      "@type": "Offer",
      "price": location.price,
      "priceCurrency": "EUR",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": location.price,
        "priceCurrency": "EUR",
        "unitText": "DAY",
      },
    } } : {}),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <LocationDetail location={location} />
    </>
  );
}
