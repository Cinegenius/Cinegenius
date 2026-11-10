import { localizedNotification } from "@/lib/i18n/notification-copy";
import { visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole, canCompanyRoleManageTarget, companyPermissionRoleForStorage, normalizeCompanyPermissionRole, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import { companyDashboardRequestsUrl, companyPublicTitlesDiffer, isPublicCompanyMembership, normalizeCompanyRequestMessage } from "@/lib/company-membership-requests";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const admin = db;
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

function revalidateCompany(slug?: string | null) {
  revalidateTag("companies", { expire: 0 });
  revalidateTag("profiles", { expire: 0 });
  if (slug) revalidatePath(`/companies/${slug}`);
}

// GET /api/company-members?company_id=xxx → active members; managers also see requests and permission roles.
// GET /api/company-members?user_id=xxx → the signed-in user's memberships.
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const companyId = req.nextUrl.searchParams.get("company_id");
  const userId = req.nextUrl.searchParams.get("user_id");

  if (companyId) {
    const caller = await getCurrentUser();
    const [{ data: company }, access] = await Promise.all([
      admin.from("companies").select("id, slug, owner_user_id, published").eq("id", companyId).maybeSingle(),
      caller ? getCompanyAccess(companyId, caller.userId) : Promise.resolve(null),
    ]);
    if (!company) return privateJson({ error: tResponse('System.m_c59ef4b12e52') }, 404);
    if (company.published !== true && !access) return privateJson({ error: tResponse('System.m_c59ef4b12e52') }, 404);

    const canManageTeam = !!access && canCompanyRole(access.role, "manage_team");
    let query = admin.from("company_members")
      .select("id, company_id, user_id, role, title, public_titles, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (!canManageTeam) query = query.eq("status", "accepted");
    const { data: members, error } = await query;
    if (error) return privateJson({ error: tResponse('System.m_f1f445204951') }, 500);

    const pendingIds = canManageTeam ? (members ?? []).filter((member) => member.status === "pending").map((member) => member.id) : [];
    const { data: requestMessages } = pendingIds.length
      ? await admin.from("company_members").select("id, request_message").in("id", pendingIds)
      : { data: [] as { id: string; request_message: string | null }[] };
    const messagesByMember = new Map((requestMessages ?? []).map((item) => [item.id, item.request_message ?? ""]));

    const visibleIds = await visibleLinkedProfileIds((members ?? []).map((member) => member.user_id), caller?.userId ?? null);
    const userIds = [...visibleIds];
    const profiles: Record<string, { display_name: string; avatar_url: string | null; slug: string | null; role: string | null }> = {};
    if (userIds.length) {
      const { data } = await admin.from("profiles").select("user_id, display_name, avatar_url, slug, role").in("user_id", userIds);
      for (const profile of data ?? []) profiles[profile.user_id] = profile;
    }
    const result = (members ?? []).filter((member) => canManageTeam || (isPublicCompanyMembership(member.status) && visibleIds.has(member.user_id))).map((member) => ({
      ...member,
      ...(member.status === "pending" && canManageTeam ? { request_message: messagesByMember.get(member.id) ?? "" } : {}),
      role: canManageTeam ? normalizeCompanyPermissionRole(member.role) ?? "member" : undefined,
      public_titles: normalizeCompanyPublicTitles(member.public_titles?.length ? member.public_titles : member.title),
      profile: profiles[member.user_id] ?? null,
    }));
    return privateJson({ data: result, canManageTeam });
  }

  if (userId) {
    const caller = await getCurrentUser();
    if (!caller) return privateJson({ error: tResponse('System.m_352f63d9d1d9') }, 401);
    if (caller.userId !== userId) return privateJson({ error: tResponse('System.m_df847a54c928') }, 403);
    const { data, error } = await admin.from("company_members")
      .select("id, company_id, role, title, public_titles, status, companies(id, slug, name, logo_url, published)")
      .eq("user_id", userId).eq("status", "accepted").order("created_at", { ascending: true });
    if (error) return privateJson({ error: tResponse('System.m_1e9fea78ed40') }, 500);
    return privateJson({ data: (data ?? []).filter((member) => (member.companies as { published?: boolean } | null)?.published) });
  }
  return privateJson({ error: tResponse('System.m_fc919b801fb4') }, 400);
}

// POST /api/company-members { company_id, public_titles, message? } → private request to join.
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const companyId = typeof body.company_id === "string" ? body.company_id : "";
  const message = normalizeCompanyRequestMessage(body.message);
  if (!companyId) return privateJson({ error: tResponse('System.m_71d566d71666') }, 400);

  const { data: company } = await admin.from("companies").select("id, slug, owner_user_id, published").eq("id", companyId).maybeSingle();
  if (!company || !company.published) return privateJson({ error: tResponse('System.m_c59ef4b12e52') }, 404);
  if (company.owner_user_id === userId) return privateJson({ error: tResponse('System.m_bfdb2938bd4d') }, 400);

  const publicTitles = normalizeCompanyPublicTitles(body.public_titles ?? body.title);
  if (!publicTitles.length) return privateJson({ error: tResponse('System.m_b8d33348b482') }, 400);

  const { data: existing } = await admin.from("company_members").select("id, status, title, public_titles").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  if (existing?.status === "accepted") return privateJson({ error: tResponse('System.m_105e5fc25efe'), data: existing }, 409);
  if (existing?.status === "pending") {
    return privateJson({ data: existing, alreadyRequested: true });
  }
  const requestData = {
    company_id: companyId,
    user_id: userId,
    title: publicTitles[0] ?? null,
    public_titles: publicTitles,
    request_message: message,
    status: "pending",
    role: "member",
  };
  const { data, error } = existing
    ? await admin.from("company_members").update(requestData).eq("id", existing.id).select().single()
    : await admin.from("company_members").insert(requestData).select().single();
  if (error) {
    if (error.code === "23505") {
      const { data: invite } = await admin.from("company_invitations").select("id").eq("company_id", companyId).eq("recipient_user_id", userId).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (invite) return privateJson({ error: tResponse('System.m_18fece705f3d'), invitationHref: "/company-invitations" }, 409);
    }
    const { data: raced } = await admin.from("company_members").select("id, status").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
    if (raced?.status === "pending") return privateJson({ data: raced, alreadyRequested: true });
    if (raced?.status === "accepted") return privateJson({ error: tResponse('System.m_105e5fc25efe'), data: raced }, 409);
    return privateJson({ error: tResponse('System.m_9daa4ed56e03') }, 500);
  }

  try {
    const [{ data: profile }, { data: co }, { data: admins }] = await Promise.all([
      admin.from("profiles").select("display_name, slug").eq("user_id", userId).maybeSingle(),
      admin.from("companies").select("name, slug, owner_user_id").eq("id", companyId).single(),
      admin.from("company_members").select("user_id").eq("company_id", companyId).eq("status", "accepted").in("role", ["admin"]),
    ]);
    if (profile && co) {
      const recipients = [...new Set([co.owner_user_id, ...(admins ?? []).map((item) => item.user_id)].filter(Boolean))];
      if (recipients.length) await admin.from("notifications").insert(recipients.map((recipient) => ({
        user_id: recipient,
        type: "company_join_request",
        ...localizedNotification({ title: { key: "n_6f120a657c89" }, body: { key: "n_4226c25553e7", values: { value0: String(profile.display_name), value1: String(co.name), value2: String(publicTitles.join(" · ")) } } }),

        href: companyDashboardRequestsUrl(companyId),
      })));
    }
  } catch { /* In-app notification is best effort. */ }
  revalidateCompany(company.slug);
  return privateJson({ data });
}

