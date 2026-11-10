import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/dokumentation" },
  title: tMetadata('m_4a9ce0d5d82f'),
  description: tMetadata('m_60be67bdce8d'),
};
}

export const revalidate = 300;

export default function DokumentationPage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "dokumentation",
      label: uiText("projects.catDokumentation"),
      badge: uiText("projects.catDokumentation"),
      headline: uiText("Ui.text_979b7c79cf879b"),
      highlight: uiText("Ui.text_0edd63bebac187"),
      description: uiText("Ui.text_4ac111d29e670e"),
      image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Dokumentation"],
    }} />
  );
}
