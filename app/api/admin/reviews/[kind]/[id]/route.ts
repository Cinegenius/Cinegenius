import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { loadAdminReview, REVIEW_HEADERS, ReviewError } from "@/lib/admin-review-server";
import { releaseReviewedListing } from "@/lib/admin-review-release";
import { getTranslations } from "next-intl/server";
import { publishReviewedCompany } from "@/lib/admin-company-publication";

export async function GET(_request: NextRequest, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await context.params;
    return NextResponse.json((await loadAdminReview(kind, id)).dto, { headers: REVIEW_HEADERS });
  } catch (error) {
    const t = await getTranslations("AdminReview");
    return NextResponse.json({ error: t(error instanceof ReviewError ? error.code : "loadError") }, { status: error instanceof ReviewError ? error.status : 503, headers: REVIEW_HEADERS });
  }
}
export async function POST(request: NextRequest, context: { params: Promise<{ kind: string; id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { kind, id } = await context.params;
  if (kind !== "listing" && kind !== "company_equipment" && kind !== "company") return NextResponse.json({ error: (await getTranslations("AdminReview"))("unsupportedAction") }, { status: 400, headers: REVIEW_HEADERS });
  const body = await request.json().catch(() => null);
  if (kind === "company") return publishReviewedCompany(id, body ?? {});
  return releaseReviewedListing(id, body ?? {}, kind);
}
