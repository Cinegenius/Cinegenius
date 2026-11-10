import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const SUPPORT_ACTOR_ID = "cinegenius-support";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const ids = body?.message_ids;
  if (!Array.isArray(ids) || ids.length > 200 || ids.some((value: unknown) => typeof value !== "string" || value.length > 80)) {
    return NextResponse.json({ error: tResponse('System.m_1c24fed21771') }, { status: 400 });
  }
  const { data: thread, error: threadError } = await db.from("conversations")
    .select("id").eq("id", id).eq("kind", "support").maybeSingle();
  if (threadError) return NextResponse.json({ error: tResponse('System.m_c85ebb0aa9a2') }, { status: 500 });
  if (!thread) return NextResponse.json({ error: tResponse('System.m_0eaf1e833b5a') }, { status: 404 });
  const uniqueIds = [...new Set(ids as string[])];
  if (uniqueIds.length) {
    const { data: incoming, error } = await db.from("messages").select("id")
      .eq("conversation_id", id).neq("sender_id", SUPPORT_ACTOR_ID).in("id", uniqueIds);
    if (error) return NextResponse.json({ error: tResponse('System.m_6078db5058d0') }, { status: 500 });
    const eligible = (incoming ?? []).map((message) => message.id);
    if (eligible.length) {
      const { error: saveError } = await db.from("message_reads")
        .upsert(eligible.map((messageId) => ({ message_id: messageId, user_id: SUPPORT_ACTOR_ID })), {
          onConflict: "message_id,user_id", ignoreDuplicates: true,
        });
      if (saveError) return NextResponse.json({ error: tResponse('System.m_438dbfbddb5c') }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true });
}

