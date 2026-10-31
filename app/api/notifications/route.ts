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

import { db } from "@/lib/db";
import { getInboxNotifications } from "@/lib/inbox-data";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/notifications — list notifications for current user
export async function GET() {
  const user = await getCurrentUser();
  const noStore = { headers: { "Cache-Control": "private, no-store, max-age=0" } };
  if (!user) return NextResponse.json({ code: "account" }, { status: 401, ...noStore });

  try {
    return NextResponse.json({ notifications: await getInboxNotifications(user.userId) }, noStore);
  } catch {
    return NextResponse.json({ code: "notifications_unavailable" }, { status: 500, ...noStore });
  }
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { error } = await db
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) return NextResponse.json({ code: "notification_read_failed" }, { status: 500 });

  return NextResponse.json({ success: true });
}

// POST /api/notifications — mark single as read
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { data: notification, error: lookupError } = await db
    .from("notifications")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Benachrichtigung konnte nicht geladen werden." }, { status: 500 });
  if (!notification) return NextResponse.json({ error: "Benachrichtigung nicht gefunden" }, { status: 404 });

  const { error: updateError } = await db
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (updateError) return NextResponse.json({ error: "Benachrichtigung konnte nicht markiert werden." }, { status: 500 });

  return NextResponse.json({ success: true });
}
