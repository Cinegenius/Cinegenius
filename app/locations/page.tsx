import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import LocationsContent from "./LocationsContent";
import PageHeader from "@/components/PageHeader";
import { getTranslations } from "next-intl/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Locations mieten — Filmlocations in Deutschland",
  description: "Finde die perfekte Location für dein Filmprojekt: Apartments, Villen, Industriehallen, Studios, Außengeländen und mehr. Jetzt Locations durchsuchen.",
  keywords: ["Location mieten", "Filmlocations Deutschland", "Location für Filmdreh", "Fotostudio mieten", "Außengelände Film"],
  openGraph: {
    title: "Locations mieten — Filmlocations in Deutschland",
    description: "Die perfekte Location für dein nächstes Projekt — Innen, Außen & Speziallocation.",
  },
};

// Geocode unique cities via Nominatim — deduplicated so each city is only fetched once
async function geocodeCities(cities: string[]): Promise<Record<string, { lat: number; lng: number }>> {
  const unique = [...new Set(cities.filter(Boolean))];
  const result: Record<string, { lat: number; lng: number }> = {};

  await Promise.all(
    unique.map(async (city) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
          {
            headers: { "User-Agent": "CineGenius/1.0 (contact@cinegenius.de)" },
            next: { revalidate: 86400 }, // cache 24h per city
          }
        );
        const data = await res.json();
        if (data[0]) {
          result[city] = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch {
        // fall back to Munich if geocoding fails
      }
    })
  );

  return result;
}

export default async function LocationsPage() {
  const t = await getTranslations("locations");
  const { data } = await db
    .from("listings")
    .select("id, title, city, price, image_url, category, description, metadata, created_at")
    .eq("published", true)
    .eq("type", "location")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = data ?? [];

  // Fetch ratings + geocode in parallel
  const [ratingsMap, coords] = await Promise.all([
    fetchRatings(rows.map((l) => l.id), "location"),
    geocodeCities(rows.map((l) => l.city ?? "")),
  ]);

  const FALLBACK = { lat: 48.1351, lng: 11.5820 };

  const serverListings = rows.map((l: {
    id: string; title: string; city: string;
    price: number; description: string; category: string | null; image_url: string | null;
    metadata?: Record<string, unknown> | null; created_at?: string | null;
  }) => {
    const { lat, lng } = coords[l.city] ?? FALLBACK;
    return {
      id: l.id,
      title: l.title,
      type: l.category ?? "Speziallocation",
      city: l.city ?? "",
      price: l.price,
      priceUnit: "day" as const,
      rating: ratingsMap[l.id]?.rating ?? 0,
      reviews: ratingsMap[l.id]?.reviews ?? 0,
      image: l.image_url ?? "",
      tags: l.created_at && (Date.now() - new Date(l.created_at).getTime() < 3 * 24 * 60 * 60 * 1000) ? ["Neu"] : [],
      instantBook: false,
      verified: false,
      sqft: 0,
      capacity: 0,
      lat,
      lng,
      focalPoint: ((l.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null ?? null,
      isReal: true,
      description: l.description ?? "",
    };
  });

  const { data: vendorData } = await db
    .from("profiles")
    .select("user_id, display_name, location, avatar_url, verified, profile_types")
    .contains("profile_types", ["location"])
    .not("display_name", "is", null)
    .neq("display_name", "")
    .limit(50);

  const locationVendors = (vendorData ?? []).map((p: {
    user_id: string; display_name: string; location: string | null;
    avatar_url: string | null; verified: boolean | null; profile_types: string[] | null;
  }) => ({
    id: p.user_id,
    name: p.display_name,
    location: p.location ?? "",
    avatar: p.avatar_url ?? "",
    verified: p.verified ?? false,
  }));

  return (
    <>
      <PageHeader
          badge="Locations"
          title={t("heroTitle")}
          titleHighlight={t("heroTitleHighlight")}
          description={t("heroDesc")}
          image="https://images.unsplash.com/photo-1657184925977-30a2d89fe72f?w=1600&q=90"
          imagePosition="center 60%"
          cta={{ label: t("heroCta"), href: "/inserat?group=drehorte" }}
        />
      <LocationsContent serverListings={serverListings} vendorProfiles={locationVendors} />
    </>
  );
}
