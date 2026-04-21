// Required Supabase table:
// CREATE TABLE IF NOT EXISTS favorites (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id text NOT NULL,
//   listing_id text NOT NULL,
//   listing_type text NOT NULL,
//   listing_title text,
//   listing_city text,
//   listing_price numeric,
//   listing_image text,
//   created_at timestamptz DEFAULT now(),
//   UNIQUE(user_id, listing_id)
// );
// ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "users manage own favorites" ON favorites FOR ALL USING (auth.uid()::text = user_id);

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/favorites — list all favorites for current user
// GET /api/favorites?id=xxx — check if specific listing is favorited
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ favorites: [], isFavorited: false });
  const { userId } = user;

  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const { data } = await supabaseAdmin
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", id)
      .maybeSingle();
    return NextResponse.json({ isFavorited: !!data });
  }

  const { data } = await supabaseAdmin
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ favorites: data ?? [] });
}

// POST /api/favorites — toggle favorite
// Body: { listing_id, listing_type, listing_title, listing_city, listing_price, listing_image }
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const { listing_id, listing_type, listing_title, listing_city, listing_price, listing_image } = body;

  if (!listing_id || !listing_type) {
    return NextResponse.json({ error: "listing_id und listing_type sind erforderlich" }, { status: 400 });
  }

  // Check if already favorited
  const { data: existing } = await supabaseAdmin
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listing_id)
    .maybeSingle();

  if (existing) {
    // Remove
    await supabaseAdmin.from("favorites").delete().eq("id", existing.id);
    return NextResponse.json({ isFavorited: false });
  }

  // Add
  await supabaseAdmin.from("favorites").insert({
    user_id: userId,
    listing_id,
    listing_type,
    listing_title: listing_title ?? null,
    listing_city: listing_city ?? null,
    listing_price: listing_price ?? null,
    listing_image: listing_image ?? null,
  });

  return NextResponse.json({ isFavorited: true });
}
