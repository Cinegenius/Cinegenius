import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PropsContent from "./PropsContent";
import CategoryHero from "@/components/CategoryHero";
import ProviderProfiles from "@/components/ProviderProfiles";

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
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("published", true)
    .in("type", ["prop", "vehicle"])
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
    condition: "Gut",
    era: null as string | null,
    delivery: ((l.metadata as Record<string, unknown> | null)?.delivery as boolean) ?? false,
    rentalType: (l.rental_type ?? "miete") as "miete" | "kauf",
    isReal: true,
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
      <ProviderProfiles profiles={equipmentProviders} heading="Equipment-Anbieter mit Profil" />
      <PropsContent serverListings={serverListings} />
    </>
  );
}
