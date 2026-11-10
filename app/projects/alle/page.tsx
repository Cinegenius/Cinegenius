import { publicProjectMedia } from "@/lib/project-media-rights";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import ProjectsContent from "@/app/projects/ProjectsContent";
import PageHeader from "@/components/PageHeader";
import { getTranslations } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";


export const revalidate = 300;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/projects/alle" },
  title: tMetadata('m_1e8f7f76eb11'),
  description: tMetadata('m_59b147ab3a40'),
};
}

export default async function AlleProjectsPage() {
  const uiText = await getTranslations();

  const { data: projects } = await db
    .from("projects")
    .select("id, title, year, type, director, poster_url, metadata, created_by")
    .order("year", { ascending: false })
    .limit(200);

  const ids = (projects ?? []).map((p: { id: string }) => p.id);
  let creditCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: counts } = await db
      .from("project_credits")
      .select("project_id")
      .in("project_id", ids);
    creditCounts = (counts ?? []).reduce(
      (acc: Record<string, number>, c: { project_id: string }) => {
        acc[c.project_id] = (acc[c.project_id] ?? 0) + 1;
        return acc;
      },
      {}
    );
  }

  const projectsWithCount = (projects ?? []).map(project => publicProjectMedia(project)).map(
    (p: { id: string; title: string; year: number | null; type: string | null; director: string | null; poster_url: string | null }) => ({
      ...p,
      crew_count: creditCounts[p.id] ?? 0,
    })
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge={uiText("common.allProjects")}
        title={uiText("Ui.text_1a37db69ee45a0")}
        titleHighlight="& Produktionen"
        description={uiText("Ui.text_e88d83ff804e78")}
        ctaSecondary={{ label: uiText("Ui.text_db09b1e12e0d66"), href: "/projects" }}
        cta={{ label: uiText("home.pillarProjectsCta"), href: "/projects/neu" }}
      />
      <div className="site-container py-4 sm:py-8">
        <ProjectsContent projects={projectsWithCount} />
      </div>
    </div>
  );
}
