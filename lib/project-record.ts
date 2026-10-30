import { publicProjectMedia } from "@/lib/project-media-rights";
/** Columns guaranteed by supabase/migrations/projects.sql and project_drafts.sql. */
export const PROJECT_RECORD_COLUMNS =
  "id, title, year, type, description, director, poster_url, images, created_by, created_at, updated_at, metadata";

/** Optional detail fields are kept in projects.metadata for schema compatibility. */
export const PROJECT_DETAIL_METADATA_FIELDS = [
  "alt_title",
  "verified",
  "status",
  "logline",
  "synopsis",
  "genres",
  "language",
  "country",
  "runtime_minutes",
  "production_company",
  "co_producers",
  "shoot_locations",
  "prep_start",
  "prep_end",
  "shoot_start",
  "shoot_end",
  "post_start",
  "post_end",
  "release_cinema",
  "release_cinema_countries",
  "release_streaming",
  "release_tv",
  "trailer_url",
  "teaser_url",
] as const;

export type ProjectDetailMetadataField = (typeof PROJECT_DETAIL_METADATA_FIELDS)[number];

export type ProjectRecord = {
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  description: string | null;
  director: string | null;
  poster_url: string | null;
  images: string[];
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: unknown;
  alt_title?: string | null;
  verified?: boolean | null;
  status?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  genres?: string[] | null;
  language?: string | null;
  country?: string | null;
  runtime_minutes?: number | null;
  production_company?: string | null;
  co_producers?: string[] | null;
  shoot_locations?: string[] | null;
  prep_start?: string | null;
  prep_end?: string | null;
  shoot_start?: string | null;
  shoot_end?: string | null;
  post_start?: string | null;
  post_end?: string | null;
  release_cinema?: string | null;
  release_cinema_countries?: string[] | null;
  release_streaming?: Array<{ platform: string; date: string; url: string | null; territory: string | null }> | null;
  release_tv?: Array<{ channel: string; date: string; territory: string | null; notes: string | null }> | null;
  trailer_url?: string | null;
  teaser_url?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Map supported detail metadata back to the flat shape used by ProjectDetail. */
export function projectRecordWithDetails(project: Record<string, unknown>): ProjectRecord {
  const metadata = asRecord(project.metadata);
  const nestedDetails = asRecord(metadata.project_details);
  const merged: Record<string, unknown> = { ...project };

  for (const field of PROJECT_DETAIL_METADATA_FIELDS) {
    const value = nestedDetails[field] ?? metadata[field];
    if (value !== undefined) merged[field] = value;
  }

  // Older project drafts stored a single genre at the metadata root.
  if (merged.genres === undefined && typeof metadata.genre === "string" && metadata.genre.trim()) {
    merged.genres = [metadata.genre.trim()];
  }

  return merged as unknown as ProjectRecord;
}

/** Internal ownership and draft bookkeeping must never be serialized publicly. */
export function toPublicProjectRecord(project: Record<string, unknown>): Omit<ProjectRecord, "created_by" | "metadata"> {
  const merged = projectRecordWithDetails(project);
  return publicProjectMedia(merged) as Omit<ProjectRecord, "created_by" | "metadata">;
}

export function isProjectId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
