import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORM_DRAFT_LIMIT, validFormDraftData, validFormDraftKey } from "@/lib/form-draft";
import { canUseFormDraft } from "@/lib/form-draft-access";
import { rateLimit } from "@/lib/rateLimit";

const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const key = request.nextUrl.searchParams.get("key");
  if (request.headers.get("X-Draft-Account") !== auth.userId) return json({ code: "account" }, 403);
  if (!validFormDraftKey(key)) return json({ code: "invalid" }, 400);
  try { if (!await canUseFormDraft(auth.userId, key)) return json({ code: "forbidden" }, 403); }
  catch { return json({ code: "unavailable" }, 503); }
  const result = await db.from("private_form_drafts").select("draft_data, revision, updated_at").eq("user_id", auth.userId).eq("form_key", key).maybeSingle();
  if (result.error) return json({ code: "unavailable" }, 503);
  return json({ data: result.data?.draft_data ?? null, revision: result.data?.revision ?? 0, updatedAt: result.data?.updated_at ?? null });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (Number(request.headers.get("content-length")) > 300_000) return json({ code: "invalid" }, 413);
  const body = await request.json().catch(() => null);
  if (body?.account !== auth.userId) return json({ code: "account" }, 403);
  if (body?.data && new TextEncoder().encode(JSON.stringify(body.data)).length > FORM_DRAFT_LIMIT) return json({ code: "too_large" }, 413);
  if (!body || !validFormDraftKey(body.key) || !Number.isSafeInteger(body.revision) || body.revision < 0
    || (body.data !== null && !validFormDraftData(body.data))) return json({ code: "invalid" }, 400);
  try { if (!await canUseFormDraft(auth.userId, body.key)) return json({ code: "forbidden" }, 403); }
  catch { return json({ code: "unavailable" }, 503); }
  if (!(await rateLimit(`form-draft:${auth.userId}`, 120, 60)).allowed) return json({ code: "rate_limit" }, 429);
  // The account comes exclusively from Clerk, never from client data. Even admins
  // cannot use this endpoint to read or overwrite another member's private draft.
  const result = await db.rpc("save_private_form_draft", { p_user: auth.userId, p_key: body.key, p_expected: body.revision, p_data: body.data });
  if (result.error) return json({ code: result.error.code === "40001" ? "conflict" : "unavailable" }, result.error.code === "40001" ? 409 : 503);
  const saved = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!saved || !Number.isSafeInteger(saved.revision)) return json({ code: "unavailable" }, 503);
  return json({ saved: true, revision: saved.revision });
}
