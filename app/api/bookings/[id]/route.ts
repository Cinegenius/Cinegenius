import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewBookingEmail } from "@/lib/email";

// PATCH /api/bookings/[id] — owner confirms or rejects a booking request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (status !== "confirmed" && status !== "rejected") {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  // Load the booking
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, ref, user_id, listing_id, listing_title, status")
    .eq("id", id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden" }, { status: 404 });
  if (booking.status !== "pending") return NextResponse.json({ error: "Buchung ist nicht mehr ausstehend" }, { status: 409 });

  // Verify the current user owns the listing
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("user_id, title")
    .eq("id", booking.listing_id)
    .maybeSingle();

  if (!listing || listing.user_id !== userId) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // Update status
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the booker
  const notifTitle = status === "confirmed" ? "Buchung bestätigt" : "Buchung abgelehnt";
  const notifBody =
    status === "confirmed"
      ? `Deine Buchungsanfrage für „${booking.listing_title}" wurde bestätigt. Referenz: ${booking.ref}`
      : `Deine Buchungsanfrage für „${booking.listing_title}" wurde leider abgelehnt.`;

  await supabaseAdmin.from("notifications").insert({
    user_id: booking.user_id,
    type: status === "confirmed" ? "booking_confirmed" : "booking_rejected",
    title: notifTitle,
    body: notifBody,
    href: "/dashboard?tab=bookings",
  });

  // Send email to booker (best-effort)
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
