import type { Metadata } from "next";
import { db } from "@/lib/db";
import ProjectsContent from "@/app/projects/ProjectsContent";
import PageHeader from "@/components/PageHeader";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Alle Projekte — CineGenius",
  description: "Alle Filmprojekte & Produktionen auf CineGenius — mit Suche, Filter und Crew-Übersicht.",
};

export default async function AlleProjectsPage() {
  const { data: projects } = await db
    .from("projects")
    .select("id, title, year, type, director, poster_url")
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

  const projectsWithCount = (projects ?? []).map(
    (p: { id: string; title: string; year: number | null; type: string | null; director: string | null; poster_url: string | null }) => ({
      ...p,
      crew_count: creditCounts[p.id] ?? 0,
    })
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        badge="Alle Projekte"
        title="Filmprojekte"
        titleHighlight="& Produktionen"
        description="Alle Kategorien — durchsuche und filtere nach Typ, Jahr und Regie."
        ctaSecondary={{ label: "Zur Projektübersicht", href: "/projects" }}
        cta={{ label: "Projekt erstellen", href: "/projects/neu" }}
      />
      <div className="site-container py-4 sm:py-8">
        <ProjectsContent projects={projectsWithCount} />
      </div>
    </div>
  );
}
