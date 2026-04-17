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
  const { listingId, startDate, endDate, notes } = body;

  if (!listingId || !startDate || !endDate) {
    return NextResponse.json({ error: "Fehlende Pflichtfelder" }, { status: 400 });
  }

  // SECURITY: read price and title server-side from DB — never trust client
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("id, title, type, price, user_id, published")
    .eq("id", listingId)
    .eq("published", true)
    .maybeSingle();

  if (!listing) return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
  if (listing.user_id === userId) return NextResponse.json({ error: "Eigenes Inserat kann nicht gebucht werden" }, { status: 400 });

  // Compute days server-side
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: "Ungültige Datumsangaben" }, { status: 400 });
  }
  const days         = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const listingTitle = listing.title;
  const listingType  = listing.type;
  const dailyRate    = Number(listing.price) || 0;
  const subtotal  = dailyRate * days;
  const platformFee = 0;
  const total     = subtotal;
  const ref       = generateRef();

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      ref,
      user_id: userId,
      listing_id: listing.id,
      listing_title: listing.title,
      listing_type: listing.type,
      start_date: startDate,
      end_date: endDate,
      days,
      daily_rate: dailyRate,
      subtotal,
      platform_fee: platformFee,
      total,
      notes: typeof notes === "string" ? notes.slice(0, 1000) : null,
      status: "pending",
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
    type: "booking_request",
    title: "Buchungsanfrage gesendet",
    body: `Deine Anfrage für „${listingTitle}" wurde gesendet. Referenz: ${ref}`,
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
// ?incoming=true → requests for listings owned by the current user
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ bookings: [] });

  const searchParams = new URL(req.url).searchParams;
  const ref      = searchParams.get("ref");
  const incoming = searchParams.get("incoming") === "true";

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

  if (incoming) {
    // Get listing IDs owned by this user
    const { data: ownedListings } = await supabaseAdmin
      .from("listings")
      .select("id")
      .eq("user_id", userId);
    const ownedIds = (ownedListings ?? []).map((l) => l.id);
    if (ownedIds.length === 0) return NextResponse.json({ bookings: [] });

    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id, ref, user_id, listing_id, listing_title, listing_type, start_date, end_date, days, daily_rate, total, notes, status, created_at")
      .in("listing_id", ownedIds)
      .order("created_at", { ascending: false })
      .limit(100);

    // Enrich with booker display_name
    const bookerIds = [...new Set((data ?? []).map((b) => b.user_id))];
    let nameMap: Record<string, string> = {};
    if (bookerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", bookerIds);
      (profiles ?? []).forEach((p) => { nameMap[p.user_id] = p.display_name ?? "Unbekannt"; });
    }

    const enriched = (data ?? []).map((b) => ({ ...b, booker_name: nameMap[b.user_id] ?? "Unbekannt" }));
    return NextResponse.json({ bookings: enriched });
  }

  const { data } = await supabaseAdmin
    .from("bookings")
    .select("id, ref, listing_title, listing_type, start_date, end_date, days, total, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ bookings: data ?? [] });
}
