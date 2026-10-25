import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole } from "@/lib/company-roles";
import { rateLimit } from "@/lib/rateLimit";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(req: NextRequest) {
  const caller = await requireAuth();
  if (caller instanceof NextResponse) return caller;
  const companyId = req.nextUrl.searchParams.get("company_id") ?? "";
  const access = await getCompanyAccess(companyId, caller.userId);
  if (!access || !canCompanyRole(access.role, "manage_team")) return json({ error: "Keine Berechtigung zur Mitgliedersuche." }, 403);
  const { allowed } = await rateLimit(`company-search:${caller.userId}`, 60, 60);
  if (!allowed) return json({ error: "Bitte kurz warten." }, 429);
  const q = (req.nextUrl.searchParams.get("q") ?? "").replace(/[^\p{L}\p{N}\s'’.-]/gu, " ").trim().slice(0, 80);
  if (q.length < 2) return json({ data: [] });
  const { data, error } = await db.rpc("search_company_candidates", { p_actor: caller.userId, p_company: companyId, p_query: q });
  if (error) return json({ error: "Mitglieder konnten nicht gesucht werden." }, 500);
  return json({ data: data ?? [] });
}
