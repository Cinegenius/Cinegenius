import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/reviews?target_id=xxx&target_type=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target_id = searchParams.get("target_id");
  const target_type = searchParams.get("target_type");

  if (!target_id || !target_type) {
    return NextResponse.json({ error: "target_id und target_type erforderlich" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, reviewer_name, rating, text, aspect_ratings, created_at")
    .eq("target_id", target_id)
    .eq("target_type", target_type)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/reviews
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { target_id, target_type, rating, text, aspect_ratings } = body;

  if (!target_id || !target_type || !rating || !text?.trim()) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen" }, { status: 400 });
  }

  // SECURITY: nur nach echter abgeschlossener Buchung bewerten
  if (target_type === "listing") {
    const { data: completedBooking } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", target_id)
      .eq("status", "confirmed")
      .maybeSingle();
    if (!completedBooking) {
      return NextResponse.json({ error: "Nur nach einer Buchung bewertbar" }, { status: 403 });
    }
  }

  // Doppelbewertung verhindern
  const { data: existing } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("target_id", target_id)
    .eq("reviewer_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Du hast dieses Inserat bereits bewertet" }, { status: 409 });
  }

  // Reviewer-Name aus Profil holen
  const user = await currentUser();
  const reviewer_name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName[0]}.`
      : user?.firstName ?? "Anonym";

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .insert({ target_id, target_type, reviewer_id: userId, reviewer_name, rating, text: text.trim(), aspect_ratings })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data }, { status: 201 });
}
