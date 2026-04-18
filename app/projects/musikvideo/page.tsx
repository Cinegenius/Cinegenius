import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Musikvideo Projekte — CineGenius",
  description: "Musikvideos, Konzertfilme und Künstler-Visuals — entdecke Musikvideo-Produktionen auf CineGenius.",
};

export const revalidate = 300;

export default function MusikvideoPAge() {
  return (
    <ProjectCategoryPage config={{
      slug: "musikvideo",
      label: "Musikvideo",
      badge: "Musikvideo",
      headline: "Musikvideos &",
      highlight: "Künstler-Content",
      description: "Klassische Musikvideos, Lyric-Videos, Live-Performances und Künstler-Dokumentationen.",
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["musikvideo", "musik", "video", "konzert", "band", "artist"],
    }} />
  );
}
