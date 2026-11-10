import { localizedNotification } from "@/lib/i18n/notification-copy";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import { companyPublicTitlesDiffer, normalizeCompanyRequestMessage } from "@/lib/company-membership-requests";
import { revalidatePath, revalidateTag } from "next/cache";
import { companyDashboardRequestsUrl } from "@/lib/company-membership-requests";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store" },
});

function invalidateCompany(slug?: string | null) {
  revalidateTag("companies", { expire: 0 });
  revalidateTag("profiles", { expire: 0 });
  if (slug) revalidatePath(`/companies/${slug}`);
}

export async function GET(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const companyId = request.nextUrl.searchParams.get("company_id");
  if (!companyId) return json({ error: tResponse('System.m_71d566d71666') }, 400);
  const access = await getCompanyAccess(companyId, authResult.userId);
  if (!access || !canCompanyRole(access.role, "manage_team")) return json({ error: tResponse('System.m_b51afd52c6a7') }, 403);

  const { data: requests, error } = await db.from("company_member_title_change_requests")
    .select("id, company_id, company_member_id, user_id, requested_public_titles, message, status, created_at")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return json({ error: tResponse('System.m_553ea807f8a2') }, 500);

  const userIds = [...new Set((requests ?? []).map((item) => item.user_id))];
  const memberIds = [...new Set((requests ?? []).map((item) => item.company_member_id))];
  const [profilesResult, membersResult] = await Promise.all([
    userIds.length ? db.from("profiles").select("user_id, display_name, avatar_url, slug, role").in("user_id", userIds) : Promise.resolve({ data: [] }),
    memberIds.length ? db.from("company_members").select("id, title, public_titles").in("id", memberIds) : Promise.resolve({ data: [] }),
  ]);
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile]));
  const memberships = new Map((membersResult.data ?? []).map((member) => [member.id, member]));
  return json({ data: (requests ?? []).map((item) => ({
    ...item,
    requested_public_titles: normalizeCompanyPublicTitles(item.requested_public_titles),
    current_public_titles: normalizeCompanyPublicTitles(memberships.get(item.company_member_id)?.public_titles?.length
      ? memberships.get(item.company_member_id)?.public_titles
      : memberships.get(item.company_member_id)?.title),
    profile: profiles.get(item.user_id) ?? null,
  })) });
}

