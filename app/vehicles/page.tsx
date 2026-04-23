import type { Metadata } from "next";
import { db } from "@/lib/db";
import VehiclesContent from "./VehiclesContent";

export const revalidate = 60;

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
  const { data } = await db
    .from("listings")
    .select("id, user_id, title, category, city, price, image_url, description, metadata")
    .eq("published", true)
    .eq("type", "vehicle")
    .order("created_at", { ascending: false })
    .limit(300);

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

  return <VehiclesContent serverVehicles={serverVehicles} />;
}
