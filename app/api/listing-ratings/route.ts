import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { fetchRatingSummaries } from "@/lib/ratings";

// GET /api/listing-ratings?ids=id1,id2,...
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ ratings: {}, myRatings: {} });

  const idList = ids.split(",").filter(Boolean).slice(0, 300);
  if (!idList.length) return NextResponse.json({ ratings: {}, myRatings: {} });

  const { userId } = await auth();

  const myRatings: Record<string, number> = {};
  const [summaryMap, quickResult, reviewResult] = await Promise.all([
    fetchRatingSummaries(idList, "listing"),
    db.from("listing_ratings").select("listing_id, liker_id, rating").in("listing_id", idList),
    db.from("reviews").select("target_id, reviewer_id, rating").eq("target_type", "listing").in("target_id", idList),
  ]);
  if (quickResult.error) return NextResponse.json({ error: quickResult.error.message }, { status: 500 });
  if (reviewResult.error) return NextResponse.json({ error: reviewResult.error.message }, { status: 500 });
  for (const row of quickResult.data ?? []) {
    if (userId && row.liker_id === userId) myRatings[row.listing_id] = row.rating ?? 1;
  }
  for (const row of reviewResult.data ?? []) {
    if (userId && row.reviewer_id === userId && myRatings[row.target_id] === undefined) {
      myRatings[row.target_id] = row.rating;
    }
  }

  const ratings = Object.fromEntries(Object.entries(summaryMap).map(([id, summary]) => [id, {
    avg: summary.rating,
    count: summary.reviews,
    ratingOnlyCount: summary.ratingOnly,
  }]));

  // Return which listings this user has contacted (eligible to rate)
  let eligible: string[] = [];
  if (userId) {
    const { data: convs } = await db
      .from("conversations")
      .select("listing_id")
      .eq("sender_id", userId)
      .in("listing_id", idList);
    eligible = (convs ?? []).map((c) => c.listing_id).filter(Boolean) as string[];
  }

  return NextResponse.json({ ratings, myRatings, eligible });
}

// POST /api/listing-ratings  { listing_id, owner_id, rating: 1-5 }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { listing_id, owner_id, rating } = await req.json().catch(() => ({}));
  if (!listing_id) return NextResponse.json({ error: "listing_id erforderlich" }, { status: 400 });
  if (owner_id && owner_id === userId) return NextResponse.json({ error: "Eigene Inserate können nicht bewertet werden" }, { status: 403 });

  // Only allow rating if the user has previously contacted the owner about this listing
  const { data: conv } = await db
    .from("conversations")
    .select("id")
    .eq("sender_id", userId)
    .eq("listing_id", listing_id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Du kannst ein Inserat erst bewerten, nachdem du den Anbieter kontaktiert hast." }, { status: 403 });

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
