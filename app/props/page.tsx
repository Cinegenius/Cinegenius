import PageHeader from "@/components/PageHeader";
import { db } from "@/lib/db";
import { marketplaceCardData } from "@/lib/marketplace-browse";
import { marketplaceFacetRows } from "@/lib/marketplace-facets";
import { placeReadFields } from "@/lib/places/catalog";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { getLocale,getTranslations as getMetadataTranslations,getTranslations } from "next-intl/server";
import PropsContent from "./PropsContent";

export const revalidate = 60;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/props" },
  title: tMetadata('m_afa315365274'),
  description: tMetadata('m_22a04084bf9d'),
  keywords: [tMetadata('m_cb9a7dde6c1c'), tMetadata('m_44e1c8b7ba50'), tMetadata('m_d34a5b74859b'), tMetadata('m_30574e214957'), tMetadata('m_4bb65bc9ff2c'), tMetadata('m_cd14c6eba3f1')],
  openGraph: {
    title: tMetadata('m_71e2b180d033'),
    description: tMetadata('m_7d4038ca4329'),
  },
};
}

export default async function PropsPage() {
  const locale = await getLocale();
  const t = await getTranslations("props");
  let serverListings: ReturnType<typeof marketplaceCardData>[] = [];
  let serverError = false;
  const facetRows = await marketplaceFacetRows(locale);
  try {
    const { data, error } = await db
      .from("listings")
      .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,type,title,category,city,price,image_url,description,created_at,price_negotiable:metadata->price_negotiable,price_on_request:metadata->price_on_request,rental_type:metadata->>rental_type,marketplace:metadata->marketplace,condition:metadata->>condition,delivery:metadata->delivery,focal_point:metadata->focal_point")
      .eq("published", true)
      .in("type", ["prop", "vehicle"])
      .order("created_at", { ascending: false })
      .limit(300);
    serverError = !!error;
    if (!error) serverListings = (data ?? []).map((row: Record<string, unknown>) => ({
      ...marketplaceCardData(row),
      ...placeReadFields(String(row.city ?? ""), row, locale),
      ...publicMapPoint(row),
      vendor: t("vendorPrivate"),
    }));
  } catch {
    serverError = true;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge={t("heroBadge")}
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={t("heroDesc")}
        cta={{ label: t("heroCta"), href: "/inserat?group=marktplatz" }}
      />
      <PropsContent facetRows={facetRows} serverListings={serverListings} serverError={serverError} />
    </div>
  );
}
