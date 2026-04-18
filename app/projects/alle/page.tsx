import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ProjectsContent from "@/app/projects/ProjectsContent";
import CategoryHero from "@/components/CategoryHero";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alle Projekte — CineGenius",
  description: "Alle Filmprojekte & Produktionen auf CineGenius — mit Suche, Filter und Crew-Übersicht.",
};

export default async function AlleProjectsPage() {
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, title, year, type, director, poster_url")
    .order("year", { ascending: false })
    .limit(200);

  const ids = (projects ?? []).map((p: { id: string }) => p.id);
  let creditCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: counts } = await supabaseAdmin
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
    <div className="pt-16">
      <CategoryHero
        badge="Alle Projekte"
        title="Filmprojekte"
        titleHighlight="& Produktionen"
        description="Alle Kategorien — durchsuche und filtere nach Typ, Jahr und Regie."
        image="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&q=90"
        imagePosition="center 50%"
        overlay="left"
        height="sm"
      />
      <ProjectsContent projects={projectsWithCount} />
    </div>
  );
}
