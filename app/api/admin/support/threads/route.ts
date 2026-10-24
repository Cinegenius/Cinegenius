import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveAdminSupportTarget, SupportTargetError } from "@/lib/admin-support";
import { sendNewMessageEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

const SUPPORT_ACTOR_ID = "cinegenius-support";
const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const { data, error, count } = await db.from("conversations")
    .select("id, support_user_id, support_target_type, support_target_id, support_target_label, support_edit_url, created_by, created_at, updated_at, messages(id, sender_id, content, created_at)", { count: "exact" })
    .eq("kind", "support").order("updated_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(1, { referencedTable: "messages" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: "Supportpostfach konnte nicht geladen werden. Bitte Migration prüfen." }, { status: 503 });
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((row) => row.support_user_id).filter((id): id is string => Boolean(id)))];
  const [{ data: profiles, error: profileError }, { data: unread, error: unreadError }] = await Promise.all([
    userIds.length
      ? db.from("profiles").select("user_id, display_name, slug, avatar_url").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    db.rpc("unread_message_counts", { p_user_id: SUPPORT_ACTOR_ID }),
  ]);
  if (profileError || unreadError) return NextResponse.json({ error: "Supportstatus konnte nicht geladen werden." }, { status: 500 });
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const unreadMap = new Map((unread ?? []).map((row: { conversation_id: string; unread_count: number }) => [row.conversation_id, Number(row.unread_count)]));
  return NextResponse.json({
    threads: rows.map((thread) => {
      const user = profileMap.get(thread.support_user_id ?? "");
      const latest = thread.messages?.[0] ?? null;
      return {
        id: thread.id, targetType: thread.support_target_type, targetId: thread.support_target_id,
        targetLabel: thread.support_target_label, editUrl: thread.support_edit_url,
        userId: thread.support_user_id, userName: user?.display_name ?? "Mitglied",
        userProfileUrl: user?.slug || user?.user_id ? "/profile/" + encodeURIComponent(user.slug || user.user_id) : null,
        userAvatarUrl: user?.avatar_url ?? null, createdAt: thread.created_at, updatedAt: thread.updated_at,
        unreadCount: unreadMap.get(thread.id) ?? 0,
        latest: latest ? {
          id: latest.id, content: latest.content, createdAt: latest.created_at,
          senderName: latest.sender_id === SUPPORT_ACTOR_ID ? "CineGenius Support" : (user?.display_name ?? "Mitglied"),
          fromSupport: latest.sender_id === SUPPORT_ACTOR_ID,
        } : null,
      };
    }),
    total: count ?? 0, page, pageSize: PAGE_SIZE,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { allowed } = await rateLimit("admin-support-send:" + admin.userId, 30, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Supportnachrichten. Bitte kurz warten." }, { status: 429 });
  const body = await request.json().catch(() => null);
  const type = body?.targetType;
  const id = typeof body?.targetId === "string" ? body.targetId : "";
  const templateKey = typeof body?.templateKey === "string" ? body.templateKey : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!["profile", "company", "listing"].includes(type) || !id || id.length > 160 || !content || content.length > 5000 || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "Empfänger, Nachricht und sichere Versandkennung sind erforderlich." }, { status: 400 });
  }
  const { data: template, error: templateError } = await db.from("support_message_templates")
    .select("template_key, body, enabled").eq("template_key", templateKey).maybeSingle();
  if (templateError) return NextResponse.json({ error: "Supportvorlage konnte nicht geprüft werden." }, { status: 503 });
  if (!template?.enabled) return NextResponse.json({ error: "Diese Supportvorlage ist nicht verfügbar." }, { status: 400 });
  if (/\{\{[^}]+\}\}/.test(content)) return NextResponse.json({ error: "Die Nachricht enthält noch nicht ersetzte Platzhalter." }, { status: 400 });

  let target;
  try {
    target = await resolveAdminSupportTarget(type as "profile" | "company" | "listing", id, admin.userId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportTargetError ? error.message : "Empfänger konnte nicht sicher ermittelt werden." }, { status: error instanceof SupportTargetError ? error.status : 500 });
  }
  if (template.body.includes("{{fehlendeAngaben}}") && !target.missingFields.length) {
    return NextResponse.json({ error: "Für diese Vorlage wurden keine fehlenden Pflichtangaben gefunden. Freiwillige Ergänzungen werden nicht als Pflicht dargestellt." }, { status: 400 });
  }
  const expectedEditUrl = new URL(target.editUrl, request.nextUrl.origin).toString();
  if (template.body.includes("{{Bearbeitungslink}}") && !content.includes(expectedEditUrl)) {
    return NextResponse.json({ error: "Der direkte Bearbeitungslink fehlt oder wurde verändert. Bitte Vorlage neu laden." }, { status: 400 });
  }

  const { data, error } = await db.rpc("create_support_conversation", {
    p_admin_user_id: admin.userId, p_recipient_user_id: target.recipientUserId,
    p_target_type: target.targetType, p_target_id: target.targetId, p_target_label: target.targetLabel,
    p_edit_url: target.editUrl, p_content: content, p_idempotency_key: idempotencyKey,
  });
  if (error) {
    console.error("[admin support] create failed", error);
    return NextResponse.json({ error: "Supportnachricht konnte nicht dauerhaft gespeichert werden." }, { status: 503 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.conversation_id || !result?.message_id) {
    return NextResponse.json({ error: "Speicherung der Supportnachricht konnte nicht bestätigt werden." }, { status: 503 });
  }
  if (result.created) {
    try {
      const { data: settings } = await db.from("user_settings").select("email_new_message")
        .eq("user_id", target.recipientUserId).maybeSingle();
      if (settings?.email_new_message !== false) {
        const client = await clerkClient();
        const member = await client.users.getUser(target.recipientUserId);
        const email = member.emailAddresses[0]?.emailAddress;
        if (email) await sendNewMessageEmail(email, "CineGenius Support", content, result.conversation_id);
      }
    } catch { /* in-app message remains the durable source; email is optional */ }
  }
  return NextResponse.json({ success: true, duplicate: !result.created, conversationId: result.conversation_id });
}

