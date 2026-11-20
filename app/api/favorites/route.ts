import { listingPriceLabel } from "@/lib/listing-price";
import { placeReadFields } from "@/lib/places/catalog";
import { PLACE_COLUMNS, placeDisplay } from "@/lib/places/core";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

type ResolvedFavorite = {
  id: string; listing_id: string; listing_type: string; listing_title: string | null;
  listing_city: string | null; listing_price: number | null; listing_image: string | null;
  created_at: string; href?: string; priceLabel?: string;
};

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
async function unavailable() {
  const t = await getTranslations();
  return response({ error: t("System.requestFailed") }, 503);
}

// Bookmark metadata is always resolved from its current, permission-checked source.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return response({ favorites: [], isFavorited: false }, 401);
  const { userId } = user;
  const expectedAccount = req.headers.get("X-Favorites-Account");
  if (expectedAccount && expectedAccount !== userId) return response({ error: (await getTranslations())("System.requestFailed") }, 409);
  const id = req.nextUrl.searchParams.get("id"), ids = req.nextUrl.searchParams.get("ids");
  try {
    if (id) {
      if (!validId(id)) return response({ error: (await getTranslations())("System.m_6f1dc120d2ab") }, 400);
      const { data, error } = await db.from("favorites").select("id").eq("user_id", userId).eq("listing_id", id).maybeSingle();
      if (error) return unavailable();
      return response({ isFavorited: !!data });
    }
    if (ids) {
      const idList = [...new Set(ids.split(",").filter(Boolean))].slice(0, 300);
      if (!idList.length || idList.some(value => !validId(value))) return response({ error: (await getTranslations())("System.m_6f1dc120d2ab") }, 400);
      const { data, error } = await db.from("favorites").select("listing_id").eq("user_id", userId).in("listing_id", idList);
      if (error) return unavailable();
      return response({ favorited: (data ?? []).map(row => row.listing_id) });
    }
    const { data, error } = await db.from("favorites")
      .select("id, listing_id, listing_type, listing_title, listing_city, listing_price, listing_image, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
    if (error) return unavailable();
    const favorites = data ?? [];
    const offerIds = favorites.filter(row => row.listing_type !== "creator").map(row => row.listing_id);
    const profileIds = favorites.filter(row => row.listing_type === "creator").map(row => row.listing_id);
    const current = offerIds.length ? await db.from("privacy_visible_listings")
      .select(`id,type,title,city,price,image_url,price_currency:metadata->>price_currency, price_negotiable:metadata->price_negotiable,price_on_request:metadata->price_on_request,rental_type:metadata->>rental_type,marketplace:metadata->marketplace,${PLACE_COLUMNS}`)
      .in("id", offerIds).eq("published", true) : { data: [], error: null };
    if (current.error) return unavailable();
    const access = await profileAccessFor(profileIds, userId, { throwOnError: true });
    const visibleProfileIds = profileIds.filter(profileId => access.get(profileId)?.profile);
    const profiles = visibleProfileIds.length ? await db.from("profiles")
      .select(`user_id,slug,display_name,location,avatar_url,${PLACE_COLUMNS}`).in("user_id", visibleProfileIds) : { data: [], error: null };
    if (profiles.error) return unavailable();
    const market = await getTranslations("MarketplaceOffer"), locale = await getLocale();
    const visible = new Map((current.data ?? []).map(row => [row.id, row]));
    const people = new Map((profiles.data ?? []).map(row => [row.user_id, projectProfilePrivacy(row, access.get(row.user_id))]));
    return response({ favorites: favorites.flatMap<ResolvedFavorite>(row => {
      if (row.listing_type === "creator") {
        const person = people.get(row.listing_id);
        return person ? [{ ...row, listing_title: person.display_name, listing_city: access.get(person.user_id)?.location ? placeDisplay(placeReadFields(person.location ?? "", person, locale), person.location ?? "", locale) : null,
          listing_price: null, listing_image: person.avatar_url, href: `/profile/${encodeURIComponent(person.slug || person.user_id)}` }] : [];
      }
      const offer = visible.get(row.listing_id);
      return offer ? [{ ...row, listing_type: offer.type, listing_title: offer.title,
        listing_city: placeDisplay(placeReadFields(offer.city ?? "", offer, locale), offer.city ?? "", locale),
        listing_price: offer.price, priceLabel: listingPriceLabel(offer.price, offer, "/Tag", locale, market), listing_image: offer.image_url }] : [];
    }) });
  } catch {
    return unavailable();
  }
}

// Explicit desired states are safely repeatable after a lost response; older clients retain toggle semantics.
export async function POST(req: NextRequest) {
  const t = await getTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const expectedAccount = req.headers.get("X-Favorites-Account");
  if (expectedAccount && expectedAccount !== userId) return response({ error: t("System.requestFailed") }, 409);
  const { allowed } = await rateLimit(`fav:${userId}`, 60, 60);
  if (!allowed) return response({ error: t("System.m_35bd89251439") }, 429);
  const body = await req.json().catch(() => null);
  if (!body || !validId(body.listing_id) || body.action !== undefined && !["add", "remove"].includes(body.action)) return response({ error: t("System.m_6f1dc120d2ab") }, 400);
  const { listing_id } = body;
  try {
    const { data: existing, error: lookupError } = await db.from("favorites").select("id, listing_type").eq("user_id", userId).eq("listing_id", listing_id).maybeSingle();
    if (lookupError) return unavailable();
    if (body.action === "remove" || existing && body.action !== "add") {
      if (existing) {
        const { error } = await db.from("favorites").delete().eq("id", existing.id).eq("user_id", userId).eq("listing_id", listing_id);
        if (error) return unavailable();
      }
      return response({ isFavorited: false, listingId: listing_id });
    }
    let bookmark: { listing_type: string; listing_title?: string | null; listing_city?: string | null; listing_price?: number | null; listing_image?: string | null };
    if (body.listing_type === "creator" || existing?.listing_type === "creator") {
      const access = await profileAccessFor([listing_id], userId, { throwOnError: true });
      if (!access.get(listing_id)?.profile) return response({ error: t("System.m_853de52d816c") }, 404);
      const { data: profile, error } = await db.from("profiles").select("user_id").eq("user_id", listing_id).maybeSingle();
      if (error) return unavailable();
      if (!profile) return response({ error: t("System.m_853de52d816c") }, 404);
      bookmark = { listing_type: "creator" };
    } else {
      const { data: listing, error } = await db.from("privacy_visible_listings").select("type, title, city, price, image_url").eq("published", true).eq("id", listing_id).maybeSingle();
      if (error) return unavailable();
      if (!listing) return response({ error: t("System.m_853de52d816c") }, 404);
      bookmark = { listing_type: listing.type, listing_title: listing.title ?? null, listing_city: listing.city ?? null, listing_price: listing.price ?? null, listing_image: listing.image_url ?? null };
    }
    if (existing) return response({ isFavorited: true, listingId: listing_id });
    const { error } = await db.from("favorites").insert({ user_id: userId, listing_id, ...bookmark });
    if (error) {
      if (error.code !== "23505") return unavailable();
      const confirmed = await db.from("favorites").select("id").eq("user_id", userId).eq("listing_id", listing_id).maybeSingle();
      if (confirmed.error || !confirmed.data) return unavailable();
    }
    // Another tab saving this same bookmark concurrently is the same confirmed state.
    return response({ isFavorited: true, listingId: listing_id });
  } catch {
    return unavailable();
  }
}
