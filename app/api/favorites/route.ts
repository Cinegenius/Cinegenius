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

import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

// GET /api/favorites — list all favorites for current user
// GET /api/favorites?id=xxx — check if specific listing is favorited
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ favorites: [], isFavorited: false });
  const { userId } = user;

  const id = req.nextUrl.searchParams.get("id");
  const ids = req.nextUrl.searchParams.get("ids");

  if (id) {
    const { data } = await db
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", id)
      .maybeSingle();
    return NextResponse.json({ isFavorited: !!data });
  }

  if (ids) {
    const idList = ids.split(",").filter(Boolean).slice(0, 300);
    const { data } = await db
      .from("favorites")
      .select("listing_id")
      .eq("user_id", userId)
      .in("listing_id", idList);
    return NextResponse.json({ favorited: (data ?? []).map((r) => r.listing_id) });
  }

  const { data } = await db
    .from("favorites")
    .select("id, listing_id, listing_type, listing_title, listing_city, listing_price, listing_image, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ favorites: data ?? [] });
}

// POST /api/favorites — toggle favorite
// Body: { listing_id }
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`fav:${userId}`, 60, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429 });

  const body = await req.json();
  const { listing_id } = body;

  if (!listing_id) {
    return NextResponse.json({ error: "listing_id ist erforderlich" }, { status: 400 });
  }

  // Check if already favorited
  const { data: existing } = await db
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listing_id)
    .maybeSingle();

  if (existing) {
    // Remove
    await db.from("favorites").delete().eq("id", existing.id);
    return NextResponse.json({ isFavorited: false });
  }

  // Fetch listing data from DB — never trust client-supplied metadata
  const { data: listing } = await db
    .from("listings")
    .select("type, title, city, price, image_url")
    .eq("id", listing_id)
    .maybeSingle();

  if (!listing) {
    return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
  }

  await db.from("favorites").insert({
    user_id: userId,
    listing_id,
    listing_type: listing.type,
    listing_title: listing.title ?? null,
    listing_city: listing.city ?? null,
    listing_price: listing.price ?? null,
    listing_image: listing.image_url ?? null,
  });

  return NextResponse.json({ isFavorited: true });
}
