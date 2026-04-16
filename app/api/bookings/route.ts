// Required Supabase table:
// CREATE TABLE IF NOT EXISTS bookings (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   ref text NOT NULL UNIQUE,
//   user_id text NOT NULL,
//   listing_id text,
//   listing_title text NOT NULL,
//   listing_type text NOT NULL,
//   start_date date NOT NULL,
//   end_date date NOT NULL,
//   days integer NOT NULL DEFAULT 1,
//   daily_rate numeric NOT NULL DEFAULT 0,
//   subtotal numeric NOT NULL DEFAULT 0,
//   platform_fee numeric NOT NULL DEFAULT 0,
//   total numeric NOT NULL DEFAULT 0,
//   notes text,
//   status text NOT NULL DEFAULT 'confirmed',
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX bookings_user_id_idx ON bookings(user_id, created_at DESC);

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewBookingEmail } from "@/lib/email";

function generateRef(): string {
  return "CG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// POST /api/bookings — create a booking
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const {
    listingId,
    listingTitle,
    listingType,
    startDate,
    endDate,
    days,
    dailyRate,
    notes,
  } = body;

  if (!listingTitle || !listingType || !startDate || !endDate || !days || !dailyRate) {
    return NextResponse.json({ error: "Fehlende Pflichtfelder" }, { status: 400 });
  }

  const COMMISSION_RATE = 0.10;
  const subtotal = dailyRate * days;
  const platformFee = Math.round(subtotal * COMMISSION_RATE);
  const total = subtotal + platformFee;
  const ref = generateRef();

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      ref,
      user_id: userId,
      listing_id: listingId ?? null,
      listing_title: listingTitle,
      listing_type: listingType,
      start_date: startDate,
      end_date: endDate,
      days,
      daily_rate: dailyRate,
      subtotal,
      platform_fee: platformFee,
      total,
      notes: notes ?? null,
      status: "confirmed",
    })
    .select("id, ref")
    .single();

  if (error) {
    console.error("Booking insert error:", error);
    return NextResponse.json({ error: "Buchung konnte nicht gespeichert werden" }, { status: 500 });
  }

  // In-app notification for the buyer
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "booking_confirmed",
    title: "Buchung bestätigt",
    body: `Deine Buchung für „${listingTitle}" wurde bestätigt. Referenz: ${ref}`,
    href: `/dashboard?tab=bookings`,
  });

  // Notify + email the listing owner (fire-and-forget)
  try {
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const guestName = senderProfile?.display_name ?? "Jemand";

    if (listingId) {
      const { data: listing } = await supabaseAdmin
        .from("listings")
        .select("user_id")
        .eq("id", listingId)
        .maybeSingle();

      if (listing?.user_id && listing.user_id !== userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: listing.user_id,
          type: "booking_request",
          title: "Neue Buchungsanfrage",
          body: `${guestName} hat „${listingTitle}" gebucht.`,
          href: "/dashboard?tab=bookings",
        });

        const clerk = await clerkClient();
        const ownerUser = await clerk.users.getUser(listing.user_id);
        const ownerEmail = ownerUser.emailAddresses[0]?.emailAddress;
        if (ownerEmail) await sendNewBookingEmail(ownerEmail, listingTitle, guestName);
      }
    }
  } catch { /* email is best-effort */ }

  return NextResponse.json({ id: booking.id, ref: booking.ref });
}

// GET /api/bookings — list bookings for current user, or single by ?ref=CG-XXXXX
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ bookings: [] });

  const ref = new URL(req.url).searchParams.get("ref");

  if (ref) {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, ref, listing_id, listing_title, listing_type, start_date, end_date, days, daily_rate, subtotal, platform_fee, total, notes, status, created_at")
      .eq("user_id", userId)
      .eq("ref", ref)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ booking: data });
  }

  const { data } = await supabaseAdmin
    .from("bookings")
    .select("id, ref, listing_title, listing_type, start_date, end_date, days, total, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ bookings: data ?? [] });
}
