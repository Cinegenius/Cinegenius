import { localizedNotification } from "@/lib/i18n/notification-copy";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { fetchRatingSummaries } from "@/lib/ratings";
import { listingDetailPath } from "@/lib/listing-routes";
import { getTranslations as getResponseTranslations } from "next-intl/server";

type RatingListing = { id: string; user_id: string | null; company_id: string | null; title: string; type: string; ownerId: string };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/** Resolve current public providers internally; no account IDs enter the response. */
async function publicRatingListings(ids: string[]): Promise<RatingListing[]> {
  const { data, error } = await db.from("privacy_visible_listings")
    .select("id,user_id,company_id,title,type,published").in("id", ids).eq("published", true);
  if (error) throw new Error("rating_listing_lookup_failed");
  const companyIds = [...new Set((data ?? []).map(row => row.company_id).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const companies = companyIds.length
    ? await db.from("companies").select("id,owner_user_id,published").in("id", companyIds)
    : { data: [], error: null };
  if (companies.error) throw new Error("rating_company_lookup_failed");
  const publicOwners = new Map((companies.data ?? []).filter(company => company.published === true)
    .map(company => [company.id, company.owner_user_id]));
  return (data ?? []).flatMap(row => {
    const ownerId = row.company_id ? publicOwners.get(row.company_id) : row.user_id;
    return typeof ownerId === "string" && ownerId ? [{ ...row, ownerId }] : [];
  });
}

/** Keep existing contact eligibility and the established confirmed-booking proof.
 * A conversation with an unrelated recipient cannot qualify an arbitrary ID. */
async function eligibleListingIds(userId: string, listings: RatingListing[]): Promise<Set<string>> {
  const candidates = listings.filter(listing => listing.ownerId !== userId && listing.user_id !== userId);
  if (!candidates.length) return new Set();
  const ids = candidates.map(listing => listing.id);
  const [contacts, bookings] = await Promise.all([
    db.from("conversations").select("listing_id,receiver_id").eq("sender_id", userId).in("listing_id", ids),
    db.from("bookings").select("listing_id").eq("user_id", userId).eq("status", "confirmed").in("listing_id", ids),
  ]);
  const owners = new Map(candidates.map(listing => [listing.id, listing.ownerId]));
  const eligible = new Set<string>([
    ...(!contacts.error ? contacts.data ?? [] : []).filter(contact => owners.get(contact.listing_id) === contact.receiver_id).map(contact => contact.listing_id),
    ...(!bookings.error ? bookings.data ?? [] : []).map(booking => booking.listing_id),
  ]);
  // Either established proof is sufficient; an optional lookup outage must
  // not invalidate another successful proof, or authorize an unknown listing.
  if ((contacts.error || bookings.error) && candidates.some(listing => !eligible.has(listing.id))) throw new Error("rating_eligibility_lookup_failed");
  return eligible;
}

// GET /api/listing-ratings?ids=id1,id2,...
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({ ratings: {}, myRatings: {} }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });

  const idList = [...new Set(ids.split(",").filter(id => id && id.length <= 128))].slice(0, 300);
  if (!idList.length) return NextResponse.json({ ratings: {}, myRatings: {} }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });

  const { userId } = await auth();

  let listings: RatingListing[], eligible: string[];
  try {
    listings = await publicRatingListings(idList);
    eligible = userId ? [...await eligibleListingIds(userId, listings)] : [];
  } catch {
    return json({ error: tResponse("System.requestFailed") }, 500);
  }
  const publicIds = listings.map(listing => listing.id);
  if (!publicIds.length) return json({ ratings: {}, myRatings: {}, eligible: [] });

  const myRatings: Record<string, number> = {};
  const [summaryMap, quickResult, reviewResult] = await Promise.all([
    fetchRatingSummaries(publicIds, "listing"),
    db.from("listing_ratings").select("listing_id, liker_id, rating").in("listing_id", publicIds),
    db.from("reviews").select("target_id, reviewer_id, rating").eq("target_type", "listing").in("target_id", publicIds),
  ]);
  if (quickResult.error) return json({ error: tResponse("System.requestFailed") }, 500);
  if (reviewResult.error) return json({ error: tResponse("System.requestFailed") }, 500);
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

  return NextResponse.json({ ratings, myRatings, eligible }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

// POST /api/listing-ratings { listing_id, rating: 1-5 }; legacy owner_id is ignored.
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const { userId } = await auth();
  if (!userId) return json({ error: tResponse('System.m_352f63d9d1d9') }, 401);

  const body = await req.json().catch(() => null);
  const { listing_id, rating } = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  if (typeof listing_id !== "string" || !listing_id.trim() || listing_id.length > 128) return json({ error: tResponse('System.m_10bdde0eb628') }, 400);
  let listing: RatingListing | undefined;
  try {
    [listing] = await publicRatingListings([listing_id]);
    if (!listing) return json({ error: tResponse('System.m_853de52d816c') }, 404);
    if (listing.ownerId === userId || listing.user_id === userId) return json({ error: tResponse('System.m_3455646e5edd') }, 403);
    if (!(await eligibleListingIds(userId, [listing])).has(listing_id)) return json({ error: tResponse('System.m_814018cdef81') }, 403);
  } catch {
    return json({ error: tResponse("System.requestFailed") }, 500);
  }

  const r = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

  const { data: existing, error: existingError } = await db
    .from("listing_ratings")
    .select("id")
    .eq("liker_id", userId)
    .eq("listing_id", listing_id)
    .maybeSingle();
  if (existingError) return json({ error: tResponse("System.requestFailed") }, 500);
  const isNew = !existing;

  const { error } = await db
    .from("listing_ratings")
    .upsert({ liker_id: userId, listing_id, rating: r }, { onConflict: "liker_id,listing_id" });

  if (error) return json({ error: tResponse('System.requestFailed') }, 500);

  if (isNew) {
    try {
      const { data: liker } = await db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
      if (listing) {
        const name = liker?.display_name ?? "Jemand";
        await db.from("notifications").insert({
          user_id: listing.ownerId,
          type: "review",
          ...localizedNotification({ title: { key: "n_6fc234ff6dc6" }, body: { key: "n_794be4485c9a", values: { value0: String(name), value1: String(listing.title), value2: r } } }),

          href: listingDetailPath(listing.type, listing_id) ?? "/dashboard?tab=listings",
        });
      }
    } catch { /* fire-and-forget */ }
  }

  revalidateTag("listings", "max");
  return json({ success: true });
}

// DELETE /api/listing-ratings  { listing_id }
export async function DELETE(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: tResponse('System.m_352f63d9d1d9') }, { status: 401 });

  const { listing_id } = await req.json().catch(() => ({}));
  if (!listing_id) return NextResponse.json({ error: tResponse('System.m_10bdde0eb628') }, { status: 400 });

  await db.from("listing_ratings").delete().eq("liker_id", userId).eq("listing_id", listing_id);

  revalidateTag("listings", "max");
  return NextResponse.json({ success: true });
}
