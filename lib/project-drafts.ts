import { PROJECT_DETAIL_METADATA_FIELDS } from "@/lib/project-record";

const ALLOWED_DRAFT_FIELDS = new Set([
  "title", "year", "type", "description", "director", "poster_url", "images",
  "myRole", "genre", "productionCompany", "location", "equipment", "link", "alsoOnCrewUnited",
  "linked_companies", "linked_locations", "crew_entries", "status", "logline", "runtime_minutes",
  "trailer_url", "release_cinema", "release_streaming", "release_tv", "production_company", "prep_start", "prep_end",
  "shoot_start", "shoot_end", "post_start", "post_end", ...PROJECT_DETAIL_METADATA_FIELDS.filter((field) => field !== "verified"),
]);

export function sanitizeProjectDraftData(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_DRAFT_FIELDS.has(key)) continue;
    if (key === "crew_entries") {
      output[key] = Array.isArray(value)
        ? value.slice(0, 40).flatMap((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
          const candidate = entry as { name?: unknown; role?: unknown };
          if (typeof candidate.name !== "string" || typeof candidate.role !== "string") return [];
          const name = candidate.name.trim().slice(0, 100);
          const role = candidate.role.trim().slice(0, 100);
          return name && role ? [{ name, role }] : [];
        })
        : [];
      continue;
    }
    output[key] = value;
  }
  return output;
}

export function projectDraftMetadata(data: Record<string, unknown>, draftId: string) {
  const metadata = typeof data.metadata === "object" && data.metadata !== null && !Array.isArray(data.metadata)
    ? { ...(data.metadata as Record<string, unknown>) }
    : {};
  const mapping: Record<string, string> = {
    genre: "genre",
    productionCompany: "production_company",
    location: "location",
    equipment: "equipment",
    link: "link",
    alsoOnCrewUnited: "also_on_crew_united",
    linked_companies: "linked_companies",
    linked_locations: "linked_locations",
    crew_entries: "crew_entries",
  };
  for (const [source, target] of Object.entries(mapping)) {
    if (source in data) metadata[target] = data[source];
  }

  const projectDetails = typeof metadata.project_details === "object" && metadata.project_details !== null && !Array.isArray(metadata.project_details)
    ? { ...(metadata.project_details as Record<string, unknown>) }
    : {};
  for (const field of PROJECT_DETAIL_METADATA_FIELDS) {
    if (field in data) projectDetails[field] = data[field];
  }
  if (Object.keys(projectDetails).length > 0) metadata.project_details = projectDetails;

  metadata.draft_id = draftId;
  return metadata;
}
