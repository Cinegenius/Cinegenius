import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole, normalizeCompanyPermissionRole, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import { rateLimit } from "@/lib/rateLimit";
import { revalidatePath, revalidateTag } from "next/cache";
import { getPrivateProfileIds } from "@/lib/trust";
import { NextRequest, NextResponse } from "next/server";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const companyId = typeof body.company_id === "string" ? body.company_id : "";
  if (!companyId) return NextResponse.json({ error: "company_id fehlt" }, { status: 400 });
  const access = await getCompanyAccess(companyId, userId);
  if (!access || !canCompanyRole(access.role, "manage_team")) return NextResponse.json({ error: "Keine Berechtigung, Teammitglieder einzuladen." }, { status: 403 });

  if (typeof body.recipient_user_id === "string") {
    const { allowed } = await rateLimit(`company-invite:${userId}`, 30, 3600);
    if (!allowed) return privateJson({ error: "Zu viele Einladungen. Bitte später erneut versuchen." }, 429);
    const recipient = body.recipient_user_id.slice(0, 128);
    const titles = normalizeCompanyPublicTitles(body.public_titles);
    if (!titles.length) return privateJson({ error: "Wähle mindestens eine öffentliche Funktion." }, 400);
    if ((await getPrivateProfileIds([recipient])).has(recipient)) return privateJson({ error: "Dieses Profil ist für die Mitgliedersuche nicht verfügbar." }, 404);
    const { data, error } = await db.rpc("invite_company_member", { p_actor: userId, p_company: companyId, p_recipient: recipient, p_titles: titles });
    if (error) return privateJson({ error: error.code === "23505" ? "Es besteht bereits eine Zugehörigkeit oder Anfrage. Bitte prüfe Team → Anfragen." : "Die Einladung konnte nicht gespeichert werden." }, error.code === "23505" ? 409 : 500);
    return privateJson({ success: true, id: data });
  }

  const role = normalizeCompanyPermissionRole(typeof body.permission_role === "string" ? body.permission_role : "member");
  if (!role || role === "owner" || (role === "admin" && access.role !== "owner")) {
    return NextResponse.json({ error: "Diese Berechtigungsrolle darfst du nicht einladen." }, { status: 403 });
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from("company_invitations").insert({
    company_id: companyId,
    token_hash: hashToken(token),
    permission_role: role,
    public_titles: normalizeCompanyPublicTitles(body.public_titles),
    created_by: userId,
    expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: "Die Einladung konnte nicht erstellt werden. Bitte prüfe, ob die Team-Erweiterung bereits eingespielt ist." }, { status: 500 });
  return NextResponse.json({ invite_url: new URL(`/company-invitations/${token}`, req.nextUrl.origin).toString(), expires_at: expiresAt });
}

const privateJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(req: NextRequest) {
  const caller = await requireAuth();
  if (caller instanceof NextResponse) return caller;
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (companyId) {
    const access = await getCompanyAccess(companyId, caller.userId);
    if (!access || !canCompanyRole(access.role, "manage_team")) return privateJson({ error: "Keine Berechtigung." }, 403);
  }
  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  let query = db.from("company_invitations").select("id,company_id,recipient_user_id,public_titles,status,created_at,expires_at,companies(name,slug,logo_url)", { count: "exact" })
    .not("recipient_user_id", "is", null).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (companyId) query = query.eq("status", "pending").gt("expires_at", new Date().toISOString());
  query = companyId ? query.eq("company_id", companyId) : query.eq("recipient_user_id", caller.userId);
  const { data, error, count } = await query;
  if (error) return privateJson({ error: "Einladungen konnten nicht geladen werden." }, 500);
  const ids = [...new Set((data ?? []).map((item) => item.recipient_user_id))];
  const { data: profiles } = ids.length ? await db.from("profiles").select("user_id,display_name,slug,avatar_url,role,location").in("user_id", ids) : { data: [] };
  const people = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return privateJson({ total: count ?? 0, page, data: (data ?? []).map((item) => ({ ...item, profile: people.get(item.recipient_user_id) ?? null })) });
}
export async function PATCH(req: NextRequest) {
  const caller = await requireAuth();
  if (caller instanceof NextResponse) return caller;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !["accept", "decline", "revoke"].includes(body.decision)) return privateJson({ error: "Ungültige Antwort." }, 400);
  const { data, error } = await db.rpc("respond_company_invitation", { p_actor: caller.userId, p_invitation: body.id, p_decision: body.decision });
  if (error) return privateJson({ error: error.code === "42501" ? "Du darfst diese Einladung nicht bearbeiten." : "Diese Einladung ist nicht mehr offen oder wurde zwischenzeitlich geändert." }, error.code === "42501" ? 403 : 409);
  revalidateTag("companies", { expire: 0 });
  revalidateTag("profiles", { expire: 0 });
  revalidatePath("/companies/[slug]", "page");
  revalidatePath("/profile/[slug]", "page");
  return privateJson({ success: true, status: data });
}
