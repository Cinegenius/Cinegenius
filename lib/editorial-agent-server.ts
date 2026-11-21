import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EDITORIAL_ACTOR, editorialCredentialValid } from "@/lib/editorial-agent-policy";
import { rateLimit } from "@/lib/rateLimit";

export const editorialHeaders = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
export async function requireEditorialAgent(request: NextRequest) {
  if (!editorialCredentialValid(request.headers.get("authorization"), process.env.CINEGENIUS_EDITORIAL_ENABLED, process.env.CINEGENIUS_EDITORIAL_TOKEN_SHA256)) {
    return NextResponse.json({ error: "editorial_unauthorized" }, { status: 401, headers: editorialHeaders });
  }
  const { allowed } = await rateLimit("editorial:requests", 120, 60);
  if (!allowed) return NextResponse.json({ error: "editorial_rate_limited" }, { status: 429, headers: editorialHeaders });
  return { userId: EDITORIAL_ACTOR };
}
export async function editorialOrganizationAllowed(organizationId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(organizationId)) return false;
  const { data, error } = await db.from("organization_editorial_grants").select("enabled").eq("organization_id", organizationId).eq("enabled", true).maybeSingle();
  return !error && data?.enabled === true;
}
export function editorialFailure(error: { code: string; message: string }) {
  const statuses: Record<string, number> = { PT400: 400, PT403: 403, PT404: 404, PT409: 409 };
  const status = statuses[error.code] ?? 503;
  return NextResponse.json({ error: status === 503 ? "editorial_unavailable" : `editorial_${error.message}` }, { status, headers: editorialHeaders });
}
