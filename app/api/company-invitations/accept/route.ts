import { localizedNotification } from "@/lib/i18n/notification-copy";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { companyPermissionRoleForStorage, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return privateJson({ error: tResponse('System.m_72543de2b6f0') }, 400);

  const now = new Date().toISOString();
  const { data: invitation } = await db.from("company_invitations")
    .select("id, company_id, permission_role, public_titles, status, claimed_by, expires_at")
    .eq("token_hash", hashToken(token)).gt("expires_at", now).maybeSingle();
  if (!invitation) return privateJson({ error: tResponse('System.m_72543de2b6f0') }, 410);

  const [{ data: company }, { data: existing }] = await Promise.all([
    db.from("companies").select("id, slug, name, owner_user_id").eq("id", invitation.company_id).maybeSingle(),
    db.from("company_members").select("id, status").eq("company_id", invitation.company_id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!company) return privateJson({ error: tResponse('System.m_cd738841033a') }, 404);
  if (company.owner_user_id === userId) return privateJson({ error: tResponse('System.m_c1ec1de8dc22') }, 409);
  if (existing?.status === "accepted") return privateJson({ error: tResponse('System.m_105e5fc25efe') }, 409);

  // A completed response can be retried safely by the same account if the
  // browser lost the first response. Other accounts cannot claim the link.
  if (invitation.status === "claimed") {
    if (invitation.claimed_by !== userId || !existing) return privateJson({ error: tResponse('System.m_77af9cd5a71b') }, 410);
    return privateJson({ data: existing, company: { slug: company.slug, name: company.name }, requiresApproval: existing.status !== "accepted" });
  }
  if (invitation.status !== "pending") return privateJson({ error: tResponse('System.m_366f30962e65') }, 410);

  // Claim atomically before creating membership so two different accounts
  // cannot race to use the same single-use invitation.
  const { data: claimed } = await db.from("company_invitations")
    .update({ status: "claimed", claimed_by: userId })
    .eq("id", invitation.id).eq("status", "pending").gt("expires_at", now)
    .select("id").maybeSingle();
  if (!claimed) return privateJson({ error: tResponse('System.m_35c0db1454f1') }, 410);

  const titles = normalizeCompanyPublicTitles(invitation.public_titles);
  const membershipResult = existing
    ? await db.from("company_members").update({
        role: companyPermissionRoleForStorage(invitation.permission_role) ?? "member",
        title: titles[0] ?? null,
        public_titles: titles,
        status: "pending",
      }).eq("id", existing.id).select("id, status").single()
    : await db.from("company_members").insert({
        company_id: invitation.company_id,
        user_id: userId,
        role: companyPermissionRoleForStorage(invitation.permission_role) ?? "member",
        title: titles[0] ?? null,
        public_titles: titles,
        status: "pending",
      }).select("id, status").single();

  if (membershipResult.error || !membershipResult.data) {
    // The token is still owned by this request, so restore it if the
    // membership could not be written and let the invite be retried.
    await db.from("company_invitations").update({ status: "pending", claimed_by: null })
      .eq("id", invitation.id).eq("status", "claimed").eq("claimed_by", userId);
    return privateJson({ error: tResponse('System.m_57b81ecd0677') }, 500);
  }

  try {
    await db.from("notifications").insert({
      user_id: company.owner_user_id,
      type: "company_join_request",
      ...localizedNotification({ title: { key: "n_00721588db8b" }, body: { key: "n_aacf4c964341", values: { value0: String(company.name) } } }),

      href: `/companies/${company.slug}`,
    });
  } catch { /* Notification is best effort. */ }
  return privateJson({ data: membershipResult.data, company: { slug: company.slug, name: company.name }, requiresApproval: true });
}
