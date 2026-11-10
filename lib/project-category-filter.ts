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
