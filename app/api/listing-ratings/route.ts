import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// GET /api/listing-ratings?ids=id1,id2,...
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ ratings: {}, myRatings: {} });

  const idList = ids.split(",").filter(Boolean).slice(0, 300);
  if (!idList.length) return NextResponse.json({ ratings: {}, myRatings: {} });

  const { userId } = await auth();

  const { data, error } = await db
    .from("listing_ratings")
    .select("listing_id, liker_id, rating")
    .in("listing_id", idList);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const agg: Record<string, { sum: number; count: number }> = {};
  const myRatings: Record<string, number> = {};

  for (const row of data ?? []) {
    if (!agg[row.listing_id]) agg[row.listing_id] = { sum: 0, count: 0 };
    agg[row.listing_id].sum += row.rating ?? 1;
    agg[row.listing_id].count += 1;
    if (userId && row.liker_id === userId) myRatings[row.listing_id] = row.rating ?? 1;
  }

  const ratings: Record<string, { avg: number; count: number }> = {};
  for (const [id, { sum, count }] of Object.entries(agg)) {
    ratings[id] = { avg: Math.round((sum / count) * 10) / 10, count };
  }

  return NextResponse.json({ ratings, myRatings });
}

// POST /api/listing-ratings  { listing_id, owner_id, rating: 1-5 }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { listing_id, owner_id, rating } = await req.json().catch(() => ({}));
  if (!listing_id) return NextResponse.json({ error: "listing_id erforderlich" }, { status: 400 });
  if (owner_id && owner_id === userId) return NextResponse.json({ error: "Eigene Inserate können nicht bewertet werden" }, { status: 403 });

  const r = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

  const { data: existing } = await db
    .from("listing_ratings")
    .select("id")
    .eq("liker_id", userId)
    .eq("listing_id", listing_id)
    .maybeSingle();
  const isNew = !existing;

  const { error } = await db
    .from("listing_ratings")
    .upsert({ liker_id: userId, listing_id, rating: r }, { onConflict: "liker_id,listing_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isNew && owner_id) {
    try {
      const { data: liker } = await db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
      const { data: listing } = await db.from("listings").select("title, user_id").eq("id", listing_id).maybeSingle();
      if (listing) {
        const name = liker?.display_name ?? "Jemand";
        await db.from("notifications").insert({
          user_id: listing.user_id,
          type: "review",
          title: "Inserat bewertet",
          body: `${name} hat dein Inserat „${listing.title}" mit ${r} Stern${r !== 1 ? "en" : ""} bewertet.`,
          href: `/listings/${listing_id}`,
        });
      }
    } catch { /* fire-and-forget */ }
  }

  revalidateTag("listings", "max");
  return NextResponse.json({ success: true });
}

// DELETE /api/listing-ratings  { listing_id }
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { listing_id } = await req.json().catch(() => ({}));
  if (!listing_id) return NextResponse.json({ error: "listing_id erforderlich" }, { status: 400 });

  await db.from("listing_ratings").delete().eq("liker_id", userId).eq("listing_id", listing_id);

  revalidateTag("listings", "max");
  return NextResponse.json({ success: true });
}
