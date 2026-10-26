import { listingPriceLabel, listingPriceMetadata } from "@/lib/listing-price";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import PropDetail from "@/components/PropDetail";
import { parseProductionCredits } from "@/lib/production-credits";
import { auth } from "@clerk/nextjs/server";
import { getListingProvider } from "@/lib/listing-provider";
import { getCompanyAccess } from "@/lib/company-access";

async function getProp(slug: string, viewerId?: string | null) {
  try {
    const { data, error } = await db
      .from("listings")
      .select("id, user_id, company_id, type, category, title, city, price, created_at, image_url, description, metadata, extra_images, published")
      .eq("id", slug)
      .eq("type", "prop")
      .maybeSingle();

    if (error) throw new Error(`Requisite konnte nicht geladen werden: ${error.message}`);

    if (!data) return null;

    if (data.published !== true) {
      const ownsPersonalListing = !!viewerId && !data.company_id && data.user_id === viewerId;
      const hasCompanyAccess = !!viewerId && !!data.company_id && !!(await getCompanyAccess(data.company_id, viewerId));
      if (!ownsPersonalListing && !hasCompanyAccess) return null;
    }

    const provider = await getListingProvider(data.user_id, data.company_id, viewerId ?? null);

    const rawMetadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? data.metadata as Record<string, unknown>
      : {};
    const focalPoint = rawMetadata.focal_point && typeof rawMetadata.focal_point === "object"
      ? rawMetadata.focal_point as { x?: unknown; y?: unknown }
      : null;

    return {
      id: data.id,
      title: data.title ?? "Requisite",
      category: data.category ?? "Requisiten",
      vendor: provider.name,
      location: data.city ?? "",
      dailyRate: data.price ?? 0,
    pricing: listingPriceMetadata(rawMetadata),
      image: data.image_url ?? "",
      condition: typeof rawMetadata.condition === "string" ? rawMetadata.condition : "Gut",
      era: typeof rawMetadata.era === "string" ? rawMetadata.era : null,
      delivery: rawMetadata.delivery === true,
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
  const { slug } = await params;
  const prop = await getProp(slug);
  if (!prop) return {};
  return {
    title: prop.title,
    description: `${prop.title} mieten — ${prop.condition}, ${listingPriceLabel(prop.dailyRate,prop.pricing)} bei ${prop.vendor} in ${prop.location}.`,
    openGraph: {
      title: `${prop.title} | CineGenius Verleih`,
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
  const { slug } = await params;
  const { userId } = await auth();
  const prop = await getProp(slug, userId);
  if (!prop) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": prop.title,
    "description": ("description" in prop && prop.description)
      ? String(prop.description)
      : `${prop.category} zum Verleih — ${prop.condition} — ${prop.location}`,
    "image": prop.image || undefined,
    "brand": {
      "@type": "Brand",
      "name": prop.vendor,
    },
    "offers": {
      "@type": "Offer",
      "price": prop.dailyRate,
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": prop.dailyRate,
        "priceCurrency": "EUR",
        "unitText": "DAY",
      },
    },
    "itemCondition": prop.condition === "Neuwertig"
      ? "https://schema.org/NewCondition"
      : "https://schema.org/UsedCondition",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PropDetail prop={prop} />
    </>
  );
}
