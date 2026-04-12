import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

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

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "Nachricht leer" }, { status: 400 });

  // Zugriff prüfen
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id")
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

  return NextResponse.json({ message: msg });
}
