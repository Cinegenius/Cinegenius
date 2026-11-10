import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { id } = await context.params;

  const { data, error } = await db
    .from("community_posts")
    .delete()
    .eq("id", id)
    .eq("author_id", authResult.userId)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: tResponse('System.m_636c8a0b0698') }, { status: 500 });
  if (!data) return NextResponse.json({ error: tResponse('System.m_790b3f22c796') }, { status: 404 });
  return NextResponse.json({ deleted: true, id: data.id });
}
