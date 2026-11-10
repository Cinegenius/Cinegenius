import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";
import { useTranslations } from "next-intl";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/social-media" },
  title: tMetadata('m_e94000a7a0e5'),
  description: tMetadata('m_ee57f3b65dd4'),
};
}

export const revalidate = 300;

export default function SocialMediaPage() {
  const uiText = useTranslations();

  return (
    <ProjectCategoryPage config={{
      slug: "social-media",
      label: uiText("home.showcaseSocial"),
      badge: uiText("home.showcaseSocial"),
      headline: uiText("Ui.text_b9820164753058"),
      highlight: uiText("home.showcaseSocial"),
      description: uiText("Ui.text_bf499537622938"),
      image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Social Media"],
    }} />
  );
}
