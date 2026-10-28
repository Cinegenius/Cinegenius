import { validateResponsiblePerson } from "@/lib/responsible-person-server";
import { getTranslations } from "next-intl/server";
import { storeProtectedMedia, removeUnusedProtectedMedia } from "@/lib/protected-media-server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { buildStoragePath, validateUpload } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getListingProvider } from "@/lib/listing-provider";
import { listingDetailPath } from "@/lib/listing-routes";
import { validateListingPublication } from "@/lib/listing-publication";
import { canEditListing } from "@/lib/listing-access";

const PATHS: Record<string, string> = {
  job: "/jobs", location: "/locations", prop: "/props", vehicle: "/vehicles", creator: "/creators", animal: "/tiere",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getTranslations("mediaSecurity");
  const moderation = await getTranslations("OfferModeration");
  const { id } = await params;

  const { data: listing, error: listingError } = await db
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (listingError) return NextResponse.json({ error: "Inserat konnte nicht geladen werden" }, { status: 500 });
  if (!listing) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  try {
    if (!(await canEditListing(userId, listing))) return NextResponse.json({ error: "Inserat nicht gefunden oder keine Berechtigung" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Berechtigung zur Firmenverwaltung konnte nicht geprüft werden." }, { status: 500 });
  }
  if (listing.moderation_status === "approved" || listing.moderation_status === "pending") return NextResponse.json({ success: true, submitted: listing.moderation_status === "pending", moderation_status: listing.moderation_status, published: listing.published, message: moderation(listing.moderation_status === "pending" ? "submitted" : "alreadyApproved") });

  if (!listing.responsible_person?.userId) {
    const tResponsible = await getTranslations("responsiblePerson");
    return NextResponse.json({ error: tResponsible("required"), field: "responsible_person" }, { status: 400 });
  }
  const responsible = await validateResponsiblePerson(listing.responsible_person, listing.responsible_person.userId, false);
  if (responsible.response) return responsible.response;

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
  const upload = file instanceof File ? await validateUpload(file, { emptyMessage: t("empty"), tooLargeMessage: t("tooLarge"), unsupportedTypeMessage: t("invalid") }) : null;
  if (upload && "error" in upload) return NextResponse.json({ error: upload.error }, { status: upload.status });

  const provider = await getListingProvider(listing.user_id, listing.company_id, userId, listing.responsible_person);
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
      try {
        imageUrl = await storeProtectedMedia(userId, uploadedPath, upload.buffer, upload.mime);
      } catch {
        return NextResponse.json({ error: "Bild konnte nicht hochgeladen werden" }, { status: 500 });
      }
  }

  let current = listing;
  if (imageUrl) {
    const changed = await db.from("listings").update({ image_url: imageUrl, last_editor_id: userId }).eq("id", id).eq("content_revision", listing.content_revision).select().maybeSingle();
    if (changed.error || !changed.data) {
      if (uploadedPath) await removeUnusedProtectedMedia(userId, uploadedPath);
      return NextResponse.json({ error: moderation("stale") }, { status: 409 });
    }
    current = changed.data;
  }
  const saved = await db.rpc("offer_review_transition", {
    p_kind: "listing", p_id: id, p_expected: current, p_provider_company: null, p_provider_profile: null,
    p_action: "submit", p_actor: userId, p_reason: null, p_notification: null,
  });
  if (saved.error || !["saved", "unchanged"].includes(saved.data)) return NextResponse.json({ error: moderation(saved.data === "stale" ? "stale" : "saveError") }, { status: saved.data === "stale" ? 409 : 503 });
  const data = current;

  if (PATHS[data.type]) revalidatePath(PATHS[data.type]);
  const detailPath = listingDetailPath(data.type, data.id, companyResult.data?.slug);
  if (detailPath) revalidatePath(detailPath);
  revalidateTag("listings", { expire: 0 });
  return NextResponse.json({ success: true, submitted: true, published: false, moderation_status: "pending", message: moderation("submitted") }, { headers: { "Cache-Control": "private, no-store" } });
}
