import { getDirectoryCompanies } from "@/lib/company-directory";
import CompaniesContent from "./CompaniesContent";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import { getTranslations, getLocale } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/companies" },
  title: tMetadata('m_cc80fbf924d3'),
  description: tMetadata('m_1b2ce26676e9'),
  keywords: [tMetadata('m_35e0b9cc4343'), tMetadata('m_3f3c21f3b5ce'), tMetadata('m_361f572abb14'), tMetadata('m_ffe45f73aa12'), tMetadata('m_1b5f6ec47e09'), tMetadata('m_c9e8ac833195')],
  openGraph: {
    title: tMetadata('m_5ae3e68f520c'),
    description: tMetadata('m_e27ac870c83e'),
  },
};
}

export const revalidate = 60;

export default async function CompaniesPage() {
  const locale = await getLocale();
  const t = await getTranslations("companies");
  const companies = await getDirectoryCompanies(locale);

  return (
    <DirectoryPage area="companies">
      <PageHeader
        withBackdrop={false}
        badge={t("badge")}
        title={t("title")}
        titleHighlight={t("titleHighlight")}
        description={t("description")}
        cta={{ label: t("addCompany"), href: "/company-setup" }}
      />
      <CompaniesContent initialCompanies={companies} />
    </DirectoryPage>
  );
}
