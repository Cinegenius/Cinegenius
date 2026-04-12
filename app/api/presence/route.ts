import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/presence — last_seen_at aktualisieren
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false });

  await supabaseAdmin
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
