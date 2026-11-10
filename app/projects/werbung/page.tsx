import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/werbung" },
  title: tMetadata('m_6f46d6cca2e4'),
  description: tMetadata('m_e0d7d25f0d54'),
};
}

export const revalidate = 300;

export default function WerbungPage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "werbung",
      label: uiText("home.showcaseAds"),
      badge: uiText("Ui.text_6f46d6cca2e4d8"),
      headline: uiText("Ui.text_0ecb23931db09f"),
      highlight: uiText("Ui.text_ea7d0b7634355f"),
      description: uiText("Ui.text_e29244a02efc2d"),
      image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1600&q=90",
      imagePosition: "center 50%",
      typeKeywords: ["Werbefilm"],
    }} />
  );
}
