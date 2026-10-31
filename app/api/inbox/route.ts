import { getCurrentUser } from "@/lib/auth";
import { getInboxNotifications } from "@/lib/inbox-data";
import { getUnreadMessageCounts } from "@/lib/unread-message-counts";
import { NextResponse } from "next/server";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

/** One authenticated round trip for the two existing header indicators.
 * Keep the individual endpoints for other callers and notification mutations. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "account" }, { status: 401, headers });
  try {
    const [messages, notifications] = await Promise.all([
      getUnreadMessageCounts(user.userId),
      getInboxNotifications(user.userId),
    ]);
    return NextResponse.json({ count: messages.count, notifications }, { headers });
  } catch {
    // Neither a partial result nor a database failure is a successful empty inbox.
    return NextResponse.json({ code: "inbox_unavailable" }, { status: 500, headers });
  }
}
