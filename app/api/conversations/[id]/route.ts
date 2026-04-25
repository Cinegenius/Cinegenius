import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { anyBlockExists } from "@/lib/trust";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

// GET /api/conversations/[id] — Nachrichten einer Konversation laden + als gelesen markieren
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  const { data: conv } = await db
    .from("conversations")
    .select("id, sender_id, receiver_id, listing_title")
    .eq("id", id)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const { data: messages } = await db
    .from("messages")
    .select("id, sender_id, content, read_at, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  // Ungelesene Nachrichten des anderen als gelesen markieren
  await db
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .neq("sender_id", userId)
    .is("read_at", null);

  return NextResponse.json({ conversation: conv, messages: messages ?? [] });
}

// POST /api/conversations/[id] — Nachricht senden
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Rate limit: 30 messages per user per minute
  const { allowed } = await rateLimit(`msg:${userId}`, 30, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Nachrichten. Bitte kurz warten." }, { status: 429 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  const { content } = body;

  if (!content?.trim()) return NextResponse.json({ error: "Nachricht leer" }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: "Nachricht zu lang (max. 5000 Zeichen)" }, { status: 400 });

  // Zugriff prüfen + Empfänger ermitteln
  const { data: conv } = await db
    .from("conversations")
    .select("id, sender_id, receiver_id")
    .eq("id", id)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Kein Zugriff" }, { status: 404 });

  // Block check — deny if either party has blocked the other
  const receiverId = conv.sender_id === userId ? conv.receiver_id : conv.sender_id;
  if (await anyBlockExists(userId, receiverId)) {
    return NextResponse.json({ error: "Nachrichten an diesen Nutzer sind nicht möglich" }, { status: 403 });
  }

  const { data: msg, error } = await db
    .from("messages")
    .insert({ conversation_id: id, sender_id: userId, content: content.trim() })
    .select("id, sender_id, content, read_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  // In-app notification + email — fire-and-forget
  try {
    const [{ data: senderProfile }, { data: receiverSettings }] = await Promise.all([
      db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      db.from("user_settings").select("email_new_message").eq("user_id", receiverId).maybeSingle(),
    ]);
    const senderName = senderProfile?.display_name ?? "Jemand";

    await db.from("notifications").insert({
      user_id: receiverId,
      type: "new_message",
      title: `Neue Nachricht von ${senderName}`,
      body: content.trim().slice(0, 120),
      href: `/messages?conv=${id}`,
    });

    if (receiverSettings?.email_new_message !== false) {
      const clerk = await clerkClient();
      const receiverUser = await clerk.users.getUser(receiverId);
      const receiverEmail = receiverUser.emailAddresses[0]?.emailAddress;
      if (receiverEmail) await sendNewMessageEmail(receiverEmail, senderName, content.trim(), id);
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ message: msg });
}
