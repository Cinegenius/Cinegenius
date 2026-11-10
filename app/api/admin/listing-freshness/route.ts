import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { listingFreshnessSchedulerEnabled } from "@/lib/listing-freshness-cron-auth";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store" };
const TYPES = new Set(["prop", "vehicle", "location", "animal", "job"]);
const PAGE_SIZE = 25;
const SETTING_COLUMNS = "listing_type,enabled,initial_days,followup_days,response_days";
type Row = Record<string, unknown>;
type Setting = { listing_type: string; enabled: boolean; initial_days: number; followup_days: number; response_days: number };

function object(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}

function setting(value: unknown): Setting | null {
  const row = object(value);
  if (!row || typeof row.listing_type !== "string" || !TYPES.has(row.listing_type) || typeof row.enabled !== "boolean"
    || typeof row.initial_days !== "number" || !Number.isInteger(row.initial_days) || row.initial_days < 1 || row.initial_days > 3650
    || typeof row.followup_days !== "number" || !Number.isInteger(row.followup_days) || row.followup_days < 1 || row.followup_days > 730
    || typeof row.response_days !== "number" || !Number.isInteger(row.response_days) || row.response_days < 1 || row.response_days > 730) return null;
  return { listing_type: row.listing_type, enabled: row.enabled, initial_days: row.initial_days, followup_days: row.followup_days, response_days: row.response_days };
}

const text = (value: unknown) => typeof value === "string" ? value : null;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
function privateAuthResponse(response: NextResponse) {
  response.headers.set("Cache-Control", HEADERS["Cache-Control"]);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return privateAuthResponse(admin);
    const params = request.nextUrl.searchParams;
    const view = params.get("view") ?? "status";
    const type = params.get("type") || null;
    const page = Number(params.get("page") ?? "1");
    if (!["status", "events"].includes(view) || (type !== null && !TYPES.has(type))
      || !Number.isInteger(page) || page < 1 || page > 100_000) return json({ code: "invalid" }, 400);

    const statusView = view === "status";
    const columns = statusView
      ? "listing_id,status,confirmed_at,due_at,response_deadline_at,updated_at"
      : "id,listing_id,action,actor_user_id,created_at,reason:metadata->reason";
    // A filtered empty embed constrains the parent query and its exact count.
    // Settings events have no listing, so their recorded type is included too.
    let query = db.from(statusView ? "listing_freshness_state" : "listing_freshness_events")
      .select(`${columns}${type ? ",type_match:listings()" : ""}`, { count: "exact" });
    if (type) {
      query = query.eq("type_match.type", type);
      query = statusView ? query.not("type_match", "is", null)
        : query.or(`type_match.not.is.null,metadata->>listing_type.eq.${type}`);
    }
    query = query.order(statusView ? "updated_at" : "created_at", { ascending: false })
      .order(statusView ? "listing_id" : "id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const [settingsResult, rowsResult] = await Promise.all([
      db.from("listing_freshness_settings").select(SETTING_COLUMNS).order("listing_type"),
      query,
    ]);
    if (settingsResult.error || rowsResult.error || !Array.isArray(settingsResult.data) || !Array.isArray(rowsResult.data)
      || typeof rowsResult.count !== "number" || !Number.isSafeInteger(rowsResult.count) || rowsResult.count < 0) {
      return json({ code: "unavailable" }, 503);
    }
    const settings = settingsResult.data.map(setting);
    if (settings.some(value => value === null)) return json({ code: "unavailable" }, 503);
    const rows = rowsResult.data as unknown as Row[];
    const listingIds = [...new Set(rows.map(row => text(row.listing_id)).filter((id): id is string => id !== null))];
    const listings = new Map<string, { title: string; type: string }>();
    if (listingIds.length) {
      const titles = await db.from("listings").select("id,title,type").in("id", listingIds);
      if (titles.error || !Array.isArray(titles.data)) return json({ code: "unavailable" }, 503);
      for (const value of titles.data) {
        const row = value as Row;
        if (typeof row.id === "string") listings.set(row.id, { title: text(row.title) ?? "", type: text(row.type) ?? "" });
      }
    }
    const items = rows.map(row => {
      const listingId = text(row.listing_id);
      const common = { listing_id: listingId, listing: listingId ? listings.get(listingId) ?? null : null };
      return statusView ? {
        ...common, status: text(row.status), confirmed_at: text(row.confirmed_at), due_at: text(row.due_at),
        response_deadline_at: text(row.response_deadline_at), updated_at: text(row.updated_at),
      } : {
        ...common, id: text(row.id), action: text(row.action), actor_user_id: text(row.actor_user_id), created_at: text(row.created_at),
        metadata: typeof row.reason === "string" ? { reason: Array.from(row.reason).slice(0, 500).join("") } : {},
      };
    });
    return json({ settings, items, total: rowsResult.count, page, pageSize: PAGE_SIZE, schedulerEnabled: listingFreshnessSchedulerEnabled() });
  } catch {
    return json({ code: "unavailable" }, 503);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin instanceof NextResponse) return privateAuthResponse(admin);
    if (!trustedMutationOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), referer: request.headers.get("referer"),
      development: process.env.NODE_ENV === "development", deploymentHost: process.env.VERCEL_URL })) {
      return json({ code: "origin" }, 403);
    }
    const body = object(await request.json().catch(() => null));
    if (!body || !Array.isArray(body.settings) || body.settings.length < 1 || body.settings.length > 5) return json({ code: "invalid" }, 400);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 500) return json({ code: "invalid" }, 400);
    // Validate every entry before the sole atomic write; never save a partial batch.
    const settings = body.settings.map(setting);
    if (settings.some(value => value === null) || new Set(settings.map(value => value?.listing_type)).size !== settings.length) {
      return json({ code: "invalid" }, 400);
    }
    const saved = await db.rpc("configure_listing_freshness_batch", { p_settings: settings, p_actor: admin.userId, p_reason: reason });
    if (saved.error) return json({ code: saved.error.code === "PT409" ? "stale" : "unavailable" }, saved.error.code === "PT409" ? 409 : 503);
    const result = object(saved.data);
    if (result?.status === "invalid") return json({ code: "invalid" }, 400);
    if (result?.status === "stale") return json({ code: "stale" }, 409);
    if (!result || !["saved", "unchanged"].includes(String(result.status)) || !Array.isArray(result.settings)) return json({ code: "unavailable" }, 503);
    const returnedSettings = result.settings.map(setting);
    if (returnedSettings.some(value => value === null)) return json({ code: "unavailable" }, 503);
    return json({ settings: returnedSettings });
  } catch {
    return json({ code: "unavailable" }, 503);
  }
}
