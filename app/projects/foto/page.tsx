import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Foto & Shooting Projekte — CineGenius",
  description: "Fotoprojekte, Editorial-Shootings und Kampagnen — entdecke Fotografen und ihre Arbeit.",
};

export const revalidate = 300;

export default function FotoPage() {
  return (
    <ProjectCategoryPage config={{
      slug: "foto",
      label: "Foto & Shooting",
      badge: "Foto & Shooting",
      headline: "Fotografie &",
      highlight: "Shooting",
      description: "Editorial, Portrait, Commercial Shooting, Kampagnen — Fotoprojekte von Fotografen aus Deutschland, Österreich und der Schweiz.",
      image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&q=90",
      imagePosition: "center 35%",
      typeKeywords: ["foto", "shooting", "fotografie", "editorial", "portrait", "kampagne"],
    }} />
  );
}
