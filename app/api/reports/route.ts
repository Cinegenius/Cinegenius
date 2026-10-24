import { db } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";
import { NextRequest, NextResponse } from "next/server";

const VALID_TARGET_TYPES = new Set(["user", "listing", "review"]);
const VALID_REASONS = new Set([
  "spam",
  "harassment",
  "fake_profile",
  "inappropriate_content",
  "scam",
  "underage",
  "other",
]);

// POST /api/reports — submit a report
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Per-user rate limit: 5 reports per minute
  const { allowed } = await rateLimit(`report:${userId}`, 5, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Meldungen. Bitte kurz warten." }, { status: 429 });

  const body = await req.json();
  const { target_type, target_id, reason, details } = body;

  if (!VALID_TARGET_TYPES.has(target_type)) {
    return NextResponse.json({ error: "Ungültiger target_type" }, { status: 400 });
  }
  if (!target_id || typeof target_id !== "string") {
    return NextResponse.json({ error: "target_id fehlt" }, { status: 400 });
  }
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "Ungültiger Grund" }, { status: 400 });
  }
  if (details && String(details).length > 1000) {
    return NextResponse.json({ error: "Details zu lang (max. 1000 Zeichen)" }, { status: 400 });
  }
  if (target_type === "user" && target_id === userId) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst melden" }, { status: 400 });
  }

  // Prevent duplicate reports
  const { data: existing } = await db
    .from("reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("target_id", target_id)
    .eq("target_type", target_type)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Du hast diesen Inhalt bereits gemeldet" }, { status: 409 });
  }

  const { data, error } = await db
    .from("reports")
    .insert({
      reporter_id: userId,
      target_type,
      target_id,
      reason,
      details: details?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}

// GET /api/reports — admin only: list pending reports
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const validStatuses = new Set(["pending", "reviewed", "resolved", "dismissed"]);
  if (!validStatuses.has(status)) return NextResponse.json({ error: "Ungültiger Meldungsstatus." }, { status: 400 });
  const page   = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit  = 50;
  const from   = (page - 1) * limit;
  const to     = from + limit - 1;

  const { data, error, count } = await db
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, details, status, created_at", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const reporterIds = [...new Set(rows.map((row) => row.reporter_id))];
  const targetIds = [...new Set(rows.map((row) => row.target_id))];
  const [{ data: reporters }, { data: targetUsers }, { data: listings }, { data: reviews }] = await Promise.all([
    reporterIds.length ? db.from("profiles").select("user_id, display_name, slug").in("user_id", reporterIds) : Promise.resolve({ data: [] }),
    rows.some((row) => row.target_type === "user") ? db.from("profiles").select("user_id, display_name, slug").in("user_id", targetIds) : Promise.resolve({ data: [] }),
    rows.some((row) => row.target_type === "listing") ? db.from("listings").select("id, slug, title, type, company_id").in("id", targetIds) : Promise.resolve({ data: [] }),
    rows.some((row) => row.target_type === "review") ? db.from("reviews").select("id, target_id, target_type, rating, text, reviewer_name").in("id", targetIds) : Promise.resolve({ data: [] }),
  ]);
  const reviewRows = reviews ?? [];
  const reviewProfileIds = [...new Set(reviewRows.filter((review) => review.target_type === "user").map((review) => review.target_id))];
  const reviewListingIds = [...new Set(reviewRows.filter((review) => review.target_type === "listing").map((review) => review.target_id))];
  const [{ data: reviewProfiles }, { data: reviewListings }] = await Promise.all([
    reviewProfileIds.length ? db.from("profiles").select("user_id, display_name, slug").in("user_id", reviewProfileIds) : Promise.resolve({ data: [] }),
    reviewListingIds.length ? db.from("listings").select("id, slug, title, type, company_id").in("id", reviewListingIds) : Promise.resolve({ data: [] }),
  ]);
  const companyIds = [...new Set([...(listings ?? []), ...(reviewListings ?? [])].flatMap((listing: { company_id: string | null }) => listing.company_id ? [listing.company_id] : []))];
  const { data: companies } = companyIds.length
    ? await db.from("companies").select("id, slug").in("id", companyIds)
    : { data: [] };
  const profileById = new Map([...(reporters ?? []), ...(targetUsers ?? []), ...(reviewProfiles ?? [])].map((profile: { user_id: string; display_name: string | null; slug: string | null }) => [profile.user_id, profile]));
  const listingById = new Map([...(listings ?? []), ...(reviewListings ?? [])].map((listing: { id: string; slug: string | null; title: string; type: string; company_id: string | null }) => [listing.id, listing]));
  const companySlugById = new Map((companies ?? []).map((company: { id: string; slug: string }) => [company.id, company.slug]));
  const reviewById = new Map((reviews ?? []).map((review: { id: string; target_id: string; target_type: string; rating: number; text: string | null; reviewer_name: string | null }) => [review.id, review]));
  const enriched = rows.map((row) => {
    const reporter = profileById.get(row.reporter_id);
    if (row.target_type === "user") {
      const target = profileById.get(row.target_id);
      return { ...row, reporter_name: reporter?.display_name ?? null, target_name: target?.display_name ?? null, target_href: target?.slug ? `/profile/${target.slug}` : `/profile/${row.target_id}`, target_excerpt: null };
    }
    if (row.target_type === "listing") {
      const target = listingById.get(row.target_id);
      const segment = target?.type === "location" ? "locations" : target?.type === "prop" ? "props" : target?.type === "vehicle" ? "vehicles" : target?.type === "job" ? "jobs" : target?.type === "creator" ? "creators" : null;
      const href = segment && target ? `/${segment}/${target.id}` : target?.company_id && companySlugById.has(target.company_id) ? `/companies/${companySlugById.get(target.company_id)}` : null;
      return { ...row, reporter_name: reporter?.display_name ?? null, target_name: target?.title ?? null, target_href: href, target_excerpt: null };
    }
    const target = reviewById.get(row.target_id);
    const targetProfile = target?.target_type === "user" ? profileById.get(target.target_id) : null;
    const targetListing = target?.target_type === "listing" ? listingById.get(target.target_id) : null;
    const reviewListingPath = targetListing ? ({ location: "locations", prop: "props", vehicle: "vehicles", job: "jobs", creator: "creators" } as Record<string, string>)[targetListing.type] : null;
    const reviewHref = targetProfile?.slug ? `/profile/${targetProfile.slug}` : targetListing && reviewListingPath ? `/${reviewListingPath}/${targetListing.id}` : targetListing?.company_id && companySlugById.has(targetListing.company_id) ? `/companies/${companySlugById.get(targetListing.company_id)}` : null;
    return { ...row, reporter_name: reporter?.display_name ?? null, target_name: target ? `Bewertung von ${target.reviewer_name ?? "Nutzer"}` : null, target_href: reviewHref, target_excerpt: target?.text?.slice(0, 500) ?? null };
  });
  return NextResponse.json({ reports: enriched, page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) }, { headers: { "Cache-Control": "private, no-store" } });
}

// PATCH /api/reports — admin only: update report status
export async function PATCH(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => null);
  const { id, status } = body ?? {};
  const reason = validateAdminReason(body?.reason);
  if (typeof id !== "string" || !id || !["reviewed", "resolved", "dismissed"].includes(status) || !reason) {
    return NextResponse.json({ error: "ID, gültiger Status und eine Begründung (5–500 Zeichen) sind erforderlich." }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: authResult.userId, action: `report_${status}`, entityType: "report", entityId: id, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });

  const { data, error } = await db
    .from("reports")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Meldung nicht gefunden." }, { status: 404 }); }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}
