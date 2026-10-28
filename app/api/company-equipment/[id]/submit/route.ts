import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasCompanyCapability } from "@/lib/company-access";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const t = await getTranslations("OfferModeration");
  const { id } = await params;
  const { data, error } = await db.from("company_equipment").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: t("saveError") }, { status: 503 });
  if (!data || !await hasCompanyCapability(data.company_id, auth.userId, "edit_offers")) return NextResponse.json({ error: t("notFound") }, { status: 404 });
  if (!data.name?.trim() || !data.category) return NextResponse.json({ error: t("incomplete") }, { status: 422 });
  const result = await db.rpc("offer_review_transition", { p_kind: "company_equipment", p_id: id, p_expected: data, p_provider_company: null, p_provider_profile: null, p_action: "submit", p_actor: auth.userId, p_reason: null, p_notification: null });
  if (result.error || !["saved", "unchanged"].includes(result.data)) return NextResponse.json({ error: t(result.data === "stale" ? "stale" : "saveError") }, { status: result.data === "stale" ? 409 : 503 });
  return NextResponse.json({ success: true, moderation_status: data.moderation_status === "approved" ? "approved" : "pending", message: t("submitted") }, { headers: { "Cache-Control": "private, no-store" } });
}
