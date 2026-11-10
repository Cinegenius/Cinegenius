import {getLocale, getTranslations} from "next-intl/server";
import { placeReadFields } from "@/lib/places/catalog";
import { placeDisplay } from "@/lib/places/core";
import { listingPriceLabel } from "@/lib/listing-price";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import LocationsLanding, { type LocationCard } from "./LocationsLanding";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export const revalidate = 60;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/locations" },
  title: tMetadata('m_34258bd0b349'),
  description: tMetadata('m_d4138f9d1e78'),
  keywords: [tMetadata('m_74826d9e051a'), tMetadata('m_6cd5097a3ae3'), tMetadata('m_9787d23bd01a'), tMetadata('m_d9753ec6bbbb'), tMetadata('m_5a64824ccd38')],
  openGraph: {
    title: tMetadata('m_36511716ffc5'),
    description: tMetadata('m_9de8e0ccf7aa'),
  },
};
}

export default async function LocationsPage() {
  const uiText = await getTranslations();

  const locale = await getLocale();
  const priceText = await getTranslations("MarketplaceOffer");
  const { data, error } = await db
    .from("listings")
    .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, title, city, price, image_url, category, metadata, created_at")
    .eq("published", true)
    .eq("type", "location")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(uiText("Ui.text_2a7079785185c8", { value1: String(error.message) }));

  const rows = data ?? [];

  const ratingsMap = await fetchRatings(rows.map((l) => l.id), "listing");

  // Place verification controls canonical filters, never publication visibility.
  const allLocations: LocationCard[] = (rows as {
    id: string; title: string; city: string | null; price: number;
    image_url: string | null; category: string | null;
    metadata?: Record<string, unknown> | null;
  }[]).map(l => {
    const place = placeReadFields(l.city ?? "", l, locale);
    return {
      id: l.id,
      ...place,
      title: l.title,
      type: l.category ?? "",
      city: placeDisplay(place, l.city ?? "", locale),
      price: l.price,
      priceLabel: listingPriceLabel(l.price, l.metadata, "/Tag", locale, priceText),
      priceOnRequest: ((l.metadata ?? {}) as Record<string, unknown>).price_on_request === true || l.price <= 0,
      image: l.image_url ?? "",
      rating: ratingsMap[l.id]?.rating ?? 0,
      reviews: ratingsMap[l.id]?.reviews ?? 0,
      focalPoint: ((l.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null ?? null,
    };
  });

  return (
    <LocationsLanding allLocations={allLocations} totalCount={rows.length} />
  );
}
