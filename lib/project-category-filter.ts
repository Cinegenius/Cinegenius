// Exact labels from the original project browser's persisted view state.
// These aliases migrate only that known UI format, never arbitrary project data.
const LEGACY_PROJECT_CATEGORY_IDS = {
  "Film & Serie": "film",
  "Werbung": "werbung",
  "Foto & Shooting": "foto",
  "Social Media": "social-media",
  "Musikvideo": "musikvideo",
  "Dokumentation": "dokumentation",
  "Corporate": "corporate",
  "Event & Live": "event",
} as const;

export type ProjectCategoryId = typeof LEGACY_PROJECT_CATEGORY_IDS[keyof typeof LEGACY_PROJECT_CATEGORY_IDS];
const categoryIds = new Set<string>(Object.values(LEGACY_PROJECT_CATEGORY_IDS));

export function canonicalProjectCategoryId(value: unknown): ProjectCategoryId | null {
  if (typeof value !== "string") return null;
  if (categoryIds.has(value)) return value as ProjectCategoryId;
  return Object.hasOwn(LEGACY_PROJECT_CATEGORY_IDS, value)
    ? LEGACY_PROJECT_CATEGORY_IDS[value as keyof typeof LEGACY_PROJECT_CATEGORY_IDS]
    : null;
}

export const PROJECT_CATEGORIES = [
  { id: "film", labelKey: "catFilmSerie" },
  { id: "werbung", labelKey: "catWerbung" },
  { id: "foto", labelKey: "catFoto" },
  { id: "social-media", labelKey: "catSocialMedia" },
  { id: "musikvideo", labelKey: "catMusikvideo" },
  { id: "dokumentation", labelKey: "catDokumentation" },
  { id: "corporate", labelKey: "catCorporate" },
  { id: "event", labelKey: "catEvent" },
] as const;

// The two existing project forms use different labels for the same formats.
// Match those known values consistently without rewriting member content.
const PROJECT_CATEGORY_TYPES: Record<ProjectCategoryId, readonly string[]> = {
  film: ["Spielfilm", "Kurzfilm", "Film", "Serie", "TV / Serie", "TV / Episodic", "Serie / TV"],
  werbung: ["Werbung", "Werbefilm", "Werbefilm / Commercial", "Commercial", "Spot"],
  foto: ["Foto", "Foto / Shooting", "Fotografie", "Fashion Shooting", "Produkt-Shooting", "Event-Fotografie", "Hochzeits-Fotografie", "Portrait-Shooting", "Werbe-Fotografie"],
  "social-media": ["Social Media", "Social Media Content", "Instagram / Reels", "TikTok", "YouTube", "UGC Content", "Brand Content"],
  musikvideo: ["Musikvideo"],
  dokumentation: ["Dokumentation", "Dokumentarfilm", "Reportage"],
  corporate: ["Corporate", "Corporate Film", "Corporate Video", "Imagefilm"],
  event: ["Event", "Event / Live"],
};
const categoryByType = new Map(Object.entries(PROJECT_CATEGORY_TYPES).flatMap(([category, types]) =>
  types.map(type => [type.toLowerCase(), category as ProjectCategoryId] as const)));

export function projectCategoryForType(type: string | null | undefined): ProjectCategoryId | null {
  return categoryByType.get(type?.trim().toLowerCase() ?? "") ?? null;
}
