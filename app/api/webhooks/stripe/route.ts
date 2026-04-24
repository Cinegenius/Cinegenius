// Required Supabase columns (add via migration before activating Stripe):
//
// ALTER TABLE bookings
//   ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
//
// CREATE TABLE IF NOT EXISTS stripe_events (
//   id text PRIMARY KEY,         -- Stripe event ID (idempotency key)
//   type text NOT NULL,
//   created_at timestamptz DEFAULT now()
// );

import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendNewBookingEmail, sendBookingConfirmedEmail } from "@/lib/email";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

// Stripe sends the raw body — do NOT use req.json() here.
// Next.js would re-encode it and the signature check would fail.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip events already processed
  const { data: existing } = await db
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, skipped: true });
  }

  await db.from("stripe_events").insert({ id: event.id, type: event.type });

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingRef = pi.metadata?.booking_ref;
      if (bookingRef) {
        const { data: booking } = await db
          .from("bookings")
          .select("id, listing_title, listing_type, user_id, listing_id, daily_rate, start_date, end_date, days, total")
          .eq("ref", bookingRef)
          .maybeSingle();

        await db
          .from("bookings")
          .update({ status: "confirmed", stripe_payment_intent_id: pi.id })
          .eq("ref", bookingRef);

        if (booking) {
          // Fire-and-forget: notifications + emails
          (async () => {
            try {
              const listingTitle = booking.listing_title ?? "Inserat";

              // Get listing owner (host)
              let hostUserId: string | null = null;
              if (booking.listing_id) {
                const { data: listing } = await db
                  .from("listings")
                  .select("user_id")
                  .eq("id", booking.listing_id)
                  .maybeSingle();
                hostUserId = listing?.user_id ?? null;
              }

              // Guest profile
              const { data: guestProfile } = await db
                .from("profiles")
                .select("display_name")
                .eq("user_id", booking.user_id)
                .maybeSingle();
              const guestName = guestProfile?.display_name ?? "Ein Nutzer";

              // Notify guest: booking confirmed
              await db.from("notifications").insert({
                user_id: booking.user_id,
                type: "booking_confirmed",
                title: `Buchung bestätigt: ${listingTitle}`,
                body: `Deine Zahlung wurde erfolgreich verarbeitet. Buchungsreferenz: ${bookingRef}`,
                href: `/dashboard?tab=bookings`,
              });

              // Notify host: new booking received
              if (hostUserId) {
                await db.from("notifications").insert({
                  user_id: hostUserId,
                  type: "booking_request",
                  title: `Neue Buchung: ${listingTitle}`,
                  body: `${guestName} hat dein Inserat für ${booking.days ?? 1} Tag(e) gebucht.`,
                  href: `/dashboard?tab=bookings`,
                });
              }

              const clerk = await clerkClient();

              // Booking confirmed email to guest
              const guestUser = await clerk.users.getUser(booking.user_id);
              const guestEmail = guestUser.emailAddresses[0]?.emailAddress;
              if (guestEmail) {
                await sendBookingConfirmedEmail(guestEmail, listingTitle, bookingRef);
              }

              // New booking notification email to host
              if (hostUserId) {
                const hostUser = await clerk.users.getUser(hostUserId);
                const hostEmail = hostUser.emailAddresses[0]?.emailAddress;
                if (hostEmail) {
                  await sendNewBookingEmail(hostEmail, listingTitle, guestName);
                }
              }
            } catch { /* best-effort */ }
          })();
        }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const bookingRef = pi.metadata?.booking_ref;
      if (bookingRef) {
        await db
          .from("bookings")
          .update({ status: "payment_failed" })
          .eq("ref", bookingRef);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const bookingRef = charge.metadata?.booking_ref;
      if (bookingRef) {
        await db
          .from("bookings")
          .update({ status: "refunded" })
          .eq("ref", bookingRef);
      }
      break;
    }

    default:
      // Unhandled event — safe to ignore
      break;
  }

  return NextResponse.json({ received: true });
}
