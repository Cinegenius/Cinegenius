import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LocationsContent from "./LocationsContent";
import CategoryHero from "@/components/CategoryHero";
import ProviderProfiles from "@/components/ProviderProfiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drehorte mieten — Filmlocations in Deutschland",
  description: "Finde die perfekte Drehort für dein Filmprojekt: Apartments, Villen, Industriehallen, Studios, Außengeländen und mehr. Jetzt Locations durchsuchen.",
  keywords: ["Drehort mieten", "Filmlocations Deutschland", "Location für Filmdreh", "Fotostudio mieten", "Außengelände Film"],
  openGraph: {
    title: "Drehorte mieten — Filmlocations in Deutschland",
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
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("published", true)
    .eq("type", "location")
    .order("created_at", { ascending: false });

  const { data: providerData } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, location, bio, avatar_url, profile_types")
    .not("display_name", "is", null);

  const locationProviders = (providerData ?? [])
    .filter((p: { profile_types?: string[] | null }) =>
      (p.profile_types ?? []).includes("location")
    )
    .map((p: { user_id: string; display_name: string | null; location: string | null; bio: string | null; avatar_url: string | null }) => ({
      id: p.user_id,
      name: p.display_name ?? "Anbieter",
      city: (p.location ?? "").split(",")[0]?.trim() ?? "",
      bio: p.bio ?? "",
      avatar: p.avatar_url ?? null,
      typeLabel: "Drehort-Anbieter",
    }));

  const rows = data ?? [];

  // Geocode all unique cities in parallel
  const coords = await geocodeCities(rows.map((l) => l.city ?? ""));

  const FALLBACK = { lat: 48.1351, lng: 11.5820 };

  const serverListings = rows.map((l: {
    id: string; title: string; city: string;
    price: number; description: string; category: string | null; image_url: string | null;
  }) => {
    const { lat, lng } = coords[l.city] ?? FALLBACK;
    return {
      id: l.id,
      title: l.title,
      type: l.category ?? "Speziallocation",
      city: l.city ?? "",
      price: l.price,
      priceUnit: "day" as const,
      rating: 0,
      reviews: 0,
      image: l.image_url ?? "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
      tags: ["Neu"],
      instantBook: false,
      verified: false,
      sqft: 0,
      capacity: 0,
      lat,
      lng,
      isReal: true,
      description: l.description ?? "",
    };
  });

  return (
    <>
      <div className="pt-16">
        <CategoryHero
          badge="Drehorte & Locations"
          title="Die perfekte Location"
          titleHighlight="für dein Projekt"
          description="Apartments, Villen, Industriehallen, Studios, Außengelände — überall in Deutschland."
          image="https://images.unsplash.com/photo-1657184925977-30a2d89fe72f?w=1600&q=90"
          imagePosition="center 60%"
          overlay="left"
          height="sm"
          cta={{ label: "Location eintragen", href: "/inserat" }}
        />
      </div>
      <ProviderProfiles profiles={locationProviders} heading="Drehort-Anbieter mit Profil" />
      <LocationsContent serverListings={serverListings} />
    </>
  );
}
