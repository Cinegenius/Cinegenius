import type { Metadata } from "next";
import { db } from "@/lib/db";
import PropsContent from "./PropsContent";
import CategoryHero from "@/components/CategoryHero";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Requisiten & Equipment mieten — Film, Foto, Social Media",
  description: "Requisiten, Kameras, Licht, Ton-Equipment, Kostüme, Backdrops und Creator-Sets mieten. Alles für Film, Fotografie und Social Media Produktion.",
  keywords: ["Requisiten mieten", "Filmequipment leihen", "Kamera mieten", "Licht mieten Film", "Kostüme mieten", "Fotoequipment mieten"],
  openGraph: {
    title: "Requisiten & Equipment mieten — CineGenius",
    description: "Equipment für Film, Foto und Social Media — von Privatpersonen und Verleihfirmen.",
  },
};

export default async function PropsPage() {
  const { data } = await db
    .from("listings")
    .select("id, user_id, type, title, category, city, price, image_url, description, metadata")
    .eq("published", true)
    .in("type", ["prop", "vehicle"])
    .order("created_at", { ascending: false })
    .limit(300);

  const serverListings = (data ?? []).map((l: {
    id: string; title: string; city: string; price: number; category: string | null;
    image_url: string | null; rental_type?: string | null; type: string;
    metadata?: Record<string, unknown> | null;
  }) => ({
    id: l.id,
    title: l.title,
    type: l.type,
    category: l.type === "vehicle" ? (l.category ?? "Bild-Fahrzeug") : (l.category ?? "Requisiten"),
    vendor: "Privatanbieter",
    location: l.city ?? "",
    dailyRate: l.price,
    image: l.image_url ?? "",
    condition: ((l.metadata as Record<string, unknown> | null)?.condition as string) ?? "Gut",
    era: null as string | null,
    delivery: ((l.metadata as Record<string, unknown> | null)?.delivery as boolean) ?? false,
    rentalType: (l.rental_type ?? "miete") as "miete" | "kauf",
    isReal: true,
    meta: l.metadata ?? null,
  }));

  return (
    <>
      <div className="pt-16">
        <CategoryHero
          badge="Marktplatz"
          title="Requisiten, Kameras,"
          titleHighlight="Licht & Equipment"
          description="Von Privatpersonen und Verleihfirmen — alles für Film, Fotografie und Social Media Produktion."
          image="https://images.unsplash.com/photo-1431068799455-80bae0caf685?w=1600&q=90"
          imagePosition="center 50%"
          overlay="left"
          height="sm"
          cta={{ label: "Inserat erstellen", href: "/inserat" }}
        />
      </div>
      <PropsContent serverListings={serverListings} />
    </>
  );
}
