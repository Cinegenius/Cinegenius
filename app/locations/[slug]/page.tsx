import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";
import LocationDetail from "@/components/LocationDetail";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

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

async function getLocation(slug: string) {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", slug)
    .eq("type", "location")
    .single();

  if (!data) return null;

  const [{ lat, lng }, ownerRes] = await Promise.all([
    geocodeCity(data.city ?? ""),
    data.user_id
      ? supabaseAdmin.from("profiles").select("display_name").eq("user_id", data.user_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: data.id,
    title: data.title,
    type: data.category ?? "Speziallocation",
    city: data.city ?? "",
    price: data.price,
    priceUnit: "day" as const,
    rating: 0,
    reviews: 0,
    image: data.image_url ?? "",
    tags: ["Neu"],
    instantBook: false,
    verified: false,
    sqft: 0,
    capacity: 0,
    lat,
    lng,
    description: data.description ?? "",
    ownerId: data.user_id ?? "",
    ownerName: (ownerRes as { data: { display_name: string | null } | null }).data?.display_name ?? "Anbieter",
    isReal: true,
    metadata: data.metadata ?? null,
    blocked_dates: data.blocked_dates ?? [],
    floor_plan_url: data.floor_plan_url ?? null,
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
  const location = await getLocation(slug);
  if (!location) return {};
  return {
    title: location.title,
    description: `${location.type} in ${location.city} — ab ${location.price.toLocaleString()} € / Tag.`,
    openGraph: {
      title: `${location.title} | CineGenius`,
      description: `${location.type} in ${location.city} — jetzt für Film & Foto buchen.`,
      images: [{ url: location.image, width: 800, height: 600, alt: location.title }],
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
    "image": location.image,
    "offers": {
      "@type": "Offer",
      "price": location.price,
      "priceCurrency": "EUR",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": location.price,
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
      <LocationDetail location={location} />
    </>
  );
}
