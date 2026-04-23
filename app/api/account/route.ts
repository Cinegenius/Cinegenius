import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// DELETE /api/account — delete all user data and Clerk account
export async function DELETE() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Delete all Supabase data for this user in parallel
  await Promise.allSettled([
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
    db.from("user_settings").delete().eq("user_id", userId),
  ]);

  // Delete Clerk user last (invalidates the session)
  const clerk = await clerkClient();
  await clerk.users.deleteUser(userId);

  return NextResponse.json({ success: true });
}
