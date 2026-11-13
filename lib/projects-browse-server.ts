import { countryCode } from "@/lib/places/core";
import { projectRecordWithDetails } from "@/lib/project-record";
import { db } from "@/lib/db";
import { publicProjectMedia } from "@/lib/project-media-rights";
import type { BrowseProject } from "@/lib/projects-browse";

/** One public projection for the overview and every category. Drafts stay separate. */
export async function getBrowseProjects(): Promise<BrowseProject[]> {
  const projects: BrowseProject[] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("projects")
      .select("id, title, year, type, director, poster_url, metadata, created_by, created_at, updated_at")
      .order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to load the public project directory.");
    for (const raw of data ?? []) {
      const project = publicProjectMedia(raw);
      const country = projectRecordWithDetails(raw).country;
      projects.push({ place_country_code: countryCode(typeof country === "string" ? country : ""), id: project.id, title: project.title, year: project.year, type: project.type,
        director: project.director, poster_url: project.poster_url, created_at: project.created_at,
        updated_at: project.updated_at, crew_count: 0 });
    }
    if (!data || data.length < pageSize) break;
  }

  const counts = new Map<string, number>();
  for (let start = 0; start < projects.length; start += 100) {
    const ids = projects.slice(start, start + 100).map(project => project.id);
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await db.from("project_credits").select("project_id")
        .in("project_id", ids).order("id").range(offset, offset + pageSize - 1);
      if (error) throw new Error("Unable to load public project credit counts.");
      for (const credit of data ?? []) counts.set(credit.project_id, (counts.get(credit.project_id) ?? 0) + 1);
      if (!data || data.length < pageSize) break;
    }
  }
  return projects.map(project => ({ ...project, crew_count: counts.get(project.id) ?? 0 }));
}
