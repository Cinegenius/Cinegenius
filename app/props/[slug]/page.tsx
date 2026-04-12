import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import PropDetail from "@/components/PropDetail";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getProp(slug: string) {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", slug)
    .eq("type", "prop")
    .single();

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    category: "Requisiten",
    vendor: "Privatanbieter",
    location: data.city ?? "",
    dailyRate: data.price,
    image: data.image_url ?? "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=800&q=80",
    condition: "Gut",
    era: null as string | null,
    delivery: false,
    description: data.description ?? "",
    ownerId: data.user_id ?? "",
    ownerName: "Anbieter",
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
