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

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/notifications — list notifications for current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: [] });

  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, href, read, created_at")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ notifications: data ?? [] });
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  return NextResponse.json({ success: true });
}

// POST /api/notifications — mark single as read
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
