import { getLocale, getTranslations } from "next-intl/server";
import {placeReadFields} from "@/lib/places/catalog";
import { db } from "@/lib/db";
import PropsContent from "@/app/props/PropsContent";
import PageHeader from "@/components/PageHeader";
import { marketplaceCardData } from "@/lib/marketplace-browse";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export const revalidate = 60;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/vehicles" },
  title: tMetadata('m_fa2435096125'),
  description: tMetadata('m_47fa659ef18c'),
  keywords: [tMetadata('m_b529927fe8e7'), tMetadata('m_3a53fe2a687a'), tMetadata('m_e8394cb4ca66'), tMetadata('m_756f8a76f3f9'), tMetadata('m_92a6c6a6ae60')],
  openGraph: {
    title: tMetadata('m_28b9791b7533'),
    description: tMetadata('m_541269017187'),
  },
};
}

export default async function VehiclesPage() {
  const locale = await getLocale();
  const t = await getTranslations();
  let rows: ReturnType<typeof marketplaceCardData>[] = [];
  let serverError = false;
  try {
  const { data, error } = await db.from("listings")
    .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,type,title,category,city,price,image_url,description,created_at,marketplace:metadata->marketplace,rental_type:metadata->>rental_type,price_on_request:metadata->price_on_request,price_negotiable:metadata->price_negotiable,condition:metadata->>condition,delivery:metadata->delivery,focal_point:metadata->focal_point")
    .eq("published", true).eq("type", "vehicle")
    .order("created_at", { ascending: false }).limit(300);
  serverError = !!error;
  if (!error) rows = (data ?? []).map(row => ({
    ...marketplaceCardData(row),
    ...placeReadFields(String(row.city ?? ""), row, locale),
  }));
  } catch {
    serverError = true;
  }
  return <div className="min-h-screen bg-bg-primary">
    <PageHeader badge={t("props.heroBadge")} title={t("props.heroTitle")} titleHighlight={t("props.heroTitleHighlight")}
      description={t("props.heroDesc")}
      cta={{ label: t("props.heroCta"), href: "/inserat?group=marktplatz" }} />
    <PropsContent serverListings={rows} serverError={serverError} initialDepartment="fahrzeuge" />
  </div>;
}
