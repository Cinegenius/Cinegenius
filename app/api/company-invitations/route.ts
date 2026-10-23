import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole, normalizeCompanyPermissionRole, normalizeCompanyPublicTitles } from "@/lib/company-roles";
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
