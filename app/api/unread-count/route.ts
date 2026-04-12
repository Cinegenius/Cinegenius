import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// GET /api/unread-count — Anzahl ungelesener Nachrichten des eingeloggten Nutzers
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ count: 0 });

  // Alle Konversationen des Nutzers holen
  const { data: convs } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  const convIds = (convs ?? []).map((c: { id: string }) => c.id);
  if (convIds.length === 0) return NextResponse.json({ count: 0 });

  // Ungelesene Nachrichten vom jeweils anderen zählen
  const { count } = await supabaseAdmin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", userId)
    .in("conversation_id", convIds);

  return NextResponse.json({ count: count ?? 0 });
}
