import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import { collectFacetRows } from "@/lib/browse-facets";
import { db } from "@/lib/db";
import { placeReadFields } from "@/lib/places/catalog";
import { placeDisplay } from "@/lib/places/core";
import type { Metadata } from "next";
import { getLocale,getTranslations } from "next-intl/server";
import TiereContent from "./TiereContent";

export const revalidate = 60;

export async function generateMetadata():Promise<Metadata> { const t=await getTranslations("FilmAnimals"); return {alternates:{canonical:"https://www.cinegenius.co/tiere"},title:t("portfolio"),description:t("description")}; }

export default async function TierePage() {
  const locale=await getLocale();
  const t = await getTranslations("FilmAnimals");
  const data = await collectFacetRows<Record<string, unknown>>((from, to) => db
    .from("listings")
    .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, user_id, type, title, category, city, price, image_url, description, metadata")
    .eq("published", true)
    .eq("type", "animal")
    .order("created_at", { ascending: false }).order("id")
    .range(from, to));

  const serverListings = (data ?? []).map(raw => { const l = raw as unknown as {
    id: string; title: string; city: string | null; price: number; category: string | null; image_url: string | null; type: string; user_id?: string | null; metadata?: Record<string, unknown> | null;
  }; return ({
    id: l.id,
    title: l.title,
    category: l.category ?? "Sonstige Tiere",
    location: placeDisplay(placeReadFields(l.city??"",l,locale),l.city??"",locale),
    ...placeReadFields(l.city??"",l,locale),
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
  }); });

  return (
    <DirectoryPage area="animals">
      <PageHeader
        withBackdrop={false}
        badge={t("department")}
        title={t("browse")}
        description={t("description")}
        cta={{label:t("addPortfolio"),href:"/inserat?animal=1"}}
      />
      <TiereContent serverListings={serverListings} />
    </DirectoryPage>
  );
}
