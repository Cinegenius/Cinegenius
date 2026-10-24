import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";

const LISTING_TYPES = new Set(["all", "location", "prop", "vehicle", "job", "creator", "service", "animal"]);

// GET /api/admin/listings — complete, paginated admin list, including drafts.
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const search = (params.get("search") ?? "").trim().slice(0, 80).replace(/[%,()]/g, " ").trim();
  const rawType = params.get("type") ?? "all";
  const rawStatus = params.get("status") ?? "all";
  if (!LISTING_TYPES.has(rawType) || !["all", "published", "draft"].includes(rawStatus)) {
    return NextResponse.json({ error: "Ungültiger Filter." }, { status: 400 });
  }

  let query = db.from("listings")
    .select("id, company_id, type, title, city, price, published, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (rawType !== "all") query = query.eq("type", rawType);
  if (rawStatus === "published") query = query.eq("published", true);
  if (rawStatus === "draft") query = query.eq("published", false);
  if (search) query = query.ilike("title", `%${search}%`);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "Inserate konnten nicht geladen werden." }, { status: 500 });
  const companyIds = [...new Set((data ?? []).flatMap((listing) => listing.company_id ? [listing.company_id] : []))];
  const { data: companies } = companyIds.length
    ? await db.from("companies").select("id, slug").in("id", companyIds)
    : { data: [] };
  const companySlugs = new Map((companies ?? []).map((company: { id: string; slug: string }) => [company.id, company.slug]));
  return NextResponse.json({ listings: (data ?? []).map((listing) => ({ ...listing, company_slug: listing.company_id ? companySlugs.get(listing.company_id) ?? null : null })), total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
}

// PATCH /api/admin/listings — publish or hide a listing with an audit reason.
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const listingId = body?.listingId;
  const published = body?.published;
  const reason = validateAdminReason(body?.reason);
  if (typeof listingId !== "string" || !listingId || typeof published !== "boolean" || !reason) {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: guard.userId, action: published ? "listing_publish" : "listing_hide", entityType: "listing", entityId: listingId, reason, metadata: { published } });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });

  const { data, error } = await db
    .from("listings")
    .update({ published })
    .eq("id", listingId)
    .select("id, published")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Inserat nicht gefunden." }, { status: 404 }); }
  const auditLogged = await finishAdminAudit(audit, "succeeded");

  return NextResponse.json({ success: true, auditLogged });
}

// DELETE /api/admin/listings — remove a listing
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const listingId = body?.listingId;
  const reason = validateAdminReason(body?.reason);
  if (typeof listingId !== "string" || !listingId || !reason || body?.confirm !== true) {
    return NextResponse.json({ error: "ID, Begründung und ausdrückliche Bestätigung erforderlich." }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: guard.userId, action: "listing_delete", entityType: "listing", entityId: listingId, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
  const { data, error } = await db
    .from("listings")
    .delete()
    .eq("id", listingId)
    .select("id")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Inserat nicht gefunden." }, { status: 404 }); }

  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}
