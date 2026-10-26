import { listingPriceMetadataError } from "@/lib/listing-price";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { maxImagesForListingType, normalizeListingImageGallery } from "@/lib/listing-image-gallery";
import { canEditListing } from "@/lib/listing-access";

// PATCH /api/listings/[id] — edit own listing
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const { data: current, error: currentError } = await db.from("listings")
    .select("id, user_id, company_id, type, image_url, extra_images, metadata, blocked_dates")
    .eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "Inserat konnte nicht geprüft werden." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  try {
    if (!(await canEditListing(userId, current))) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Berechtigung zur Firmenverwaltung konnte nicht geprüft werden." }, { status: 500 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const { title, description, price, city, published, image_url, extra_images, metadata, blocked_dates } = body;

  if (published === true) {
    return NextResponse.json({ error: "Zum Veröffentlichen bitte die ausdrückliche Freigabe-Aktion verwenden." }, { status: 400 });
  }

  if (title !== undefined && title.length > 200)
    return NextResponse.json({ error: "Titel zu lang (max. 200 Zeichen)" }, { status: 400 });
  if (city !== undefined && city.length > 100)
    return NextResponse.json({ error: "Stadt zu lang (max. 100 Zeichen)" }, { status: 400 });
  if (description !== undefined && description.length > 5000)
    return NextResponse.json({ error: "Beschreibung zu lang (max. 5000 Zeichen)" }, { status: 400 });
  if (image_url !== undefined && image_url !== null && (typeof image_url !== "string" || image_url.length > 2048))
    return NextResponse.json({ error: "Das Bild ist ungültig." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (title !== undefined)       updates.title       = title.trim();
  if (description !== undefined) updates.description = description;
  if (price !== undefined)       updates.price       = Math.max(0, Math.min(Number(price) || 0, 1_000_000));
  if (city !== undefined)        updates.city        = city.trim();
  if (published === false)       updates.published   = false;
  if (image_url !== undefined || extra_images !== undefined || metadata !== undefined || blocked_dates !== undefined) {
    if (blocked_dates !== undefined) {
      const hasInvalidBlockedDate = Array.isArray(blocked_dates) && blocked_dates.some((date) => {
        if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return true;
        const parsed = new Date(`${date}T00:00:00.000Z`);
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date;
      });
      if (current.type !== "location" || !Array.isArray(blocked_dates) || blocked_dates.length > 500 || hasInvalidBlockedDate) {
        return NextResponse.json({ error: "Die gesperrten Drehtage sind ungültig." }, { status: 400 });
      }
      updates.blocked_dates = [...new Set(blocked_dates)];
    }

    if ((image_url !== undefined || extra_images !== undefined) && (current.type === "prop" || current.type === "vehicle" || current.type === "location")) {
      const gallery = normalizeListingImageGallery(
        image_url !== undefined ? image_url : current.image_url,
        extra_images !== undefined ? extra_images : current.extra_images,
        maxImagesForListingType(current.type),
      );
      if (!gallery.ok) return NextResponse.json({ error: gallery.error }, { status: 400 });
      updates.image_url = gallery.gallery.imageUrl;
      updates.extra_images = gallery.gallery.extraImages;
    } else if (image_url !== undefined || extra_images !== undefined) {
      if (extra_images !== undefined) {
        return NextResponse.json({ error: "Eine Bildergalerie kann nur bei Locations und Marktplatzartikeln geändert werden." }, { status: 400 });
      }
      if (image_url !== undefined) updates.image_url = image_url || null;
    }

    if (metadata !== undefined) {
      if (!["location", "prop", "vehicle"].includes(current.type)) return NextResponse.json({ error: "Preisangaben können nur bei Locations und Marktplatzangeboten geändert werden." }, { status: 400 });
      const pricingError = listingPriceMetadataError(metadata);
      if (pricingError) return NextResponse.json({ error: pricingError }, { status: 400 });
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return NextResponse.json({ error: "Die Locationangaben sind ungültig." }, { status: 400 });
      const incoming = metadata as Record<string, unknown>;
      const merged = current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
        ? { ...(current.metadata as Record<string, unknown>) }
        : {};
      if (current.type !== "location" && Object.keys(incoming).some(key => !["price_negotiable", "price_on_request"].includes(key))) return NextResponse.json({ error: "Es können nur die Preisangaben geändert werden." }, { status: 400 });
      const numericFields: Record<string, number> = { sqm: 1000000, ceiling_height_m: 1000, max_crew: 100000, parking_spots: 100000 };
      for (const [key, maximum] of Object.entries(numericFields)) {
        if (!(key in incoming)) continue;
        const value = incoming[key];
        if (value === null || value === "") { merged[key] = null; continue; }
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > maximum) return NextResponse.json({ error: `Die Angabe „${key}“ ist ungültig.` }, { status: 400 });
        merged[key] = number;
      }
      if ("indoor_outdoor" in incoming) {
        if (!["innen", "außen", "beides"].includes(String(incoming.indoor_outdoor))) return NextResponse.json({ error: "Bitte wähle Innen, Außen oder Innen & Außen." }, { status: 400 });
        merged.indoor_outdoor = incoming.indoor_outdoor;
      }
      for (const key of ["power_available", "natural_light", "blackout_possible", "loading_access", "price_on_request", "price_negotiable"]) {
        if (!(key in incoming)) continue;
        if (typeof incoming[key] !== "boolean") return NextResponse.json({ error: "Eine Ausstattungsangabe ist ungültig." }, { status: 400 });
        merged[key] = incoming[key];
      }
      for (const [key, maximum] of [["power_details", 160], ["access_notes", 240], ["shooting_hours", 160], ["availability_notes", 500]] as const) {
        if (!(key in incoming)) continue;
        if (typeof incoming[key] !== "string" || incoming[key].length > maximum) return NextResponse.json({ error: `Die Angabe „${key}“ ist zu lang oder ungültig.` }, { status: 400 });
        merged[key] = incoming[key].trim();
      }
      for (const key of ["rooms", "amenities"] as const) {
        if (!(key in incoming)) continue;
        const value = incoming[key];
        if (!Array.isArray(value) || value.length > 80 || value.some((item) => typeof item !== "string" || item.length > 100)) return NextResponse.json({ error: "Die ausgewählten Räume oder Ausstattungen sind ungültig." }, { status: 400 });
        merged[key] = [...new Set(value.map((item) => (item as string).trim()).filter(Boolean))];
      }
      if (incoming.price_negotiable === true) merged.price_on_request = false;
      if (incoming.price_on_request === true) merged.price_negotiable = false;
      updates.metadata = merged;
    }
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });

  const { data, error } = await db
    .from("listings")
    .update(updates)
    .eq("id", id)
    .select("id, type")
    .single();

  if (error) {
    console.error("[listings PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });

  const pathMap: Record<string, string> = {
    job: "/jobs", location: "/locations", prop: "/props",
    vehicle: "/vehicles", creator: "/creators", animal: "/tiere",
  };
  if (pathMap[data.type]) revalidatePath(pathMap[data.type]);
  revalidateTag("listings", "max");

  return NextResponse.json({ success: true });
}

// DELETE /api/listings/[id] — delete own listing
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  const { data: listing } = await db
    .from("listings")
    .select("id, type, user_id, company_id")
    .eq("id", id).maybeSingle();

  if (!listing) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  try {
    if (!(await canEditListing(userId, listing))) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Berechtigung zur Firmenverwaltung konnte nicht geprüft werden." }, { status: 500 });
  }

  const { error } = await db
    .from("listings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[listings DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pathMap: Record<string, string> = {
    job: "/jobs", location: "/locations", prop: "/props",
    vehicle: "/vehicles", creator: "/creators", animal: "/tiere",
  };
  if (listing?.type && pathMap[listing.type]) revalidatePath(pathMap[listing.type]);
  revalidateTag("listings", "max");

  return NextResponse.json({ success: true });
}
