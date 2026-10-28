import { attemptedApproval, OFFER_MODERATION_COLUMNS } from "@/lib/offer-moderation";
import { getTranslations } from "next-intl/server";
import { bindResponsiblePerson } from "@/lib/responsible-person";
import { accountResponsiblePerson, validateResponsiblePerson } from "@/lib/responsible-person-server";
import { listingPriceMetadataError, listingPriceLabel } from "@/lib/listing-price";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { maxImagesForListingType, normalizeListingImageGallery } from "@/lib/listing-image-gallery";
import { editableCompanyIdsForUser } from "@/lib/listing-access";

// Explicit column list — avoids SELECT * sending unused data over the wire.
// Update this list if new listing columns are added.
const LISTING_COLS =
  "id, user_id, responsible_person, type, category, title, description, price, city, " +
  "image_url, company_id, published, metadata, blocked_dates, " +
  "floor_plan_url, extra_images, created_at," + OFFER_MODERATION_COLUMNS;

// Public callers only need fields used by listings and search cards. Keep
// internal ownership IDs, arbitrary metadata and private availability data on
// authenticated owner endpoints.
const LISTING_COLS_PUBLIC =
  "id, type, category, title, description, price, city, image_url, published, extra_images, created_at, price_negotiable:metadata->price_negotiable, price_on_request:metadata->price_on_request, rental_type:metadata->>rental_type";

function privateNoStoreJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(req: NextRequest) {
  const type  = req.nextUrl.searchParams.get("type");
  const mine  = req.nextUrl.searchParams.get("mine") === "true";
  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10)));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  if (mine) {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    try {
      const companyIds = await editableCompanyIdsForUser(userId);
      const [ownResult, companyResult] = await Promise.all([
        db.from("listings").select(LISTING_COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        companyIds.length
          ? db.from("listings").select(LISTING_COLS).in("company_id", companyIds).order("created_at", { ascending: false }).limit(200)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (ownResult.error || companyResult.error) throw new Error("Inserate konnten nicht geladen werden.");
      // The generated Supabase schema types lag the live listing table here;
      // normalize the selected row shape before merging the two result sets.
      const rows = [...(ownResult.data ?? []), ...(companyResult.data ?? [])] as unknown as Array<Record<string, unknown> & { id: string; created_at: string }>;
      const byId = new Map(rows.filter((listing) => !listing.company_id || companyIds.includes(String(listing.company_id))).map((listing) => [listing.id, listing]));
      const data = [...byId.values()].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)).slice(0, 200);
      const account = data.some(row => !row.responsible_person && !row.company_id && row.user_id === userId) ? await accountResponsiblePerson(userId) : null;
      return privateNoStoreJson({ data: data.map(row => ({ ...row, responsible_person: row.responsible_person || (!row.company_id && row.user_id === userId ? bindResponsiblePerson(account, userId) : null) })) });
    } catch (error) {
      console.error("[listings GET mine]", error);
      return privateNoStoreJson({ error: error instanceof Error ? error.message : "Inserate konnten nicht geladen werden." }, 500);
    }
  }

  let query = db
    .from("listings")
    .select(LISTING_COLS_PUBLIC)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) {
    console.error("[listings GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: (data ?? []).map((listing: Record<string, unknown>) => ({...listing,priceLabel:listingPriceLabel(Number(listing.price),listing)})), page, limit }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`listing:${userId}`, 10, 3600);
  if (!allowed) return NextResponse.json({ error: "Maximal 10 Inserate pro Stunde." }, { status: 429 });

  const body = await req.json();
  if (attemptedApproval(body)) return privateNoStoreJson({ error: (await getTranslations("OfferModeration"))("adminOnly") }, 403);
  const { type, title, description, price, city, category, image_url, company_id,
          metadata, blocked_dates, floor_plan_url, extra_images, rental_type, draft, onboarding_request_key } = body;

  let storedImageUrl = image_url ?? null;
  let storedExtraImages = extra_images;

  const VALID_LISTING_TYPES = new Set(["job", "location", "prop", "vehicle", "creator", "animal"]);

  if (!type || !title || !city) {
    return NextResponse.json({ error: "Pflichtfelder fehlen (type, title, city)" }, { status: 400 });
  }

  if (!VALID_LISTING_TYPES.has(type)) {
    return NextResponse.json({ error: "Ungültiger Inserat-Typ" }, { status: 400 });
  }
  if (type === "location" || type === "prop" || type === "vehicle" || type === "animal") {
    const gallery = normalizeListingImageGallery(image_url, extra_images, maxImagesForListingType(type));
    if (!gallery.ok) return NextResponse.json({ error: gallery.error }, { status: 400 });
    storedImageUrl = gallery.gallery.imageUrl;
    storedExtraImages = gallery.gallery.extraImages;
  }
  if (onboarding_request_key !== undefined && (draft !== true || typeof onboarding_request_key !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(onboarding_request_key))) {
    return NextResponse.json({ error: "Ungültiger Einrichtungsauftrag" }, { status: 400 });
  }

  if (metadata !== undefined && metadata !== null) { const pricingError = listingPriceMetadataError(metadata); if (pricingError) return NextResponse.json({ error: pricingError }, { status: 400 }); }

  // SECURITY: input length limits and price sanitization
  if (title.length > 200) return NextResponse.json({ error: "Titel zu lang (max. 200 Zeichen)" }, { status: 400 });
  if (city.length > 100) return NextResponse.json({ error: "Stadt zu lang (max. 100 Zeichen)" }, { status: 400 });
  if (description && description.length > 5000) return NextResponse.json({ error: "Beschreibung zu lang (max. 5000 Zeichen)" }, { status: 400 });
  const safePrice = Math.max(0, Math.min(Number(price) || 0, 1_000_000));

  // If company_id is provided, verify the current user owns that company
  if (company_id) {
    const { data: company } = await db
      .from("companies")
      .select("id")
      .eq("id", company_id)
      .eq("owner_user_id", userId)
      .single();
    if (!company) {
      return NextResponse.json({ error: "Firma nicht gefunden oder keine Berechtigung" }, { status: 403 });
    }
  }

  const marketplace = type === "prop" || type === "vehicle";
  const responsible = marketplace
    ? await (await import("@/lib/responsible-person-server")).validateMarketplaceResponsiblePerson(body.responsible_person, userId, draft !== true)
    : await validateResponsiblePerson(body.responsible_person, userId, false, draft !== true && type !== "job");
  if (responsible.response) return responsible.response;

  const animalData = type === "animal" ? (await import("@/lib/animal-taxonomy")).animalPortfolioMetadata(category, metadata, rental_type) : null;
  if (type === "animal" && !animalData) return privateNoStoreJson({ error: (await getTranslations("FilmAnimals"))("portfolioHelp") }, 400);
  // rental_type column doesn't exist — store it inside metadata
  const mergedMetadata = {
    ...(type === "animal" ? animalData : metadata ?? {}),
    ...(typeof onboarding_request_key === "string" && { onboarding_request_key }),
    ...(type !== "animal" && rental_type !== undefined && { rental_type }),
  };

  // A private setup draft can be retried after a lost browser response. Reuse
  // the first row for the persisted request key instead of creating a duplicate.
  if (typeof onboarding_request_key === "string") {
    const { data: existing, error: lookupError } = await db
      .from("listings")
      .select(LISTING_COLS)
      .eq("user_id", userId)
      .contains("metadata", { onboarding_request_key })
      .maybeSingle();
    if (lookupError) {
      console.error("[listings POST] onboarding retry lookup failed", lookupError);
      return NextResponse.json({ error: "Der gespeicherte Angebotsentwurf konnte nicht geprüft werden." }, { status: 500 });
    }
    if (existing) return privateNoStoreJson({ data: existing });
  }

  const { data, error } = await db
    .from("listings")
    .insert({
      user_id: userId,
      responsible_person: responsible.person,
      type,
      category: category ?? null,
      title,
      description: description ?? "",
      price: type === "animal" ? 0 : safePrice,
      city,
      image_url: storedImageUrl,
      company_id: company_id ?? null,
      // Saving or completing an offer never grants public release.
      published: false,
      moderation_status: draft === true || type === "job" || marketplace ? "draft" : "pending",
      last_editor_id: userId,
      metadata: mergedMetadata,
      ...(blocked_dates !== undefined && { blocked_dates }),
      ...(floor_plan_url !== undefined && { floor_plan_url }),
      ...((type === "prop" || type === "vehicle" || type === "animal")
        ? { extra_images: storedExtraImages }
        : extra_images !== undefined && { extra_images }),
    })
    .select()
    .single();

  if (error) {
    console.error("[listings POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let result = data;
  let publicationError: string | undefined;
  if (marketplace && draft !== true) {
    const publication = await (await import("@/lib/marketplace-publication-server")).publishMarketplaceOffer(data, userId);
    result = publication.row;
    publicationError = publication.error;
    if (publication.outcome === "profile_required") {
      const submitted = await db.rpc("offer_review_transition", { p_kind: "listing", p_id: data.id, p_expected: data,
        p_provider_company: null, p_provider_profile: null, p_action: "submit", p_actor: userId, p_reason: null, p_notification: null });
      if (!submitted.error && ["saved", "unchanged"].includes(submitted.data)) result = { ...data, moderation_status: "pending", published: false };
      else publicationError = (await getTranslations("MarketplacePublishing"))("saveError");
    }
  }
  // Revalidate the relevant listing page so the new entry shows up immediately
  const pathMap: Record<string, string> = {
    job: "/jobs",
    location: "/locations",
    prop: "/props",
    vehicle: "/vehicles",
    creator: "/creators",
    animal: "/tiere",
  };
  if (pathMap[type]) revalidatePath(pathMap[type]);
  revalidatePath("/", "layout");
  revalidateTag("listings", { expire: 0 });

  return privateNoStoreJson({ data: result, publicationError, submitted: result.moderation_status === "pending", message: result.published ? (await getTranslations("MarketplacePublishing"))("published") : result.moderation_status === "pending" ? (await getTranslations("OfferModeration"))("submitted") : null });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID fehlt" }, { status: 400 });

  // Only allow deleting own listings
  const { error } = await db
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[listings DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath("/", "layout");
  revalidateTag("listings", { expire: 0 });
  return NextResponse.json({ success: true });
}
