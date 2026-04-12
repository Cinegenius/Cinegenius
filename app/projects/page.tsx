import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ProjectsContent from "./ProjectsContent";
import CategoryHero from "@/components/CategoryHero";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projekte — CineGenius",
  description: "Filmprojekte & Produktionen auf CineGenius — mit Suche, Filter und Crew-Übersicht.",
};

export default async function ProjectsPage() {
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, title, year, type, director, poster_url")
    .order("year", { ascending: false })
    .limit(200);

  // Poster strip — only real user-uploaded posters, shuffled
  const posterImages = (projects ?? [])
    .filter((p: { poster_url: string | null }) =>
      p.poster_url?.includes("supabase.co/storage")
    )
    .map((p: { id: string; title: string; poster_url: string }) => ({ src: p.poster_url, alt: p.title, href: `/projects/${p.id}` }))
    .sort((a, b) => a.alt.localeCompare(b.alt)); // stable sort, shuffle handled client-side

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
        badge="Projekte"
        title="Filmprojekte"
        titleHighlight="& Produktionen"
        description="Dokumentiere deine Arbeit, trage dein Team ein und zeig der Welt was du machst."
        image="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&q=90"
        imagePosition="center 50%"
        overlay="left"
        height="sm"
      />
      <ProjectsContent projects={projectsWithCount} />
    </div>
  );
}
