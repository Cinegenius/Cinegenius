import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

// Current account-removal steps, not a complete erasure ledger. Other data
// classes, shared records and provider retention require a separate review.
export async function DELETE(request: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const t = await getTranslations("System");
  // An old tab must not delete the account that replaced its original session.
  if (request.headers.get("X-Account-Id") !== userId) {
    return NextResponse.json({ error: t("requestFailed") }, { status: 409, headers: privateHeaders });
  }
  // Keep a privacy tombstone while erasure is incomplete. Removing settings
  // can restore the default public audience for surviving linked records.
  try {
    const privacy = await db.from("user_settings").upsert({
      user_id: userId, ghost_mode: true, profile_visibility: "private", show_in_home_crew: false,
    }, { onConflict: "user_id" }).select("user_id,ghost_mode,profile_visibility,show_in_home_crew").single();
    if (privacy.error || privacy.data?.user_id !== userId || privacy.data.ghost_mode !== true
      || privacy.data.profile_visibility !== "private" || privacy.data.show_in_home_crew !== false) {
      return NextResponse.json({ error: t("requestFailed") }, { status: 503, headers: privateHeaders });
    }
  } catch {
    return NextResponse.json({ error: t("requestFailed") }, { status: 503, headers: privateHeaders });
  }
  // SQL errors resolve as { error }; allSettled does not make them successful.
  // Retain the login if any step fails so the account remains recoverable.
  const results = await Promise.allSettled([
    db.from("profiles").delete().eq("user_id", userId),
    db.from("listings").delete().eq("user_id", userId),
    db.from("conversations").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
    db.from("messages").delete().eq("sender_id", userId),
    db.from("applications").delete().or(`applicant_id.eq.${userId},owner_id.eq.${userId}`),
    db.from("bookings").delete().eq("user_id", userId),
    db.from("reviews").delete().eq("reviewer_id", userId),
    db.from("blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    db.from("reports").delete().eq("reporter_id", userId),
    db.from("notifications").delete().eq("user_id", userId),
    db.from("favorites").delete().eq("user_id", userId),
  ]);

  if (results.some(result => result.status === "rejected" || !result.value || result.value.error)) {
    return NextResponse.json({ error: t("requestFailed") }, { status: 503, headers: privateHeaders });
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch {
    return NextResponse.json({ error: t("requestFailed") }, { status: 503, headers: privateHeaders });
  }

  return NextResponse.json({ success: true }, { headers: privateHeaders });
}
