import "server-only";
import { db } from "@/lib/db";
import { publicProjectMedia } from "@/lib/project-media-rights";

export type HomeProject = { id: string; title: string; year: number | null; type: string | null; poster_url: string | null; image_credit: string | null };

/** Published projects live in projects; private drafts remain in project_drafts. */
export async function getHomeProjects(): Promise<HomeProject[]> {
  const { data, error } = await db.from("projects")
    .select("id,title,year,type,poster_url,metadata,created_by")
    .order("created_at", { ascending: false }).order("id").limit(12)
    .abortSignal(AbortSignal.timeout(4000));
  if (error) throw new Error("Homepage projects unavailable");
  return (data ?? []).map(row => {
    const project = publicProjectMedia(row);
    return { id: project.id, title: project.title, year: project.year, type: project.type, poster_url: project.poster_url, image_credit: project.image_credit };
  });
}
