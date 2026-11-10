import { localizedNotification } from "@/lib/i18n/notification-copy";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendFriendRequestEmail } from "@/lib/email";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// GET /api/friendships?userId=xxx  → friendship status with that user
// GET /api/friendships             → all friendships (enriched with profiles)
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId");

  if (targetId && !/^[a-zA-Z0-9_-]{1,128}$/.test(targetId)) {
    return NextResponse.json({ error: tResponse('System.m_8c08f6c37908') }, { status: 400 });
  }

  if (targetId) {
    const { data } = await db
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`
      )
      .maybeSingle();
    return NextResponse.json({ friendship: data ?? null });
  }

  // All friendships
  const { data: friendships, error } = await db
    .from("friendships")
    .select("id, sender_id, receiver_id, status, created_at, sender_collab_label, sender_collab_public, receiver_collab_label, receiver_collab_public")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

  const list = friendships ?? [];

  // Enrich with profile data
  const otherIds = list.map((f) => (f.sender_id === userId ? f.receiver_id : f.sender_id));
  const profileMap: Record<string, { display_name?: string; avatar_url?: string; role?: string; positions?: string[] }> = {};

  if (otherIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, display_name, avatar_url, role, positions")
      .in("user_id", otherIds);
    (profiles ?? []).forEach((p) => { profileMap[p.user_id] = p; });
  }

  const enrich = (f: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string; sender_collab_label?: string | null; sender_collab_public?: boolean | null; receiver_collab_label?: string | null; receiver_collab_public?: boolean | null }) => {
    const isSender = f.sender_id === userId;
    const otherId = isSender ? f.receiver_id : f.sender_id;
    const p = profileMap[otherId] ?? {};
    return {
      friendship_id: f.id,
      user_id: otherId,
      display_name: p.display_name ?? "Unbekannt",
      avatar_url: p.avatar_url ?? null,
      role: p.role ?? p.positions?.[0] ?? "CineGenius Mitglied",
      created_at: f.created_at,
      collab_label: (isSender ? f.sender_collab_label : f.receiver_collab_label) ?? null,
      collab_public: (isSender ? f.sender_collab_public : f.receiver_collab_public) ?? false,
    };
  };

  return NextResponse.json({
    friends:  list.filter((f) => f.status === "accepted").map(enrich),
    incoming: list.filter((f) => f.status === "pending" && f.receiver_id === userId).map(enrich),
    outgoing: list.filter((f) => f.status === "pending" && f.sender_id  === userId).map(enrich),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

// POST /api/friendships  → send friend request
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { receiver_id } = await req.json();
  if (!receiver_id) return NextResponse.json({ error: tResponse('System.m_c7b1c41cee48') }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(receiver_id)) return NextResponse.json({ error: tResponse('System.m_673b6b200d92') }, { status: 400 });
  if (receiver_id === userId) return NextResponse.json({ error: tResponse('System.m_de56307e4c66') }, { status: 400 });

  // Check for existing record
  const { data: existing } = await db
    .from("friendships")
    .select("id, status")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${userId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return NextResponse.json({ error: tResponse('System.m_39eabeb606d8') }, { status: 409 });
    if (existing.status === "pending")  return NextResponse.json({ error: tResponse('System.m_d3d12a4e01f5') }, { status: 409 });
    // rejected → delete and re-send
    await db.from("friendships").delete().eq("id", existing.id);
  }

  const { data, error } = await db
    .from("friendships")
    .insert({ sender_id: userId, receiver_id, status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

  // Notify the receiver (in-app + email) — fire-and-forget
  const { data: senderProfile } = await db
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const senderName = senderProfile?.display_name ?? "Jemand";

  await db.from("notifications").insert({
    user_id: receiver_id,
    type: "friend_request",
    ...localizedNotification({ title: { key: "n_cbf93b99dd39" }, body: { key: "n_aa80d88f1a90", values: { value0: String(senderName) } } }),

    href: "/messages",
  });

  try {
    const clerk = await clerkClient();
    const receiverUser = await clerk.users.getUser(receiver_id);
    const receiverEmail = receiverUser.emailAddresses[0]?.emailAddress;
    if (receiverEmail) await sendFriendRequestEmail(receiverEmail, senderName);
  } catch { /* email is best-effort */ }

  return NextResponse.json({ friendship: data });
}
