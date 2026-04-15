import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewMessageEmail } from "@/lib/email";

// GET /api/conversations — alle Konversationen des eingeloggten Nutzers (mit Profilen in einem Query)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select(`
      id, listing_id, listing_title, listing_type, sender_id, receiver_id, created_at, updated_at,
      messages(id, sender_id, content, read_at, created_at)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Batch-fetch aller anderen Teilnehmer in einem einzigen Query (statt N einzelne Requests)
  const otherIds = [...new Set(
    (data ?? []).map((c) => c.sender_id === userId ? c.receiver_id : c.sender_id)
  )];

  let profileMap: Record<string, { display_name?: string; avatar_url?: string }> = {};
  if (otherIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", otherIds);
    (profiles ?? []).forEach((p) => { profileMap[p.user_id] = p; });
  }

  const enriched = (data ?? []).map((c) => {
    const otherId = c.sender_id === userId ? c.receiver_id : c.sender_id;
    const p = profileMap[otherId] ?? {};
    return { ...c, otherName: p.display_name ?? "Unbekannt", otherAvatar: p.avatar_url ?? null };
  });

  return NextResponse.json({ data: enriched });
}

// POST /api/conversations — neue Konversation starten + erste Nachricht
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { listing_id, listing_title, listing_type, receiver_id, content } = body;

  if (!receiver_id || !content?.trim()) {
    return NextResponse.json({ error: "Empfänger und Nachricht erforderlich" }, { status: 400 });
  }

  if (userId === receiver_id) {
    return NextResponse.json({ error: "Du kannst dir selbst keine Nachricht senden" }, { status: 400 });
  }

  // Prüfen ob Konversation bereits existiert
  let existingQuery = supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("sender_id", userId)
    .eq("receiver_id", receiver_id);

  if (listing_id) {
    existingQuery = existingQuery.eq("listing_id", listing_id);
  } else {
    existingQuery = existingQuery.is("listing_id", null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  let conversationId = existing?.id;

  if (!conversationId) {
    const { data: conv, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({ listing_id, listing_title, listing_type, sender_id: userId, receiver_id })
      .select("id")
      .single();

    if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
    conversationId = conv.id;
  }

  const { error: msgError } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: userId, content: content.trim() });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // updated_at aktualisieren
  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Email the receiver on first contact (new conversation only)
  if (!existing) {
    try {
      const { data: senderProfile } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      const senderName = senderProfile?.display_name ?? "Jemand";

      const clerk = await clerkClient();
      const receiverUser = await clerk.users.getUser(receiver_id);
      const receiverEmail = receiverUser.emailAddresses[0]?.emailAddress;
      if (receiverEmail) await sendNewMessageEmail(receiverEmail, senderName, content.trim(), conversationId);
    } catch { /* email is best-effort */ }
  }

  return NextResponse.json({ conversationId });
}