// PATCH: only authorized company managers can approve requests or edit public functions.
export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const { id, status, role } = body;
  if (typeof id !== "string" || !id) return privateJson({ error: tResponse('System.m_4b8591045313') }, 400);

  const { data: member } = await admin.from("company_members")
    .select("id, company_id, user_id, role, status, title, public_titles")
    .eq("id", id).maybeSingle();
  if (!member) return privateJson({ error: tResponse('System.m_a8e5f4f1aff8') }, 404);
  const [access, companyResult] = await Promise.all([
    getCompanyAccess(member.company_id, userId),
    admin.from("companies").select("slug").eq("id", member.company_id).maybeSingle(),
  ]);
  const canManage = !!access && canCompanyRole(access.role, "manage_team");
  const updates: Record<string, unknown> = {};

  if (body.public_titles !== undefined || body.title !== undefined) {
    if (!canManage) return privateJson({ error: tResponse('System.m_41341fede483') }, 403);
    if (member.status !== "accepted" && status !== "accepted") return privateJson({ error: tResponse('System.m_4a91e68a180f') }, 409);
    const titles = normalizeCompanyPublicTitles(body.public_titles ?? body.title);
    if (!titles.length) return privateJson({ error: tResponse('System.m_c3c744aafdea') }, 400);
    updates.public_titles = titles;
    updates.title = titles[0] ?? null; // Keep older readers working during the transition.
  }

  if (status !== undefined) {
    if (!canManage || status !== "accepted") return privateJson({ error: tResponse('System.m_1a230372e77a') }, 403);
    if (member.status !== "pending") return privateJson({ error: tResponse('System.m_919a1c812019') }, 409);
    const titles = normalizeCompanyPublicTitles(body.public_titles ?? member.public_titles ?? member.title);
    if (!titles.length) return privateJson({ error: tResponse('System.m_65843baa61af') }, 400);
    updates.public_titles = titles;
    updates.title = titles[0];
    updates.status = "accepted";
  }

  if (role !== undefined) {
    if (!access || access.role !== "owner") return privateJson({ error: tResponse('System.m_16aa48330a2d') }, 403);
    const nextRole = normalizeCompanyPermissionRole(role);
    const currentRole = normalizeCompanyPermissionRole(member.role);
    if (!nextRole || nextRole === "owner" || currentRole === "owner") return privateJson({ error: tResponse('System.m_34ce72bd9720') }, 400);
    updates.role = companyPermissionRoleForStorage(nextRole);
  }

  if (!Object.keys(updates).length) return privateJson({ error: tResponse('System.m_703f33bf5ae7') }, 400);
  if (role === undefined && status === undefined && !canManage) return privateJson({ error: tResponse('System.m_df847a54c928') }, 403);

  let updateQuery = admin.from("company_members").update(updates).eq("id", id);
  if (status === "accepted") updateQuery = updateQuery.eq("status", "pending");
  else if (updates.public_titles && member.status === "accepted") updateQuery = updateQuery.eq("status", "accepted");
  const { data, error } = await updateQuery.select().single();
  if (error) return privateJson({ error: error.code === "PGRST116" ? "Die Anfrage wurde zwischenzeitlich geändert. Lade die Teamliste neu." : "Die Teamänderung konnte nicht gespeichert werden." }, error.code === "PGRST116" ? 409 : 500);
  if (updates.public_titles && member.status === "accepted" && companyPublicTitlesDiffer(member.public_titles?.length ? member.public_titles : member.title, data.public_titles?.length ? data.public_titles : data.title)) {
    try {
      const { data: co } = await admin.from("companies").select("name, slug").eq("id", member.company_id).single();
      if (co) await admin.from("notifications").insert({
        user_id: member.user_id,
        type: "company_public_title_changed",
        ...localizedNotification({ title: { key: "n_413a99014613" }, body: { key: "n_9faff5e62e37", values: { value0: String(normalizeCompanyPublicTitles(data.public_titles?.length ? data.public_titles : data.title).join(" · ")) } } }),

        href: `/companies/${co.slug}`,
      });
    } catch { /* In-app notification is best effort. */ }
  }
  if (status === "accepted" && member.status !== "accepted") {
    try {
      const { data: co } = await admin.from("companies").select("name, slug").eq("id", member.company_id).single();
      if (co) {
        const requestedTitles = normalizeCompanyPublicTitles(member.public_titles?.length ? member.public_titles : member.title);
        const approvedTitles = normalizeCompanyPublicTitles(data.public_titles?.length ? data.public_titles : data.title);
        const changed = companyPublicTitlesDiffer(requestedTitles, approvedTitles);
        await admin.from("notifications").insert({
          user_id: member.user_id,
          type: "company_join_accepted",
          ...localizedNotification({ title: { key: "n_e8c5800ebc76" }, body: changed ? { key: "n_00689bb641b6", values: { value0: String(co.name), value1: String(approvedTitles.join(" · ")) } } : { key: "n_88e04a64baa6", values: { value0: String(co.name), value1: String(approvedTitles.join(" · ")) } } }),

          href: `/companies/${co.slug}`,
        });
      }
    } catch { /* In-app notification is best effort. */ }
  }
  revalidateCompany(companyResult.data?.slug);
  return privateJson({ data });
}

