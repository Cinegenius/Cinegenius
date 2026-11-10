import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/event" },
  title: tMetadata('m_f6f83e4fa843'),
  description: tMetadata('m_fd8a7324fe0c'),
};
}

export const revalidate = 300;

export default function EventPage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "event",
      label: uiText("projects.catEvent"),
      badge: uiText("projects.catEvent"),
      headline: uiText("Ui.text_56cf7354f34638"),
      highlight: uiText("Ui.text_a6b9ba304dcd32"),
      description: uiText("Ui.text_a8003f5ab0377c"),
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Event"],
    }} />
  );
}
