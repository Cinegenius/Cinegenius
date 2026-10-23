import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole, canCompanyRoleManageTarget, companyPermissionRoleForStorage, normalizeCompanyPermissionRole, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import { companyDashboardRequestsUrl, companyPublicTitlesDiffer, isPublicCompanyMembership, normalizeCompanyRequestMessage } from "@/lib/company-membership-requests";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const admin = db;
const privateJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

function revalidateCompany(slug?: string | null) {
  revalidateTag("companies", "max");
  revalidateTag("profiles", "max");
  if (slug) revalidatePath(`/companies/${slug}`);
}

// GET /api/company-members?company_id=xxx → active members; managers also see requests and permission roles.
// GET /api/company-members?user_id=xxx → the signed-in user's memberships.
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  const userId = req.nextUrl.searchParams.get("user_id");

  if (companyId) {
    const caller = await getCurrentUser();
    const [{ data: company }, access] = await Promise.all([
      admin.from("companies").select("id, slug, owner_user_id, published").eq("id", companyId).maybeSingle(),
      caller ? getCompanyAccess(companyId, caller.userId) : Promise.resolve(null),
    ]);
    if (!company) return privateJson({ error: "Firma nicht gefunden" }, 404);
    if (company.published !== true && !access) return privateJson({ error: "Firma nicht gefunden" }, 404);

    const canManageTeam = !!access && canCompanyRole(access.role, "manage_team");
    let query = admin.from("company_members")
      .select("id, company_id, user_id, role, title, public_titles, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (!canManageTeam) query = query.eq("status", "accepted");
    const { data: members, error } = await query;
    if (error) return privateJson({ error: "Teamdaten konnten nicht geladen werden." }, 500);

    const pendingIds = canManageTeam ? (members ?? []).filter((member) => member.status === "pending").map((member) => member.id) : [];
    const { data: requestMessages } = pendingIds.length
      ? await admin.from("company_members").select("id, request_message").in("id", pendingIds)
      : { data: [] as { id: string; request_message: string | null }[] };
    const messagesByMember = new Map((requestMessages ?? []).map((item) => [item.id, item.request_message ?? ""]));

    const userIds = (members ?? []).map((member) => member.user_id);
    const profiles: Record<string, { display_name: string; avatar_url: string | null; slug: string | null; role: string | null }> = {};
    if (userIds.length) {
      const { data } = await admin.from("profiles").select("user_id, display_name, avatar_url, slug, role").in("user_id", userIds);
      for (const profile of data ?? []) profiles[profile.user_id] = profile;
    }
    const result = (members ?? []).filter((member) => canManageTeam || isPublicCompanyMembership(member.status)).map((member) => ({
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
    if (!caller) return privateJson({ error: "Nicht eingeloggt" }, 401);
    if (caller.userId !== userId) return privateJson({ error: "Keine Berechtigung" }, 403);
    const { data, error } = await admin.from("company_members")
      .select("id, company_id, role, title, public_titles, status, companies(id, slug, name, logo_url, published)")
      .eq("user_id", userId).eq("status", "accepted").order("created_at", { ascending: true });
    if (error) return privateJson({ error: "Firmenzugehörigkeiten konnten nicht geladen werden." }, 500);
    return privateJson({ data: (data ?? []).filter((member) => (member.companies as { published?: boolean } | null)?.published) });
  }
  return privateJson({ error: "company_id oder user_id erforderlich" }, 400);
}

// POST /api/company-members { company_id, public_titles, message? } → private request to join.
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const companyId = typeof body.company_id === "string" ? body.company_id : "";
  const message = normalizeCompanyRequestMessage(body.message);
  if (!companyId) return privateJson({ error: "company_id fehlt" }, 400);

  const { data: company } = await admin.from("companies").select("id, slug, owner_user_id, published").eq("id", companyId).maybeSingle();
  if (!company || !company.published) return privateJson({ error: "Firma nicht gefunden" }, 404);
  if (company.owner_user_id === userId) return privateJson({ error: "Du bist bereits Inhaber dieser Firma" }, 400);

  const publicTitles = normalizeCompanyPublicTitles(body.public_titles ?? body.title);
  if (!publicTitles.length) return privateJson({ error: "Bitte lade die Firmenseite neu und wähle deine öffentliche Funktion aus, bevor du die Beitrittsanfrage sendest." }, 400);

  const { data: existing } = await admin.from("company_members").select("id, status, title, public_titles").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  if (existing?.status === "accepted") return privateJson({ error: "Du bist bereits Mitglied dieser Firma.", data: existing }, 409);
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
    const { data: raced } = await admin.from("company_members").select("id, status").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
    if (raced?.status === "pending") return privateJson({ data: raced, alreadyRequested: true });
    if (raced?.status === "accepted") return privateJson({ error: "Du bist bereits Mitglied dieser Firma.", data: raced }, 409);
    return privateJson({ error: "Die Beitrittsanfrage konnte nicht gespeichert werden." }, 500);
  }

  try {
    const [{ data: profile }, { data: co }, { data: admins }] = await Promise.all([
      admin.from("profiles").select("display_name, slug").eq("user_id", userId).maybeSingle(),
      admin.from("companies").select("name, slug, owner_user_id").eq("id", companyId).single(),
      admin.from("company_members").select("user_id").eq("company_id", companyId).eq("status", "accepted").in("role", ["admin", "manager"]),
    ]);
    if (profile && co) {
      const recipients = [...new Set([co.owner_user_id, ...(admins ?? []).map((item) => item.user_id)].filter(Boolean))];
      if (recipients.length) await admin.from("notifications").insert(recipients.map((recipient) => ({
        user_id: recipient,
        type: "company_join_request",
        title: "Neue Beitrittsanfrage",
        body: `${profile.display_name} möchte ${co.name} als ${publicTitles.join(" · ")} beitreten.`,
        href: companyDashboardRequestsUrl(companyId),
      })));
    }
  } catch { /* In-app notification is best effort. */ }
  revalidateCompany(company.slug);
  return privateJson({ data });
}

// PATCH: only authorized company managers can approve requests or edit public functions.
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const { id, status, role } = body;
  if (typeof id !== "string" || !id) return privateJson({ error: "id fehlt" }, 400);

  const { data: member } = await admin.from("company_members")
    .select("id, company_id, user_id, role, status, title, public_titles")
    .eq("id", id).maybeSingle();
  if (!member) return privateJson({ error: "Mitglied nicht gefunden" }, 404);
  const [access, companyResult] = await Promise.all([
    getCompanyAccess(member.company_id, userId),
    admin.from("companies").select("slug").eq("id", member.company_id).maybeSingle(),
  ]);
  const canManage = !!access && canCompanyRole(access.role, "manage_team");
  const updates: Record<string, unknown> = {};

  if (body.public_titles !== undefined || body.title !== undefined) {
    if (!canManage) return privateJson({ error: "Nur die Firma kann öffentliche Funktionen ändern. Bitte sende eine Funktionsänderungsanfrage." }, 403);
    if (member.status !== "accepted" && status !== "accepted") return privateJson({ error: "Eine Funktion kann erst bei der Bestätigung der Beitrittsanfrage festgelegt werden." }, 409);
    const titles = normalizeCompanyPublicTitles(body.public_titles ?? body.title);
    if (!titles.length) return privateJson({ error: "Mindestens eine öffentliche Funktion ist erforderlich." }, 400);
    updates.public_titles = titles;
    updates.title = titles[0] ?? null; // Keep older readers working during the transition.
  }

  if (status !== undefined) {
    if (!canManage || status !== "accepted") return privateJson({ error: "Nur die Firmeninhaberschaft oder Administration darf Beitrittsanfragen bestätigen." }, 403);
    if (member.status !== "pending") return privateJson({ error: "Diese Anfrage ist nicht mehr offen." }, 409);
    const titles = normalizeCompanyPublicTitles(body.public_titles ?? member.public_titles ?? member.title);
    if (!titles.length) return privateJson({ error: "Bitte lege vor der Annahme mindestens eine öffentliche Funktion fest." }, 400);
    updates.public_titles = titles;
    updates.title = titles[0];
    updates.status = "accepted";
  }

  if (role !== undefined) {
    if (!access || access.role !== "owner") return privateJson({ error: "Nur der Kontoinhaber darf Verwaltungsrechte vergeben." }, 403);
    const nextRole = normalizeCompanyPermissionRole(role);
    const currentRole = normalizeCompanyPermissionRole(member.role);
    if (!nextRole || nextRole === "owner" || currentRole === "owner") return privateJson({ error: "Diese Berechtigungsrolle kann nicht zugewiesen werden." }, 400);
    updates.role = companyPermissionRoleForStorage(nextRole);
  }

  if (!Object.keys(updates).length) return privateJson({ error: "Keine Änderungen angegeben" }, 400);
  if (role === undefined && status === undefined && !canManage) return privateJson({ error: "Keine Berechtigung" }, 403);

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
        title: "Öffentliche Firmenfunktion geändert",
        body: `Die Firma hat deine öffentliche Funktion aktualisiert: ${normalizeCompanyPublicTitles(data.public_titles?.length ? data.public_titles : data.title).join(" · ")}.`,
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
          title: "Beitritt bestätigt",
          body: changed
            ? `Dein Beitritt zu ${co.name} wurde bestätigt. Die Firma hat folgende Funktion freigegeben: ${approvedTitles.join(" · ")}.`
            : `Du bist jetzt Mitglied von ${co.name} als ${approvedTitles.join(" · ")}.`,
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
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return privateJson({ error: "id fehlt" }, 400);
  const { data: member } = await admin.from("company_members").select("id, company_id, user_id, role, status, companies(owner_user_id)").eq("id", id).maybeSingle();
  if (!member) return privateJson({ error: "Mitglied nicht gefunden" }, 404);
  const access = await getCompanyAccess(member.company_id, userId);
  const self = member.user_id === userId;
  if (!self && (!access || !canCompanyRole(access.role, "manage_team") || !canCompanyRoleManageTarget(access.role, member.role))) {
    return privateJson({ error: "Keine Berechtigung, dieses Mitglied zu entfernen." }, 403);
  }
  const company = member.companies as unknown as { owner_user_id: string } | null;
  if (member.role === "owner" || company?.owner_user_id === member.user_id) return privateJson({ error: "Die Kontoinhaberschaft kann nicht über die Teamliste beendet werden." }, 403);
  const { data: deleted, error } = await admin.from("company_members").delete().eq("id", id).eq("status", member.status).select("id").maybeSingle();
  if (error) return privateJson({ error: "Die Zugehörigkeit konnte nicht beendet werden." }, 500);
  if (!deleted) return privateJson({ error: "Diese Anfrage oder Zugehörigkeit wurde zwischenzeitlich geändert. Lade die Seite neu." }, 409);
  const { data: deletedCompany } = await admin.from("companies").select("slug, name").eq("id", member.company_id).maybeSingle();
  if (member.status === "pending" && !self && deletedCompany) {
    try {
      await admin.from("notifications").insert({ user_id: member.user_id, type: "company_join_rejected", title: "Anfrage abgelehnt", body: `Deine Anfrage, dem Team von ${deletedCompany.name} beizutreten, wurde abgelehnt.`, href: `/companies/${deletedCompany.slug}` });
    } catch { /* In-app notification is best effort. */ }
  }
  revalidateCompany(deletedCompany?.slug);
  return privateJson({ success: true });
}
