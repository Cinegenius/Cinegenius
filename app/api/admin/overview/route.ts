import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";

type CountFilter = { op: "eq" | "in" | "gt"; column: string; value: string | boolean | string[] };

async function countRows(table: string, filter?: CountFilter) {
  const query = db.from(table).select("id", { count: "exact", head: true });
  const result = !filter
    ? await query
    : filter.op === "eq"
      ? await query.eq(filter.column, filter.value as string | boolean)
      : filter.op === "in"
        ? await query.in(filter.column, filter.value as string[])
        : await query.gt(filter.column, filter.value as string);
  const { count, error } = result;
  if (error) throw new Error(`Admin overview ${table}: ${error.message}`);
  return count ?? 0;
}

async function attentionCounts(includeOffers = false) {
  const [pendingReports, pendingVerifications, companyClarifications, pendingOffers, legacyOffers] = await Promise.all([
    countRows("reports", { op: "eq", column: "status", value: "pending" }),
    countRows("verification_requests", { op: "eq", column: "status", value: "pending" }),
    countRows("admin_company_membership_clarifications"),
    includeOffers ? countRows("listings", { op: "eq", column: "moderation_status", value: "pending" }) : Promise.resolve(0),
    includeOffers ? countRows("listings", { op: "eq", column: "moderation_status", value: "legacy_review_required" }) : Promise.resolve(0),
  ]);
  return { pendingReports, pendingVerifications, companyClarifications, ...(includeOffers ? { pendingOffers, legacyOffers } : {}) };
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const authorizedAt = performance.now();
  try {
    if (new URL(request.url).searchParams.get("summary") === "attention") {
      const counts = await attentionCounts();
      return NextResponse.json({ counts }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `auth;dur=${(authorizedAt - startedAt).toFixed(1)}, database;dur=${(performance.now() - authorizedAt).toFixed(1)}` } });
    }
    const recentListingsPromise = db.from("listings")
      .select("id, company_id, type, title, city, price, published, moderation_status, created_at")
      .order("created_at", { ascending: false }).limit(6)
      .then(({ data, error }) => {
        if (error) throw new Error(`Admin overview recent listings: ${error.message}`);
        return data ?? [];
      });
    const [
      profiles, companies, listings, activeListings, draftListings, locations, jobs, animals,
      crew, marketplace, services, projects, attention,
      bookings, reviews, communityPosts, applications, recentListings,
    ] = await Promise.all([
      countRows("profiles"),
      countRows("companies"),
      countRows("listings"),
      countRows("listings", { op: "eq", column: "published", value: true }),
      countRows("listings", { op: "eq", column: "published", value: false }),
      countRows("listings", { op: "eq", column: "type", value: "location" }),
      countRows("listings", { op: "eq", column: "type", value: "job" }),
      countRows("listings", { op: "eq", column: "type", value: "animal" }),
      countRows("listings", { op: "eq", column: "type", value: "creator" }),
      countRows("listings", { op: "in", column: "type", value: ["prop", "vehicle"] }),
      countRows("listings", { op: "eq", column: "type", value: "service" }),
      countRows("projects"),
      attentionCounts(true),
      countRows("bookings"),
      countRows("reviews"),
      countRows("community_posts", { op: "gt", column: "expires_at", value: new Date().toISOString() }),
      countRows("applications"),
      recentListingsPromise,
    ]);

    return NextResponse.json({
      counts: {
        profiles, companies, listings, activeListings, draftListings, locations, jobs, animals,
        crew, marketplace, services, projects, ...attention,
        bookings, reviews, communityPosts, applications,
      },
      recentListings: recentListings ?? [],
    }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `auth;dur=${(authorizedAt - startedAt).toFixed(1)}, database;dur=${(performance.now() - authorizedAt).toFixed(1)}` } });
  } catch (error) {
    console.error("[admin] overview failed", error);
    return NextResponse.json({ error: "Die Adminübersicht konnte nicht vollständig geladen werden. Bitte Datenquelle und Admin-Migration prüfen." }, { status: 503 });
  }
}
