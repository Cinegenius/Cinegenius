import {attachmentIds} from "@/lib/message-attachments";
import { SUPPORT_ACTOR_ID, SUPPORT_AVATAR_URL, SUPPORT_NAME } from "@/lib/support-identity";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";
import { applyParticipantReadReceipts } from "@/lib/message-read-state";
import { getUnreadMessageCounts } from "@/lib/unread-message-counts";
import { getTranslations as getResponseTranslations } from "next-intl/server";
import { MESSAGING_HEADERS, messagingAccountId, messagingRequestKey, messagingUuid, messagingRpcFailure } from "@/lib/messaging-backend";


// The membership table is the access-control source for both direct and group
// conversations. It lets a user participate in many-member conversations
// without exposing other conversations through the service-role DB client.
export async function GET(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const contactId = request.nextUrl.searchParams.get("with_user");
  if (contactId) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(contactId) || contactId === userId) return NextResponse.json({ error: tResponse('System.m_ccdfe6406c75') }, { status: 400 });
    const { data, error } = await db.from("conversations")
      .select("id,conversation_members!inner(user_id,left_at)")
      .eq("kind", "direct")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
      .eq("conversation_members.user_id", userId).is("conversation_members.left_at", null)
      .order("listing_id", { nullsFirst: true }).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ error: tResponse('System.m_2fd1f0952739') }, { status: 500 });
    return NextResponse.json({ conversationId: data?.id ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  let unreadCounts: Awaited<ReturnType<typeof getUnreadMessageCounts>>;
  try {
    unreadCounts = await getUnreadMessageCounts(userId);
  } catch {
    return NextResponse.json({ error: tResponse('System.m_38658963a719') }, { status: 500 });
  }

  // Filter active membership and sort activity before limiting the inbox.
  // A recently active old chat must not be excluded by its join date.
  const { data: conversations, error } = await db
    .from("conversations")
    .select(`
      id, kind, group_name, listing_id, listing_title, listing_type,
      sender_id, receiver_id, created_at, updated_at,
      conversation_members!inner(user_id, joined_at, left_at),
      messages(id, sender_id, content, read_at, created_at)
    `)
    .eq("conversation_members.user_id", userId)
    .is("conversation_members.left_at", null)
    .or(`sender_id.neq.${userId},hidden_for_sender_at.is.null`, { referencedTable: "messages" })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(1, { referencedTable: "messages" })
    .limit(50);
  if (error) return NextResponse.json({ error: tResponse('System.m_907ee849b3ff') }, { status: 500 });
  if ((conversations ?? []).some((conversation) =>
    !Array.isArray(conversation.conversation_members)
      || !conversation.conversation_members.some((member) => member?.user_id === userId && member.left_at === null),
  )) {
    return NextResponse.json({ error: tResponse('System.m_907ee849b3ff') }, { status: 500 });
  }

  const groupIds = (conversations ?? []).filter((conversation) => conversation.kind === "group").map((conversation) => conversation.id);
  let groupMembers: Array<{ conversation_id: string; user_id: string; role: "admin" | "member"; joined_at: string }> = [];
  if (groupIds.length > 0) {
    const { data, error: groupMembersError } = await db
      .from("conversation_members")
      .select("conversation_id, user_id, role, joined_at")
      .in("conversation_id", groupIds)
      .is("left_at", null);
    if (groupMembersError) return NextResponse.json({ error: tResponse('System.m_96c50531e092') }, { status: 500 });
    groupMembers = data ?? [];
  }

  const directOtherIds = (conversations ?? [])
    .filter((conversation) => conversation.kind !== "group")
    .map((conversation) => conversation.sender_id === userId ? conversation.receiver_id : conversation.sender_id)
    .filter((id): id is string => typeof id === "string" && id !== userId && id !== SUPPORT_ACTOR_ID);
  const profileIds = [...new Set([...directOtherIds, ...groupMembers.map((member) => member.user_id)])];
  const profileMap: Record<string, { display_name?: string | null; avatar_url?: string | null }> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", profileIds);
    (profiles ?? []).forEach((profile) => { profileMap[profile.user_id] = profile; });
  }

  const messageIds = [...new Set((conversations ?? []).flatMap((conversation) => (conversation.messages ?? []).map((message) => message.id)))];
  let receipts: Array<{ message_id: string; user_id: string; read_at: string }> = [];
  if (messageIds.length > 0) {
    const { data, error: readsError } = await db
      .from("message_reads")
      .select("message_id, user_id, read_at")
      .in("message_id", messageIds)
      .in("user_id", [...new Set([userId, SUPPORT_ACTOR_ID, ...profileIds])]);
    if (readsError) return NextResponse.json({ error: tResponse('System.m_9ca5cc3fc595') }, { status: 500 });
    receipts = data ?? [];
  }

  const enriched = (conversations ?? []).map(({ conversation_members: memberships, ...conversation }) => {
    const membership = memberships.find((candidate) => candidate?.user_id === userId && candidate.left_at === null);
    const messages = (conversation.messages ?? []).filter((message) =>
      !membership || new Date(message.created_at).getTime() >= new Date(membership.joined_at).getTime(),
    );
    const unreadCount = unreadCounts.byConversation[conversation.id] ?? 0;
    if (conversation.kind === "group") {
      const members = groupMembers
        .filter((member) => member.conversation_id === conversation.id)
        .map((member) => ({
          ...member,
          display_name: profileMap[member.user_id]?.display_name ?? tResponse("Messaging.unknown"),
          avatar_url: profileMap[member.user_id]?.avatar_url ?? null,
        }));
      const enrichedMessages = messages.map((message) => ({
        ...message,
        read_by: receipts.filter((receipt) => receipt.message_id === message.id).map((receipt) => receipt.user_id),
        senderName: profileMap[message.sender_id]?.display_name ?? tResponse("Messaging.unknown"),
        senderAvatar: profileMap[message.sender_id]?.avatar_url ?? null,
      }));
      return {
        ...conversation,
        messages: enrichedMessages,
        unread_count: unreadCount,
        otherName: conversation.group_name ?? tResponse("Messaging.groupFallback"),
        otherAvatar: null,
        members,
        memberCount: members.length,
        isAdmin: members.some((member) => member.user_id === userId && member.role === "admin"),
      };
    }

    if (conversation.kind === "support") {
      return {
        ...conversation,
        messages: applyParticipantReadReceipts(messages, receipts, userId, SUPPORT_ACTOR_ID).map((message) => ({
          ...message,
          senderName: message.sender_id === SUPPORT_ACTOR_ID ? SUPPORT_NAME : profileMap[message.sender_id]?.display_name ?? tResponse("Messaging.you"),
          senderAvatar: message.sender_id === SUPPORT_ACTOR_ID ? SUPPORT_AVATAR_URL : profileMap[message.sender_id]?.avatar_url ?? null,
        })),
        unread_count: unreadCount,
        otherName: SUPPORT_NAME,
        otherAvatar: SUPPORT_AVATAR_URL,
        members: [],
        memberCount: 2,
        isAdmin: false,
      };
    }

    const otherId = conversation.sender_id === userId ? conversation.receiver_id : conversation.sender_id;
    const profile = otherId ? profileMap[otherId] ?? {} : {};
    return {
      ...conversation,
      messages: applyParticipantReadReceipts(messages, receipts, userId, otherId ?? ""),
      unread_count: unreadCount,
      otherName: profile.display_name ?? tResponse("Messaging.unknown"),
      otherAvatar: profile.avatar_url ?? null,
      members: [],
      memberCount: 2,
      isAdmin: false,
    };
  });

  return NextResponse.json({ data: enriched, unreadCount: unreadCounts.count }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

// The transaction reuses one active direct chat and confirms a stable send key.
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getResponseTranslations("MessagingBackend");
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: MESSAGING_HEADERS });
  const body = await req.json().catch(() => null);
  if (body?.accountId !== userId) return fail("accountChanged", 403);
  const { receiver_id, listing_id = null, listing_title = null, listing_type = null, idempotencyKey } = body;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const attachments=attachmentIds(body.attachmentIds);
  if (!messagingAccountId(receiver_id) || receiver_id === userId || receiver_id === SUPPORT_ACTOR_ID
    || !attachments || (!content && !attachments.length) || content.length > 5000 || !messagingRequestKey(idempotencyKey)
    || listing_id !== null && !messagingUuid(listing_id)
    || listing_title !== null && (typeof listing_title !== "string" || listing_title.length > 300)
    || listing_type !== null && (typeof listing_type !== "string" || listing_type.length > 80)) return fail("invalid", 400);
  if (!(await rateLimit(`conv:${userId}`, 20, 60)).allowed) return fail("rateLimit", 429);
  const { data, error } = await (attachments.length ? db.rpc("send_message_with_attachments", {p_actor:userId,p_content:content,p_key:idempotencyKey,p_attachments:attachments,p_recipient:receiver_id,p_listing_id:listing_id,p_listing_title:listing_title,p_listing_type:listing_type}) : db.rpc("start_direct_conversation", {
    p_sender_id: userId, p_receiver_id: receiver_id, p_content: content, p_idempotency_key: idempotencyKey,
    p_listing_id: listing_id, p_listing_title: listing_title, p_listing_type: listing_type,
  }));
  if (error) { const failure = messagingRpcFailure(error); return fail(failure.key, failure.status); }
  if (!data || !messagingUuid(data.conversationId) || !messagingUuid(data.message?.id) || typeof data.created !== "boolean") return fail("saveError", 503);
  // Only the request that inserted the message may notify. A replay confirms
  // persisted content without repeating mail, even after a lost HTTP response.
  if (data.created) try {
    const [{ data: senderProfile }, { data: emailSettings }] = await Promise.all([
      db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      db.from("user_settings").select("email_new_message").eq("user_id", receiver_id).maybeSingle(),
    ]);
    if (emailSettings?.email_new_message !== false) {
      const recipient = await (await clerkClient()).users.getUser(receiver_id);
      const email = recipient.emailAddresses[0]?.emailAddress;
      if (email) await sendNewMessageEmail(email, senderProfile?.display_name ?? t("senderFallback"), content || (await getResponseTranslations("Messaging"))("attachmentPreview"), data.conversationId);
    }
  } catch { /* The durable message remains authoritative; mail is best effort. */ }
  return NextResponse.json({ conversationId: data.conversationId, message: data.message, replayed: !data.created }, { headers: MESSAGING_HEADERS });
}
