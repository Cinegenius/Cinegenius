import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// POST /api/presence — last_seen_at aktualisieren
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false });

  await supabaseAdmin
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.userId);

  return NextResponse.json({ ok: true });
}
