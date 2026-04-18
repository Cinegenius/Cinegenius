import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Dokumentation & Reportage — CineGenius",
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
      image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1600&q=90",
      imagePosition: "center 45%",
      typeKeywords: ["dokumentation", "dokumentar", "reportage", "doku", "portrait"],
    }} />
  );
}
