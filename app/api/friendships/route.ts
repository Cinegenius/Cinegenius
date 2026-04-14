import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendFriendRequestEmail } from "@/lib/email";

// GET /api/friendships?userId=xxx  → friendship status with that user
// GET /api/friendships             → all friendships (enriched with profiles)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId");

  if (targetId) {
    const { data } = await supabaseAdmin
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`
      )
      .maybeSingle();
    return NextResponse.json({ friendship: data ?? null });
  }

  // All friendships
  const { data: friendships, error } = await supabaseAdmin
    .from("friendships")
    .select("id, sender_id, receiver_id, status, created_at")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = friendships ?? [];

  // Enrich with profile data
  const otherIds = list.map((f) => (f.sender_id === userId ? f.receiver_id : f.sender_id));
  let profileMap: Record<string, { display_name?: string; avatar_url?: string; role?: string; positions?: string[] }> = {};

  if (otherIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url, role, positions")
      .in("user_id", otherIds);
    (profiles ?? []).forEach((p) => { profileMap[p.user_id] = p; });
  }

  const enrich = (f: { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }) => {
    const otherId = f.sender_id === userId ? f.receiver_id : f.sender_id;
    const p = profileMap[otherId] ?? {};
    return {
      friendship_id: f.id,
      user_id: otherId,
      display_name: p.display_name ?? "Unbekannt",
      avatar_url: p.avatar_url ?? null,
      role: p.role ?? p.positions?.[0] ?? "CineGenius Mitglied",
      created_at: f.created_at,
    };
  };

  return NextResponse.json({
    friends:  list.filter((f) => f.status === "accepted").map(enrich),
    incoming: list.filter((f) => f.status === "pending" && f.receiver_id === userId).map(enrich),
    outgoing: list.filter((f) => f.status === "pending" && f.sender_id  === userId).map(enrich),
  });
}

// POST /api/friendships  → send friend request
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { receiver_id } = await req.json();
  if (!receiver_id) return NextResponse.json({ error: "receiver_id fehlt" }, { status: 400 });
  if (receiver_id === userId) return NextResponse.json({ error: "Kann sich selbst nicht hinzufügen" }, { status: 400 });

  // Check for existing record
  const { data: existing } = await supabaseAdmin
    .from("friendships")
    .select("id, status")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${userId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return NextResponse.json({ error: "Ihr seid bereits Freunde" }, { status: 409 });
    if (existing.status === "pending")  return NextResponse.json({ error: "Anfrage bereits vorhanden" }, { status: 409 });
    // rejected → delete and re-send
    await supabaseAdmin.from("friendships").delete().eq("id", existing.id);
  }

  const { data, error } = await supabaseAdmin
    .from("friendships")
    .insert({ sender_id: userId, receiver_id, status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the receiver (in-app + email) — fire-and-forget
  const { data: senderProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const senderName = senderProfile?.display_name ?? "Jemand";

  await supabaseAdmin.from("notifications").insert({
    user_id: receiver_id,
    type: "friend_request",
    title: "Neue Freundschaftsanfrage",
    body: `${senderName} möchte sich mit dir vernetzen.`,
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
