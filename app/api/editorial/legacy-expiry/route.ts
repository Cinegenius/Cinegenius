import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { editorialSourceUrl } from "@/lib/editorial-agent-policy";
import { requireEditorialAgent, editorialFailure, editorialHeaders } from "@/lib/editorial-agent-server";

export async function GET(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? "";
  const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const afterId = request.nextUrl.searchParams.get("afterId");
  if (!uuid.test(organizationId) || (afterId && !uuid.test(afterId))) return NextResponse.json({error: "editorial_required"}, {status: 400, headers: editorialHeaders});
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    if (!uuid.test(id)) return NextResponse.json({error: "editorial_required"}, {status: 400, headers: editorialHeaders});
    // Historical per-entry capability permits only minimal readback, including
    // a lost successful hide response. Revocation still blocks every write.
    const {data, error} = await db.from("editorial_legacy_expiry_grants")
      .select("entry_id,used_at,entry:organization_entries!inner(organization_id,moderation_status,updated_at)")
      .eq("entry_id", id).eq("organization_id", organizationId).maybeSingle();
    if (error) return NextResponse.json({error: "editorial_unavailable"}, {status: 503, headers: editorialHeaders});
    const entry = Array.isArray(data?.entry) ? data.entry[0] : data?.entry;
    if (!data || !entry || entry.organization_id !== organizationId) return NextResponse.json({error: "editorial_forbidden"}, {status: 403, headers: editorialHeaders});
    return NextResponse.json({entry: {id: data.entry_id, currentStatus: entry.moderation_status, currentUpdatedAt: entry.updated_at, usedAt: data.used_at}}, {headers: editorialHeaders});
  }
  let query = db.from("editorial_legacy_expiry_grants")
    .select("entry_id,organization_id,entry_revision,source_url,evidence_sha256,content_expires_at,valid_until,entry:organization_entries!inner(updated_at,moderation_status),organization:organizations!inner(moderation_status)")
    .eq("organization_id", organizationId).eq("organization.moderation_status", "approved").eq("enabled", true).is("used_at", null).gt("valid_until", new Date().toISOString()).order("entry_id").limit(101);
  if (afterId) query = query.gt("entry_id", afterId);
  const {data, error} = await query;
  if (error) return NextResponse.json({error: "editorial_unavailable"}, {status: 503, headers: editorialHeaders});
  // No provenance documents, author account IDs or private article bodies leave this endpoint.
  const grants = (data ?? []).slice(0, 100).flatMap(row => {
    const entry = Array.isArray(row.entry) ? row.entry[0] : row.entry;
    if (!entry || entry.updated_at !== row.entry_revision || !["approved", "ended"].includes(entry.moderation_status)) return [];
    return [{id: row.entry_id, organizationId: row.organization_id, expectedUpdatedAt: row.entry_revision,
      sourceUrl: row.source_url, evidenceSha256: row.evidence_sha256, contentExpiresAt: row.content_expires_at, validUntil: row.valid_until}];
  });
  return NextResponse.json({grants, truncated: (data ?? []).length > 100, nextCursor: (data ?? []).length > 100 ? data![99].entry_id : null}, {headers: editorialHeaders});
}

export async function POST(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const body = await request.json().catch(() => null);
  if (!body || !/^[a-f0-9-]{36}$/i.test(body.id) || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)) ||
    body.verified !== true || !editorialSourceUrl(body.sourceUrl) || typeof body.checkedAt !== "string" || !Number.isFinite(Date.parse(body.checkedAt)) ||
    !/^[a-f0-9]{64}$/.test(body.evidenceSha256) || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 500) return NextResponse.json({error: "editorial_required"}, {status: 400, headers: editorialHeaders});
  const {data, error} = await db.rpc("hide_editorial_legacy_entry", {p_actor: actor.userId, p_entry: body.id, p_expected: body.expectedUpdatedAt,
    p_source: body.sourceUrl, p_checked: body.checkedAt, p_verified: true, p_evidence: body.evidenceSha256, p_reason: body.reason});
  if (error) return editorialFailure(error);
  const entry = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({entry: {id: entry.id, moderation_status: entry.moderation_status, updated_at: entry.updated_at}}, {headers: editorialHeaders});
}
