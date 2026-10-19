import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUnreadMessageCounts } from "@/lib/unread-message-counts";

// GET /api/unread-count — Anzahl ungelesener Nachrichten des eingeloggten Nutzers
export async function GET() {
  const user = await getCurrentUser();
  const noStore = { headers: { "Cache-Control": "no-store, max-age=0" } };
  if (!user) return NextResponse.json({ count: 0 }, noStore);

  const { userId } = user;

  try {
    return NextResponse.json(await getUnreadMessageCounts(userId), noStore);
  } catch {
    return NextResponse.json({ error: "Ungelesene Nachrichten konnten nicht geladen werden." }, { status: 500, ...noStore });
  }
}
