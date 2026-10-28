import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import TiereContent from "./TiereContent";

export const revalidate = 60;

export async function generateMetadata():Promise<Metadata> { const t=await getTranslations("FilmAnimals"); return {title:t("portfolio"),description:t("description")}; }

export default async function TierePage() {
  const t = await getTranslations("FilmAnimals");
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
    user_id?: string | null;
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
    ownerId: l.user_id ?? undefined,
  }));

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge={t("department")}
        title={t("browse")}
        description={t("description")}
        cta={{label:t("addPortfolio"),href:"/inserat?animal=1"}}
      />
      <div className="site-container py-4 sm:py-8">
        <TiereContent serverListings={serverListings} />
      </div>
    </div>
  );
}
