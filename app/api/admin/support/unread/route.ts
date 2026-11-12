import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { db } from "@/lib/db";
import { SUPPORT_ACTOR_ID } from "@/lib/support-identity";

/** Shared support read state is separate from every administrator's personal inbox. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  const { data, error } = await db.rpc("unread_message_counts", { p_user_id: SUPPORT_ACTOR_ID });
  if (error || !Array.isArray(data)) return NextResponse.json({ code: "support_unread_unavailable" }, { status: 503, headers });
  let unreadCount = 0;
  for (const row of data) {
    const raw = row?.unread_count;
    const count = typeof raw === "number" || typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(unreadCount + count)) {
      return NextResponse.json({ code: "support_unread_unavailable" }, { status: 503, headers });
    }
    unreadCount += count;
  }
  return NextResponse.json({ unreadCount }, { headers });
}
