import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
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
  if (error) return NextResponse.json({ error: "Beitrag konnte nicht gelöscht werden." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Beitrag nicht gefunden oder keine Berechtigung." }, { status: 404 });
  return NextResponse.json({ deleted: true, id: data.id });
}
