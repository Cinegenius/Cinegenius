import {attachMessageFiles} from "@/lib/message-attachment-server";
import {attachmentIds} from "@/lib/message-attachments";
import { SUPPORT_ACTOR_ID, SUPPORT_AVATAR_URL, SUPPORT_NAME } from "@/lib/support-identity";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { applyParticipantReadReceipts } from "@/lib/message-read-state";
import { getTranslations as getResponseTranslations } from "next-intl/server";
import { MESSAGING_HEADERS, messagingRequestKey, messagingUuid, messagingRpcFailure } from "@/lib/messaging-backend";

const PAGE_SIZE = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { data: conversation, error: conversationError } = await db
    .from("conversations")
    .select("id, kind, group_name, listing_id, listing_title, listing_type, sender_id, receiver_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (conversationError) return NextResponse.json({ error: tResponse('System.m_1fa117ab833b') }, { status: 500 });
  if (!conversation || (conversation.kind === "support" && conversation.receiver_id !== userId)) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });

  const { data: membership, error: membershipError } = await db
    .from("conversation_members")
    .select("role, joined_at, left_at")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: tResponse('System.m_599c867e2758') }, { status: 500 });
  if (!membership) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });

  const { data: activeMembers, error: membersError } = await db
    .from("conversation_members")
    .select("user_id, role, joined_at")
    .eq("conversation_id", id)
    .is("left_at", null);
  if (membersError) return NextResponse.json({ error: tResponse('System.m_f0806571830a') }, { status: 500 });
  const memberRows = activeMembers ?? [];
  if (conversation.kind !== "group" && !memberRows.some((member) => member.user_id !== userId)) {
    return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });
  }

  const before = request.nextUrl.searchParams.get("before");
  const beforeId = request.nextUrl.searchParams.get("before_id");
  if (before || beforeId) {
    if (!before || !beforeId || Number.isNaN(Date.parse(before)) || beforeId.length > 80) {
      return NextResponse.json({ error: tResponse('System.m_b9644bfee79d') }, { status: 400 });
    }
  }

  let query = db
    .from("messages")
    .select("id, conversation_id, sender_id, content, read_at, created_at")
    .eq("conversation_id", id)
    .or(`sender_id.neq.${userId},hidden_for_sender_at.is.null`);
  if (conversation.kind === "group") query = query.gte("created_at", membership.joined_at);
  if (before && beforeId) query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);

  const { data: rawMessages, error: messagesError } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (messagesError) return NextResponse.json({ error: tResponse('System.m_ece7dc87613b') }, { status: 500 });
  const descendingPage = rawMessages ?? [];
  const hasOlder = descendingPage.length > PAGE_SIZE;
  const page = descendingPage.slice(0, PAGE_SIZE).reverse();
  const messageIds = page.map((message) => message.id);
  const participantIds = memberRows.map((member) => member.user_id);

  const [profilesResult, receiptsResult] = await Promise.all([
    db.from("profiles").select("user_id, display_name, avatar_url").in("user_id", participantIds),
    messageIds.length > 0
      ? db.from("message_reads").select("message_id, user_id, read_at").in("message_id", messageIds).in("user_id", participantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || receiptsResult.error) {
    return NextResponse.json({ error: tResponse('System.m_a5e7c6ff901e') }, { status: 500 });
  }

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile]));
  const receipts = receiptsResult.data ?? [];
  const members = memberRows.map((member) => ({
    ...member,
    display_name: profiles.get(member.user_id)?.display_name ?? tResponse("Messaging.unknown"),
    avatar_url: profiles.get(member.user_id)?.avatar_url ?? null,
  }));

  let messages;
  if (conversation.kind === "group") {
    messages = page.map((message) => ({
      ...message,
      read_at: message.sender_id === userId
        ? null
        : receipts.find((receipt) => receipt.message_id === message.id && receipt.user_id === userId)?.read_at ?? null,
      read_by: receipts.filter((receipt) => receipt.message_id === message.id).map((receipt) => receipt.user_id),
      senderName: profiles.get(message.sender_id)?.display_name ?? tResponse("Messaging.unknown"),
      senderAvatar: profiles.get(message.sender_id)?.avatar_url ?? null,
    }));
  } else {
    const otherId = memberRows.find((member) => member.user_id !== userId)?.user_id ?? "";
    messages = applyParticipantReadReceipts(page, receipts, userId, otherId);
    if (conversation.kind === "support") {
      messages = messages.map((message) => ({
        ...message,
        senderName: message.sender_id === SUPPORT_ACTOR_ID ? SUPPORT_NAME : tResponse("Messaging.you"),
        senderAvatar: message.sender_id === SUPPORT_ACTOR_ID ? SUPPORT_AVATAR_URL : null,
      }));
    }
  }

  try { messages=await attachMessageFiles(messages); } catch { return NextResponse.json({error:tResponse("Messaging.attachmentLoadError")},{status:503,headers:MESSAGING_HEADERS}); }

  return NextResponse.json({
    conversation: {
      ...conversation,
      ...(conversation.kind === "direct" ? {
        otherName: members.find(member => member.user_id !== userId)?.display_name ?? tResponse("Messaging.unknown"),
        otherAvatar: members.find(member => member.user_id !== userId)?.avatar_url ?? null,
      } : {}),
      ...(conversation.kind === "support" ? { otherName: SUPPORT_NAME, otherAvatar: SUPPORT_AVATAR_URL } : {}),
      members,
      memberCount: members.length,
      isAdmin: members.some((member) => member.user_id === userId && member.role === "admin"),
      historyFrom: membership.joined_at,
    },
    messages,
    hasOlder,
    nextCursor: hasOlder && page.length > 0
      ? { before: page[0].created_at, before_id: page[0].id }
      : null,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const caller = await requireAuth();
  if (caller instanceof NextResponse) return caller;
  const { id } = await params;
  const messageId = request.nextUrl.searchParams.get("message_id") ?? "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(id) || !uuid.test(messageId)) return NextResponse.json({ error: tResponse('System.m_ff964adb286c') }, { status: 400 });
  const { allowed } = await rateLimit(`hide-message:${caller.userId}`, 60, 60);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_b1c34ba77e66') }, { status: 429 });
  const { data, error } = await db.rpc("hide_own_conversation_message", { p_actor: caller.userId, p_conversation: id, p_message: messageId });
  if (error || data !== messageId) return NextResponse.json({ error: error?.code === "42501" ? tResponse("System.messageNotOwnOrUnavailable") : tResponse("Ui.text_ce810a95feef7e") }, { status: error?.code === "42501" ? 404 : 500 });
  return NextResponse.json({ hiddenMessageId: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getResponseTranslations("MessagingBackend");
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: MESSAGING_HEADERS });
  const body = await request.json().catch(() => null);
  if (body?.accountId !== userId) return fail("accountChanged", 403);
  const { id } = await params;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const attachments=attachmentIds(body.attachmentIds);
  if (!messagingUuid(id) || !attachments || (!content && !attachments.length) || content.length > 5000 || !messagingRequestKey(body.idempotencyKey)) return fail("invalid", 400);
  if (!(await rateLimit(`msg:${userId}`, 30, 60)).allowed) return fail("rateLimit", 429);
  const { data, error } = await (attachments.length ? db.rpc("send_message_with_attachments", {p_actor:userId,p_content:content,p_key:body.idempotencyKey,p_attachments:attachments,p_conversation:id}) : db.rpc("send_conversation_message", {
    p_conversation_id: id, p_sender_id: userId, p_content: content, p_idempotency_key: body.idempotencyKey,
  }));
  if (error) { const failure = messagingRpcFailure(error); return fail(failure.key, failure.status); }
  if (!data || data.conversationId !== id || !messagingUuid(data.message?.id) || typeof data.created !== "boolean") return fail("saveError", 503);
  let senderName = t("senderFallback"); let senderAvatar = null;
  if (data.created) try {
    const [{ data: conversation }, { data: sender }] = await Promise.all([
      db.from("conversations").select("kind,sender_id,receiver_id").eq("id", id).maybeSingle(),
      db.from("profiles").select("display_name,avatar_url").eq("user_id", userId).maybeSingle(),
    ]);
    senderName = sender?.display_name ?? senderName; senderAvatar = sender?.avatar_url ?? null;
    if (conversation?.kind === "direct") {
      const receiver = conversation.sender_id === userId ? conversation.receiver_id : conversation.sender_id;
      const { data: settings } = await db.from("user_settings").select("email_new_message").eq("user_id", receiver).maybeSingle();
      if (receiver && settings?.email_new_message !== false) {
        const recipient = await (await clerkClient()).users.getUser(receiver);
        const email = recipient.emailAddresses[0]?.emailAddress;
        if (email) await sendNewMessageEmail(email, senderName, content || (await getResponseTranslations("Messaging"))("attachmentPreview"), id);
      }
    }
  } catch { /* No replay may send mail again. */ }
  return NextResponse.json({ conversationId: id, message: { ...data.message, senderName, senderAvatar, read_by: [] }, replayed: !data.created }, { headers: MESSAGING_HEADERS });
}
