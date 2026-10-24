import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { buildStoragePath, validateUpload } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getListingProvider } from "@/lib/listing-provider";
import { listingDetailPath } from "@/lib/listing-routes";
import { validateListingPublication } from "@/lib/listing-publication";

const PATHS: Record<string, string> = {
  job: "/jobs", location: "/locations", prop: "/props", vehicle: "/vehicles", creator: "/creators", animal: "/tiere",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { data: listing, error: listingError } = await db
    .from("listings")
    .select("id, user_id, company_id, type, title, description, city, category, image_url, published")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (listingError) return NextResponse.json({ error: "Inserat konnte nicht geladen werden" }, { status: 500 });
  if (!listing) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  if (listing.published) return NextResponse.json({ success: true, alreadyPublished: true });

  if (listing.type === "job") {
    const description = listing.description ?? "";
    if (!listing.title?.trim() || !listing.city?.trim() || !/Rolle:\s*[^·\n]+/.test(description) || !/Drehtage:\s*[^·\n]+/.test(description)) {
      return NextResponse.json({ error: "Bitte ergänze Titel, Rolle, Ort und Drehtag, bevor du den Job veröffentlichst." }, { status: 400 });
    }
  }

  const companyResult = listing.company_id
    ? await db.from("companies").select("slug").eq("id", listing.company_id).maybeSingle()
    : { data: null };
  if (listing.company_id && !companyResult.data) return NextResponse.json({ error: "Die zugeordnete Firma konnte nicht geprüft werden." }, { status: 500 });

  const isMultipart = req.headers.get("content-type")?.includes("multipart/form-data") ?? false;
  const formData = isMultipart ? await req.formData() : null;
  const file = formData?.get("file") ?? null;
  if (file && !(file instanceof File)) return NextResponse.json({ error: "Ungültige Bilddatei" }, { status: 400 });
  if (file instanceof File) {
    const { allowed } = await rateLimit(`upload:${userId}`, 10, 60);
    if (!allowed) return NextResponse.json({ error: "Zu viele Uploads. Bitte kurz warten." }, { status: 429 });
  }
  const upload = file instanceof File ? await validateUpload(file) : null;
  if (upload && "error" in upload) return NextResponse.json({ error: upload.error }, { status: upload.status });

  const provider = await getListingProvider(listing.user_id, listing.company_id, userId);
  const validationError = validateListingPublication({
    type: listing.type,
    title: listing.title,
    city: listing.city,
    category: listing.category,
    imageUrl: listing.image_url,
    imageWillBeUploaded: upload !== null,
    companySlug: companyResult.data?.slug,
    providerAssigned: provider.kind !== "unassigned",
    providerContactable: Boolean(provider.contactUserId),
  });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  let uploadedPath: string | null = null;
  let imageUrl: string | null = null;
  if (file instanceof File && upload && !("error" in upload)) {
      uploadedPath = buildStoragePath(userId, upload.ext);
      const { error: uploadError } = await db.storage.from("listing-images").upload(uploadedPath, upload.buffer, {
        contentType: upload.mime,
        upsert: false,
      });
      if (uploadError) return NextResponse.json({ error: "Bild konnte nicht hochgeladen werden" }, { status: 500 });
      imageUrl = db.storage.from("listing-images").getPublicUrl(uploadedPath).data.publicUrl;
  }

  const updates: Record<string, unknown> = { published: true };
  if (imageUrl) updates.image_url = imageUrl;
  const { data, error } = await db
    .from("listings")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .eq("published", false)
    .select("id, type")
    .maybeSingle();

  if (error || !data) {
    if (uploadedPath) await db.storage.from("listing-images").remove([uploadedPath]);
    return NextResponse.json({ error: error ? "Inserat konnte nicht veröffentlicht werden" : "Der Status hat sich inzwischen geändert. Bitte lade die Seite neu." }, { status: error ? 500 : 409 });
  }

  if (PATHS[data.type]) revalidatePath(PATHS[data.type]);
  const detailPath = listingDetailPath(data.type, data.id, companyResult.data?.slug);
  if (detailPath) revalidatePath(detailPath);
  revalidateTag("listings", "max");
  return NextResponse.json({ success: true });
}