export async function POST(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.member_id === "string" ? body.member_id : "";
  if (!memberId) return json({ error: tResponse('System.m_e3e4244f85a9') }, 400);
  const requestedTitles = normalizeCompanyPublicTitles(body.public_titles);
  if (!requestedTitles.length) return json({ error: tResponse('System.m_5d1ebcfa5f81') }, 400);

  const { data: member } = await db.from("company_members")
    .select("id, company_id, user_id, status, title, public_titles")
    .eq("id", memberId)
    .eq("user_id", authResult.userId)
    .maybeSingle();
  if (!member || member.status !== "accepted") return json({ error: tResponse('System.m_3a5a3fafef0a') }, 403);
  if (!companyPublicTitlesDiffer(member.public_titles?.length ? member.public_titles : member.title, requestedTitles)) {
    return json({ error: tResponse('System.m_59ba818b2a52') }, 400);
  }

  const { data: existing } = await db.from("company_member_title_change_requests")
    .select("id, status, created_at")
    .eq("company_member_id", member.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return json({ error: tResponse('System.m_6b2b2d5938a3'), data: existing }, 409);

  const { data, error } = await db.from("company_member_title_change_requests").insert({
    company_id: member.company_id,
    company_member_id: member.id,
    user_id: authResult.userId,
    requested_public_titles: requestedTitles,
    message: normalizeCompanyRequestMessage(body.message),
  }).select("id, status, created_at").single();
  if (error) {
    if (error.code === "23505") return json({ error: tResponse('System.m_6b2b2d5938a3') }, 409);
    return json({ error: tResponse('System.m_3f9c351ab862') }, 500);
  }

  let supportRequired = false;
  try {
    const [{ data: company }, { data: managers }] = await Promise.all([
      db.from("companies").select("name, slug, owner_user_id").eq("id", member.company_id).maybeSingle(),
      db.from("company_members").select("user_id").eq("company_id", member.company_id).eq("status", "accepted").in("role", ["admin", "manager"]),
    ]);
    if (company) {
      const recipients = [...new Set([company.owner_user_id, ...(managers ?? []).map((manager) => manager.user_id)].filter((id): id is string => !!id))];
      supportRequired = recipients.length === 0;
      if (recipients.length) await db.from("notifications").insert(recipients.map((recipient) => ({
        user_id: recipient,
        type: "company_title_change_request",
        ...localizedNotification({ title: { key: "n_fbaa8a9dbe43" }, body: { key: "n_b15e8fef3e8e", values: { value0: String(company.name), value1: String(requestedTitles.join(" · ")) } } }),

        href: companyDashboardRequestsUrl(member.company_id),
      })));
      invalidateCompany(company.slug);
    }
  } catch { supportRequired = true; /* The request is safely stored; notification is best effort. */ }
  return json({ data, support_required: supportRequired }, 201);
}

export async function PATCH(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const body = await request.json().catch(() => ({}));
  const requestId = typeof body.id === "string" ? body.id : "";
  const status = body.status === "accepted" || body.status === "rejected" ? body.status : "";
  if (!requestId || !status) return json({ error: tResponse('System.m_2749d54db577') }, 400);
  const { data: membershipRequest } = await db.from("company_member_title_change_requests")
    .select("id, company_id, company_member_id, user_id, requested_public_titles, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!membershipRequest) return json({ error: tResponse('System.m_d891c9e7c9bb') }, 404);
  const access = await getCompanyAccess(membershipRequest.company_id, authResult.userId);
  if (!access || !canCompanyRole(access.role, "manage_team")) return json({ error: tResponse('System.m_8713fdf00bfa') }, 403);
  if (membershipRequest.user_id === authResult.userId) return json({ error: tResponse('System.m_239c74262da5') }, 403);
  const approvedTitles = status === "accepted"
    ? normalizeCompanyPublicTitles(body.public_titles ?? membershipRequest.requested_public_titles)
    : [];
  if (status === "accepted" && !approvedTitles.length) return json({ error: tResponse('System.m_97c60b2fb99b') }, 400);

  const { data, error } = await db.rpc("resolve_company_member_title_change_request", {
    p_request_id: requestId,
    p_status: status,
    p_reviewed_by: authResult.userId,
    p_approved_public_titles: approvedTitles,
  });
  if (error) {
    const conflict = error.message.toLowerCase().includes("pending") || error.message.toLowerCase().includes("requester");
    return json({ error: conflict ? "Diese Anfrage ist nicht mehr offen oder kann von dir nicht selbst freigegeben werden." : "Die Entscheidung konnte nicht gespeichert werden." }, conflict ? 409 : 500);
  }

  try {
    const { data: company } = await db.from("companies").select("name, slug").eq("id", membershipRequest.company_id).single();
    if (company) {
      const changed = status === "accepted" && companyPublicTitlesDiffer(membershipRequest.requested_public_titles, approvedTitles);
      await db.from("notifications").insert({
        user_id: membershipRequest.user_id,
        type: status === "accepted" ? "company_title_change_accepted" : "company_title_change_rejected",
        ...localizedNotification({ title: status === "accepted" ? { key: "n_bce4cfa042e8" } : { key: "n_26af4d7e3d94" }, body: status === "accepted" ? changed ? { key: "n_927b5fa88562", values: { value0: String(approvedTitles.join(" · ")) } } : { key: "n_f5199140fafc", values: { value0: String(approvedTitles.join(" · ")) } } : { key: "n_db27acf9e567" } }),

        href: `/companies/${company.slug}`,
      });
      invalidateCompany(company.slug);
    }
  } catch { /* A notification failure does not roll back the recorded decision. */ }
  return json({ data });
}

export async function DELETE(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const requestId = request.nextUrl.searchParams.get("id");
  if (!requestId) return json({ error: tResponse('System.m_4b8591045313') }, 400);
  const { data: membershipRequest } = await db.from("company_member_title_change_requests")
    .select("id, user_id, status, company_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!membershipRequest) return json({ error: tResponse('System.m_d891c9e7c9bb') }, 404);
  if (membershipRequest.user_id !== authResult.userId) return json({ error: tResponse('System.m_e92adca054ab') }, 403);
  if (membershipRequest.status !== "pending") return json({ error: tResponse('System.m_919a1c812019') }, 409);
  const { data, error } = await db.from("company_member_title_change_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId)
    .eq("user_id", authResult.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return json({ error: tResponse('System.m_2996f080e930') }, 500);
  if (!data) return json({ error: tResponse('System.m_a5d7d8535f1d') }, 409);
  return json({ success: true });
}
