import { publicListingIds } from "@/lib/profile-privacy-server";
import { getTranslations as getPageTranslations } from "next-intl/server";
import {getLocale, getTranslations } from "next-intl/server";
import {placeReadFields} from "@/lib/places/catalog";
import {placeDisplay} from "@/lib/places/core";
import JsonLd from "@/components/JsonLd";
import { listingPriceLabel, listingPriceMetadata, listingStructuredOffers } from "@/lib/listing-price";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import PropDetail from "@/components/PropDetail";
import { parseProductionCredits } from "@/lib/production-credits";
import { auth } from "@clerk/nextjs/server";
import { getListingProvider } from "@/lib/listing-provider";
import { getCompanyAccess } from "@/lib/company-access";

async function getProp(slug: string, viewerId?: string | null) {
  const modelText = await getTranslations();
  try {
    const { data, error } = await db
      .from("listings")
      .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, user_id, company_id, type, category, title, city, price, created_at, image_url, description, metadata, extra_images, responsible_person, published")
      .eq("id", slug)
      .eq("type", "prop")
      .maybeSingle();

    if (error) throw new Error(`Requisite konnte nicht geladen werden: ${error.message}`);

    if (!data) return null;

    if (!(await publicListingIds([data.id])).has(data.id)) {
      const ownsPersonalListing = !!viewerId && !data.company_id && data.user_id === viewerId;
      const hasCompanyAccess = !!viewerId && !!data.company_id && !!(await getCompanyAccess(data.company_id, viewerId));
      if (!ownsPersonalListing && !hasCompanyAccess) return null;
    }

    const provider = await getListingProvider(data.user_id, data.company_id, viewerId ?? null, data.responsible_person);

    const rawMetadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? data.metadata as Record<string, unknown>
      : {};
    const focalPoint = rawMetadata.focal_point && typeof rawMetadata.focal_point === "object"
      ? rawMetadata.focal_point as { x?: unknown; y?: unknown }
      : null;

    return {
      id: data.id,
      title: data.title ?? modelText("Ui.text_27c673e10176f0"),
      category: data.category ?? "Requisiten",
      vendor: provider.name,
      location: data.city ?? "",
      ...placeReadFields(data.city ?? "",data),
      dailyRate: data.price ?? 0,
    pricing: listingPriceMetadata(rawMetadata),
      image: data.image_url ?? "",
      condition: listingPriceMetadata(rawMetadata).marketplace?.condition || (typeof rawMetadata.condition === "string" ? rawMetadata.condition : ""),
      era: typeof rawMetadata.era === "string" ? rawMetadata.era : null,
      delivery: listingPriceMetadata(rawMetadata).marketplace?.fulfilment.includes("delivery") ?? rawMetadata.delivery === true,
      focalPoint: typeof focalPoint?.x === "number" && typeof focalPoint?.y === "number"
        ? { x: focalPoint.x, y: focalPoint.y }
        : null,
      productionCredits: parseProductionCredits(rawMetadata.production_credits),
      description: data.description ?? "",
      ownerId: provider.contactUserId ?? "",
      ownerName: provider.name,
      provider,
      extra_images: data.extra_images ?? [],
    };
  } catch (error) {
    console.error("[getProp] listing load failed:", error);
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const pageCopy = await getPageTranslations("PageCopy");
  const { slug } = await params;
  const prop = await getProp(slug);
  if (!prop) return {};
  return {
    alternates: { canonical: `https://www.cinegenius.co/props/${encodeURIComponent(slug)}` },
    title: prop.title,
    description: pageCopy("p_0e988ef3da6a", { value0: String(prop.title), value1: String(prop.condition), value2: String(listingPriceLabel(prop.dailyRate,prop.pricing)), value3: String(prop.vendor), value4: String(prop.location) }),
    openGraph: {
      title: pageCopy("p_0da9ff7e8d85", { value0: String(prop.title) }),
      description: `${prop.category} · ${prop.condition} · ${listingPriceLabel(prop.dailyRate,prop.pricing)}`,
      ...(prop.image ? { images: [{ url: prop.image, width: 800, height: 600, alt: prop.title }] } : {}),
    },
  };
}

export default async function PropDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const pageCopy = await getPageTranslations("PageCopy");
  const uiText = await getTranslations();

  const { slug } = await params;
  const { userId } = await auth();
  const prop = await getProp(slug, userId);
  if (!prop) notFound();

  const locale=await getLocale();
  const displayProp={...prop,location:placeDisplay(placeReadFields(prop.location,prop,locale),prop.location,locale)};
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": prop.title,
    "description": ("description" in prop && prop.description) ? String(prop.description) : pageCopy("p_64b2907066bb", { value0: String(prop.category), value1: String(prop.condition), value2: String(prop.location) }),
    "image": prop.image || undefined,
    "brand": {
      "@type": "Brand",
      "name": prop.vendor,
    },
    offers:listingStructuredOffers(prop.dailyRate,prop.pricing),
    "itemCondition": prop.condition === "Neuwertig"
      ? "https://schema.org/NewCondition"
      : "https://schema.org/UsedCondition",
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PropDetail prop={displayProp} />
    </>
  );
}
