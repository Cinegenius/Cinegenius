import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendFriendAcceptedEmail } from "@/lib/email";

// PATCH /api/friendships/[id]  → accept or reject (receiver only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const { data: friendship } = await supabaseAdmin
    .from("friendships")
    .select("id, sender_id, receiver_id")
    .eq("id", id)
    .single();

  if (!friendship) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (friendship.receiver_id !== userId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("friendships")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the original sender when accepted (in-app + email)
  if (status === "accepted") {
    const { data: accepterProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const accepterName = accepterProfile?.display_name ?? "Jemand";

    await supabaseAdmin.from("notifications").insert({
      user_id: friendship.sender_id,
      type: "friend_accepted",
      title: "Freundschaftsanfrage angenommen",
      body: `${accepterName} hat deine Anfrage angenommen.`,
      href: "/dashboard?tab=friends",
    });

    try {
      const clerk = await clerkClient();
      const senderUser = await clerk.users.getUser(friendship.sender_id);
      const senderEmail = senderUser.emailAddresses[0]?.emailAddress;
      if (senderEmail) await sendFriendAcceptedEmail(senderEmail, accepterName);
    } catch { /* email is best-effort */ }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/friendships/[id]  → remove friendship (sender or receiver)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;

  const { data: friendship } = await supabaseAdmin
    .from("friendships")
    .select("id, sender_id, receiver_id")
    .eq("id", id)
    .single();

  if (!friendship) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (friendship.sender_id !== userId && friendship.receiver_id !== userId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("friendships").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
