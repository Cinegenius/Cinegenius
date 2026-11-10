import { localizedNotification } from "@/lib/i18n/notification-copy";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { sendFriendAcceptedEmail } from "@/lib/email";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// PATCH /api/friendships/[id]
// action: "accepted" | "rejected"  → receiver only, changes status
// action: "collab"                  → either party, sets their own collab_label + collab_public
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json();

  // ── Collaboration label/visibility update ───────────────────────────────────
  if (body.action === "collab") {
    const { data: friendship } = await db
      .from("friendships")
      .select("id, sender_id, receiver_id, status")
      .eq("id", id)
      .single();

    if (!friendship) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });
    if (friendship.status !== "accepted") return NextResponse.json({ error: tResponse('System.m_d7dab3b028ce') }, { status: 400 });
    if (friendship.sender_id !== userId && friendship.receiver_id !== userId) {
      return NextResponse.json({ error: tResponse('System.m_df847a54c928') }, { status: 403 });
    }

    const isSender = friendship.sender_id === userId;
    const update = isSender
      ? { sender_collab_label: body.label ?? null, sender_collab_public: !!body.is_public }
      : { receiver_collab_label: body.label ?? null, receiver_collab_public: !!body.is_public };

    const { error } = await db.from("friendships").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
    revalidateTag("profiles", { expire: 0 });
    return NextResponse.json({ success: true });
  }

  // ── Accept / reject ─────────────────────────────────────────────────────────
  const { status } = body;

  if (!["accepted", "rejected"].includes(status)) {
    return NextResponse.json({ error: tResponse('System.m_e1d05fa3a095') }, { status: 400 });
  }

  const { data: friendship } = await db
    .from("friendships")
    .select("id, sender_id, receiver_id")
    .eq("id", id)
    .single();

  if (!friendship) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });
  if (friendship.receiver_id !== userId) {
    return NextResponse.json({ error: tResponse('System.m_df847a54c928') }, { status: 403 });
  }

  const { error } = await db
    .from("friendships")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  if (status === "accepted") revalidateTag("profiles", { expire: 0 });

  // Notify the original sender when accepted (in-app + email)
  if (status === "accepted") {
    const { data: accepterProfile } = await db
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const accepterName = accepterProfile?.display_name ?? "Jemand";

    await db.from("notifications").insert({
      user_id: friendship.sender_id,
      type: "friend_accepted",
      ...localizedNotification({ title: { key: "n_e3ef2e08afb3" }, body: { key: "n_8a8b90197586", values: { value0: String(accepterName) } } }),

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
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  const { data: friendship } = await db
    .from("friendships")
    .select("id, sender_id, receiver_id")
    .eq("id", id)
    .single();

  if (!friendship) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });
  if (friendship.sender_id !== userId && friendship.receiver_id !== userId) {
    return NextResponse.json({ error: tResponse('System.m_df847a54c928') }, { status: 403 });
  }

  const { error } = await db.from("friendships").delete().eq("id", id);
  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  revalidateTag("profiles", { expire: 0 });
  return NextResponse.json({ success: true });
}
