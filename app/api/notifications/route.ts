// Required Supabase table:
// CREATE TABLE IF NOT EXISTS notifications (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id text NOT NULL,
//   type text NOT NULL,
//   title text NOT NULL,
//   body text NOT NULL,
//   href text NOT NULL DEFAULT '/dashboard',
//   read boolean NOT NULL DEFAULT false,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "users manage own notifications" ON notifications FOR ALL USING (auth.uid()::text = user_id);
// CREATE INDEX notifications_user_id_idx ON notifications(user_id, created_at DESC);

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/notifications — list notifications for current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ notifications: [] });

  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, href, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ notifications: data ?? [] });
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  return NextResponse.json({ success: true });
}

// POST /api/notifications — mark single as read
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
