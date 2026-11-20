import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { editorialFailure, editorialHeaders } from "@/lib/editorial-agent-server";
import { editorialSourceUrl } from "@/lib/editorial-agent-policy";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({error: "forbidden"}, {status: 403, headers: editorialHeaders});
  const body = await request.json().catch(() => null);
  if (!body || !/^[a-f0-9-]{36}$/i.test(body.id) || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt)) ||
      typeof body.enabled !== "boolean" || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 500 ||
      (body.enabled && (body.reviewed !== true || typeof body.originalAuthorUserId !== "string" || typeof body.organizationId !== "string" ||
       typeof body.evidenceReference !== "string" || body.evidenceReference.trim().length < 5 || body.evidenceReference.length > 500 || !editorialSourceUrl(body.sourceUrl) ||
       typeof body.contentExpiresAt !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.contentExpiresAt) || !Number.isFinite(Date.parse(body.contentExpiresAt)) ||
       !/^[a-f0-9]{64}$/.test(body.evidenceSha256)))) return NextResponse.json({error: "required"}, {status: 400, headers: editorialHeaders});
  const {data, error} = await db.rpc("set_editorial_legacy_expiry_grant", {p_actor: admin.userId, p_entry: body.id,
    p_expected: body.expectedUpdatedAt, p_enabled: body.enabled, p_document: {
      organizationId: body.organizationId, originalAuthorUserId: body.originalAuthorUserId, sourceUrl: body.sourceUrl,
      reviewed: body.reviewed, evidenceSha256: body.evidenceSha256, evidenceReference: body.evidenceReference,
      contentExpiresAt: body.contentExpiresAt, reason: body.reason,
    }});
  return error ? editorialFailure(error) : NextResponse.json({grant: data}, {headers: editorialHeaders});
}
