import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { validateAdminReason } from "@/lib/admin-policy";
import { localizedNotification } from "@/lib/i18n/notification-copy";
import { revalidateTag } from "next/cache";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

// GET /api/admin/users — list all profiles for admin user management
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;

  let query = db
    .from("profiles")
    .select("user_id, display_name, location, avatar_url, profile_types, verified, verification_revision, created_at, tagline", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search.startsWith("user_")) {
    query = query.eq("user_id", search.slice(0, 100));
  } else if (search) {
    query = query.ilike("display_name", `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500, headers });

  return NextResponse.json({ users: data ?? [], total: count ?? 0, page, pageSize }, { headers });
}

// PATCH /api/admin/users — toggle verified flag
export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const t = await getResponseTranslations("VerificationReview");
  const body = await req.json().catch(() => null);
  const { targetUserId, verified, revision } = body ?? {};
  const reason = verified === true && (body?.reason === undefined || body?.reason === "") ? t("approvalReason") : validateAdminReason(body?.reason);
  if (typeof targetUserId !== "string" || !targetUserId || typeof verified !== "boolean" || !Number.isSafeInteger(revision) || !reason) {
    return NextResponse.json({ error: t("invalid") }, { status: 400, headers });
  }
  const result = await db.rpc("verification_set_profile", {
    p_user: targetUserId, p_revision: revision, p_verified: verified, p_actor: guard.userId, p_reason: reason,
    p_notification: localizedNotification({ title: { key: "verificationResultTitle" }, body: { key: verified ? "verificationApprovedBody" : "verificationRevokedBody" } }),
  });
  if (result.error) return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
  if (result.data === "missing") return NextResponse.json({ error: t("profileMissing") }, { status: 404, headers });
  if (result.data === "stale") return NextResponse.json({ error: t("stale") }, { status: 409, headers });
  if (result.data !== "saved" && result.data !== "unchanged") return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
  try { revalidateTag("profiles", { expire: 0 }); } catch { /* Already committed. */ }
  return NextResponse.json({ success: true }, { headers });
}
