import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Event & Live Produktionen — CineGenius",
  description: "Eventfilme, Live-Mitschnitte, Konzertproduktionen — Event-Content auf CineGenius.",
};

export const revalidate = 300;

export default function EventPage() {
  return (
    <ProjectCategoryPage config={{
      slug: "event",
      label: "Event & Live",
      badge: "Event & Live",
      headline: "Event &",
      highlight: "Live Production",
      description: "Konzerte, Festivals, Hochzeiten, Sportevents — Live-Mitschnitte, Hochzeitsfilme und Event-Dokumentationen.",
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["event", "live", "konzert", "festival", "sport", "konferenz", "messe", "hochzeit", "wedding", "feier", "standesamt", "trauung"],
    }} />
  );
}
