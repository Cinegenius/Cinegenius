import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import VehiclesContent from "./VehiclesContent";
import ProviderProfiles from "@/components/ProviderProfiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bildfahrzeuge & Stuntautos mieten — Film & Werbung",
  description: "Klassiker, Oldtimer, Stuntautos und Spezialfahrzeuge für Film, Werbung und Fotoproduktionen mieten. Jetzt Fahrzeuge durchsuchen.",
  keywords: ["Bildfahrzeuge mieten", "Oldtimer Film", "Stuntauto mieten", "Filmfahrzeuge", "Fahrzeug für Werbung"],
  openGraph: {
    title: "Bildfahrzeuge & Stuntautos — CineGenius",
    description: "Klassiker, Stuntautos und Spezialfahrzeuge für deine Produktion.",
  },
};

export default async function VehiclesPage() {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("published", true)
    .eq("type", "vehicle")
    .order("created_at", { ascending: false });

  const { data: providerData } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, location, bio, avatar_url, profile_types")
    .not("display_name", "is", null);

  const equipmentProviders = (providerData ?? [])
    .filter((p: { profile_types?: string[] | null }) =>
      (p.profile_types ?? []).includes("equipment")
    )
    .map((p: { user_id: string; display_name: string | null; location: string | null; bio: string | null; avatar_url: string | null }) => ({
      id: p.user_id,
      name: p.display_name ?? "Anbieter",
      city: (p.location ?? "").split(",")[0]?.trim() ?? "",
      bio: p.bio ?? "",
      avatar: p.avatar_url ?? null,
      typeLabel: "Equipment & Fahrzeuge",
    }));

  const serverVehicles = (data ?? []).map((l: {
    id: string; title: string; city: string; price: number; image_url: string | null; description: string | null;
  }) => {
    const desc = l.description ?? "";
    const make = desc.match(/Marke: ([^·\n]+)/)?.[1]?.trim() ?? "";
    const model = desc.match(/Modell: ([^·\n]+)/)?.[1]?.trim() ?? "";
    const yearStr = desc.match(/Baujahr: ([^·\n]+)/)?.[1]?.trim();
    const year = yearStr ? parseInt(yearStr) : 0;
    return {
    id: l.id,
    title: l.title,
    type: "Bild-Fahrzeug",
    make: make || "Privatanbieter",
    model: model || "",
    year,
    color: "",
    era: "" as string,
    condition: "Gut",
    location: l.city ?? "",
    vendor: "Privatanbieter",
    dailyRate: l.price,
    image: l.image_url ?? "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",
    tags: ["Neu"],
    instantBook: false,
    verified: false,
    delivery: false,
    isReal: true,
    };
  });

  return (
    <>
      <ProviderProfiles profiles={equipmentProviders} heading="Equipment-Anbieter mit Profil" />
      <VehiclesContent serverVehicles={serverVehicles} />
    </>
  );
}
