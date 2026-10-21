import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import LocationsContent from "../LocationsContent";
import PageHeader from "@/components/PageHeader";
import { getTranslations } from "next-intl/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Locations suchen — Filmlocations in Deutschland",
  description: "Finde die perfekte Location für dein Filmprojekt: Apartments, Villen, Industriehallen, Studios, Außengeländen und mehr.",
};

async function geocodeCities(cities: string[]): Promise<Record<string, { lat: number; lng: number }>> {
  const unique = [...new Set(cities.filter(Boolean))];
  const result: Record<string, { lat: number; lng: number }> = {};
  await Promise.all(
    unique.map(async (city) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
          { headers: { "User-Agent": "CineGenius/1.0 (contact@cinegenius.de)" }, next: { revalidate: 86400 } }
        );
        const data = await res.json();
        if (data[0]) result[city] = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      } catch { /* fallback below */ }
    })
  );
  return result;
}

export default async function LocationsSuchePage() {
  const t = await getTranslations("locations");
  const { data, error } = await db
    .from("listings")
    .select("id, user_id, title, city, price, image_url, category, description, metadata, created_at")
    .eq("published", true)
    .eq("type", "location")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw new Error("Locationsuche: Inserate konnten nicht geladen werden.");

  const rows = data ?? [];
  const [ratingsMap, coords] = await Promise.all([
    fetchRatings(rows.map((l) => l.id), "listing"),
    geocodeCities(rows.map((l) => l.city ?? "")),
  ]);

  const FALLBACK = { lat: 48.1351, lng: 11.5820 };

  const serverListings = rows.map((l: {
    id: string; user_id: string; title: string; city: string; price: number; description: string;
    category: string | null; image_url: string | null;
    metadata?: Record<string, unknown> | null; created_at?: string | null;
  }) => {
    const { lat, lng } = coords[l.city] ?? FALLBACK;
    return {
      id: l.id, ownerId: l.user_id, title: l.title, type: l.category ?? "Speziallocation",
      city: l.city ?? "", price: l.price, priceUnit: "day" as const,
      rating: ratingsMap[l.id]?.rating ?? 0, reviews: ratingsMap[l.id]?.reviews ?? 0,
      image: l.image_url ?? "",
      tags: l.created_at && (new Date().getTime() - new Date(l.created_at).getTime() < 3 * 24 * 60 * 60 * 1000) ? ["Neu"] : [],
      instantBook: false, verified: false, sqft: 0, capacity: 0, lat, lng,
      focalPoint: ((l.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null ?? null,
      isReal: true, description: l.description ?? "",
    };
  });

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge="Filmlocations Deutschland"
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={t("heroDesc")}
        ctaSecondary={{ label: "Zurück zur Übersicht", href: "/locations" }}
      />
      <div className="site-content-width">
        <LocationsContent serverListings={serverListings} />
      </div>
    </div>
  );
}
