import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getUnreadMessageCounts } from "@/lib/unread-message-counts";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const requestedIds = body?.message_ids;

  if (!Array.isArray(requestedIds) || requestedIds.length > 200 || requestedIds.some(
    (messageId: unknown) => typeof messageId !== "string" || !messageId || messageId.length > 80,
  )) {
    return NextResponse.json({ error: tResponse('System.m_1c24fed21771') }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await db
    .from("conversation_members")
    .select("joined_at")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: tResponse('System.m_599c867e2758') }, { status: 500 });
  if (!membership) return NextResponse.json({ error: tResponse('System.m_080d177b2f09') }, { status: 404 });

  const messageIds = [...new Set(requestedIds as string[])];
  let readMessages: Array<{ id: string; read_at: string }> = [];
  if (messageIds.length > 0) {
    // Re-check all requested IDs on the server. A client can only mark
    // incoming messages from this conversation and within its history window.
    const { data: incomingMessages, error: messagesError } = await db
      .from("messages")
      .select("id")
      .eq("conversation_id", id)
      .neq("sender_id", userId)
      .gte("created_at", membership.joined_at)
      .in("id", messageIds);
    if (messagesError) return NextResponse.json({ error: tResponse('System.m_7adf7202d211') }, { status: 500 });

    const eligibleIds = (incomingMessages ?? []).map((message) => message.id);
    if (eligibleIds.length > 0) {
      const { error: writeError } = await db
        .from("message_reads")
        .upsert(
          eligibleIds.map((messageId) => ({ message_id: messageId, user_id: userId })),
          { onConflict: "message_id,user_id", ignoreDuplicates: true },
        );
      if (writeError) return NextResponse.json({ error: tResponse('System.m_438dbfbddb5c') }, { status: 500 });

      const { data: storedReads, error: readError } = await db
        .from("message_reads")
        .select("message_id, read_at")
        .eq("user_id", userId)
        .in("message_id", eligibleIds);
      if (readError) return NextResponse.json({ error: tResponse('System.m_a1338dc05047') }, { status: 500 });
      readMessages = (storedReads ?? []).map((receipt) => ({ id: receipt.message_id, read_at: receipt.read_at }));
    }
  }

  try {
    const unread = await getUnreadMessageCounts(userId);
    return NextResponse.json({ readMessages, ...unread }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: tResponse('System.m_ab14c8a504e9') }, { status: 500 });
  }
}
