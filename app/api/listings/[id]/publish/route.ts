import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { buildStoragePath, validateUpload } from "@/lib/uploadGuard";
import { rateLimit } from "@/lib/rateLimit";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

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
    .select("id, user_id, type, title, description, city, image_url, published")
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

  let uploadedPath: string | null = null;
  let imageUrl: string | null = null;
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    if (file && !(file instanceof File)) return NextResponse.json({ error: "Ungültige Bilddatei" }, { status: 400 });
    if (file instanceof File) {
      const { allowed } = await rateLimit(`upload:${userId}`, 10, 60);
      if (!allowed) return NextResponse.json({ error: "Zu viele Uploads. Bitte kurz warten." }, { status: 429 });
      const validation = await validateUpload(file);
      if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: validation.status });
      uploadedPath = buildStoragePath(userId, validation.ext);
      const { error: uploadError } = await db.storage.from("listing-images").upload(uploadedPath, validation.buffer, {
        contentType: validation.mime,
        upsert: false,
      });
      if (uploadError) return NextResponse.json({ error: "Bild konnte nicht hochgeladen werden" }, { status: 500 });
      imageUrl = db.storage.from("listing-images").getPublicUrl(uploadedPath).data.publicUrl;
    }
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
  revalidateTag("listings", "max");
  return NextResponse.json({ success: true });
}
