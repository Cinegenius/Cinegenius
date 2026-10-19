import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getPrivateProfileIds } from "@/lib/trust";
import { normalizeMemberIds } from "@/lib/conversation-logic";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { allowed } = await rateLimit(`group-create:${userId}`, 5, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Gruppenanfragen. Bitte kurz warten." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const memberIds = normalizeMemberIds(userId, body?.member_ids);
  if (name.length < 1 || name.length > 80) return NextResponse.json({ error: "Der Gruppenname muss 1 bis 80 Zeichen lang sein." }, { status: 400 });
  if (!memberIds || memberIds.length < 1 || memberIds.length > 49) return NextResponse.json({ error: "Wähle 1 bis 49 weitere Mitglieder aus." }, { status: 400 });

  const privateIds = await getPrivateProfileIds(memberIds);
  if (memberIds.some((memberId) => privateIds.has(memberId))) {
    return NextResponse.json({ error: "Mindestens ein ausgewähltes Profil ist nicht verfügbar." }, { status: 404 });
  }

  const { data, error } = await db.rpc("create_group_conversation", {
    p_creator_id: userId,
    p_name: name,
    p_member_ids: memberIds,
  });
  if (error) {
    const clientMessage = error.message?.includes("Wähle") || error.message?.includes("Gruppenname") || error.message?.includes("Profil")
      ? error.message
      : "Gruppe konnte nicht erstellt werden.";
    return NextResponse.json({ error: clientMessage }, { status: 400 });
  }
  return NextResponse.json({ conversationId: data });
}
