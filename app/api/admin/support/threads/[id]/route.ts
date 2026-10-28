import { SUPPORT_ACTOR_ID, SUPPORT_AVATAR_URL, SUPPORT_NAME } from "@/lib/support-identity";
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { sendNewMessageEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { adminSupportParticipants } from "@/lib/admin-support-participants";


export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const { data: thread, error } = await db.from("conversations")
    .select("id, support_user_id, support_target_type, support_target_id, support_target_label, support_edit_url, created_at, updated_at")
    .eq("id", id).eq("kind", "support").maybeSingle();
  if (error) return NextResponse.json({ error: "Supportunterhaltung konnte nicht geladen werden." }, { status: 500 });
  if (!thread) return NextResponse.json({ error: "Supportunterhaltung nicht gefunden." }, { status: 404 });
  const before = request.nextUrl.searchParams.get("before");
  const beforeId = request.nextUrl.searchParams.get("before_id");
  if ((before || beforeId) && (!before || !beforeId || Number.isNaN(Date.parse(before)) || !/^[0-9a-f-]{36}$/i.test(beforeId))) {
    return NextResponse.json({ error: "Ungültiger Nachrichtenzeiger." }, { status: 400 });
  }
  let query = db.from("messages").select("id, sender_id, content, created_at").eq("conversation_id", id);
  if (before && beforeId) query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);
  const [{ data: profile, error: profileError }, { data: rawMessages, error: messagesError }] = await Promise.all([
    db.from("profiles").select("user_id, display_name, slug, avatar_url").eq("user_id", thread.support_user_id).maybeSingle(),
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(201),
  ]);
  if (profileError || messagesError) return NextResponse.json({ error: "Nachrichten konnten nicht geladen werden." }, { status: 500 });
  let participant = profile;
  if (!participant) {
    try { participant = (await adminSupportParticipants([thread.support_user_id], [])).get(thread.support_user_id) ?? null; }
    catch { return NextResponse.json({ error: "Nachrichten konnten nicht geladen werden." }, { status: 503 }); }
  }
  const hasOlder = (rawMessages?.length ?? 0) > 200;
  const messages = (rawMessages ?? []).slice(0, 200).reverse();
  const messageIds = (messages ?? []).map((message) => message.id);
  const { data: receipts, error: receiptsError } = messageIds.length
    ? await db.from("message_reads").select("message_id, read_at").eq("user_id", SUPPORT_ACTOR_ID).in("message_id", messageIds)
    : { data: [], error: null };
  if (receiptsError) return NextResponse.json({ error: "Lesestatus konnte nicht geladen werden." }, { status: 500 });
  const receiptMap = new Map((receipts ?? []).map((receipt) => [receipt.message_id, receipt.read_at]));
  return NextResponse.json({
    hasOlder,
    nextCursor: hasOlder && messages.length ? { before: messages[0].created_at, before_id: messages[0].id } : null,
    thread: {
      id: thread.id, targetType: thread.support_target_type, targetId: thread.support_target_id,
      targetLabel: thread.support_target_label, editUrl: thread.support_edit_url,
      userId: thread.support_user_id, userName: participant?.display_name ?? "Mitglied",
      userProfileUrl: profile?.slug || profile?.user_id ? "/profile/" + encodeURIComponent(profile.slug || profile.user_id) : null,
      userAvatarUrl: profile?.avatar_url ?? null, createdAt: thread.created_at,
    },
    messages: (messages ?? []).map((message) => ({
      id: message.id, content: message.content, createdAt: message.created_at,
      senderName: message.sender_id === SUPPORT_ACTOR_ID ? SUPPORT_NAME : (participant?.display_name ?? "Mitglied"),
      senderAvatarUrl: message.sender_id === SUPPORT_ACTOR_ID ? SUPPORT_AVATAR_URL : profile?.avatar_url ?? null,
      fromSupport: message.sender_id === SUPPORT_ACTOR_ID,
      readAt: message.sender_id === SUPPORT_ACTOR_ID ? null : receiptMap.get(message.id) ?? null,
    })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { allowed } = await rateLimit("admin-support-reply:" + admin.userId, 30, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Supportantworten. Bitte kurz warten." }, { status: 429 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!content || content.length > 5000 || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "Nachricht oder sichere Versandkennung ist ungültig." }, { status: 400 });
  }
  const { data: thread, error: threadError } = await db.from("conversations")
    .select("id, support_user_id").eq("id", id).eq("kind", "support").maybeSingle();
  if (threadError) return NextResponse.json({ error: "Supportunterhaltung konnte nicht geprüft werden." }, { status: 500 });
  if (!thread?.support_user_id) return NextResponse.json({ error: "Supportunterhaltung nicht gefunden." }, { status: 404 });

  const { data, error } = await db.rpc("send_support_message", {
    p_conversation_id: id, p_admin_user_id: admin.userId, p_content: content, p_idempotency_key: idempotencyKey,
  });
  if (error) {
    console.error("[admin support] reply persistence failed");
    return NextResponse.json({ error: "Supportantwort konnte nicht dauerhaft gespeichert werden." }, { status: 503 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.message_id) return NextResponse.json({ error: "Speicherung konnte nicht bestätigt werden." }, { status: 503 });
  if (result.created) {
    try {
      const { data: settings } = await db.from("user_settings").select("email_new_message")
        .eq("user_id", thread.support_user_id).maybeSingle();
      if (settings?.email_new_message !== false) {
        const client = await clerkClient();
        const member = await client.users.getUser(thread.support_user_id);
        const email = member.emailAddresses[0]?.emailAddress;
        if (email) await sendNewMessageEmail(email, SUPPORT_NAME, content, id);
      }
    } catch { /* stored in-app response remains authoritative */ }
  }
  return NextResponse.json({ success: true, duplicate: !result.created, messageId: result.message_id });
}

