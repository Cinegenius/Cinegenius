import { localizedNotification } from "@/lib/i18n/notification-copy";
import { db } from "@/lib/db";
import { requireAuth, assertOwner } from "@/lib/guards";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendBookingAcceptedEmail } from "@/lib/email";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// PATCH /api/bookings/[id] — listing owner confirms or rejects a booking
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  if (status !== "confirmed" && status !== "rejected") {
    return NextResponse.json({ error: tResponse('System.m_e1d05fa3a095') }, { status: 400 });
  }

  // Fetch booking — never trust client on what booking this is
  const { data: booking } = await db
    .from("bookings")
    .select("id, ref, user_id, listing_id, listing_title, status")
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: tResponse('System.m_aba364490c7c') }, { status: 404 });
  }

  if (booking.status !== "pending") {
    return NextResponse.json(
      { error: tResponse('System.m_1098c8daf077') },
      { status: 409 }
    );
  }

  // Verify the caller owns the listing that was booked.
  // Ownership lives on the listing, not the booking — fetch from DB.
  const { data: listing } = await db
    .from("listings")
    .select("user_id, title")
    .eq("id", booking.listing_id)
    .maybeSingle();

  const ownershipError = assertOwner(listing?.user_id, userId, tResponse);
  if (ownershipError) return ownershipError;

  // Update booking status
  const { error } = await db
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

  // Notify the booker
  await db.from("notifications").insert({
    user_id: booking.user_id,
    type: status === "confirmed" ? "booking_confirmed" : "booking_rejected",
    ...localizedNotification({ title: status === "confirmed" ? { key: "n_4be82f33ed39" } : { key: "n_576b0b2c6729" }, body: status === "confirmed" ? { key: "n_fde7ef167b37", values: { value0: String(booking.listing_title), value1: String(booking.ref) } } : { key: "n_f0aac5bd59a0", values: { value0: String(booking.listing_title) } } }),

    href: "/dashboard?tab=bookings",
  });

  // Email to booker (best-effort, never fail the request)
  try {
    const clerk = await clerkClient();
    const bookerUser = await clerk.users.getUser(booking.user_id);
    const bookerEmail = bookerUser.emailAddresses[0]?.emailAddress;
    if (bookerEmail && status === "confirmed") {
      await sendBookingAcceptedEmail(bookerEmail, booking.listing_title, booking.ref);
    }
  } catch { /* email is best-effort */ }

  return NextResponse.json({ success: true, status });
}
