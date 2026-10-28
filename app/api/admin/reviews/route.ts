import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { REVIEW_SOURCES, reviewKind, reviewObject, reviewPath } from "@/lib/admin-review";
import { REVIEW_HEADERS } from "@/lib/admin-review-server";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const t = await getTranslations("AdminReview");
  const params = request.nextUrl.searchParams;
  const kind = reviewKind(params.get("kind") || "listing");
  if (!kind) return NextResponse.json({ error: t("notFound") }, { status: 400, headers: REVIEW_HEADERS });
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get("page") || "1", 10) || 1));
  const pageSize = 30;
  const source = REVIEW_SOURCES[kind];
  const title = kind === "profile" ? "display_name" : kind === "company" || kind === "company_equipment" ? "name" : "title";
  const offer = kind === "listing" || kind === "company_equipment";
  const columns = kind === "project_draft" ? "id,draft_data,created_at" : `${source.key},${title},created_at${["company", "listing", "company_equipment"].includes(kind) ? ",published" : ""}${offer ? ",moderation_status,submitted_at" : ""}`;
  let query = db.from(source.table).select(columns, { count: "exact" }).order("created_at", { ascending: false }).order(source.key, { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const search = (params.get("q") || "").trim().slice(0, 80).replace(/[%,()]/g, " ").trim();
  if (search) query = query.ilike(kind === "project_draft" ? "draft_data->>title" : title, `%${search}%`);
  const status = params.get("status") || "pending";
  if (offer && ["draft", "pending", "approved", "changes_requested", "rejected", "hidden", "legacy_review_required"].includes(status)) query = query.eq("moderation_status", status);
  const result = await query;
  if (result.error) return NextResponse.json({ error: t("loadError") }, { status: 503, headers: REVIEW_HEADERS });
  return NextResponse.json({ rows: (result.data ?? []).map(value => {
    const row = value as unknown as Record<string, unknown>;
    const id = String(row[source.key]);
    return { moderation_status: row.moderation_status ?? null, id, title: String((kind === "project_draft" ? reviewObject(row.draft_data).title : row[title]) || ""), href: reviewPath(kind, id), published: typeof row.published === "boolean" ? row.published : kind === "project_draft" ? false : null };
  }), total: result.count ?? 0, pageSize }, { headers: REVIEW_HEADERS });
}
