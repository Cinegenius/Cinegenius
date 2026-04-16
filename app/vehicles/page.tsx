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
    id: string; title: string; city: string; price: number; image_url: string | null;
    description: string | null; category: string | null;
    metadata: Record<string, unknown> | null;
  }) => {
    const meta = (l.metadata ?? {}) as Record<string, unknown>;
    // Support both new metadata format and legacy description-embedded format
    const desc = l.description ?? "";
    const make = (meta.make as string) || desc.match(/Marke: ([^·\n]+)/)?.[1]?.trim() || "";
    const model = (meta.model as string) || desc.match(/Modell: ([^·\n]+)/)?.[1]?.trim() || "";
    const yearRaw = meta.year ?? desc.match(/Baujahr: ([^·\n]+)/)?.[1]?.trim();
    const year = yearRaw ? parseInt(String(yearRaw)) : 0;
    return {
      id: l.id,
      title: l.title,
      type: l.category ?? "Bild-Fahrzeug",
      make: make || "",
      model: model || "",
      year,
      color: (meta.color as string) ?? "",
      era: (meta.era as string) ?? null,
      condition: (meta.condition as string) ?? "Gut",
      location: l.city ?? "",
      vendor: "",
      dailyRate: l.price,
      image: l.image_url ?? "",
      tags: ["Neu"],
      instantBook: false,
      verified: false,
      delivery: (meta.delivery as boolean) ?? false,
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
