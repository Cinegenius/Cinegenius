import type { Metadata } from "next";
import { db } from "@/lib/db";
import CategoryHero from "@/components/CategoryHero";
import TiereContent from "./TiereContent";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Film-Tiere mieten — Hunde, Pferde, Katzen & mehr für Produktion",
  description: "Ausgebildete Film-Tiere buchen: Hunde, Pferde, Katzen, Vögel, Reptilien, Nutztiere und Exoten für Film, Werbung und Fotoproduktionen.",
  keywords: ["Film Tiere", "Hund Filmset", "Pferd Produktion", "Tier mieten Film", "Filmtier buchen", "Tier Werbung"],
  openGraph: {
    title: "Film-Tiere für Produktion — CineGenius",
    description: "Ausgebildete Tiere für Filmproduktionen, Werbung und Fotoshootings buchen.",
  },
};

export default async function TierePage() {
  const { data } = await db
    .from("listings")
    .select("id, user_id, type, title, category, city, price, image_url, description, metadata")
    .eq("published", true)
    .eq("type", "animal")
    .order("created_at", { ascending: false })
    .limit(300);

  const serverListings = (data ?? []).map((l: {
    id: string; title: string; city: string | null; price: number;
    category: string | null; image_url: string | null; type: string;
    metadata?: Record<string, unknown> | null;
  }) => ({
    id: l.id,
    title: l.title,
    category: l.category ?? "Sonstige Tiere",
    location: l.city ?? "",
    dailyRate: l.price,
    image: l.image_url ?? "",
    trainingLevel: (l.metadata?.training_level as string) ?? null,
    handlerIncluded: (l.metadata?.handler_included as boolean) ?? false,
    count: (l.metadata?.count as string) ?? "1 Tier",
    specialSkills: (l.metadata?.special_skills as string) ?? null,
    delivery: (l.metadata?.delivery as boolean) ?? false,
    focalPoint: (l.metadata?.focal_point as { x: number; y: number } | null) ?? null,
    description: "",
  }));

  return (
    <>
      <CategoryHero
        badge="Film-Tiere"
        title="Ausgebildete Tiere"
        titleHighlight="für deine Produktion"
        description="Von dressierten Hunden bis zu exotischen Tieren — finde den perfekten vierbeinigen Star für deinen Film, deine Werbung oder dein Fotoshooting."
        image="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1600&q=90"
        imagePosition="center 40%"
        overlay="left"
        height="sm"
        cta={{ label: "Tier inserieren", href: "/inserat" }}
      />
      <TiereContent serverListings={serverListings} />
    </>
  );
}
