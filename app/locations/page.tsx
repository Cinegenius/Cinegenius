import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fetchRatings } from "@/lib/ratings";
import LocationsLanding from "./LocationsLanding";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Filmlocations mieten — Apartments, Villen, Studios & mehr",
  description: "Finde die perfekte Location für dein Filmprojekt: Apartments, Villen, Industriehallen, Studios, Außengelände und mehr. Jetzt Locations durchsuchen.",
  keywords: ["Location mieten", "Filmlocations Deutschland", "Location für Filmdreh", "Fotostudio mieten", "Außengelände Film"],
  openGraph: {
    title: "Filmlocations — CineGenius",
    description: "Die perfekte Location für dein nächstes Projekt — Innen, Außen & Speziallocation.",
  },
};

type LocationCard = {
  id: string; title: string; type: string; city: string; price: number;
  image: string; rating: number; reviews: number;
  focalPoint?: { x: number; y: number } | null;
};

export default async function LocationsPage() {
  const { data } = await db
    .from("listings")
    .select("id, title, city, price, image_url, category, metadata, created_at")
    .eq("published", true)
    .eq("type", "location")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];

  const ratingsMap = await fetchRatings(rows.map((l) => l.id), "location");

  // Group by city, max 6 per city
  const cityMap = new Map<string, LocationCard[]>();
  for (const l of rows as {
    id: string; title: string; city: string | null; price: number;
    image_url: string | null; category: string | null;
    metadata?: Record<string, unknown> | null;
  }[]) {
    const city = l.city ?? "Sonstige";
    if (!cityMap.has(city)) cityMap.set(city, []);
    const arr = cityMap.get(city)!;
    if (arr.length < 6) {
      arr.push({
        id: l.id,
        title: l.title,
        type: l.category ?? "Speziallocation",
        city,
        price: l.price,
        image: l.image_url ?? "",
        rating: ratingsMap[l.id]?.rating ?? 0,
        reviews: ratingsMap[l.id]?.reviews ?? 0,
        focalPoint: ((l.metadata ?? {}) as Record<string, unknown>).focal_point as { x: number; y: number } | null ?? null,
      });
    }
  }

  // Top cities by location count, max 6 cities
  const cityGroups = [...cityMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([city, locations]) => ({ city, locations }));

  return (
    <LocationsLanding cityGroups={cityGroups} totalCount={rows.length} />
  );
}
