/** Explicit review sources: never messages, support attachments or arbitrary tables. */
export const REVIEW_SOURCES = {
  listing: { table: "listings", key: "id" },
  company: { table: "companies", key: "id" },
  profile: { table: "profiles", key: "user_id" },
  project: { table: "projects", key: "id" },
  project_draft: { table: "project_drafts", key: "id" },
  community_post: { table: "community_posts", key: "id" },
  company_equipment: { table: "company_equipment", key: "id" },
} as const;
export type ReviewKind = keyof typeof REVIEW_SOURCES;
export type ReviewRecord = Record<string, unknown>;
export function reviewKind(value: string): ReviewKind | null {
  return Object.hasOwn(REVIEW_SOURCES, value) ? value as ReviewKind : null;
}
export function reviewPath(kind: ReviewKind, id: string) {
  return `/admin/review/${kind}/${encodeURIComponent(id)}`;
}
export function reportReviewPath(kind: string, id: string): string | null {
  const mapped = ({ user: "profile", post: "community_post", listing: "listing", project: "project", company: "company", profile: "profile" } as Record<string, ReviewKind>)[kind];
  return mapped ? reviewPath(mapped, id) : null;
}
export function reviewObject(value: unknown): ReviewRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ReviewRecord : {};
}
export function reviewImages(kind: ReviewKind, record: ReviewRecord): string[] {
  const item = kind === "project_draft" ? reviewObject(record.draft_data) : record;
  const entries = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
  const raw = kind === "profile" ? [item.avatar_url, item.cover_image_url, ...entries(item.profile_images), ...entries(item.portfolio_images)]
    : kind === "company" ? [item.logo_url, item.cover_url, ...entries(item.portfolio_images)]
    : kind === "listing" ? [item.image_url, ...entries(item.extra_images), ...entries(item.images), item.floor_plan_url,
      ...entries(reviewObject(item.metadata).production_credits).flatMap(credit => entries(reviewObject(credit).image_urls))]
    : kind === "project" || kind === "project_draft" ? [item.poster_url, ...entries(item.images)]
    : [item.image_url, ...entries(item.images)];
  return [...new Set(raw.flatMap(entry => {
    const value = typeof entry === "string" ? entry : reviewObject(entry).url;
    return typeof value === "string" && value.trim() ? [value.trim()] : [];
  }))];
}

// Actual stored business data, not arbitrary account metadata or credentials.
const FIELDS = ["type", "category", "categories", "services", "description", "body", "bio", "bio_short", "tagline", "usp", "role", "positions", "primary_role_id", "location", "city", "country", "address", "hq_address", "email", "phone", "website", "social_links", "industry_focus", "countries", "founded_year", "legal_form", "catering_details", "price", "price_day", "price_week", "price_on_request", "price_note", "rental_type", "condition", "brand", "model", "quantity", "available", "pickup_available", "delivery_available", "insured", "blocked_dates", "year", "director", "status", "logline", "synopsis", "genres", "language", "runtime_minutes", "production_company", "co_producers", "shoot_locations", "prep_start", "prep_end", "shoot_start", "shoot_end", "post_start", "post_end", "release_cinema", "release_countries", "release_streaming", "release_tv", "trailer_url", "teaser_url", "expires_at", "kind", "use_cases", "languages", "skills", "licenses", "travel_ready", "public_titles"] as const;
export function reviewFields(kind: ReviewKind, record: ReviewRecord): { key: string; value: unknown }[] {
  const item = kind === "project_draft" ? reviewObject(record.draft_data) : record;
  const populated = (value: unknown) => value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
  const fields = FIELDS.filter(key => populated(item[key])).map(key => ({ key: String(key), value: item[key] }));
  // Metadata is shown as technical stored details, excluding setup request identifiers.
  const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|secret|password|session|onboarding|request_key/i.test(key)).map(([key, entry]) => [key, sanitize(entry)]));
    return value;
  };
  const metadata = reviewObject(sanitize(reviewObject(item.metadata)));
  if (Object.keys(metadata).length) fields.push({ key: "details", value: metadata });
  return fields;
}
export type AdminReview = {
  kind: ReviewKind; id: string; title: string; revision: string;
  published: boolean | null; createdAt: string | null; updatedAt: string | null;
  fields: ReturnType<typeof reviewFields>; images: { src: string; number: number }[];
  responsible: { name: string; function: string; userId: string; public: boolean } | null;
  provider: { name: string | null; userId: string | null; href: string | null; companyHref: string | null };
  technicalCreator: string | null; publicHref: string | null;
  issues: string[]; canPublish: boolean; support: { type: "listing" | "company" | "profile"; id: string } | null;
};
