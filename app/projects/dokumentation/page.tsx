import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.cinegenius.co/projects/dokumentation" },
  title: "Dokumentation & Reportage",
  description: "Dokumentarfilme, Reportagen und Porträt-Dokumentationen — entdecke Doku-Produktionen auf CineGenius.",
};

export const revalidate = 300;

export default function DokumentationPage() {
  return (
    <ProjectCategoryPage config={{
      slug: "dokumentation",
      label: "Dokumentation",
      badge: "Dokumentation",
      headline: "Dokumentarfilm &",
      highlight: "Reportage",
      description: "Gesellschaft, Natur, Geschichte, Menschen — Dokumentarfilme und Reportagen aus dem deutschsprachigen Raum.",
      image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["Dokumentation"],
    }} />
  );
}
