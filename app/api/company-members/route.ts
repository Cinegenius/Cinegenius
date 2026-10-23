import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { getCompanyAccess } from "@/lib/company-access";
import { canCompanyRole, canCompanyRoleManageTarget, companyPermissionRoleForStorage, normalizeCompanyPermissionRole, normalizeCompanyPublicTitles } from "@/lib/company-roles";
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

    const userIds = (members ?? []).map((member) => member.user_id);
    const profiles: Record<string, { display_name: string; avatar_url: string | null; slug: string | null; role: string | null }> = {};
    if (userIds.length) {
      const { data } = await admin.from("profiles").select("user_id, display_name, avatar_url, slug, role").in("user_id", userIds);
      for (const profile of data ?? []) profiles[profile.user_id] = profile;
    }
    const result = (members ?? []).map((member) => ({
      ...member,
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

// POST /api/company-members { company_id, public_titles? } → request to join.
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const companyId = typeof body.company_id === "string" ? body.company_id : "";
  if (!companyId) return privateJson({ error: "company_id fehlt" }, 400);

  const { data: company } = await admin.from("companies").select("id, slug, owner_user_id, published").eq("id", companyId).maybeSingle();
  if (!company || !company.published) return privateJson({ error: "Firma nicht gefunden" }, 404);
  if (company.owner_user_id === userId) return privateJson({ error: "Du bist bereits Inhaber dieser Firma" }, 400);

  const { data: existing } = await admin.from("company_members").select("id, status").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
  if (existing?.status === "accepted") return privateJson({ error: "Du bist bereits Mitglied dieser Firma.", data: existing }, 409);
  if (existing?.status === "pending") return privateJson({ data: existing });

  const publicTitles = normalizeCompanyPublicTitles(body.public_titles ?? body.title);
  if (!publicTitles.length) return privateJson({ error: "Bitte gib an, mit welcher öffentlichen Funktion du dem Team beitreten möchtest." }, 400);
  const { data, error } = await admin.from("company_members").insert({
    company_id: companyId,
    user_id: userId,
    title: publicTitles[0] ?? null,
    public_titles: publicTitles,
    status: "pending",
    role: "member",
  }).select().single();
  if (error) {
    const { data: raced } = await admin.from("company_members").select("id, status").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
    if (raced?.status === "pending") return privateJson({ data: raced, alreadyRequested: true });
    if (raced?.status === "accepted") return privateJson({ error: "Du bist bereits Mitglied dieser Firma.", data: raced }, 409);
    return privateJson({ error: "Die Beitrittsanfrage konnte nicht gespeichert werden." }, 500);
  }

  try {
    const [{ data: profile }, { data: co }] = await Promise.all([
      admin.from("profiles").select("display_name, slug").eq("user_id", userId).maybeSingle(),
      admin.from("companies").select("name, slug, owner_user_id").eq("id", companyId).single(),
    ]);
    if (profile && co) await admin.from("notifications").insert({
      user_id: co.owner_user_id,
      type: "company_join_request",
      title: "Neue Beitrittsanfrage",
      body: `${profile.display_name} möchte ${co.name} als ${publicTitles.join(" · ")} beitreten.`,
      href: `/companies/${co.slug}`,
    });
  } catch { /* In-app notification is best effort. */ }
  revalidateCompany(company.slug);
  return privateJson({ data });
}

// PATCH: public titles can be edited by the member; only authorized company managers can accept requests/change permissions.
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => ({}));
  const { id, status, role } = body;
  if (typeof id !== "string" || !id) return privateJson({ error: "id fehlt" }, 400);

  const { data: member } = await admin.from("company_members")
    .select("id, company_id, user_id, role, status")
    .eq("id", id).maybeSingle();
  if (!member) return privateJson({ error: "Mitglied nicht gefunden" }, 404);
  const [access, companyResult] = await Promise.all([
    getCompanyAccess(member.company_id, userId),
    admin.from("companies").select("slug").eq("id", member.company_id).maybeSingle(),
  ]);
  const self = member.user_id === userId;
  const canManage = !!access && canCompanyRole(access.role, "manage_team");
  const updates: Record<string, unknown> = {};

  if (body.public_titles !== undefined || body.title !== undefined) {
    if (!self && !canManage) return privateJson({ error: "Keine Berechtigung, um diese Funktion zu ändern." }, 403);
    const titles = normalizeCompanyPublicTitles(body.public_titles ?? body.title);
    updates.public_titles = titles;
    updates.title = titles[0] ?? null; // Keep older readers working during the transition.
  }

  if (status !== undefined) {
    if (!canManage || status !== "accepted") return privateJson({ error: "Nur die Firmeninhaberschaft oder Administration darf Beitrittsanfragen bestätigen." }, 403);
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
  if (role === undefined && status === undefined && !self && !canManage) return privateJson({ error: "Keine Berechtigung" }, 403);

  const { data, error } = await admin.from("company_members").update(updates).eq("id", id).select().single();
  if (error) return privateJson({ error: "Die Teamänderung konnte nicht gespeichert werden." }, 500);
  if (status === "accepted" && member.status !== "accepted") {
    try {
      const { data: co } = await admin.from("companies").select("name, slug").eq("id", member.company_id).single();
      if (co) await admin.from("notifications").insert({ user_id: member.user_id, type: "company_join_accepted", title: "Beitritt bestätigt", body: `Du bist jetzt Mitglied von ${co.name}.`, href: `/companies/${co.slug}` });
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
  const { data: member } = await admin.from("company_members").select("id, company_id, user_id, role, companies(owner_user_id)").eq("id", id).maybeSingle();
  if (!member) return privateJson({ error: "Mitglied nicht gefunden" }, 404);
  const access = await getCompanyAccess(member.company_id, userId);
  const self = member.user_id === userId;
  if (!self && (!access || !canCompanyRole(access.role, "manage_team") || !canCompanyRoleManageTarget(access.role, member.role))) {
    return privateJson({ error: "Keine Berechtigung, dieses Mitglied zu entfernen." }, 403);
  }
  const company = member.companies as unknown as { owner_user_id: string } | null;
  if (member.role === "owner" || company?.owner_user_id === member.user_id) return privateJson({ error: "Die Kontoinhaberschaft kann nicht über die Teamliste beendet werden." }, 403);
  const { error } = await admin.from("company_members").delete().eq("id", id);
  if (error) return privateJson({ error: "Die Zugehörigkeit konnte nicht beendet werden." }, 500);
  const { data: deletedCompany } = await admin.from("companies").select("slug").eq("id", member.company_id).maybeSingle();
  revalidateCompany(deletedCompany?.slug);
  return privateJson({ success: true });
}
