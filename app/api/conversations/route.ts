import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { anyBlockExists, areAcceptedFriends } from "@/lib/trust";
import { rateLimit } from "@/lib/rateLimit";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";
import { applyParticipantReadReceipts } from "@/lib/message-read-state";
import { getUnreadMessageCounts } from "@/lib/unread-message-counts";

const SUPPORT_ACTOR_ID = "cinegenius-support";

// The membership table is the access-control source for both direct and group
// conversations. It lets a user participate in many-member conversations
// without exposing other conversations through the service-role DB client.
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const contactId = request.nextUrl.searchParams.get("with_user");
  if (contactId) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(contactId) || contactId === userId) return NextResponse.json({ error: "Ungültiger Kontakt." }, { status: 400 });
    const { data, error } = await db.from("conversations")
      .select("id,conversation_members!inner(user_id,left_at)")
      .eq("kind", "direct")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
      .eq("conversation_members.user_id", userId).is("conversation_members.left_at", null)
      .order("listing_id", { nullsFirst: true }).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ error: "Unterhaltung konnte nicht gesucht werden." }, { status: 500 });
    return NextResponse.json({ conversationId: data?.id ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: memberships, error: membershipError } = await db
    .from("conversation_members")
    .select("conversation_id, role, joined_at")
    .eq("user_id", userId)
    .is("left_at", null)
    .order("joined_at", { ascending: false })
    .limit(50);
  if (membershipError) return NextResponse.json({ error: "Unterhaltungen konnten nicht geladen werden." }, { status: 500 });

  const conversationIds = (memberships ?? []).map((membership) => membership.conversation_id);
  let unreadCounts: Awaited<ReturnType<typeof getUnreadMessageCounts>>;
  try {
    unreadCounts = await getUnreadMessageCounts(userId);
  } catch {
    return NextResponse.json({ error: "Ungelesene Nachrichten konnten nicht geladen werden." }, { status: 500 });
  }

  if (conversationIds.length === 0) {
    return NextResponse.json({ data: [], unreadCount: unreadCounts.count }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  const { data: conversations, error } = await db
    .from("conversations")
    .select(`
      id, kind, group_name, listing_id, listing_title, listing_type,
      sender_id, receiver_id, created_at, updated_at,
      messages(id, sender_id, content, read_at, created_at)
    `)
    .in("id", conversationIds)
    .or(`sender_id.neq.${userId},hidden_for_sender_at.is.null`, { referencedTable: "messages" })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(1, { referencedTable: "messages" })
    .limit(50);
  if (error) return NextResponse.json({ error: "Unterhaltungen konnten nicht geladen werden." }, { status: 500 });

  const groupIds = (conversations ?? []).filter((conversation) => conversation.kind === "group").map((conversation) => conversation.id);
  let groupMembers: Array<{ conversation_id: string; user_id: string; role: "admin" | "member"; joined_at: string }> = [];
  if (groupIds.length > 0) {
    const { data, error: groupMembersError } = await db
      .from("conversation_members")
      .select("conversation_id, user_id, role, joined_at")
      .in("conversation_id", groupIds)
      .is("left_at", null);
    if (groupMembersError) return NextResponse.json({ error: "Gruppenmitglieder konnten nicht geladen werden." }, { status: 500 });
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
    if (readsError) return NextResponse.json({ error: "Lesestatus konnte nicht geladen werden." }, { status: 500 });
    receipts = data ?? [];
  }

  const enriched = (conversations ?? []).map((conversation) => {
    const membership = (memberships ?? []).find((candidate) => candidate.conversation_id === conversation.id);
    const messages = (conversation.messages ?? []).filter((message) =>
      !membership || new Date(message.created_at).getTime() >= new Date(membership.joined_at).getTime(),
    );
    const unreadCount = unreadCounts.byConversation[conversation.id] ?? 0;
    if (conversation.kind === "group") {
      const members = groupMembers
        .filter((member) => member.conversation_id === conversation.id)
        .map((member) => ({
          ...member,
          display_name: profileMap[member.user_id]?.display_name ?? "Unbekannt",
          avatar_url: profileMap[member.user_id]?.avatar_url ?? null,
        }));
      const enrichedMessages = messages.map((message) => ({
        ...message,
        read_by: receipts.filter((receipt) => receipt.message_id === message.id).map((receipt) => receipt.user_id),
        senderName: profileMap[message.sender_id]?.display_name ?? "Unbekannt",
        senderAvatar: profileMap[message.sender_id]?.avatar_url ?? null,
      }));
      return {
        ...conversation,
        messages: enrichedMessages,
        unread_count: unreadCount,
        otherName: conversation.group_name ?? "Gruppe",
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
          senderName: message.sender_id === SUPPORT_ACTOR_ID ? "CineGenius Support" : profileMap[message.sender_id]?.display_name ?? "Du",
          senderAvatar: message.sender_id === SUPPORT_ACTOR_ID ? "/cinegenius-logo.svg" : profileMap[message.sender_id]?.avatar_url ?? null,
        })),
        unread_count: unreadCount,
        otherName: "CineGenius Support",
        otherAvatar: "/cinegenius-logo.svg",
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
      otherName: profile.display_name ?? "Unbekannt",
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

// Start or reuse a one-to-one conversation and send its first message.
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`conv:${userId}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { listing_id, listing_title, listing_type, receiver_id, content } = body ?? {};
  if (typeof receiver_id !== "string" || !receiver_id || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Empfänger und Nachricht erforderlich" }, { status: 400 });
  }
  if (content.length > 5000) return NextResponse.json({ error: "Nachricht zu lang (max. 5000 Zeichen)" }, { status: 400 });
  if (userId === receiver_id) return NextResponse.json({ error: "Du kannst dir selbst keine Nachricht senden" }, { status: 400 });
  if (receiver_id === SUPPORT_ACTOR_ID) return NextResponse.json({ error: "CineGenius Support kann nur aus dem geschützten Supportpostfach schreiben." }, { status: 403 });

  const { data: receiverSettings, error: settingsError } = await db
    .from("user_settings")
    .select("message_permission")
    .eq("user_id", receiver_id)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ error: "Nachrichteneinstellungen konnten nicht geprüft werden." }, { status: 500 });
  if (receiverSettings?.message_permission === "friends_only" && !(await areAcceptedFriends(userId, receiver_id))) {
    return NextResponse.json({ error: "Diese Person nimmt Nachrichten nur von Freunden an." }, { status: 403 });
  }
  if (await anyBlockExists(userId, receiver_id)) return NextResponse.json({ error: "Nachrichten an diesen Nutzer sind nicht möglich" }, { status: 403 });

  const directPair = listing_id
    ? `and(sender_id.eq.${userId},receiver_id.eq.${receiver_id},listing_id.eq.${listing_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${userId},listing_id.eq.${listing_id})`
    : `and(sender_id.eq.${userId},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${userId})`;
  let existingQuery = db.from("conversations").select("id").eq("kind", "direct").or(directPair);
  if (!listing_id) existingQuery = existingQuery.is("listing_id", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) return NextResponse.json({ error: "Unterhaltung konnte nicht geprüft werden." }, { status: 500 });

  let conversationId = existing?.id;
  if (!conversationId) {
    const { data: conversation, error: conversationError } = await db
      .from("conversations")
      .insert({ listing_id, listing_title, listing_type, sender_id: userId, receiver_id, kind: "direct", created_by: userId })
      .select("id")
      .single();
    if (conversationError) return NextResponse.json({ error: "Unterhaltung konnte nicht erstellt werden." }, { status: 500 });
    conversationId = conversation.id;
    const { error: membersError } = await db.from("conversation_members").insert([
      { conversation_id: conversationId, user_id: userId, role: "member" },
      { conversation_id: conversationId, user_id: receiver_id, role: "member" },
    ]);
    if (membersError) {
      await db.from("conversations").delete().eq("id", conversationId);
      return NextResponse.json({ error: "Teilnehmer konnten nicht zur Unterhaltung hinzugefügt werden." }, { status: 500 });
    }
  }

  const { data: message, error: messageError } = await db.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_sender_id: userId,
    p_content: content.trim(),
  });
  if (messageError) return NextResponse.json({ error: "Nachricht konnte nicht gesendet werden." }, { status: 500 });

  if (!existing) {
    try {
      const [{ data: senderProfile }, { data: emailSettings }] = await Promise.all([
        db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
        db.from("user_settings").select("email_new_message").eq("user_id", receiver_id).maybeSingle(),
      ]);
      const senderName = senderProfile?.display_name ?? "Jemand";
      if (emailSettings?.email_new_message !== false) {
        const clerk = await clerkClient();
        const recipient = await clerk.users.getUser(receiver_id);
        const email = recipient.emailAddresses[0]?.emailAddress;
        if (email) await sendNewMessageEmail(email, senderName, content.trim(), conversationId);
      }
    } catch { /* best effort; the persisted message remains authoritative */ }
  }

  return NextResponse.json({ conversationId, message: Array.isArray(message) ? message[0] : message });
}