// DELETE: a member may leave; owners/admins may remove members they are allowed to manage.
export async function DELETE(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return privateJson({ error: tResponse('System.m_4b8591045313') }, 400);
  const { data: member } = await admin.from("company_members").select("id, company_id, user_id, role, status, companies(owner_user_id)").eq("id", id).maybeSingle();
  if (!member) return privateJson({ error: tResponse('System.m_a8e5f4f1aff8') }, 404);
  const access = await getCompanyAccess(member.company_id, userId);
  const self = member.user_id === userId;
  if (!self && (!access || !canCompanyRole(access.role, "manage_team") || !canCompanyRoleManageTarget(access.role, member.role))) {
    return privateJson({ error: tResponse('System.m_b6fbeab43737') }, 403);
  }
  const company = member.companies as unknown as { owner_user_id: string } | null;
  if (member.role === "owner" || company?.owner_user_id === member.user_id) return privateJson({ error: tResponse('System.m_29f47c26f24e') }, 403);
  const { data: deleted, error } = await admin.from("company_members").delete().eq("id", id).eq("status", member.status).select("id").maybeSingle();
  if (error) return privateJson({ error: tResponse('System.m_8f0ed14f4a34') }, 500);
  if (!deleted) return privateJson({ error: tResponse('System.m_89fd71894779') }, 409);
  const { data: deletedCompany } = await admin.from("companies").select("slug, name").eq("id", member.company_id).maybeSingle();
  if (member.status === "pending" && !self && deletedCompany) {
    try {
      await admin.from("notifications").insert({ user_id: member.user_id, type: "company_join_rejected", ...localizedNotification({ title: { key: "n_54596ecd198e" }, body: { key: "n_58d793c6edc0", values: { value0: String(deletedCompany.name) } } }),  href: `/companies/${deletedCompany.slug}` });
    } catch { /* In-app notification is best effort. */ }
  }
  revalidateCompany(deletedCompany?.slug);
  return privateJson({ success: true });
}
