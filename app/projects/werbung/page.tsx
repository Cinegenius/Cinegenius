import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Werbung & Commercial — CineGenius",
  description: "Werbefilme, TV-Spots und Commercials — entdecke Produktionen auf CineGenius.",
};

export const revalidate = 300;

export default function WerbungPage() {
  return (
    <ProjectCategoryPage config={{
      slug: "werbung",
      label: "Werbung",
      badge: "Werbung & Commercial",
      headline: "Werbefilm &",
      highlight: "Commercial",
      description: "TV-Spots, Online-Ads, Imagefilme — Werbeprojekte von Agenturen und Produktionsfirmen im DACH-Raum.",
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["werbefilm", "werbung", "commercial", "spot", "imagefilm"],
    }} />
  );
}
