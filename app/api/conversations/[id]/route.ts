import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { anyBlockExists, areAcceptedFriends } from "@/lib/trust";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { applyParticipantReadReceipts } from "@/lib/message-read-state";

const PAGE_SIZE = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { data: conversation, error: conversationError } = await db
    .from("conversations")
    .select("id, kind, group_name, listing_id, listing_title, listing_type, sender_id, receiver_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (conversationError) return NextResponse.json({ error: "Unterhaltung konnte nicht geladen werden." }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const { data: membership, error: membershipError } = await db
    .from("conversation_members")
    .select("role, joined_at, left_at")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Mitgliedschaft konnte nicht geprüft werden." }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const { data: activeMembers, error: membersError } = await db
    .from("conversation_members")
    .select("user_id, role, joined_at")
    .eq("conversation_id", id)
    .is("left_at", null);
  if (membersError) return NextResponse.json({ error: "Teilnehmer konnten nicht geladen werden." }, { status: 500 });
  const memberRows = activeMembers ?? [];
  if (conversation.kind !== "group" && !memberRows.some((member) => member.user_id !== userId)) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const before = request.nextUrl.searchParams.get("before");
  const beforeId = request.nextUrl.searchParams.get("before_id");
  if (before || beforeId) {
    if (!before || !beforeId || Number.isNaN(Date.parse(before)) || beforeId.length > 80) {
      return NextResponse.json({ error: "Ungültiger Nachrichtenzeiger." }, { status: 400 });
    }
  }

  let query = db
    .from("messages")
    .select("id, conversation_id, sender_id, content, read_at, created_at")
    .eq("conversation_id", id);
  if (conversation.kind === "group") query = query.gte("created_at", membership.joined_at);
  if (before && beforeId) query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);

  const { data: rawMessages, error: messagesError } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (messagesError) return NextResponse.json({ error: "Nachrichten konnten nicht geladen werden." }, { status: 500 });
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
    return NextResponse.json({ error: "Profil- oder Lesestatusdaten konnten nicht geladen werden." }, { status: 500 });
  }

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile]));
  const receipts = receiptsResult.data ?? [];
  const members = memberRows.map((member) => ({
    ...member,
    display_name: profiles.get(member.user_id)?.display_name ?? "Unbekannt",
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
      senderName: profiles.get(message.sender_id)?.display_name ?? "Unbekannt",
      senderAvatar: profiles.get(message.sender_id)?.avatar_url ?? null,
    }));
  } else {
    const otherId = memberRows.find((member) => member.user_id !== userId)?.user_id ?? "";
    messages = applyParticipantReadReceipts(page, receipts, userId, otherId);
  }

  return NextResponse.json({
    conversation: {
      ...conversation,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { allowed } = await rateLimit(`msg:${userId}`, 30, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Nachrichten. Bitte kurz warten." }, { status: 429 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Nachricht leer" }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: "Nachricht zu lang (max. 5000 Zeichen)" }, { status: 400 });

  const { data: conversation, error: conversationError } = await db
    .from("conversations")
    .select("id, kind, group_name, sender_id, receiver_id")
    .eq("id", id)
    .maybeSingle();
  if (conversationError) return NextResponse.json({ error: "Unterhaltung konnte nicht geprüft werden." }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "Kein Zugriff" }, { status: 404 });

  const { data: membership, error: membershipError } = await db
    .from("conversation_members")
    .select("user_id, role")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Mitgliedschaft konnte nicht geprüft werden." }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "Kein Zugriff" }, { status: 404 });

  const { data: activeMembers, error: membersError } = await db
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id)
    .is("left_at", null);
  if (membersError) return NextResponse.json({ error: "Teilnehmer konnten nicht geprüft werden." }, { status: 500 });
  const recipientIds = (activeMembers ?? []).map((member) => member.user_id).filter((memberId) => memberId !== userId);

  if (conversation.kind !== "group") {
    const receiverId = recipientIds[0];
    if (!receiverId) return NextResponse.json({ error: "Empfänger ist nicht mehr verfügbar." }, { status: 404 });
    const { data: receiverSettings, error: settingsError } = await db
      .from("user_settings")
      .select("message_permission")
      .eq("user_id", receiverId)
      .maybeSingle();
    if (settingsError) return NextResponse.json({ error: "Nachrichteneinstellungen konnten nicht geprüft werden." }, { status: 500 });
    if (receiverSettings?.message_permission === "friends_only" && !(await areAcceptedFriends(userId, receiverId))) {
      return NextResponse.json({ error: "Diese Person nimmt Nachrichten nur von Freunden an." }, { status: 403 });
    }
    if (await anyBlockExists(userId, receiverId)) return NextResponse.json({ error: "Nachrichten an diesen Nutzer sind nicht möglich" }, { status: 403 });
  }

  // The database function locks the conversation while checking active
  // membership and inserting, so removal/leave cannot race a send.
  const { data: inserted, error: sendError } = await db.rpc("send_conversation_message", {
    p_conversation_id: id,
    p_sender_id: userId,
    p_content: content,
  });
  if (sendError) {
    const isMembershipError = sendError.message?.includes("aktives Mitglied");
    return NextResponse.json({ error: isMembershipError ? "Du bist kein aktives Mitglied dieser Unterhaltung." : "Nachricht konnte nicht gesendet werden." }, {
      status: isMembershipError ? 404 : 500,
    });
  }
  const message = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!message) return NextResponse.json({ error: "Nachricht konnte nicht bestätigt werden." }, { status: 500 });

  try {
    // Read recipients again after the atomic insert so a member removed just
    // before sending cannot receive a stale group notification.
    const { data: currentMembers } = await db
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", id)
      .is("left_at", null);
    const currentRecipientIds = (currentMembers ?? []).map((member) => member.user_id).filter((memberId) => memberId !== userId);
    const { data: senderProfile } = await db.from("profiles").select("display_name, avatar_url").eq("user_id", userId).maybeSingle();
    const senderName = senderProfile?.display_name ?? "Jemand";
    if (conversation.kind !== "group" && currentRecipientIds[0]) {
      const [{ data: emailSettings }] = await Promise.all([
        db.from("user_settings").select("email_new_message").eq("user_id", currentRecipientIds[0]).maybeSingle(),
      ]);
      if (emailSettings?.email_new_message !== false) {
        const clerk = await clerkClient();
        const recipient = await clerk.users.getUser(currentRecipientIds[0]);
        const email = recipient.emailAddresses[0]?.emailAddress;
        if (email) await sendNewMessageEmail(email, senderName, content, id);
      }
    }
    return NextResponse.json({ message: { ...message, senderName, senderAvatar: senderProfile?.avatar_url ?? null, read_by: [] } });
  } catch {
    return NextResponse.json({ message: { ...message, senderName: "Du", senderAvatar: null, read_by: [] } });
  }
}
