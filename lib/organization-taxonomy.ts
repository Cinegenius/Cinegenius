export const ORGANIZATION_TOPICS = [
  "education",
  "industry",
  "funding",
  "technology",
  "sustainability",
  "networking",
] as const;

export const ORGANIZATION_ENTRY_TYPES = ["news", "workshop", "training", "event"] as const;
export const ORGANIZATION_FORMATS = ["onsite", "online", "hybrid"] as const;

export type OrganizationTopic = (typeof ORGANIZATION_TOPICS)[number];
export type OrganizationEntryType = (typeof ORGANIZATION_ENTRY_TYPES)[number];
export type OrganizationFormat = (typeof ORGANIZATION_FORMATS)[number];

export function organizationSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function safeExternalUrl(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}

export function isOrganizationTopic(value: unknown): value is OrganizationTopic {
  return typeof value === "string" && (ORGANIZATION_TOPICS as readonly string[]).includes(value);
}

export function isOrganizationEntryType(value: unknown): value is OrganizationEntryType {
  return typeof value === "string" && (ORGANIZATION_ENTRY_TYPES as readonly string[]).includes(value);
}

export function isOrganizationFormat(value: unknown): value is OrganizationFormat {
  return typeof value === "string" && (ORGANIZATION_FORMATS as readonly string[]).includes(value);
}
