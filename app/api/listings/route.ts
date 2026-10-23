import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { normalizeListingImageGallery } from "@/lib/listing-image-gallery";

// Explicit column list — avoids SELECT * sending unused data over the wire.
// Update this list if new listing columns are added.
const LISTING_COLS =
  "id, user_id, type, category, title, description, price, city, " +
  "image_url, company_id, published, metadata, blocked_dates, " +
  "floor_plan_url, extra_images, created_at";

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

    const { data, error } = await db
      .from("listings")
      .select(LISTING_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);           // safety cap — dashboard doesn't need more

    if (error) {
      console.error("[listings GET mine]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  let query = db
    .from("listings")
    .select(LISTING_COLS)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) {
    console.error("[listings GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data, page, limit });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`listing:${userId}`, 10, 3600);
  if (!allowed) return NextResponse.json({ error: "Maximal 10 Inserate pro Stunde." }, { status: 429 });

  const body = await req.json();
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
  if (type === "prop" || type === "vehicle") {
    const gallery = normalizeListingImageGallery(image_url, extra_images);
    if (!gallery.ok) return NextResponse.json({ error: gallery.error }, { status: 400 });
    storedImageUrl = gallery.gallery.imageUrl;
    storedExtraImages = gallery.gallery.extraImages;
  }
  if (onboarding_request_key !== undefined && (draft !== true || typeof onboarding_request_key !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(onboarding_request_key))) {
    return NextResponse.json({ error: "Ungültiger Einrichtungsauftrag" }, { status: 400 });
  }

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

  // rental_type column doesn't exist — store it inside metadata
  const mergedMetadata = {
    ...(metadata ?? {}),
    ...(typeof onboarding_request_key === "string" && { onboarding_request_key }),
    ...(rental_type !== undefined && { rental_type }),
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
    if (existing) return NextResponse.json({ data: existing });
  }

  const { data, error } = await db
    .from("listings")
    .insert({
      user_id: userId,
      type,
      category: category ?? null,
      title,
      description: description ?? "",
      price: safePrice,
      city,
      image_url: storedImageUrl,
      company_id: company_id ?? null,
      // Jobs and guided onboarding entries start private; publishing is an explicit owner action.
      published: type === "job" || draft === true ? false : true,
      metadata: mergedMetadata,
      ...(blocked_dates !== undefined && { blocked_dates }),
      ...(floor_plan_url !== undefined && { floor_plan_url }),
      ...((type === "prop" || type === "vehicle")
        ? { extra_images: storedExtraImages }
        : extra_images !== undefined && { extra_images }),
    })
    .select()
    .single();

  if (error) {
    console.error("[listings POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  revalidateTag("listings", "max");

  return NextResponse.json({ data });
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
  revalidateTag("listings", "max");
  return NextResponse.json({ success: true });
}
