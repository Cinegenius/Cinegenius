import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";
import PropDetail from "@/components/PropDetail";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

async function getProp(slug: string) {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", slug)
    .eq("type", "prop")
    .single();

  if (!data) return null;

  const ownerRes = data.user_id
    ? await supabaseAdmin.from("profiles").select("display_name").eq("user_id", data.user_id).single()
    : { data: null };

  return {
    id: data.id,
    title: data.title,
    category: data.category ?? "Requisiten",
    vendor: (ownerRes as { data: { display_name: string | null } | null }).data?.display_name ?? "Privatanbieter",
    location: data.city ?? "",
    dailyRate: data.price,
    image: data.image_url ?? "",
    condition: (data.metadata as { condition?: string } | null)?.condition ?? "Gut",
    era: (data.metadata as { era?: string } | null)?.era ?? null,
    delivery: (data.metadata as { delivery?: boolean } | null)?.delivery ?? false,
    description: data.description ?? "",
    ownerId: data.user_id ?? "",
    ownerName: (ownerRes as { data: { display_name: string | null } | null }).data?.display_name ?? "Anbieter",
    extra_images: data.extra_images ?? [],
  };
}

export async function generateStaticParams() {
  return [];
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
      images: [{ url: prop.image, width: 800, height: 600, alt: prop.title }],
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
    "image": prop.image,
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
