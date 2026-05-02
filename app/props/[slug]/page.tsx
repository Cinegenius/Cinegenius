import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import PropDetail from "@/components/PropDetail";

async function getProp(slug: string) {
  try {
    const { data } = await db
      .from("listings")
      .select("*")
      .eq("id", slug)
      .eq("type", "prop")
      .single();

    if (!data) return null;

    const ownerRes = data.user_id
      ? await db.from("profiles").select("display_name, avatar_url, slug").eq("user_id", data.user_id).single()
      : { data: null };

    type OwnerRow = { display_name: string | null; avatar_url: string | null; slug: string | null } | null;
    const owner = (ownerRes as { data: OwnerRow }).data;

    return {
      id: data.id,
      title: data.title ?? "Requisite",
      category: data.category ?? "Requisiten",
      vendor: owner?.display_name ?? "Privatanbieter",
      location: data.city ?? "",
      dailyRate: data.price ?? 0,
      image: data.image_url ?? "",
      condition: (data.metadata as { condition?: string } | null)?.condition ?? "Gut",
      era: (data.metadata as { era?: string } | null)?.era ?? null,
      delivery: (data.metadata as { delivery?: boolean } | null)?.delivery ?? false,
      focalPoint: (data.metadata as { focal_point?: { x: number; y: number } | null } | null)?.focal_point ?? null,
      description: data.description ?? "",
      ownerId: data.user_id ?? "",
      ownerName: owner?.display_name ?? "Anbieter",
      ownerAvatar: owner?.avatar_url ?? null,
      ownerSlug: owner?.slug ?? data.user_id ?? null,
      extra_images: data.extra_images ?? [],
    };
  } catch {
    return null;
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
  const prop = await getProp(slug);
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
