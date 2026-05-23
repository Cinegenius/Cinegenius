import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import TiereDetail from "@/components/TiereDetail";

async function getAnimal(slug: string) {
  try {
    const { data, error } = await db
      .from("listings")
      .select("*")
      .eq("id", slug)
      .single();

    if (error || !data) return null;
    if (data.type !== "animal") return null;

    const ownerRes = data.user_id
      ? await db.from("profiles").select("display_name, avatar_url, slug").eq("user_id", data.user_id).single()
      : { data: null };

    type OwnerRow = { display_name: string | null; avatar_url: string | null; slug: string | null } | null;
    const owner = (ownerRes as { data: OwnerRow }).data;

    const meta = (data.metadata ?? {}) as Record<string, unknown>;

    return {
      id: data.id,
      title: data.title ?? "Film-Tier",
      category: data.category ?? "Sonstige Tiere",
      location: data.city ?? "",
      dailyRate: data.price ?? 0,
      image: data.image_url ?? "",
      trainingLevel: (meta.training_level as string) ?? null,
      handlerIncluded: (meta.handler_included as boolean) ?? false,
      count: (meta.count as string) ?? "1 Tier",
      specialSkills: (meta.special_skills as string) ?? null,
      delivery: (meta.delivery as boolean) ?? false,
      focalPoint: (meta.focal_point as { x: number; y: number } | null) ?? null,
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
  const animal = await getAnimal(slug);
  if (!animal) return {};
  return {
    title: animal.title,
    description: `${animal.category} für Filmproduktionen — ${animal.dailyRate > 0 ? `ab ${animal.dailyRate.toLocaleString()} € / Tag` : "Preis auf Anfrage"}. Jetzt auf CineGenius buchen.`,
    openGraph: {
      title: `${animal.title} | CineGenius Film-Tiere`,
      description: `${animal.category} · ${animal.trainingLevel ?? "Auf Anfrage"} · ${animal.location}`,
      ...(animal.image ? { images: [{ url: animal.image, width: 800, height: 600, alt: animal.title }] } : {}),
    },
  };
}

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const animal = await getAnimal(slug);
  if (!animal) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": animal.title,
    "description": animal.description || `${animal.category} für Filmproduktionen`,
    "image": animal.image || undefined,
    "offers": {
      "@type": "Offer",
      "price": animal.dailyRate,
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": animal.dailyRate,
        "priceCurrency": "EUR",
        "unitText": "DAY",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TiereDetail animal={animal} />
    </>
  );
}
