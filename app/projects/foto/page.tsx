import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/foto" },
  title: tMetadata('m_9fc1b0da8fce'),
  description: tMetadata('m_927450d99482'),
};
}

export const revalidate = 300;

export default function FotoPage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "foto",
      label: uiText("projects.catFoto"),
      badge: uiText("projects.catFoto"),
      headline: uiText("Ui.text_024fb0c0128139"),
      highlight: uiText("Ui.text_fc7cbc901be912"),
      description: uiText("Ui.text_be9429042be69c"),
      image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&q=90",
      imagePosition: "center 35%",
      typeKeywords: ["Foto / Shooting"],
    }} />
  );
}
