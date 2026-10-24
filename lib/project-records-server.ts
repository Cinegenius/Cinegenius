import { db } from "@/lib/db";
import { isProjectId, PROJECT_RECORD_COLUMNS, projectRecordWithDetails, type ProjectRecord } from "@/lib/project-record";

export async function getProjectRecord(id: string) {
  if (!isProjectId(id)) return { kind: "not_found" as const };

  const { data, error } = await db
    .from("projects")
    .select(PROJECT_RECORD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) return { kind: "error" as const, error };
  if (!data) return { kind: "not_found" as const };

  return { kind: "found" as const, project: projectRecordWithDetails(data as Record<string, unknown>) as ProjectRecord & Record<string, unknown> };
}
