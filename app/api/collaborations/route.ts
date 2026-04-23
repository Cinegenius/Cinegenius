import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/collaborations?userId=xxx  → public collaborations for that user's profile page
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId fehlt" }, { status: 400 });

  const [asSender, asReceiver] = await Promise.all([
    db
      .from("friendships")
      .select("receiver_id, sender_collab_label")
      .eq("sender_id", userId)
      .eq("status", "accepted")
      .eq("sender_collab_public", true)
      .not("sender_collab_label", "is", null),
    db
      .from("friendships")
      .select("sender_id, receiver_collab_label")
      .eq("receiver_id", userId)
      .eq("status", "accepted")
      .eq("receiver_collab_public", true)
      .not("receiver_collab_label", "is", null),
  ]);

  const collabs: { friendId: string; label: string }[] = [
    ...(asSender.data ?? []).map((f) => ({ friendId: f.receiver_id, label: f.sender_collab_label as string })),
    ...(asReceiver.data ?? []).map((f) => ({ friendId: f.sender_id, label: f.receiver_collab_label as string })),
  ];

  if (collabs.length === 0) return NextResponse.json({ collaborations: [] });

  const ids = [...new Set(collabs.map((c) => c.friendId))];
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name, avatar_url, slug, role, positions")
    .in("user_id", ids);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));

  return NextResponse.json({
    collaborations: collabs.map((c) => {
      const p = profileMap[c.friendId] ?? {};
      return {
        user_id: c.friendId,
        label: c.label,
        display_name: p.display_name ?? "Unbekannt",
        avatar_url: p.avatar_url ?? null,
        slug: p.slug ?? c.friendId,
        role: p.role ?? (Array.isArray(p.positions) ? p.positions[0] : null) ?? null,
      };
    }),
  });
}
