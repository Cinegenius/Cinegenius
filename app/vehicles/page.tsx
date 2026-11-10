import {getLocale} from "next-intl/server";
import {placeReadFields} from "@/lib/places/catalog";
import {placeDisplay} from "@/lib/places/core";
import { marketplaceCategory } from "@/lib/marketplaceCategories";
import { listingPriceMetadata } from "@/lib/listing-price";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import VehiclesContent from "./VehiclesContent";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export const revalidate = 60;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/vehicles" },
  title: tMetadata('m_fa2435096125'),
  description: tMetadata('m_47fa659ef18c'),
  keywords: [tMetadata('m_b529927fe8e7'), tMetadata('m_3a53fe2a687a'), tMetadata('m_e8394cb4ca66'), tMetadata('m_756f8a76f3f9'), tMetadata('m_92a6c6a6ae60')],
  openGraph: {
    title: tMetadata('m_28b9791b7533'),
    description: tMetadata('m_541269017187'),
  },
};
}

export default async function VehiclesPage() {
  const locale=await getLocale();
  const { data } = await db
    .from("listings")
    .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, user_id, title, category, city, price, image_url, description, metadata, created_at")
    .eq("published", true)
    .eq("type", "vehicle")
    .order("created_at", { ascending: false })
    .limit(300);

  const serverVehicles = (data ?? []).map((l: {
    id: string; title: string; city: string; price: number; image_url: string | null;
    description: string | null; category: string | null;
    metadata: Record<string, unknown> | null; created_at?: string | null;
  }) => {
    const meta = (l.metadata ?? {}) as Record<string, unknown>;
    // Support both new metadata format and legacy description-embedded format
    const desc = l.description ?? "";
    const make = (meta.make as string) || desc.match(/Marke: ([^·\n]+)/)?.[1]?.trim() || "";
    const model = (meta.model as string) || desc.match(/Modell: ([^·\n]+)/)?.[1]?.trim() || "";
    const yearRaw = meta.year ?? desc.match(/Baujahr: ([^·\n]+)/)?.[1]?.trim();
    const year = yearRaw ? parseInt(String(yearRaw)) : 0;
    return {
      id: l.id,
      title: l.title,
      type: marketplaceCategory(l.category)?.subcategory ? marketplaceCategory(l.category)?.subcategory === "fahrzeuge-bild" ? "Bild-Fahrzeug" : "Produktionsfahrzeug" : l.category ?? "Bild-Fahrzeug",
      make: make || "",
      model: model || "",
      year,
      color: (meta.color as string) ?? "",
      era: (meta.era as string) ?? null,
      condition: (meta.condition as string) ?? "Gut",
      location: placeDisplay(placeReadFields(l.city??"",l,locale),l.city??"",locale),
    ...placeReadFields(l.city??"",l,locale),
      vendor: "",
      dailyRate: l.price,
      pricing: listingPriceMetadata(l.metadata),
      image: l.image_url ?? "",
      tags: l.created_at && (new Date().getTime() - new Date(l.created_at).getTime() < 3 * 24 * 60 * 60 * 1000) ? ["Neu"] : [],
      instantBook: false,
      verified: false,
      delivery: (meta.delivery as boolean) ?? false,
      focalPoint: (meta.focal_point as { x: number; y: number } | null) ?? null,
      isReal: true,
    };
  });

  return <VehiclesContent serverVehicles={serverVehicles} />;
}
