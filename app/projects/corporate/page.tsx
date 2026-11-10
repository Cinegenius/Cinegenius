import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/corporate" },
  title: tMetadata('m_da64e56798a1'),
  description: tMetadata('m_aa7432d328f0'),
};
}

export const revalidate = 300;

export default function CorporatePage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "corporate",
      label: uiText("projects.catCorporate"),
      badge: uiText("Ui.text_9ba24669d62a92"),
      headline: uiText("Ui.text_d9a596f0bb937a"),
      highlight: uiText("Ui.text_04ca0f1d505a3e"),
      description: uiText("Ui.text_446498b60c53d8"),
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Corporate", "Imagefilm"],
    }} />
  );
}
