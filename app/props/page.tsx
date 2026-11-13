import { placeReadFields } from "@/lib/places/catalog";
import { db } from "@/lib/db";
import { marketplaceCardData } from "@/lib/marketplace-browse";
import PropsContent from "./PropsContent";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import { getTranslations, getLocale } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

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
      vendor: t("vendorPrivate"),
    }));
  } catch {
    serverError = true;
  }

  return (
    <DirectoryPage area="marketplace">
      <PageHeader
        withBackdrop={false}
        badge={t("heroBadge")}
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={t("heroDesc")}
        cta={{ label: t("heroCta"), href: "/inserat?group=marktplatz" }}
      />
      <PropsContent serverListings={serverListings} serverError={serverError} />
    </DirectoryPage>
  );
}
