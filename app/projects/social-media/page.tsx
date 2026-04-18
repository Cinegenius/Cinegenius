import type { Metadata } from "next";
import ProjectCategoryPage from "@/components/ProjectCategoryPage";

export const metadata: Metadata = {
  title: "Social Media Projekte — CineGenius",
  description: "Instagram Reels, TikTok-Videos, YouTube-Produktionen — Social Media Content Creator auf CineGenius.",
};

export const revalidate = 300;

export default function SocialMediaPage() {
  return (
    <ProjectCategoryPage config={{
      slug: "social-media",
      label: "Social Media",
      badge: "Social Media",
      headline: "Content &",
      highlight: "Social Media",
      description: "Instagram Reels, TikTok, YouTube, Podcasts — Content-Projekte von Creatorn und Influencern.",
      image: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1600&q=90",
      imagePosition: "center 40%",
      typeKeywords: ["social", "tiktok", "instagram", "reel", "youtube", "content", "podcast", "influencer"],
    }} />
  );
}
