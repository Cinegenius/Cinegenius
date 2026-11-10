import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/musikvideo" },
  title: tMetadata('m_56b34bfb74b4'),
  description: tMetadata('m_7dce38b60508'),
};
}

export const revalidate = 300;

export default function MusikvideoPAge() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "musikvideo",
      label: uiText("projects.catMusikvideo"),
      badge: uiText("projects.catMusikvideo"),
      headline: uiText("Ui.text_1fa1cc716e3e79"),
      highlight: uiText("Ui.text_98b3b454dc4998"),
      description: uiText("Ui.text_a5124038b88003"),
      image: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Musikvideo"],
    }} />
  );
}
