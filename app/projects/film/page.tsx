import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Film & Serie Projekte — CineGenius",
  description: "Spielfilme, Kurzfilme und Serien auf CineGenius — entdecke Produktionen und trag dein Projekt ein.",
};

export const revalidate = 300;

export default function FilmPage() {
  return (
    <ProjectCategoryPage config={{
      slug: "film",
      label: "Film & Serie",
      badge: "Film & Serie",
      headline: "Spielfilm, Kurzfilm",
      highlight: "& Serie",
      description: "Von Kurzfilm bis Spielfilm, von Indie-Produktion bis zur Streaming-Serie — Filmprojekte aus der DACH-Region.",
      image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1600&q=90",
      imagePosition: "center 50%",
      typeKeywords: ["spielfilm", "kurzfilm", "serie", "film"],
    }} />
  );
}
