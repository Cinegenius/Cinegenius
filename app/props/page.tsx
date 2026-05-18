import type { Metadata } from "next";
import { db } from "@/lib/db";
import PropsContent from "./PropsContent";
import PageHeader from "@/components/PageHeader";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("props");
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
    vendor: t("vendorPrivate"),
    location: l.city ?? "",
    dailyRate: l.price,
    image: l.image_url ?? "",
    condition: ((l.metadata as Record<string, unknown> | null)?.condition as string) ?? "Gut",
    era: null as string | null,
    delivery: ((l.metadata as Record<string, unknown> | null)?.delivery as boolean) ?? false,
    rentalType: (l.rental_type ?? "miete") as "miete" | "kauf",
    focalPoint: ((l.metadata as Record<string, unknown> | null)?.focal_point as { x: number; y: number } | null) ?? null,
    isReal: true,
    meta: l.metadata ?? null,
  }));

  const { data: vendorData } = await db
    .from("profiles")
    .select("user_id, display_name, location, avatar_url, verified, profile_types")
    .or("profile_types.cs.{equipment},profile_types.cs.{vehicle},profile_types.cs.{props}")
    .not("display_name", "is", null)
    .neq("display_name", "")
    .limit(50);

  const equipmentVendors = (vendorData ?? []).map((p: {
    user_id: string; display_name: string; location: string | null;
    avatar_url: string | null; verified: boolean | null;
  }) => ({
    id: p.user_id,
    name: p.display_name,
    location: p.location ?? "",
    avatar: p.avatar_url ?? "",
    verified: p.verified ?? false,
  }));

  return (
    <div style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(52,211,153,0.03) 0%, transparent 50%)" }}>
      <PageHeader
          badge={t("heroBadge")}
          title={t("heroTitle")}
          titleHighlight={t("heroTitleHighlight")}
          description={t("heroDesc")}
          accentRgb="52,211,153"
          cta={{ label: t("heroCta"), href: "/inserat" }}
        />
      <PropsContent serverListings={serverListings} vendorProfiles={equipmentVendors} />
    </div>
  );
}
