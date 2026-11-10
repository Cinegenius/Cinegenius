import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/film" },
  title: tMetadata('m_0d05fdbb754f'),
  description: tMetadata('m_55f5b0a6c41c'),
};
}

export const revalidate = 300;

export default function FilmPage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "film",
      label: uiText("projects.catFilmSerie"),
      badge: uiText("projects.catFilmSerie"),
      headline: uiText("Ui.text_7034f37afe3b4e"),
      highlight: uiText("Ui.text_9107d0d55c5455"),
      description: uiText("Ui.text_d347b571ff9f23"),
      image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Spielfilm", "Kurzfilm", "Serie"],
    }} />
  );
}
