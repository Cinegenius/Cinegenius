import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { anyBlockExists } from "@/lib/trust";
import { blockedMediaOwnerIds, visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import { canonicalContactConnections, contactUserId, publicContactConnection, type ContactConnection } from "@/lib/contact-connections";
import { contactJson, mutateContact } from "@/lib/contact-mutations";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export async function GET(req: NextRequest) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return member;
  const t = await getTranslations("Contacts");
  const actor = member.userId;
  const target = req.nextUrl.searchParams.get("userId");
  if (target && !contactUserId.test(target)) return contactJson({ error: t("invalid") }, 400);
  if (target) {
    if (await anyBlockExists(actor, target)) return contactJson({ error: t("unavailable") }, 403);
    const { data, error } = await db.from("friendships").select("id,sender_id,receiver_id,status,created_at")
      .or(`and(sender_id.eq.${actor},receiver_id.eq.${target}),and(sender_id.eq.${target},receiver_id.eq.${actor})`);
    if (error) return contactJson({ error: t("error") }, 503);
    const connection = canonicalContactConnections((data ?? []) as ContactConnection[], actor)[0];
    return contactJson({ friendship: connection ? publicContactConnection(connection) : null });
  }
  const { data, error } = await db.from("friendships")
    .select("id,sender_id,receiver_id,status,created_at,sender_collab_label,sender_collab_public,receiver_collab_label,receiver_collab_public")
    .or(`sender_id.eq.${actor},receiver_id.eq.${actor}`).order("created_at", { ascending: false });
  if (error) return contactJson({ error: t("error") }, 503);
  let blocked: Set<string>;
  try { blocked = new Set(await blockedMediaOwnerIds(actor)); }
  catch { return contactJson({ error: t("error") }, 503); }
  const otherId = (row: ContactConnection) => row.sender_id === actor ? row.receiver_id : row.sender_id;
  const list = canonicalContactConnections((data ?? []) as ContactConnection[], actor).filter(row => !blocked.has(otherId(row)));
  const ids = list.map(otherId);
  const visible = await visibleLinkedProfileIds(ids, actor);
  const { data: profiles, error: profileError } = visible.size
    ? await db.from("profiles").select("user_id,display_name,avatar_url,role,positions").in("user_id", [...visible])
    : { data: [], error: null };
  if (profileError) return contactJson({ error: t("error") }, 503);
  const profileMap = new Map((profiles ?? []).map(profile => [profile.user_id, profile]));
  const enrich = (row: ContactConnection) => {
    const id = otherId(row), profile = profileMap.get(id), sender = row.sender_id === actor;
    return {
      friendship_id: row.id, user_id: id, display_name: profile?.display_name || t("member"), avatar_url: profile?.avatar_url ?? null,
      role: profile?.role || profile?.positions?.[0] || t("member"), created_at: row.created_at,
      collab_label: (sender ? row.sender_collab_label : row.receiver_collab_label) ?? null,
      collab_public: (sender ? row.sender_collab_public : row.receiver_collab_public) ?? false,
    };
  };
  return contactJson({
    friends: list.filter(row => row.status === "accepted").map(enrich),
    incoming: list.filter(row => row.status === "pending" && row.receiver_id === actor).map(enrich),
    outgoing: list.filter(row => row.status === "pending" && row.sender_id === actor).map(enrich),
  });
}

export async function POST(req: NextRequest) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return member;
  const t = await getTranslations("Contacts");
  if (!(await rateLimit(`contact-request:${member.userId}`, 20, 60)).allowed) return contactJson({ error: t("rateLimited") }, 429);
  const body = await req.json().catch(() => null);
  if (body?.accountId !== undefined && body.accountId !== member.userId) return contactJson({ error: t("changed") }, 409);
  if (typeof body?.receiver_id !== "string" || !contactUserId.test(body.receiver_id) || body.receiver_id === member.userId) return contactJson({ error: t("invalid") }, 400);
  return mutateContact(member.userId, "request", { target: body.receiver_id });
}
