import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuth, assertOwner } from "@/lib/guards";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewBookingEmail } from "@/lib/email";

// PATCH /api/bookings/[id] — listing owner confirms or rejects a booking
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  if (status !== "confirmed" && status !== "rejected") {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  // Fetch booking — never trust client on what booking this is
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, ref, user_id, listing_id, listing_title, status")
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden" }, { status: 404 });
  }

  if (booking.status !== "pending") {
    return NextResponse.json(
      { error: "Buchung ist nicht mehr ausstehend" },
      { status: 409 }
    );
  }

  // Verify the caller owns the listing that was booked.
  // Ownership lives on the listing, not the booking — fetch from DB.
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("user_id, title")
    .eq("id", booking.listing_id)
    .maybeSingle();

  const ownershipError = assertOwner(listing?.user_id, userId);
  if (ownershipError) return ownershipError;

  // Update booking status
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the booker
  await supabaseAdmin.from("notifications").insert({
    user_id: booking.user_id,
    type: status === "confirmed" ? "booking_confirmed" : "booking_rejected",
    title: status === "confirmed" ? "Buchung bestätigt" : "Buchung abgelehnt",
    body:
      status === "confirmed"
        ? `Deine Buchungsanfrage für „${booking.listing_title}" wurde bestätigt. Referenz: ${booking.ref}`
        : `Deine Buchungsanfrage für „${booking.listing_title}" wurde leider abgelehnt.`,
    href: "/dashboard?tab=bookings",
  });

  // Email to booker (best-effort, never fail the request)
  try {
    const [{ data: ownerProfile }, clerk] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      clerkClient(),
    ]);
    const ownerName = ownerProfile?.display_name ?? "Der Anbieter";
    const bookerUser = await clerk.users.getUser(booking.user_id);
    const bookerEmail = bookerUser.emailAddresses[0]?.emailAddress;
    if (bookerEmail && status === "confirmed") {
      await sendNewBookingEmail(bookerEmail, booking.listing_title, ownerName);
    }
  } catch { /* email is best-effort */ }

  return NextResponse.json({ success: true, status });
}
