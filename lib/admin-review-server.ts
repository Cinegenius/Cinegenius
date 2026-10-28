import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { REVIEW_SOURCES, reviewFields, reviewImages, reviewKind, reviewObject, reviewPath, type AdminReview, type ReviewRecord } from "@/lib/admin-review";
import { listingDetailPath } from "@/lib/listing-routes";
import { responsiblePersonDraft, responsiblePersonErrors } from "@/lib/responsible-person";

export const REVIEW_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
export class ReviewError extends Error {
  constructor(public code: "loadError" | "notFound" | "forbidden" | "stale" | "mediaError" | "sourceMismatch", public status: number) { super(code); }
}
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function reviewRevision(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
async function recordFrom(table: string, key: string, id: string): Promise<ReviewRecord | null> {
  const result = await db.from(table).select("*").eq(key, id).maybeSingle();
  if (result.error) throw new ReviewError("loadError", 503);
  return result.data;
}

/** Internal data stays server-side; every caller, including media, is checked again. */
export async function loadReviewSource(rawKind: string, id: string) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) throw new ReviewError("forbidden", admin.status);
  const kind = reviewKind(rawKind);
  if (!kind || !id || id.length > 160 || (kind !== "profile" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new ReviewError("notFound", 404);
  const source = REVIEW_SOURCES[kind];
  const record = await recordFrom(source.table, source.key, id);
  if (!record) throw new ReviewError("notFound", 404);
  return { admin, kind, id: String(record[source.key]), record, images: reviewImages(kind, record) };
}
export async function loadAdminReview(rawKind: string, rawId: string) {
  const { admin, kind, id, record, images } = await loadReviewSource(rawKind, rawId);
  const companyId = text(record.company_id);
  const providerCompany = companyId ? await recordFrom("companies", "id", companyId) : kind === "company" ? record : null;
  const userId = providerCompany ? text(providerCompany.owner_user_id)
    : companyId ? null : text(kind === "profile" ? record.user_id : kind === "company" ? record.owner_user_id : kind === "project" ? record.created_by : kind === "community_post" ? record.author_id : record.user_id);
  const providerProfile = userId ? await recordFrom("profiles", "user_id", userId) : null;
  const item = kind === "project_draft" ? reviewObject(record.draft_data) : record;
  const snapshot = responsiblePersonDraft(record.responsible_person);
  const storedResponsible = reviewObject(record.responsible_person);
  const responsibleUser = text(storedResponsible.userId);
  const title = text(item.title) || text(item.name) || text(item.display_name) || "";
  const companySlug = text(providerCompany?.slug);
  const publicHref = kind === "listing" ? listingDetailPath(String(record.type ?? ""), id, companySlug)
    : kind === "company" && text(record.slug) ? `/companies/${encodeURIComponent(String(record.slug))}`
    : kind === "profile" ? `/profile/${encodeURIComponent(String(record.slug || id))}`
    : kind === "project" ? `/projects/${encodeURIComponent(id)}` : null;
  // Projects in the projects table are published records; drafts have their own table.
  const published = kind === "project" ? true : kind === "project_draft" ? false
    : kind === "community_post" ? Date.parse(String(record.expires_at)) > Date.now()
    : typeof record.published === "boolean" ? record.published : null;
  const issues: string[] = [];
  if (!title.trim()) issues.push("title");
  if (kind === "listing") {
    if (!text(record.city)) issues.push("city");
    if (["location", "vehicle", "prop"].includes(String(record.type))) {
      if (!text(record.category)) issues.push("category");
      if (!text(record.image_url)) issues.push("image");
    }
    if (!publicHref) issues.push("route");
    if (!userId || (companyId && (!providerCompany || providerCompany.published !== true || !companySlug))) issues.push("provider");
    if (Object.keys(responsiblePersonErrors(snapshot)).length || !responsibleUser) issues.push("responsible");
  }
  if (kind === "company_equipment") {
    if (!text(record.category)) issues.push("category");
    if (!providerCompany || providerCompany.published !== true || !companySlug || !userId) issues.push("provider");
  }
  const offer = kind === "listing" || kind === "company_equipment";
  const history = offer ? await db.from("offer_moderation_events").select("event,actor_user_id,to_status,content_revision,reason,created_at").eq("offer_kind", kind).eq("offer_id", id).order("created_at", { ascending: false }).limit(30) : { data: [] };
  if ("error" in history && history.error) throw new ReviewError("loadError", 503);
  const revision = reviewRevision({ record, providerCompany, providerProfile });
  const base = `/api/admin/reviews/${kind}/${encodeURIComponent(id)}/media`;
  const dto: AdminReview = {
    kind, id, title, revision, published,
    createdAt: text(record.created_at), updatedAt: text(record.updated_at),
    fields: reviewFields(kind, record),
    images: images.map((reference, index) => ({ src: `${base}?index=${index}&ref=${reviewRevision(reference)}`, number: index + 1 })),
    responsible: responsibleUser ? { name: [snapshot.firstName, snapshot.lastName].filter(Boolean).join(" "), function: snapshot.function === "other" ? snapshot.customFunction : snapshot.function, userId: responsibleUser, public: snapshot.public } : null,
    provider: { name: text(providerCompany?.name) || text(providerProfile?.display_name) || (responsibleUser === userId ? text([snapshot.firstName, snapshot.lastName].filter(Boolean).join(" ")) : null), userId,
      href: userId && providerProfile ? reviewPath("profile", userId) : null,
      companyHref: providerCompany ? reviewPath("company", String(providerCompany.id)) : null },
    technicalCreator: text(record.user_id) || text(record.created_by) || text(record.author_id) || text(record.owner_user_id),
    publicHref: kind === "company_equipment" && companySlug ? `/companies/${encodeURIComponent(companySlug)}` : publicHref,
    ...(offer ? { moderation: { status: String(record.moderation_status || (published ? "legacy_review_required" : "draft")), reason: text(record.moderation_reason), submittedAt: text(record.submitted_at), reviewedAt: text(record.reviewed_at), contentRevision: Number(record.content_revision || 1), events: (history.data ?? []).map(row => ({ event: String(row.event), actor: row.actor_user_id as string | null, status: String(row.to_status), revision: Number(row.content_revision), reason: row.reason as string | null, at: String(row.created_at) })) } } : {}),
    issues, canPublish: offer && issues.length === 0 && ["pending", "legacy_review_required"].includes(String(record.moderation_status)),
    support: kind === "listing" || kind === "company" || kind === "profile" ? { type: kind, id } : null,
  };
  return { admin, kind, id, record, providerCompany, providerProfile, dto, images };
}
