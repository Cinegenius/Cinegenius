import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { sanitizeProjectDraftData } from "@/lib/project-drafts";
import { PROJECT_RECORD_COLUMNS, projectRecordWithDetails } from "@/lib/project-record";

export async function saveProjectDraft(userId: string, input: {
  sourceProjectId?: string | null;
  draftData: unknown;
}) {
  const translate = await getTranslations();
  const patch = sanitizeProjectDraftData(input.draftData);
  const serialized = JSON.stringify(patch);
  if (serialized.length > 250_000) return { error: translate("System.draftTooLarge"), status: 413 as const };

  let sourceProject: Record<string, unknown> | null = null;
  if (input.sourceProjectId) {
    const { data, error } = await db.from("projects")
      .select(PROJECT_RECORD_COLUMNS)
      .eq("id", input.sourceProjectId).eq("created_by", userId).maybeSingle();
    if (error) return { error: translate("System.m_f688eb6d8477"), status: 500 as const };
    if (!data) return { error: translate("System.m_248ba736f0b3"), status: 404 as const };
    sourceProject = projectRecordWithDetails(data as Record<string, unknown>);
  }

  let existingDraft: { id: string; draft_data: Record<string, unknown> | null } | null = null;
  if (input.sourceProjectId) {
    const { data, error } = await db.from("project_drafts")
      .select("id, draft_data")
      .eq("user_id", userId)
      .eq("source_project_id", input.sourceProjectId)
      .is("published_project_id", null)
      .maybeSingle();
    if (error) return { error: translate("System.m_4bb7a67aea1b"), status: 500 as const };
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
    return { error: translate("System.draftTitleRequired"), status: 400 as const };
  }
  if (JSON.stringify(draftData).length > 250_000) return { error: translate("System.draftTooLarge"), status: 413 as const };

  const values = {
    user_id: userId,
    source_project_id: input.sourceProjectId ?? null,
    draft_data: draftData,
    updated_at: new Date().toISOString(),
  };
  const result = existingDraft
    ? await db.from("project_drafts").update(values).eq("id", existingDraft.id).eq("user_id", userId).select("id, draft_data, source_project_id, created_at, updated_at").single()
    : await db.from("project_drafts").insert(values).select("id, draft_data, source_project_id, created_at, updated_at").single();

  if (result.error || !result.data) return { error: translate("System.m_6a45e8145d0e"), status: 500 as const };
  return { draft: result.data };
}
