import { db } from "@/lib/db";
import { requireAuth, isAdminSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { validateAdminReason } from "@/lib/admin-policy";
import { getTranslations } from "next-intl/server";
import { localizedNotification } from "@/lib/i18n/notification-copy";
import { memberVerificationStatus, verificationDocument } from "@/lib/verification";
import { protectedMediaKey } from "@/lib/protected-media";
import { revalidateTag } from "next/cache";

const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(req: NextRequest) {
  const t = await getTranslations("VerificationReview");
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  // Admin members still see their own status on /profile and /dashboard.
  if (req.nextUrl.searchParams.get("scope") === "admin") {
    if (!await isAdminSession()) return NextResponse.json({ error: t("forbidden") }, { status: 403, headers });
    const pageSize = 50;
    const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const status = req.nextUrl.searchParams.get("status") ?? "pending";
    if (!["pending", "approved", "rejected", "all"].includes(status)) return NextResponse.json({ error: t("invalid") }, { status: 400, headers });
    let query = db.from("verification_requests").select("id,user_id,display_name,status,notes,submitted_at,reviewed_at,review_version,review_reason", { count: "exact" }).order("submitted_at", { ascending: false }).order("id", { ascending: false });
    if (status !== "all") query = query.eq("status", status);
    const result = await query.range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) return NextResponse.json({ error: t("loadError") }, { status: 503, headers });
    const ids = [...new Set((result.data ?? []).map(row => row.user_id))];
    const profiles = ids.length ? await db.from("profiles").select("user_id,verified,verification_revision").in("user_id", ids) : { data: [], error: null };
    if (profiles.error) return NextResponse.json({ error: t("loadError") }, { status: 503, headers });
    return NextResponse.json({ data: (result.data ?? []).map(row => {
      const profile = profiles.data?.find(item => item.user_id === row.user_id);
      const document = verificationDocument(row.notes);
      return { ...row, notes: document ? null : row.notes, has_document: Boolean(document), profile_revision: profile?.verification_revision ?? null, profile_verified: profile?.verified ?? null };
    }), total: result.count ?? 0, page }, { headers });
  }
  const [profile, request] = await Promise.all([
    db.from("profiles").select("verified").eq("user_id", userId).maybeSingle(),
    db.from("verification_requests").select("id,status,submitted_at,reviewed_at,review_reason").eq("user_id", userId).order("submitted_at", { ascending: false }).order("id", { ascending: false }).limit(1),
  ]);
  if (profile.error || request.error) return NextResponse.json({ error: t("loadError") }, { status: 503, headers });
  const latest = request.data?.[0];
  return NextResponse.json({ data: latest ? [latest] : [], status: memberVerificationStatus(profile.data?.verified === true, latest?.status), verified: profile.data?.verified === true }, { headers });
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("VerificationReview");
  const tResponse = await getTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => null);
  const notes = body?.notes ?? null;
  if (notes !== null && (typeof notes !== "string" || notes.length > 6000)) return NextResponse.json({ error: t("invalid") }, { status: 400, headers });
  const document = verificationDocument(notes);
  if (document) {
    const key = protectedMediaKey(document);
    if (!key || key.split("/").at(-2) !== userId) return NextResponse.json({ error: t("invalid") }, { status: 400, headers });
    const asset = await db.from("media_assets").select("owner_user_id,source_type,reference_url").eq("storage_path", key).maybeSingle();
    if (asset.error) return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
    if (!asset.data || asset.data.owner_user_id !== userId || asset.data.source_type || asset.data.reference_url !== document) return NextResponse.json({ error: t("invalid") }, { status: 400, headers });
  }
  const result = await db.rpc("verification_submit", { p_user: userId, p_notes: notes });
  if (result.error) return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
  const status = result.data?.status;
  if (status === "approved" || status === "pending") return NextResponse.json({ error: tResponse(status === "approved" ? "System.verificationAlreadyVerified" : "System.verificationAlreadyRequested"), status }, { status: 400, headers });
  if (status === "missing") return NextResponse.json({ error: t("profileMissing") }, { status: 409, headers });
  if (status !== "saved") return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
  return NextResponse.json({ id: result.data.id, status: "pending" }, { headers });
}

export async function PATCH(req: NextRequest) {
  const t = await getTranslations("VerificationReview");
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  if (!await isAdminSession()) return NextResponse.json({ error: t("forbidden") }, { status: 403, headers });
  const body = await req.json().catch(() => null);
  const reason = body?.action === "approve" && (body?.reason === undefined || body?.reason === "") ? t("approvalReason") : validateAdminReason(body?.reason);
  if (!/^[0-9a-f-]{36}$/i.test(body?.requestId ?? "") || !["approve", "reject"].includes(body?.action) || !reason || !Number.isSafeInteger(body?.version) || !Number.isSafeInteger(body?.profileRevision)) return NextResponse.json({ error: t("invalid") }, { status: 400, headers });
  const result = await db.rpc("verification_review", {
    p_id: body.requestId, p_version: body.version, p_profile_revision: body.profileRevision, p_action: body.action, p_actor: authResult.userId, p_reason: reason,
    p_notification: localizedNotification({ title: { key: "verificationResultTitle" }, body: { key: body.action === "approve" ? "verificationApprovedBody" : "verificationRejectedBody" } }),
  });
  if (result.error) return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
  if (result.data === "stale") return NextResponse.json({ error: t("stale") }, { status: 409, headers });
  if (result.data === "missing" || result.data === "profile_missing") return NextResponse.json({ error: t("profileMissing") }, { status: 404, headers });
  if (result.data !== "saved") return NextResponse.json({ error: t("saveError") }, { status: 503, headers });
  try { revalidateTag("profiles", { expire: 0 }); } catch { /* The transaction already succeeded. */ }
  return NextResponse.json({ ok: true }, { headers });
}
