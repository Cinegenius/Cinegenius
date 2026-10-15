import { db } from "@/lib/db";
import { sanitizeProjectDraftData } from "@/lib/project-drafts";

export async function saveProjectDraft(userId: string, input: {
  sourceProjectId?: string | null;
  draftData: unknown;
}) {
  const patch = sanitizeProjectDraftData(input.draftData);
  const serialized = JSON.stringify(patch);
  if (serialized.length > 250_000) return { error: "Der Entwurf ist zu groß." as const, status: 413 as const };

  let sourceProject: Record<string, unknown> | null = null;
  if (input.sourceProjectId) {
    const { data, error } = await db.from("projects")
      .select("id, title, year, type, description, director, poster_url, images, metadata, status, logline, production_company, runtime_minutes, trailer_url, release_cinema, release_streaming, release_tv, prep_start, prep_end, shoot_start, shoot_end, post_start, post_end")
      .eq("id", input.sourceProjectId).eq("created_by", userId).maybeSingle();
    if (error) return { error: "Projekt konnte nicht geladen werden." as const, status: 500 as const };
    if (!data) return { error: "Projekt nicht gefunden oder keine Berechtigung." as const, status: 404 as const };
    sourceProject = data as Record<string, unknown>;
  }

  let existingDraft: { id: string; draft_data: Record<string, unknown> | null } | null = null;
  if (input.sourceProjectId) {
    const { data, error } = await db.from("project_drafts")
      .select("id, draft_data")
      .eq("user_id", userId)
      .eq("source_project_id", input.sourceProjectId)
      .is("published_project_id", null)
      .maybeSingle();
    if (error) return { error: "Projektentwurf konnte nicht geladen werden." as const, status: 500 as const };
    existingDraft = data;
  }

  const base = existingDraft?.draft_data ?? sourceProject ?? {};
  const draftData = { ...base, ...patch };
  if ("genre" in patch) {
    const metadata = typeof draftData.metadata === "object" && draftData.metadata !== null && !Array.isArray(draftData.metadata)
      ? { ...(draftData.metadata as Record<string, unknown>) }
      : {};
    metadata.genre = patch.genre;
    draftData.metadata = metadata;
  }
  if (typeof draftData.title !== "string" || !draftData.title.trim()) {
    return { error: "Titel ist Pflichtfeld." as const, status: 400 as const };
  }
  if (JSON.stringify(draftData).length > 250_000) return { error: "Der Entwurf ist zu groß." as const, status: 413 as const };

  const values = {
    user_id: userId,
    source_project_id: input.sourceProjectId ?? null,
    draft_data: draftData,
    updated_at: new Date().toISOString(),
  };
  const result = existingDraft
    ? await db.from("project_drafts").update(values).eq("id", existingDraft.id).eq("user_id", userId).select("id, draft_data, source_project_id, created_at, updated_at").single()
    : await db.from("project_drafts").insert(values).select("id, draft_data, source_project_id, created_at, updated_at").single();

  if (result.error || !result.data) return { error: "Projektentwurf konnte nicht gespeichert werden." as const, status: 500 as const };
  return { draft: result.data };
}
