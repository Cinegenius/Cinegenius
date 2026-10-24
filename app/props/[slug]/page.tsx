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
      .select("*")
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

    return {
      id: data.id,
      title: data.title ?? "Requisite",
      category: data.category ?? "Requisiten",
      vendor: provider.name,
      location: data.city ?? "",
      dailyRate: data.price ?? 0,
      image: data.image_url ?? "",
      condition: (data.metadata as { condition?: string } | null)?.condition ?? "Gut",
      era: (data.metadata as { era?: string } | null)?.era ?? null,
      delivery: (data.metadata as { delivery?: boolean } | null)?.delivery ?? false,
      focalPoint: (data.metadata as { focal_point?: { x: number; y: number } | null } | null)?.focal_point ?? null,
      productionCredits: parseProductionCredits((data.metadata as { production_credits?: unknown } | null)?.production_credits),
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
    description: `${prop.title} mieten — ${prop.condition}, ${prop.dailyRate} €/Tag bei ${prop.vendor} in ${prop.location}.`,
    openGraph: {
      title: `${prop.title} | CineGenius Verleih`,
      description: `${prop.category} · ${prop.condition} · ${prop.dailyRate} €/Tag`,
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
