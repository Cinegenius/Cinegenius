import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { anyBlockExists } from "@/lib/trust";
import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_TARGET_TYPES = new Set(["listing", "user"]);

// GET /api/reviews?target_id=xxx&target_type=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target_id   = searchParams.get("target_id");
  const target_type = searchParams.get("target_type");

  if (!target_id || !target_type) {
    return NextResponse.json({ error: "target_id und target_type erforderlich" }, { status: 400 });
  }

  const { data, error } = await db
    .from("reviews")
    .select("id, reviewer_name, rating, text, aspect_ratings, verified, verified_via, created_at")
    .eq("target_id", target_id)
    .eq("target_type", target_type)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/reviews
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const { target_id, target_type, rating, text, aspect_ratings } = body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!VALID_TARGET_TYPES.has(target_type)) {
    return NextResponse.json({ error: "Ungültiger target_type" }, { status: 400 });
  }
  if (!target_id || typeof target_id !== "string") {
    return NextResponse.json({ error: "target_id fehlt" }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Bewertung muss eine ganze Zahl zwischen 1 und 5 sein" }, { status: 400 });
  }
  if (!text?.trim()) {
    return NextResponse.json({ error: "Bewertungstext fehlt" }, { status: 400 });
  }
  if (text.trim().length < 10) {
    return NextResponse.json({ error: "Bewertungstext zu kurz (min. 10 Zeichen)" }, { status: 400 });
  }
  if (text.trim().length > 2000) {
    return NextResponse.json({ error: "Bewertungstext zu lang (max. 2000 Zeichen)" }, { status: 400 });
  }
  if (aspect_ratings !== undefined && aspect_ratings !== null) {
    if (typeof aspect_ratings !== "object" || Array.isArray(aspect_ratings)) {
      return NextResponse.json({ error: "aspect_ratings muss ein Objekt sein" }, { status: 400 });
    }
    const invalid = Object.values(aspect_ratings).some(
      (v) => typeof v !== "number" || v < 1 || v > 5
    );
    if (invalid) {
      return NextResponse.json({ error: "aspect_ratings Werte müssen zwischen 1 und 5 liegen" }, { status: 400 });
    }
  }

  // ── Resolve target owner (listing → owner; user → target itself) ──────────
  let targetOwnerId: string = target_id; // for user reviews owner = target
  let listingTitle: string | null = null;

  if (target_type === "listing") {
    const { data: listing } = await db
      .from("listings")
      .select("user_id, title")
      .eq("id", target_id)
      .maybeSingle();
    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }
    targetOwnerId = listing.user_id;
    listingTitle  = listing.title;
  }

  // ── Self-review guard ─────────────────────────────────────────────────────
  if (targetOwnerId === userId) {
    return NextResponse.json({ error: "Eigene Inhalte können nicht bewertet werden" }, { status: 400 });
  }

  // ── Block check (uses resolved owner ID, not raw target_id) ──────────────
  if (await anyBlockExists(userId, targetOwnerId)) {
    return NextResponse.json({ error: "Bewertung nicht möglich" }, { status: 403 });
  }

  // ── Eligibility: must have a real booking or accepted application ─────────
  const via = await resolveEligibility(userId, target_type, target_id, targetOwnerId);
  if (!via) {
    return NextResponse.json(
      { error: "Bewertung nur nach einer Buchung oder angenommenen Bewerbung möglich" },
      { status: 403 }
    );
  }

  // ── Duplicate check (enforced by DB unique index + guard here) ───────────
  const { data: existing } = await db
    .from("reviews")
    .select("id")
    .eq("reviewer_id", userId)
    .eq("target_id", target_id)
    .eq("target_type", target_type)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Du hast diesen Inhalt bereits bewertet" }, { status: 409 });
  }

  // ── Build reviewer name from Clerk ────────────────────────────────────────
  const user = await currentUser();
  const reviewer_name =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName[0]}.`
      : user?.firstName ?? "Anonym";

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data, error } = await db
    .from("reviews")
    .insert({
      target_id,
      target_type,
      reviewer_id:   userId,
      reviewer_name,
      rating,
      text:          text.trim(),
      aspect_ratings: aspect_ratings ?? null,
      verified:      true,
      verified_via:  via,
    })
    .select("id, reviewer_name, rating, text, aspect_ratings, verified, verified_via, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Notify reviewed user / listing owner — fire-and-forget ───────────────
  try {
    const href = target_type === "listing"
      ? `/listings/${target_id}`
      : `/profile/${target_id}`;

    if (targetOwnerId !== userId) {
      await db.from("notifications").insert({
        user_id: targetOwnerId,
        type:    "review_request",
        title:   `Neue Bewertung von ${reviewer_name}`,
        body:    `${rating} ★ — ${text.trim().slice(0, 100)}`,
        href,
      });
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ review: data }, { status: 201 });
}

// ── Eligibility resolver ──────────────────────────────────────────────────────
// Returns "booking" | "application" | null

async function resolveEligibility(
  reviewerId: string,
  targetType: string,
  targetId:   string,
  ownerId:    string
): Promise<"booking" | "application" | null> {

  if (targetType === "listing") {
    // Confirmed booking by this reviewer on this exact listing
    const { data } = await db
      .from("bookings")
      .select("id")
      .eq("user_id",    reviewerId)
      .eq("listing_id", targetId)
      .eq("status",     "confirmed")
      .limit(1)
      .maybeSingle();
    return data ? "booking" : null;
  }

  // target_type === "user"
  // Check three relationships in parallel:
  //   A) reviewer applied to owner's job → accepted
  //   B) owner applied to reviewer's job → accepted
  //   C) reviewer has confirmed booking on one of owner's listings
  const [appA, appB, { data: ownerListings }] = await Promise.all([
    db.from("applications").select("id")
      .eq("owner_id",     ownerId)
      .eq("applicant_id", reviewerId)
      .eq("status",       "accepted")
      .limit(1).maybeSingle(),

    db.from("applications").select("id")
      .eq("owner_id",     reviewerId)
      .eq("applicant_id", ownerId)
      .eq("status",       "accepted")
      .limit(1).maybeSingle(),

    db.from("listings").select("id").eq("user_id", ownerId),
  ]);

  if (appA.data || appB.data) return "application";

  const ownerListingIds = (ownerListings ?? []).map((l: { id: string }) => l.id);
  if (ownerListingIds.length > 0) {
    const { data: booking } = await db
      .from("bookings")
      .select("id")
      .eq("user_id", reviewerId)
      .eq("status",  "confirmed")
      .in("listing_id", ownerListingIds)
      .limit(1)
      .maybeSingle();
    if (booking) return "booking";
  }

  return null;
}
