import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Corporate & Business Film — CineGenius",
  description: "Unternehmensfilme, Imagevideos und Erklärfilme — Corporate-Produktionen auf CineGenius.",
};

export const revalidate = 300;

export default function CorporatePage() {
  return (
    <ProjectCategoryPage config={{
      slug: "corporate",
      label: "Corporate",
      badge: "Corporate & Business",
      headline: "Corporate Film &",
      highlight: "Business Content",
      description: "Imagefilme, Unternehmensporträts, Erklärvideos, Employer Branding — professionelle Business-Produktionen.",
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["corporate", "business", "imagevideo", "imagefilm", "erklärvideo", "employer", "unternehmen"],
    }} />
  );
}
