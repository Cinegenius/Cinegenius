import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getUnreadMessageCounts } from "@/lib/unread-message-counts";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// GET /api/unread-count — Anzahl ungelesener Nachrichten des eingeloggten Nutzers
export async function GET() {
  const tResponse = await getResponseTranslations();
  const user = await getCurrentUser();
  const noStore = { headers: { "Cache-Control": "no-store, max-age=0" } };
  if (!user) return NextResponse.json({ code: "account" }, { status: 401, ...noStore });

  const { userId } = user;

  try {
    return NextResponse.json(await getUnreadMessageCounts(userId), noStore);
  } catch {
    return NextResponse.json({ error: tResponse('System.m_38658963a719') }, { status: 500, ...noStore });
  }
}
