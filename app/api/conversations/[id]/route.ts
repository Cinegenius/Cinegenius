import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

// GET /api/conversations/[id] — Nachrichten einer Konversation laden + als gelesen markieren
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;

  const { data: conv, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", id)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .single();

  if (convError || !conv) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const { data: messages } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Ungelesene Nachrichten des anderen als gelesen markieren
  await supabaseAdmin
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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  // Rate limit: 30 messages per user per minute
  const { allowed } = await rateLimit(`msg:${userId}`, 30, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Nachrichten. Bitte kurz warten." }, { status: 429 });

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "Nachricht leer" }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: "Nachricht zu lang (max. 5000 Zeichen)" }, { status: 400 });

  // Zugriff prüfen + Empfänger ermitteln
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id, sender_id, receiver_id")
    .eq("id", id)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .single();

  if (!conv) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const { data: msg, error } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: id, sender_id: userId, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  // Email an Empfänger — nur wenn aktiviert
  const receiverId = conv.sender_id === userId ? conv.receiver_id : conv.sender_id;
  try {
    const { data: receiverSettings } = await supabaseAdmin
      .from("user_settings")
      .select("email_new_message")
      .eq("user_id", receiverId)
      .maybeSingle();
    const emailEnabled = receiverSettings?.email_new_message !== false;

    if (emailEnabled) {
      const [{ data: senderProfile }, clerk] = await Promise.all([
        supabaseAdmin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
        clerkClient(),
      ]);
      const senderName = senderProfile?.display_name ?? "Jemand";
      const receiverUser = await clerk.users.getUser(receiverId);
      const receiverEmail = receiverUser.emailAddresses[0]?.emailAddress;
      if (receiverEmail) await sendNewMessageEmail(receiverEmail, senderName, content.trim(), id);
    }
  } catch { /* email is best-effort */ }

  return NextResponse.json({ message: msg });
}
